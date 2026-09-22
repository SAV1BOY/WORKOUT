/**
 * Ultraloop — Rodada 10, Lote 12 (SPEC §22.12): Explorar e catálogo, leitura
 * e filtros. Tudo a 360×740, contra o mock, pelo caminho que o dedo faz.
 */
import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

interface ExercicioDoJson {
  id: string;
  nome: string;
  grupo: string;
  implemento: string;
}
const CATALOGO: ExercicioDoJson[] = (() => {
  const cru = JSON.parse(readFileSync("data/exercicios.json", "utf8")) as
    | ExercicioDoJson[]
    | { exercicios: ExercicioDoJson[] };
  return Array.isArray(cru) ? cru : cru.exercicios;
})();
const TOTAL = CATALOGO.length;

/** Quarta, 16/09/2026 (SPEC §5). */
const QUARTA = "2026-09-16T08:00:00-03:00";

async function preparar(
  page: Page,
  ajustes: Record<string, unknown> = {},
  quando: string = QUARTA,
): Promise<void> {
  await resetarMock();
  await usuarioComPerfil(ajustes);
  await page.setViewportSize({ width: 360, height: 740 });
  await fixarData(page, quando);
  await entrarNoApp(page);
}

function semAcento(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Altura e largura de cada controle visível dentro de `raiz`. */
async function controlesMenoresQue44(raiz: Locator): Promise<string[]> {
  return raiz.evaluate((el) =>
    [...el.querySelectorAll("button, select, a, input")]
      .filter((c) => (c as HTMLElement).offsetParent !== null)
      .map((c) => {
        const r = c.getBoundingClientRect();
        const nome =
          c.getAttribute("aria-label") ?? (c.textContent ?? "").trim().slice(0, 30);
        return { nome, a: Math.round(r.height), l: Math.round(r.width) };
      })
      .filter((c) => c.a < 44 || c.l < 44)
      .map((c) => `${c.nome}: ${c.l}×${c.a}`),
  );
}

test.describe("A — catálogo: filtros numa folha (SPEC §22.12 item 1)", () => {
  test("o primeiro exercício cabe na primeira tela e o gatilho é do Radix", async ({
    page,
  }) => {
    await preparar(page);
    await page.goto("/exercicios");
    const lista = page.getByRole("list", { name: "Exercícios", exact: true });
    const primeiro = lista.locator("li").first();
    await expect(primeiro).toBeVisible();
    const caixa = await primeiro.boundingBox();
    expect(caixa, "o primeiro cartão tem caixa").not.toBeNull();
    expect(caixa!.y + caixa!.height, "o primeiro cartão inteiro na 1ª tela").toBeLessThanOrEqual(740);
    // os selects não estão na tela antes de abrir a folha
    await expect(page.getByLabel("Grupo")).toHaveCount(0);

    // `includeHidden`: com a folha aberta, o Radix esconde o resto da página
    const gatilho = page.getByRole("button", { name: /^Filtros/, includeHidden: true });
    await expect(gatilho).toHaveAttribute("aria-haspopup", "dialog");
    await expect(gatilho).toHaveAttribute("aria-expanded", "false");
    await gatilho.click();
    await expect(gatilho).toHaveAttribute("aria-expanded", "true");
    const controla = await gatilho.getAttribute("aria-controls");
    expect(controla, "aria-controls no gatilho").toBeTruthy();
    const folha = page.getByRole("dialog", { name: "Filtros" });
    await expect(folha).toBeVisible();
    await expect(folha).toHaveAttribute("id", controla!);
    // a folha tem descrição, e todo controle dela tem 44 px
    await expect(folha).toHaveAttribute("aria-describedby", /.+/);
    expect(await controlesMenoresQue44(folha), "controles da folha < 44 px").toEqual([]);
    await semRolagemHorizontal(page);

    await page.keyboard.press("Escape");
    await expect(folha).toBeHidden();
    await expect(gatilho).toHaveAttribute("aria-expanded", "false");
  });

  test("selo conta filtros; CTA, contador e cartões dizem o mesmo número; chip remove", async ({
    page,
  }) => {
    await preparar(page);
    await page.goto("/exercicios");
    // `includeHidden`: com a folha aberta, o Radix esconde o resto da página
    const gatilho = page.getByRole("button", { name: /^Filtros/, includeHidden: true });
    const contador = page.locator("[data-contador]");
    const cartoes = page
      .getByRole("list", { name: "Exercícios", exact: true })
      .locator('a[href^="/exercicios/"]');
    await expect(contador).toHaveText(`${TOTAL} exercícios`);

    await gatilho.click();
    const folha = page.getByRole("dialog", { name: "Filtros" });
    await folha.getByLabel("Grupo").selectOption("Peito");
    await folha.getByLabel("Implemento").selectOption("halteres");
    const n = CATALOGO.filter((e) => e.grupo === "Peito" && e.implemento === "halteres").length;
    expect(n).toBeGreaterThan(1);
    expect(n).toBeLessThanOrEqual(20);
    // o selo é o número de FILTROS (2), não o de resultados
    await expect(gatilho.locator("[data-filtros-ligados]")).toHaveText("2");
    const cta = folha.getByRole("button", { name: `Ver ${n} exercícios` });
    await expect(cta).toBeVisible();
    expect(await controlesMenoresQue44(folha)).toEqual([]);

    await cta.click();
    await expect(folha).toBeHidden();
    await expect(contador).toHaveText(`${n} de ${TOTAL} exercícios`);
    await expect(cartoes).toHaveCount(n);
    // o primeiro resultado filtrado está na tela, e é do filtro
    const primeiro = cartoes.first();
    await expect(primeiro).toBeInViewport();
    const nomePrimeiro = (await primeiro.getAttribute("title")) ?? "";
    expect(nomePrimeiro).toContain("Peito");

    // os filtros ligados viram chips removíveis acima da lista
    const chips = page.getByRole("list", { name: "Filtros ligados" });
    await expect(chips.getByRole("button")).toHaveCount(2);
    await expect(chips.getByRole("button", { name: "Tirar o filtro Peito" })).toHaveText("Peito");
    expect(await controlesMenoresQue44(chips)).toEqual([]);
    await chips.getByRole("button", { name: "Tirar o filtro Peito" }).click();
    const m = CATALOGO.filter((e) => e.implemento === "halteres").length;
    await expect(gatilho.locator("[data-filtros-ligados]")).toHaveText("1");
    await expect(contador).toHaveText(`${m} de ${TOTAL} exercícios`);
    await expect(cartoes).toHaveCount(Math.min(20, m));
    await gatilho.click();
    await expect(folha.getByRole("button", { name: `Ver ${m} exercícios` })).toBeVisible();

    // singular: um grupo + implemento que acha um só
    const um = CATALOGO.find(
      (e) => CATALOGO.filter((o) => o.grupo === e.grupo && o.implemento === e.implemento).length === 1,
    );
    expect(um, "o catálogo tem um par grupo+implemento com um exercício só").toBeDefined();
    await folha.getByLabel("Grupo").selectOption(um!.grupo);
    await folha.getByLabel("Implemento").selectOption(um!.implemento);
    await folha.getByRole("button", { name: "Ver 1 exercício", exact: true }).click();
    await expect(folha).toBeHidden();
    await expect(contador).toHaveText(`1 de ${TOTAL} exercícios`);
    await expect(cartoes).toHaveCount(1);
    const escapado = um!.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await expect(cartoes.first()).toHaveAttribute("title", new RegExp(`^${escapado}`));

    // tirar os chips volta ao catálogo inteiro, sem selo
    for (let i = 0; i < 4 && (await chips.getByRole("button").count()) > 0; i += 1) {
      await chips.getByRole("button").first().click();
    }
    await expect(chips).toHaveCount(0);
    await expect(gatilho.locator("[data-filtros-ligados]")).toHaveCount(0);
    await expect(contador).toHaveText(`${TOTAL} exercícios`);
    await semRolagemHorizontal(page);
  });

  test("na busca do Explorar, a mesma folha; o título conta o que a lista mostra", async ({
    page,
  }) => {
    await preparar(page);
    await page.goto("/explorar");
    await page.getByLabel("Buscar exercício ou coleção").fill("supino");
    const bloco = page.locator("#achados-exercicios");
    const cartoes = bloco.locator('a[href^="/exercicios/"]');
    const achados = CATALOGO.filter((e) => semAcento(e.nome).includes("supino"));
    await expect(bloco.getByRole("heading", { level: 2 })).toHaveText(
      `Exercícios (${achados.length})`,
    );
    await bloco.getByRole("button", { name: /^Filtros/ }).click();
    const folha = page.getByRole("dialog", { name: "Filtros" });
    await folha.getByLabel("Grupo").selectOption("Peito");
    const n = achados.filter((e) => e.grupo === "Peito").length;
    await folha.getByRole("button", { name: n === 1 ? "Ver 1 exercício" : `Ver ${n} exercícios` }).click();
    await expect(folha).toBeHidden();
    await expect(bloco.getByRole("heading", { level: 2 })).toHaveText(`Exercícios (${n})`);
    await expect(cartoes).toHaveCount(n);
    await expect(bloco.getByRole("button", { name: "Tirar o filtro Peito" })).toBeVisible();
  });
});

test.describe("B e C — linhas de coleção e o motivo da busca (itens 2 e 3)", () => {
  test("por aparelho: sem ficha técnica, contagem uma vez, meta em peso normal", async ({
    page,
  }) => {
    await preparar(page);
    await page.goto("/explorar");
    const secao = page.getByRole("region", { name: "Por aparelho" });
    await secao.getByRole("button", { name: /^Ver todos/ }).click();
    const linhas = secao.locator('[data-colecao^="aparelho:"]');
    const quantas = await linhas.count();
    expect(quantas).toBeGreaterThan(3);
    const equipamentos = JSON.parse(readFileSync("data/equipamentos.json", "utf8")) as {
      itens: { id: string; specs: string }[];
    };
    for (let i = 0; i < quantas; i += 1) {
      const linha = linhas.nth(i);
      const id = ((await linha.getAttribute("data-colecao")) ?? "").replace("aparelho:", "");
      const texto = (await linha.innerText()).replace(/\s+/g, " ");
      const specs = equipamentos.itens.find((it) => it.id === id)?.specs ?? "@@";
      expect(texto, id).not.toContain(specs);
      expect(texto, id).not.toMatch(/\bkg\b|\bcm\b|~|\bmin\b/);
      expect(texto.match(/para fazer com ele/g) ?? [], id).toHaveLength(1);
      expect(texto, id).toMatch(/\d+ exercícios? que d[áã]o? para fazer com ele/);
      // a meta é a última linha e não tem peso; o título tem
      const pesos = await linha.evaluate((el) => {
        const meta = el.querySelector('[data-linha="meta"]');
        const coluna = meta?.parentElement;
        return {
          metaUltima: coluna?.lastElementChild === meta,
          meta: Number(getComputedStyle(meta!).fontWeight),
          titulo: Number(getComputedStyle(coluna!.firstElementChild!.firstElementChild!).fontWeight),
        };
      });
      expect(pesos.metaUltima, id).toBe(true);
      expect(pesos.meta, id).toBe(400);
      expect(pesos.titulo, id).toBeGreaterThanOrEqual(500);
    }
  });

  test("a busca diz 'contém' só quando veio de exercício, na ordem dos termos", async ({
    page,
  }) => {
    await preparar(page);
    await page.goto("/explorar");
    const busca = page.getByLabel("Buscar exercício ou coleção");
    const achadas = page.getByRole("region", { name: "Coleções encontradas" });

    await busca.fill("supino");
    // o banco casa pelo título: sem motivo
    const banco = achadas.locator('[data-colecao="aparelho:banco"]');
    await expect(banco).toBeVisible();
    await expect(banco.locator('[data-linha="motivo"]')).toHaveCount(0);
    // o Treino A casa por um exercício: diz qual
    await expect(
      achadas.locator('[data-colecao="treino:A1"] [data-linha="motivo"]'),
    ).toHaveText("contém Supino reto com barra");
    // o título vem antes do conteúdo: a primeira linha é a do título
    await expect(achadas.locator("[data-colecao]").first()).toHaveAttribute(
      "data-colecao",
      "aparelho:banco",
    );
    // toda linha que não casou pelo título nem pelo subtítulo diz o porquê
    const semMotivo = await achadas.locator("[data-colecao]").evaluateAll((els) =>
      els
        .filter((el) => {
          const tira = (t: string) =>
            t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
          const coluna = el.querySelector('[data-linha="meta"]')?.parentElement;
          const titulo = tira(coluna?.firstElementChild?.textContent ?? "");
          const sub = tira(el.querySelector('[data-linha="subtitulo"]')?.textContent ?? "");
          const motivo = el.querySelector('[data-linha="motivo"]')?.textContent ?? "";
          return !titulo.includes("supino") && !sub.includes("supino") && !motivo.startsWith("contém ");
        })
        .map((el) => el.getAttribute("data-colecao")),
    );
    expect(semMotivo, "coleções achadas por conteúdo sem dizer por quê").toEqual([]);

    // dois termos em exercícios diferentes: os dois nomes, na ordem dos termos
    await busca.fill("supino agachamento");
    await expect(
      achadas.locator('[data-colecao="treino:A1"] [data-linha="motivo"]'),
    ).toHaveText("contém Supino reto com barra e Agachamento livre");
    // sem diferença de acento e caixa
    await busca.fill("AGACHAMENTO SUPÍNO");
    await expect(
      achadas.locator('[data-colecao="treino:A1"] [data-linha="motivo"]'),
    ).toHaveText("contém Agachamento livre e Supino reto com barra");
    // dois termos no mesmo exercício: um nome só
    await busca.fill("supino reto");
    await expect(
      achadas.locator('[data-colecao="treino:A1"] [data-linha="motivo"]'),
    ).toHaveText("contém Supino reto com barra");

    // busca sem nada: um vazio só
    await busca.fill("zzzz");
    await expect(page.locator('[data-slot="vazio"]')).toHaveCount(1);
    await semRolagemHorizontal(page);
  });
});

test.describe("D — planos: título curto e a posição do perfil (item 4)", () => {
  test("com o perfil, barra fixa e corrida dizem 'semana N de T'; a corda, a duração", async ({
    page,
  }) => {
    await preparar(page, { semana_fixa: 3, semana_corrida: 99 });
    await page.goto("/explorar");
    const planos = page.getByRole("region", { name: "Planos" });
    const fixa = planos.locator('[data-colecao="plano:barra_fixa"]');
    const corrida = planos.locator('[data-colecao="plano:corrida"]');
    const corda = planos.locator('[data-colecao="plano:corda"]');
    await expect(fixa.locator('[data-linha="meta"]')).toHaveText("semana 3 de 12");
    // acima do total fica preso no total
    await expect(corrida.locator('[data-linha="meta"]')).toHaveText("semana 12 de 12");
    await expect(corda.locator('[data-linha="meta"]')).toHaveText("12 semanas");
    // títulos curtos, sem o prazo repetido
    await expect(fixa).toContainText("Primeira barra fixa");
    await expect(fixa).not.toContainText("Primeira barra fixa em");
    await expect(corrida).toContainText("5 km sem parar");
    await expect(corrida).not.toContainText("sem parar em 12 semanas");

    // a tela do plano diz a mesma posição
    await fixa.click();
    await page.waitForURL(/\/explorar\/plano\//);
    await expect(page.getByText("semana 3 de 12", { exact: true })).toBeVisible();
  });
});

test.describe("E — títulos em degraus (itens 5 e 6)", () => {
  test("Explorar: um h1, dois h2 irmãos e os cinco h3 das escolhas", async ({ page }) => {
    await preparar(page);
    await page.goto("/explorar");
    await expect(page.getByRole("heading", { name: "Explorar", level: 1 })).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Escolhas para você", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Exercícios", level: 2, exact: true }),
    ).toBeVisible();
    for (const nome of [
      "Treinos do programa",
      "Parte do corpo",
      "Circuitos",
      "Por aparelho",
      "Planos",
    ]) {
      await expect(page.getByRole("heading", { name: nome, level: 3 })).toBeVisible();
    }
  });

  test("a coleção tem exatamente um h1 no main, também na URL antiga", async ({ page }) => {
    await preparar(page);
    for (const [url, titulo] of [
      ["/explorar/grupo/core", "Core"],
      ["/explorar/grupo/Core", "Core"],
      ["/explorar/grupo/B%C3%ADceps", "Bíceps"],
      ["/explorar/plano/corrida", "5 km sem parar"],
    ] as const) {
      const resposta = await page.goto(url);
      expect(resposta?.status(), url).toBe(200);
      await expect(page.locator("main h1"), url).toHaveCount(1);
      await expect(page.locator("h1"), url).toHaveCount(1);
      await expect(page.locator("main h1"), url).toHaveText(titulo);
    }
    // e o voltar leva ao Explorar
    await page.getByRole("link", { name: "Explorar", exact: true }).first().click();
    await page.waitForURL(/\/explorar$/);
    await expect(page.getByRole("heading", { name: "Explorar", level: 1 })).toBeVisible();
  });
});

test.describe("F — desafios: uma fonte só para o CTA (item 7)", () => {
  test("Treino e Explorar mostram o mesmo CTA para o mesmo desafio", async ({ page }) => {
    // domingo, 20/09: sem treino de força — o destaque do Explorar é um plano
    await preparar(page, {}, "2026-09-20T08:00:00-03:00");
    await page.goto("/explorar");
    const destaque = page
      .getByRole("region", { name: "Explorar" })
      .locator("article[data-capa]")
      .first();
    const link = destaque.getByRole("link");
    await expect(link).toBeVisible();
    const texto = ((await link.textContent()) ?? "").trim();
    const href = (await link.getAttribute("href")) ?? "";
    expect(texto).not.toBe("Fazer a sessão da semana");

    await page.goto("/");
    await esperarAbaTreino(page);
    const desafios = page.getByRole("region", { name: "Desafios" });
    const mesmo = desafios.getByRole("link", { name: texto, exact: true });
    await expect(mesmo).toHaveCount(1);
    await expect(mesmo).toHaveAttribute("href", href);
    // e os três CTAs do carrossel são distintos (cada um diz o destino)
    const rotulos = await desafios.locator("li[data-desafio] a").allTextContents();
    expect(rotulos).toHaveLength(3);
    expect(new Set(rotulos.map((r) => r.trim())).size).toBe(3);
  });
});
