import { describe, expect, it } from "vitest";
import { lerBackup, linhasParaImportar, montarBackup, textoDoBackup } from "@/lib/backup";
import { equipamentoDisponivel } from "@/lib/dados";
import { equipamentoDaSessao } from "@/lib/equipamento-da-sessao";
import { itensDeIds, itensDoPlano, planoDaSessao } from "@/lib/livre";
import { montarRepeticaoDoTreinoLivre } from "@/lib/repetir-treino-livre";
import {
  acrescentarExercicioNaSessao, atualizarSerie, concluirSessao, definirDescansoDoExercicioNaSessao,
  definirEquipamentoDaSessao, definirNota, escritaDaSessao, escritasDasSeriesFeitas, marcarSerie,
  montarSessaoAvulsa, reconstruirSessao, substituirExercicio,
} from "@/lib/sessao";
import type { LinhaSerie, LinhaSessao } from "@/lib/types";

const supino = "supino-reto-com-barra";
const flexao = "flexao-de-braco";
const rosca = "rosca-com-elastico";
const rotulos = { titulo: "Treino de quinta", colecao: "Peito e braços" };
const entrada = { id: "treino-em-andamento", userId: "atleta", data: "2026-11-19", workoutId: "livre", fase: "fase1" } as const;

function treinoComAcrescimo() {
  const itens = itensDeIds([supino]);
  let sessao = montarSessaoAvulsa({ ...entrada, itens, plano: planoDaSessao(itens, rotulos) });
  const serieDoSupino = sessao.blocos[0]!.series.find(s => s.tipo === "trabalho")!.id;
  sessao = atualizarSerie(sessao, 1, serieDoSupino, { cargaKg: 27.5, reps: 8 });
  sessao = marcarSerie(sessao, 1, serieDoSupino, true);
  sessao = definirNota(sessao, 1, "Ajustei o banco");
  sessao = substituirExercicio(sessao, 1, flexao);
  sessao = definirNota(sessao, 1, "Mãos mais afastadas");
  sessao = definirDescansoDoExercicioNaSessao(sessao, flexao, 85);
  sessao = definirEquipamentoDaSessao(sessao, new Set(["tatame", "super-band"]));
  const registrosAnteriores = escritasDasSeriesFeitas(sessao);
  const acrescida = acrescentarExercicioNaSessao(sessao, rosca, {});
  return { acrescida, registrosAnteriores };
}

describe("histórico de uma sessão livre ampliada", () => {
  it("reconstitui pelo backup as duas versões do exercício e o bloco acrescentado ainda sem séries feitas", () => {
    const { acrescida, registrosAnteriores } = treinoComAcrescimo();
    const backup = montarBackup({ userId: entrada.userId, exportadoEm: "2026-11-19T12:00:00Z", tabelas: {
      sessions: [escritaDaSessao(acrescida).linha!],
      session_sets: escritasDasSeriesFeitas(acrescida).map(e => e.linha!),
    } });
    const arquivo = lerBackup(textoDoBackup(backup));
    const importacao = linhasParaImportar(arquivo, entrada.userId);
    const linha = importacao.find(e => e.tabela === "sessions")!.linhas[0] as unknown as LinhaSessao;
    const series = importacao.find(e => e.tabela === "session_sets")!.linhas as unknown as LinhaSerie[];
    const reaberta = reconstruirSessao(linha, series, { itens: itensDoPlano(linha.plano)! })!;

    expect(reaberta.blocos.map(b => [b.ordem, b.originalId, b.exercicioId])).toEqual([
      [1, supino, flexao], [2, rosca, rosca],
    ]);
    expect(reaberta.blocos[0]!.nota).toBe("Mãos mais afastadas");
    expect(reaberta.blocos[0]!.trocados?.[0]?.nota).toBe("Ajustei o banco");
    expect(reaberta.plano).toMatchObject({ ...rotulos, descansos_por_exercicio: { [flexao]: 85 } });
    expect(equipamentoDaSessao(reaberta)).toEqual(new Set(["tatame", "super-band"]));
    expect(reaberta.blocos[1]!.series.every(s => !s.concluida)).toBe(true);
    expect(escritasDasSeriesFeitas(reaberta)).toEqual(registrosAnteriores);
  });

  it("repete o movimento ativo e o novo na ordem confirmada ao concluir, preservando a série antes da troca", () => {
    const { acrescida, registrosAnteriores } = treinoComAcrescimo();
    const serieDaRosca = acrescida.blocos[1]!.series[0]!.id;
    const comRegistro = marcarSerie(acrescida, 2, serieDaRosca, true);
    const fim = concluirSessao({ sessao: { ...comRegistro, status: "concluida" } });
    const linha = fim.escritas.find(e => e.tabela === "sessions")!.linha as unknown as LinhaSessao;
    const repeticao = montarRepeticaoDoTreinoLivre(linha)!;
    expect(repeticao).toEqual({ ...rotulos, itens: itensDeIds([flexao, rosca]) });

    const nova = montarSessaoAvulsa({
      ...entrada, id: "outro-treino", itens: repeticao.itens, plano: planoDaSessao(repeticao.itens, repeticao),
    });
    expect(nova.blocos.every(b => !b.nota && b.series.every(s => !s.concluida))).toBe(true);
    expect(nova.plano).not.toHaveProperty("descansos_por_exercicio");
    expect(equipamentoDaSessao(nova)).toEqual(equipamentoDisponivel());
    const registros = escritasDasSeriesFeitas(comRegistro);
    expect(registros).toHaveLength(2);
    expect(registros).toContainEqual(registrosAnteriores[0]);
    expect(registros.find(e => e.linha?.id === serieDaRosca)?.linha).toMatchObject({
      session_id: entrada.id, exercise_id: rosca, ordem_ex: 2, concluida: true,
    });
  });
});
