/**
 * Quem sabe enviar a fila de saída para o Supabase (SPEC §8).
 * Cada item é uma escrita numa tabela do `supabase/schema.sql`; o motor da
 * fila (lib/outbox.ts) cuida de retry, backoff e volta da rede.
 *
 * Nada aqui grava direto: a tela chama `enfileirarEscrita`, que salva no
 * IndexedDB na hora e devolve. Nenhum registro se perde por falta de sinal.
 */
import {
  clienteNavegador,
  supabaseConfiguradoNoNavegador,
} from "@/lib/supabase/client";
import { enfileirar, definirEnviador, processar } from "@/lib/outbox";
import type { ItemSaida, TipoSaida } from "@/lib/db";

export type Operacao = "insert" | "upsert" | "update" | "delete";

export interface EscritaTabela {
  /** Nome da tabela em `supabase/schema.sql`. */
  tabela: string;
  op: Operacao;
  linha?: Record<string, unknown>;
  /** Colunas da chave única, para o upsert (ex.: "user_id,data"). */
  onConflict?: string;
  /** Filtro de igualdade do update/delete (ex.: `{ id }`). */
  filtro?: Record<string, string | number | boolean>;
}

function ehEscrita(valor: unknown): valor is EscritaTabela {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Partial<EscritaTabela>;
  return typeof v.tabela === "string" && typeof v.op === "string";
}

/** Envia um item da fila. Lançar aqui faz a fila tentar de novo depois. */
export async function enviarItem(item: ItemSaida): Promise<void> {
  if (!ehEscrita(item.payload)) {
    throw new Error("item da fila sem tabela ou operação");
  }
  const p = item.payload;
  const tabela = clienteNavegador().from(p.tabela);

  if (p.op === "insert") {
    const { error } = await tabela.insert(p.linha ?? {});
    if (error) throw new Error(error.message);
    return;
  }

  if (p.op === "upsert") {
    const { error } = await tabela.upsert(
      p.linha ?? {},
      p.onConflict ? { onConflict: p.onConflict } : undefined,
    );
    if (error) throw new Error(error.message);
    return;
  }

  if (p.op === "update") {
    let consulta = tabela.update(p.linha ?? {});
    for (const [coluna, valor] of Object.entries(p.filtro ?? {})) {
      consulta = consulta.eq(coluna, valor);
    }
    const { error } = await consulta;
    if (error) throw new Error(error.message);
    return;
  }

  let consulta = tabela.delete();
  for (const [coluna, valor] of Object.entries(p.filtro ?? {})) {
    consulta = consulta.eq(coluna, valor);
  }
  const { error } = await consulta;
  if (error) throw new Error(error.message);
}

let registrado = false;

/**
 * Liga o enviador da fila. Idempotente; sem Supabase configurado não faz nada.
 * A conferência é a do navegador (`supabaseConfiguradoNoNavegador`): as
 * `NEXT_PUBLIC_*` não existem no bundle do cliente, a configuração chega do
 * servidor em tempo de execução.
 */
export function registrarEnviador(): void {
  if (registrado || !supabaseConfiguradoNoNavegador()) return;
  registrado = true;
  definirEnviador(enviarItem);
  // `iniciarOutbox()` pode já ter rodado sem enviador (o app abriu no /login):
  // nesse caso o flush de partida não aconteceu e o que estava na fila de uma
  // sessão anterior ficaria parado. Uma rodada aqui fecha esse buraco (§8).
  void processar();
}

/** Enfileira uma escrita. O IndexedDB recebe na hora; o Supabase, quando der. */
export async function enfileirarEscrita(
  tipo: TipoSaida,
  escrita: EscritaTabela,
): Promise<void> {
  await enfileirar(tipo, escrita);
}
