/**
 * Sem conexão de verdade: o que o **service worker** serve quando a rede dele
 * cai (SPEC §8, §22.1 e §22.10).
 *
 * Por que este arquivo existe: em 20/09/2026 ficou registrado que os testes
 * não conseguiam cortar a rede DO WORKER — `context.setOffline(true)` e
 * `context.route(...).abort()` só alcançam as requisições da PÁGINA, e o
 * worker continuava trazendo `/mais/contas` do servidor, inteira. O que
 * faltava era entrar no worker: o Playwright expõe cada service worker como um
 * `Worker`, e `worker.evaluate` roda DENTRO dele. De lá dá para desligar o
 * navigation preload (que é o navegador quem faz, não o worker) e trocar
 * `self.fetch` por uma função que rejeita — é assim que se simula "sem rede"
 * para quem serve. Com isso, o caminho que o dono fotografou em 21/09 (a tela
 * "Sem conexão" sem ícone e sem botões) fica preso aqui.
 *
 * A escada da §22.10, de cima para baixo:
 *   (a) mais uma ida à rede   → coberta pelo passo 5 (a rede volta e a tela vem)
 *   (b) o precache            → passo 2
 *   (c) qualquer cache        → o passo 4 apaga TODA cópia, para chegar em (d)
 *   (d) o socorro embutido    → passo 4, agora com os dois botões
 *
 * Os outros dois casos do arquivo vieram da auditoria de 21/09, que mostrou
 * que o teste acima chega no degrau (d) apagando a `/~offline` à mão — e nunca
 * pelo gatilho de verdade, o "Sair". São eles que prendem a **causa** (o
 * logout não pode levar o app junto) e a **autocura** (a cópia própria da
 * página, que até então era código inalcançável).
 */
import { expect, test, type BrowserContext, type Worker } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  esperarServiceWorker,
  fixarData,
  irNaAba,
  resetarMock,
  usuarioComPerfil,
} from "./fixtures";

/** Segunda, 14/09/2026: o primeiro dia do programa (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";

test.beforeEach(async () => {
  await resetarMock();
});

/** O service worker que controla a página, como objeto manipulável. */
async function workerDoApp(context: BrowserContext): Promise<Worker> {
  const [jaRegistrado] = context.serviceWorkers();
  if (jaRegistrado) return jaRegistrado;
  return context.waitForEvent("serviceworker", { timeout: 30_000 });
}

/**
 * Corta a rede DO WORKER. Reaplicável de propósito: o navegador pode parar um
 * service worker ocioso e recomeçá-lo com o `fetch` nativo de volta, então
 * cada navegação do teste chama isto antes.
 */
async function semRedeNoWorker(worker: Worker): Promise<void> {
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
async function comRedeNoWorker(worker: Worker): Promise<void> {
  await worker.evaluate(() => {
    const escopo = self as unknown as {
      fetch: typeof fetch;
      __fetchDeVerdade?: typeof fetch;
    };
    if (escopo.__fetchDeVerdade) escopo.fetch = escopo.__fetchDeVerdade;
  });
}

/** Quantas cópias da `/~offline` existem no aparelho, em qualquer cache. */
async function copiasDaOffline(worker: Worker): Promise<number> {
  return worker.evaluate(async () => {
    let quantas = 0;
    for (const nome of await caches.keys()) {
      const cache = await caches.open(nome);
      for (const pedido of await cache.keys()) {
        if (new URL(pedido.url).pathname === "/~offline") quantas += 1;
      }
    }
    return quantas;
  });
}

/** Apaga TODA cópia da `/~offline` — inclusive a do precache do Serwist. */
async function apagarAOffline(worker: Worker): Promise<number> {
  return worker.evaluate(async () => {
    let apagadas = 0;
    for (const nome of await caches.keys()) {
      const cache = await caches.open(nome);
      for (const pedido of await cache.keys()) {
        if (new URL(pedido.url).pathname === "/~offline") {
          if (await cache.delete(pedido)) apagadas += 1;
        }
      }
    }
    return apagadas;
  });
}

/** Quantas entradas cada cache do aparelho tem, por nome. */
async function inventarioDeCaches(worker: Worker): Promise<Record<string, number>> {
  return worker.evaluate(async () => {
    const tudo: Record<string, number> = {};
    for (const nome of await caches.keys()) {
      const cache = await caches.open(nome);
      tudo[nome] = (await cache.keys()).length;
    }
    return tudo;
  });
}

/** Os caminhos guardados num cache. */
async function caminhosDoCache(worker: Worker, nome: string): Promise<string[]> {
  return worker.evaluate(async (qual) => {
    if (!(await caches.keys()).includes(qual)) return [];
    const cache = await caches.open(qual);
    return (await cache.keys()).map((pedido) => new URL(pedido.url).pathname);
  }, nome);
}

/** O nome completo do precache do Serwist neste aparelho, se existir. */
function oPrecache(inventario: Record<string, number>): [string, number] | undefined {
  return Object.entries(inventario).find(([nome]) => nome.startsWith("serwist-precache"));
}

/**
 * Apaga TODO o Cache Storage de dentro do worker — o que o navegador faz
 * sozinho sob pressão de disco. Devolve quantos caches foram embora.
 */
async function apagarTodosOsCaches(worker: Worker): Promise<number> {
  return worker.evaluate(async () => {
    const nomes = await caches.keys();
    for (const nome of nomes) await caches.delete(nome);
    return nomes.length;
  });
}

test.describe("a rede do worker cai (SPEC §22.10)", () => {
  test("a escada devolve tela com saída, e o socorro não é mais um beco", async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await esperarServiceWorker(page);

    /*
     * A aba Treino pedida como DOCUMENTO (e não pela troca de tela do
     * roteador): é assim que ela entra no cache "paginas" com a chave "/", que
     * é o que o passo 3 vai buscar.
     */
    await page.goto("/");
    await esperarAbaTreino(page);

    const worker = await workerDoApp(context);
    expect(await copiasDaOffline(worker), "a /~offline tem de estar guardada").toBeGreaterThan(0);

    // ---- 1. sem rede para o worker ------------------------------------
    await semRedeNoWorker(worker);

    // ---- 2. uma rota nunca visitada: precache (degrau b) --------------
    await page.goto("/mais/contas", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Sem conexão" }),
      "a rota sem rede tem de dar a tela de Sem conexão, não a página de erro",
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o Treino" })).toBeVisible();
    /*
     * E é a `/~offline` DE VERDADE, não o socorro embutido: ela vem do Next,
     * com folha de estilo e o ícone. Sem esta linha o passo 2 passaria mesmo se
     * o precache tivesse falhado, e o degrau (b) ficaria sem prova.
     */
    expect(
      await page.locator('link[rel="stylesheet"]').count(),
      "o degrau (b) tem de servir a página do precache, não o socorro",
    ).toBeGreaterThan(0);

    // ---- 3. troca de tela por clique (o fetch de RSC, §22.1) ----------
    await semRedeNoWorker(worker);
    await page.getByRole("link", { name: "Ir para o Treino" }).click();
    /*
     * O RSC leva 503, o roteador desiste da navegação suave e recarrega a URL:
     * a segunda ida é um documento, e "/" está no cache "paginas". O app volta
     * inteiro — em nenhum momento a página de erro do navegador.
     */
    await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
    await esperarAbaTreino(page);

    // ---- 4. sem NENHUMA cópia da /~offline: o socorro embutido --------
    expect(await apagarAOffline(worker)).toBeGreaterThan(0);
    expect(await copiasDaOffline(worker)).toBe(0);
    await semRedeNoWorker(worker);
    await page.goto("/mais/senha", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Sem conexão" }),
      "sem precache e sem cache, o socorro embutido tem de aparecer",
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("O treino continua")).toBeVisible();

    // é o socorro embutido mesmo: nada vindo de fora, estilo só inline
    expect(await page.locator('link[rel="stylesheet"]').count()).toBe(0);
    expect(await page.locator("script[src]").count()).toBe(0);
    expect(await page.locator("style").first().textContent()).toContain(
      "--fundo:rgb(224,224,221)",
    );

    // e tem as DUAS saídas, cada uma com alvo de 44 px (SPEC §11)
    const tentar = page.getByRole("button", { name: "Tentar de novo" });
    const irTreino = page.getByRole("link", { name: "Ir para o Treino" });
    await expect(tentar).toBeVisible();
    await expect(irTreino).toBeVisible();
    for (const alvo of [tentar, irTreino]) {
      const caixa = await alvo.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(240);
    }
    // a 360 px nada vaza para o lado
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);

    // ---- 5. a rede volta: "Tentar de novo" traz a tela inteira --------
    await comRedeNoWorker(worker);
    await tentar.click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Trocar senha" }),
      "com a rede de volta, o botão tem de trazer a tela pedida",
    ).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).pathname).toBe("/mais/senha");
  });

  /*
   * A CAUSA, e não o sintoma. O "Sair" apagava todos os caches menos o de
   * mídia — inclusive o precache, que é o app inteiro assado no build. Medido
   * na auditoria de 21/09: 154 entradas viravam cache inexistente, e o
   * aparelho ficava sem PWA até o deploy seguinte, porque o Serwist só repõe o
   * precache numa instalação nova e o `sw.js` não muda de bytes sozinho.
   * Quem saísse da conta não abria mais nada offline.
   */
  test("o 'Sair' leva o que é do usuário e deixa o app no aparelho", async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await esperarServiceWorker(page);

    // a aba Treino pedida como DOCUMENTO: é assim que "/" entra no cache "paginas"
    await page.goto("/");
    await esperarAbaTreino(page);

    const worker = await workerDoApp(context);
    const antes = await inventarioDeCaches(worker);
    const precache = oPrecache(antes);
    expect(precache, "o precache do Serwist tem de existir antes do logout").toBeDefined();
    expect(precache![1]).toBeGreaterThan(0);
    expect(await caminhosDoCache(worker, "paginas")).toContain("/");
    // a cópia própria da /~offline nasce na ativação (a autocura alcança o aparelho)
    await expect
      .poll(async () => (await inventarioDeCaches(worker)).socorro ?? 0, { timeout: 20_000 })
      .toBeGreaterThan(0);

    // ---- o "Sair" de verdade, o gatilho documentado ------------------
    await irNaAba(page, "Mais");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    const depois = await inventarioDeCaches(worker);
    expect(depois[precache![0]], "o precache é build estático: fica").toBe(precache![1]);
    expect(depois.socorro ?? 0, "a cópia de socorro é pública: fica").toBeGreaterThan(0);
    /*
     * E o que é do usuário foi embora, que é o ponto da §8: a aba Treino que
     * ele visitou não pode continuar legível offline num celular emprestado.
     */
    expect(await caminhosDoCache(worker, "paginas")).not.toContain("/");

    // ---- e, sem rede, o aparelho ainda abre o app --------------------
    await semRedeNoWorker(worker);
    await page.goto("/mais/contas", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Sem conexão" }),
      "depois de sair e sem rede, ainda tem de haver tela",
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o Treino" })).toBeVisible();
    /*
     * A prova de que o precache sobreviveu: é a `/~offline` do Next, com folha
     * de estilo e ícone — não o HTML embutido que o dono fotografou.
     */
    expect(
      await page.locator('link[rel="stylesheet"]').count(),
      "depois do 'Sair' a página tem de vir do precache, não do socorro embutido",
    ).toBeGreaterThan(0);
  });

  /*
   * A autocura (SPEC §22.10, `lib/sw-cura.ts`). Até a auditoria de 21/09 ela
   * era código inalcançável: só rodava no `activate`, onde o precache acabou
   * de ser preenchido, e saía sem guardar nada. Aqui o precache some DEPOIS da
   * ativação — que é o caso para o qual ela existe — e uma navegação normal
   * repõe a cópia própria.
   */
  test("o worker repõe a cópia da /~offline quando o precache some", async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await esperarServiceWorker(page);

    const worker = await workerDoApp(context);
    await expect
      .poll(async () => (await inventarioDeCaches(worker)).socorro ?? 0, { timeout: 20_000 })
      .toBeGreaterThan(0);

    // ---- o aparelho perde TODA cópia, inclusive a própria -------------
    await worker.evaluate(() => caches.delete("socorro"));
    expect(await apagarAOffline(worker)).toBeGreaterThan(0);
    expect(await copiasDaOffline(worker)).toBe(0);

    // ---- uma navegação que chega ao servidor: a cura repõe -----------
    await page.goto("/mais", { waitUntil: "domcontentloaded" });
    await expect
      .poll(async () => (await inventarioDeCaches(worker)).socorro ?? 0, { timeout: 30_000 })
      .toBeGreaterThan(0);

    // ---- e é ela que segura a tela quando a rede cai -----------------
    await semRedeNoWorker(worker);
    await page.goto("/mais/senha", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Sem conexão" }),
      "a cópia reposta tem de aparecer no degrau (c)",
    ).toBeVisible({ timeout: 20_000 });
    expect(
      await page.locator('link[rel="stylesheet"]').count(),
      "é a /~offline de verdade, vinda do cache socorro",
    ).toBeGreaterThan(0);
    await expect(page.getByRole("link", { name: "Ir para o Treino" })).toBeVisible();
  });

  /*
   * O beco do aparelho despejado (SPEC §22.11), reproduzido em navegador: é a
   * classe de defeito que três portões verdes e um teste de unidade não
   * pegaram duas rodadas seguidas.
   *
   * A unidade prende "os pedaços entram na cópia". O que importa é outra
   * coisa: "o pedido do pedaço vai ser respondido" — e isso só um worker de
   * verdade mostra. Em 21/09 a cópia estava inteira no cache `socorro`, a
   * guarda passava, e mesmo assim a tela virava "Application error": nenhuma
   * rota do worker servia daquele cache. Este teste falha nesse mundo.
   */
  test("aparelho despejado: uma navegação com rede basta para a tela ter saída", async ({
    page,
    context,
  }) => {
    test.setTimeout(180_000);
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await esperarServiceWorker(page);

    const worker = await workerDoApp(context);

    // ---- 1. o navegador despeja o Cache Storage inteiro ---------------
    expect(await apagarTodosOsCaches(worker)).toBeGreaterThan(0);

    /*
     * O precache volta VAZIO: o Serwist só o enche no `install`, e o `sw.js`
     * não muda de bytes fora de um deploy. É esse o estado que quebrava.
     */
    const depoisDoDespejo = await inventarioDeCaches(worker);
    const precache = oPrecache(depoisDoDespejo);
    expect(precache?.[1] ?? 0, "o precache não se enche sozinho").toBe(0);

    // ---- 2. UMA navegação com rede: a autocura repõe a cópia ----------
    await page.goto("/calendario", { waitUntil: "domcontentloaded" });
    /*
     * O HTML é gravado por ÚLTIMO, depois dos pedaços (`lib/sw-cura.ts`): é o
     * que garante que nunca exista HTML sem os pedaços dele. Então quem espera
     * é o `/~offline`, e não o número de entradas.
     */
    await expect
      .poll(async () => await caminhosDoCache(worker, "socorro"), {
        timeout: 30_000,
        message: "a autocura tem de repor a /~offline e os pedaços dela",
      })
      .toContain("/~offline");
    const noSocorro = await caminhosDoCache(worker, "socorro");
    expect(
      noSocorro.filter((caminho) => caminho.startsWith("/_next/")).length,
      "a cópia vale pelos pedaços que vêm junto",
    ).toBeGreaterThan(1);

    // ---- 3. a rede do worker cai, e uma rota NUNCA visitada -----------
    const erros: string[] = [];
    page.on("pageerror", (erro) => erros.push(erro.message));
    await semRedeNoWorker(worker);
    await page.goto("/relatorio", { waitUntil: "domcontentloaded" });

    /*
     * A tela tem de ter os dois atos. Antes do conserto vinha o HTML da
     * `/~offline` sem os pedaços: "Loading chunk … failed" e a tela
     * "Application error: a client-side exception has occurred", sem ícone e
     * sem botão nenhum — pior do que o socorro embutido.
     */
    await expect(page.getByRole("heading", { name: "Sem conexão" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o Treino" })).toBeVisible();
    await expect(page.getByText("Application error")).toHaveCount(0);

    // a hidratação tem de terminar: é ela que morria
    await page.waitForTimeout(1_500);
    expect(erros, "nenhum pedaço pode faltar na hidratação").toEqual([]);
  });
});
