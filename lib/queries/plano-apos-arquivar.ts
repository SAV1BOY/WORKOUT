import { replaceEqualDeep } from "@tanstack/react-query";
import { estadosPorExercicio } from "@/lib/hoje";
import { itensDoPlano } from "@/lib/livre";
import { itemDaSessao, WORKOUT_BARRA_FIXA } from "@/lib/barra-fixa";
import { planoParaGravar, reconstruirSessao, type SessaoLocal } from "@/lib/sessao";
import type { LinhaEstadoExercicio, LinhaSerie, PlanoDaSessao } from "@/lib/types";

function objeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Uma edição feita depois de abrir a comparação continua sobre o plano escolhido. */
function aplicarEdicoesPosteriores(base: unknown, local: unknown, sincronizado: unknown): unknown {
  if (replaceEqualDeep(base, local) === base) return sincronizado;
  if (!objeto(base) || !objeto(local) || !objeto(sincronizado)) return local;
  const chaves = new Set([...Object.keys(sincronizado), ...Object.keys(base), ...Object.keys(local)]);
  return Object.fromEntries([...chaves].flatMap(k => {
    const v = aplicarEdicoesPosteriores(base[k], local[k], sincronizado[k]);
    return v === undefined ? [] : [[k, v]];
  }));
}

/** O arquivo já contém a sessão anterior. Somente as partes aceitas pela pessoa voltam ao player. */
export function planoAposArquivar(
  local: SessaoLocal, original: PlanoDaSessao | null, sincronizado: PlanoDaSessao | null,
  dados: { series: LinhaSerie[]; estados: LinhaEstadoExercicio[] }, posteriores: LinhaSerie[],
): SessaoLocal {
  const anterior = planoParaGravar(local);
  const plano = aplicarEdicoesPosteriores(original, anterior, sincronizado) as PlanoDaSessao | null;
  const porId = new Map(dados.series.filter(s => s.session_id === local.id && s.user_id === local.userId).map(s => [s.id, s]));
  for (const serie of posteriores) {
    const item = plano?.itens[serie.ordem_ex - 1];
    if (serie.session_id === local.id && serie.user_id === local.userId && (item?.exercicio_id === serie.exercise_id ||
      plano?.trocas?.[serie.ordem_ex]?.some(t => t.exercicio_id === serie.exercise_id))) porId.set(serie.id, serie);
  }
  const itens = local.workoutId === WORKOUT_BARRA_FIXA ? [itemDaSessao(local.semanaPlano ?? 1)] : itensDoPlano(plano) ?? undefined;
  const novo = reconstruirSessao({
    id: local.id, user_id: local.userId, data: local.data, workout_id: local.workoutId, fase: local.fase,
    status: local.status, iniciada_em: local.iniciadaEm, plano, ordem_execucao: plano?.ordem_execucao,
  }, [...porId.values()], { itens, opcoesMontagem: local.opcoesMontagem,
    estados: estadosPorExercicio(dados.estados.filter(e => e.user_id === local.userId)) });
  if (!novo) throw new Error("Não foi possível reabrir o plano sincronizado. Sua edição continua neste aparelho.");
  const blocos = novo.blocos.map(bloco => {
    const antigo = local.blocos[bloco.ordem - 1];
    if (!antigo || antigo.originalId !== bloco.originalId || antigo.exercicioId !== bloco.exercicioId) return bloco;
    const prescricao = anterior?.itens[bloco.ordem - 1];
    const trocas = anterior?.trocas?.[bloco.ordem];
    if (replaceEqualDeep(prescricao, plano?.itens[bloco.ordem - 1]) !== prescricao ||
      replaceEqualDeep(trocas, plano?.trocas?.[bloco.ordem]) !== trocas) return bloco;
    const series = antigo.series.map(s => {
      if (s.concluida || s.registradaEm) return s;
      const feita = bloco.series.find(r => r.concluida && r.setIndex === s.setIndex && r.tipo === s.tipo);
      return feita ?? s;
    });
    return { ...antigo, series };
  });
  const ordem = local.player?.ordem;
  const manterPasso = !ordem || (blocos[ordem - 1]?.originalId === local.blocos[ordem - 1]?.originalId &&
    blocos[ordem - 1]?.exercicioId === local.blocos[ordem - 1]?.exercicioId);
  return { ...local, plano, blocos, ordemExecucao: novo.ordemExecucao ?? local.ordemExecucao, player: manterPasso ? local.player : null };
}
