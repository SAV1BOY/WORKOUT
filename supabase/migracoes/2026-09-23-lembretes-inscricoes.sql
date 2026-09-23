-- =====================================================================
--  Migração 2026-09-23 — lembretes I: inscrições de push (SPEC §23.2)
-- ---------------------------------------------------------------------
--  SÓ O DELTA em relação ao schema que já está aplicado no projeto: a tabela
--  `public.lembretes_inscricoes`, o índice por usuário e a RLS dela.
--
--  Idempotente e expand-only: pode rodar quantas vezes for preciso, e não
--  apaga nem renomeia nada. Cada comando daqui é igualzinho ao de
--  `supabase/schema.sql` — `lib/migracao-lembretes.test.ts` não deixa os dois
--  desencontrarem. Quem aplica é o orquestrador, antes do deploy.
-- =====================================================================

-- ---------- lembretes: inscrições de push por aparelho (SPEC §23.2) ----------
-- Uma linha por aparelho que ativou os lembretes em Mais → Lembretes. O
-- `endpoint` é o endereço do serviço de push daquele navegador (único na
-- tabela: um aparelho, uma conta), e `p256dh`/`auth` são as chaves com que o
-- servidor cifra o aviso. `ultimo_envio_em` e `falhas` são do lote 35 (o
-- disparo no horário) e ficam nulo/zero até lá.
-- Expand-only: só cria (tabela, índice, policies); nada é renomeado ou apagado.
create table if not exists public.lembretes_inscricoes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  endpoint         text not null unique,
  p256dh           text not null,
  auth             text not null,
  aparelho         text not null default '',
  criado_em        timestamptz not null default now(),
  ultimo_envio_em  timestamptz,
  falhas           int not null default 0
);
create index if not exists lembretes_inscricoes_user_idx on public.lembretes_inscricoes (user_id);

-- RLS: o dono da linha lê, insere e apaga as suas; ninguém vê as de outro.
-- Sem policy de update (nada aqui altera linha) e sem nada para o anon.
alter table public.lembretes_inscricoes enable row level security;
drop policy if exists "lembretes_inscricoes_select" on public.lembretes_inscricoes;
drop policy if exists "lembretes_inscricoes_insert" on public.lembretes_inscricoes;
drop policy if exists "lembretes_inscricoes_delete" on public.lembretes_inscricoes;
create policy "lembretes_inscricoes_select" on public.lembretes_inscricoes for select to authenticated
  using (user_id = auth.uid());
create policy "lembretes_inscricoes_insert" on public.lembretes_inscricoes for insert to authenticated
  with check (user_id = auth.uid());
create policy "lembretes_inscricoes_delete" on public.lembretes_inscricoes for delete to authenticated
  using (user_id = auth.uid());
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.lembretes_inscricoes from anon';
  end if;
end $$;
