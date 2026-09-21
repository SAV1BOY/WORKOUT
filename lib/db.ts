/**
 * Banco local (IndexedDB via Dexie). Nada se perde offline: a sessão em
 * andamento e a fila de saída vivem aqui antes de irem para o Supabase.
 */
import Dexie, { type EntityTable } from "dexie";
import { ehCachePublico } from "@/lib/caches-do-worker";

/** Sessão de força em andamento, salva a cada toque. */
export interface SessaoAtiva {
  id: string;
  dados: unknown;
  atualizadoEm: number;
}

export type TipoSaida =
  | "serie"
  | "sessao"
  | "evento_progressao"
  | "estado_exercicio"
  | "perfil"
  | "cardio"
  | "barra_fixa_solta"
  | "agenda"
  | "peso"
  | "medidas"
  | "foto";

/** Item da fila de saída para o Supabase. */
export interface ItemSaida {
  id?: number;
  tipo: TipoSaida;
  payload: unknown;
  tentativas: number;
  proximaTentativa: number;
  criadoEm: number;
  erro?: string;
  /**
   * Quem este item depende de ter chegado antes (`"sessions:<uuid>"`).
   *
   * A fila envia por ordem de criação, mas um item que falha fica para depois
   * enquanto os seguintes continuam indo: a linha de `session_sets` chegaria
   * antes da sessão (chave estrangeira no banco de verdade) e a conclusão
   * antes da criação (a criação, reenviada, desfaria o fim do treino). Itens
   * com o mesmo `alvo` esperam uns pelos outros — só eles (SPEC §8). Campo
   * novo sem índice: o Dexie não precisa de versão nova para ele.
   */
  alvo?: string;
}

/**
 * Sessão de cardio em andamento (SPEC §3.3): o estado do timer vive aqui, então
 * recarregar a página ou fechar o app não perde a sessão.
 */
export interface CardioAtivo {
  id: string;
  dados: unknown;
  atualizadoEm: number;
}

/**
 * Foto de progresso esperando subir (SPEC §3.8): o blob fica aqui até o
 * Storage confirmar, então a galeria mostra a foto mesmo sem rede e nada se
 * perde se o app fechar no meio do envio.
 */
export interface FotoPendente {
  /** `<user_id>/<data>-<angulo>.jpg`, o mesmo caminho do bucket. */
  caminho: string;
  blob: Blob;
  data: string;
  angulo: string;
  criadoEm: number;
}

/** Cache simples chave/valor (última leitura de telas, preferências locais). */
export interface ItemCache {
  chave: string;
  valor: unknown;
  atualizadoEm: number;
}

export class BancoLocal extends Dexie {
  sessaoAtiva!: EntityTable<SessaoAtiva, "id">;
  cardioAtivo!: EntityTable<CardioAtivo, "id">;
  fotos!: EntityTable<FotoPendente, "caminho">;
  outbox!: EntityTable<ItemSaida, "id">;
  cache!: EntityTable<ItemCache, "chave">;

  constructor() {
    super("treino-terraco");
    this.version(1).stores({
      sessaoAtiva: "id, atualizadoEm",
      outbox: "++id, tipo, proximaTentativa, criadoEm",
      cache: "chave, atualizadoEm",
    });
    // v2: a sessão de cardio em andamento (marco 4). As tabelas da v1 continuam
    // como estavam — o Dexie migra sozinho quem já tem o banco no aparelho.
    this.version(2).stores({
      cardioAtivo: "id, atualizadoEm",
    });
    // v3: as fotos de progresso ainda não confirmadas pelo Storage (marco 5).
    this.version(3).stores({
      fotos: "caminho, criadoEm",
    });
  }
}

let instancia: BancoLocal | null = null;

export function temIndexedDB(): boolean {
  return typeof globalThis !== "undefined" && "indexedDB" in globalThis;
}

/** Banco local; só existe no navegador. */
export function bd(): BancoLocal {
  if (!temIndexedDB()) {
    throw new Error("IndexedDB só existe no navegador");
  }
  instancia ??= new BancoLocal();
  return instancia;
}

/*
 * Os nomes dos caches e a regra de quais o "Sair" poupa moram em
 * `lib/caches-do-worker.ts`, o único módulo que a página e o service worker
 * compartilham — o worker é um bundle à parte e não pode puxar o Dexie daqui.
 */
export {
  CACHE_DE_MIDIA,
  CACHE_DE_SOCORRO,
  PREFIXO_DO_PRECACHE,
} from "@/lib/caches-do-worker";

/**
 * Apaga tudo que é do usuário neste aparelho (SPEC §8 com §9).
 *
 * O "Sair" revogava a sessão e pronto: o cache de leitura do TanStack (uma
 * semana de validade), a sessão/cardio em andamento, os blobs das fotos e as
 * cópias das páginas autenticadas no service worker continuavam no aparelho —
 * num celular emprestado ou perdido dava para ver tudo isso depois do logout,
 * inclusive offline. Nunca lança: sair tem que funcionar de qualquer jeito.
 */
export async function limparDadosLocais(): Promise<void> {
  try {
    if (temIndexedDB()) await bd().delete();
    instancia = null;
  } catch {
    // aba anônima, banco bloqueado por outra aba: o logout segue
  }
  try {
    if (typeof caches !== "undefined") {
      for (const nome of await caches.keys()) {
        if (!ehCachePublico(nome)) await caches.delete(nome);
      }
    }
  } catch {
    // sem Cache Storage não há o que apagar
  }
}

export async function guardarCache(chave: string, valor: unknown) {
  await bd().cache.put({ chave, valor, atualizadoEm: Date.now() });
}

export async function lerCache<T>(chave: string): Promise<T | null> {
  const item = await bd().cache.get(chave);
  return item ? (item.valor as T) : null;
}
