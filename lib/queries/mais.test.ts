import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chaves } from "@/lib/queries/dados";
import { salvarIncremento } from "@/lib/queries/mais";
import type { LinhaEstadoExercicio } from "@/lib/types";

const enfileirada = vi.hoisted(() => vi.fn());

vi.mock("@/lib/outbox-supabase", () => ({
  enfileirarEscrita: enfileirada,
}));

const IDS = ["agachamento-livre", "supino-reto-com-barra"] as const;

function linhaExistente(): LinhaEstadoExercicio {
  return {
    user_id: "u1",
    exercise_id: "supino-reto-com-barra",
    carga_atual_kg: 30,
    reps_alvo: null,
    tempo_alvo_s: null,
    assistencia: null,
    incremento_kg: null,
    falhas_seguidas: 0,
    incremento_reduzido: false,
    exigir_rep_extra: false,
    semana_leve: false,
    carga_antes_leve: null,
    sessoes_graca: 0,
    desativado: false,
    notas: null,
  };
}

describe("salvarIncremento (SPEC §3.9)", () => {
  beforeEach(() => {
    enfileirada.mockClear();
  });

  it("atualiza a linha que já existe no cache", async () => {
    const cliente = new QueryClient();
    cliente.setQueryData(chaves.estados(IDS), [linhaExistente()]);

    await salvarIncremento({
      userId: "u1",
      exercicioId: "supino-reto-com-barra",
      incrementoKg: 3,
      cliente,
      idsEmTela: IDS,
    });

    const linhas = cliente.getQueryData<LinhaEstadoExercicio[]>(
      chaves.estados(IDS),
    );
    expect(linhas).toHaveLength(1);
    expect(linhas?.[0]?.incremento_kg).toBe(3);
    expect(linhas?.[0]?.carga_atual_kg).toBe(30);
    expect(enfileirada).toHaveBeenCalledTimes(1);
  });

  it("cria no cache a linha do exercício que ainda não tem estado", async () => {
    const cliente = new QueryClient();
    cliente.setQueryData(chaves.estados(IDS), [linhaExistente()]);

    await salvarIncremento({
      userId: "u1",
      exercicioId: "agachamento-livre",
      incrementoKg: 6,
      cliente,
      idsEmTela: IDS,
    });

    const linhas = cliente.getQueryData<LinhaEstadoExercicio[]>(
      chaves.estados(IDS),
    );
    expect(linhas).toHaveLength(2);
    const nova = linhas?.find((l) => l.exercise_id === "agachamento-livre");
    // a linha sintética tem que ser a mesma que o upsert cria no banco:
    // os defaults de `exercise_state` em supabase/schema.sql
    expect(nova).toEqual({
      user_id: "u1",
      exercise_id: "agachamento-livre",
      carga_atual_kg: null,
      reps_alvo: null,
      tempo_alvo_s: null,
      assistencia: null,
      incremento_kg: 6,
      falhas_seguidas: 0,
      incremento_reduzido: false,
      exigir_rep_extra: false,
      semana_leve: false,
      carga_antes_leve: null,
      sessoes_graca: 0,
      desativado: false,
      notas: null,
    });
    // e o upsert vai para a fila com a chave real (§8)
    expect(enfileirada).toHaveBeenCalledWith("estado_exercicio", {
      tabela: "exercise_state",
      op: "upsert",
      linha: {
        user_id: "u1",
        exercise_id: "agachamento-livre",
        incremento_kg: 6,
      },
      onConflict: "user_id,exercise_id",
    });
  });

  it("voltar ao incremento do programa (null) também fica no cache", async () => {
    const cliente = new QueryClient();
    cliente.setQueryData(chaves.estados(IDS), []);

    await salvarIncremento({
      userId: "u1",
      exercicioId: "agachamento-livre",
      incrementoKg: null,
      cliente,
      idsEmTela: IDS,
    });

    const linhas = cliente.getQueryData<LinhaEstadoExercicio[]>(
      chaves.estados(IDS),
    );
    expect(linhas).toHaveLength(1);
    expect(linhas?.[0]?.incremento_kg).toBeNull();
  });
});
