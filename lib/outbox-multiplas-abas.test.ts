import { afterEach, expect, it, vi } from "vitest";
import type { ItemSaida } from "@/lib/db";

const fila = vi.hoisted(() => new Map<number, ItemSaida>());
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  bd: () => ({
    outbox: {
      toArray: async () => [...fila.values()],
      delete: async (id: number) => { fila.delete(id); },
      orderBy: () => ({
        limit: (quantos: number) => ({
          toArray: async () => [...fila.values()].sort((a, b) => a.proximaTentativa - b.proximaTentativa).slice(0, quantos),
        }),
      }),
    },
  }),
}));

function sinal() {
  let liberar!: () => void;
  const espera = new Promise<void>((resolve) => { liberar = resolve; });
  return { espera, liberar };
}

afterEach(() => {
  fila.clear();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("a restauração de uma troca na segunda aba espera o envio da primeira e prevalece no servidor", async () => {
  vi.useFakeTimers();
  const primeiraEmVoo = sinal();
  const liberarPrimeira = sinal();
  const segundaPediuLock = sinal();
  const turnos = new Map<string, Promise<unknown>>();
  let pedidosDeLock = 0;
  vi.stubGlobal("navigator", {
    onLine: true,
    locks: {
      request(nome: string, executar: () => Promise<unknown>) {
        if (++pedidosDeLock === 2) segundaPediuLock.liberar();
        const anterior = turnos.get(nome) ?? Promise.resolve();
        const turno = anterior.then(executar);
        turnos.set(nome, turno);
        return turno;
      },
    },
  });

  // Duas instâncias têm seus próprios flags e timers, e compartilham apenas
  // o IndexedDB, o Web Locks do navegador e o valor confirmado no servidor.
  const abaA = await import("@/lib/outbox");
  vi.resetModules();
  const abaB = await import("@/lib/outbox");
  const mudancasDeB: string[] = [];
  let lembradaNoServidor: string | null = null;
  function confirmar(item: ItemSaida) {
    const { op } = item.payload as { op: "upsert" | "delete" };
    lembradaNoServidor = op === "upsert" ? "flexao-de-braco" : null;
    return op;
  }
  abaA.definirEnviador(async (item) => {
    primeiraEmVoo.liberar();
    await liberarPrimeira.espera;
    confirmar(item);
  });
  abaB.definirEnviador(async (item) => { mudancasDeB.push(confirmar(item)); });
  const alvo = "trocas_do_programa:ana:A1:supino-reto-com-barra";
  const item = { tipo: "troca_do_programa" as const, alvo, tentativas: 0, criadoEm: 0, proximaTentativa: 0 };
  fila.set(1, { ...item, id: 1, payload: { op: "upsert" } });
  const envioA = abaA.processar();
  await primeiraEmVoo.espera;

  fila.set(2, { ...item, id: 2, payload: { op: "delete" } });
  const envioB = abaB.processar();
  // Sem o lock, B termina tudo antes de A e o upsert atrasado recria a troca.
  await Promise.race([segundaPediuLock.espera, envioB]);
  const antesDeLiberarA = [...mudancasDeB];
  liberarPrimeira.liberar();
  await Promise.all([envioA, envioB]);

  expect.soft(antesDeLiberarA).toEqual([]);
  expect.soft(mudancasDeB).toEqual(["delete"]);
  expect.soft(lembradaNoServidor).toBeNull();
  expect(fila.size).toBe(0);
});
