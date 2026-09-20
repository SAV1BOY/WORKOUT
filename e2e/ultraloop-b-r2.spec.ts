/**
 * Ultraloop 20/09 — Rodada 2, Lote 4 (SPEC §22.4): imagens, mídia e entrega.
 * Um teste por item que se vê (ou que se mede) no navegador.
 */
import { expect, test, type Page, type Response } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  irNaAba,
  resetarMock,
  usuarioComPerfil,
} from "./fixtures";

/** As pastas de mídia de `public/` (SPEC §22.4 item 2). */
const MIDIA = /\/(fotos|ilustracoes|itens|figuras|icons|mapa-muscular)\//;

test.beforeEach(async () => {
  await resetarMock();
});

/** Soma o que cada resposta de imagem custou, em bytes. */
function contarMidia(page: Page) {
  const respostas: { url: string; status: number; bytes: number }[] = [];
  const aoResponder = (r: Response) => {
    const url = new URL(r.url()).pathname;
    if (!MIDIA.test(url)) return;
    const tamanho = Number(r.headers()["content-length"] ?? 0);
    respostas.push({ url, status: r.status(), bytes: Number.isFinite(tamanho) ? tamanho : 0 });
  };
  page.on("response", aoResponder);
  return respostas;
}

/**
 * O que as `<img>` da tela realmente baixaram, em bytes.
 *
 * Não dá para somar toda resposta de `/fotos`: depois de entrar, o app aquece
 * o cache das fotos do programa da fase (SPEC §8, `AquecerMidia`) com `fetch`,
 * e são 2,5 MB que ninguém está esperando na tela. O `initiatorType` separa os
 * dois: `img` é o que a página pediu para desenhar.
 */
async function bytesDasImagens(page: Page): Promise<{ kb: number; quantas: number }> {
  return page.evaluate(() => {
    const recursos = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];
    const daTela = recursos.filter((r) => r.initiatorType === "img");
    const bytes = daTela.reduce(
      (s, r) => s + (r.encodedBodySize || r.transferSize || 0),
      0,
    );
    return { kb: bytes / 1024, quantas: daTela.length };
  });
}

test("§22.4-1: o Explorar fecha abaixo de 200 kB de imagem e sem nenhum 404", async ({
  page,
}) => {
  await usuarioComPerfil();
  await fixarData(page);
  const respostas = contarMidia(page);
  await entrarNoApp(page);
  await irNaAba(page, "Explorar");
  await expect(page.getByRole("region", { name: "Explorar" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  const quebradas = respostas.filter((r) => r.status >= 400);
  expect(quebradas, `mídia quebrada: ${quebradas.map((r) => r.url).join(", ")}`).toEqual([]);

  const { kb, quantas } = await bytesDasImagens(page);
  expect(kb, `imagens do Explorar: ${kb.toFixed(0)} kB em ${quantas} arquivos`).toBeLessThan(
    200,
  );
});

test("§22.4-1: a capa do treino de hoje vem da derivada, com o dobro da caixa", async ({
  page,
}) => {
  await usuarioComPerfil();
  await fixarData(page);
  await entrarNoApp(page);
  await esperarAbaTreino(page);

  const capa = page.locator("article[data-capa] img").first();
  await expect(capa).toBeVisible();
  const medida = await capa.evaluate((el) => {
    const img = el as HTMLImageElement;
    return {
      src: new URL(img.currentSrc || img.src).pathname,
      natural: img.naturalWidth,
      caixa: img.getBoundingClientRect().width,
      dpr: window.devicePixelRatio,
    };
  });
  expect(medida.src).toMatch(/-capa\.webp$/);
  // a caixa tem ~326 px a 360 de tela; 2× disso é o mínimo para o retina
  expect(medida.natural).toBeGreaterThanOrEqual(medida.caixa * 2);
});

test("§22.4-2: a segunda navegação não revalida nenhuma imagem", async ({ page }) => {
  await usuarioComPerfil();
  await fixarData(page);
  await entrarNoApp(page);
  await esperarAbaTreino(page);
  await page.waitForLoadState("networkidle");

  const cabecalho = (
    await page.request.get("/fotos/agachamento-livre-1-mini.webp")
  ).headers()["cache-control"];
  expect(cabecalho).toBe("public, max-age=604800, stale-while-revalidate=86400");

  // segunda passagem pela mesma tela: o cache do navegador responde sozinho
  const respostas = contarMidia(page);
  await irNaAba(page, "Explorar");
  await irNaAba(page, "Treino");
  await esperarAbaTreino(page);
  await page.waitForLoadState("networkidle");

  const revalidadas = respostas.filter(
    (r) => r.status === 304 && /\/(fotos|ilustracoes)\//.test(r.url),
  );
  expect(
    revalidadas,
    `revalidações 304: ${revalidadas.map((r) => r.url).join(", ")}`,
  ).toEqual([]);
});

test("§22.4-3: toda imagem de exercício diz o tamanho e decodifica fora da linha", async ({
  page,
}) => {
  await usuarioComPerfil();
  await fixarData(page);
  await entrarNoApp(page);
  await esperarAbaTreino(page);

  const semAtributo = await page.evaluate(() => {
    const falhas: string[] = [];
    for (const img of document.querySelectorAll("img")) {
      const src = new URL(img.src).pathname;
      if (!/\/(fotos|ilustracoes|itens|figuras)\//.test(src)) continue;
      if (!img.getAttribute("width") || !img.getAttribute("height")) {
        falhas.push(`sem width/height: ${src}`);
      }
      if (img.getAttribute("decoding") !== "async" && img.loading !== "eager") {
        falhas.push(`sem decoding=async: ${src}`);
      }
    }
    return falhas;
  });
  expect(semAtributo).toEqual([]);
});

test("§22.4-3: a capa da primeira dobra é eager e prioritária; as outras, lazy", async ({
  page,
}) => {
  await usuarioComPerfil();
  await fixarData(page);
  await entrarNoApp(page);
  await page.goto("/treinar");
  await expect(page.getByRole("heading", { name: "Treinar", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");

  const capas = await page.evaluate(() =>
    [...document.querySelectorAll("article[data-capa] img")].map((el) => {
      const img = el as HTMLImageElement;
      return {
        loading: img.getAttribute("loading"),
        prioridade: img.getAttribute("fetchpriority"),
        etiqueta: Boolean(img.closest("article")?.querySelector("span.bg-primary")),
      };
    }),
  );
  expect(capas.length).toBeGreaterThan(1);
  const primeiras = capas.filter((c) => c.loading === "eager");
  expect(primeiras.length).toBe(1);
  expect(primeiras[0]?.prioridade).toBe("high");
  for (const c of capas.filter((c) => c.loading !== "eager")) {
    expect(c.loading).toBe("lazy");
  }
});

test("§22.4-4: a miniatura não encolhe a ilustração alta e não mistura enquadramento", async ({
  page,
}) => {
  await usuarioComPerfil();
  await fixarData(page);
  await entrarNoApp(page);
  await page.goto("/exercicios");
  await expect(page.locator("[data-midia]").first()).toBeVisible();
  await page.waitForLoadState("networkidle");

  const medidas = await page.evaluate(() => {
    const itens: { tipo: string; fit: string; razao: number }[] = [];
    for (const caixa of document.querySelectorAll("[data-midia]")) {
      const img = caixa.querySelector("img");
      if (!img || !img.complete || img.naturalWidth === 0) continue;
      const larguraDaCaixa = caixa.getBoundingClientRect().width;
      const fit = getComputedStyle(img).objectFit;
      // quanto da caixa a figura realmente ocupa
      const escala =
        fit === "contain"
          ? Math.min(
              larguraDaCaixa / img.naturalWidth,
              caixa.getBoundingClientRect().height / img.naturalHeight,
            )
          : 0;
      const usada = fit === "contain" ? img.naturalWidth * escala : larguraDaCaixa;
      itens.push({
        tipo: caixa.getAttribute("data-midia") ?? "",
        fit,
        razao: usada / larguraDaCaixa,
      });
    }
    return itens;
  });

  expect(medidas.length).toBeGreaterThan(5);
  for (const m of medidas) {
    expect(m.razao, `${m.tipo} ocupando ${(m.razao * 100).toFixed(0)} %`).toBeGreaterThan(0.6);
  }
  const enquadramentos = new Set(
    medidas.filter((m) => m.tipo === "foto" || m.tipo === "ilustracao").map((m) => m.fit),
  );
  expect([...enquadramentos]).toEqual(["cover"]);
});

test("§22.4-5: o manifest tem atalhos e o ícone maskable de 192", async ({ page }) => {
  const manifesto = (await (await page.request.get("/manifest.webmanifest")).json()) as {
    shortcuts?: { name: string; url: string }[];
    icons: { sizes: string; purpose?: string }[];
  };
  expect(manifesto.shortcuts?.map((a) => a.url)).toEqual(["/", "/relatorio", "/corpo"]);
  expect(
    manifesto.icons.some((i) => i.sizes === "192x192" && i.purpose === "maskable"),
  ).toBe(true);
});

test("§22.4-6: /favicon.ico responde imagem", async ({ page }) => {
  const r = await page.request.get("/favicon.ico");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toMatch(/^image\//);
  expect((await r.body()).byteLength).toBeGreaterThan(100);
});

test("§22.4-7: nenhum rótulo acessível em inglês", async ({ page }) => {
  await usuarioComPerfil();
  await fixarData(page);
  await entrarNoApp(page);
  await esperarAbaTreino(page);

  const ingleses = await page.evaluate(() => {
    const suspeito = /\b(notifications?|close|open|previous|next|loading|search|menu|settings)\b/i;
    const achados: string[] = [];
    for (const el of document.querySelectorAll("[aria-label]")) {
      const rotulo = el.getAttribute("aria-label") ?? "";
      if (suspeito.test(rotulo)) achados.push(rotulo);
    }
    return achados;
  });
  expect(ingleses).toEqual([]);
});

test("§22.4-8: o boneco antigo não sai mais no HTML de toda página", async ({ page }) => {
  await usuarioComPerfil();
  await fixarData(page);
  await entrarNoApp(page);
  await esperarAbaTreino(page);

  const html = await page.content();
  expect(html).not.toContain('id="bf"');
  expect(html).not.toContain('id="bb"');
  // o mapa anatômico da ficha continua inline uma vez
  expect(html).toContain('id="mapa-anatomico"');
});
