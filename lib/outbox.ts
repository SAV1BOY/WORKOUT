/**
 * Fila de saída: tudo que é registrado vai primeiro para o IndexedDB e depois
 * sobe para o Supabase, com retry exponencial e reenvio ao voltar a rede.
 * Quem sabe enviar cada tipo é registrado pelos marcos seguintes.
 */
import { bd, temIndexedDB, type ItemSaida, type TipoSaida } from "@/lib/db";

export type Enviador = (item: ItemSaida) => Promise<void>;

const ATRASO_BASE_MS = 2_000;
const ATRASO_MAX_MS = 5 * 60_000;
export const MAX_TENTATIVAS = 12;

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

/**
 * Chegou a hora deste item? Um `proximaTentativa` mais longe do que o atraso
 * máximo só acontece com o relógio do aparelho andando para trás (o Miguel
 * mexendo na hora, o NTP corrigindo o celular): sem este cuidado a série
 * registrada ficava presa na fila até o relógio alcançar a marca — horas, e
 * sem nada na tela dizendo isso (SPEC §8).
 */
export function venceu(
  item: Pick<ItemSaida, "proximaTentativa">,
  agora: number,
): boolean {
  return item.proximaTentativa <= agora || item.proximaTentativa - agora > ATRASO_MAX_MS;
}

/**
 * Enfileira uma mudança.
 *
 * `alvo` (opcional) amarra este item aos que vieram antes com o mesmo alvo:
 * enquanto um deles não subir, este não é tentado (SPEC §8).
 *
 * Sem IndexedDB (navegador antigo, aba privada do Firefox) isto **lança**: a
 * versão silenciosa devolvia sem enfileirar e a tela mostrava o registro salvo
 * pelo cache otimista, enquanto a escrita nunca chegava ao Supabase — o
 * contrário de "nada se perde". As telas já tratam o erro do enfileiramento.
 */
export async function enfileirar(tipo: TipoSaida, payload: unknown, alvo?: string) {
  if (!temIndexedDB()) {
    throw new Error(
      "Este navegador não está deixando guardar nada (saia do modo privado).",
    );
  }
  await bd().outbox.add({
    tipo,
    payload,
    tentativas: 0,
    proximaTentativa: Date.now(),
    criadoEm: Date.now(),
    ...(alvo ? { alvo } : {}),
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

/**
 * Uma passada pela fila, na ordem em que os itens foram criados.
 *
 * Um item que não sobe **segura os que vieram depois com o mesmo `alvo`**,
 * tenha ele falhado agora ou só estar esperando o próprio backoff: a série
 * não vai antes da sessão a que pertence (a chave estrangeira do
 * `supabase/schema.sql` recusaria) e a conclusão não vai antes da criação (a
 * criação, reenviada depois, desfaria o fim do treino). Quem espera não gasta
 * tentativa: só adia para o mesmo instante de quem está segurando — e é isso
 * que impede a fila de girar em vazio a cada 250 ms. Itens de outros alvos
 * seguem normalmente, então um item envenenado nunca tranca a fila inteira
 * (SPEC §8).
 */
async function umaRodada(): Promise<number> {
  const enviar = enviador;
  if (!enviar) return 0;

  let enviados = 0;
  const agora = Date.now();
  const pendentes = await bd().outbox.orderBy("criadoEm").toArray();

  /** alvo → quando o item que está segurando a fila vai tentar de novo. */
  const travados = new Map<string, number>();

  for (const item of pendentes) {
    if (item.id === undefined) continue;

    const espera = item.alvo === undefined ? undefined : travados.get(item.alvo);
    if (espera !== undefined) {
      if (item.proximaTentativa !== espera) {
        await bd().outbox.update(item.id, { proximaTentativa: espera });
      }
      continue;
    }

    // ainda no backoff: não é a vez dele nem de quem vem atrás no mesmo alvo
    if (!venceu(item, agora)) {
      if (item.alvo !== undefined) travados.set(item.alvo, item.proximaTentativa);
      continue;
    }

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
      const proximaTentativa = agora + atraso;
      await bd().outbox.update(item.id, {
        tentativas,
        proximaTentativa,
        erro: (e as Error).message,
      });
      if (item.alvo !== undefined) travados.set(item.alvo, proximaTentativa);
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

/** O que a fila tem para mostrar em /mais (SPEC §8). */
export interface EstadoDaFila {
  quantos: number;
  /** O erro do item mais antigo, se ele já falhou alguma vez. */
  erro?: string;
  tentativas?: number;
}

/**
 * O texto da linha "Sincronização" de /mais — puro, para poder ser testado.
 *
 * A fila só aparecia no cabeçalho da sessão de força ("N para sincronizar"):
 * um item com erro permanente (um 400 do PostgREST contra um schema velho)
 * tentaria de 5 em 5 minutos para sempre sem ninguém ver, e o Miguel
 * acreditaria que está tudo sincronizado. Nada se perde — o item fica no
 * IndexedDB —, mas ele precisa poder descobrir.
 */
export function resumoDaFila(estado: EstadoDaFila): {
  titulo: string;
  detalhe: string;
  travada: boolean;
} {
  if (estado.quantos === 0) {
    return { titulo: "Tudo sincronizado", detalhe: "Nada esperando a rede.", travada: false };
  }
  const titulo =
    estado.quantos === 1 ? "1 item esperando" : `${estado.quantos} itens esperando`;
  const travada = (estado.tentativas ?? 0) >= MAX_TENTATIVAS;
  if (travada && estado.erro) {
    return { titulo, detalhe: `Parou de tentar sozinho: ${estado.erro}`, travada };
  }
  if (estado.erro) return { titulo, detalhe: `Última falha: ${estado.erro}`, travada };
  return { titulo, detalhe: "Sobe assim que a rede voltar.", travada };
}

/** O estado da fila para a tela (quantos e o erro do item mais antigo). */
export async function estadoDaFila(): Promise<EstadoDaFila> {
  if (!temIndexedDB()) return { quantos: 0 };
  const quantos = await bd().outbox.count();
  if (quantos === 0) return { quantos: 0 };
  const primeiro = await bd().outbox.orderBy("criadoEm").first();
  return {
    quantos,
    ...(primeiro?.erro ? { erro: primeiro.erro } : {}),
    ...(primeiro ? { tentativas: primeiro.tentativas } : {}),
  };
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
