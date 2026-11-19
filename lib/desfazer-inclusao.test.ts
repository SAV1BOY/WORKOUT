import { describe, expect, it } from "vitest";
import { itensDeIds, planoDaSessao } from "@/lib/livre";
import {
  acrescentarExercicioNaSessao, ajustarPrescricaoDaSessao, atualizarSerie, bloquearDesfazerSeIniciado,
  definirDescansoDoExercicioNaSessao, definirEquipamentoDaSessao, definirFirme, definirNota,
  desfazerUltimaInclusao, escritaDaSessao, marcarSerie, montarSessaoAvulsa, reconstruirSessao,
  substituirExercicio, ultimaInclusaoDesfazivel, type SessaoLocal,
} from "@/lib/sessao";
import type { LinhaSessao } from "@/lib/types";

const prancha = "prancha";
const rosca = "rosca-com-elastico";
const flexao = "flexao-de-braco";
const entrada = { id: "treino", userId: "conta", data: "2026-11-20", workoutId: "livre", fase: "fase1" } as const;

function inicio() {
  const itens = itensDeIds([prancha]);
  return montarSessaoAvulsa({ ...entrada, itens, plano: planoDaSessao(itens, { titulo: "No terraço" }) });
}

function incluir(sessao = inicio(), id = rosca) {
  return acrescentarExercicioNaSessao(sessao, id, {});
}

describe("desfazer a última inclusão no treino livre", () => {
  it("retira só a última inclusão e guarda sua identidade, sem reabrir a anterior", () => {
    const primeiro = incluir();
    const anterior = ultimaInclusaoDesfazivel(primeiro)!;
    const segundo = incluir(primeiro, flexao);
    const atual = ultimaInclusaoDesfazivel(segundo)!;
    expect(desfazerUltimaInclusao(segundo, anterior.id)).toBe(segundo);
    const desfeita = desfazerUltimaInclusao(segundo, atual.id);
    expect(desfeita.blocos).toEqual(primeiro.blocos);
    expect(desfeita.plano?.itens).toEqual(primeiro.plano?.itens);
    expect(desfeita.plano?.ultima_inclusao).toEqual({ ...atual, estado: "desfeita" });
    expect(desfazerUltimaInclusao(desfeita, atual.id)).toBe(desfeita);
    expect(ultimaInclusaoDesfazivel(desfeita)).toBeNull();
    const reincluida = incluir(desfeita, flexao);
    expect(ultimaInclusaoDesfazivel(reincluida)?.id).not.toBe(atual.id);
    expect(desfazerUltimaInclusao(reincluida, atual.id)).toBe(reincluida);
    expect(segundo.blocos).toHaveLength(3);
  });

  it("conserva o descanso em andamento e todos os registros e escolhas de outros movimentos", () => {
    let antes = incluir();
    antes = definirNota(antes, 1, "Apoio confortável");
    const id = antes.blocos[0]!.series[0]!.id;
    antes = marcarSerie(atualizarSerie(antes, 1, id, { tempoS: 41 }), 1, id, true);
    antes = definirDescansoDoExercicioNaSessao(antes, prancha, 75);
    antes = definirEquipamentoDaSessao(antes, new Set(["tatame"]));
    antes = { ...antes, notaGeral: "Em casa", player: { chave: `descanso:serie:${id}`, fimEm: 94_000, totalS: 75, ordem: 1 } };
    const fim = desfazerUltimaInclusao(antes, ultimaInclusaoDesfazivel(antes)!.id);
    expect(fim.blocos[0]).toBe(antes.blocos[0]);
    expect(fim.plano?.itens[0]).toBe(antes.plano?.itens[0]);
    expect(fim.plano?.descansos_por_exercicio).toBe(antes.plano?.descansos_por_exercicio);
    expect(fim.plano?.equipamento_disponivel).toBe(antes.plano?.equipamento_disponivel);
    expect(fim.player).toBe(antes.player);
    expect(fim.notaGeral).toBe("Em casa");
  });

  it.each([
    ["registrar e desmarcar", (s: SessaoLocal, id: string) => marcarSerie(marcarSerie(s, 2, id, true), 2, id, false)],
    ["carga editada e restaurada", (s: SessaoLocal, id: string) => atualizarSerie(
      atualizarSerie(s, 2, id, { cargaKg: 99 }), 2, id, { cargaKg: s.blocos[1]!.series[0]!.cargaKg })],
    ["nota apagada", (s: SessaoLocal) => definirNota(definirNota(s, 2, "Técnica"), 2, "")],
    ["última firme", (s: SessaoLocal) => definirFirme(s, 2, false)],
    ["ajustar séries", (s: SessaoLocal) => ajustarPrescricaoDaSessao(s, 2, { series: s.blocos[1]!.prescricao.series + 1 })],
    ["substituir e restaurar", (s: SessaoLocal) => substituirExercicio(substituirExercicio(s, 2, flexao), 2, rosca)],
    ["personalizar o descanso e restaurar", (s: SessaoLocal) => definirDescansoDoExercicioNaSessao(
      definirDescansoDoExercicioNaSessao(s, rosca, 70), rosca, null)],
  ] as const)("%s torna o uso permanente, inclusive na cópia do plano", (_, mudar) => {
    const base = incluir();
    const id = ultimaInclusaoDesfazivel(base)!.id;
    const mudou = mudar(base, base.blocos[1]!.series[0]!.id);
    expect(mudou.plano?.ultima_inclusao).toMatchObject({ id, estado: "iniciada" });
    expect(desfazerUltimaInclusao(mudou, id)).toBe(mudou);
    expect(escritaDaSessao(mudou).linha?.plano).toMatchObject({ ultima_inclusao: { id, estado: "iniciada" } });
  });

  it("uma edição pendente feita por versão antiga protege o movimento mesmo sem atualizar o marcador", () => {
    const base = incluir();
    const id = ultimaInclusaoDesfazivel(base)!.id;
    const alterada = structuredClone(base);
    alterada.blocos[1]!.series[0]!.repsLado2 = 61;
    expect(desfazerUltimaInclusao(alterada, id)).toBe(alterada);
    // Ao restaurar o valor original, a edição que havia no disco segue registrada.
    const revertida = atualizarSerie(alterada, 2, alterada.blocos[1]!.series[0]!.id, { repsLado2: null });
    expect(revertida.plano?.ultima_inclusao?.estado).toBe("iniciada");
    const intocada = atualizarSerie(base, 2, base.blocos[1]!.series[0]!.id, { reps: base.blocos[1]!.series[0]!.reps });
    expect(ultimaInclusaoDesfazivel(intocada)?.id).toBe(id);
  });

  it("reconhece a série ativa mesmo sem ordem nos estados de player e conserva o início depois de voltar", () => {
    const base = incluir();
    const serie = base.blocos[1]!.series[0]!.id;
    for (const chave of [`serie:${serie}`, `descanso:serie:${serie}`, "firme:2"]) {
      const noAlvo = bloquearDesfazerSeIniciado({ ...base, player: { chave, fimEm: null, totalS: null } });
      expect(ultimaInclusaoDesfazivel({ ...noAlvo, player: null })).toBeNull();
    }
    const anterior = { chave: "descanso:firme:1", ordem: 1, fimEm: 60_000, totalS: 60 };
    const corrigindo = { ...base, player: { ...anterior, descansoAoCorrigir: { ...anterior, chave: `descanso:serie:${serie}`, ordem: 2 } } };
    expect(ultimaInclusaoDesfazivel(corrigindo)).toBeNull();
    expect(ultimaInclusaoDesfazivel({ ...base, player: anterior })).toBe(base.plano?.ultima_inclusao);
  });

  it("reconhece a mesma inclusão no plano remoto com outros IDs de séries e jamais a herda numa sessão nova", () => {
    const base = incluir();
    const linha = escritaDaSessao(base).linha as unknown as LinhaSessao;
    const itens = itensDeIds([prancha, rosca]);
    const reaberta = reconstruirSessao(linha, [], { itens })!;
    expect(reaberta.blocos[1]!.series[0]!.id).not.toBe(base.blocos[1]!.series[0]!.id);
    expect(ultimaInclusaoDesfazivel(reaberta)).toEqual(ultimaInclusaoDesfazivel(base));
    const nova = montarSessaoAvulsa({ ...entrada, id: "nova", itens, plano: linha.plano });
    expect(nova.plano).not.toHaveProperty("ultima_inclusao");
    expect(ultimaInclusaoDesfazivel(nova)).toBeNull();
  });

  it("rejeita plano antigo, marcador deslocado e sessões que não são livres e ativas", () => {
    const base = incluir();
    const plano = base.plano!;
    for (const sessao of [
      inicio(), { ...base, plano: null }, { ...base, plano: { ...plano, ultima_inclusao: undefined } },
      { ...base, plano: { ...plano, itens: [...plano.itens].reverse() } }, { ...base, id: "outra" },
      { ...base, status: "concluida" as const }, { ...base, status: "abandonada" as const },
      { ...base, workoutId: "A1" as const }, { ...base, workoutId: "fixa" as const },
    ]) {
      expect(ultimaInclusaoDesfazivel(sessao)).toBeNull();
      expect(desfazerUltimaInclusao(sessao, plano.ultima_inclusao!.id)).toBe(sessao);
    }
  });
});
