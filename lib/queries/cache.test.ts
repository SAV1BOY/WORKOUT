/**
 * O cache persistido como fonte de leitura offline (SPEC §6.3 e §14.1): a aba
 * Treino lê os ids do treino do dia e `/treinar` os da fase inteira — quem
 * cria a sessão tem que aproveitar as duas, e saber **por exercício** o que
 * já foi lido.
 */
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  chaves,
  estadosNoCache,
  recordesNoCache,
  seriesAnterioresNoCache,
} from "@/lib/queries/dados";

function estado(id: string, carga: number) {
  return {
    exercise_id: id,
    carga_atual_kg: carga,
    reps_alvo: null,
    tempo_alvo_s: null,
    assistencia_atual: null,
    semanas_sem_subir: 0,
    falhas_seguidas: 0,
    ultima_data: null,
  };
}

function clienteCom(entradas: [readonly unknown[], unknown][]): QueryClient {
  const cliente = new QueryClient();
  for (const [chave, dados] of entradas) cliente.setQueryData(chave, dados);
  return cliente;
}

describe("estadosNoCache", () => {
  it("junta leituras de chaves diferentes e diz quem já foi lido", () => {
    const cliente = clienteCom([
      [chaves.estados(["agachamento-livre", "supino-reto-com-barra"]), [estado("agachamento-livre", 10)]],
      [chaves.estados(["remada-curvada-com-barra"]), [estado("remada-curvada-com-barra", 20)]],
    ]);

    const { estados, conhecidos } = estadosNoCache(cliente, [
      "agachamento-livre",
      "supino-reto-com-barra",
      "remada-curvada-com-barra",
      "levantamento-terra",
    ]);

    expect(estados.map((e) => e.exercise_id).sort()).toEqual([
      "agachamento-livre",
      "remada-curvada-com-barra",
    ]);
    // lido e sem linha = "nunca fez"; lido é lido
    expect(conhecidos.has("supino-reto-com-barra")).toBe(true);
    // nunca pedido em consulta nenhuma: continua desconhecido
    expect(conhecidos.has("levantamento-terra")).toBe(false);
  });

  it("a leitura mais recente ganha", () => {
    const cliente = new QueryClient();
    cliente.setQueryData(chaves.estados(["agachamento-livre"]), [
      estado("agachamento-livre", 10),
    ]);
    cliente.setQueryData(chaves.estados(["agachamento-livre", "supino-reto-com-barra"]), [
      estado("agachamento-livre", 12),
    ]);
    const { estados } = estadosNoCache(cliente, ["agachamento-livre"]);
    expect(estados[0]?.carga_atual_kg).toBe(12);
  });

  it("sem cache nenhum, nada é conhecido", () => {
    const { estados, conhecidos } = estadosNoCache(new QueryClient(), [
      "agachamento-livre",
    ]);
    expect(estados).toEqual([]);
    expect(conhecidos.size).toBe(0);
  });
});

describe("recordesNoCache e seriesAnterioresNoCache", () => {
  it("filtram pelos ids pedidos e não repetem série", () => {
    const linha = {
      session_id: "s1",
      exercise_id: "agachamento-livre",
      set_index: 1,
      reps: 5,
      tipo: "trabalho" as const,
      concluida: true,
      registrada_em: "2026-09-14T10:00:00.000Z",
    };
    const cliente = clienteCom([
      [chaves.recordes(["agachamento-livre"]), [{ exercise_id: "agachamento-livre", carga_max_kg: 40 }]],
      [chaves.recordes(["supino-reto-com-barra"]), [{ exercise_id: "supino-reto-com-barra", carga_max_kg: 30 }]],
      [chaves.seriesAnteriores(["agachamento-livre"]), [linha]],
      [chaves.seriesAnteriores(["agachamento-livre", "supino-reto-com-barra"]), [linha]],
    ]);

    expect(recordesNoCache(cliente, ["agachamento-livre"])).toHaveLength(1);
    expect(seriesAnterioresNoCache(cliente, ["agachamento-livre"])).toHaveLength(1);
    expect(seriesAnterioresNoCache(cliente, ["remada-curvada-com-barra"])).toEqual([]);
  });
});
