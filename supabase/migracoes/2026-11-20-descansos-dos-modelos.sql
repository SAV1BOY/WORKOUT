-- Descanso entre séries de trabalho de cada exercício, em segundos.
do $migration$
begin
alter table public.modelos_de_treino add column if not exists descansos_por_exercicio jsonb;

-- SQL NULL e {} deixam o descanso a cargo do padrão da conta ou do exercício.
create or replace function public.validar_descansos_do_modelo() returns trigger
  language plpgsql set search_path = pg_catalog as $$
begin
  if jsonb_typeof(new.descansos_por_exercicio) = 'object' then
    if not exists (
      select from jsonb_each(new.descansos_por_exercicio) as par(id, segundos)
      where not (par.id = any(new.exercicios))
        or case when jsonb_typeof(par.segundos) = 'number' then
             par.segundos::numeric not between 5 and 900 or mod(par.segundos::numeric, 1) <> 0
           else true end
    ) then
      return new;
    end if;
  end if;
  raise check_violation using message = 'Confira os exercícios e o descanso do modelo em segundos inteiros (5 a 900).';
end;
$$;

-- Clientes anteriores enviam apenas as colunas que conhecem. A remoção de um
-- movimento apaga seu ajuste para que a reinclusão use de novo o padrão.
create or replace function public.podar_descansos_do_modelo() returns trigger
  language plpgsql set search_path = pg_catalog as $$
begin
  new.descansos_por_exercicio := new.descansos_por_exercicio - array(
    select unnest(old.exercicios) except select unnest(new.exercicios)
  );
  return new;
end;
$$;
revoke all on function public.validar_descansos_do_modelo(), public.podar_descansos_do_modelo()
  from public, anon, authenticated;

-- A ordem alfabética confere o mapa explícito antes da poda, inclusive no PATCH
-- que envia os descansos antigos junto de uma lista menor de exercícios.
create or replace trigger conferir_descansos_do_modelo
  before insert or update of descansos_por_exercicio on public.modelos_de_treino
  for each row when (new.descansos_por_exercicio is not null) execute function public.validar_descansos_do_modelo();
create or replace trigger podar_descansos_do_modelo
  before update of exercicios on public.modelos_de_treino
  for each row when (new.descansos_por_exercicio is not null and old.exercicios is distinct from new.exercicios)
  execute function public.podar_descansos_do_modelo();
end;
$migration$;
