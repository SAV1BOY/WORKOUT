import { describe, expect, it } from "vitest";
import { equipamentoDisponivel } from "@/lib/dados";
import { equipamentoDaSessao } from "@/lib/equipamento-da-sessao";
import { itensDeIds, itensDoPlano, planoDaSessao } from "@/lib/livre";
import { comSubstituicoes, definirEquipamentoDaSessao, escritasDasSeriesFeitas, marcarSerie, montarSessao, montarSessaoAvulsa, planoParaGravar, reconstruirSessao } from "@/lib/sessao";
import type { LinhaSerie } from "@/lib/types";

const entrada = { id: "sessao", userId: "atleta", data: "2026-11-19", treinoId: "A1", fase: "fase1" } as const;

describe("equipamento de apenas uma sessão", () => {
  it("parte do inventário completo em sessões legadas e distingue só corpo de uma seleção ausente", () => {
    const antiga = montarSessao(entrada);
    expect(antiga.plano).toBeNull();
    expect(equipamentoDaSessao(antiga)).toEqual(equipamentoDisponivel());
    expect(definirEquipamentoDaSessao(antiga, equipamentoDisponivel())).toBe(antiga);
    const semKit = definirEquipamentoDaSessao(antiga, new Set());
    expect(semKit.plano?.equipamento_disponivel).toEqual([]);
    expect(equipamentoDaSessao(semKit)).toEqual(new Set());
    expect(definirEquipamentoDaSessao(semKit, new Set())).toBe(semKit);
  });

  it("preserva a programação, as séries e as alternativas lembradas ao alterar o material e reabrir em outro aparelho", () => {
    const inicio = comSubstituicoes(montarSessao(entrada), { "supino-reto-com-barra": "flexao-de-braco" });
    const exercicio = inicio.blocos.find((b) => b.exercicioId === "flexao-de-braco")!;
    const registrado = marcarSerie(inicio, exercicio.ordem, exercicio.series[0]!.id, true);
    const kit = definirEquipamentoDaSessao(registrado, new Set(["tatame"]));
    expect(kit.blocos).toBe(registrado.blocos);
    const plano = planoParaGravar(kit)!;
    expect(plano.itens[exercicio.ordem - 1]?.exercicio_id).toBe("supino-reto-com-barra");
    expect(plano.trocas?.[exercicio.ordem]?.[0]?.exercicio_id).toBe("flexao-de-braco");
    const linhas = escritasDasSeriesFeitas(kit).map((e) => e.linha as unknown as LinhaSerie);
    const reaberta = reconstruirSessao({ id: kit.id, user_id: kit.userId, data: kit.data, workout_id: kit.workoutId,
      fase: kit.fase, iniciada_em: kit.iniciadaEm, status: kit.status, plano }, linhas, { itens: itensDoPlano(plano)! })!;
    expect(equipamentoDaSessao(reaberta)).toEqual(new Set(["tatame"]));
    expect(escritasDasSeriesFeitas(reaberta)).toEqual(escritasDasSeriesFeitas(kit));
    expect(equipamentoDaSessao(montarSessao({ ...entrada, id: "novo-a1" }))).toEqual(equipamentoDisponivel());
  });

  it("mantém título, ordem e prescrições da sessão livre e ignora tags desconhecidas do backup", () => {
    const itens = itensDeIds(["flexao-de-braco", "agachamento-livre"]);
    const original = planoDaSessao(itens, { titulo: "Meu circuito", colecao: "grupo:Core" });
    const livre = montarSessaoAvulsa({ ...entrada, workoutId: "livre", itens, plano: original });
    expect(equipamentoDaSessao(livre)).toEqual(equipamentoDisponivel());
    const ajustada = definirEquipamentoDaSessao(livre, new Set(["halteres", "anilhas"]));
    expect(ajustada.plano).toMatchObject(original);
    const plano = { ...original, equipamento_disponivel: ["halteres", "sem-cadastro", "halteres"] };
    expect(equipamentoDaSessao({ plano: JSON.parse(JSON.stringify(plano)) })).toEqual(new Set(["halteres"]));
    expect(equipamentoDaSessao({ plano: JSON.parse(JSON.stringify({ ...original, equipamento_disponivel: "sem lista" })) })).toEqual(equipamentoDisponivel());
  });
});
