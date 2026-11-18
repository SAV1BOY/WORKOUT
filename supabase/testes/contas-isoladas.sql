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
reset role;
do $$ begin
  if not exists(select 1 from storage.objects where name like '%0002/frente' and conteudo='antes') then
    raise exception 'A foto da segunda conta mudou';
  end if;
end $$;
rollback;
