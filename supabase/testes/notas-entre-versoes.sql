-- Em um PostgreSQL vazio, reproduz o formato da tabela anterior à migração.
\set ON_ERROR_STOP on
begin;
create table public.exercise_state (
  user_id uuid not null, exercise_id text not null, carga_atual_kg numeric,
  notas text, primary key(user_id, exercise_id)
);
insert into public.exercise_state values
  ('00000000-0000-4000-8000-000000000001', 'supino', 20, 'Nota antiga de Ana'),
  ('00000000-0000-4000-8000-000000000002', 'supino', 10, 'Outra conta');
\ir ../migracoes/2026-11-18-nota-pessoal.sql

do $$
begin
  if (select nota_pessoal from public.exercise_state where carga_atual_kg = 20) is distinct from 'Nota antiga de Ana' then
    raise exception 'A migração não preservou a nota anterior';
  end if;
end; $$;
-- A primeira edição estabelece a nova nota. Uma sessão em outro aparelho,
-- ainda na versão anterior, em seguida reenvia a carga e notas = null.
insert into public.exercise_state(user_id, exercise_id, nota_pessoal)
values ('00000000-0000-4000-8000-000000000001', 'supino', 'Banco no terceiro furo')
on conflict(user_id, exercise_id) do update set nota_pessoal=excluded.nota_pessoal;
insert into public.exercise_state(user_id, exercise_id, carga_atual_kg, notas)
values ('00000000-0000-4000-8000-000000000001', 'supino', 24, null)
on conflict(user_id, exercise_id) do update set carga_atual_kg=excluded.carga_atual_kg, notas=excluded.notas;
do $$
begin
  if (select nota_pessoal from public.exercise_state where carga_atual_kg=24) is distinct from 'Banco no terceiro furo' then
    raise exception 'O cliente antigo apagou a nota nova';
  end if;
  if (select nota_pessoal from public.exercise_state where carga_atual_kg=10) is distinct from 'Outra conta' then
    raise exception 'A nota do mesmo exercício em outra conta foi alterada';
  end if;
end; $$;
-- O legado da segunda conta ainda tem texto. Uma migração reaplicada depois
-- de a pessoa remover sua nota nova não pode ressuscitá-lo.
update public.exercise_state set nota_pessoal=null where carga_atual_kg=10;
\ir ../migracoes/2026-11-18-nota-pessoal.sql

do $$
begin
  if (select nota_pessoal from public.exercise_state where carga_atual_kg=10) is not null then
    raise exception 'A segunda migração ressuscitou a nota removida';
  end if;
end; $$;
rollback;
