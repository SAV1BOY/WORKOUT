/**
 * Fila de saída: tudo que é registrado vai primeiro para o IndexedDB e depois
 * sobe para o Supabase, com retry exponencial e reenvio ao voltar a rede.
 * Quem sabe enviar cada tipo é registrado pelos marcos seguintes.
 */
import { bd, temIndexedDB, type ItemSaida, type TipoSaida } from "@/lib/db";

export type Enviador = (item: ItemSaida) => Promise<void>;

const ATRASO_BASE_MS = 2_000;
const ATRASO_MAX_MS = 5 * 60_000;
const MAX_TENTATIVAS = 12;

let enviador: Enviador | null = null;
let rodando = false;
let iniciado = false;

/** Define quem envia os itens da fila (chamado pelo provider do app). */
export function definirEnviador(fn: Enviador) {
  enviador = fn;
}

export function atrasoDaTentativa(tentativas: number): number {
  return Math.min(ATRASO_BASE_MS * 2 ** tentativas, ATRASO_MAX_MS);
}

/** Enfileira uma mudança. Nunca lança: o registro local já foi feito. */
export async function enfileirar(tipo: TipoSaida, payload: unknown) {
  if (!temIndexedDB()) return;
  await bd().outbox.add({
    tipo,
    payload,
    tentativas: 0,
    proximaTentativa: Date.now(),
    criadoEm: Date.now(),
  });
  void processar();
}

/** Tenta enviar o que está vencido na fila. Devolve quantos subiram. */
export async function processar(): Promise<number> {
  if (!temIndexedDB() || !enviador || rodando) return 0;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  rodando = true;
  let enviados = 0;
  try {
    const agora = Date.now();
    const pendentes = await bd()
      .outbox.where("proximaTentativa")
      .belowOrEqual(agora)
      .sortBy("criadoEm");
    for (const item of pendentes) {
      if (item.id === undefined) continue;
      try {
        await enviador(item);
        await bd().outbox.delete(item.id);
        enviados += 1;
      } catch (e) {
        const tentativas = item.tentativas + 1;
        if (tentativas >= MAX_TENTATIVAS) {
          await bd().outbox.update(item.id, {
            tentativas,
            proximaTentativa: agora + ATRASO_MAX_MS,
            erro: (e as Error).message,
          });
        } else {
          await bd().outbox.update(item.id, {
            tentativas,
            proximaTentativa: agora + atrasoDaTentativa(tentativas),
            erro: (e as Error).message,
          });
        }
      }
    }
  } finally {
    rodando = false;
  }
  return enviados;
}

export async function pendentes(): Promise<number> {
  if (!temIndexedDB()) return 0;
  return bd().outbox.count();
}

/** Liga o listener de 'online' e faz o primeiro flush. Idempotente. */
export function iniciarOutbox() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  window.addEventListener("online", () => {
    void processar();
  });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void processar();
  });
  void processar();
}
