import { expect, test } from "@playwright/test";
import { fixarRelogio, login, resetarMock, semRolagemHorizontal } from "./fixtures";

const ITENS = [
  { rotulo: "Hoje", caminho: "/", titulo: "Hoje" },
  { rotulo: "Treinar", caminho: "/treinar", titulo: "Treinar" },
  { rotulo: "Progresso", caminho: "/progresso", titulo: "Progresso" },
  { rotulo: "Corpo", caminho: "/corpo", titulo: "Corpo" },
  { rotulo: "Mais", caminho: "/mais", titulo: "Mais" },
] as const;

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarRelogio(page);
  await login(page);
});

test.describe("shell do app", () => {
  test("a navegação inferior tem os 5 itens com alvos de 44 px", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(nav).toBeVisible();

    const links = nav.getByRole("link");
    await expect(links).toHaveCount(ITENS.length);

    for (const [i, item] of ITENS.entries()) {
      const link = links.nth(i);
      await expect(link).toHaveText(new RegExp(item.rotulo));
      const caixa = await link.boundingBox();
      expect(caixa?.height ?? 0, `${item.rotulo} menor que 44 px`).toBeGreaterThanOrEqual(44);
      expect(caixa?.width ?? 0, `${item.rotulo} menor que 44 px`).toBeGreaterThanOrEqual(44);
    }

    // fixa no rodapé, dentro da viewport de 740 px
    const caixaNav = await nav.boundingBox();
    expect(caixaNav?.y ?? 0).toBeGreaterThan(740 - 120);
  });

  for (const item of ITENS) {
    test(`abre ${item.rotulo} pela navegação, sem rolagem horizontal`, async ({ page }) => {
      await page.getByRole("navigation", { name: "Navegação principal" })
        .getByRole("link", { name: item.rotulo })
        .click();

      await expect(page).toHaveURL(
        item.caminho === "/" ? /127\.0\.0\.1:\d+\/$/ : new RegExp(`${item.caminho}$`),
      );
      await expect(page.getByRole("heading", { name: item.titulo })).toBeVisible();
      await expect(
        page.getByRole("link", { name: item.rotulo }),
      ).toHaveAttribute("aria-current", "page");
      await semRolagemHorizontal(page);
    });
  }

  test("as rotas internas do marco 1 também abrem", async ({ page }) => {
    for (const caminho of ["/calendario", "/exercicios", "/barra-fixa"]) {
      await page.goto(caminho);
      await expect(page.locator("h1")).toBeVisible();
      await semRolagemHorizontal(page);
    }
  });

  test("o manifest é válido e instalável", async ({ page, request }) => {
    const resposta = await request.get("/manifest.webmanifest");
    expect(resposta.status()).toBe(200);
    const manifest = (await resposta.json()) as Record<string, unknown>;

    expect(manifest.name).toBe("Treino do Terraço");
    expect(manifest.short_name).toBe("Treino");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("pt-BR");

    const icones = manifest.icons as { src: string; sizes: string; purpose?: string }[];
    expect(icones.length).toBeGreaterThanOrEqual(2);
    expect(icones.some((i) => i.sizes === "192x192")).toBe(true);
    expect(icones.some((i) => i.sizes === "512x512")).toBe(true);
    expect(icones.some((i) => i.purpose === "maskable")).toBe(true);

    for (const icone of icones) {
      const img = await request.get(icone.src);
      expect(img.status(), `ícone ${icone.src} não existe`).toBe(200);
    }

    // a página referencia o manifest
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/manifest.webmanifest",
    );
  });
});

/*
 * Auditoria final: o app não enviava cabeçalho de segurança nenhum — dava para
 * embutir a aplicação num iframe de outro site (clickjacking em cima dos
 * botões que gravam no banco) — e `/robots.txt` devolvia o HTML do app.
 */
test.describe("cabeçalhos e robots (auditoria final)", () => {
  test("toda resposta traz os cabeçalhos de segurança", async ({ request }) => {
    for (const caminho of ["/login", "/robots.txt"]) {
      const resposta = await request.get(caminho);
      const cabecalhos = resposta.headers();
      expect(cabecalhos["x-frame-options"], caminho).toBe("DENY");
      expect(cabecalhos["content-security-policy"], caminho).toContain(
        "frame-ancestors 'none'",
      );
      expect(cabecalhos["x-content-type-options"], caminho).toBe("nosniff");
      expect(cabecalhos["referrer-policy"], caminho).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(cabecalhos["permissions-policy"], caminho).toContain("camera=()");
    }
  });

  test("/robots.txt existe e proíbe tudo", async ({ request }) => {
    const resposta = await request.get("/robots.txt");
    expect(resposta.status()).toBe(200);
    const texto = await resposta.text();
    expect(texto).toContain("User-Agent: *");
    expect(texto).toContain("Disallow: /");
    expect(texto).not.toContain("<html");
  });
});
