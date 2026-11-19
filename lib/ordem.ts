/**
 * "Editar" na aba Treino (SPEC §14.3): reordenar os exercícios do dia.
 *
 * A ordem vale **só para a sessão que vai começar** — o programa não muda. Ela
 * fica no aparelho por conta, data e treino. Na criação da sessão, vai para
 * `sessions.plano`, que é o que refaz a sessão noutro aparelho.
 *
 * As operações com localStorage ficam no fim.
 */

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

/** A antiga chave única "treino-ordem" não identificava o dono do rascunho. */
export function chaveDaOrdemDoDia(conta: string, data: string, treinoId: string): string {
  return `treino-ordem:${encodeURIComponent(conta)}:${data}:${treinoId}`;
}

/** null é ausência confirmada; undefined indica que não foi possível ler a escolha. */
export function lerTextoDaOrdem(conta: string, data: string, treinoId: string): string | null | undefined {
  if (!conta) return undefined;
  try {
    return window.localStorage.getItem(chaveDaOrdemDoDia(conta, data, treinoId));
  } catch {
    return undefined;
  }
}

/** Quando a escrita falha, a lista usa esta edição enquanto a tela estiver aberta. */
export interface OrdemTemporaria {
  chave: string;
  ordem: string[];
  textoAnterior: string | null | undefined;
}

/** O evento nativo só chega às outras abas. A tela que criou a sessão também pode continuar montada. */
function avisarOrdemAlterada(chave: string): void {
  if (typeof window !== "undefined" && typeof StorageEvent !== "undefined") {
    window.dispatchEvent?.(new StorageEvent("storage", { key: chave }));
  }
}

export function guardarOrdemNoAparelho(
  conta: string,
  data: string,
  treinoId: string,
  ids: readonly string[],
  ordem: readonly string[],
): boolean {
  if (!conta) return false;
  const chave = chaveDaOrdemDoDia(conta, data, treinoId);
  try {
    const texto = escreverOrdem(data, treinoId, ids, ordem);
    if (texto === null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, texto);
  } catch {
    return false;
  }
  avisarOrdemAlterada(chave);
  return true;
}

/** Consome somente a versão lida antes da edição temporária ou no toque de começar. */
export function consumirOrdemDoAparelho(
  conta: string, data: string, treinoId: string, textoUsado: string | null | undefined,
): boolean {
  if (!conta) return false;
  const chave = chaveDaOrdemDoDia(conta, data, treinoId);
  let confirmada = textoUsado !== undefined;
  try {
    if (typeof textoUsado === "string" && window.localStorage.getItem(chave) === textoUsado) {
      window.localStorage.removeItem(chave);
    }
  } catch {
    confirmada = false;
  }
  avisarOrdemAlterada(chave);
  return confirmada;
}
