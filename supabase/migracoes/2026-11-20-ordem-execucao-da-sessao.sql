-- Sessões anteriores continuam com a ordem do plano.
alter table public.sessions add column if not exists ordem_execucao text[];
