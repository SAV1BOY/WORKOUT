-- Cada conta começa sem modelos. A migração inteira é atômica.
do $migration$
begin
-- ---------- modelos pessoais de treino livre ----------
-- Cada texto precisa estar preenchido e aparado, como em String.trim() (ECMAScript).
-- Em uma lista, valores repetidos, nulos ou de outra dimensão também são inválidos.
create or replace function public.textos_do_modelo_validos(variadic valores text[]) returns boolean
  language sql immutable strict parallel safe set search_path = pg_catalog as $$
  select coalesce(array_ndims(valores), 0) <= 1 and
         cardinality(valores) = count(distinct valor) filter (
           where valor <> '' and valor = btrim(valor, U&'\0009\000A\000B\000C\000D \00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
         )
  from unnest(valores) as itens(valor);
$$;
revoke all on function public.textos_do_modelo_validos(text[]) from public, anon, authenticated;
grant execute on function public.textos_do_modelo_validos(text[]) to authenticated;

create table if not exists public.modelos_de_treino (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  nome text not null check (char_length(nome) between 1 and 80 and public.textos_do_modelo_validos(nome)),
  exercicios text[] not null check (cardinality(exercicios) > 0 and public.textos_do_modelo_validos(variadic exercicios)),
  equipamento_disponivel text[] check (public.textos_do_modelo_validos(variadic equipamento_disponivel)),
  primary key (user_id, id)
);
alter table public.modelos_de_treino enable row level security;
revoke all on public.modelos_de_treino from public, anon, authenticated;
grant select, insert, update, delete on public.modelos_de_treino to authenticated;
if not exists (
  select 1 from pg_catalog.pg_policy
  where polrelid = 'public.modelos_de_treino'::regclass and polname = 'modelos_de_treino_dono'
) then
  create policy "modelos_de_treino_dono" on public.modelos_de_treino for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
end if;
end;
$migration$;
