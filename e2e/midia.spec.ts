/**
 * O marco Mídia: as ilustrações com licença livre (Everkinetic e wger, CC
 * BY-SA), o mapa muscular anatômico (MuscleMap, MIT) e a tela de créditos.
 *
 * O que estes testes provam: a ficha alterna as duas posições e mostra o
 * crédito, o segmento "Ilustração · Figura · Fotos" troca a demonstração, o
 * mapa pinta primário e secundário do supino, a lista do dia e o player usam a
 * ilustração, e Mais → Créditos lista todas as fontes com seus links.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  comecarNoPlayer,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  irNaAba,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** O mesmo JSON que o app lê: a contagem da tela de créditos sai daqui. */
const ILUSTRACOES = JSON.parse(
  readFileSync(resolve(__dirname, "../data/ilustracoes.json"), "utf8"),
) as { fonte: string; licenca: string }[];

function resumoDaFonte(fonte: string): string {
  const lista = ILUSTRACOES.filter((i) => i.fonte === fonte);
  const licencas = [...new Set(lista.map((i) => i.licenca))].sort().join(" e ");
  return `${licencas} · ${lista.length} exercícios`;
}

/** Segunda, 14/09/2026: primeiro dia do programa, Treino A (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";

/** Tem ilustração das duas posições (Everkinetic, exata) e é do Treino A. */
const SUPINO = "supino-reto-com-barra";
/** Segue com a figura animada do kit: não há ilustração livre para ele. */
const SEM_ILUSTRACAO = "farmer-s-walk";

test.beforeEach(async () => {
  await resetarMock();
});

async function abrir(page: Page, quando = SEGUNDA) {
  await fixarData(page, quando);
  await entrarNoApp(page);
  await esperarAbaTreino(page);
}

test.describe("ficha do exercício (aba Vídeo)", () => {
  test("alterna as duas posições da ilustração e um toque pausa", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await page.goto(`/exercicios/${SUPINO}`);

    const ilustracao = page.locator("[data-ilustracao]").first();
    await expect(ilustracao).toBeVisible();
    await expect(ilustracao).toHaveAttribute("data-ilustracao", "alternando");

    // as duas imagens são as duas posições do arquivo, não um GIF novo; a
    // segunda só entra depois que a primeira carregou (SPEC §22.13 item 4)
    await expect(ilustracao.locator("img")).toHaveCount(2);
    const fontes = await ilustracao.locator("img").evaluateAll((imgs) =>
      imgs.map((i) => (i as HTMLImageElement).getAttribute("src") ?? ""),
    );
    expect(fontes).toHaveLength(2);
    expect(fontes[0]).toMatch(new RegExp(`^/ilustracoes/${SUPINO}-1\\.`));
    expect(fontes[1]).toMatch(new RegExp(`^/ilustracoes/${SUPINO}-2\\.`));

    // sozinha, a figura troca de posição (crossfade de ~1,2 s por posição)
    await expect
      .poll(() => ilustracao.getAttribute("data-posicao"), { timeout: 10_000 })
      .toBe("2");

    // o botão do canto pausa (SPEC §22.13 item 5); parada, ela não troca mais
    await ilustracao.getByRole("button", { name: "Parar a animação" }).click();
    await expect(ilustracao).toHaveAttribute("data-ilustracao", "pausada");
    const parada = await ilustracao.getAttribute("data-posicao");
    await page.waitForTimeout(2_000);
    expect(await ilustracao.getAttribute("data-posicao")).toBe(parada);

    await semRolagemHorizontal(page);
  });

  test("o crédito da ilustração aparece sob a mídia, com link para a fonte", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await page.goto(`/exercicios/${SUPINO}`);

    // SPEC §22.13 item 3: "Ilustração: <autor> · <licença>", dois links
    const credito = page.locator("[data-credito]");
    await expect(credito).toBeVisible();
    await expect(credito).toContainText(/^Ilustração:/);
    const links = credito.getByRole("link");
    await expect(links).toHaveCount(2);
    await expect(links.nth(1)).toContainText("CC BY-SA");
    const href = await links.first().getAttribute("href");
    expect(href).toMatch(/^https:\/\/(commons\.wikimedia\.org|wger\.de)\//);
    expect(await links.nth(1).getAttribute("href")).toMatch(
      /^https:\/\/creativecommons\.org\/licenses\/by-sa\/\d\.\d\/$/,
    );
  });

  test("o segmento troca a demonstração para a figura do kit", async ({ page }) => {
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await page.goto(`/exercicios/${SUPINO}`);

    const segmento = page.getByRole("group", { name: "Como ver o exercício" });
    await expect(segmento.getByRole("button", { name: "Ilustração" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await segmento.getByRole("button", { name: "Figura" }).click();
    await expect(page.locator("[data-ilustracao]")).toHaveCount(0);
    await expect(
      page.locator(`img[src="/figuras/${SUPINO}.svg"]`).first(),
    ).toBeVisible();
  });

  test("sem ilustração a ficha continua com a figura animada", async ({ page }) => {
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await page.goto(`/exercicios/${SEM_ILUSTRACAO}`);

    await expect(page.locator("[data-ilustracao]")).toHaveCount(0);
    await expect(page.locator("[data-credito]")).toHaveCount(0);
    await expect(
      page.locator(`img[src="/figuras/${SEM_ILUSTRACAO}.svg"]`).first(),
    ).toBeVisible();
  });
});

test.describe("aba Músculos — mapa anatômico", () => {
  test("pinta os primários e os secundários do supino", async ({ page }) => {
    await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await page.goto(`/exercicios/${SUPINO}`);

    await page.getByRole("tab", { name: "Músculos" }).click();
    const mapa = page.locator('[data-mapa="anatomico"]');
    await expect(mapa).toBeVisible();

    // o desenho está mesmo na página (o <use> aponta para o símbolo do sprite)
    await expect(page.locator("#mapa-anatomico")).toHaveCount(1);

    const cores = await mapa.evaluate((svg) => {
      const estilo = getComputedStyle(svg);
      const raiz = getComputedStyle(document.documentElement);
      return {
        peito: estilo.getPropertyValue("--m-peito").trim(),
        triceps: estilo.getPropertyValue("--m-triceps").trim(),
        quadriceps: estilo.getPropertyValue("--m-quadriceps").trim(),
        prim: raiz.getPropertyValue("--mprim").trim(),
        sec: raiz.getPropertyValue("--msec").trim(),
      };
    });

    // peito é primário; tríceps e ombro ajudam; a perna não entra
    expect(cores.peito).toBe(cores.prim);
    expect(cores.triceps).toBe(cores.sec);
    expect(cores.quadriceps).toBe("");
    expect(cores.prim).not.toBe(cores.sec);

    // a cor nunca é a única pista: a legenda diz quem é quem
    await expect(page.getByText("Principais:")).toBeVisible();
    await expect(page.getByText("Ajudam:")).toBeVisible();
    await semRolagemHorizontal(page);
  });
});

test.describe("miniaturas e player", () => {
  test("a lista do treino do dia usa a ilustração", async ({ page }) => {
    await usuarioComPerfil();
    await abrir(page);

    const primeira = page
      .getByRole("list", { name: "Exercícios de hoje" })
      .locator("[data-midia]")
      .first();
    await expect(primeira).toHaveAttribute("data-midia", "ilustracao");
    await expect(primeira.locator("img")).toHaveAttribute(
      "src",
      /^\/ilustracoes\//,
    );
  });

  test("o passo do player mostra a ilustração grande", async ({ page }) => {
    await usuarioComPerfil();
    await abrir(page);

    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);

    const ilustracao = page.locator("[data-ilustracao]").first();
    await expect(ilustracao).toBeVisible();
    await expect(ilustracao.locator("img").first()).toHaveAttribute(
      "src",
      /^\/ilustracoes\//,
    );
    await semRolagemHorizontal(page);
  });
});

test.describe("Mais → Créditos", () => {
  test("lista as fontes, as licenças e os links", async ({ page }) => {
    await usuarioComPerfil();
    await abrir(page);
    await irNaAba(page, "Mais");
    await page.getByRole("link", { name: "Créditos" }).click();

    await expect(page.getByRole("heading", { name: "Créditos" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Everkinetic, via Wikimedia Commons/ }),
    ).toHaveAttribute("href", /commons\.wikimedia\.org/);
    await expect(page.getByRole("link", { name: /^wger/ })).toHaveAttribute(
      "href",
      "https://wger.de/",
    );
    await expect(
      page.getByRole("link", { name: /MuscleMap/ }),
    ).toHaveAttribute("href", /github\.com\/melihcolpan\/MuscleMap/);
    await expect(
      page.getByRole("link", { name: "free-exercise-db" }),
    ).toHaveAttribute("href", /free-exercise-db/);

    await expect(
      page.getByText(/^CC BY-SA obriga a citar o autor/),
    ).toBeVisible();
    await expect(page.getByText("MIT").first()).toBeVisible();

    // a MIT exige o aviso junto do que é distribuído: o link tem que abrir
    const licencaMit = page.getByRole("link", {
      name: "Texto completo da licença MIT",
    });
    const href = await licencaMit.getAttribute("href");
    expect(href).toBe("/mapa-muscular/LICENCA-mapa-anatomico.md");
    const arquivo = await page.request.get(href!);
    expect(arquivo.status()).toBe(200);
    expect(await arquivo.text()).toContain("Permission is hereby granted");

    // a licença de cada fonte sai do JSON, não de um texto escrito na tela
    await expect(page.getByText(resumoDaFonte("everkinetic"))).toBeVisible();
    await expect(page.getByText(resumoDaFonte("wger"))).toBeVisible();

    // o autor de cada ilustração está lá, atrás do "Autor de cada ilustração"
    await page.getByText("Autor de cada ilustração").click();
    await expect(page.getByText(/Everkinetic \(everkinetic\.com\)/).first()).toBeVisible();

    /*
     * SPEC §15.3: a imagem que entrou por EXCEÇÃO também se declara. As fotos
     * dos itens são de anúncio (sem licença livre) e a tela diz isso, com o
     * texto vindo de data/equipamentos.json.
     */
    await expect(
      page.getByRole("heading", { name: "Fotos dos itens do terraço" }),
    ).toBeVisible();
    await expect(page.getByText(/Sem licença livre/)).toBeVisible();

    await semRolagemHorizontal(page);
  });
});
