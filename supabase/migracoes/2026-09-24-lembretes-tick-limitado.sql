-- =====================================================================
--  Migração 2026-09-24 — lembretes II: o tick limitado e em lotes
--  (SPEC §23.15, correção da revisão do PR #30)
-- ---------------------------------------------------------------------
--  SÓ O DELTA em relação ao schema aplicado (que já tem tudo da migração
--  2026-09-23-lembretes-disparo, inclusive o job "lembretes" que chama
--  `public.lembretes_tick()` a cada 5 minutos): troca o CORPO do tick por
--  `create or replace` — mesma assinatura, mesmas guardas, mesmos revokes.
--  O job não muda (continua chamando a função pelo nome).
--
--  Antes: `profiles.prefs` inteiro de todas as contas num POST só — uma conta
--  com prefs grande passava dos 512 KiB da rota e o lembrete de ninguém saía.
--  Agora: só as chaves de `prefs` que a regra lê, listas com teto e as contas
--  em lotes (até 50 e 256 KiB por POST; conta acima de 32 KiB fica de fora).
--
--  Idempotente e expand-only (só `create or replace` e o revoke). O mesmo
--  SQL está em `supabase/schema.sql` — `lib/migracao-lembretes-tick-limitado.test.ts`
--  não deixa os dois desencontrarem. Nenhum segredo aqui. Quem aplica é o
--  orquestrador, antes do deploy.
-- =====================================================================

-- O tick (SPEC §23.15): executa quem é dono do job (postgres) e o
-- service_role pelo padrão do projeto Supabase (o app nunca o usa); anon e
-- authenticated, não. Lê o Vault e manda para a rota, em LOTES, o mínimo de
-- cada conta com lembrete ligado e aparelho inscrito: de `prefs` só as chaves
-- que a regra lê (`lembretes`, `dias_de_treino`), cada uma só se couber, e
-- listas com teto. Até 50 contas e 256 KiB por POST; uma conta que sozinha
-- passe de 32 KiB não vai — nunca derruba o lote das outras.
create or replace function public.lembretes_tick() returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_url      text;
  v_segredo  text;
  v_hoje     date := (now() at time zone 'America/Sao_Paulo')::date;
  v_conta    jsonb;
  v_tamanho  int;
  v_lote     jsonb := '[]'::jsonb;
  v_contas   int := 0;
  v_bytes    int := 0;
  v_puladas  int := 0;
begin
  -- sem o pg_net ou sem o Vault: nada a fazer, e nada quebra
  if not exists (select 1 from pg_extension where extname = 'pg_net')
     or to_regclass('vault.decrypted_secrets') is null then
    return;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v_url using 'lembretes_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
    into v_segredo using 'lembretes_segredo';
  if coalesce(v_url, '') = '' or coalesce(v_segredo, '') = '' then
    return;
  end if;

  for v_conta in
    select jsonb_build_object(
      'user_id', p.user_id,
      'perfil', jsonb_build_object(
        'data_inicio', p.data_inicio, 'fase_atual', p.fase_atual, 'fase_desde', p.fase_desde,
        'ultimo_treino', p.ultimo_treino, 'semana_corrida', p.semana_corrida,
        'semana_corda', p.semana_corda, 'semana_fixa', p.semana_fixa,
        'prefs', jsonb_strip_nulls(jsonb_build_object(
          'lembretes', case when octet_length((p.prefs -> 'lembretes')::text) <= 1024
                            then p.prefs -> 'lembretes' end,
          'dias_de_treino', case when octet_length((p.prefs -> 'dias_de_treino')::text) <= 256
                                 then p.prefs -> 'dias_de_treino' end))),
      'overrides', coalesce((
        select jsonb_agg(x.linha) from (
          select jsonb_build_object('data', o.data, 'tipo', o.tipo,
                                    'workout_id', o.workout_id, 'sessao', o.sessao) as linha
          from public.schedule_overrides o
          where o.user_id = p.user_id and o.data between v_hoje - 8 and v_hoje + 7
          order by o.data
          limit 40) x), '[]'::jsonb),
      'sessoes', coalesce((
        select jsonb_agg(x.linha) from (
          select jsonb_build_object('id', s.id, 'data', s.data, 'status', s.status,
                                    'workout_id', s.workout_id) as linha
          from public.sessions s
          where s.user_id = p.user_id and s.data between v_hoje - 8 and v_hoje
          order by s.data desc
          limit 40) x), '[]'::jsonb),
      'cardios', coalesce((
        select jsonb_agg(x.linha) from (
          select jsonb_build_object('id', c.id, 'data', c.data, 'tipo', c.tipo,
                                    'concluida', c.concluida) as linha
          from public.cardio_sessions c
          where c.user_id = p.user_id and c.data between v_hoje - 8 and v_hoje
          order by c.data desc
          limit 40) x), '[]'::jsonb),
      'enviados', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'dia', e.dia))
        from public.lembretes_enviados e
        where e.user_id = p.user_id and e.dia = v_hoje), '[]'::jsonb),
      'inscricoes', coalesce((
        select jsonb_agg(x.linha) from (
          select jsonb_build_object('endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth) as linha
          from public.lembretes_inscricoes i
          where i.user_id = p.user_id
          order by i.criado_em desc
          limit 10) x), '[]'::jsonb)
    )
    from public.profiles p
    where (p.prefs #> '{lembretes,treino,ligado}' = 'true'::jsonb
           or p.prefs #> '{lembretes,corrida,ligado}' = 'true'::jsonb)
      and exists (select 1 from public.lembretes_inscricoes i where i.user_id = p.user_id)
    order by p.user_id
  loop
    v_tamanho := octet_length(v_conta::text);
    -- uma conta que sozinha não cabe fica de fora (e é contada), as outras seguem
    if v_tamanho > 32768 then
      v_puladas := v_puladas + 1;
      continue;
    end if;
    -- lote cheio (50 contas ou 256 KiB): manda e começa outro
    if v_contas > 0 and (v_contas >= 50 or v_bytes + v_tamanho > 262144) then
      execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
        using v_url,
              jsonb_build_object('agora', now(), 'usuarios', v_lote),
              jsonb_build_object('Content-Type', 'application/json', 'x-lembretes-segredo', v_segredo);
      v_lote := '[]'::jsonb;
      v_contas := 0;
      v_bytes := 0;
    end if;
    v_lote := v_lote || jsonb_build_array(v_conta);
    v_contas := v_contas + 1;
    v_bytes := v_bytes + v_tamanho;
  end loop;

  if v_puladas > 0 then
    raise log 'lembretes_tick: % conta(s) acima de 32 KiB ficaram de fora', v_puladas;
  end if;
  -- ninguém (mais) a avisar: não chama a rede
  if v_contas = 0 then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
    using v_url,
          jsonb_build_object('agora', now(), 'usuarios', v_lote),
          jsonb_build_object('Content-Type', 'application/json', 'x-lembretes-segredo', v_segredo);
end $$;
revoke all on function public.lembretes_tick() from public, anon, authenticated;
