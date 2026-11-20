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
-- Os grants explícitos por padrão do Supabase também precisam ser restringidos.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
insert into auth.users values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
\ir ../migracoes/2026-11-20-modelos-de-treino.sql

do $$ begin
  if exists (select 1 from public.modelos_de_treino) then raise exception 'A migração criou modelos'; end if;
  if has_table_privilege('anon', 'public.modelos_de_treino', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
    or has_table_privilege('authenticated', 'public.modelos_de_treino', 'TRUNCATE, REFERENCES, TRIGGER')
    or has_function_privilege('anon', 'public.textos_do_modelo_validos(text[])', 'EXECUTE') then
    raise exception 'Grants além dos necessários';
  end if;
end $$;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000002';
insert into public.modelos_de_treino values
  (auth.uid(), '00000000-0000-4000-8000-000000000010', 'Modelo B', array['c','b'], null);
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000001';
insert into public.modelos_de_treino values
  (auth.uid(), '00000000-0000-4000-8000-000000000010', 'Modelo A', array['a','b'], '{}');
do $$
declare
  outra uuid := '00000000-0000-4000-8000-000000000002';
  invalido text[];
  nome_invalido text;
begin
  if (select count(*) from public.modelos_de_treino) <> 1
    or not exists (select 1 from public.modelos_de_treino where nome='Modelo A' and equipamento_disponivel='{}') then
    raise exception 'Conta A deve ver somente o próprio modelo sem equipamento';
  end if;
  update public.modelos_de_treino set nome='Mudou' where user_id=outra;
  if found then raise exception 'Edição alheia aceita'; end if;
  delete from public.modelos_de_treino where user_id=outra;
  if found then raise exception 'Remoção alheia aceita'; end if;
  begin
    insert into public.modelos_de_treino values (outra, gen_random_uuid(), 'Intruso', array['a'], null);
    raise exception 'Inserção alheia aceita';
  exception when insufficient_privilege then null; end;
  begin
    update public.modelos_de_treino set user_id=outra;
    raise exception 'Transferência alheia aceita';
  exception when insufficient_privilege then null; end;
  for invalido in select * from (values
    ('{}'::text[]), (array['']), (array[E'\t']), (array[U&'\00A0']), (array['a','a']), (array['a',null]), (array[['a','b']])
  ) as casos(ids)
  loop
    begin
      update public.modelos_de_treino set exercicios=invalido;
      raise exception 'Lista inválida aceita %', invalido;
    exception when check_violation then null; end;
  end loop;
  begin
    update public.modelos_de_treino set exercicios=null;
    raise exception 'Lista nula aceita';
  exception when not_null_violation then null; end;
  begin
    update public.modelos_de_treino set equipamento_disponivel=array['x','x'];
    raise exception 'Equipamento repetido aceito';
  exception when check_violation then null; end;
  foreach nome_invalido in array array['', E' \t\n', ' Serra', 'Serra ', U&'Serra\00A0', U&'\FEFFSerra', repeat('á', 81)] loop
    begin
      update public.modelos_de_treino set nome=nome_invalido;
      raise exception 'Nome inválido aceito %', nome_invalido;
    exception when check_violation then null; end;
  end loop;
end $$;

update public.modelos_de_treino set nome='Á ' || repeat('á', 78), exercicios=array['b','a'],
  equipamento_disponivel=array['equipamento-futuro'];
reset role;
\ir ../migracoes/2026-11-20-modelos-de-treino.sql
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.modelos_de_treino where nome=('Á ' || repeat('á', 78))
    and exercicios=array['b','a'] and equipamento_disponivel=array['equipamento-futuro']) then
    raise exception 'A edição da conta A mudou ao reaplicar a migração';
  end if;
  delete from public.modelos_de_treino;
  if not found or exists (select 1 from public.modelos_de_treino) then raise exception 'Remoção incompleta'; end if;
end $$;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000002';
do $$ begin
  if (select count(*) from public.modelos_de_treino) <> 1 or not exists (
    select 1 from public.modelos_de_treino where nome='Modelo B' and exercicios=array['c','b']
      and equipamento_disponivel is null
  ) then raise exception 'A conta B perdeu seu modelo ou a seleção de todos os equipamentos'; end if;
end $$;
reset role;
delete from auth.users where id='00000000-0000-4000-8000-000000000002';
do $$ begin
  if exists (select 1 from public.modelos_de_treino) then raise exception 'Modelo da conta excluída sobrou'; end if;
end $$;
rollback;
