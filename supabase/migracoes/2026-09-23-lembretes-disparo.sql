-- =====================================================================
--  Migração 2026-09-23 — lembretes II: o disparo no horário (SPEC §23.11)
-- ---------------------------------------------------------------------
--  SÓ O DELTA em relação ao schema aplicado (que já tem
--  `lembretes_inscricoes`, da migração 2026-09-23-lembretes-inscricoes):
--  as extensões pg_cron e pg_net, a tabela `public.lembretes_enviados` com a
--  RLS de leitura do dono, as funções `lembretes_tick()` e
--  `lembretes_resultado()` e o job "lembretes" a cada 5 minutos.
--
--  Idempotente e expand-only: pode rodar quantas vezes for preciso, e não
--  apaga nem renomeia nada. Cada comando daqui é igualzinho ao de
--  `supabase/schema.sql` — `lib/migracao-lembretes-disparo.test.ts` não deixa
--  os dois desencontrarem. Nenhum segredo aqui: `lembretes_url` e
--  `lembretes_segredo` vão para o Vault e `LEMBRETES_SEGREDO` para a Vercel,
--  pelas mãos de quem publica. Quem aplica é o orquestrador, antes do deploy.
-- =====================================================================

-- ---------- lembretes II: o disparo no horário (SPEC §23.11) ----------
-- A cada 5 minutos o pg_cron chama `lembretes_tick()`, que manda para a rota
-- `POST /api/lembretes/disparar` (pg_net) o mínimo que a regra de §23.10
-- precisa de quem tem um lembrete ligado e um aparelho inscrito. A rota decide,
-- envia o push e devolve o resultado por `lembretes_resultado()`.
-- A URL e o segredo moram no Vault (`lembretes_url`, `lembretes_segredo`):
-- nenhum valor aqui. Sem eles (ou sem o pg_net), o tick não faz nada.
-- Expand-only: só cria (extensões, tabela, policy, funções, job).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Um lembrete que saiu: no máximo um por conta, tipo e dia.
create table if not exists public.lembretes_enviados (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('treino', 'corrida')),
  dia         date not null,
  enviado_em  timestamptz not null default now(),
  unique (user_id, tipo, dia)
);

-- RLS: o dono só LÊ os seus (o "Último lembrete" da tela). Quem grava é
-- `lembretes_resultado()`; ninguém insere, altera ou apaga pela API.
alter table public.lembretes_enviados enable row level security;
drop policy if exists "lembretes_enviados_select" on public.lembretes_enviados;
create policy "lembretes_enviados_select" on public.lembretes_enviados for select to authenticated
  using (user_id = auth.uid());
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.lembretes_enviados from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke insert, update, delete, truncate on public.lembretes_enviados from authenticated';
  end if;
end $$;

-- O tick: só o postgres (o dono do job) executa. Lê o Vault e as tabelas das
-- contas com lembrete ligado e inscrição, e faz um POST só com todas elas.
create or replace function public.lembretes_tick() returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_url      text;
  v_segredo  text;
  v_hoje     date := (now() at time zone 'America/Sao_Paulo')::date;
  v_usuarios jsonb;
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

  select coalesce(jsonb_agg(u.conta), '[]'::jsonb) into v_usuarios
  from (
    select jsonb_build_object(
      'user_id', p.user_id,
      'perfil', jsonb_build_object(
        'data_inicio', p.data_inicio, 'fase_atual', p.fase_atual, 'fase_desde', p.fase_desde,
        'ultimo_treino', p.ultimo_treino, 'semana_corrida', p.semana_corrida,
        'semana_corda', p.semana_corda, 'semana_fixa', p.semana_fixa, 'prefs', p.prefs),
      'overrides', coalesce((
        select jsonb_agg(jsonb_build_object('data', o.data, 'tipo', o.tipo,
                                            'workout_id', o.workout_id, 'sessao', o.sessao))
        from public.schedule_overrides o
        where o.user_id = p.user_id and o.data between v_hoje - 8 and v_hoje + 7), '[]'::jsonb),
      'sessoes', coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'data', s.data, 'status', s.status,
                                            'workout_id', s.workout_id))
        from public.sessions s
        where s.user_id = p.user_id and s.data between v_hoje - 8 and v_hoje), '[]'::jsonb),
      'cardios', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'data', c.data, 'tipo', c.tipo,
                                            'concluida', c.concluida))
        from public.cardio_sessions c
        where c.user_id = p.user_id and c.data between v_hoje - 8 and v_hoje), '[]'::jsonb),
      'enviados', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', e.tipo, 'dia', e.dia))
        from public.lembretes_enviados e
        where e.user_id = p.user_id and e.dia = v_hoje), '[]'::jsonb),
      'inscricoes', (
        select jsonb_agg(jsonb_build_object('endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth))
        from public.lembretes_inscricoes i
        where i.user_id = p.user_id)
    ) as conta
    from public.profiles p
    where (p.prefs #> '{lembretes,treino,ligado}' = 'true'::jsonb
           or p.prefs #> '{lembretes,corrida,ligado}' = 'true'::jsonb)
      and exists (select 1 from public.lembretes_inscricoes i where i.user_id = p.user_id)
  ) u;

  -- ninguém a avisar: não chama a rede
  if jsonb_array_length(v_usuarios) = 0 then
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
    using v_url,
          jsonb_build_object('agora', now(), 'usuarios', v_usuarios),
          jsonb_build_object('Content-Type', 'application/json', 'x-lembretes-segredo', v_segredo);
end $$;
revoke all on function public.lembretes_tick() from public, anon, authenticated;

-- O resultado: a rota chama com a chave anon, então o segredo é a proteção.
-- Compara os sha256 dos dois (32 bytes cada): nada de atalho no primeiro byte
-- diferente que deixe adivinhar o segredo aos pedaços.
create or replace function public.lembretes_resultado(segredo text, enviados jsonb, expirados text[])
  returns int
  language plpgsql security definer set search_path = public as $$
declare
  v_segredo  text;
  v_gravados int := 0;
begin
  if to_regclass('vault.decrypted_secrets') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
      into v_segredo using 'lembretes_segredo';
  end if;
  if coalesce(v_segredo, '') = '' or segredo is null
     or sha256(convert_to(segredo, 'UTF8')) <> sha256(convert_to(v_segredo, 'UTF8')) then
    raise exception 'segredo dos lembretes inválido' using errcode = '28000';
  end if;
  insert into public.lembretes_enviados (user_id, tipo, dia)
  select (e ->> 'user_id')::uuid, e ->> 'tipo', (e ->> 'dia')::date
  from jsonb_array_elements(coalesce(enviados, '[]'::jsonb)) e
  where e ->> 'tipo' in ('treino', 'corrida')
  on conflict (user_id, tipo, dia) do nothing;
  get diagnostics v_gravados = row_count;
  -- 404/410 do serviço de push: a inscrição não existe mais (RFC 8030 §7.3)
  delete from public.lembretes_inscricoes where endpoint = any(coalesce(expirados, '{}'::text[]));
  return v_gravados;
end $$;
revoke all on function public.lembretes_resultado(text, jsonb, text[]) from public;
grant execute on function public.lembretes_resultado(text, jsonb, text[]) to anon, authenticated;

-- O job: desagendado pelo nome se já existe e agendado de novo (um job só).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'lembretes';
    perform cron.schedule('lembretes', '*/5 * * * *', 'select public.lembretes_tick()');
  end if;
end $$;
