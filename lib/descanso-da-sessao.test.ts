import { describe, expect, it } from "vitest";
import { itensDeIds, itensDoPlano, planoDaSessao } from "@/lib/livre";
import { estadoDoPasso, exercicioDoDescansoEntreSeries, sequenciaDoPlayer } from "@/lib/player";
import { montarRepeticaoDoTreinoLivre } from "@/lib/repetir-treino-livre";
import {
  definirDescansoDoExercicioNaSessao, definirEquipamentoDaSessao, descansoPersonalizadoDaSessao,
  escritaDaSessao, escritasDasSeriesFeitas, marcarSerie, montarSessao, montarSessaoAvulsa, planoParaGravar,
  reconstruirSessao, substituirExercicio,
} from "@/lib/sessao";
import type { LinhaSerie } from "@/lib/types";

const entrada = { id: "sessao", userId: "conta", data: "2026-11-19", fase: "fase1", treinoId: "A1" } as const;
const supino = "supino-reto-com-barra";
const flexao = "flexao-de-braco";
const agachamento = "agachamento-livre";

describe("descanso entre séries do mesmo exercício na sessão", () => {
  it("conserva o último padrão conhecido apenas na cópia local daquela sessão", () => {
    const inicio = montarSessao(entrada);
    expect(inicio).not.toHaveProperty("descansoPadraoConhecidoS");
    const comPadrao = { ...inicio, descansoPadraoConhecidoS: 71 };
    const personalizada = definirDescansoDoExercicioNaSessao(comPadrao, supino, 85);
    const semPadraoLocal = definirDescansoDoExercicioNaSessao(inicio, supino, 85);
    expect(personalizada.descansoPadraoConhecidoS).toBe(71);
    expect(planoParaGravar(personalizada)).toEqual(planoParaGravar(semPadraoLocal));
    expect(escritaDaSessao(personalizada)).toEqual(escritaDaSessao(semPadraoLocal));
  });

  it("aplica os segundos escolhidos somente entre séries de trabalho do movimento", () => {
    const sessao = montarSessao(entrada);
    const personalizada = definirDescansoDoExercicioNaSessao(sessao, agachamento, 72);
    const seq = sequenciaDoPlayer(personalizada, { descansoPadraoS: 45 });
    const pausas = seq.flatMap((passo, i) => {
      const serie = exercicioDoDescansoEntreSeries(seq, i);
      if (passo.tipo !== "descanso") {
        expect(serie).toBeNull();
        return [];
      }
      return [{ segundos: passo.segundos, serie, transicao: passo.entreExercicios }];
    });
    const doAgachamento = pausas.filter(p => p.serie?.exercicioId === agachamento);
    expect(doAgachamento.map(p => p.segundos)).toEqual([72, 72]);
    expect(doAgachamento.map(p => p.serie?.numero)).toEqual([1, 2]);
    expect(pausas.filter(p => p.serie?.exercicioId !== agachamento).every(p => p.segundos === 45)).toBe(true);
    expect(pausas.filter(p => p.transicao).every(p => p.serie === null)).toBe(true);
    expect(pausas.filter(p => !p.transicao && !p.serie)).toHaveLength(2); // As duas pausas de aquecimento.
    expect(sequenciaDoPlayer(personalizada).filter(p => p.tipo === "descanso").length).toBe(pausas.length);
  });

  it("restaura a preferência geral ou a prescrição sem alterar o relógio, as séries ou o outro exercício", () => {
    const original = montarSessao(entrada);
    const pre = definirDescansoDoExercicioNaSessao(original, agachamento, 55);
    const comDois = definirDescansoDoExercicioNaSessao(pre, supino, 80);
    const seq = sequenciaDoPlayer(comDois);
    const pausa = seq.find((_, i) => exercicioDoDescansoEntreSeries(seq, i)?.exercicioId === supino)!;
    const ativa = { ...comDois, player: estadoDoPasso(pausa, 1000) };
    const volta = definirDescansoDoExercicioNaSessao(ativa, supino, null);
    expect(volta.player).toBe(ativa.player);
    expect(volta.blocos).toBe(ativa.blocos);
    expect(volta.plano?.descansos_por_exercicio).toEqual({ [agachamento]: 55 });
    const base = volta.blocos.find(b => b.exercicioId === supino)!.descansoS;
    expect(sequenciaDoPlayer(volta).find(p => p.chave === pausa.chave)).toMatchObject({ segundos: base });
    expect(sequenciaDoPlayer(volta, { descansoPadraoS: 33 }).find(p => p.chave === pausa.chave)).toMatchObject({ segundos: 33 });
    expect(definirDescansoDoExercicioNaSessao(volta, supino, null)).toBe(volta);
    expect(definirDescansoDoExercicioNaSessao(volta, agachamento, null).plano).not.toHaveProperty("descansos_por_exercicio");
  });

  it("mantém a pausa atual ao restaurar uma prescrição sem intervalo e omite as próximas", () => {
    const itens = itensDeIds([flexao]).map(item => ({ ...item, descansoS: 0 }));
    const nova = montarSessaoAvulsa({ ...entrada, workoutId: "livre", itens });
    const definida = definirDescansoDoExercicioNaSessao(nova, flexao, 51);
    const seq = sequenciaDoPlayer(definida);
    const pausa = seq.find(p => p.tipo === "descanso")!;
    const player = estadoDoPasso(pausa, 1234);
    const volta = definirDescansoDoExercicioNaSessao({ ...definida, player }, flexao, null);
    expect(volta.player?.fimEm).toBe(52_234);
    expect(sequenciaDoPlayer(volta).filter(p => p.tipo === "descanso")).toEqual([pausa]);
    const corrigindo = { chave: seq[1]!.chave, totalS: null, fimEm: null, descansoAoCorrigir: player };
    expect(sequenciaDoPlayer({ ...volta, player: corrigindo }).filter(p => p.tipo === "descanso")).toEqual([pausa]);
    expect(sequenciaDoPlayer({ ...volta, player: null }).some(p => p.tipo === "descanso")).toBe(false);
  });

  it("reabre o plano com cada movimento e suas séries após uma troca de ida e volta", () => {
    const inicial = definirEquipamentoDaSessao(montarSessao(entrada), new Set(["tatame"]));
    const bloco = inicial.blocos.find(b => b.exercicioId === supino)!;
    const registrado = marcarSerie(inicial, bloco.ordem, bloco.series.find(s => s.tipo === "trabalho")!.id, true);
    const original = definirDescansoDoExercicioNaSessao(registrado, supino, 80);
    const trocada = substituirExercicio(original, bloco.ordem, flexao);
    expect(descansoPersonalizadoDaSessao(trocada, flexao)).toBeNull();
    expect(definirDescansoDoExercicioNaSessao(trocada, supino, 77)).toBe(trocada);
    const alternativa = definirDescansoDoExercicioNaSessao(trocada, flexao, 35);
    const plano = planoParaGravar(alternativa)!;
    expect(plano).toMatchObject({ equipamento_disponivel: ["tatame"], descansos_por_exercicio: { [supino]: 80, [flexao]: 35 } });
    const series = escritasDasSeriesFeitas(alternativa).map(e => e.linha as unknown as LinhaSerie);
    const retomada = reconstruirSessao({
      id: alternativa.id, user_id: alternativa.userId, data: alternativa.data, workout_id: alternativa.workoutId,
      fase: alternativa.fase, iniciada_em: alternativa.iniciadaEm, status: alternativa.status, plano,
    }, series, { itens: itensDoPlano(plano)! })!;
    expect(retomada.blocos.find(b => b.ordem === bloco.ordem)?.exercicioId).toBe(flexao);
    const deVolta = substituirExercicio(retomada, bloco.ordem, supino);
    expect(descansoPersonalizadoDaSessao(deVolta, supino)).toBe(80);
    expect(descansoPersonalizadoDaSessao(deVolta, flexao)).toBe(35);
    expect(escritasDasSeriesFeitas(deVolta)).toEqual(escritasDasSeriesFeitas(registrado));
    expect(descansoPersonalizadoDaSessao(montarSessao({ ...entrada, id: "a1-novo" }), supino)).toBeNull();
  });

  it("repetir um treino livre usa o descanso da prescrição original", () => {
    const itens = itensDeIds([flexao]);
    const antiga = montarSessaoAvulsa({ ...entrada, workoutId: "livre", itens, plano: planoDaSessao(itens) });
    const escolhida = definirDescansoDoExercicioNaSessao(antiga, flexao, 88);
    const repeticao = montarRepeticaoDoTreinoLivre({ workout_id: "livre", status: "concluida", plano: planoParaGravar(escolhida) })!;
    expect(repeticao.itens[0]?.descansoS).toBe(itens[0]!.descansoS);
    const nova = montarSessaoAvulsa({ ...entrada, workoutId: "livre", id: "nova", itens: repeticao.itens, plano: planoDaSessao(repeticao.itens, repeticao) });
    expect(descansoPersonalizadoDaSessao(nova, flexao)).toBeNull();
  });

  it("valida segundos, não altera sessões encerradas e ignora dados inválidos de planos antigos", () => {
    const original = montarSessao(entrada);
    expect(definirDescansoDoExercicioNaSessao(original, supino, null)).toBe(original);
    expect(definirDescansoDoExercicioNaSessao(original, supino, Number.NaN)).toBe(original);
    expect(definirDescansoDoExercicioNaSessao(original, "fora-da-sessao", 45)).toBe(original);
    const concluida = { ...original, status: "concluida" as const };
    expect(definirDescansoDoExercicioNaSessao(concluida, supino, 45)).toBe(concluida);
    for (const [pedido, esperado] of [[3, 5], [34.6, 35], [1_000, 900]] as const) {
      const definida = definirDescansoDoExercicioNaSessao(original, supino, pedido);
      expect(descansoPersonalizadoDaSessao(definida, supino)).toBe(esperado);
      expect(definirDescansoDoExercicioNaSessao(definida, supino, pedido)).toBe(definida);
    }
    for (const ruim of [[], null, 7, { [supino]: "45" }, { [supino]: 0 }, { [supino]: 1.2 }, { [supino]: 1000 }]) {
      const plano = JSON.parse(JSON.stringify({ ...planoDaSessao(itensDeIds([supino])), descansos_por_exercicio: ruim }));
      expect(descansoPersonalizadoDaSessao({ plano }, supino)).toBeNull();
    }
  });
});
