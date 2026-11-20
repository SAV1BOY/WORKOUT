import { describe, expect, it } from "vitest";
import { itensDeIds, itensDoPlano, planoDaSessao } from "@/lib/livre";
import { ordensDeExecucao } from "@/lib/ordem-da-sessao";
import {
  acrescentarExercicioNaSessao, aplicarOrdemRemotaDaSessao, atualizarSerie, blocosNaOrdemDeExecucao,
  comSubstituicoes, definirNota, desfazerUltimaInclusao, escolherProximoExercicio, escritaDaSessao,
  escritasDasSeriesFeitas, marcarSerie, montarSessaoAvulsa, opcoesDeProximoExercicio,
  planoParaGravar, reconstruirSessao, ultimaInclusaoDesfazivel, type SessaoLocal,
} from "@/lib/sessao";
import type { LinhaSerie, LinhaSessao } from "@/lib/types";

const supino = "supino-reto-com-barra";
const remada = "remada-curvada-pronada";
const rosca = "rosca-com-elastico";
const prancha = "prancha";

function criar(ids = [supino, remada, rosca, prancha]) {
  const itens = itensDeIds(ids);
  return montarSessaoAvulsa({
    id: "treino", userId: "conta", workoutId: "livre", data: "2026-11-20", fase: "fase1",
    itens, plano: planoDaSessao(itens),
  });
}

const posicoes = (s: SessaoLocal) => blocosNaOrdemDeExecucao(s).map(b => b.ordem);

describe("sequência do treino livre", () => {
  it("prioriza a coluna, inclusive uma lista vazia, usa o espelho antigo e mantém as posições sem chave", () => {
    const p = { itens: [null, { exercicio_id: "a" }, { exercicio_id: "b" }, {}, { exercicio_id: "a" }],
      ordem_execucao: ["b", "a", "ausente", "b"] };
    expect(ordensDeExecucao(p)).toEqual([3, 1, 2, 4, 5]);
    expect(ordensDeExecucao(p, null)).toEqual([3, 1, 2, 4, 5]);
    expect(ordensDeExecucao(p, [])).toEqual([1, 2, 3, 4, 5]);
    expect(ordensDeExecucao(p, [null, "a", "outra"])).toEqual([1, 2, 3, 4, 5]);
    expect(ordensDeExecucao({ itens: new Array(3) })).toEqual([1, 2, 3]);
    expect(ordensDeExecucao(null)).toEqual([]);
  });

  it("antecipa um exercício e conserva cargas, notas, séries, substituições, blocos e prazo", () => {
    let origem = criar();
    const serie = origem.blocos[0]!.series[0]!;
    origem = atualizarSerie(origem, 1, serie.id, { reps: 8, cargaKg: 20 });
    origem = marcarSerie(origem, 1, serie.id, true);
    origem = definirNota(origem, 3, "Fazer com elástico leve");
    origem = comSubstituicoes(origem, { [remada]: "remada-com-elastico" });
    origem = { ...origem, player: { chave: `descanso:serie:${serie.id}`, ordem: 1, fimEm: 90000, totalS: 90 } };
    const original = escritaDaSessao(origem).linha;
    expect(original?.plano).not.toHaveProperty("ordem_execucao");
    expect(original).not.toHaveProperty("ordem_execucao");
    const mudada = escolherProximoExercicio(origem, 1, 3);
    expect(posicoes(mudada)).toEqual([1, 3, 2, 4]);
    expect(mudada.ordemExecucao).toEqual([supino, rosca, remada, prancha]);
    expect(mudada.plano?.itens).toBe(origem.plano?.itens);
    expect(mudada.blocos).toBe(origem.blocos);
    expect(mudada.player).toBe(origem.player);
    expect(escritasDasSeriesFeitas(mudada)).toEqual(escritasDasSeriesFeitas(origem));
    expect(planoParaGravar(mudada)?.trocas).toEqual(planoParaGravar(origem)?.trocas);
    expect(escritaDaSessao(mudada).linha).not.toHaveProperty("ordem_execucao");
    expect(planoParaGravar(mudada)?.ordem_execucao).toEqual(mudada.ordemExecucao);
    expect(escolherProximoExercicio(mudada, 1, 3)).toBe(mudada);
    expect(posicoes(escolherProximoExercicio(mudada, 3, 4))).toEqual([1, 3, 4, 2]);
    expect(posicoes(origem)).toEqual([1, 2, 3, 4]);
  });

  it("oferece só o que pode ser antecipado sem atravessar uma série registrada, inclusive trocada", () => {
    const origem = criar([rosca, supino, remada, prancha]);
    expect(opcoesDeProximoExercicio(origem, 1)).toEqual([3, 4]);
    const aquecimento = origem.blocos[1]!.series.find(s => s.tipo === "aquecimento")!;
    expect(aquecimento).toBeDefined();
    const comSerie = marcarSerie(origem, 2, aquecimento.id, true);
    const trocada = comSubstituicoes(comSerie, { [supino]: "flexao-de-braco" });
    expect(trocada.blocos[1]?.series.every(s => !s.concluida)).toBe(true);
    for (const s of [comSerie, trocada]) {
      expect(opcoesDeProximoExercicio(s, 1)).toEqual([]);
      expect(escolherProximoExercicio(s, 1, 3)).toBe(s);
      expect(opcoesDeProximoExercicio(s, 2)).toEqual([4]);
    }
    const alvoComRegistro = marcarSerie(origem, 3, origem.blocos[2]!.series[0]!.id, true);
    expect(escolherProximoExercicio(alvoComRegistro, 1, 3)).toBe(alvoComRegistro);
    for (const s of [{ ...origem, workoutId: "A1" }, { ...origem, status: "concluida" }, { ...origem, plano: null }] as const) {
      expect(escolherProximoExercicio(s, 1, 3)).toBe(s);
    }
    for (const [inicio, alvo] of [[0, 3], [1, 1], [3, 1], [1, 2], [2, 99]] as const) {
      expect(escolherProximoExercicio(origem, inicio, alvo)).toBe(origem);
    }
  });

  it("uma inclusão retém sua chave quando um cliente antigo acrescenta outro item", () => {
    const base = criar([supino, remada]);
    const antiga = acrescentarExercicioNaSessao(base, rosca, {});
    const id = antiga.plano!.ultima_inclusao!.id;
    const mudada = escolherProximoExercicio(antiga, 1, 3);
    expect(mudada.ordemExecucao).toEqual([supino, `inclusao:${id}`, remada]);
    expect(mudada.plano?.itens[2]?.inclusao_id).toBe(id);
    expect(antiga.plano?.itens[2]).not.toHaveProperty("inclusao_id");
    const ampliada = acrescentarExercicioNaSessao(mudada, prancha, {});
    expect(ampliada.plano?.itens[2]?.inclusao_id).toBe(id);
    expect(posicoes(ampliada)).toEqual([1, 3, 2, 4]);
  });

  it("uma série recém-incluída entra no fim após desfazer e reincluir o mesmo movimento", () => {
    const incluida = acrescentarExercicioNaSessao(criar([supino, remada]), rosca, {});
    const id = incluida.plano!.ultima_inclusao!.id;
    expect(incluida.plano?.itens[2]).not.toHaveProperty("inclusao_id");
    const escolhida = escolherProximoExercicio(incluida, 1, 3);
    expect(escolhida.plano?.itens[2]?.inclusao_id).toBe(id);
    expect(ultimaInclusaoDesfazivel(escolhida)?.id).toBe(id);
    const retirada = desfazerUltimaInclusao(escolhida, id);
    expect(posicoes(retirada)).toEqual([1, 2]);
    const nova = acrescentarExercicioNaSessao(retirada, rosca, {});
    expect(nova.plano?.ultima_inclusao?.id).not.toBe(id);
    expect(posicoes(nova)).toEqual([1, 2, 3]);
    expect(nova.ordemExecucao).toEqual(escolhida.ordemExecucao);
    expect(posicoes(escolherProximoExercicio(nova, 1, 3))).toEqual([1, 3, 2]);
  });

  it("reabre a coluna mesmo quando a escrita antiga devolve o plano físico e mantém UUID e posição da série", () => {
    const origem = criar();
    const registrada = marcarSerie(origem, 1, origem.blocos[0]!.series[0]!.id, true);
    const movida = escolherProximoExercicio(registrada, 1, 4);
    const linha = escritaDaSessao(registrada).linha as unknown as LinhaSessao;
    const series = escritasDasSeriesFeitas(registrada).map(e => e.linha as unknown as LinhaSerie);
    const reaberta = reconstruirSessao({ ...linha, ordem_execucao: movida.ordemExecucao }, series,
      { itens: itensDoPlano(linha.plano)! })!;
    expect(posicoes(reaberta)).toEqual([1, 4, 2, 3]);
    expect(reaberta.plano?.ordem_execucao).toEqual(movida.ordemExecucao);
    expect(aplicarOrdemRemotaDaSessao(reaberta, reaberta.ordemExecucao!)).toBe(reaberta);
    expect(escritasDasSeriesFeitas(reaberta).map(e => [e.linha?.id, e.linha?.ordem_ex])).toEqual([[series[0]!.id, 1]]);
    const apenasEspelho = reconstruirSessao({ ...linha, plano: movida.plano }, series,
      { itens: itensDoPlano(linha.plano)! })!;
    expect(apenasEspelho).not.toHaveProperty("ordemExecucao");
    expect(posicoes(apenasEspelho)).toEqual([1, 4, 2, 3]);
  });
});
