/**
 * Meta semanal e sequências (SPEC §13.3 e §13.5). Funções puras: sem React,
 * sem Supabase. A meta padrão sai do `programa.json` (as sessões de força e de
 * cardio da semana da fase), nunca de um número escrito aqui.
 */
import { addDays, differenceInCalendarDays } from "date-fns";
import { inicioDaSemana, iso, paraData, type Data } from "@/lib/calendario";
import { acharFase } from "@/lib/dados";
import type { FaseId } from "@/lib/schemas";
import type { LinhaSessao, LinhaSessaoCardio, Prefs } from "@/lib/types";

export type SessaoContada = Pick<LinhaSessao, "data" | "status">;
export type CardioContado = Pick<LinhaSessaoCardio, "data" | "concluida">;

/** Quantas semanas para trás as sequências olham (teto de segurança). */
export const SEMANAS_OLHADAS = 104;
/** Quantos dias para trás a sequência de dias olha. */
export const DIAS_OLHADOS = 400;

/**
 * A meta padrão da fase (SPEC §13.3): as sessões de força mais as de cardio da
 * semana do programa — 3 + 2 na Fase 1, 4 + 2 na Fase 2.
 */
export function metaSemanalPadrao(fase: FaseId): number {
  const semana = acharFase(fase).semana;
  return semana.filter((d) => d.tipo === "forca" || d.tipo === "cardio").length;
}

/** A meta em uso: `prefs.meta_semanal` quando for inteiro ≥ 1, senão a da fase. */
export function metaSemanal(
  prefs: Prefs | null | undefined,
  fase: FaseId,
): number {
  const bruto = prefs?.meta_semanal;
  if (typeof bruto === "number" && Number.isInteger(bruto) && bruto >= 1) {
    return bruto;
  }
  return metaSemanalPadrao(fase);
}

/** Grava a meta semanal (ou volta ao padrão da fase com `null`). */
export function comMetaSemanal(
  prefs: Prefs | null | undefined,
  meta: number | null,
): Prefs {
  const resto = { ...(prefs ?? {}) };
  if (meta === null || !Number.isInteger(meta) || meta < 1) {
    delete resto.meta_semanal;
    return resto;
  }
  return { ...resto, meta_semanal: meta };
}

/* ------------------------------------------------------- feitos na semana */

function concluidas(sessoes: SessaoContada[], de: string, ate: string): number {
  return sessoes.filter(
    (s) => s.status === "concluida" && s.data >= de && s.data <= ate,
  ).length;
}

function cardiosFeitos(cardios: CardioContado[], de: string, ate: string): number {
  return cardios.filter((c) => c.concluida && c.data >= de && c.data <= ate).length;
}

export interface EntradaDaSemana {
  sessoes?: SessaoContada[];
  cardios?: CardioContado[];
  de: string;
  ate: string;
}

/**
 * Sessões cumpridas numa semana civil: força concluída + cardio concluído
 * (SPEC §13.3, "Meta semanal: feitos/meta").
 */
export function feitosNaSemana({
  sessoes = [],
  cardios = [],
  de,
  ate,
}: EntradaDaSemana): number {
  return concluidas(sessoes, de, ate) + cardiosFeitos(cardios, de, ate);
}

export interface ProgressoDaMeta {
  feitos: number;
  meta: number;
  cumprida: boolean;
  /** "2/5" */
  texto: string;
}

export function progressoDaMeta(
  entrada: EntradaDaSemana & { meta: number },
): ProgressoDaMeta {
  const feitos = feitosNaSemana(entrada);
  return {
    feitos,
    meta: entrada.meta,
    cumprida: feitos >= entrada.meta,
    texto: `${feitos}/${entrada.meta}`,
  };
}

/* ----------------------------------------------------- sequências (§13.3) */

function limitesDaSemana(inicio: Date): { de: string; ate: string } {
  return { de: iso(inicio), ate: iso(addDays(inicio, 6)) };
}

export interface EntradaSequencia {
  sessoes?: SessaoContada[];
  cardios?: CardioContado[];
  hoje: Data;
  meta: number;
}

/**
 * Semanas seguidas com a meta cumprida (SPEC §13.3). A semana em curso só
 * entra quando já bateu a meta — enquanto não bate, ela não quebra a sequência
 * das semanas fechadas atrás dela.
 */
export function sequenciaDeSemanas({
  sessoes = [],
  cardios = [],
  hoje,
  meta,
}: EntradaSequencia): number {
  if (meta < 1) return 0;
  let cursor = inicioDaSemana(paraData(hoje));
  let n = 0;

  for (let i = 0; i < SEMANAS_OLHADAS; i += 1) {
    const { de, ate } = limitesDaSemana(cursor);
    const cumprida = feitosNaSemana({ sessoes, cardios, de, ate }) >= meta;
    if (cumprida) n += 1;
    else if (i > 0) break;
    cursor = addDays(cursor, -7);
  }

  return n;
}

export interface EntradaSequenciaDeDias {
  sessoes?: SessaoContada[];
  cardios?: CardioContado[];
  hoje: Data;
}

/**
 * Dias seguidos com alguma sessão concluída (SPEC §13.5). O dia de hoje ainda
 * sem treino não zera a sequência de ontem para trás.
 */
export function sequenciaDeDias({
  sessoes = [],
  cardios = [],
  hoje,
}: EntradaSequenciaDeDias): number {
  const dias = new Set<string>();
  for (const s of sessoes) if (s.status === "concluida") dias.add(s.data);
  for (const c of cardios) if (c.concluida) dias.add(c.data);
  if (dias.size === 0) return 0;

  const inicio = paraData(hoje);
  let n = 0;

  for (let i = 0; i < DIAS_OLHADOS; i += 1) {
    const data = iso(addDays(inicio, -i));
    if (dias.has(data)) n += 1;
    else if (i > 0) break;
  }

  return n;
}

/** Há quantos dias foi a última sessão (para a saudação). `null` se nunca. */
export function diasDesdeAUltimaSessao(
  entrada: EntradaSequenciaDeDias,
): number | null {
  const datas = [
    ...(entrada.sessoes ?? []).filter((s) => s.status === "concluida").map((s) => s.data),
    ...(entrada.cardios ?? []).filter((c) => c.concluida).map((c) => c.data),
  ].sort();
  const ultima = datas[datas.length - 1];
  if (!ultima) return null;
  return Math.max(0, differenceInCalendarDays(paraData(entrada.hoje), paraData(ultima)));
}
