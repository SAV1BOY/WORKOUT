import type { BrowserContext, Worker } from "@playwright/test";

/** O service worker que controla a página, como objeto manipulável. */
export async function workerDoApp(context: BrowserContext): Promise<Worker> {
  const [jaRegistrado] = context.serviceWorkers();
  if (jaRegistrado) return jaRegistrado;
  return context.waitForEvent("serviceworker", { timeout: 30_000 });
}

/**
 * Corta a rede DO WORKER. Reaplicável de propósito: o navegador pode parar um
 * service worker ocioso e recomeçá-lo com o `fetch` nativo de volta, então
 * cada navegação do teste chama isto antes.
 */
export async function semRedeNoWorker(worker: Worker): Promise<void> {
  await worker.evaluate(async () => {
    const escopo = self as unknown as {
      fetch: typeof fetch;
      __fetchDeVerdade?: typeof fetch;
      registration: { navigationPreload?: { disable(): Promise<void> } };
    };
    if (!escopo.__fetchDeVerdade) {
      escopo.__fetchDeVerdade = escopo.fetch.bind(self);
    }
    // o preload é o NAVEGADOR quem dispara: trocar `self.fetch` não o alcança
    try {
      await escopo.registration.navigationPreload?.disable();
    } catch {
      // registration sem preload: nada a desligar
    }
    escopo.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
  });
}

/** Devolve a rede ao worker. */
export async function comRedeNoWorker(worker: Worker): Promise<void> {
  await worker.evaluate(() => {
    const escopo = self as unknown as {
      fetch: typeof fetch;
      __fetchDeVerdade?: typeof fetch;
    };
    if (escopo.__fetchDeVerdade) escopo.fetch = escopo.__fetchDeVerdade;
  });
}
