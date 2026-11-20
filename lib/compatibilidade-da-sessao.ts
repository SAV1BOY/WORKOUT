import { replaceEqualDeep } from "@tanstack/react-query";
import { itemDaSessao, WORKOUT_BARRA_FIXA } from "@/lib/barra-fixa";
import { ehTreinoDoPrograma, exercicioPorId } from "@/lib/dados";
import { itensDoPlano } from "@/lib/livre";
import { itensDoTreino, planoParaGravar, type SessaoLocal } from "@/lib/sessao";
import type { LinhaSerie, LinhaSessao } from "@/lib/types";

export const AVISO_CATALOGO_DA_SESSAO = "Atualize o app para continuar este treino";

function registro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function idDesconhecido(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && !exercicioPorId.has(id);
}

function idsDoPlano(plano: unknown): unknown[] {
  if (!registro(plano)) return [];
  const itens: unknown[] = Array.isArray(plano.itens) ? [...plano.itens] : [];
  // Uma inclusão desfeita guarda o ID apenas para reconhecer a remoção entre abas.
  const ultima = plano.ultima_inclusao;
  if (registro(ultima) && (ultima.estado === "disponivel" || ultima.estado === "iniciada")) itens.push(ultima);
  if (registro(plano.trocas)) {
    for (const grupo of Object.values(plano.trocas)) if (Array.isArray(grupo)) itens.push(...grupo);
  }
  return itens.map(item => registro(item) ? item.exercicio_id : null);
}

/** Lê os itens originais e todo o histórico das trocas antes de qualquer projeção do plano. */
export function planoComExercicioDesconhecido(plano: unknown): boolean {
  return idsDoPlano(plano).some(idDesconhecido);
}

function blocoDesconhecido(bloco: unknown): boolean {
  return registro(bloco) && (idDesconhecido(bloco.originalId) || idDesconhecido(bloco.exercicioId));
}

/** O bloco no aparelho já pode ter sido trocado sem que o plano local espelhe a troca. */
export function sessaoLocalComExercicioDesconhecido(sessao: unknown): boolean {
  if (!registro(sessao)) return false;
  if (planoComExercicioDesconhecido(sessao.plano)) return true;
  return Array.isArray(sessao.blocos) && sessao.blocos.some(bloco =>
    blocoDesconhecido(bloco) ||
    (registro(bloco) && Array.isArray(bloco.trocados) && bloco.trocados.some(blocoDesconhecido)),
  );
}

/** Nas sessões antigas, uma série pode ser o único registro de uma substituição. */
export function idsDaSessaoRemota(
  plano: unknown, series: readonly unknown[] | null | undefined, conta: string, sessaoId: string,
): string[] {
  const ids = new Set(idsDoPlano(plano).filter((id): id is string => typeof id === "string" && id !== ""));
  for (const serie of series ?? []) {
    if (registro(serie) && serie.user_id === conta && serie.session_id === sessaoId && typeof serie.exercise_id === "string" && serie.exercise_id !== "") {
      ids.add(serie.exercise_id);
    }
  }
  return [...ids];
}

export function seriesComExercicioDesconhecido(series: readonly unknown[] | null | undefined, conta: string, sessaoId: string) {
  return idsDaSessaoRemota(null, series, conta, sessaoId).some(idDesconhecido);
}

/** Uma projeção antiga pode ter conservado o JSON, mas deslocado ou omitido os blocos correspondentes. */
export function sessaoLocalRepresentaServidor(
  local: SessaoLocal, linha: Pick<LinhaSessao, "id" | "user_id" | "workout_id" | "plano" | "ordem_execucao">,
  series: readonly LinhaSerie[],
): boolean {
  if (local.id !== linha.id || local.userId !== linha.user_id || local.workoutId !== linha.workout_id) return false;
  const planoLocal = planoParaGravar(local);
  if (replaceEqualDeep(planoLocal, linha.plano) !== planoLocal) return false;
  const ordem = linha.ordem_execucao ?? linha.plano?.ordem_execucao;
  if (ordem && replaceEqualDeep(ordem, local.ordemExecucao ?? local.plano?.ordem_execucao) !== ordem) return false;
  if (planoComExercicioDesconhecido(linha.plano)) return false;
  const itens = local.workoutId === WORKOUT_BARRA_FIXA ? [itemDaSessao(local.semanaPlano ?? 1)] :
    itensDoPlano(linha.plano) ?? (ehTreinoDoPrograma(local.workoutId) ? itensDoTreino(local.workoutId) : []);
  const originais = itens.map(item => item.exercicioId);
  if (!originais.length || originais.length !== local.blocos.length || originais.some((id, i) => {
    const bloco = local.blocos[i];
    const ativo = linha.plano?.trocas?.[i + 1]?.[0]?.exercicio_id;
    return bloco?.ordem !== i + 1 || bloco.originalId !== id || (ativo && bloco.exercicioId !== ativo);
  })) return false;
  return series.every(serie => {
    if (serie.user_id !== local.userId || serie.session_id !== local.id) return false;
    const bloco = local.blocos[serie.ordem_ex - 1];
    if (!bloco) return false;
    const registro = [bloco, ...(bloco.trocados ?? [])].find(b => b.exercicioId === serie.exercise_id);
    return registro?.series.some(s => s.id === serie.id && s.setIndex === serie.set_index && s.tipo === serie.tipo &&
      s.concluida === serie.concluida && s.cargaKg === serie.carga_kg && s.reps === serie.reps && s.repsLado2 === serie.reps_lado2 &&
      s.tempoS === serie.tempo_s && s.tempoSLado2 === serie.tempo_s_lado2 && s.passos === serie.passos && s.assistencia === serie.assistencia) ?? false;
  });
}
