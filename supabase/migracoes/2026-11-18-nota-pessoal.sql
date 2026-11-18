-- O motor de versões antigas ainda envia notas = null quando registra a
-- progressão. O novo campo só é escrito pelo editor da nota pessoal.
do $$
begin
  lock table public.exercise_state in share row exclusive mode;
  if not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'exercise_state' and column_name = 'nota_pessoal') then
    alter table public.exercise_state add column nota_pessoal text;
    update public.exercise_state set nota_pessoal = notas where notas is not null;
  end if;
end;
$$;
