-- =====================================================================
--  Treino do Terraço — schema Supabase (Postgres) — v1
--  Cole inteiro no SQL Editor do Supabase e execute (Run).
--  Catálogo de exercícios e programa NÃO ficam no banco: vêm dos JSON do
--  repositório (data/*.json). O banco guarda só o que é do usuário.
--  Todas as tabelas de usuário têm user_id + RLS: cada linha pertence a quem
--  a criou. A única exceção é public.app_config (a cota de contas, SPEC §21),
--  que é uma linha só e só o dono lê e escreve.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
--  AJUSTE AQUI — o e-mail do DONO deste app (SPEC §21)
-- ---------------------------------------------------------------------
--  Desde o marco Contas qualquer pessoa pode criar conta enquanto houver
--  vaga (a cota de `public.app_config`), mas UM e-mail é diferente de todos
--  os outros: o do dono. Ele sempre pode entrar, conta como uma das vagas e
--  é o único que vê e muda a cota (Mais → Contas). O e-mail aqui tem que ser
--  o MESMO do `ALLOWED_EMAIL` do app (.env.local e Vercel) — confira antes
--  de rodar este arquivo.
--  Uma função é mais simples que uma tabela de configuração: não precisa de
--  RLS e o `revoke` abaixo tira o anon e o authenticated, então ela não
--  vaza pelo /rest/v1/rpc do PostgREST. Quem precisa saber se está falando
--  com o dono usa `public.sou_o_dono()`, que devolve só um booleano.
-- =====================================================================
create or replace function public.allowed_email() returns text
  language sql immutable parallel safe set search_path = public
  as $$ select 'miguelgsaviotti29@gmail.com'::text $$;
-- "from public" NÃO basta no Supabase: o projeto tem `alter default privileges`
-- dando EXECUTE a anon, authenticated e service_role em toda função nova, e
-- esse grant explícito sobrevive ao revoke do PUBLIC. Sem os dois papéis aqui,
-- `POST /rest/v1/rpc/allowed_email` com a chave anônima devolvia o e-mail
-- (medido em produção em 17/09/2026).
revoke all on function public.allowed_email() from public, anon, authenticated;

-- ---------- perfil ----------
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  nome           text not null default '',                 -- handle_new_user() põe a parte do e-mail antes do @
  altura_cm      numeric(5,1),
  data_inicio    date not null default current_date,
  fase_atual     text not null default 'fase1',          -- 'fase1' | 'fase2'
  fase_desde     date not null default current_date,
  objetivo       text not null default 'forca_musculo',
  semana_corrida int  not null default 1,                -- semana atual do plano de corrida (1–12)
  semana_corda   int  not null default 1,
  semana_fixa    int  not null default 1,                -- semana da progressão da barra fixa (1–12)
  ultimo_treino  text,                                   -- id do último treino de força feito ('A1','B1',...)
  prefs          jsonb not null default '{"tema":"auto","descanso_som":true,"descanso_vibra":true,"manter_tela":true}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------- ajustes por exercício (carga atual, incrementos, overrides) ----------
create table if not exists public.exercise_state (
  user_id          uuid not null references auth.users(id) on delete cascade,
  exercise_id      text not null,                        -- id de data/exercicios.json (slug)
  carga_atual_kg   numeric(6,2),                         -- carga de trabalho atual (barra total / por halter / pino)
  reps_alvo        int,                                  -- para progressão por reps (barra fixa, core)
  tempo_alvo_s     int,                                  -- para progressão por tempo (prancha)
  assistencia      text,                                 -- 'pe_inteiro' | 'joelho' | 'joelho_dobrado' | 'sem' (barra fixa assistida)
  incremento_kg    numeric(5,2),                         -- override do incremento padrão
  falhas_seguidas  int not null default 0,
  incremento_reduzido boolean not null default false,    -- após 2 falhas: incremento pela metade (mín. 2 kg) até a próxima subida
  exigir_rep_extra boolean not null default false,       -- quando o incremento reduzido cai no passo mínimo: topo da faixa + 1 rep para subir
  semana_leve      boolean not null default false,       -- próxima sessão a 60 % (3ª falha)
  carga_antes_leve numeric(6,2),                         -- para voltar depois da semana leve
  sessoes_graca    int not null default 0,               -- barra fixa assistida: sessões após mudar o degrau em que queda de reps não conta falha (o motor põe 2 ao mudar)
  desativado       boolean not null default false,
  notas            text,
  updated_at       timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

-- ---------- sessões de força ----------
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  data          date not null,
  workout_id    text not null,                           -- 'A1','B1','SA','IA','SB','IB', 'livre' ou 'fixa' (sessão de barra fixa, §3.4)
  fase          text not null,
  status        text not null default 'em_andamento',    -- 'em_andamento' | 'concluida' | 'abandonada'
  iniciada_em   timestamptz not null default now(),
  concluida_em  timestamptz,
  duracao_s     int,
  semana_plano  int,                                     -- sessão de barra fixa (§3.4): a semana do plano em que ela foi criada
  plano         jsonb,                                   -- sessão livre e ordem desta sessão (§13.4/§14.3): {titulo, colecao, itens[]}
  sensacao      int check (sensacao between 1 and 5),    -- como foi o treino (1 muito difícil … 5 muito fácil)
  peso_corporal numeric(5,2),                            -- opcional: peso do dia
  notas         text,
  created_at    timestamptz not null default now()
);
create index if not exists sessions_user_data on public.sessions(user_id, data desc);

-- ---------- séries registradas ----------
create table if not exists public.session_sets (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  exercise_id   text not null,
  ordem_ex      int not null,                            -- posição do exercício no treino
  set_index     int not null,                            -- 1..n
  tipo          text not null default 'trabalho',        -- 'aquecimento' | 'trabalho'
  reps_alvo_min int,
  reps_alvo_max int,
  reps          int,                                     -- feitas (null = não feita); em unilateral = lado direito
  reps_lado2    int,                                     -- unilateral: lado esquerdo (vale o menor dos dois)
  carga_kg      numeric(6,2),                            -- carga usada (barra total / por halter / pino)
  tempo_s       int,                                     -- para prancha etc.; em unilateral = primeiro lado
  tempo_s_lado2 int,                                     -- unilateral em tempo (prancha lateral): segundo lado
  passos        int,                                     -- farmer's walk
  assistencia   text,                                    -- barra fixa assistida
  concluida     boolean not null default false,
  ultima_firme  boolean,                                 -- "a última repetição saiu firme?" (true = pode subir)
  rpe           numeric(3,1),                            -- opcional 6–10
  registrada_em timestamptz not null default now()
);
create index if not exists session_sets_user_ex on public.session_sets(user_id, exercise_id, registrada_em desc);
create index if not exists session_sets_session on public.session_sets(session_id);

-- ---------- eventos de progressão (o que o motor decidiu) ----------
create table if not exists public.progression_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  exercise_id  text,                                    -- null = evento do programa inteiro (troca de fase, §5.1)
  session_id   uuid references public.sessions(id) on delete set null,
  data         date not null default current_date,
  de           jsonb,                                    -- {"carga_kg":7.5} | {"reps_alvo":8} | {"assistencia":"pe_inteiro"}
  para         jsonb,
  motivo       text not null,                            -- 'subiu' | 'repetiu' | 'falha_2x_voltou_10' | 'semana_leve_60' | 'fim_semana_leve' | 'trocou_assistencia' | 'manual' | 'trocou_fase' | 'retomada_leve' | 'recomeco'
  created_at   timestamptz not null default now()
);
create index if not exists progression_user_ex on public.progression_events(user_id, exercise_id, data desc);

-- ---------- cardio (corrida, corda, caminhada) ----------
create table if not exists public.cardio_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  data          date not null,
  tipo          text not null,                           -- 'corrida' | 'corda' | 'caminhada' | 'outro'
  semana_plano  int,                                     -- semana do plano (corrida 1–12 / corda 1–12)
  planejado     jsonb,                                   -- cópia dos blocos planejados
  feito         jsonb,                                   -- blocos realmente feitos (o timer registra)
  duracao_min   numeric(5,1),
  distancia_km  numeric(5,2),
  saltos        int,
  esforco       text,                                    -- 'facil' | 'moderado' | 'forte' (teste da fala)
  concluida     boolean not null default false,
  notas         text,
  created_at    timestamptz not null default now()
);
create index if not exists cardio_user_data on public.cardio_sessions(user_id, data desc);

-- ---------- barra fixa: repetições soltas (grease the groove) ----------
create table if not exists public.pullup_singles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  data        date not null default current_date,
  reps        int not null default 1,
  assistencia text,
  created_at  timestamptz not null default now()
);

-- ---------- corpo ----------
create table if not exists public.body_weights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       date not null,
  peso_kg    numeric(5,2) not null,
  notas      text,
  created_at timestamptz not null default now(),
  unique (user_id, data)
);
create table if not exists public.body_measurements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  data            date not null,
  cintura_cm      numeric(5,1),
  peito_cm        numeric(5,1),
  quadril_cm      numeric(5,1),
  braco_dir_cm    numeric(5,1),
  braco_esq_cm    numeric(5,1),
  coxa_dir_cm     numeric(5,1),
  coxa_esq_cm     numeric(5,1),
  panturrilha_cm  numeric(5,1),
  notas           text,
  created_at      timestamptz not null default now(),
  unique (user_id, data)
);
create table if not exists public.progress_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  data         date not null,
  angulo       text not null default 'frente',           -- 'frente' | 'lado' | 'costas'
  storage_path text not null,                            -- bucket 'progresso': <user_id>/<data>-<angulo>.jpg
  notas        text,
  created_at   timestamptz not null default now()
);

-- ---------- agenda: exceções ao calendário padrão ----------
create table if not exists public.schedule_overrides (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       date not null,
  tipo       text not null,                              -- 'forca' | 'cardio' | 'descanso'
  workout_id text,
  sessao     text,
  motivo     text,
  unique (user_id, data)
);

-- ---------- migrações idempotentes ----------
-- As tabelas acima são criadas com "if not exists": num banco que já tenha uma
-- versão anterior deste schema, o create não muda nada. Estes alters aplicam as
-- mudanças posteriores e podem rodar quantas vezes forem precisas.
alter table public.progression_events alter column exercise_id drop not null;
alter table public.session_sets  add column if not exists tempo_s_lado2 int;
alter table public.exercise_state add column if not exists sessoes_graca int not null default 0;
alter table public.exercise_state alter column sessoes_graca set default 0;
alter table public.exercise_state add column if not exists incremento_reduzido boolean not null default false;
alter table public.exercise_state add column if not exists exigir_rep_extra boolean not null default false;
alter table public.exercise_state add column if not exists carga_antes_leve numeric(6,2);
alter table public.sessions add column if not exists semana_plano int;
alter table public.sessions add column if not exists plano jsonb;
alter table public.profiles alter column nome set default '';

-- ---------- updated_at automático ----------
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
revoke all on function public.set_updated_at() from public, anon, authenticated;
drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists exercise_state_updated on public.exercise_state;
create trigger exercise_state_updated before update on public.exercise_state for each row execute function public.set_updated_at();

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
revoke all on function public.sou_o_dono() from public, anon;
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
revoke all on function public.contas_cadastradas() from public, anon;
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
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------- RLS: cada linha só do dono ----------
-- Toda policy deste arquivo filtra por `auth.uid()` (as de tabela por
-- `user_id`, as do storage pela primeira pasta do caminho). Nenhuma usa
-- `using (true)` para `authenticated`: com a chave anon pública, um `true`
-- aqui abriria as linhas de qualquer conta que entrasse no projeto.
do $$
declare t text;
begin
  for t in select unnest(array['profiles','exercise_state','sessions','session_sets','progression_events',
                               'cardio_sessions','pullup_singles','body_weights','body_measurements',
                               'progress_photos','schedule_overrides'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_dono" on public.%I', t, t);
    execute format('create policy "%s_dono" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- ---------- storage: fotos de progresso (bucket privado) ----------
insert into storage.buckets (id, name, public) values ('progresso', 'progresso', false) on conflict (id) do nothing;
drop policy if exists "progresso_dono_select" on storage.objects;
drop policy if exists "progresso_dono_insert" on storage.objects;
drop policy if exists "progresso_dono_delete" on storage.objects;
create policy "progresso_dono_select" on storage.objects for select to authenticated
  using (bucket_id = 'progresso' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progresso_dono_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'progresso' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progresso_dono_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progresso' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- view útil: melhor série por exercício (recorde) ----------
-- `security_invoker = true` é obrigatório: sem ele a view roda com os direitos
-- de quem a criou (o dono do banco) e passa POR CIMA da RLS de session_sets —
-- e como o PostgREST publica o schema public, qualquer um com a chave anon (que
-- é pública, vai no navegador) leria os recordes de todo mundo. Com o invoker a
-- view respeita a policy "session_sets_dono". Exige Postgres 15+ (o Supabase é).
create or replace view public.v_records with (security_invoker = true) as
select user_id, exercise_id,
       max(carga_kg) as carga_max_kg,
       max(carga_kg * (1 + coalesce(reps,0)/30.0)) as e1rm_epley,
       max(reps) as reps_max,
       max(tempo_s) as tempo_max_s
from public.session_sets
where concluida and tipo = 'trabalho'
group by user_id, exercise_id;

-- quem não entrou não lê a view (o app consulta sempre autenticado)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.v_records from anon';
  end if;
end $$;

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
