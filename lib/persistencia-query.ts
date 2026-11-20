/**
 * Cache de leitura persistido (SPEC §8: "a tela Hoje abre com os dados da
 * última sincronização e atualiza em segundo plano").
 *
 * Em vez de uma dependência a mais, usa o `dehydrate`/`hydrate` do próprio
 * TanStack Query e guarda o resultado no IndexedDB (a tabela `cache` do
 * lib/db.ts, via Dexie). Mesmo efeito do `persistQueryClient`, sem pacote novo.
 */
import {
  dehydrate,
  hydrate,
  type DehydratedState,
  type QueryClient,
} from "@tanstack/react-query";
import { guardarCache, lerCache, temIndexedDB } from "@/lib/db";

export const CHAVE_CACHE = "react-query-v1";

/** Cache mais velho que isto é descartado (uma semana). */
export const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

/** Espaço entre duas gravações do cache (o treino digita muito rápido). */
const INTERVALO_MS = 1_000;

interface Guardado {
  salvoEm: number;
  conta?: string;
  /** Versões antigas só guardavam o horário da cópia. */
  sincronizadoEm?: number | null;
  estado: DehydratedState;
}

interface Persistencia {
  conta?: string;
  sincronizadoEm?: number;
  situacao: "ativa" | "inativa" | "encerrada";
  parar?: () => void;
  gravacoes: Set<Promise<void>>;
}

const persistencias = new WeakMap<QueryClient, Persistencia>();
function controle(cliente: QueryClient): Persistencia {
  let estado = persistencias.get(cliente);
  if (!estado) {
    estado = { situacao: "ativa", gravacoes: new Set() };
    persistencias.set(cliente, estado);
  }
  return estado;
}

function pertenceAConta(cache: Guardado, conta?: string, exigirDono = false): boolean {
  if (!conta) return true;
  const perfil = cache.estado?.queries.find(q => q.queryKey.length === 1 && q.queryKey[0] === "perfil")?.state.data as { user_id?: unknown } | undefined;
  return (!cache.conta || cache.conta === conta) && (typeof perfil?.user_id !== "string" || perfil.user_id === conta) &&
    (!exigirDono || cache.conta === conta || perfil?.user_id === conta);
}

function horarioDaSincronizacao(cache: Guardado): number | null {
  return cache.sincronizadoEm === undefined ? cache.salvoEm : cache.sincronizadoEm;
}

export async function lerUltimaSincronizacao(conta?: string): Promise<number | null> {
  const cache = await lerCache<Guardado>(CHAVE_CACHE);
  return cache && pertenceAConta(cache, conta) ? horarioDaSincronizacao(cache) : null;
}

/** Primeira leitura depois de atualizar o app, mesmo antes de o React Query hidratar o cache. */
export async function lerConsultaGuardada<T>(chave: readonly string[], conta?: string): Promise<T | undefined> {
  return (await lerConsultaGuardadaComData<T>(chave, conta))?.valor;
}

/** Usa a data da leitura ou edição para comparar a consulta com uma cópia gravada separadamente. */
export async function lerConsultaGuardadaComData<T>(chave: readonly string[], conta?: string): Promise<{ valor: T; atualizadoEm: number } | undefined> {
  const cache = await lerCache<Guardado>(CHAVE_CACHE);
  if (!cache || !pertenceAConta(cache, conta) || Date.now() - cache.salvoEm > VALIDADE_MS) return undefined;
  const consulta = cache.estado.queries.find(q => q.queryKey.length === chave.length && chave.every((v, i) => q.queryKey[i] === v));
  if (!consulta || consulta.state.data === undefined) return undefined;
  return { valor: consulta.state.data as T, atualizadoEm: consulta.state.dataUpdatedAt ?? cache.salvoEm };
}

/** Uma URL blob: só existe no documento que a criou. O arquivo continua no Dexie. */
function temUrlLocalDeFoto(chave: readonly unknown[], dados: unknown): boolean {
  return chave[0] === "corpo" && chave[1] === "fotos-url" && !!dados && typeof dados === "object"
    && Object.values(dados).some((url) => typeof url === "string" && url.startsWith("blob:"));
}

/** Estas consultas já guardam sua cópia por conta no IndexedDB. */
function temCopiaPropria(chave: readonly unknown[]): boolean {
  if (chave.length === 4 && chave[0] === "progresso" && chave[1] === "series-da-sessao") {
    return typeof chave[2] === "string" && typeof chave[3] === "string";
  }
  if (chave.length === 2 && typeof chave[1] === "string") {
    return chave[0] === "cardio-todos" || chave[0] === "soltas-todas" || chave[0] === "modelos-de-treino";
  }
  return chave.length === 3 && chave[0] === "progresso" && typeof chave[2] === "string" &&
    (chave[1] === "sessoes" || chave[1] === "eventos-todos" || chave[1] === "series-todas");
}

/** Grava o estado atual sem aguardar o intervalo das escritas em segundo plano. */
export async function guardarConsultasAgora(cliente: QueryClient): Promise<void> {
  const registro = controle(cliente);
  if (!temIndexedDB() || registro.situacao !== "ativa") return;
  const estado = dehydrate(cliente, {
    /*
     * Tudo que TEM dado, não só o que está com `status: "success"`. Sem rede
     * a consulta rehidratada falha ao revalidar e passa para "error" com os
     * dados ainda ali; guardando só o "success", a primeira gravação depois
     * de ficar offline apagava do cache justamente o que faz o app funcionar
     * sem rede (SPEC §8) — as cargas atuais, entre elas.
     */
    shouldDehydrateQuery: (q) =>
      q.state.data !== undefined && q.state.status !== "pending" &&
      !temUrlLocalDeFoto(q.queryKey, q.state.data) && !temCopiaPropria(q.queryKey),
  });
  const gravacao = guardarCache(CHAVE_CACHE, {
    conta: registro.conta, salvoEm: Date.now(), sincronizadoEm: registro.sincronizadoEm ?? null, estado,
  } satisfies Guardado);
  registro.gravacoes.add(gravacao);
  try { await gravacao; } finally { registro.gravacoes.delete(gravacao); }
}

/**
 * Restaura o que foi salvo da última vez e passa a salvar as mudanças.
 * Devolve a função que desliga a assinatura.
 */
export function persistirQueryClient(cliente: QueryClient, conta?: string): () => void {
  const registro = controle(cliente);
  if (!temIndexedDB() || registro.situacao === "encerrada") return () => {};
  registro.situacao = "ativa";
  registro.conta = conta;

  let vivo = true;
  let agendado: ReturnType<typeof setTimeout> | null = null;

  const salvar = () => {
    agendado = null;
    void guardarConsultasAgora(cliente).catch(() => {});
  };

  void (async () => {
    try {
      const guardado = await lerCache<Guardado>(CHAVE_CACHE);
      if (!vivo || !guardado || !pertenceAConta(guardado, conta, true)) return;
      if (Date.now() - guardado.salvoEm > VALIDADE_MS) return;
      const anterior = horarioDaSincronizacao(guardado);
      if (anterior != null && anterior > (registro.sincronizadoEm ?? 0)) {
        registro.sincronizadoEm = anterior;
      }
      // Os caches gravados por versões anteriores também podem conter URLs vencidas.
      hydrate(cliente, {
        ...guardado.estado,
        queries: guardado.estado.queries.filter((q) => !temUrlLocalDeFoto(q.queryKey, q.state.data) && !temCopiaPropria(q.queryKey)),
      });
    } catch {
      // cache ilegível não pode derrubar o app: segue com a rede
    }
  })();

  const cancelar = cliente.getQueryCache().subscribe((evento) => {
    if (!vivo) return;
    // Atualizações otimistas e gravações no aparelho não são novas leituras da rede.
    if (evento.type === "updated" && evento.action.type === "success" && !evento.action.manual && navigator.onLine) {
      registro.sincronizadoEm = Date.now();
    }
    if (agendado !== null) return;
    agendado = setTimeout(salvar, INTERVALO_MS);
  });

  const parar = () => {
    vivo = false;
    if (agendado !== null) clearTimeout(agendado);
    cancelar();
    if (registro.situacao === "ativa") registro.situacao = "inativa";
    registro.parar = undefined;
  };
  registro.parar = parar;
  return parar;
}

/** Impede inclusive gravações diretas e espera o último put antes de apagar o IndexedDB. */
export async function encerrarConsultasParaSair(cliente: QueryClient): Promise<void> {
  const registro = controle(cliente);
  registro.situacao = "encerrada";
  registro.parar?.();
  await cliente.cancelQueries();
  cliente.clear();
  await Promise.allSettled(registro.gravacoes);
}
