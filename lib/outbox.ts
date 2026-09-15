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
let repetir = false;
let iniciado = false;
let relogio: ReturnType<typeof setTimeout> | null = null;

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

/**
 * Tenta enviar o que está vencido na fila. Devolve quantos subiram.
 *
 * Quem chega enquanto uma rodada está em andamento não é descartado: marca
 * `repetir` e a rodada corrente dá mais uma volta no fim. Sem isso, enfileirar
 * duas coisas seguidas (três `schedule_overrides`, as séries de um treino)
 * deixava tudo menos a primeira parado na fila até o próximo evento de rede.
 */
export async function processar(): Promise<number> {
  if (!temIndexedDB() || !enviador) return 0;
  if (rodando) {
    repetir = true;
    return 0;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  rodando = true;
  let enviados = 0;
  try {
    do {
      repetir = false;
      enviados += await umaRodada();
    } while (repetir);
  } finally {
    rodando = false;
  }
  await agendarProxima();
  return enviados;
}

/**
 * Agenda a próxima tentativa para quando o item mais próximo vencer.
 *
 * Sem isto, um item que falhou ficava esperando um evento de fora (voltar a
 * rede, voltar à aba, uma escrita nova) — e num treino no terraço, com o
 * celular na mão e a rede indo e voltando, "o próximo evento" pode não vir:
 * a série registrada ficaria parada na fila sem nada para acordá-la.
 */
async function agendarProxima(): Promise<void> {
  if (relogio) {
    clearTimeout(relogio);
    relogio = null;
  }
  if (!temIndexedDB() || !enviador) return;
  const proximos = await bd()
    .outbox.orderBy("proximaTentativa")
    .limit(1)
    .toArray()
    .catch(() => []);
  const proximo = proximos[0];
  if (!proximo) return;
  const espera = Math.max(250, Math.min(proximo.proximaTentativa - Date.now(), ATRASO_MAX_MS));
  relogio = setTimeout(() => {
    relogio = null;
    void processar();
  }, espera);
}

/**
 * A rede voltou: o motivo de todas as falhas acabou, então o backoff também.
 * Marca tudo como vencido e tenta agora (SPEC §8: nunca perder um registro).
 */
export async function tentarAgora(): Promise<number> {
  if (!temIndexedDB()) return 0;
  const agora = Date.now();
  const atrasados = await bd()
    .outbox.where("proximaTentativa")
    .above(agora)
    .toArray()
    .catch(() => []);
  for (const item of atrasados) {
    if (item.id !== undefined) {
      await bd().outbox.update(item.id, { proximaTentativa: agora });
    }
  }
  return processar();
}

/** Uma passada pelos itens vencidos. */
async function umaRodada(): Promise<number> {
  const enviar = enviador;
  if (!enviar) return 0;

  let enviados = 0;
  const agora = Date.now();
  const pendentes = await bd()
    .outbox.where("proximaTentativa")
    .belowOrEqual(agora)
    .sortBy("criadoEm");

  for (const item of pendentes) {
    if (item.id === undefined) continue;
    try {
      await enviar(item);
      await bd().outbox.delete(item.id);
      enviados += 1;
    } catch (e) {
      const tentativas = item.tentativas + 1;
      const atraso =
        tentativas >= MAX_TENTATIVAS
          ? ATRASO_MAX_MS
          : atrasoDaTentativa(tentativas);
      await bd().outbox.update(item.id, {
        tentativas,
        proximaTentativa: agora + atraso,
        erro: (e as Error).message,
      });
    }
  }

  return enviados;
}

/**
 * Espera a fila esvaziar, tentando de novo algumas vezes. Devolve quantos
 * sobraram. Quem chama usa isto para só então reler o que acabou de gravar
 * (a tela Hoje depois de concluir o treino, SPEC §6.6). Sem rede, desiste na
 * hora: o que está na fila sobe quando a rede voltar.
 */
export async function esperarFila(tentativas = 20, esperaMs = 100): Promise<number> {
  if (!temIndexedDB()) return 0;
  for (let i = 0; i < tentativas; i++) {
    if ((await pendentes()) === 0) return 0;
    if (typeof navigator !== "undefined" && navigator.onLine === false) break;
    await processar();
    if ((await pendentes()) === 0) return 0;
    await new Promise((pronto) => setTimeout(pronto, esperaMs));
  }
  return pendentes();
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
    void tentarAgora();
  });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void processar();
  });
  void processar();
}
