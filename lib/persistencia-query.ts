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
  estado: DehydratedState;
}

/** Uma URL blob: só existe no documento que a criou. O arquivo continua no Dexie. */
function temUrlLocalDeFoto(chave: readonly unknown[], dados: unknown): boolean {
  return chave[0] === "corpo" && chave[1] === "fotos-url" && !!dados && typeof dados === "object"
    && Object.values(dados).some((url) => typeof url === "string" && url.startsWith("blob:"));
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
      !temUrlLocalDeFoto(q.queryKey, q.state.data),
  });
  await guardarCache(CHAVE_CACHE, {
    salvoEm: Date.now(),
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
      // Os caches gravados por versões anteriores também podem conter URLs vencidas.
      hydrate(cliente, {
        ...guardado.estado,
        queries: guardado.estado.queries.filter((q) => !temUrlLocalDeFoto(q.queryKey, q.state.data)),
      });
    } catch {
      // cache ilegível não pode derrubar o app: segue com a rede
    }
  })();

  const cancelar = cliente.getQueryCache().subscribe(() => {
    if (!vivo || agendado !== null) return;
    agendado = setTimeout(salvar, INTERVALO_MS);
  });

  return () => {
    vivo = false;
    if (agendado !== null) clearTimeout(agendado);
    cancelar();
  };
}
