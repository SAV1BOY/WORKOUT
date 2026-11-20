import { expect, test } from "@playwright/test";
import { entrarNoApp, esperarServiceWorker, irNaAba, resetarMock, usuarioComPerfil } from "./fixtures";
import { workerDoApp } from "./rede-do-worker";

test("uma página pública pedida antes de sair não reaparece no cache da próxima visita", async ({ page, context }) => {
  test.setTimeout(60_000);
  await resetarMock();
  await usuarioComPerfil();
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await irNaAba(page, "Mais");
  const worker = await workerDoApp(context);
  const outraAba = await context.newPage();
  await outraAba.goto("/login");
  await esperarServiceWorker(outraAba);

  const anterior = "/login?ajuda=offline";
  const posterior = "/login?ajuda=entrada";
  const estaGuardada = (caminho: string) => worker.evaluate(async rota => {
    const pedido = new URL(rota, location.origin);
    return !!await caches.match(pedido, { cacheName: "paginas", ignoreVary: true });
  }, caminho);
  const controle = await worker.evaluateHandle(async rota => {
    const endereco = new URL(rota, location.origin).href;
    const rede = self.fetch.bind(self);
    const registro = (self as unknown as ServiceWorkerGlobalScope).registration;
    await registro.navigationPreload.disable();
    const retida = Promise.withResolvers<void>();
    const liberar = Promise.withResolvers<void>();
    self.fetch = async (entrada, opcoes) => {
      const resposta = await rede(entrada, opcoes);
      if (new Request(entrada, opcoes).url === endereco) {
        retida.resolve();
        await liberar.promise;
      }
      return resposta;
    };

    // O documento pode estar visível antes de o worker concluir a escrita em segundo plano.
    const tarefas: Promise<unknown>[] = [];
    const esperar = ExtendableEvent.prototype.waitUntil;
    ExtendableEvent.prototype.waitUntil = function (tarefa) {
      if (this instanceof FetchEvent && this.request.url === endereco) tarefas.push(tarefa);
      return esperar.call(this, tarefa);
    };
    return {
      retida: retida.promise,
      liberar: liberar.resolve,
      async terminarGravacao() {
        await Promise.all(tarefas);
        return tarefas.length;
      },
      restaurar() {
        liberar.resolve();
        self.fetch = rede;
        ExtendableEvent.prototype.waitUntil = esperar;
        return registro.navigationPreload.enable();
      },
    };
  }, anterior);

  try {
    const visita = outraAba.goto(anterior, { waitUntil: "commit" });
    await controle.evaluate(etapa => etapa.retida);
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await estaGuardada(anterior)).toBe(false);

    await controle.evaluate(etapa => etapa.liberar());
    await visita;
    expect(await controle.evaluate(etapa => etapa.terminarGravacao())).toBeGreaterThan(0);
    expect(await estaGuardada(anterior)).toBe(false);

    await outraAba.goto(posterior);
    await expect(outraAba.getByRole("heading", { name: "Treino do Terraço", exact: true })).toBeVisible();
    await expect.poll(() => estaGuardada(posterior)).toBe(true);
    expect(await estaGuardada(anterior)).toBe(false);
  } finally {
    await controle.evaluate(etapa => etapa.restaurar());
  }
});
