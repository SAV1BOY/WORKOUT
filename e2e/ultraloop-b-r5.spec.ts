/**
 * Ultraloop 20/09 — Rodada 5, Lote 9 (SPEC §22.9): achar o exercício.
 *
 * O catálogo saiu de dentro do Explorar, a busca mostra o exercício antes da
 * coleção, o 404 responde em português e nenhuma capa se repete na mesma
 * seção. Um teste por item que se vê.
 */
import { expect, test, type Page } from "@playwright/test";
import { hrefDaColecao, todasAsColecoes } from "../lib/colecoes";
import {
  entrarNoApp,
  fixarData,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** Quarta, 16/09/2026 (SPEC §5). */
const QUARTA = "2026-09-16T08:00:00-03:00";

/** A altura da página inteira, em px. */
async function altura(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollHeight);
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await usuarioComPerfil();
  await fixarData(page, QUARTA);
  await entrarNoApp(page);
});

test.describe("Explorar e catálogo (SPEC §22.9)", () => {
  test("item 1: /explorar fecha abaixo de 4.000 px e manda para o catálogo", async ({
    page,
  }) => {
    await page.goto("/explorar");
    await expect(page.getByRole("heading", { name: "Explorar", level: 1 })).toBeVisible();
    // a prévia do catálogo, não o catálogo
    const ver = page.getByRole("link", { name: /Ver os 81 exercícios/ });
    await expect(ver).toBeVisible();
    const cartoes = page.locator('a[href^="/exercicios/"]');
    const quantos = await cartoes.count();
    expect(quantos, "cartões de exercício na vitrine").toBeGreaterThan(0);
    expect(quantos, "a vitrine mostra prévia, não catálogo").toBeLessThanOrEqual(12);

    expect(await altura(page), "/explorar em px").toBeLessThan(4000);
    await semRolagemHorizontal(page);

    await ver.click();
    await expect(page).toHaveURL(/\/exercicios$/);
  });

  test("item 2: /exercicios monta 20 de cada vez, e 'Ver mais' traz os outros", async ({
    page,
  }) => {
    await page.goto("/exercicios");
    await expect(page.getByText("81 exercícios", { exact: true })).toBeVisible();

    const cartoes = page.locator('a[href^="/exercicios/"]');
    await expect(cartoes).toHaveCount(20);

    const ver = page.getByRole("button", { name: /^Ver mais/ });
    await ver.click();
    await expect(cartoes).toHaveCount(40);
    for (let i = 0; i < 6 && (await ver.isVisible()); i += 1) await ver.click();
    await expect(cartoes).toHaveCount(81);
    await expect(ver).toBeHidden();

    // trocar a busca volta para os 20 primeiros
    await page.getByLabel("Buscar exercício pelo nome").fill("a");
    await expect(cartoes).toHaveCount(20);
    await semRolagemHorizontal(page);
  });

  test("item 3: a busca mostra o exercício na primeira tela", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/explorar");
    await page.getByLabel("Buscar exercício ou coleção").fill("supino");

    const primeiro = page.locator('a[href^="/exercicios/"]').first();
    await expect(primeiro).toBeVisible();
    const caixa = await primeiro.boundingBox();
    expect(caixa, "o primeiro exercício tem caixa").not.toBeNull();
    expect(caixa!.y, "y do primeiro exercício achado").toBeLessThan(740);

    // e os exercícios vêm ANTES das coleções
    const yColecao = (await page
      .locator('a[href^="/explorar/"]')
      .first()
      .boundingBox())!.y;
    expect(caixa!.y).toBeLessThan(yColecao);
  });

  test("item 4: busca sem resultado mostra UMA mensagem, citando o termo", async ({
    page,
  }) => {
    await page.goto("/explorar");
    await page.getByLabel("Buscar exercício ou coleção").fill("zzzz");

    const vazios = page.locator('[data-slot="vazio"]');
    await expect(vazios).toHaveCount(1);
    await expect(vazios).toContainText("Nada para «zzzz»");
    await expect(
      page.getByText("Nenhum exercício com esses filtros"),
    ).toBeHidden();

    await vazios.getByRole("button", { name: "Limpar busca" }).click();
    await expect(page.getByRole("link", { name: /Ver os 81 exercícios/ })).toBeVisible();
  });

  test("item 5: chegar ao catálogo por uma busca mostra resultado, não controle", async ({
    page,
  }) => {
    await page.goto("/explorar");
    await page.getByLabel("Buscar exercício ou coleção").fill("supino");

    // os selects ficam atrás do botão "Filtros" (a folha do §22.12 item 1)
    await expect(page.getByLabel("Grupo")).toBeHidden();
    const filtros = page.getByRole("button", { name: /^Filtros/ });
    await expect(filtros).toBeVisible();
    await filtros.click();
    await expect(page.getByRole("dialog").getByLabel("Grupo")).toBeVisible();
  });

  test("item 6: o 404 responde em português, com caminho de volta", async ({ page }) => {
    const resposta = await page.goto("/exercicios/remada-curvada-com-barra");
    expect(resposta?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Essa tela não existe mais." }),
    ).toBeVisible();
    for (const rotulo of ["Voltar para Hoje", "Ver o Explorar", "Ver os exercícios"]) {
      await expect(page.getByRole("link", { name: rotulo })).toBeVisible();
    }
    await page.getByRole("link", { name: "Ver os exercícios" }).click();
    await expect(page).toHaveURL(/\/exercicios$/);
    await semRolagemHorizontal(page);
  });

  test("item 7: nenhuma capa se repete dentro de uma seção do Explorar", async ({
    page,
  }) => {
    await page.goto("/explorar");
    await expect(page.getByText("Escolhas para você")).toBeVisible();

    /* só as seções-folha da vitrine: a de fora contém todas as outras */
    const SECOES = [
      "Treinos do programa",
      "Parte do corpo",
      "Circuitos",
      "Por aparelho",
      "Planos",
    ];
    const repetidas: string[] = [];
    let capas = 0;
    for (const rotulo of SECOES) {
      const secao = page.locator(`section[aria-label="${rotulo}"]`);
      const fontes = (
        await secao.locator('a[href^="/explorar/"] img').evaluateAll((imgs) =>
          imgs.map((i) => (i as HTMLImageElement).getAttribute("src") ?? ""),
        )
      ).filter(Boolean);
      capas += fontes.length;
      const vistas = new Set<string>();
      for (const f of fontes) {
        if (vistas.has(f)) repetidas.push(`${rotulo}: ${f}`);
        vistas.add(f);
      }
    }
    expect(repetidas, "capas repetidas na mesma seção").toEqual([]);
    expect(capas, "a vitrine mostra fotos de capa").toBeGreaterThan(5);
  });

  test("item 8: o título de seção tem degrau sobre o rótulo", async ({ page }) => {
    await page.goto("/explorar");
    const rotulo = page.getByText("Escolhas para você");
    const titulo = page.getByRole("heading", { name: "Parte do corpo" });
    const tamanho = async (loc: typeof rotulo) =>
      Number(
        (
          await loc.evaluate((e) => getComputedStyle(e).fontSize)
        ).replace("px", ""),
      );
    expect(await tamanho(rotulo)).toBeLessThanOrEqual(11);
    expect(await tamanho(titulo)).toBeGreaterThanOrEqual(16);
  });

  test("item 9: toda coleção da vitrine abre pela URL que a vitrine gerou", async ({
    page,
  }) => {
    // as URLs saem da mesma função que os links da tela usam
    const quebradas: string[] = [];
    for (const c of todasAsColecoes()) {
      const href = hrefDaColecao(c);
      const resposta = await page.request.get(href);
      if (resposta.status() !== 200) quebradas.push(`${href} (${c.id}): ${resposta.status()}`);
    }
    expect(quebradas, "coleções da vitrine que não abrem").toEqual([]);

    // e uma delas de verdade, com a tela montada (o título da coleção é o
    // h1 da página — SPEC §22.12 item 6)
    const primeira = todasAsColecoes()[0]!;
    await page.goto(hrefDaColecao(primeira));
    await expect(
      page.getByRole("heading", { name: primeira.titulo, level: 1 }),
    ).toBeVisible();
  });

  test("item 10: todo salto do seletor tem destino no documento", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/explorar");
    const busca = page.getByLabel("Buscar exercício ou coleção");
    const saltos = page.locator('a[href^="#achados"]');

    /* "tatame" acha 2 coleções e nenhum exercício: um bloco só, sem seletor */
    await busca.fill("tatame");
    await expect(page.getByRole("heading", { name: /^Coleções \(/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Exercícios \(/ })).toBeHidden();
    await expect(saltos, "seletor com um bloco só").toHaveCount(0);

    /* "supino" acha os dois: aí sim há para onde pular — e o destino existe */
    await busca.fill("supino");
    await expect(saltos).toHaveCount(2);
    const quebrados = await saltos.evaluateAll((as) =>
      as
        .map((a) => a.getAttribute("href") ?? "")
        .filter((href) => document.querySelector(href) === null),
    );
    expect(quebrados, "âncoras do seletor sem destino no documento").toEqual([]);

    await saltos.nth(1).click();
    await expect(page.locator("#achados-colecoes")).toBeInViewport();
    await semRolagemHorizontal(page);
  });

  test("item 10: a contagem do título é a da lista, com filtro e sem", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/explorar");
    const busca = page.getByLabel("Buscar exercício ou coleção");
    await busca.fill("supino");

    const bloco = page.locator("#achados-exercicios");
    const cartoes = bloco.locator('a[href^="/exercicios/"]');
    /** O número que o título do bloco anuncia. */
    const anunciado = async (): Promise<number> => {
      const texto = (await bloco.getByRole("heading", { level: 2 }).textContent()) ?? "";
      const achado = /\((\d+)\)/.exec(texto);
      expect(achado, `título sem número: «${texto}»`).not.toBeNull();
      return Number(achado![1]);
    };

    const semFiltro = await cartoes.count();
    expect(semFiltro, "a busca acha exercícios").toBeGreaterThan(0);
    expect(await anunciado()).toBe(semFiltro);

    /* o filtro recolhido atrás do botão "Filtros" entra na conta do título */
    await page.getByRole("button", { name: /^Filtros/ }).click();
    await page.getByLabel("Grupo").selectOption("Costas");
    // o CTA da folha já diz que não sobrou nada, e fecha a folha
    await page.getByRole("button", { name: "Nenhum exercício" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Nenhum exercício com esses filtros")).toBeVisible();
    await expect(cartoes).toHaveCount(0);
    expect(await anunciado(), "o título conta o que a lista mostra").toBe(0);

    /* e apagar a busca solta o filtro: a busca seguinte não herda a conta */
    await page.getByLabel("Limpar a busca").click();
    await expect(page.getByRole("link", { name: /Ver os 81 exercícios/ })).toBeVisible();
    await busca.fill("supino");
    await expect(cartoes).toHaveCount(semFiltro);
    expect(await anunciado()).toBe(semFiltro);
    await expect(page.getByRole("button", { name: /^Filtros/ })).toHaveText("Filtros");
  });

  test("item 9: o link antigo, com acento e maiúscula, continua abrindo", async ({
    page,
  }) => {
    for (const [velho, titulo] of [
      ["/explorar/grupo/Core", "Core"],
      ["/explorar/grupo/B%C3%ADceps", "Bíceps"],
    ] as const) {
      const resposta = await page.goto(velho);
      expect(resposta?.status(), velho).toBe(200);
      // SPEC §22.12 item 6: a capa da coleção é o h1 da página
      await expect(
        page.getByRole("heading", { name: titulo, level: 1 }),
        velho,
      ).toBeVisible();
    }
  });
});
