/**
 * A fila de envios do disparo (SPEC §23.15): todas as entregas de um POST do
 * tick (conta × aviso × aparelho) com **concorrência limitada** e um **prazo
 * total** abaixo dos 30 s do `pg_net`. Um aparelho lento não segura os
 * outros: cada envio tem o seu prazo (nunca além do total), e o que não
 * começou até o prazo total fica para o próximo tick (`"adiado"`).
 *
 * Pura de rede: quem envia é `trabalho`, que recebe o sinal de abortar.
 * Usa `setTimeout` e `Date.now` globais (os testes controlam o relógio).
 */

export interface OpcoesDaFila<R> {
  /** Quantos envios ao mesmo tempo. */
  concorrencia: number;
  /** O prazo de um envio (ms). */
  prazoEnvioMs: number;
  /** O prazo de todos (ms), contado do começo da fila. */
  prazoTotalMs: number;
  /** O resultado de um envio que estourou o prazo sem responder. */
  esgotado: R;
}

export const ADIADO = "adiado" as const;

export async function enviarComPrazo<T, R>(
  itens: readonly T[],
  trabalho: (item: T, sinal: AbortSignal) => Promise<R>,
  opcoes: OpcoesDaFila<R>,
): Promise<(R | typeof ADIADO)[]> {
  const fim = Date.now() + opcoes.prazoTotalMs;
  const resultados: (R | typeof ADIADO)[] = itens.map(() => ADIADO);
  let proximo = 0;

  async function um(indice: number): Promise<void> {
    const resta = fim - Date.now();
    if (resta <= 0) return; // fica "adiado"
    const controle = new AbortController();
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const esgotou = new Promise<R>((resolver) => {
      relogio = setTimeout(() => {
        controle.abort();
        resolver(opcoes.esgotado);
      }, Math.min(opcoes.prazoEnvioMs, resta));
    });
    try {
      resultados[indice] = await Promise.race([
        trabalho(itens[indice] as T, controle.signal).catch(() => opcoes.esgotado),
        esgotou,
      ]);
    } finally {
      clearTimeout(relogio);
    }
  }

  async function operario(): Promise<void> {
    while (proximo < itens.length) {
      const indice = proximo;
      proximo += 1;
      if (Date.now() >= fim) continue; // o resto fica "adiado"
      await um(indice);
    }
  }

  const quantos = Math.max(1, Math.min(opcoes.concorrencia, itens.length));
  await Promise.all(Array.from({ length: quantos }, () => operario()));
  return resultados;
}
