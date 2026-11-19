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
  /** Versões antigas só guardavam o horário da cópia. */
  sincronizadoEm?: number | null;
  estado: DehydratedState;
}

const leiturasDaRede = new WeakMap<QueryClient, number>();

function horarioDaSincronizacao(cache: Guardado): number | null {
  return cache.sincronizadoEm === undefined ? cache.salvoEm : cache.sincronizadoEm;
}

export async function lerUltimaSincronizacao(): Promise<number | null> {
  const cache = await lerCache<Guardado>(CHAVE_CACHE);
  return cache ? horarioDaSincronizacao(cache) : null;
}

/** Primeira leitura depois de atualizar o app, mesmo antes de o React Query hidratar o cache. */
export async function lerConsultaGuardada<T>(chave: readonly string[]): Promise<T | undefined> {
  return (await lerConsultaGuardadaComData<T>(chave))?.valor;
}

/** Usa a data da leitura ou edição para comparar a consulta com uma cópia gravada separadamente. */
export async function lerConsultaGuardadaComData<T>(chave: readonly string[]): Promise<{ valor: T; atualizadoEm: number } | undefined> {
  const cache = await lerCache<Guardado>(CHAVE_CACHE);
  if (!cache || Date.now() - cache.salvoEm > VALIDADE_MS) return undefined;
  const consulta = cache.estado.queries.find(q => q.queryKey.length === chave.length && chave.every((v, i) => q.queryKey[i] === v));
  if (!consulta || consulta.state.data === undefined) return undefined;
  return { valor: consulta.state.data as T, atualizadoEm: consulta.state.dataUpdatedAt ?? cache.salvoEm };
}

/** Uma URL blob: só existe no documento que a criou. O arquivo continua no Dexie. */
function temUrlLocalDeFoto(chave: readonly unknown[], dados: unknown): boolean {
  return chave[0] === "corpo" && chave[1] === "fotos-url" && !!dados && typeof dados === "object"
    && Object.values(dados).some((url) => typeof url === "string" && url.startsWith("blob:"));
}

/** O histórico por conta tem cópia própria, transacional com a fila de notas. */
function temCopiaPropria(chave: readonly unknown[]): boolean {
  return chave.length === 3 && chave[0] === "progresso" && chave[1] === "sessoes" && typeof chave[2] === "string";
}

/** Grava o estado atual sem aguardar o intervalo das escritas em segundo plano. */
export async function guardarConsultasAgora(cliente: QueryClient): Promise<void> {
  if (!temIndexedDB()) return;
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
  await guardarCache(CHAVE_CACHE, {
    salvoEm: Date.now(),
    sincronizadoEm: leiturasDaRede.get(cliente) ?? null,
    estado,
  } satisfies Guardado);
}

/**
 * Restaura o que foi salvo da última vez e passa a salvar as mudanças.
 * Devolve a função que desliga a assinatura.
 */
export function persistirQueryClient(cliente: QueryClient): () => void {
  if (!temIndexedDB()) return () => {};

  let vivo = true;
  let agendado: ReturnType<typeof setTimeout> | null = null;

  const salvar = () => {
    agendado = null;
    void guardarConsultasAgora(cliente).catch(() => {});
  };

  void (async () => {
    try {
      const guardado = await lerCache<Guardado>(CHAVE_CACHE);
      if (!vivo || !guardado) return;
      if (Date.now() - guardado.salvoEm > VALIDADE_MS) return;
      const anterior = horarioDaSincronizacao(guardado);
      if (anterior != null && anterior > (leiturasDaRede.get(cliente) ?? 0)) {
        leiturasDaRede.set(cliente, anterior);
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
      leiturasDaRede.set(cliente, Date.now());
    }
    if (agendado !== null) return;
    agendado = setTimeout(salvar, INTERVALO_MS);
  });

  return () => {
    vivo = false;
    if (agendado !== null) clearTimeout(agendado);
    cancelar();
  };
}
