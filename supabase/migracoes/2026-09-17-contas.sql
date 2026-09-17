-- =====================================================================
--  Migração 2026-09-17 — marco Contas (SPEC §21)
-- ---------------------------------------------------------------------
--  SÓ O DELTA em relação ao schema que já está aplicado no projeto: a cota
--  de contas (`public.app_config`), as funções que a tela de login e a tela
--  Mais → Contas consultam, o trigger de vaga no lugar do trigger de e-mail
--  único e o nome do perfil vindo do e-mail.
--
--  Idempotente: pode rodar quantas vezes for preciso. Cole inteiro no SQL
--  Editor do Supabase e execute (Run). Cada comando daqui é igualzinho ao de
--  `supabase/schema.sql` — `lib/migracao-contas.test.ts` não deixa os dois
--  desencontrarem.
-- =====================================================================

-- ---------- o nome do perfil nasce do e-mail, não mais 'Miguel' ----------
alter table public.profiles alter column nome set default '';

-- ---------- cota de contas: quantas pessoas cabem neste app (SPEC §21) ----------
-- Até 16/09/2026 o app era de um usuário só: um trigger recusava qualquer
-- e-mail diferente do `allowed_email()`. Agora qualquer pessoa pode criar
-- conta ENQUANTO HOUVER VAGA, e quantas vagas existem é uma linha só de
-- `app_config` que o dono muda de dentro do app (Mais → Contas), sem deploy.
-- A RLS por `auth.uid()` continua isolando os dados de cada conta.
create table if not exists public.app_config (
  id          boolean primary key default true check (id),   -- uma linha só
  max_contas  int not null default 5 check (max_contas >= 1),
  updated_at  timestamptz not null default now()
);
insert into public.app_config (id) values (true) on conflict do nothing;
drop trigger if exists app_config_updated on public.app_config;
create trigger app_config_updated before update on public.app_config for each row execute function public.set_updated_at();

-- estou falando com o dono? Só o booleano sai daqui: o e-mail do dono nunca
-- vaza pelo PostgREST (por isso `allowed_email()` continua sem grant nenhum).
create or replace function public.sou_o_dono() returns boolean
  language sql stable security definer set search_path = public
  as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) = lower(public.allowed_email()) $$;
revoke all on function public.sou_o_dono() from public;
grant execute on function public.sou_o_dono() to authenticated;

-- a cota é do dono: ninguém mais lê nem muda `app_config`
alter table public.app_config enable row level security;
drop policy if exists "app_config_dono" on public.app_config;
create policy "app_config_dono" on public.app_config for all to authenticated
  using (public.sou_o_dono()) with check (public.sou_o_dono());

-- ---------- só entra quem cabe na cota (SPEC §21.2) ----------
-- O par do login, do lado do banco: cinto e suspensório. A chave anon é
-- pública (vai no navegador), então qualquer pessoa que a veja pode chamar o
-- /auth/v1/signup do projeto — a tela de login esconde o botão quando a cota
-- fecha, mas quem decide é este trigger. É um `before insert`, então roda
-- ANTES do `after insert` que cria o perfil (no Postgres todo BEFORE vem antes
-- de qualquer AFTER) — a exceção aborta a transação inteira e não sobra linha
-- nenhuma, nem em auth.users nem em public.profiles. A mensagem é a mesma que
-- `scripts/mock-supabase.ts` devolve nos testes de ponta a ponta; o GoTrue
-- embrulha erros de trigger como "Database error saving new user", e
-- `lib/erros-auth.ts` traduz os dois para "Cadastro fechado no momento…".
create or replace function public.exigir_vaga_para_conta() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  limite int;
  total  int;
begin
  -- o dono sempre entra: é ele quem administra a cota
  if lower(coalesce(new.email, '')) = lower(public.allowed_email()) then
    return new;
  end if;
  select max_contas into limite from public.app_config where id;
  limite := coalesce(limite, 5);
  select count(*) into total from auth.users where deleted_at is null;
  if total >= limite then
    raise exception 'Cadastro fechado: o limite de contas foi atingido.'
      using errcode = '42501';   -- insufficient_privilege
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_vaga on auth.users;
create trigger on_auth_user_vaga before insert on auth.users
  for each row execute function public.exigir_vaga_para_conta();
-- função de trigger não é para ser chamada pelo /rest/v1/rpc (advisor 0028/0029)
revoke all on function public.exigir_vaga_para_conta() from public, anon, authenticated;

-- a regra de um usuário só (SPEC §9) sai de cena: quem manda agora é a cota
drop trigger if exists on_auth_user_email_permitido on auth.users;
drop function if exists public.exigir_email_permitido();

-- ---------- o que a tela de login e a tela Contas perguntam ----------
-- Dois números e nada mais: quantas contas existem e quantas cabem. É o que a
-- tela de login consulta (sem sessão) para decidir se mostra "Criar conta".
create or replace function public.vagas_para_conta() returns jsonb
  language sql stable security definer set search_path = public
  as $$
  select jsonb_build_object(
    'contas', (select count(*) from auth.users where deleted_at is null),
    'limite', (select max_contas from public.app_config where id)
  ) $$;
revoke all on function public.vagas_para_conta() from public;
grant execute on function public.vagas_para_conta() to anon, authenticated;

-- A lista de Mais → Contas. `security definer` para ler auth.users, mas a
-- condição `public.sou_o_dono()` está DENTRO da consulta: para qualquer outra
-- conta a função devolve zero linhas — nenhum e-mail alheio sai daqui.
create or replace function public.contas_cadastradas()
  returns table (email text, criada_em timestamptz, ultimo_acesso timestamptz)
  language sql stable security definer set search_path = public
  as $$
  select u.email::text, u.created_at, u.last_sign_in_at
  from auth.users u
  where u.deleted_at is null and public.sou_o_dono()
  order by u.created_at $$;
revoke all on function public.contas_cadastradas() from public;
grant execute on function public.contas_cadastradas() to authenticated;

-- ---------- perfil criado automaticamente no primeiro login ----------
-- O nome nasce da parte do e-mail antes do @ (o app deixa editar em
-- Mais → Perfil). O perfil novo não tem `prefs.guia_visto`, então o guia de
-- uso (SPEC §20) abre sozinho na primeira entrada.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, nome)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
