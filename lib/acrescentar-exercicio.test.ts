import { describe, expect, it, vi } from "vitest";
import { acharExercicio } from "@/lib/dados";
import { itensDeIds, planoDaSessao } from "@/lib/livre";
import { estadoDoPasso, indiceDoEstado, sequenciaDoPlayer } from "@/lib/player";
import { estadoInicial } from "@/lib/progressao";
import {
  acrescentarExercicioNaSessao, atualizarSerie, blocoAvaliavel, definirDescansoDoExercicioNaSessao,
  definirEquipamentoDaSessao, definirNota, exerciciosOcupadosNaSessao, marcarSerie, montarSessaoAvulsa,
  progressoDaSessao, substituirExercicio, type DadosDoExercicioAcrescentado,
} from "@/lib/sessao";

const PRANCHA = "prancha";
const AGACHAMENTO = "agachamento-livre";
const SUPINO = "supino-reto-com-barra";
const FLEXAO = "flexao-de-braco";
const ROSCA = "rosca-com-elastico";

function livre(ids: string[], motor: DadosDoExercicioAcrescentado = {}) {
  const itens = itensDeIds(ids);
  return montarSessaoAvulsa({
    id: "treino", userId: "conta", workoutId: "livre", fase: "fase1", data: "2026-11-19",
    itens, plano: planoDaSessao(itens, { titulo: "Terraço", colecao: "pessoal" }), ...motor,
  });
}

describe("acrescentar um exercício ao treino livre em andamento", () => {
  it("mantém o prazo do descanso, a série gravada, as escolhas da sessão e o histórico dos blocos", () => {
    let sessao = definirEquipamentoDaSessao(livre([PRANCHA]), new Set(["tatame", "super-band"]));
    sessao = definirDescansoDoExercicioNaSessao(sessao, PRANCHA, 95);
    sessao = definirNota(sessao, 1, "Respirar.");
    const serie = sessao.blocos[0]!.series[0]!;
    sessao = atualizarSerie(sessao, 1, serie.id, { tempoS: 39 });
    sessao = marcarSerie(sessao, 1, serie.id, true, "2026-11-19T10:01:00.000Z");
    const pausa = sequenciaDoPlayer(sessao).find(p => p.tipo === "descanso")!;
    const player = estadoDoPasso(pausa, 1_000);
    const emDescanso = { ...sessao, player, descansoPadraoConhecidoS: 70 };
    const outra = acrescentarExercicioNaSessao(emDescanso, ROSCA, { conhecidos: new Set([ROSCA]) });

    expect(outra.blocos[0]).toBe(emDescanso.blocos[0]);
    expect(outra.blocos.map(b => [b.ordem, b.exercicioId])).toEqual([[1, PRANCHA], [2, ROSCA]]);
    expect(outra).toEqual({ ...emDescanso,
      blocos: [...emDescanso.blocos, outra.blocos[1]],
      plano: { ...emDescanso.plano,
        itens: [...emDescanso.plano!.itens, ...planoDaSessao(itensDeIds([ROSCA])).itens],
        ultima_inclusao: expect.objectContaining({ sessao_id: emDescanso.id, exercicio_id: ROSCA, ordem: 2, estado: "disponivel" }),
      },
    });
    expect(outra.player).toBe(player);
    const seq = sequenciaDoPlayer(outra);
    expect(seq[indiceDoEstado(seq, outra, player)]).toMatchObject({ chave: pausa.chave, segundos: 95 });
    expect(progressoDaSessao(outra).feitas).toBe(1);
    expect(emDescanso.blocos).toHaveLength(1);
  });

  it("monta o novo bloco como no início de um treino e começa todas as séries pendentes", () => {
    const estado = { ...estadoInicial(acharExercicio(SUPINO)), carga_atual_kg: 37.5 };
    const dados = {
      estados: { [SUPINO]: estado }, conhecidos: new Set([SUPINO]), anteriores: { [SUPINO]: [7, 6, 5] },
      recordes: { [SUPINO]: { carga_max_kg: 35.5, reps_max: 8, e1rm_epley: 41 } },
    };
    let id = 0;
    const novoId = () => String(++id);
    const inicio = livre([PRANCHA], { novoId });
    const a = acrescentarExercicioNaSessao(inicio, SUPINO, { ...dados, novoId });
    id = 0;
    const b = livre([PRANCHA, SUPINO], { ...dados, novoId });
    const novo = a.blocos[1]!;
    expect(novo).toEqual(b.blocos[1]);
    expect(novo.alvo.carga_kg).toBe(37.5);
    expect(novo.series.filter(s => s.tipo === "aquecimento")).toHaveLength(2);
    expect(novo.series.every(s => !s.concluida && s.registradaEm === null)).toBe(true);
    expect(new Set(a.blocos.flatMap(bloco => bloco.series.map(s => s.id))).size)
      .toBe(a.blocos.flatMap(bloco => bloco.series).length);
  });

  it("um aquecimento já programado conta mesmo se seu exercício tiver sido substituído", () => {
    const inicio = livre([SUPINO]);
    const trocada = substituirExercicio(inicio, 1, FLEXAO);
    const a = acrescentarExercicioNaSessao(trocada, AGACHAMENTO, {});
    expect(a.blocos[0]).toBe(trocada.blocos[0]);
    expect(a.blocos[1]!.series.every(s => s.tipo === "trabalho")).toBe(true);
  });

  it("retomar sem leitura daquele exercício não sobrescreve sua progressão", () => {
    const inicio = livre([PRANCHA]);
    for (const motor of [{}, { conhecidos: new Set([PRANCHA]), estadoConhecido: true }]) {
      let sessao = acrescentarExercicioNaSessao(inicio, SUPINO, motor);
      for (const s of sessao.blocos[1]!.series) sessao = marcarSerie(sessao, 2, s.id, true);
      expect(sessao.blocos[1]!.estadoConhecido).toBe(false);
      expect(blocoAvaliavel(sessao.blocos[1]!)).toBe(false);
    }
  });

  it("um segundo toque, os movimentos da mesma posição e ids inexistentes não criam outro bloco", () => {
    const sessao = substituirExercicio(substituirExercicio(livre([SUPINO]), 1, FLEXAO), 1, AGACHAMENTO);
    const comNovo = acrescentarExercicioNaSessao(sessao, ROSCA, {});
    expect(exerciciosOcupadosNaSessao(comNovo)).toEqual(new Set([SUPINO, FLEXAO, AGACHAMENTO, ROSCA]));
    const novoId = vi.fn();
    for (const id of [SUPINO, FLEXAO, AGACHAMENTO, ROSCA, "qualquer"]) {
      expect(acrescentarExercicioNaSessao(comNovo, id, { novoId })).toBe(comNovo);
    }
    expect(novoId).not.toHaveBeenCalled();
  });

  it("uma sessão antiga sem cópia do plano mantém sua prescrição ao ganhar um exercício", () => {
    const base = livre([PRANCHA]);
    const antiga = { ...base, plano: null };
    const atual = acrescentarExercicioNaSessao(antiga, ROSCA, {});
    expect(atual.blocos[0]).toBe(base.blocos[0]);
    expect(atual.plano?.itens).toEqual(planoDaSessao(itensDeIds([PRANCHA, ROSCA])).itens);
  });

  it("preserva treinos do programa, barra fixa e sessões encerradas", () => {
    const base = livre([PRANCHA]);
    for (const sessao of [
      { ...base, workoutId: "A1" as const }, { ...base, workoutId: "fixa" as const },
      { ...base, status: "concluida" as const }, { ...base, status: "abandonada" as const },
    ]) expect(acrescentarExercicioNaSessao(sessao, ROSCA, {})).toBe(sessao);
  });
});
