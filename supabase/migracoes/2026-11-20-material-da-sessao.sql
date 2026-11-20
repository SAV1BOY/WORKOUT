-- Material da sessão e recibos de comandos que podem ser reenviados depois de uma perda de rede.
do $migration$
begin
alter table public.sessions add column if not exists revisao_equipamento uuid;

create schema if not exists treino_interno;
grant usage on schema treino_interno to authenticated;
create table if not exists treino_interno.recibos_material (
  sessao_id uuid not null references public.sessions(id) on delete cascade,
  comando uuid not null,
  material_anterior jsonb,
  descansos_anteriores jsonb,
  descanso_conciliado jsonb,
  primary key (sessao_id, comando)
);
alter table treino_interno.recibos_material enable row level security;
revoke all on treino_interno.recibos_material from public, anon, authenticated;
grant select, insert, update (descanso_conciliado) on treino_interno.recibos_material to authenticated;
drop policy if exists recibos_material_dono on treino_interno.recibos_material;
create policy recibos_material_dono on treino_interno.recibos_material for all to authenticated
  using (exists (select from public.sessions s where s.id = sessao_id and s.user_id = (select auth.uid())))
  with check (exists (select from public.sessions s where s.id = sessao_id and s.user_id = (select auth.uid())));

-- O cliente anterior envia um PATCH com o plano inteiro. Reconhecemos a identidade
-- e a transição da inclusão antes de permitir que esse plano transporte material antigo.
create or replace function treino_interno.conferir_plano_da_sessao() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
declare
  material_antigo jsonb := nullif(old.plano->'equipamento_disponivel', 'null'::jsonb);
  material_novo jsonb := nullif(new.plano->'equipamento_disponivel', 'null'::jsonb);
  antigos jsonb := old.plano->'itens';
  novos jsonb := new.plano->'itens';
  antes integer := case when jsonb_typeof(antigos) = 'array' then jsonb_array_length(antigos) else 0 end;
  depois integer := case when jsonb_typeof(novos) = 'array' then jsonb_array_length(novos) else 0 end;
  anterior jsonb := old.plano->'ultima_inclusao';
  inclusao jsonb := new.plano->'ultima_inclusao';
  alterar_inclusao boolean := false;
  base_do_descanso uuid;
  -- POST da tabela é upsert de criação, conclusão ou restauração explícita do backup.
  edicao boolean := coalesce(current_setting('request.method', true), '') <> 'POST'
                    and old.status = 'em_andamento' and new.status = 'em_andamento';
begin
  if current_setting('request.method', true) = 'PATCH' and old.status <> 'em_andamento'
     and material_antigo is distinct from material_novo then
    raise sqlstate 'PT409' using message = 'PLANO_DA_SESSAO_DIVERGIU';
  end if;
  if edicao and old.workout_id = 'livre' and antes > 0 then
    if depois < antes then
      if (depois = antes - 1 and depois > 0 and novos = antigos - (antes - 1)
          and anterior->>'sessao_id' = old.id::text and anterior->>'estado' = 'disponivel'
          and anterior->>'ordem' = antes::text and anterior->>'id' <> ''
          and anterior->>'exercicio_id' = antigos->-1->>'exercicio_id'
          and inclusao = jsonb_set(anterior, '{estado}', '"desfeita"')) is not true
          or exists (select from public.session_sets r where r.session_id = old.id
                     and r.user_id = old.user_id and r.ordem_ex = antes) then
        raise sqlstate 'PT409' using message = 'PLANO_DA_SESSAO_DIVERGIU';
      end if;
      alterar_inclusao := true;
    elsif depois > antes then
      -- Uma nova inclusão pode reutilizar um slot, mas nunca o UUID de uma inclusão desfeita.
      if depois <> antes + 1 or novos - (depois - 1) <> antigos
         or (inclusao is not null and (
              inclusao->>'id' <> '' and inclusao->>'id' is distinct from anterior->>'id'
              and inclusao->>'estado' = 'disponivel' and inclusao->>'sessao_id' = old.id::text
              and inclusao->>'ordem' = depois::text
              and inclusao->>'exercicio_id' = novos->-1->>'exercicio_id') is not true)
         or (inclusao is null and anterior is not null) then
        raise sqlstate 'PT409' using message = 'PLANO_DA_SESSAO_DIVERGIU';
      end if;
      alterar_inclusao := true;
    elsif anterior is not null and anterior is distinct from inclusao then
      if anterior->>'estado' = 'iniciada' and antigos = novos
         and inclusao = jsonb_set(anterior, '{estado}', '"disponivel"')
         and (old.plano - array['ultima_inclusao','equipamento_disponivel']) =
             (new.plano - array['ultima_inclusao','equipamento_disponivel']) then
        -- A resposta da inclusão se perdeu. Seu reenvio jamais reabre o desfazer.
        new.plano := old.plano;
        material_novo := material_antigo;
      elsif anterior->>'estado' = 'disponivel' and antigos = novos
        and inclusao = jsonb_set(anterior, '{estado}', '"iniciada"') then
        alterar_inclusao := true;
      else
        raise sqlstate 'PT409' using message = 'PLANO_DA_SESSAO_DIVERGIU';
      end if;
    end if;
  end if;

  -- Nas versões anteriores, guardar ou restaurar descanso também envia todo o plano.
  -- O recibo prova qual era o material e se os intervalos na base ainda coincidem.
  if edicao and material_antigo is distinct from material_novo
     and old.plano->'descansos_por_exercicio' is distinct from new.plano->'descansos_por_exercicio'
     and old.plano - array['equipamento_disponivel','descansos_por_exercicio','ultima_inclusao'] =
         new.plano - array['equipamento_disponivel','descansos_por_exercicio','ultima_inclusao'] then
    select comando into base_do_descanso from treino_interno.recibos_material
      where sessao_id = old.id and material_anterior is not distinct from material_novo
        and descansos_anteriores is not distinct from old.plano->'descansos_por_exercicio'
      order by (comando = old.revisao_equipamento) desc, comando limit 1;
    if found then
      update treino_interno.recibos_material
        set descanso_conciliado = coalesce(new.plano->'descansos_por_exercicio', 'null'::jsonb)
        where sessao_id = old.id and comando = base_do_descanso;
    end if;
  elsif edicao and not alterar_inclusao and material_antigo is distinct from material_novo
        and old.plano - 'equipamento_disponivel' = new.plano - 'equipamento_disponivel'
        and exists (select from treino_interno.recibos_material where sessao_id = old.id
                    and material_anterior is not distinct from material_novo
                    and descanso_conciliado = coalesce(new.plano->'descansos_por_exercicio', 'null'::jsonb)) then
    -- Repetir um descanso já conciliado é idêntico a voltar de propósito ao kit
    -- anterior. A pessoa pode manter ou reaplicar só o material em Mais.
    raise sqlstate 'PT409' using message = 'PLANO_DA_SESSAO_DIVERGIU';
  end if;
  if alterar_inclusao and material_antigo is distinct from material_novo and base_do_descanso is null
     and (old.plano - array['itens','ultima_inclusao','equipamento_disponivel']) is distinct from
         (new.plano - array['itens','ultima_inclusao','equipamento_disponivel']) then
    -- O pacote trouxe outras alterações que o gesto identificado não explica.
    raise sqlstate 'PT409' using message = 'PLANO_DA_SESSAO_DIVERGIU';
  end if;
  if (alterar_inclusao or base_do_descanso is not null) and material_antigo is distinct from material_novo then
    new.plano := case when material_antigo is null then new.plano - 'equipamento_disponivel'
                      else jsonb_set(new.plano, '{equipamento_disponivel}', material_antigo) end;
    material_novo := material_antigo;
  end if;

  if material_antigo is distinct from material_novo then
    if new.revisao_equipamento is null or new.revisao_equipamento = old.revisao_equipamento then
      new.revisao_equipamento := gen_random_uuid();
    end if;
    insert into treino_interno.recibos_material(sessao_id, comando, material_anterior, descansos_anteriores)
      values (old.id, new.revisao_equipamento, material_antigo, old.plano->'descansos_por_exercicio')
      on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function treino_interno.conferir_plano_da_sessao() from public, anon, authenticated;
create or replace trigger conferir_plano_da_sessao before update of plano on public.sessions
  for each row execute function treino_interno.conferir_plano_da_sessao();

create or replace function public.alterar_material_da_sessao(
  p_sessao uuid, p_comando uuid, p_revisao_base uuid, p_de jsonb, p_para jsonb, p_plano_inicial jsonb default null
) returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  sessao public.sessions%rowtype;
  atual jsonb;
  selecao jsonb;
  base jsonb;
begin
  select * into sessao from public.sessions where id = p_sessao and user_id = (select auth.uid()) for update;
  if not found then return null; end if;
  if p_comando is null then raise invalid_parameter_value using message = 'Comando de material sem identificação.'; end if;

  if sessao.status = 'em_andamento' and not exists (
    select from treino_interno.recibos_material where sessao_id = p_sessao and comando = p_comando
  ) then
    p_de := nullif(p_de, 'null'::jsonb);
    p_para := nullif(p_para, 'null'::jsonb);
    foreach selecao in array array[p_de, p_para] loop
      if selecao is not null then
        if jsonb_typeof(selecao) <> 'array' then
          raise invalid_parameter_value using message = 'Seleção de material inválida.';
        end if;
        if exists (select from jsonb_array_elements(selecao) t(tag)
                   where jsonb_typeof(tag) <> 'string' or btrim(tag #>> '{}') = '')
           or jsonb_array_length(selecao) <> (select count(distinct tag) from jsonb_array_elements(selecao) t(tag)) then
          raise invalid_parameter_value using message = 'Seleção de material inválida.';
        end if;
      end if;
    end loop;
    atual := nullif(sessao.plano->'equipamento_disponivel', 'null'::jsonb);
    if sessao.revisao_equipamento is distinct from p_revisao_base or atual is distinct from p_de then
      raise sqlstate 'PT409' using message = 'MATERIAL_DA_SESSAO_ALTERADO';
    end if;
    base := nullif(sessao.plano, 'null'::jsonb);
    if base is null and p_para is not null then
      if sessao.workout_id = 'livre' or jsonb_typeof(p_plano_inicial->'itens') is distinct from 'array' then
        raise invalid_parameter_value using message = 'O plano inicial precisa conter a prescrição do treino.';
      end if;
      if jsonb_array_length(p_plano_inicial->'itens') = 0 or exists (
        select from jsonb_array_elements(p_plano_inicial->'itens') item
        where jsonb_typeof(item->'exercicio_id') is distinct from 'string' or btrim(item->>'exercicio_id') = ''
      ) then raise invalid_parameter_value using message = 'O plano inicial precisa conter a prescrição do treino.'; end if;
      base := jsonb_build_object('titulo', p_plano_inicial->'titulo', 'colecao', p_plano_inicial->'colecao',
                                 'itens', p_plano_inicial->'itens');
    end if;
    update public.sessions set plano = case when p_para is null then base - 'equipamento_disponivel'
                                           else jsonb_set(base, '{equipamento_disponivel}', p_para) end,
                               revisao_equipamento = p_comando
      where id = sessao.id and user_id = sessao.user_id returning * into sessao;
    -- O gatilho registra as mudanças de material, inclusive de clientes anteriores.
    if atual is not distinct from p_para then
      insert into treino_interno.recibos_material(sessao_id, comando, material_anterior, descansos_anteriores)
        values (sessao.id, p_comando, atual, base->'descansos_por_exercicio');
    end if;
  end if;
  return jsonb_build_object('id', sessao.id, 'user_id', sessao.user_id, 'status', sessao.status,
                            'plano', sessao.plano, 'revisao_equipamento', sessao.revisao_equipamento);
end;
$$;
revoke all on function public.alterar_material_da_sessao(uuid,uuid,uuid,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.alterar_material_da_sessao(uuid,uuid,uuid,jsonb,jsonb,jsonb) to authenticated;
end;
$migration$;
