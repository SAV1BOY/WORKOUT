/**
 * Preferências do usuário (`profiles.prefs`, SPEC §3.9). Funções puras: leem e
 * escrevem o jsonb sem nunca perder as chaves que não conhecem — `prefs` também
 * guarda a marca do avanço de semana (§5.5), a meta de peso (§3.8) e o
 * adiamento da Fase 2 (§5.1).
 */
import type { BarraId, OpcoesMontagem } from "@/lib/montagem";
import {
  DESCANSO_MAX_S,
  DESCANSO_MIN_S,
  PREPARACAO_MAX_S,
  PREPARACAO_MIN_S,
  PREPARACAO_PADRAO_S,
} from "@/lib/player";
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

/**
 * As preferências de sim/não da §3.9, todas ligadas por padrão. `mostrar_raios`
 * entrou com a camada visual v2 (SPEC §13.7).
 */
export const CHAVES_LIGADAS = [
  "descanso_som",
  "descanso_vibra",
  "cardio_voz",
  "manter_tela",
  "mostrar_raios",
  "avancar_sozinho",
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

/* ---------------------------------------------- o player (SPEC §14.1) */

/**
 * Segundos da tela de preparação (`prefs.preparacao_s`). Zero é legítimo:
 * quem não quer a contagem começa direto no primeiro exercício.
 */
export function preparacaoS(prefs: Prefs | null | undefined): number {
  const bruto = prefs?.preparacao_s;
  if (typeof bruto !== "number" || !Number.isFinite(bruto)) {
    return PREPARACAO_PADRAO_S;
  }
  return Math.min(PREPARACAO_MAX_S, Math.max(PREPARACAO_MIN_S, Math.round(bruto)));
}

export function comPreparacaoS(
  prefs: Prefs | null | undefined,
  segundos: number | null,
): Prefs {
  const resto = { ...(prefs ?? {}) };
  if (segundos === null || !Number.isFinite(segundos)) {
    delete resto.preparacao_s;
    return resto;
  }
  return {
    ...resto,
    preparacao_s: Math.min(
      PREPARACAO_MAX_S,
      Math.max(PREPARACAO_MIN_S, Math.round(segundos)),
    ),
  };
}

/**
 * Descanso padrão (`prefs.descanso_padrao_s`). `null` = usar o `descanso_s` do
 * exercício, que é o que o guia manda (SPEC §14.4).
 */
export function descansoPadraoS(prefs: Prefs | null | undefined): number | null {
  const bruto = prefs?.descanso_padrao_s;
  if (typeof bruto !== "number" || !Number.isFinite(bruto) || bruto <= 0) return null;
  return Math.min(DESCANSO_MAX_S, Math.max(DESCANSO_MIN_S, Math.round(bruto)));
}

export function comDescansoPadraoS(
  prefs: Prefs | null | undefined,
  segundos: number | null,
): Prefs {
  const resto = { ...(prefs ?? {}) };
  if (segundos === null || !Number.isFinite(segundos) || segundos <= 0) {
    delete resto.descanso_padrao_s;
    return resto;
  }
  return {
    ...resto,
    descanso_padrao_s: Math.min(
      DESCANSO_MAX_S,
      Math.max(DESCANSO_MIN_S, Math.round(segundos)),
    ),
  };
}

/** O que `lib/player.ts` precisa saber do perfil. */
export function opcoesDoPlayer(prefs: Prefs | null | undefined): {
  preparacaoS: number;
  descansoPadraoS: number | null;
} {
  return {
    preparacaoS: preparacaoS(prefs),
    descansoPadraoS: descansoPadraoS(prefs),
  };
}

/* ------------------------------------------- "não gosto" (SPEC §14.1.2) */

/**
 * Os exercícios marcados com "não gosto" (`prefs.evitar_exercicios`). Vem do
 * jsonb do banco (e de um backup importado), então nada aqui confia no
 * formato: só sobram strings, sem repetição.
 */
export function evitarExercicios(prefs: Prefs | null | undefined): string[] {
  const bruto = prefs?.evitar_exercicios;
  if (!Array.isArray(bruto)) return [];
  const limpo = bruto.filter((v): v is string => typeof v === "string" && v !== "");
  return [...new Set(limpo)];
}

export function evitado(prefs: Prefs | null | undefined, id: string): boolean {
  return evitarExercicios(prefs).includes(id);
}

export function comEvitado(
  prefs: Prefs | null | undefined,
  id: string,
  evitar: boolean,
): Prefs {
  const atuais = evitarExercicios(prefs);
  const novos = evitar
    ? [...new Set([...atuais, id])]
    : atuais.filter((v) => v !== id);
  return { ...(prefs ?? {}), evitar_exercicios: novos };
}

export function semEvitados(prefs: Prefs | null | undefined): Prefs {
  return { ...(prefs ?? {}), evitar_exercicios: [] };
}

/**
 * A lista com os "não gosto" no fim, sem perder ninguém e sem embaralhar o
 * resto (SPEC §14.1.2). A ordem de quem fica é a que chegou.
 */
export function evitadosPorUltimo<T>(
  itens: readonly T[],
  id: (item: T) => string,
  prefs: Prefs | null | undefined,
): T[] {
  const evitar = new Set(evitarExercicios(prefs));
  if (evitar.size === 0) return [...itens];
  const fica = itens.filter((i) => !evitar.has(id(i)));
  const vai = itens.filter((i) => evitar.has(id(i)));
  return [...fica, ...vai];
}

/* --------------------------------------- guia de uso (SPEC §20.2) */

/**
 * `prefs.guia_visto`: a marca de que o guia de uso já foi reconhecido —
 * "Entendi, começar a treinar" ou "Pular por agora". Ausente = a conta é nova
 * e a aba Treino manda para o guia. Só `true` conta: o jsonb vem do banco (e
 * de um backup importado), então nada aqui confia no formato.
 */
export function guiaVisto(prefs: Prefs | null | undefined): boolean {
  return prefs?.guia_visto === true;
}

export function comGuiaVisto(prefs: Prefs | null | undefined): Prefs {
  return { ...(prefs ?? {}), guia_visto: true };
}
