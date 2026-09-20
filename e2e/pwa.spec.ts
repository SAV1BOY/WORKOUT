import { expect, test } from "@playwright/test";
import {
  entrarNoApp,
  esperarServiceWorker,
  fixarData,
  resetarMock,
  usuarioComPerfil,
} from "./fixtures";

/** Segunda, 14/09/2026 (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, SEGUNDA);
});

test.describe("PWA e offline (SPEC §8)", () => {
  test("o service worker é servido e o precache leva o shell e as figuras, não as 162 fotos", async ({
    request,
  }) => {
    const resposta = await request.get("/sw.js");
    expect(resposta.status()).toBe(200);
    const codigo = await resposta.text();

    // as figuras dos exercícios entram na instalação (SPEC §8)
    expect(codigo).toContain("/figuras/agachamento-livre.svg");
    expect(codigo).toContain("/icons/icone-512.png");
    // e a página de fallback, senão a navegação offline morre no navegador
    expect(codigo).toContain("/~offline");

    // as fotos do catálogo e do equipamento ficam para o cache sob demanda
    expect(codigo).not.toContain("/fotos/");
    expect(codigo).not.toContain("/itens/");

    // e o Supabase nunca é servido de cache
    expect(codigo).toContain("rest|auth|storage");
  });

  test("o manifest tem cor de tema, id e ícones que existem", async ({ request }) => {
    const manifest = (await (await request.get("/manifest.webmanifest")).json()) as {
      id: string;
      theme_color: string;
      background_color: string;
      orientation: string;
      icons: { src: string }[];
    };
    expect(manifest.id).toBe("/");
    expect(manifest.theme_color).toBe("#0a0a0a");
    expect(manifest.background_color).toBe("#0a0a0a");
    expect(manifest.orientation).toBe("portrait");
    for (const icone of manifest.icons) {
      expect((await request.get(icone.src)).status(), icone.src).toBe(200);
    }
  });

  /**
   * O risco do marco: uma resposta do PostgREST guardada pelo service worker
   * esconderia o que foi gravado depois (SPEC §8). A regra `NetworkOnly` de
   * `app/sw.ts` tem que valer para todo caminho do Supabase.
   */
  test("nenhuma resposta do Supabase fica em cache", async ({ page }) => {
    await usuarioComPerfil();
    await entrarNoApp(page);
    await esperarServiceWorker(page);

    await page.goto("/calendario");
    await page.goto("/relatorio");
    await page.goto("/");
    await page.waitForTimeout(1_000);

    const guardadas = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const nome of await caches.keys()) {
        const cache = await caches.open(nome);
        for (const req of await cache.keys()) urls.push(req.url);
      }
      return urls;
    });

    const doSupabase = guardadas.filter((u) =>
      /\/(rest|auth|storage|realtime)\/v1\//.test(u),
    );
    expect(doSupabase, "o SW guardou resposta do Supabase").toEqual([]);
    // e guardou o que deve: as figuras do programa
    expect(guardadas.some((u) => u.includes("/figuras/"))).toBe(true);
  });

  test("a figura e as fotos do treino de hoje ficam no cache para o terraço", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await entrarNoApp(page);
    await esperarServiceWorker(page);

    /**
     * O aquecimento da fase roda em segundo plano
     * (`lib/precache-do-programa.ts`) e guarda **o que as telas pedem**: desde
     * as derivadas do lote 4 a ficha baixa o WebP, e não o JPEG do kit — que
     * é só a reserva do `onError` (auditoria da rodada 2).
     */
    const noCache = (url: string) =>
      page.evaluate(async (u) => {
        for (const nome of await caches.keys()) {
          const cache = await caches.open(nome);
          if (await cache.match(u)) return true;
        }
        return false;
      }, url);

    await expect
      .poll(() => noCache("/fotos/agachamento-livre-1.webp"), { timeout: 20_000 })
      .toBe(true);
    expect(
      await noCache("/fotos/agachamento-livre-1.jpg"),
      "o aquecimento baixou o JPEG do kit, que nenhuma tela pede",
    ).toBe(false);
  });

  test("sem rede, o app continua abrindo e o que está fora dele cai na ~offline", async ({
    page,
    context,
  }) => {
    await usuarioComPerfil();
    await entrarNoApp(page);
    await esperarServiceWorker(page);

    await context.setOffline(true);
    try {
      // uma rota do app que nunca foi aberta: o shell está no precache
      await page.goto("/exercicios");
      await expect(page.getByRole("heading", { name: "Exercícios" })).toBeVisible();

      /*
       * E a página de offline está no precache — é ela que o service worker
       * serve quando a navegação não tem de onde vir (SPEC §8). Numa rota que
       * não existe o HTML servido é este mesmo, e depois o Next hidrata e
       * mostra o 404 dele; por isso o teste abre a `/~offline` direto.
       */
      await page.goto("/~offline");
      await expect(page.getByRole("heading", { name: "Sem conexão" })).toBeVisible();
      await expect(page.getByText(/sobe sozinho quando a rede voltar/)).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});
