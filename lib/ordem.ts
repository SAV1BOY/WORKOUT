/**
 * "Editar" na aba Treino (SPEC §14.3): reordenar os exercícios do dia.
 *
 * A ordem vale **só para a sessão que vai começar** — o programa não muda. Ela
 * fica no aparelho enquanto o Miguel não toca em "Começar treino" (o mesmo
 * par (data, treino) das trocas, §13.3) e, na criação da sessão, vai para
 * `sessions.plano`, que é o que refaz a sessão noutro aparelho.
 *
 * Funções puras, testadas sem navegador; as duas pontas com `localStorage`
 * ficam no fim e nunca lançam.
 */

export const CHAVE_ORDEM = "treino-ordem";

export interface OrdemDoDia {
  data: string;
  treinoId: string;
  /** Os ids dos exercícios do programa, na ordem escolhida. */
  ordem: string[];
}

/* -------------------------------------------------------- mover */

/** Move o item de `de` para `para`, sem perder ninguém. Fora da faixa, não mexe. */
export function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  const saida = [...lista];
  if (de < 0 || de >= saida.length || para < 0 || para >= saida.length || de === para) {
    return saida;
  }
  const [item] = saida.splice(de, 1);
  if (item === undefined) return [...lista];
  saida.splice(para, 0, item);
  return saida;
}

export function subir<T>(lista: readonly T[], i: number): T[] {
  return mover(lista, i, i - 1);
}

export function descer<T>(lista: readonly T[], i: number): T[] {
  return mover(lista, i, i + 1);
}

/**
 * Aplica a ordem guardada a uma lista de ids: quem está na ordem vem primeiro,
 * na ordem escolhida; quem não está (exercício novo no programa, troca feita
 * depois) fica no fim, na ordem do programa. Nada some, nada se repete.
 */
export function aplicarOrdem(
  ids: readonly string[],
  ordem: readonly string[],
): string[] {
  if (ordem.length === 0) return [...ids];
  const restantes = new Set(ids);
  const saida: string[] = [];
  for (const id of ordem) {
    if (restantes.delete(id)) saida.push(id);
  }
  for (const id of ids) if (restantes.has(id)) saida.push(id);
  return saida;
}

/** A ordem escolhida é a do programa? (aí não há nada a guardar) */
export function ehAOrdemDoPrograma(
  ids: readonly string[],
  ordem: readonly string[],
): boolean {
  const aplicada = aplicarOrdem(ids, ordem);
  return aplicada.length === ids.length && aplicada.every((id, i) => id === ids[i]);
}

/* ------------------------------------------------------ storage */

export function lerOrdem(
  bruto: string | null | undefined,
  data: string,
  treinoId: string,
): string[] {
  if (!bruto) return [];
  let lido: unknown;
  try {
    lido = JSON.parse(bruto);
  } catch {
    return [];
  }
  if (typeof lido !== "object" || lido === null) return [];
  const guardado = lido as Partial<OrdemDoDia>;
  if (guardado.data !== data || guardado.treinoId !== treinoId) return [];
  if (!Array.isArray(guardado.ordem)) return [];
  const limpo = guardado.ordem.filter((v): v is string => typeof v === "string" && v !== "");
  return [...new Set(limpo)];
}

/** O texto a guardar. `null` quando a ordem é a do programa. */
export function escreverOrdem(
  data: string,
  treinoId: string,
  ids: readonly string[],
  ordem: readonly string[],
): string | null {
  if (ordem.length === 0 || ehAOrdemDoPrograma(ids, ordem)) return null;
  return JSON.stringify({
    data,
    treinoId,
    ordem: aplicarOrdem(ids, ordem),
  } satisfies OrdemDoDia);
}

/* ---------------------------------------------- ponte com o navegador */

export function lerOrdemDoAparelho(data: string, treinoId: string): string[] {
  try {
    return lerOrdem(window.localStorage.getItem(CHAVE_ORDEM), data, treinoId);
  } catch {
    return [];
  }
}

export function guardarOrdemNoAparelho(
  data: string,
  treinoId: string,
  ids: readonly string[],
  ordem: readonly string[],
): void {
  try {
    const texto = escreverOrdem(data, treinoId, ids, ordem);
    if (texto === null) window.localStorage.removeItem(CHAVE_ORDEM);
    else window.localStorage.setItem(CHAVE_ORDEM, texto);
  } catch {
    /* sem storage a ordem vale só nesta tela */
  }
}

export function limparOrdemDoAparelho(): void {
  try {
    window.localStorage.removeItem(CHAVE_ORDEM);
  } catch {
    /* nada a limpar */
  }
}
