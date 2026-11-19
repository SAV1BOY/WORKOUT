-- A coluna notas já reúne as observações dos exercícios nas versões anteriores.
alter table public.sessions add column if not exists nota_geral text;
