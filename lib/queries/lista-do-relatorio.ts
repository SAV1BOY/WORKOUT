import type { QueryClient } from "@tanstack/react-query";
import { bd, temIndexedDB, type ItemCache } from "@/lib/db";
import { lerConsultaGuardada, VALIDADE_MS } from "@/lib/persistencia-query";
import { FalhaDeRedeNaTabela } from "@/lib/queries/ler";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { chaveDoHistorico, chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";

export interface ListaDoRelatorio<T> {
  linhas: T[];
  completa: boolean;
}
type Fonte = "series" | "cardio" | "soltas";

export const chaveDaLista = (fonte: Fonte, conta: string) => `${fonte}-do-historico:${conta}`;

function daConta<T>(item: ItemCache | undefined, conta: string): T[] | undefined {
  if (!item || Date.now() - item.atualizadoEm > VALIDADE_MS || !Array.isArray(item.valor)) return undefined;
  return item.valor.every(linha => linha?.user_id === conta && typeof linha.id === "string") ? item.valor : undefined;
}

/** Confirma a última página antes de atualizar a cópia da conta. Uma leitura iniciada antes não apaga outra mais nova. */
export async function lerListaDoRelatorio<T>(
  conta: string, chave: string, consultar: () => Promise<T[]>, sinal?: AbortSignal,
  podeGuardar: () => boolean = () => true,
): Promise<T[]> {
  sinal?.throwIfAborted();
  if (!conta) throw new Error("Não foi possível identificar a conta do relatório.");
  const inicio = Date.now();
  let linhas: T[];
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new FalhaDeRedeNaTabela("Esta parte do histórico ainda não está guardada neste aparelho.");
    }
    linhas = await consultar();
    sinal?.throwIfAborted();
    if (!linhas.every(linha => {
      const registro = linha as { id?: string; user_id?: string };
      return registro?.user_id === conta && typeof registro.id === "string";
    })) throw new Error("A resposta do histórico não corresponde à conta do treino.");
  } catch (erro) {
    sinal?.throwIfAborted();
    if (erro instanceof FalhaDeRedeNaTabela && temIndexedDB()) {
      const salvas = daConta<T>(await bd().cache.get(chave).catch(() => undefined), conta);
      sinal?.throwIfAborted();
      if (salvas) return salvas;
    }
    throw erro;
  }
  if (!temIndexedDB() || !podeGuardar()) return linhas;
  const banco = bd();
  try {
    return await banco.transaction("rw", banco.cache, async () => {
      const item = await banco.cache.get(chave);
      sinal?.throwIfAborted();
      if (item && item.atualizadoEm > inicio) {
        const recentes = daConta<T>(item, conta);
        if (recentes) return recentes;
      }
      await banco.cache.put({ chave, valor: linhas, atualizadoEm: inicio });
      return linhas;
    });
  } catch {
    sinal?.throwIfAborted();
    return linhas;
  }
}

const saidasPorFonte = {
  series: { tipo: "serie", tabela: "session_sets" },
  cardio: { tipo: "cardio", tabela: "cardio_sessions" },
  soltas: { tipo: "barra_fixa_solta", tabela: "pullup_singles" },
} as const;

async function escritasPendentes(fonte: Fonte, conta: string): Promise<EscritaTabela[]> {
  if (!temIndexedDB()) return [];
  const { tipo, tabela } = saidasPorFonte[fonte];
  const itens = await bd().outbox.where("tipo").equals(tipo).toArray();
  return itens.map(item => item.payload as EscritaTabela).filter(p =>
    p.tabela === tabela && (p.filtro?.user_id ?? p.linha?.user_id) === conta);
}

function aplicarPendentes<T>(linhas: T[], pendentes: EscritaTabela[]): T[] {
  if (!pendentes.length) return linhas;
  const porId = new Map<string, T>();
  const semId: T[] = [];
  for (const linha of linhas) {
    const id = (linha as { id?: string }).id;
    if (id) porId.set(id, linha);
    else semId.push(linha);
  }
  for (const p of pendentes) {
    const id = p.filtro?.id ?? p.linha?.id;
    if (typeof id !== "string") continue;
    if (p.op === "delete") porId.delete(id);
    else if (p.linha && (p.op !== "update" || porId.has(id))) porId.set(id, { ...porId.get(id), ...p.linha } as T);
  }
  return [...porId.values(), ...semId];
}

export async function lerFonteDoRelatorio<T>(
  cliente: QueryClient, conta: string, fonte: Fonte, antiga: readonly string[], consultar: () => Promise<T[]>, sinal?: AbortSignal,
): Promise<ListaDoRelatorio<T>> {
  let filaLegivel = true;
  const lerFila = async () => {
    sinal?.throwIfAborted();
    let pendentes: EscritaTabela[] = [];
    try {
      pendentes = await escritasPendentes(fonte, conta);
    } catch {
      // A rede ainda pode responder. Preserve a cópia que pode conter alterações locais desconhecidas.
      filaLegivel = false;
    }
    sinal?.throwIfAborted();
    return pendentes;
  };
  const antes = await lerFila();
  try {
    const linhas = await lerListaDoRelatorio(conta, chaveDaLista(fonte, conta), async () => {
      const remotas = await consultar();
      // A fila pode esvaziar enquanto o servidor responde com a foto anterior aos envios.
      return aplicarPendentes(remotas, [...antes, ...await lerFila()]);
    }, sinal, () => filaLegivel);
    return { linhas: aplicarPendentes(linhas, await lerFila()), completa: true };
  } catch (erro) {
    if (!(erro instanceof FalhaDeRedeNaTabela)) throw erro;
  }

  const pegar = async <R>(chave: readonly string[]): Promise<R | undefined> =>
    cliente.getQueryData<R>(chave) ?? (temIndexedDB() ? await lerConsultaGuardada<R>(chave) : undefined);
  type Antiga = T & { id?: string; user_id?: string; session_id?: string };
  const antigas = await pegar<Antiga[]>(antiga);
  if (!antigas?.length) return { linhas: aplicarPendentes([], antes), completa: false };

  const sessoes = new Set<string>();
  if (fonte === "series") {
    type Dono = { id: string; user_id?: string };
    const locais = temIndexedDB() ? await bd().cache.get(chaveDoHistoricoNoDisco(conta)) : undefined;
    const listas = [locais?.valor, await pegar<Dono[]>(chaveDoHistorico(conta)), await pegar<Dono[]>(["progresso", "sessoes"])];
    for (const lista of listas) if (Array.isArray(lista)) {
      for (const s of lista) if (s?.user_id === conta) sessoes.add(s.id);
    }
  }
  const linhas = antigas.filter(l => l.user_id !== undefined ? l.user_id === conta :
    fonte === "series" && l.session_id !== undefined && sessoes.has(l.session_id));
  // Antes da paginação por chave, as séries vinham sem id; cardio e soltas usavam a mesma projeção com limite.
  const completa = fonte === "series" && linhas.length === antigas.length && linhas.every(l => typeof l.id === "string");
  return { linhas: aplicarPendentes(linhas, antes), completa };
}

/** Uma edição de cardio ou de repetições soltas também atualiza a cópia completa já confirmada no aparelho. */
export async function atualizarFonteDoRelatorio<T>(
  cliente: QueryClient, conta: string, fonte: Fonte, chave: readonly string[], atualizar: (linhas: T[]) => T[],
): Promise<void> {
  if (temIndexedDB()) {
    const banco = bd();
    const disco = chaveDaLista(fonte, conta);
    await banco.transaction("rw", banco.cache, async () => {
      const item = await banco.cache.get(disco);
      const salvas = daConta<T>(item, conta);
      if (salvas) await banco.cache.put({ chave: disco, valor: atualizar(salvas), atualizadoEm: Date.now() });
    }).catch(() => {}); // a alteração já está na fila, mesmo quando não há espaço para atualizar o cache
  }
  cliente.setQueryData<ListaDoRelatorio<T>>(chave, atual => atual && { ...atual, linhas: atualizar(atual.linhas) });
}
