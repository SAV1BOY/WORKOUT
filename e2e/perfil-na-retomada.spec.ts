import { expect, test, type Locator, type Page, type Worker } from "@playwright/test";
import { comecarNoPlayer, comecarOTreinoDoDia, entrarNoApp, esperarServiceWorker, fixarData, resetarMock, usuarioComPerfil } from "./fixtures";
import { workerDoApp } from "./rede-do-worker";

type WorkerDaProva = ServiceWorkerGlobalScope & {
  pedidosDePerfil: number;
  restaurarRede: () => void;
};

async function copiasDoPerfil(page: Page, conta: string) {
  return page.evaluate(conta => new Promise<{ geral: boolean; avulsaDaConta: boolean }>((resolve, rejeita) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => rejeita(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const tx = banco.transaction("cache");
      const cache = tx.objectStore("cache");
      const geral = cache.getKey("react-query-v1");
      const avulsa = cache.get(`perfil-lido:${conta}`);
      tx.onabort = () => { banco.close(); rejeita(tx.error); };
      tx.oncomplete = () => {
        banco.close();
        resolve({ geral: geral.result !== undefined, avulsaDaConta: avulsa.result?.valor?.user_id === conta });
      };
    };
  }), conta);
}

async function segurarPerfilERecusarPaginas(worker: Worker, player: string) {
  await worker.evaluate(async player => {
    const escopo = self as unknown as WorkerDaProva;
    await escopo.registration.navigationPreload.disable();
    const original = escopo.fetch.bind(escopo);
    const cancelar = new AbortController();
    escopo.pedidosDePerfil = 0;
    escopo.restaurarRede = () => { escopo.fetch = original; cancelar.abort(); };
    escopo.fetch = async (input, init) => {
      const pedido = input instanceof Request ? input : new Request(input, init);
      const url = new URL(pedido.url);
      if (pedido.method === "GET" && url.pathname === "/rest/v1/profiles") {
        escopo.pedidosDePerfil++;
        const sinal = AbortSignal.any([init?.signal ?? pedido.signal, cancelar.signal]);
        sinal.throwIfAborted();
        return new Promise<Response>((_, rejeita) => {
          sinal.addEventListener("abort", () => rejeita(sinal.reason), { once: true });
        });
      }
      if (url.origin === escopo.location.origin && url.pathname.startsWith("/_next/static/chunks/") && url.pathname.endsWith(".js")) {
        throw new TypeError("JavaScript sem rede");
      }
      if (url.origin === escopo.location.origin && (url.pathname === "/" || url.pathname === player)) {
        // O RSC indisponível faz o Next navegar pelo documento daquela página.
        if (pedido.headers.get("rsc") === "1" || url.searchParams.has("_rsc")) return new Response(null, { status: 503 });
        throw new TypeError("Documento sem rede");
      }
      return original(input, init);
    };
  }, player);
}

async function seguirPelaCopia(page: Page, worker: Worker, link: Locator, caminho: string) {
  const copia = await worker.evaluate(async caminho => {
    const doc = await caches.match(new URL(caminho, location.origin), { cacheName: "paginas", ignoreVary: true });
    return doc?.text();
  }, caminho);
  expect(copia, `O aparelho guardou o documento de ${caminho}`).toBeTruthy();
  const [resposta] = await Promise.all([
    page.waitForResponse(r => r.request().resourceType() === "document" && new URL(r.url()).pathname === caminho),
    link.click(),
  ]);
  expect(resposta.fromServiceWorker()).toBe(true);
  expect(await resposta.text() === copia, "O documento servido corresponde à página guardada").toBe(true);
}

test("Sem conexão → Continuar recupera a série com o perfil avulso enquanto a rede não responde", async ({ page, context }) => {
  test.slow(); // Aquece os dois documentos e reabre ambos pelo fluxo de retomada.
  await page.addInitScript(() => {
    const gravar = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "cache" && args[0]?.chave === "react-query-v1") {
        throw new DOMException("Sem espaço para o cache geral", "QuotaExceededError");
      }
      return gravar.apply(this, args);
    };
  });
  await resetarMock();
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0 } });
  await fixarData(page);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  const player = new URL(page.url()).pathname;
  await page.goto(player);
  await comecarNoPlayer(page);
  await page.goto("/");
  const continuar = page.getByRole("link", { name: "Continuar", exact: true });
  await expect(continuar).toHaveAttribute("href", player);
  await expect.poll(() => copiasDoPerfil(page, conta.userId)).toEqual({ geral: false, avulsaDaConta: true });

  const worker = await workerDoApp(context);
  // O perfil ainda vale no aparelho, mas já precisa ser consultado de novo na rede.
  await fixarData(page, "2026-09-14T08:02:00-03:00");
  await segurarPerfilERecusarPaginas(worker, player);
  try {
    await page.goto("/~offline");
    await expect(page.getByRole("heading", { name: "Sem conexão" })).toBeVisible();
    await seguirPelaCopia(page, worker, page.getByRole("link", { name: "Ir para o Treino" }), "/");
    await expect.poll(() => worker.evaluate(() => (self as unknown as WorkerDaProva).pedidosDePerfil)).toBeGreaterThan(0);
    await expect(continuar).toHaveAttribute("href", player);
    await seguirPelaCopia(page, worker, continuar, player);
    await expect(page.getByRole("button", { name: "Concluir série", exact: true })).toBeVisible();
  } finally {
    await worker.evaluate(() => (self as unknown as WorkerDaProva).restaurarRede());
  }
});
