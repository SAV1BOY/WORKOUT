/**
 * A fila de envios do disparo (SPEC §23.15, aceite 3): concorrência limitada,
 * prazo por envio e prazo total — um aparelho que não responde não segura os
 * outros, e o que não coube no prazo fica "adiado" (não é marcado).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADIADO, enviarComPrazo } from "@/lib/lembretes-envio";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Responde depois de `ms` (ou nunca, com `Infinity`), respeitando o abortar. */
function demora(ms: number, valor: string) {
  return (sinal: AbortSignal) =>
    new Promise<string>((resolver, rejeitar) => {
      sinal.addEventListener("abort", () => rejeitar(new Error("abortado")));
      if (Number.isFinite(ms)) setTimeout(() => resolver(valor), ms);
    });
}

describe("enviarComPrazo", () => {
  it("todos respondem: a ordem dos resultados é a dos itens", async () => {
    const r = enviarComPrazo([30, 10, 20], (ms, s) => demora(ms, `ok${ms}`)(s), {
      concorrencia: 2,
      prazoEnvioMs: 1000,
      prazoTotalMs: 5000,
      esgotado: "esgotado",
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(await r).toEqual(["ok30", "ok10", "ok20"]);
  });

  it("nunca passa da concorrência", async () => {
    let agora = 0;
    let pico = 0;
    const r = enviarComPrazo(
      Array.from({ length: 20 }, (_, i) => i),
      async () => {
        agora += 1;
        pico = Math.max(pico, agora);
        await new Promise((ok) => setTimeout(ok, 50));
        agora -= 1;
        return "ok";
      },
      { concorrencia: 8, prazoEnvioMs: 1000, prazoTotalMs: 5000, esgotado: "esgotado" },
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(await r).toEqual(Array(20).fill("ok"));
    expect(pico).toBe(8);
  });

  it("aparelhos que não respondem estouram o prazo do envio e não seguram os outros", async () => {
    // os 3 primeiros nunca respondem; os 9 seguintes respondem em 10 ms
    const itens = [...Array(3).fill(Infinity), ...Array(9).fill(10)] as number[];
    const r = enviarComPrazo(itens, (ms, s) => demora(ms, "ok")(s), {
      concorrencia: 8,
      prazoEnvioMs: 10_000,
      prazoTotalMs: 20_000,
      esgotado: "esgotado",
    });
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await r).toEqual([...Array(3).fill("esgotado"), ...Array(9).fill("ok")]);
  });

  it("o prazo total: o que não começou fica adiado, e o que começou tarde tem prazo encurtado", async () => {
    // concorrência 1 e 3 envios lentos de 8 s num total de 12 s
    const r = enviarComPrazo([8000, 8000, 8000], (ms, s) => demora(ms, "ok")(s), {
      concorrencia: 1,
      prazoEnvioMs: 10_000,
      prazoTotalMs: 12_000,
      esgotado: "esgotado",
    });
    await vi.advanceTimersByTimeAsync(12_001);
    expect(await r).toEqual(["ok", "esgotado", ADIADO]);
  });

  it("um trabalho que lança vira esgotado (nunca derruba a fila)", async () => {
    const r = enviarComPrazo(
      [1, 2],
      async (n) => {
        if (n === 1) throw new Error("falhou");
        return "ok";
      },
      { concorrencia: 2, prazoEnvioMs: 100, prazoTotalMs: 1000, esgotado: "esgotado" },
    );
    await vi.advanceTimersByTimeAsync(1);
    expect(await r).toEqual(["esgotado", "ok"]);
  });
});
