-- Executar com psql em um PostgreSQL descartável e vazio.
\set ON_ERROR_STOP on
begin;
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select current_setting('request.jwt.claim.sub')::uuid
$$;
grant usage on schema auth to authenticated;
create table public.sessions (
  id uuid primary key, user_id uuid not null, workout_id text not null,
  status text not null default 'em_andamento', plano jsonb
);
create table public.session_sets (session_id uuid references public.sessions, user_id uuid not null, ordem_ex integer not null);
alter table public.sessions enable row level security;
alter table public.session_sets enable row level security;
create policy sessions_dono on public.sessions to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy session_sets_dono on public.session_sets to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.sessions, public.session_sets to authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;

insert into public.sessions(id, user_id, workout_id, plano) values
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'livre',
   '{"itens":[{"exercicio_id":"flexao-de-braco"},{"exercicio_id":"agachamento-com-peso-corporal"}],"campo_futuro":{"preservar":true}}'),
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'A1', null);
\ir ../migracoes/2026-11-20-material-da-sessao.sql
\ir ../migracoes/2026-11-20-material-da-sessao.sql

create function pg_temp.conferir(condicao boolean, descricao text) returns void language plpgsql as $$
begin
  if condicao is not true then raise exception 'Falhou: %', descricao; end if;
end $$;
select pg_temp.conferir(not has_function_privilege('anon','public.alterar_material_da_sessao(uuid,uuid,uuid,jsonb,jsonb,jsonb)','execute')
  and has_function_privilege('authenticated','public.alterar_material_da_sessao(uuid,uuid,uuid,jsonb,jsonb,jsonb)','execute'),
  'Somente a conta autenticada pode invocar a função pública');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';

do $$
declare
  sessao uuid := '00000000-0000-4000-8000-000000000010';
  programa uuid := '00000000-0000-4000-8000-000000000011';
  primeira uuid := gen_random_uuid(); segunda uuid := gen_random_uuid();
  inicial jsonb; ponte jsonb := '{"exercicio_id":"ponte-de-gluteos-no-tatame"}';
  marca jsonb; plano_ponte jsonb; resposta jsonb; revisao uuid;
begin
  select plano into inicial from public.sessions where id = sessao;
  resposta := public.alterar_material_da_sessao(sessao, primeira, null, null, '[]');
  perform pg_temp.conferir(resposta->'plano' = inicial || '{"equipamento_disponivel":[]}'::jsonb
    and resposta->>'revisao_equipamento' = primeira::text, 'Só o corpo conserva os itens e o campo futuro');
  resposta := public.alterar_material_da_sessao(sessao, segunda, primeira, '[]', null);
  perform pg_temp.conferir(resposta->'plano' = inicial and resposta->>'revisao_equipamento' = segunda::text,
    'Restaurar o padrão remove a chave');
  perform pg_temp.conferir(public.alterar_material_da_sessao(sessao, primeira, null, null, '[]') = resposta,
    'Reenvio do primeiro comando após voltar ao padrão não reaplica a escolha');
  begin
    perform public.alterar_material_da_sessao(sessao,gen_random_uuid(),null,null,'["tatame"]');
    raise exception 'A base antiga foi aceita depois de o material voltar ao mesmo valor';
  exception when sqlstate 'PT409' then
    perform pg_temp.conferir(sqlerrm = 'MATERIAL_DA_SESSAO_ALTERADO','Conflito identificado pelo código estável');
  end;
  begin
    perform public.alterar_material_da_sessao(sessao,gen_random_uuid(),segunda,null,'["tatame","tatame"]');
    raise exception 'A seleção com itens duplicados foi aceita';
  exception when invalid_parameter_value then null;
  end;
  update public.sessions set plano = inicial || '{"equipamento_disponivel":["tatame"]}' where id = sessao
    returning revisao_equipamento into revisao;
  perform pg_temp.conferir(revisao is not null and revisao <> segunda,'Escrita legada de material muda a revisão');

  marca := jsonb_build_object('id',gen_random_uuid(),'sessao_id',sessao,'ordem',3,
                              'exercicio_id',ponte->>'exercicio_id','estado','disponivel','series_iniciais','dados locais');
  plano_ponte := inicial || jsonb_build_object('itens',(inicial->'itens') || jsonb_build_array(ponte),'ultima_inclusao',marca);
  update public.sessions set plano = plano_ponte where id = sessao;
  perform pg_temp.conferir((select plano->'equipamento_disponivel' = '["tatame"]' and revisao_equipamento = revisao
    from public.sessions where id = sessao), 'A inclusão de outro aparelho mantém o novo material');
  begin
    update public.sessions set plano = inicial where id = sessao;
    raise exception 'Um PATCH antigo retirou a inclusão sem o seu identificador';
  exception when sqlstate 'PT409' then
    perform pg_temp.conferir(sqlerrm = 'PLANO_DA_SESSAO_DIVERGIU','Redução ambígua tem erro estável');
  end;
  -- Desfazer é válido apenas para a mesma inclusão, antes de qualquer registro.
  update public.sessions set plano = inicial || jsonb_build_object('ultima_inclusao',marca || '{"estado":"desfeita"}'::jsonb)
    where id = sessao;
  begin
    update public.sessions set plano = plano_ponte where id = sessao;
    raise exception 'A inclusão retirada ressuscitou';
  exception when sqlstate 'PT409' then null;
  end;
  marca := jsonb_set(marca, '{id}', to_jsonb(gen_random_uuid()));
  plano_ponte := jsonb_set(plano_ponte,'{ultima_inclusao}',marca);
  update public.sessions set plano = plano_ponte where id = sessao;
  insert into public.session_sets values (sessao, auth.uid(), 3);
  begin
    update public.sessions set plano = inicial || jsonb_build_object('ultima_inclusao',marca || '{"estado":"desfeita"}'::jsonb)
      where id = sessao;
    raise exception 'Desfez a inclusão com uma série registrada';
  exception when sqlstate 'PT409' then null;
  end;
  update public.sessions set plano = jsonb_set(plano_ponte,'{ultima_inclusao,estado}','"iniciada"') where id = sessao;
  perform pg_temp.conferir((select plano->'equipamento_disponivel' = '["tatame"]' and plano->'ultima_inclusao'->>'estado'='iniciada'
    from public.sessions where id=sessao), 'Primeiro uso pelo outro aparelho também mantém o material');
  update public.sessions set plano = plano_ponte where id = sessao;
  perform pg_temp.conferir((select plano->'ultima_inclusao'->>'estado' = 'iniciada'
    and plano->'equipamento_disponivel' = '["tatame"]' and revisao_equipamento = revisao
    from public.sessions where id=sessao), 'Reenvio da inclusão disponível não altera seu início ou o kit');

  -- O cliente que ajustou o descanso viu o material anterior. Ele usa o mesmo PATCH nas duas versões.
  plano_ponte := jsonb_set(plano_ponte, '{ultima_inclusao,estado}', '"iniciada"');
  update public.sessions set plano = plano_ponte || '{"descansos_por_exercicio":{"ponte-de-gluteos-no-tatame":75}}'
    where id = sessao;
  perform pg_temp.conferir((select plano->'equipamento_disponivel'='["tatame"]'
     and plano->'descansos_por_exercicio'->>'ponte-de-gluteos-no-tatame'='75' and revisao_equipamento=revisao
     from public.sessions where id=sessao), 'Guardar o descanso conserva o material confirmado');
  begin
    update public.sessions set plano = plano_ponte || '{"descansos_por_exercicio":{"ponte-de-gluteos-no-tatame":75}}'
      where id = sessao;
    raise exception 'O reenvio de um descanso conciliado reintroduziu o equipamento antigo';
  exception when sqlstate 'PT409' then
    perform pg_temp.conferir(sqlerrm='PLANO_DA_SESSAO_DIVERGIU','Um replay ambíguo permite escolher o equipamento');
  end;
  resposta := public.alterar_material_da_sessao(sessao, gen_random_uuid(), revisao, '["tatame"]', '[]');
  update public.sessions set plano = plano_ponte || '{"equipamento_disponivel":["tatame"]}' where id = sessao;
  perform pg_temp.conferir((select plano->'equipamento_disponivel'='[]' and not (plano ? 'descansos_por_exercicio')
     and revisao_equipamento::text=resposta->>'revisao_equipamento' from public.sessions where id=sessao),
     'Restaurar o descanso também conserva o equipamento do outro aparelho');
  -- O fechamento/backup do cliente anterior é upsert por UUID através de POST da tabela.
  perform set_config('request.method','POST',true);
  update public.sessions set plano = inicial, status='concluida' where id = sessao;
  resposta := public.alterar_material_da_sessao(sessao,gen_random_uuid(),null,null,'["tatame"]');
  perform pg_temp.conferir(resposta->>'status'='concluida' and resposta->'plano'=inicial,'Sessão encerrada volta sem edição');
  perform set_config('request.method','PATCH',true);
  begin
    update public.sessions set plano = inicial || '{"equipamento_disponivel":["tatame"]}' where id = sessao;
    raise exception 'Um PATCH alterou o material de uma sessão encerrada';
  exception when sqlstate 'PT409' then null;
  end;
  resposta := public.alterar_material_da_sessao(programa,gen_random_uuid(),null,null,'[]',inicial);
  perform pg_temp.conferir(resposta->'plano'->'itens'=inicial->'itens' and resposta->'plano'->'equipamento_disponivel'='[]'
    and not ((resposta->'plano') ? 'campo_futuro'), 'Prescrição inicial para o plano nulo do programa');
end $$;

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
select pg_temp.conferir(public.alterar_material_da_sessao('00000000-0000-4000-8000-000000000010',
  gen_random_uuid(),null,null,'[]') is null, 'Outra conta não acessa a sessão');
select pg_temp.conferir((select count(*) from treino_interno.recibos_material) = 0, 'Outra conta não vê os recibos');
rollback;
