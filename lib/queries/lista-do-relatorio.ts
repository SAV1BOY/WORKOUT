import type { QueryClient } from "@tanstack/react-query";
import { bd, temIndexedDB, type ItemCache } from "@/lib/db";
import { lerConsultaGuardada, VALIDADE_MS } from "@/lib/persistencia-query";
import { FalhaDeRedeNaTabela } from "@/lib/queries/ler";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { retirarDetalhesCobertos } from "@/lib/queries/cache-do-detalhe";
import { chaveDoHistorico, chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";

export interface ListaDoRelatorio<T> {
  linhas: T[];
  completa: boolean;
  /** Início da leitura paginada das séries, ou data dessa mesma confirmação no disco. */
  confirmadasEm?: number;
}
type Fonte = "series" | "cardio" | "soltas";

/** O app anterior ainda pode escrever a projeção sem ordem_ex em outra aba. */
export const chaveDaLista = (fonte: Fonte, conta: string) => fonte === "series"
  ? `series-do-historico-v2:${conta}` : `${fonte}-do-historico:${conta}`;

function daConta<T>(item: ItemCache | undefined, conta: string): T[] | undefined {
  if (!item || Date.now() - item.atualizadoEm > VALIDADE_MS || !Array.isArray(item.valor)) return undefined;
  return item.valor.every(linha => linha?.user_id === conta && typeof linha.id === "string") ? item.valor : undefined;
}

/** Confirma a última página antes de atualizar a cópia da conta. Uma leitura iniciada antes não apaga outra mais nova. */
async function lerListaConfirmada<T>(
  conta: string, chave: string, consultar: () => Promise<T[]>, sinal?: AbortSignal,
  gravacao?: { inicio: number; podeGuardar: () => boolean; depoisDeGuardar?: (inicio: number) => Promise<void> },
): Promise<{ linhas: T[]; confirmadasEm?: number }> {
  sinal?.throwIfAborted();
  if (!conta) throw new Error("Não foi possível identificar a conta do relatório.");
  const inicio = gravacao?.inicio ?? Date.now();
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
      const item = await bd().cache.get(chave).catch(() => undefined);
      const salvas = daConta<T>(item, conta);
      sinal?.throwIfAborted();
      if (salvas && item) return { linhas: salvas, confirmadasEm: item.atualizadoEm };
    }
    throw erro;
  }
  const confirmada = { linhas, confirmadasEm: inicio };
  if (!temIndexedDB() || (gravacao && !gravacao.podeGuardar())) return confirmada;
  const banco = bd();
  try {
    const tabelas = gravacao?.depoisDeGuardar ? [banco.cache, banco.outbox] : [banco.cache];
    return await banco.transaction("rw", tabelas, async () => {
      const item = await banco.cache.get(chave);
      sinal?.throwIfAborted();
      if (item && item.atualizadoEm > inicio) {
        const recentes = daConta<T>(item, conta);
        if (recentes) return { linhas: recentes, confirmadasEm: item.atualizadoEm };
      }
      await banco.cache.put({ chave, valor: linhas, atualizadoEm: inicio });
      await gravacao?.depoisDeGuardar?.(inicio);
      return confirmada;
    });
  } catch {
    sinal?.throwIfAborted();
    // A resposta continua visível, mas uma transação revertida não confirmou o fechamento no aparelho.
    return { linhas };
  }
}

export async function lerListaDoRelatorio<T>(conta: string, chave: string, consultar: () => Promise<T[]>, sinal?: AbortSignal): Promise<T[]> {
  return (await lerListaConfirmada(conta, chave, consultar, sinal)).linhas;
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
  return itens.flatMap(item => {
    const p = item.payload as EscritaTabela;
    if (p.tabela !== tabela) return [];
    if (p.op === "upsert" && p.linhas) {
      return p.linhas.filter(linha => linha.user_id === conta).map(linha => ({ tabela, op: "upsert" as const, linha }));
    }
    return (p.filtro?.user_id ?? p.linha?.user_id) === conta ? [p] : [];
  });
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
  // A observação começa na fila. Um treino pode fechar antes de a consulta de rede chegar a iniciar.
  const inicio = Date.now();
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
    const confirmada = await lerListaConfirmada(conta, chaveDaLista(fonte, conta), async () => {
      const remotas = await consultar();
      // A fila pode esvaziar enquanto o servidor responde com a foto anterior aos envios.
      return aplicarPendentes(remotas, [...antes, ...await lerFila()]);
    }, sinal, {
      inicio, podeGuardar: () => filaLegivel,
      depoisDeGuardar: fonte === "series" ? horario => retirarDetalhesCobertos(conta, horario) : undefined,
    });
    const linhas = aplicarPendentes(confirmada.linhas, await lerFila());
    return fonte === "series" && filaLegivel && confirmada.confirmadasEm !== undefined
      ? { linhas, completa: true, confirmadasEm: confirmada.confirmadasEm }
      : { linhas, completa: true };
  } catch (erro) {
    if (!(erro instanceof FalhaDeRedeNaTabela)) throw erro;
  }

  if (fonte === "series" && temIndexedDB()) {
    const arquivoAnterior = await bd().cache.get(`series-do-historico:${conta}`).catch(() => undefined);
    sinal?.throwIfAborted();
    const salvas = daConta<T>(arquivoAnterior, conta);
    if (salvas) return { linhas: aplicarPendentes(salvas, await lerFila()), completa: true };
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
