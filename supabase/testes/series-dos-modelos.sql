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
insert into public.modelos_de_treino (user_id,id,nome,exercicios,equipamento_disponivel)
select id, '00000000-0000-4000-8000-000000000010', 'Modelo', array['a','b','futuro'], array['tatame']
from auth.users;
\ir ../migracoes/2026-11-20-series-dos-modelos.sql

do $$ begin
  if (select count(*) from public.modelos_de_treino where series_por_exercicio is null) <> 2 then
    raise exception 'Modelos anteriores perderam o padrão do catálogo';
  end if;
  if has_function_privilege('anon','public.validar_series_do_modelo()','execute')
    or has_function_privilege('authenticated','public.podar_series_do_modelo()','execute') then
    raise exception 'Execução das funções de gatilho exposta';
  end if;
end $$;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000001';
update public.modelos_de_treino set series_por_exercicio='{"a":1,"futuro":10.0}';
update public.modelos_de_treino set nome='Reordenado', exercicios=array['b','futuro','a'];
do $$
declare invalido jsonb;
begin
  if (select count(*) from public.modelos_de_treino) <> 1 or not exists (
    select 1 from public.modelos_de_treino where series_por_exercicio='{"a":1,"futuro":10}'
  ) then raise exception 'Renomear ou reordenar deve conservar as séries por ID'; end if;
  foreach invalido in array array[
    '[]'::jsonb, 'null', '"texto"', '4', '{"a":null}', '{"a":true}', '{"a":"2"}', '{"a":{}}',
    '{"a":[2]}', '{"a":1.5}', '{"a":0}', '{"a":11}', '{"fora":2}'
  ] loop
    begin
      update public.modelos_de_treino set series_por_exercicio=invalido;
      raise exception 'Mapa inválido aceito: %', invalido;
    exception when check_violation then null; end;
  end loop;
  -- Mesmo um mapa igual ao anterior foi enviado explicitamente e deve ser conferido.
  begin
    update public.modelos_de_treino set exercicios=array['a'], series_por_exercicio='{"a":1,"futuro":10}';
    raise exception 'Edição explícita deixou passar ID fora da seleção';
  exception when check_violation then null; end;
end $$;
insert into public.modelos_de_treino (user_id,id,nome,exercicios,equipamento_disponivel)
values (auth.uid(),'00000000-0000-4000-8000-000000000010','Uma segunda',array['b','futuro'],array['tatame'])
on conflict (user_id,id) do update set nome=excluded.nome,exercicios=excluded.exercicios;
update public.modelos_de_treino set exercicios=array['a','b','futuro'];
reset role;
\ir ../migracoes/2026-11-20-series-dos-modelos.sql
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.modelos_de_treino where nome='Uma segunda'
    and equipamento_disponivel=array['tatame'] and series_por_exercicio='{"futuro":10}') then
    raise exception 'O ajuste removido voltou ou o movimento mantido perdeu seu ajuste';
  end if;
  update public.modelos_de_treino set series_por_exercicio='{}';
  if not exists (select 1 from public.modelos_de_treino where series_por_exercicio='{}') then
    raise exception 'Mapa vazio recusado';
  end if;
  update public.modelos_de_treino set series_por_exercicio=null;
  if not exists (select 1 from public.modelos_de_treino where series_por_exercicio is null) then
    raise exception 'Não voltou ao padrão do catálogo';
  end if;
end $$;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000002';
do $$ begin
  if (select count(*) from public.modelos_de_treino) <> 1 or not exists (
    select 1 from public.modelos_de_treino where nome='Modelo' and exercicios=array['a','b','futuro']
      and equipamento_disponivel=array['tatame'] and series_por_exercicio is null
  ) then raise exception 'Modelo da outra conta alterado'; end if;
end $$;
rollback;
