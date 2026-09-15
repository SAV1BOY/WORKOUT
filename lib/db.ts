/**
 * Banco local (IndexedDB via Dexie). Nada se perde offline: a sessão em
 * andamento e a fila de saída vivem aqui antes de irem para o Supabase.
 */
import Dexie, { type EntityTable } from "dexie";

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
  | "medidas";

/** Item da fila de saída para o Supabase. */
export interface ItemSaida {
  id?: number;
  tipo: TipoSaida;
  payload: unknown;
  tentativas: number;
  proximaTentativa: number;
  criadoEm: number;
  erro?: string;
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

/** Cache simples chave/valor (última leitura de telas, preferências locais). */
export interface ItemCache {
  chave: string;
  valor: unknown;
  atualizadoEm: number;
}

export class BancoLocal extends Dexie {
  sessaoAtiva!: EntityTable<SessaoAtiva, "id">;
  cardioAtivo!: EntityTable<CardioAtivo, "id">;
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

export async function guardarCache(chave: string, valor: unknown) {
  await bd().cache.put({ chave, valor, atualizadoEm: Date.now() });
}

export async function lerCache<T>(chave: string): Promise<T | null> {
  const item = await bd().cache.get(chave);
  return item ? (item.valor as T) : null;
}
