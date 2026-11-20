import { createServer, request } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test as base } from "@playwright/test";
import {
  comecarNoPlayer, comecarOTreinoDoDia, entrarNoApp, esperarServiceWorker,
  fixarData, lerDoMock, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { semRedeNoWorker, workerDoApp } from "./rede-do-worker";

type Rede = {
  origem: string;
  reter(caminho: string): void;
  pedidos: string[];
  liberar(): void;
};

// Intercepta o preload nativo do Chromium e o fetch do worker na mesma origem.
// Um route() na página não alcança ambos. Os demais caminhos seguem para o app.
const test = base.extend<{ rede: Rede }>({
  rede: async ({}, usar) => {
    let caminhoRetido: string | undefined;
    const trava = Promise.withResolvers<void>();
    const pedidos: string[] = [];
    const proxy = createServer(async (pedido, resposta) => {
      if (pedido.url === caminhoRetido) {
        pedidos.push(pedido.headers["service-worker-navigation-preload"] ? "preload"
          : pedido.headers.rsc === "1" ? "rsc" : "documento");
        await trava.promise;
      }
      if (resposta.destroyed) return;
      const origem = request({
        hostname: "127.0.0.1", port: Number(process.env.E2E_PORT ?? 3100),
        path: pedido.url, headers: pedido.headers, method: pedido.method,
      }, recebida => {
        resposta.writeHead(recebida.statusCode!, recebida.headers);
        recebida.pipe(resposta);
      });
      origem.on("error", () => resposta.destroy());
      pedido.pipe(origem);
    });
    await new Promise<void>((resolve, reject) => {
      proxy.once("error", reject);
      proxy.listen(0, "127.0.0.1", resolve);
    });
    try {
      await usar({
        origem: `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`,
        reter: caminho => { caminhoRetido = caminho; }, pedidos, liberar: trava.resolve,
      });
    } finally {
      trava.resolve();
      const fechado = new Promise<void>(resolve => proxy.close(() => resolve()));
      proxy.closeAllConnections();
      await fechado;
    }
  },
  baseURL: async ({ rede }, usar) => usar(rede.origem),
});

// O prazo de 8 s tem folga para a CI. Somar a ele os 6 s da retentativa estouraria o limite.
const LIMITE_COM_MARGEM_MS = 13_000;

test("socorro no prazo retoma o mesmo treino e a resposta tardia abre offline", async ({ page, context, rede }) => {
  test.slow();
  await resetarMock();
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0 } });
  await fixarData(page);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  const player = new URL(page.url()).pathname;
  const id = player.split("/").at(-1);
  const worker = await workerDoApp(context);
  const caminho = "/mais/creditos";
  const copia = () => worker.evaluate(async rota => {
    const resposta = await caches.match(new URL(rota, location.origin), { ignoreVary: true });
    return resposta?.headers.get("content-type") ?? null;
  }, caminho);

  expect(await copia()).toBeNull();
  rede.reter(caminho);
  const inicio = performance.now();
  const resposta = await page.goto(caminho, { waitUntil: "commit", timeout: LIMITE_COM_MARGEM_MS });
  expect(performance.now() - inicio, "a navegação ainda dá tempo à origem").toBeGreaterThan(6_000);
  expect(resposta?.fromServiceWorker()).toBe(true);
  expect(rede.pedidos).toContain("preload");
  await expect(page.getByRole("heading", { name: "Sem conexão" })).toBeVisible();
  expect(await copia(), "o socorro não pode entrar no cache sob o endereço de Créditos").toBeNull();

  rede.liberar();
  await expect.poll(copia).toContain("text/html");
  const voltar = page.getByRole("link", { name: "Ir para o Treino" });
  await voltar.focus();
  await expect(voltar).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new URL("/", rede.origem).href);
  await page.getByRole("link", { name: "Continuar", exact: true }).click();
  await expect(page).toHaveURL(new URL(player, rede.origem).href);
  await expect.poll(() => lerDoMock(conta, "sessions", "select=id,status"))
    .toEqual([{ id, status: "em_andamento" }]);

  await semRedeNoWorker(worker);
  await context.setOffline(true);
  const releitura = await page.goto(caminho);
  expect(releitura?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "Créditos" })).toBeVisible();
});

test("o pedido RSC sem cópia recebe 503 enquanto a rede continua presa", async ({ page, rede }) => {
  test.slow();
  await resetarMock();
  await usuarioComPerfil();
  await entrarNoApp(page);
  await esperarServiceWorker(page);

  const caminho = "/mais/creditos?_rsc=rede-retida";
  rede.reter(caminho);
  const resposta = await page.evaluate(async ({ caminho, prazo }) => {
    const r = await fetch(caminho, { headers: { RSC: "1" }, signal: AbortSignal.timeout(prazo) });
    return { status: r.status, tipo: r.headers.get("content-type") ?? "", corpo: await r.text() };
  }, { caminho, prazo: LIMITE_COM_MARGEM_MS });

  expect(rede.pedidos).toContain("rsc");
  expect(resposta.status).toBe(503);
  expect(resposta.tipo).not.toMatch(/text\/(html|x-component)/);
  expect(resposta.corpo).not.toMatch(/<html/i);
});
