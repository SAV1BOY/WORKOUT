import { expect, it } from "vitest";
import { acharExercicio, equipamentoDisponivel } from "./dados";
import { itensDeIds, planoDaSessao } from "./livre";
import { descansoEntreSeriesDeTrabalho } from "./player";
import { estadoInicial } from "./progressao";
import type { EquipamentoTag } from "./schemas";
import { montarSessaoAvulsa } from "./sessao";
import { desfazerTrocaNaMontagem, podeDesfazerTrocaNaMontagem, trocarEscolhido, type EscolhaNaMontagem } from "./troca-na-montagem";

const barra = "agachamento-livre";
const corpo = "agachamento-com-peso-corporal";
const remada = "remada-com-elastico";
const terra = "levantamento-terra";
const semCavalete = new Set<EquipamentoTag>(["anilhas", "barra-macica", "super-band"]);
const rascunho: EscolhaNaMontagem = {
  escolhidos: [remada, barra, terra],
  seriesPorExercicio: { [remada]: 4, [barra]: 6 },
  descansosPorExercicio: { [barra]: 120, [terra]: 85 },
};

it("substitui na mesma posição e começa com o alvo, as séries e o descanso próprios da alternativa", () => {
  const original = structuredClone(rascunho);
  const alterado = trocarEscolhido(rascunho, barra, corpo, semCavalete)!;
  expect(alterado).toStrictEqual({
    escolhidos: [remada, corpo, terra], seriesPorExercicio: { [remada]: 4 }, descansosPorExercicio: { [terra]: 85 },
    troca: { anterior: barra, substituto: corpo, series: 6, descanso: 120 },
  });
  expect(rascunho).toStrictEqual(original);

  const itens = itensDeIds(alterado.escolhidos, alterado.seriesPorExercicio);
  const sessao = montarSessaoAvulsa({
    id: "sessao", userId: "ana", workoutId: "livre", data: "2026-11-20", fase: "fase1", itens,
    plano: planoDaSessao(itens, { descansosPorExercicio: alterado.descansosPorExercicio }),
    estados: {
      [barra]: { ...estadoInicial(acharExercicio(barra)), carga_atual_kg: 31.5 },
      [corpo]: { ...estadoInicial(acharExercicio(corpo)), reps_alvo: 14 },
    },
  });
  const agachamento = sessao.blocos[1]!;
  expect(agachamento.prescricao).toMatchObject({ series: 3, min: 8, max: 12 });
  expect(agachamento.series.map(s => [s.tipo, s.reps, s.cargaKg])).toEqual(Array(3).fill(["trabalho", 14, 0]));
  expect(descansoEntreSeriesDeTrabalho(sessao, agachamento, {})).toBe(60);
  expect(descansoEntreSeriesDeTrabalho(sessao, agachamento, { descansoPadraoS: 70 })).toBe(70);
  expect(sessao.blocos[2]!.series.filter(s => s.tipo === "aquecimento")).toHaveLength(2);
});

it("desfaz na posição atual do substituto e mantém as edições feitas nos demais exercícios", () => {
  const { troca } = trocarEscolhido(rascunho, barra, corpo, semCavalete)!;
  const reordenado = {
    escolhidos: [corpo, terra, remada], seriesPorExercicio: { [corpo]: 2, [terra]: 9 },
    descansosPorExercicio: { [corpo]: 95, [terra]: 110 },
  };
  const antes = structuredClone(reordenado);
  expect(podeDesfazerTrocaNaMontagem(reordenado.escolhidos, troca)).toBe(true);
  expect(desfazerTrocaNaMontagem(reordenado, troca)).toStrictEqual({
    escolhidos: [barra, terra, remada], seriesPorExercicio: { [barra]: 6, [terra]: 9 },
    descansosPorExercicio: { [barra]: 120, [terra]: 110 },
  });
  expect(reordenado).toStrictEqual(antes);
});

it.each<Omit<EscolhaNaMontagem, "escolhidos"> & { esperados: { series?: number; descanso?: number } }>([
  { seriesPorExercicio: {}, descansosPorExercicio: {}, esperados: {} },
  { seriesPorExercicio: { [barra]: 3 }, descansosPorExercicio: {}, esperados: { series: 3 } },
  { seriesPorExercicio: {}, descansosPorExercicio: { [barra]: 150 }, esperados: { descanso: 150 } },
])("lembra só os ajustes explícitos, mesmo quando iguais ao padrão ($esperados)", ({ seriesPorExercicio, descansosPorExercicio, esperados }) => {
  const original = { escolhidos: [barra], seriesPorExercicio, descansosPorExercicio };
  const alterado = trocarEscolhido(original, barra, corpo, semCavalete)!;
  expect(alterado.troca).toStrictEqual({ anterior: barra, substituto: corpo, ...esperados });
  expect(desfazerTrocaNaMontagem(alterado, alterado.troca)).toStrictEqual(original);
});

it("a segunda troca lembra o exercício que acaba de sair com os ajustes daquele momento", () => {
  const primeira = trocarEscolhido(rascunho, barra, corpo, semCavalete)!;
  const editado = { ...primeira, descansosPorExercicio: { ...primeira.descansosPorExercicio, [corpo]: 95 } };
  const segunda = trocarEscolhido(editado, corpo, "agachamento-goblet", equipamentoDisponivel())!;
  expect(segunda.troca).toStrictEqual({ anterior: corpo, substituto: "agachamento-goblet", descanso: 95 });
  expect(desfazerTrocaNaMontagem(segunda, segunda.troca)).toStrictEqual({
    escolhidos: editado.escolhidos, seriesPorExercicio: editado.seriesPorExercicio,
    descansosPorExercicio: editado.descansosPorExercicio,
  });
});

it("confere os IDs livres, a afinidade e o equipamento disponível no momento de aplicar", () => {
  expect(trocarEscolhido(rascunho, barra, barra, semCavalete)).toBeNull();
  expect(trocarEscolhido(rascunho, corpo, barra, equipamentoDisponivel())).toBeNull();
  expect(trocarEscolhido({ ...rascunho, escolhidos: [barra, corpo] }, barra, corpo, semCavalete)).toBeNull();
  expect(trocarEscolhido(rascunho, barra, "supino-reto-com-barra", equipamentoDisponivel())).toBeNull();
  expect(trocarEscolhido(rascunho, barra, "agachamento-frontal", semCavalete)).toBeNull();
  expect(trocarEscolhido(rascunho, barra, "agachamento-frontal", equipamentoDisponivel())).not.toBeNull();
});

it("não desfaz se o substituto saiu, se há ambiguidade ou se outra posição já usa o original", () => {
  const alterado = trocarEscolhido(rascunho, barra, corpo, semCavalete)!;
  for (const escolhidos of [[remada, terra], [corpo, terra, corpo], [barra, remada, corpo]]) {
    expect(podeDesfazerTrocaNaMontagem(escolhidos, alterado.troca)).toBe(false);
    expect(desfazerTrocaNaMontagem({ ...alterado, escolhidos }, alterado.troca)).toBeNull();
  }
});
