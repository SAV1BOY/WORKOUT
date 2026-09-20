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

/**
 * As `<img>` de mídia da tela que não dizem o tamanho — ou que dizem o tamanho
 * **errado** (SPEC §22.4 item 3).
 *
 * Dizer qualquer par de números não serve: o navegador reserva a caixa pela
 * proporção dos atributos, então uma medida que não é a do arquivo servido só
 * troca um salto de layout por outro. Nas fotos do kit dá para cobrar o
 * arquivo — `naturalWidth`/`naturalHeight` é o que chegou. (Na ilustração e na
 * figura a medida sai de `data/ilustracoes.json` e do `viewBox`.)
 */
function semTamanho(page: Page) {
  return page.evaluate(() => {
    const falhas: string[] = [];
    for (const img of document.querySelectorAll("img")) {
      const src = new URL(img.currentSrc || img.src).pathname;
      if (!/\/(fotos|ilustracoes|itens|figuras)\//.test(src)) continue;
      const largura = img.getAttribute("width");
      const altura = img.getAttribute("height");
      if (!largura || !altura) {
        falhas.push(`sem width/height: ${src}`);
      }
      if (img.getAttribute("decoding") !== "async" && img.loading !== "eager") {
        falhas.push(`sem decoding=async: ${src}`);
      }
      // já carregada: o que a `<img>` diz tem de ser o que chegou
      const erradaW = Number(largura) !== img.naturalWidth;
      const erradaH = Number(altura) !== img.naturalHeight;
      if (/^\/fotos\//.test(src) && img.naturalWidth > 0 && (erradaW || erradaH)) {
        falhas.push(
          `medida errada: ${src} attr=${largura}x${altura} arquivo=${img.naturalWidth}x${img.naturalHeight}`,
        );
      }
    }
    return falhas;
  });
}

/** Espera toda foto do kit da tela terminar de carregar, para poder medir. */
async function esperarAsFotos(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          [...document.querySelectorAll("img")].filter(
            (i) =>
              /^\/fotos\//.test(new URL(i.currentSrc || i.src).pathname) &&
              i.naturalWidth === 0,
          ).length,
      ),
    )
    .toBe(0);
}

test("§22.4-3: toda imagem de exercício diz o tamanho e decodifica fora da linha", async ({
  page,
}) => {
  await usuarioComPerfil();
  await fixarData(page);
  await entrarNoApp(page);
  await esperarAbaTreino(page);
  expect(await semTamanho(page), "aba Treino").toEqual([]);

  /*
   * A ficha é a tela mais pesada de imagem do app (auditoria do lote 4): as
   * duas fotos de execução, a ilustração ou a figura, e a foto em tela cheia.
   * Duas fichas, de propósito: uma foto de 850×567 (a medida de 152 das 162
   * do kit) e uma de 850×1275, cuja derivada sai 800×1200 — esta é a que
   * pegava o app declarando 850×567 em toda foto.
   */
  for (const exercicio of ["agachamento-livre", "agachamento-bulgaro"]) {
    await page.goto(`/exercicios/${exercicio}`);
    const ampliar = page.getByRole("button", { name: /Ampliar a foto do início/ });
    await ampliar.scrollIntoViewIfNeeded();
    await expect(ampliar).toBeVisible();
    await esperarAsFotos(page);
    expect(await semTamanho(page), `ficha de ${exercicio}`).toEqual([]);

    await ampliar.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await esperarAsFotos(page);
    expect(await semTamanho(page), `foto em tela cheia de ${exercicio}`).toEqual([]);
  }

  // e as fotos dos 10 itens do terraço
  await page.goto("/mais/equipamento");
  await expect(page.locator("li img[src^='/itens/']").first()).toBeVisible();
  expect(await semTamanho(page), "Mais → Equipamento").toEqual([]);
});

/**
 * `serviceWorkers: "block"` neste teste e só nele: o que o service worker
 * serve do cache dele não passa pelo `page.route`, e aqui a foto precisa ficar
 * presa de verdade para a caixa vazia poder ser medida.
 */
test.describe("§22.4-3 com a foto presa na rede", () => {
  test.use({ serviceWorkers: "block" });

  test("§22.4-3: a foto em tela cheia não muda de caixa quando a imagem chega", async ({
    page,
  }) => {
    /*
     * A prova do item, na imagem mais pesada do app e na medida que não é a do
     * resto do kit: a foto fica **presa** na rede, a caixa é medida vazia e só
     * então a imagem é solta. Se os atributos mentirem a proporção, é aqui que
     * a caixa muda de altura — eram 344×229 reservados para uma imagem que
     * entrava com 344×516 (auditoria do lote 4).
     *
     * A rota entra antes de qualquer navegação: o aquecimento da fase (§8)
     * também pede esta foto, e uma resposta guardada no cache do navegador
     * (uma semana, §22.4 item 2) faria a imagem aparecer pronta.
     */
    let soltar = () => {};
    const presa = new Promise<void>((resolver) => {
      soltar = resolver;
    });
    await page.route("**/fotos/agachamento-bulgaro-1.webp", async (rota) => {
      await presa;
      await rota.continue();
    });

    await usuarioComPerfil();
    await fixarData(page);
    await entrarNoApp(page);
    await page.goto("/exercicios/agachamento-bulgaro");
    const ampliar = page.getByRole("button", { name: /Ampliar a foto do início/ });
    await ampliar.scrollIntoViewIfNeeded();
    await expect(ampliar).toBeVisible();
    await ampliar.click();

    const grande = page.getByRole("dialog").locator("img").first();
    await expect(grande).toHaveAttribute("src", "/fotos/agachamento-bulgaro-1.webp");
    const vazia = await grande.evaluate((el) => {
      const img = el as HTMLImageElement;
      return { altura: el.getBoundingClientRect().height, natural: img.naturalWidth };
    });
    expect(vazia.natural, "a foto chegou antes de a caixa ser medida").toBe(0);
    expect(vazia.altura, "a caixa reservada segue a proporção 800×1200").toBeGreaterThan(
      400,
    );

    soltar();
    await expect
      .poll(() => grande.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(800);
    const cheia = await grande.evaluate((el) => el.getBoundingClientRect().height);
    expect(
      Math.abs(cheia - vazia.altura),
      `caixa ${vazia.altura} → ${cheia}`,
    ).toBeLessThan(2);
  });
});

test("§22.4-1: a foto do item do terraço também tem o dobro da caixa", async ({
  page,
}) => {
  await usuarioComPerfil();
  await fixarData(page);
  await entrarNoApp(page);
  await page.goto("/mais/equipamento");
  const foto = page.locator("li img[src^='/itens/']").first();
  await expect(foto).toBeVisible();

  const medida = await foto.evaluate((el) => {
    const img = el as HTMLImageElement;
    return {
      src: new URL(img.currentSrc || img.src).pathname,
      natural: img.naturalWidth,
      caixa: img.getBoundingClientRect().width,
    };
  });
  expect(medida.src).toMatch(/-mini\.webp$/);
  // a caixa é a mesma das outras miniaturas (56 px): a derivada de 112 é 2×
  expect(medida.caixa).toBe(56);
  expect(medida.natural).toBeGreaterThanOrEqual(medida.caixa * 2);
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

test("§22.4-6: /favicon.ico responde imagem e é declarado uma vez só", async ({
  page,
}) => {
  const r = await page.request.get("/favicon.ico");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toMatch(/^image\//);
  expect((await r.body()).byteLength).toBeGreaterThan(100);

  // o App Router já declara `app/favicon.ico`: repetir em `icons`/`shortcut`
  // punha três <link> para o mesmo arquivo no <head> (auditoria do lote 4)
  await page.goto("/login");
  const links = await page.evaluate(() =>
    [...document.querySelectorAll("link")]
      .filter((l) => new URL(l.href, location.origin).pathname === "/favicon.ico")
      .map((l) => l.rel),
  );
  expect(links.length, `rel: ${links.join(", ")}`).toBe(1);
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

test("§22.4-1: a ficha e a foto em tela cheia pedem a derivada WebP", async ({
  page,
}) => {
  await usuarioComPerfil();
  await fixarData(page);
  await entrarNoApp(page);
  await page.goto("/exercicios/agachamento-livre");

  const ampliar = page.getByRole("button", { name: /Ampliar a foto do início/ });
  await ampliar.scrollIntoViewIfNeeded();
  await expect(ampliar).toBeVisible();

  /** As fotos de execução da tela — sem as derivadas de lista e de capa. */
  const fotosDaTela = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("img")]
        .map((el) => {
          const img = el as HTMLImageElement;
          return {
            src: new URL(img.currentSrc || img.src).pathname,
            natural: img.naturalWidth,
          };
        })
        .filter((f) => f.src.startsWith("/fotos/") && !/-(mini|capa)\.webp$/.test(f.src)),
    );

  // lazy: espera as duas terminarem de carregar antes de medir
  await expect
    .poll(async () => (await fotosDaTela()).filter((f) => f.natural === 0).map((f) => f.src))
    .toEqual([]);

  const fotos = await fotosDaTela();
  expect(fotos.length).toBeGreaterThanOrEqual(2);
  for (const f of fotos) {
    expect(f.src, "a ficha ainda pede o JPEG do kit").toMatch(/\.webp$/);
  }

  // e a foto em tela cheia, que é a imagem mais pesada do app
  await ampliar.click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  const grande = dialogo.locator("img").first();
  await expect(grande).toHaveAttribute("src", "/fotos/agachamento-livre-1.webp");
  await expect
    .poll(() => grande.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
});
