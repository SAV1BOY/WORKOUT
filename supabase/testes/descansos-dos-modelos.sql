-- Executar com psql em um PostgreSQL descartável e vazio.
\set ON_ERROR_STOP on
begin;
create role anon;
create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select current_setting('request.jwt.claim.sub')::uuid;
$$;
grant usage on schema auth to authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
insert into auth.users values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
\ir ../migracoes/2026-11-20-modelos-de-treino.sql
\ir ../migracoes/2026-11-20-series-dos-modelos.sql
insert into public.modelos_de_treino (user_id,id,nome,exercicios,equipamento_disponivel,series_por_exercicio)
select id, '00000000-0000-4000-8000-000000000010', 'Modelo', array['a','b','futuro'], array['tatame'], '{"a":4,"futuro":8}'
from auth.users;
\ir ../migracoes/2026-11-20-descansos-dos-modelos.sql

do $$ begin
  if (select count(*) from public.modelos_de_treino where descansos_por_exercicio is null
    and series_por_exercicio='{"a":4,"futuro":8}') <> 2 then raise exception 'Modelos antigos alterados'; end if;
  if has_function_privilege('anon','public.validar_descansos_do_modelo()','execute')
    or has_function_privilege('authenticated','public.podar_descansos_do_modelo()','execute') then
    raise exception 'Execução das funções de gatilho exposta';
  end if;
end $$;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000001';
update public.modelos_de_treino set descansos_por_exercicio='{"a":5,"futuro":900.0}';
-- #62 omite os dois mapas. #63 pode mudar as séries enquanto renomeia o modelo.
update public.modelos_de_treino set exercicios=array['futuro','b','a'];
insert into public.modelos_de_treino (user_id,id,nome,exercicios,series_por_exercicio)
values (auth.uid(),'00000000-0000-4000-8000-000000000010','Editado',array['futuro','b','a'],'{"a":3,"futuro":7}')
on conflict (user_id,id) do update set nome=excluded.nome, exercicios=excluded.exercicios,
  series_por_exercicio=excluded.series_por_exercicio;
do $$
declare invalido jsonb;
begin
  if not exists (select 1 from public.modelos_de_treino where nome='Editado'
    and series_por_exercicio='{"a":3,"futuro":7}' and descansos_por_exercicio='{"a":5,"futuro":900}') then
    raise exception 'Atualização legada perdeu os valores';
  end if;
  foreach invalido in array array[
    '[]'::jsonb, 'null', '15', '"15"', '{"a":null}', '{"a":true}', '{"a":"15"}', '{"a":{}}', '{"a":[30]}',
    '{"a":4}', '{"a":5.5}', '{"a":899.01}', '{"a":901}', '{"fora":30}'
  ] loop
    begin
      update public.modelos_de_treino set descansos_por_exercicio=invalido;
      raise exception 'Descanso inválido aceito: %', invalido;
    exception when check_violation then null; end;
  end loop;
  begin
    update public.modelos_de_treino set exercicios=array['a'], descansos_por_exercicio='{"a":5,"futuro":900}';
    raise exception 'A edição explícita precisa validar todos os IDs';
  exception when check_violation then null; end;
end $$;
update public.modelos_de_treino set exercicios=array['b','futuro'];
update public.modelos_de_treino set exercicios=array['a','b','futuro'];
reset role;
\ir ../migracoes/2026-11-20-descansos-dos-modelos.sql
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.modelos_de_treino where nome='Editado'
    and equipamento_disponivel=array['tatame'] and series_por_exercicio='{"futuro":7}'
    and descansos_por_exercicio='{"futuro":900}') then
    raise exception 'Os ajustes precisam acompanhar apenas os movimentos retidos';
  end if;
  update public.modelos_de_treino set descansos_por_exercicio='{}';
  if not exists (select 1 from public.modelos_de_treino where descansos_por_exercicio='{}') then
    raise exception 'Mapa vazio recusado';
  end if;
  update public.modelos_de_treino set descansos_por_exercicio=null;
  if not exists (select 1 from public.modelos_de_treino where descansos_por_exercicio is null
    and series_por_exercicio='{"futuro":7}') then raise exception 'Limpar descanso alterou séries'; end if;
end $$;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000002';
do $$ begin
  if (select count(*) from public.modelos_de_treino) <> 1 or not exists (
    select 1 from public.modelos_de_treino where nome='Modelo' and exercicios=array['a','b','futuro']
      and equipamento_disponivel=array['tatame'] and series_por_exercicio='{"a":4,"futuro":8}'
      and descansos_por_exercicio is null
  ) then raise exception 'Modelo da outra conta alterado'; end if;
end $$;
rollback;
