-- Uma alternativa por posição do programa, sem modificar as sessões já criadas.
do $migration$
begin
create table if not exists public.trocas_do_programa (
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text not null check (workout_id in ('A1', 'B1', 'SA', 'IA', 'SB', 'IB')),
  exercicio_original_id text not null check (btrim(exercicio_original_id) <> ''),
  substituto_id text not null check (btrim(substituto_id) <> '' and substituto_id <> exercicio_original_id),
  primary key (user_id, workout_id, exercicio_original_id)
);
alter table public.trocas_do_programa enable row level security;
if not exists (
  select 1 from pg_catalog.pg_policy
  where polrelid = 'public.trocas_do_programa'::regclass and polname = 'trocas_do_programa_dono'
) then
  create policy "trocas_do_programa_dono" on public.trocas_do_programa for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
end if;
revoke all on public.trocas_do_programa from public, anon, authenticated;
grant select, insert, update, delete on public.trocas_do_programa to authenticated;
end;
$migration$;
