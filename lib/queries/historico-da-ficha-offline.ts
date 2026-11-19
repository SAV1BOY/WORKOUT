import { chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";
import { lerCache } from "@/lib/db";
import { vinculoDoLoginAtual } from "@/lib/player-sem-rede";
import type { SerieBruta, SessaoBruta } from "@/lib/progresso";
import { combinarFechamentos, fontesDoAparelho } from "@/lib/queries/fechamentos-do-player";

/** Uma aba em Mais pode persistir seu cache sem as consultas auxiliares da ficha. */
export async function lerHistoricoDaFichaOffline(exercicioId: string, linhas?: readonly SerieBruta[], lidoEm = 0) {
  const vinculo = await vinculoDoLoginAtual();
  if (!vinculo) return null;
  const { conta } = vinculo;
  const guardadas = await lerCache<SessaoBruta[]>(chaveDoHistoricoNoDisco(conta));
  const sessoes = (guardadas ?? []).filter(s => s.user_id === conta);
  const verificadas = new Set(sessoes.map(s => s.id));
  const daFicha = (linhas ?? []).filter(s => s.exercise_id === exercicioId &&
    (s.user_id === conta || (s.user_id === undefined && verificadas.has(s.session_id))));
  const base = { linhas: daFicha, atualizadoEm: daFicha.length ? lidoEm : 0 };
  const fontes = await fontesDoAparelho(conta, new Set([exercicioId]), base.atualizadoEm);
  const series: SerieBruta[] = combinarFechamentos(exercicioId, base, fontes).map(s => ({
    ...s, reps_lado2: s.reps_lado2 ?? null, tempo_s_lado2: s.tempo_s_lado2 ?? null,
    passos: s.passos ?? null, assistencia: s.assistencia ?? null,
  }));
  if ((await vinculoDoLoginAtual())?.conta !== conta) return null;
  return { conta, sessoes, series };
}
