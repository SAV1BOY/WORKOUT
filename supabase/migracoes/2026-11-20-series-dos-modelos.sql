-- Séries de trabalho por exercício nos modelos pessoais.
do $migration$
begin
alter table public.modelos_de_treino add column if not exists series_por_exercicio jsonb;

-- SQL NULL e {} usam o catálogo. Um movimento de catálogo futuro também é válido
-- quando consta na seleção. A comparação em jsonb aceita 2 e 2.0, mas recusa "2".
create or replace function public.validar_series_do_modelo() returns trigger
  language plpgsql set search_path = pg_catalog as $$
begin
  if jsonb_typeof(new.series_por_exercicio) = 'object' then
    if not exists (
      select from jsonb_each(new.series_por_exercicio) as par(id, quantidade)
      where not (par.id = any(new.exercicios))
        or par.quantidade not in (select to_jsonb(n) from generate_series(1, 10) as limite(n))
    ) then
      return new;
    end if;
  end if;
  raise check_violation using message = 'Confira os exercícios e as séries de trabalho do modelo (1 a 10).';
end;
$$;

-- O upsert antigo só envia os exercícios. Retirar o movimento desfaz também a
-- escolha de séries, mesmo que ele seja incluído de novo em outra gravação.
create or replace function public.podar_series_do_modelo() returns trigger
  language plpgsql set search_path = pg_catalog as $$
begin
  new.series_por_exercicio := new.series_por_exercicio - array(
    select unnest(old.exercicios) except select unnest(new.exercicios)
  );
  return new;
end;
$$;
revoke all on function public.validar_series_do_modelo(), public.podar_series_do_modelo()
  from public, anon, authenticated;

-- Na mesma atualização os gatilhos são executados em ordem alfabética:
-- um mapa enviado explicitamente precisa ser válido antes de podar os IDs.
create or replace trigger conferir_series_do_modelo
  before insert or update of series_por_exercicio on public.modelos_de_treino
  for each row when (new.series_por_exercicio is not null) execute function public.validar_series_do_modelo();
create or replace trigger podar_series_do_modelo
  before update of exercicios on public.modelos_de_treino
  for each row when (new.series_por_exercicio is not null and old.exercicios is distinct from new.exercicios)
  execute function public.podar_series_do_modelo();
end;
$migration$;
