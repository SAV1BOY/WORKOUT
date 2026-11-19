import { describe, expect, it } from "vitest";
import { equipamentoDisponivel, exercicioPorId } from "@/lib/dados";
import { equipamentoDaSessao } from "@/lib/equipamento-da-sessao";
import { itensDeIds, planoDaSessao } from "@/lib/livre";
import { montarRepeticaoDoTreinoLivre } from "@/lib/repetir-treino-livre";
import { atualizarSerie, definirEquipamentoDaSessao, definirFirme, definirNota, marcarSerie, montarSessaoAvulsa, planoParaGravar, substituirExercicio } from "@/lib/sessao";

const original = "agachamento-livre";
const variacao = "agachamento-com-peso-corporal";
const apoio = "abdominal-supra";
const rotulos = { titulo: "Quinta no terraço", colecao: "grupo:Core" };
const entrada = { id: "treino-antigo", data: "2026-11-10", userId: "atleta", workoutId: "livre", fase: "fase1" } as const;
const concluida = (plano: unknown) => montarRepeticaoDoTreinoLivre({ workout_id: "livre", status: "concluida", plano });
const itens = itensDeIds([apoio, original]);
itens[1] = { ...itens[1]!, prescricao: { ...itens[1]!.prescricao, series: 4, min: 4, max: 7 }, descansoS: 90, descansoTexto: "90 s" };
const plano = planoDaSessao(itens, rotulos);

describe("composição de um treino livre concluído", () => {
  it("repete a ordem, o título e a prescrição válida nas posições sem troca", () => {
    expect(concluida(plano)).toEqual({ itens, ...rotulos });
    expect(concluida({ itens: plano.itens })?.titulo).toBeNull();
  });

  it("a nova sessão usa o movimento final de cada posição sem herdar restos de séries, notas e equipamento", () => {
    let antiga = montarSessaoAvulsa({ ...entrada, itens, plano });
    antiga = definirEquipamentoDaSessao(antiga, new Set());
    const serie = antiga.blocos[1]!.series.find((s) => s.tipo === "trabalho")!;
    antiga = atualizarSerie(antiga, 2, serie.id, { cargaKg: 57.5, reps: 19 });
    antiga = marcarSerie(antiga, 2, serie.id, true);
    antiga = definirNota(antiga, 2, "somente no primeiro treino");
    antiga = definirFirme(antiga, 2, false);
    antiga = substituirExercicio(antiga, 2, variacao);
    const repeticao = concluida(planoParaGravar(antiga))!;
    expect(repeticao.itens).toEqual(itensDeIds([apoio, variacao]));
    const nova = montarSessaoAvulsa({ ...entrada, id: "outra-sessao", data: "2026-11-19", itens: repeticao.itens,
      plano: planoDaSessao(repeticao.itens, repeticao) });
    expect(nova.plano).toEqual(planoDaSessao(itensDeIds([apoio, variacao]), rotulos));
    expect(equipamentoDaSessao(nova)).toEqual(equipamentoDisponivel());
    expect(nova.blocos[1]).toMatchObject({ exercicioId: variacao, originalId: variacao, substituido: false, ultimaFirme: null, nota: null });
    const idsAntigos = new Set(antiga.blocos.flatMap((b) => [b, ...(b.trocados ?? [])].flatMap((e) => e.series.map((s) => s.id))));
    expect(nova.blocos.flatMap((b) => b.series).every((s) => !idsAntigos.has(s.id) && !s.concluida && s.registradaEm === null)).toBe(true);
    const voltou = substituirExercicio(antiga, 2, original);
    expect(concluida(planoParaGravar(voltou))).toEqual({ itens, ...rotulos });
  });

  it("recupera a posição com movimento ativo reconhecível mesmo se o cadastro original do backup não existir mais", () => {
    const recuperado = concluida({ itens: [null, plano.itens[1]], trocas: { 1: [{ exercicio_id: variacao }, { exercicio_id: "removido" }] } });
    expect(recuperado?.itens).toEqual([...itensDeIds([variacao]), itens[1]]);
  });

  it("não monta um treino parcial se faltar uma posição, houver trocas ambíguas ou o mesmo movimento final em dois slots", () => {
    for (const incompleto of [null, {}, { itens: [] }, { itens: [null, plano.itens[1]] }, { itens: [{ exercicio_id: "desconhecido" }] },
      { ...plano, trocas: { 1: [] } }, { ...plano, trocas: { 2: [{ exercicio_id: "removido" }, { exercicio_id: original }] } },
      { ...plano, trocas: { 1: [{ exercicio_id: original }] } }, { ...plano, trocas: { 3: [{ exercicio_id: variacao }] } },
      { ...plano, trocas: "inesperado" }, { itens: [plano.itens[0], plano.itens[0]] }, { itens: Array(10_000).fill(plano.itens[0]) }]) {
      expect(concluida(incompleto)).toBeNull();
    }
  });

  it("recusa um treino do programa, livre em andamento e livre abandonado", () => {
    for (const [workout_id, status] of [["A1", "concluida"], ["fixa", "concluida"], ["livre", "abandonada"], ["livre", "em_andamento"]] as const) {
      expect(montarRepeticaoDoTreinoLivre({ workout_id, status, plano })).toBeNull();
    }
  });

  it("aproveita planos legados sem prescrição e recupera o padrão para séries ou medidas incompatíveis", () => {
    const padroes = itensDeIds([apoio]);
    for (const campos of [{}, { tipo: "tempo_s", min: 6, max: 60, series: 99_999 }, { series: -1, min: -9, max: 30 },
      { series: 2.5, min: 20, max: 5, descanso_s: -1, descanso_texto: "discordante" }, { min: 1, max: 2 ** 31 }]) {
      expect(concluida({ itens: [{ exercicio_id: apoio, ...campos }] })?.itens).toEqual(padroes);
    }
    expect(concluida({ itens: [{ exercicio_id: apoio, descanso_s: 45 }] })?.itens[0]?.descansoTexto).toBe("45 s");
    // A coleção sugere seis, mas o personalizador permite um treino maior.
    const ids = [...exercicioPorId.keys()].slice(0, 9);
    expect(concluida(planoDaSessao(itensDeIds(ids)))?.itens.map((i) => i.exercicioId)).toEqual(ids);
  });
});
