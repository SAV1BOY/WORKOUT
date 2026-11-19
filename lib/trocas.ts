/**
 * As substituições escolhidas na aba Treino (SPEC §13.3): o ⇄ da lista do dia
 * abre os mesmos substitutos da sessão (§3.2) e guarda a escolha para a sessão
 * que vai começar. O rascunho pertence à conta, ao dia e ao treino. Depois
 * de consumido, voltam a valer as escolhas lembradas para a próxima sessão.
 *
 * Funções puras, testadas sem navegador; as duas pontas com `localStorage`
 * ficam no fim e nunca lançam (aba anônima, cota cheia).
 */

import { alternativasPara } from "@/lib/alternativas";
import { exercicioPorId, programa } from "@/lib/dados";
import type { TreinoId } from "@/lib/schemas";

const treinos = new Map<string, string[]>(Object.values(programa.treinos).map((treino) => [
  treino.id, treino.exercicios.map((item) => item.exercicio_id),
]));
const compativeis = new Map<string, Set<string>>();

export function trocaDoProgramaValida(treinoId: string, originalId: string, substitutoId: string): boolean {
  if (originalId === substitutoId || !treinos.get(treinoId)?.includes(originalId)) return false;
  let opcoes = compativeis.get(originalId);
  if (!opcoes) {
    opcoes = new Set(alternativasPara(originalId).map((alternativa) => alternativa.id));
    compativeis.set(originalId, opcoes);
  }
  return opcoes.has(substitutoId);
}

/** A escolha explícita do dia prevalece, inclusive quando pede o próprio original. */
export function resolverTrocasDoTreino(
  treinoId: TreinoId,
  lembradas: Readonly<Record<string, string>> = {},
  soHoje: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const originais = treinos.get(treinoId) ?? [];
  const escolhidas = new Map<string, string>();
  const destinos = new Set<string>();

  // Se dois slots pedem o mesmo destino, prioriza o pedido do dia. Entre
  // escolhas de mesmo escopo, a ordem do programa dá um resultado estável.
  const doDia = new Set(originais.filter((id) => exercicioPorId.has(soHoje[id] ?? "")));
  for (const id of [...doDia, ...originais.filter((id) => !doDia.has(id))]) {
    const hoje = doDia.has(id);
    const destino = hoje ? soHoje[id] : lembradas[id];
    if (!destino || destino === id || destinos.has(destino)) continue;
    if (!hoje && !trocaDoProgramaValida(treinoId, id, destino)) continue;
    escolhidas.set(id, destino);
    destinos.add(destino);
  }

  // Um slot que ficou com seu original sempre o conserva. Reverter uma
  // colisão pode liberar outra em cadeia. Ciclos completos já são distintos.
  const mantidos = originais.filter((id) => !escolhidas.has(id));
  for (const mantido of mantidos) {
    for (const [id, destino] of escolhidas) {
      if (destino === mantido) {
        escolhidas.delete(id);
        mantidos.push(id);
        break;
      }
    }
  }
  return Object.fromEntries(escolhidas);
}

const CHAVE_TROCAS = "treino-trocas";
function chaveDaConta(userId: string, treinoId: string): string {
  return `${CHAVE_TROCAS}:${encodeURIComponent(userId)}:${treinoId}`;
}

export interface TrocasDoDia {
  data: string;
  treinoId: string;
  /** exercício do programa → substituto escolhido. */
  trocas: Record<string, string>;
}

function ehMapaDeTexto(valor: unknown): valor is Record<string, string> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return false;
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
    if (de && typeof para === "string" && para) limpo[de] = para;
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

export function lerTrocasDoAparelho(userId: string, data: string, treinoId: string): Record<string, string> {
  try {
    return lerTrocas(window.localStorage.getItem(chaveDaConta(userId, treinoId)), data, treinoId);
  } catch {
    return {};
  }
}

export function guardarTrocasNoAparelho(
  userId: string,
  data: string,
  treinoId: string,
  trocas: Record<string, string>,
): void {
  try {
    const texto = escreverTrocas(data, treinoId, trocas);
    if (texto === null) window.localStorage.removeItem(chaveDaConta(userId, treinoId));
    else window.localStorage.setItem(chaveDaConta(userId, treinoId), texto);
  } catch {
    /* sem storage a escolha vale só nesta tela */
  }
}

export function limparTrocasDoAparelho(userId: string, treinoId: string): void {
  try {
    window.localStorage.removeItem(chaveDaConta(userId, treinoId));
  } catch {
    /* nada a limpar */
  }
}
