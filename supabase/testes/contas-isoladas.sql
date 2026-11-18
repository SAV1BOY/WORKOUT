-- Executar com psql em um banco PostgreSQL descartável e vazio.
\set ON_ERROR_STOP on
begin;
create role authenticated;
create role anon;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
insert into auth.users values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');
grant usage on schema auth to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
\ir ../migracoes/2026-09-23-lembretes-inscricoes.sql
\ir ../migracoes/2026-11-18-trocas-do-programa.sql
create schema storage;
grant usage on schema storage to authenticated;
create table storage.objects(bucket_id text, name text, conteudo text);
grant select, update on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/');
$$;
alter table storage.objects enable row level security;
create policy foto_ler on storage.objects for select to authenticated
  using (bucket_id = 'progresso' and (storage.foldername(name))[1] = auth.uid()::text);
\ir ../migracoes/2026-11-18-fotos-substituir.sql
insert into storage.objects select 'progresso', id::text || '/frente', 'antes' from auth.users;
set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000002';
insert into public.lembretes_inscricoes(user_id,endpoint,p256dh,auth) values (auth.uid(),'aparelho-b','publica-b','b');
insert into public.trocas_do_programa values (auth.uid(), 'A1', 'supino-reto-com-barra', 'supino-inclinado-com-halteres');
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000001';
insert into public.lembretes_inscricoes(user_id,endpoint,p256dh,auth) values (auth.uid(),'aparelho-a','publica-a','a');
do $$
declare afetadas integer;
begin
  if (select count(*) from public.lembretes_inscricoes) <> 1 or
     not exists(select 1 from public.lembretes_inscricoes where endpoint='aparelho-a') then
    raise exception 'A conta deve ver somente a própria inscrição';
  end if;
  delete from public.lembretes_inscricoes where endpoint='aparelho-b';
  if found then raise exception 'Apagou uma inscrição de outra conta'; end if;
  begin
    insert into public.lembretes_inscricoes(user_id,endpoint,p256dh,auth)
      values ('00000000-0000-4000-8000-000000000002','conta-incorreta','chave','auth');
    raise exception 'Inserção com conta divergente foi aceita';
  exception when insufficient_privilege then null;
  end;
  update storage.objects set conteudo='depois';
  get diagnostics afetadas = row_count;
  if afetadas <> 1 then raise exception 'Apenas a foto da própria conta deve mudar'; end if;
end $$;
-- Mesmo original, dois treinos da conta A e um da conta B.
insert into public.trocas_do_programa values
  (auth.uid(), 'A1', 'supino-reto-com-barra', 'flexao-de-braco'),
  (auth.uid(), 'SA', 'supino-reto-com-barra', 'supino-inclinado-com-halteres');
insert into public.trocas_do_programa values (auth.uid(), 'A1', 'supino-reto-com-barra', 'flexao-de-braco')
on conflict (user_id, workout_id, exercicio_original_id) do update set substituto_id = excluded.substituto_id;
do $$ begin
  if (select count(*) from public.trocas_do_programa) <> 2 then raise exception 'A conta A deveria ver duas trocas'; end if;
  update public.trocas_do_programa set substituto_id='flexao-de-braco' where user_id <> auth.uid();
  if found then raise exception 'Uma troca alheia foi atualizada'; end if;
  delete from public.trocas_do_programa where user_id <> auth.uid();
  if found then raise exception 'Uma troca alheia foi apagada'; end if;
  begin
    insert into public.trocas_do_programa values ('00000000-0000-4000-8000-000000000002', 'SA', 'supino-reto-com-barra', 'flexao-de-braco');
    raise exception 'Uma troca foi inserida na conta B pela conta A';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.trocas_do_programa set user_id='00000000-0000-4000-8000-000000000002' where workout_id='SA';
    raise exception 'A conta A transferiu sua troca para B';
  exception when insufficient_privilege then null;
  end;
  delete from public.trocas_do_programa where workout_id='A1';
  if (select count(*) from public.trocas_do_programa where workout_id='SA') <> 1 then
    raise exception 'Apagar uma troca de A1 apagou o mesmo exercício de SA';
  end if;
end $$;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000000002';
do $$ begin
  if (select count(*) from public.trocas_do_programa) <> 1 or not exists (
    select 1 from public.trocas_do_programa where workout_id='A1' and substituto_id='supino-inclinado-com-halteres'
  ) then raise exception 'Os dados da conta B mudaram'; end if;
end $$;
reset role;
create temporary table policy_original as
  select oid from pg_catalog.pg_policy
  where polrelid='public.trocas_do_programa'::regclass and polname='trocas_do_programa_dono';
\ir ../migracoes/2026-11-18-trocas-do-programa.sql

do $$ begin
  if not exists (
    select 1 from pg_catalog.pg_policy join policy_original using (oid)
    where polrelid='public.trocas_do_programa'::regclass and polname='trocas_do_programa_dono'
  ) then raise exception 'Reaplicar a migração substituiu a policy existente'; end if;
  if (select count(*) from public.trocas_do_programa) <> 2 then
    raise exception 'Reaplicar a migração alterou os dados existentes';
  end if;
  if not exists(select 1 from storage.objects where name like '%0002/frente' and conteudo='antes') then
    raise exception 'A foto da segunda conta mudou';
  end if;
end $$;
rollback;
