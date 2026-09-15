/**
 * Sessão livre (SPEC §13.4 e §14.3): a sessão que não vem do `programa.json`.
 *
 * `sessions.workout_id = 'livre'` e a lista de exercícios/prescrições em
 * `sessions.plano` (jsonb) — é ela que refaz a sessão noutro aparelho, porque
 * um treino livre não está escrito em lugar nenhum. A mesma coluna guarda a
 * **ordem desta sessão** quando o Miguel reordena o treino do dia (§14.3).
 *
 * Funções puras: sem React, sem Supabase, sem Dexie. Todo conteúdo (séries,
 * reps, descanso) sai de `data/exercicios.json` por `lib/dados.ts`.
 */
import { acharExercicio, exercicioPorId } from "@/lib/dados";
import { formatarMinutos } from "@/lib/formato";
import { aplicarOrdem } from "@/lib/ordem";
import { prescricaoPadrao } from "@/lib/progressao";
import type { Exercicio, Implemento, PrescricaoTipo } from "@/lib/schemas";
import type { ItemDaSessao } from "@/lib/sessao";
import type { ItemDoPlano, PlanoDaSessao, WorkoutId } from "@/lib/types";

/** `sessions.workout_id` de uma sessão livre. */
export const WORKOUT_LIVRE = "livre" as const;

/** Quantos exercícios um "Começar" de coleção leva para a sessão (§14.3). */
export const EXERCICIOS_DA_SESSAO_LIVRE = 6;

export function ehSessaoLivre(id: WorkoutId | string | null | undefined): boolean {
  return id === WORKOUT_LIVRE;
}

/* ------------------------------------------------------------- itens */

/** O item da sessão a partir da prescrição padrão do catálogo. */
export function itemDoExercicio(exercicio: Exercicio): ItemDaSessao {
  return {
    exercicioId: exercicio.id,
    prescricao: prescricaoPadrao(exercicio),
    descansoS: exercicio.prescricao_padrao.descanso_s,
    descansoTexto: `${exercicio.prescricao_padrao.descanso_s} s`,
  };
}

/** Os itens de uma lista de ids (a ordem entra como veio). */
export function itensDeIds(ids: readonly string[]): ItemDaSessao[] {
  return ids.filter((id) => exercicioPorId.has(id)).map((id) => itemDoExercicio(acharExercicio(id)));
}

/** Os itens na ordem escolhida em "Editar" (SPEC §14.3); ninguém some. */
export function itensNaOrdem(
  itens: readonly ItemDaSessao[],
  ordem: readonly string[],
): ItemDaSessao[] {
  return aplicarOrdem(
    itens.map((i) => i.exercicioId),
    ordem,
  ).flatMap((id) => {
    const achado = itens.find((i) => i.exercicioId === id);
    return achado ? [achado] : [];
  });
}

/* -------------------------------------------------- plano (o jsonb) */

function itemParaPlano(item: ItemDaSessao): ItemDoPlano {
  return {
    exercicio_id: item.exercicioId,
    series: item.prescricao.series,
    tipo: item.prescricao.tipo,
    min: item.prescricao.min,
    max: item.prescricao.max,
    unilateral: item.prescricao.unilateral,
    descanso_s: item.descansoS,
    descanso_texto: item.descansoTexto,
  };
}

/** O que vai para `sessions.plano`. */
export function planoDaSessao(
  itens: readonly ItemDaSessao[],
  rotulos: { titulo?: string | null; colecao?: string | null } = {},
): PlanoDaSessao {
  return {
    titulo: rotulos.titulo ?? null,
    colecao: rotulos.colecao ?? null,
    itens: itens.map(itemParaPlano),
  };
}

const TIPOS: readonly PrescricaoTipo[] = [
  "reps",
  "tempo_s",
  "passos",
  "maximo",
  "ver_cardio_corda",
];

function numeroOuNulo(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/**
 * O caminho de volta: o jsonb do banco vira itens da sessão. O valor vem do
 * Supabase (e de um backup importado), então nada aqui confia no formato — um
 * item torto é descartado, e um plano sem nenhum item bom devolve `null`.
 */
export function itensDoPlano(plano: unknown): ItemDaSessao[] | null {
  if (typeof plano !== "object" || plano === null) return null;
  const bruto = (plano as { itens?: unknown }).itens;
  if (!Array.isArray(bruto)) return null;

  const itens: ItemDaSessao[] = [];
  for (const linha of bruto) {
    if (typeof linha !== "object" || linha === null) continue;
    const i = linha as Record<string, unknown>;
    const id = i.exercicio_id;
    if (typeof id !== "string" || !exercicioPorId.has(id)) continue;
    const exercicio = acharExercicio(id);
    const padrao = itemDoExercicio(exercicio);
    const tipo = TIPOS.find((t) => t === i.tipo) ?? padrao.prescricao.tipo;
    const series = numeroOuNulo(i.series);
    const descanso = numeroOuNulo(i.descanso_s);
    itens.push({
      exercicioId: id,
      prescricao: {
        series: series !== null && series >= 1 ? Math.round(series) : padrao.prescricao.series,
        tipo,
        min: numeroOuNulo(i.min),
        max: numeroOuNulo(i.max),
        unilateral:
          typeof i.unilateral === "boolean" ? i.unilateral : padrao.prescricao.unilateral,
      },
      descansoS: descanso !== null && descanso >= 0 ? Math.round(descanso) : padrao.descansoS,
      descansoTexto:
        typeof i.descanso_texto === "string" && i.descanso_texto !== ""
          ? i.descanso_texto
          : padrao.descansoTexto,
    });
  }
  return itens.length > 0 ? itens : null;
}

/** O rótulo guardado com o plano ("Core no tatame"), se houver. */
export function tituloDoPlano(plano: unknown): string | null {
  if (typeof plano !== "object" || plano === null) return null;
  const titulo = (plano as { titulo?: unknown }).titulo;
  return typeof titulo === "string" && titulo !== "" ? titulo : null;
}

/* ------------------------------------------- o que entra no circuito */

/**
 * Os implementos que rodam por tempo/reps sem carga (SPEC §13.6). Barra,
 * halteres e polia **nunca** entram: para eles vale o registro por série.
 */
export const IMPLEMENTOS_DE_CIRCUITO: readonly Implemento[] = [
  "peso_corporal",
  "corda",
  "band",
  "anilha",
];

export function ehDeCircuito(exercicio: Exercicio): boolean {
  return IMPLEMENTOS_DE_CIRCUITO.includes(exercicio.implemento);
}

/** A coleção inteira roda no modo circuito? (SPEC §13.6) */
export function podeCircuito(ids: readonly string[]): boolean {
  if (ids.length === 0) return false;
  return ids.every((id) => {
    const e = exercicioPorId.get(id);
    return e !== undefined && ehDeCircuito(e);
  });
}

/* ----------------------------------------------- estimativa de tempo */

/** Segundos por repetição numa série (a cadência de 3 s do guia). */
export const SEGUNDOS_POR_REP = 3;

/** A média da faixa de uma prescrição ("12–20" → 16). */
export function mediaDaFaixa(min: number | null, max: number | null): number | null {
  if (min !== null && max !== null) return (min + max) / 2;
  return max ?? min;
}

/**
 * Quanto tempo um exercício leva, em segundos (SPEC §14.3: `~M min`):
 * `séries × (reps médias × 3 s + descanso)`. Exercício por tempo usa o próprio
 * tempo no lugar das reps; quem não tem faixa (`máximo`, corda) cai na
 * cadência de uma série de 10 reps, que é o que o guia prescreve por lá.
 */
export const REPS_SEM_FAIXA = 10;

export function segundosDoExercicio(exercicio: Exercicio): number {
  const p = exercicio.prescricao_padrao;
  const series = p.series ?? 1;
  const media = mediaDaFaixa(p.min, p.max);
  const trabalho =
    p.tipo === "tempo_s"
      ? (media ?? REPS_SEM_FAIXA * SEGUNDOS_POR_REP)
      : (media ?? REPS_SEM_FAIXA) * SEGUNDOS_POR_REP;
  const porSerie = trabalho * (p.unilateral ? 2 : 1) + p.descanso_s;
  return Math.round(series * porSerie);
}

/** `~M min` de uma coleção: a soma dos exercícios, arredondada ao minuto. */
export function minutosDaColecao(exercicios: readonly Exercicio[]): number {
  const s = exercicios.reduce((total, e) => total + segundosDoExercicio(e), 0);
  return Math.max(1, Math.round(s / 60));
}

/** "6 exercícios · ~24 min" — o detalhe de uma coleção (SPEC §14.3). */
export function detalheDaColecao(exercicios: readonly Exercicio[]): string {
  const n = exercicios.length;
  const plural = n === 1 ? "exercício" : "exercícios";
  return `${n} ${plural} · ~${formatarMinutos(minutosDaColecao(exercicios))}`;
}
