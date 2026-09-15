/**
 * As substituições escolhidas na aba Treino (SPEC §13.3): o ⇄ da lista do dia
 * abre os mesmos substitutos da sessão (§3.2) e guarda a escolha para a sessão
 * que vai começar. O par (data, treino) faz parte do registro: a escolha vale
 * para o treino de hoje e some sozinha no dia seguinte.
 *
 * Funções puras, testadas sem navegador; as duas pontas com `localStorage`
 * ficam no fim e nunca lançam (aba anônima, cota cheia).
 */

export const CHAVE_TROCAS = "treino-trocas";

export interface TrocasDoDia {
  data: string;
  treinoId: string;
  /** exercício do programa → substituto escolhido. */
  trocas: Record<string, string>;
}

function ehMapaDeTexto(valor: unknown): valor is Record<string, string> {
  if (typeof valor !== "object" || valor === null) return false;
  return Object.values(valor as Record<string, unknown>).every(
    (v) => typeof v === "string",
  );
}

/**
 * Lê o que estava guardado. Devolve `{}` quando não é do dia/treino pedidos ou
 * quando o texto não é o que este app escreveu (o storage é do usuário).
 */
export function lerTrocas(
  bruto: string | null | undefined,
  data: string,
  treinoId: string,
): Record<string, string> {
  if (!bruto) return {};
  let lido: unknown;
  try {
    lido = JSON.parse(bruto);
  } catch {
    return {};
  }
  if (typeof lido !== "object" || lido === null) return {};
  const guardado = lido as Partial<TrocasDoDia>;
  if (guardado.data !== data || guardado.treinoId !== treinoId) return {};
  if (!ehMapaDeTexto(guardado.trocas)) return {};
  return { ...guardado.trocas };
}

/** O texto a guardar. `null` quando não sobrou troca nenhuma. */
export function escreverTrocas(
  data: string,
  treinoId: string,
  trocas: Record<string, string>,
): string | null {
  const limpo: Record<string, string> = {};
  for (const [de, para] of Object.entries(trocas)) {
    if (typeof para === "string" && para !== "" && para !== de) limpo[de] = para;
  }
  if (Object.keys(limpo).length === 0) return null;
  return JSON.stringify({ data, treinoId, trocas: limpo } satisfies TrocasDoDia);
}

/** Aplica as trocas a uma lista de exercícios do treino (a lista da tela). */
export function comTrocas(
  ids: readonly string[],
  trocas: Record<string, string>,
): string[] {
  return ids.map((id) => trocas[id] ?? id);
}

/* ------------------------------------------------------- ponte com o navegador */

export function lerTrocasDoAparelho(data: string, treinoId: string): Record<string, string> {
  try {
    return lerTrocas(window.localStorage.getItem(CHAVE_TROCAS), data, treinoId);
  } catch {
    return {};
  }
}

export function guardarTrocasNoAparelho(
  data: string,
  treinoId: string,
  trocas: Record<string, string>,
): void {
  try {
    const texto = escreverTrocas(data, treinoId, trocas);
    if (texto === null) window.localStorage.removeItem(CHAVE_TROCAS);
    else window.localStorage.setItem(CHAVE_TROCAS, texto);
  } catch {
    /* sem storage a escolha vale só nesta tela */
  }
}

export function limparTrocasDoAparelho(): void {
  try {
    window.localStorage.removeItem(CHAVE_TROCAS);
  } catch {
    /* nada a limpar */
  }
}
