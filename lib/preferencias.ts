/**
 * Preferências do usuário (`profiles.prefs`, SPEC §3.9). Funções puras: leem e
 * escrevem o jsonb sem nunca perder as chaves que não conhecem — `prefs` também
 * guarda a marca do avanço de semana (§5.5), a meta de peso (§3.8) e o
 * adiamento da Fase 2 (§5.1).
 */
import type { BarraId, OpcoesMontagem } from "@/lib/montagem";
import type { Prefs } from "@/lib/types";

/* --------------------------------------------------------------- tema */

export type TemaPref = "auto" | "claro" | "escuro";

export const TEMAS: { valor: TemaPref; rotulo: string }[] = [
  { valor: "claro", rotulo: "Claro" },
  { valor: "escuro", rotulo: "Escuro" },
  { valor: "auto", rotulo: "Automático" },
];

export function temaDasPrefs(prefs: Prefs | null | undefined): TemaPref {
  const t = prefs?.tema;
  return t === "claro" || t === "escuro" || t === "auto" ? t : "auto";
}

/** O nome que o `next-themes` usa. */
export function temaDoNextThemes(tema: TemaPref): "light" | "dark" | "system" {
  if (tema === "claro") return "light";
  if (tema === "escuro") return "dark";
  return "system";
}

/** O caminho de volta: o que o `next-themes` guardou vira preferência. */
export function temaDoTema(valor: string | undefined): TemaPref {
  if (valor === "light") return "claro";
  if (valor === "dark") return "escuro";
  return "auto";
}

/* ----------------------------------------------------- liga/desliga */

/** As preferências de sim/não da §3.9, todas ligadas por padrão. */
export const CHAVES_LIGADAS = [
  "descanso_som",
  "descanso_vibra",
  "cardio_voz",
  "manter_tela",
] as const;

export type ChaveLigada = (typeof CHAVES_LIGADAS)[number];

/** Ausente = ligada (é o default do schema e o que as telas já assumem). */
export function ligado(
  prefs: Prefs | null | undefined,
  chave: ChaveLigada,
): boolean {
  return prefs?.[chave] !== false;
}

export function comLigado(
  prefs: Prefs | null | undefined,
  chave: ChaveLigada,
  valor: boolean,
): Prefs {
  return { ...(prefs ?? {}), [chave]: valor };
}

export function comTema(prefs: Prefs | null | undefined, tema: TemaPref): Prefs {
  return { ...(prefs ?? {}), tema };
}

/* ------------------------------------------- pesos das barras (§3.9) */

/** Peso plausível de uma barra do terraço, em kg. */
export const PESO_BARRA_MIN = 0.5;
export const PESO_BARRA_MAX = 30;

export function pesoDeBarraValido(kg: number): boolean {
  return (
    Number.isFinite(kg) && kg >= PESO_BARRA_MIN && kg <= PESO_BARRA_MAX
  );
}

const IDS_DE_BARRA: BarraId[] = [
  "barra-macica",
  "barra-w",
  "barra-reta-oca",
  "halteres",
];

/**
 * `prefs.pesos_barras` já limpo: só ids de barra conhecidos e só pesos
 * plausíveis. O jsonb vem do banco (e de um backup importado), então nada aqui
 * pode confiar no formato.
 */
export function pesosDasBarras(
  prefs: Prefs | null | undefined,
): Partial<Record<BarraId, number>> {
  const bruto = prefs?.pesos_barras;
  if (typeof bruto !== "object" || bruto === null) return {};
  const mapa = bruto as Record<string, unknown>;
  const limpo: Partial<Record<BarraId, number>> = {};
  for (const id of IDS_DE_BARRA) {
    const valor = mapa[id];
    if (typeof valor === "number" && pesoDeBarraValido(valor)) {
      limpo[id] = valor;
    }
  }
  return limpo;
}

/** O que `lib/montagem.ts` e o motor precisam saber do perfil (SPEC §6.4). */
export function opcoesDeMontagem(
  prefs: Prefs | null | undefined,
): OpcoesMontagem {
  const pesos = pesosDasBarras(prefs);
  return Object.keys(pesos).length > 0 ? { pesosBarras: pesos } : {};
}

/** Grava (ou apaga, com `null`) o peso de uma barra medido na balança. */
export function comPesoDaBarra(
  prefs: Prefs | null | undefined,
  id: BarraId,
  kg: number | null,
): Prefs {
  const pesos = { ...pesosDasBarras(prefs) };
  if (kg === null || !pesoDeBarraValido(kg)) delete pesos[id];
  else pesos[id] = kg;
  return { ...(prefs ?? {}), pesos_barras: pesos };
}
