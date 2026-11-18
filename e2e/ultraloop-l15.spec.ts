/**
 * Ultraloop — Rodada 33, Lote 15 (SPEC §22.19): Corpo — peso, gráficos e
 * campo de data. Tudo a 360×740, contra o mock, pelo caminho que o dedo faz,
 * nos dois temas onde o aceite pede. As regras puras estão em lib/l15.test.ts.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  abrirSecaoDoRelatorio,
  entrarNoApp,
  fixarData,
  inserirNoMock,
  irNaAba,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  type SessaoMock,
  usuarioComPerfil,
} from "./fixtures";

/** Quarta, 16/09/2026. */
const QUARTA = "2026-09-16T08:00:00-03:00";
const TEMAS = ["light", "dark"] as const;
type Tema = (typeof TEMAS)[number];

/** As três pesagens das capturas (scripts/capturas-ultraloop.ts). */
const PESOS = [
  { data: "2026-08-12", peso_kg: 84.2 },
  { data: "2026-08-26", peso_kg: 83.1 },
  { data: "2026-09-12", peso_kg: 82.4 },
];
const LEITURA_DO_PESO =
  "Peso por data. Peso: 84,2 kg em 12/08, 83,1 kg em 26/08, 82,4 kg em 12/09 — queda de 1,8 kg.";

/*
 * O config roda um worker só, em série (`workers: 1`, `fullyParallel: false`):
 * cada teste começa do mock limpo, como os outros specs do ultraloop.
 */
test.beforeEach(async () => {
  await resetarMock();
});

async function preparar(
  page: Page,
  tema: Tema = "light",
  ajustes: Record<string, unknown> = {},
): Promise<SessaoMock> {
  const sessao = await usuarioComPerfil(ajustes);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: tema });
  await fixarData(page, QUARTA);
  return sessao;
}

async function abrirCorpo(page: Page, aba: "Peso" | "Medidas" | "Fotos" = "Peso") {
  await entrarNoApp(page);
  await irNaAba(page, "Corpo");
  await expect(page.getByRole("heading", { name: "Corpo", exact: true })).toBeVisible();
  if (aba !== "Peso") await page.getByRole("tab", { name: aba }).click();
}

/**
 * Os rótulos do eixo y de um gráfico, como a tela os escreve. No Recharts 3
 * os rótulos vão para uma camada própria (ZIndexLayer), fora do `<g>` do
 * eixo: o grupo deles é `.recharts-yAxis-tick-labels`.
 */
async function rotulosDoEixoY(grafico: Locator): Promise<string[]> {
  return grafico.evaluate((el) =>
    [...el.querySelectorAll(".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value")].map(
      (t) => (t.textContent ?? "").trim(),
    ),
  );
}

/** A árvore de acessibilidade não tem `application` nem `<svg tabindex>`. */
async function semCamadaDoRecharts(page: Page): Promise<void> {
  await expect(page.locator('[role="application"]')).toHaveCount(0);
  await expect(page.getByRole("application")).toHaveCount(0);
  await expect(page.locator("svg[tabindex]")).toHaveCount(0);
}

function luminancia(rgb: string): number {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return ((l1 ?? 0) + 0.05) / ((l2 ?? 0) + 0.05);
}

/* ------------------------------------------------------------ item 1 */

test.describe("§22.19 item 1 — gráficos como figura com a leitura dos dados", () => {
  test("Corpo: peso e medida são img com a leitura; nada de application", async ({ page }) => {
    const sessao = await preparar(page);
    await inserirNoMock(sessao, "body_weights", PESOS);
    await inserirNoMock(sessao, "body_measurements", [
      { data: "2026-08-12", cintura_cm: 93 },
      { data: "2026-09-12", cintura_cm: 91.5 },
    ]);
    await abrirCorpo(page);

    await expect(page.getByRole("img", { name: LEITURA_DO_PESO, exact: true })).toBeVisible();
    await semCamadaDoRecharts(page);

    await page.getByRole("tab", { name: "Medidas" }).click();
    await expect(
      page.getByRole("img", {
        name: "Medida por data. Cintura: 93 cm em 12/08, 91,5 cm em 12/09 — queda de 1,5 cm.",
        exact: true,
      }),
    ).toBeVisible();
    await semCamadaDoRecharts(page);
    await semRolagemHorizontal(page);
  });

  test("Relatório: os gráficos do Corpo e da seção Gráficos têm nome com os valores", async ({
    page,
  }) => {
    const sessao = await preparar(page);
    await inserirNoMock(sessao, "body_weights", PESOS);
    await inserirNoMock(sessao, "sessions", [
      {
        id: "11111111-1111-4111-8111-111111111111",
        data: "2026-09-14",
        workout_id: "A1",
        fase: "fase1",
        status: "concluida",
        concluida_em: "2026-09-14T13:00:00.000Z",
      },
    ]);
    await inserirNoMock(sessao, "session_sets", [
      {
        id: "22222222-2222-4222-8222-000000000001",
        session_id: "11111111-1111-4111-8111-111111111111",
        exercise_id: "agachamento-livre",
        ordem_ex: 1,
        set_index: 1,
        tipo: "trabalho",
        reps: 5,
        carga_kg: 11.5,
        concluida: true,
        registrada_em: "2026-09-14T12:00:00.000Z",
      },
    ]);
    await inserirNoMock(sessao, "cardio_sessions", [
      {
        id: "44444444-4444-4444-8444-000000000001",
        data: "2026-09-15",
        tipo: "corrida",
        semana_plano: 1,
        duracao_min: 34,
        distancia_km: 3.2,
        esforco: "facil",
        concluida: true,
      },
    ]);
    await entrarNoApp(page);
    await page.goto("/relatorio");
    await abrirSecaoDoRelatorio(page, "corpo");
    await abrirSecaoDoRelatorio(page, "graficos");

    const peso = page.getByRole("region", { name: "Peso" });
    await expect(peso.getByRole("img", { name: LEITURA_DO_PESO, exact: true })).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Carga por sessão: Agachamento livre. Carga: 11,5 kg em 14/09.",
        exact: true,
      }),
    ).toBeVisible();
    for (const titulo of [
      "Volume por semana. Volume: 12 valores de",
      "Repetições de barra fixa por semana. Séries: 12 valores de",
      "Minutos correndo por semana. Minutos: 12 valores de",
      "Quilômetros por semana. Km: 12 valores de",
    ]) {
      await expect(page.getByRole("img", { name: titulo })).toBeVisible();
    }
    // TODA figura da tela é um img com nome — o título e pelo menos um número
    const figuras = page.locator("figure");
    const quantas = await figuras.count();
    expect(quantas).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < quantas; i++) {
      const figura = figuras.nth(i);
      await expect(figura).toHaveAttribute("role", "img");
      await expect(figura).toHaveAttribute("aria-label", /\. .*\d/);
      // o desenho fica fora da árvore
      await expect(figura.locator(":scope > div")).toHaveAttribute("aria-hidden", "true");
    }
    await semCamadaDoRecharts(page);
    await semRolagemHorizontal(page);
  });
});

/* ------------------------------------------------------------ item 2 */

test.describe("§22.19 item 2 — a aba Peso começa pelo peso", () => {
  for (const tema of TEMAS) {
    test(`peso atual e gráfico na primeira tela, depois Registrar, IMC, variação e meta (${tema})`, async ({
      page,
    }) => {
      const sessao = await preparar(page, tema);
      await inserirNoMock(sessao, "body_weights", PESOS);
      await abrirCorpo(page);

      const atual = page.getByText("82,4 kg em 12/09", { exact: true });
      const grafico = page.getByRole("img", { name: /^Peso por data/ });
      await expect(grafico).toBeVisible();
      await expect(grafico.locator(".recharts-line")).toHaveCount(1);
      const nav = page.getByRole("navigation", { name: "Navegação principal" });
      const topoDaBarra = (await nav.boundingBox())?.y ?? 0;
      expect(topoDaBarra).toBeGreaterThan(600);
      const caixaAtual = await atual.boundingBox();
      const caixaGrafico = await grafico.boundingBox();
      expect(caixaAtual && caixaAtual.y + caixaAtual.height).toBeLessThanOrEqual(topoDaBarra);
      expect(
        caixaGrafico && caixaGrafico.y + caixaGrafico.height,
        "o gráfico inteiro acima da barra de abas, sem rolar",
      ).toBeLessThanOrEqual(topoDaBarra);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      // a ordem: peso atual → Registrar → IMC → Variação por semana → Meta
      const ys: number[] = [];
      for (const alvo of [
        atual,
        page.getByText("Registrar peso", { exact: true }),
        page.getByRole("region", { name: "IMC" }),
        page.getByText("Variação por semana", { exact: true }),
        page.getByText("Meta (opcional)", { exact: true }),
      ]) {
        ys.push((await alvo.boundingBox())?.y ?? -1);
      }
      expect(ys, ys.join(" < ")).toEqual([...ys].sort((a, b) => a - b));
      expect(new Set(ys).size).toBe(5);

      // os títulos em ordem: h1 Corpo e o IMC como h2 (nada de h1 → h3)
      await expect(page.getByRole("heading", { level: 2, name: "IMC" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3 })).toHaveCount(0);
      await semRolagemHorizontal(page);
    });
  }
});

/* ------------------------------------------------------------ item 3 */

test.describe("§22.19 item 3 — uma régua só, sem série vazia, com a variação", () => {
  test("Corpo e Relatório: o mesmo eixo de 2 em 2 kg e a variação do período", async ({
    page,
  }) => {
    const sessao = await preparar(page);
    await inserirNoMock(sessao, "body_weights", PESOS);
    await abrirCorpo(page);

    const doCorpo = page.getByRole("img", { name: /^Peso por data/ });
    await expect.poll(() => rotulosDoEixoY(doCorpo)).toEqual(["82", "84", "86"]);
    // pesagens a 14 dias ou mais uma da outra: a média não tem ponto próprio
    await expect(page.getByText("Média de 7 dias")).toHaveCount(0);
    await expect(doCorpo.locator(".recharts-line")).toHaveCount(1);
    await expect(doCorpo).not.toHaveAttribute("aria-label", /Média/);
    // a mesma linha de variação do Relatório, sob o peso atual
    await expect(page.getByText("−1,8 kg desde 12/08", { exact: true })).toBeVisible();

    await page.goto("/relatorio");
    await abrirSecaoDoRelatorio(page, "corpo");
    const card = page.getByRole("region", { name: "Peso" });
    const doRelatorio = card.getByRole("img", { name: /^Peso por data/ });
    await expect.poll(() => rotulosDoEixoY(doRelatorio)).toEqual(["82", "84", "86"]);
    await expect(card.getByText("−1,8 kg desde 12/08", { exact: true })).toBeVisible();
    await expect(card).not.toContainText("maior");
    await expect(card).not.toContainText("menor");
    // uma série só e sem meta: sem legenda
    await expect(card.locator("ul li")).toHaveCount(0);
    await semRolagemHorizontal(page);
  });

  test("com pesagens próximas a média de 7 dias volta, na linha e na legenda", async ({
    page,
  }) => {
    const sessao = await preparar(page);
    await inserirNoMock(sessao, "body_weights", [
      ...PESOS,
      { data: "2026-09-14", peso_kg: 82 },
    ]);
    await abrirCorpo(page);
    const grafico = page.getByRole("img", { name: /^Peso por data, com a média de 7 dias\./ });
    await expect(grafico).toBeVisible();
    await expect(grafico.locator(".recharts-line")).toHaveCount(2);
    await expect(page.getByText("Média de 7 dias", { exact: true })).toBeVisible();
    await expect(grafico).toHaveAttribute("aria-label", /Média de 7 dias: /);
  });
});

/* ------------------------------------------------------------ item 4 */

test.describe("§22.19 item 4 — a meta no gráfico e o link no lugar do 'embaixo'", () => {
  test("a meta é uma linha tracejada dentro dos dois gráficos de peso", async ({ page }) => {
    const sessao = await preparar(page, "light", { prefs: { meta_peso: 80 } });
    await inserirNoMock(sessao, "body_weights", PESOS);
    await abrirCorpo(page);

    await expect(page.getByText("Faltam 2,4 kg para a meta de 80 kg.")).toBeVisible();
    const grafico = page.getByRole("img", { name: `${LEITURA_DO_PESO} Meta: 80 kg.` });
    await expect(grafico).toBeVisible();
    await expect(page.getByText("Meta 80 kg", { exact: true })).toBeVisible();
    // a meta no piso abriria a linha dela sobre a do eixo x: a régua desce um passo
    await expect.poll(() => rotulosDoEixoY(grafico)).toEqual(["78", "80", "82", "84", "86"]);

    /** A linha da meta cai dentro da área de desenho, na altura do 80. */
    const medirMeta = (g: Locator) =>
      g.evaluate((el) => {
        const linha = el.querySelector(".recharts-reference-line line");
        const grade = el.querySelector(".recharts-cartesian-grid");
        const oitenta = [
          ...el.querySelectorAll(".recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value"),
        ].find(
          (t) => t.textContent?.trim() === "80",
        );
        if (!linha || !grade || !oitenta) return null;
        const l = linha.getBoundingClientRect();
        const a = grade.getBoundingClientRect();
        const t = oitenta.getBoundingClientRect();
        return {
          dentro: l.top >= a.top - 1 && l.bottom <= a.bottom + 1,
          /** Da linha da meta até o pé da área (a linha do eixo x), em px. */
          folgaDoPiso: a.bottom - (l.top + l.height / 2),
          distanciaDoRotulo: Math.abs(l.top + l.height / 2 - (t.top + t.height / 2)),
          tracejada: (linha.getAttribute("stroke-dasharray") ?? "") !== "",
        };
      });
    await expect.poll(() => medirMeta(grafico)).not.toBeNull();
    const noCorpo = await medirMeta(grafico);
    expect(noCorpo?.dentro).toBe(true);
    expect(noCorpo?.tracejada).toBe(true);
    expect(noCorpo?.distanciaDoRotulo ?? 99).toBeLessThanOrEqual(3);
    expect(noCorpo?.folgaDoPiso ?? 0, "a meta não se deita sobre o eixo x").toBeGreaterThan(8);

    await page.goto("/relatorio");
    await abrirSecaoDoRelatorio(page, "corpo");
    const card = page.getByRole("region", { name: "Peso" });
    const pequeno = card.getByRole("img", { name: `${LEITURA_DO_PESO} Meta: 80 kg.` });
    await expect(pequeno).toBeVisible();
    await expect.poll(() => rotulosDoEixoY(pequeno)).toEqual(["78", "80", "82", "84", "86"]);
    await expect.poll(() => medirMeta(pequeno)).not.toBeNull();
    const noRelatorio = await medirMeta(pequeno);
    expect(noRelatorio?.dentro).toBe(true);
    expect(noRelatorio?.folgaDoPiso ?? 0, "a meta não se deita sobre o eixo x").toBeGreaterThan(8);
    await expect(card.getByText("Meta 80 kg", { exact: true })).toBeVisible();
  });

  for (const tema of TEMAS) {
    test(`sem meta, "Definir uma meta" leva ao campo da meta (${tema})`, async ({ page }) => {
      const sessao = await preparar(page, tema);
      await inserirNoMock(sessao, "body_weights", PESOS);
      await abrirCorpo(page);

      await expect(page.getByText(/embaixo/i)).toHaveCount(0);
      const link = page.getByRole("link", { name: "Definir uma meta" });
      await expect(link).toBeVisible();
      const caixa = await link.boundingBox();
      expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      await link.click();
      const campo = page.getByLabel("Meta (kg)");
      await expect(campo).toBeFocused();
      await expect(campo).toBeInViewport();
      // e dá para guardar dali mesmo
      await campo.fill("80");
      await page.getByRole("button", { name: "Salvar" }).click();
      await expect
        .poll(async () => {
          const [perfil] = await lerDoMock<{ prefs: { meta_peso?: number } }>(sessao, "profiles");
          return perfil?.prefs?.meta_peso;
        })
        .toBe(80);
      await expect(page.getByText("Faltam 2,4 kg para a meta de 80 kg.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Definir uma meta" })).toHaveCount(0);
    });
  }
});

test.describe("§22.19 itens 2 e 4 — sem pesagem e sem dados", () => {
  test("sem pesagem: 'Sem pesagem', o link da meta, nenhum gráfico", async ({ page }) => {
    await preparar(page);
    await abrirCorpo(page);

    await expect(page.getByText("Sem pesagem", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Definir uma meta" })).toBeVisible();
    await expect(page.getByText("O gráfico aparece com a primeira pesagem.")).toBeVisible();
    await expect(page.locator("figure")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Data" })).toBeVisible();
    await expect(page.getByRole("region", { name: "IMC" })).toContainText(
      "Registre o peso para ver o IMC.",
    );
    await semCamadaDoRecharts(page);
    await semRolagemHorizontal(page);
  });

  test("meta sem pesagem: diz a meta, sem link e sem 'Faltam'", async ({ page }) => {
    await preparar(page, "dark", { prefs: { meta_peso: 80 } });
    await abrirCorpo(page);

    await expect(page.getByText("Meta de 80 kg.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Definir uma meta" })).toHaveCount(0);
    await expect(page.getByText(/Faltam/)).toHaveCount(0);
    await semRolagemHorizontal(page);
  });
});

/* ------------------------------------------------------------ item 5 */

test.describe("§22.19 item 5 — a faixa do IMC em texto", () => {
  for (const tema of TEMAS) {
    test(`82,4 kg e 190 cm: 'saudável' aceso sob o marcador (${tema})`, async ({ page }) => {
      const sessao = await preparar(page, tema);
      await inserirNoMock(sessao, "body_weights", PESOS);
      await abrirCorpo(page);

      const imc = page.getByRole("region", { name: "IMC" });
      await expect(imc).toContainText("22,8");
      const trechos = imc.locator("[data-trecho]");
      await expect(trechos).toHaveText(["abaixo", "saudável", "sobrepeso", "obesidade"]);
      const aceso = imc.locator("[data-trecho][data-atual]");
      await expect(aceso).toHaveCount(1);
      await expect(aceso).toHaveAttribute("data-trecho", "saudavel");

      const medida = await imc.evaluate((el) => {
        const marcador = el.querySelector('[data-marcador="imc"]')?.getBoundingClientRect();
        const spans = [...el.querySelectorAll<HTMLElement>("[data-trecho]")];
        const textos = spans.map((s) => {
          const r = document.createRange();
          r.selectNodeContents(s);
          const t = r.getBoundingClientRect();
          return { chave: s.dataset.trecho, esq: t.left, dir: t.right, atual: "atual" in s.dataset };
        });
        const caixas = spans.map((s) => s.getBoundingClientRect());
        const atual = spans.find((s) => "atual" in s.dataset);
        const fundo = getComputedStyle(el).backgroundColor;
        return {
          centro: marcador ? marcador.left + marcador.width / 2 : -1,
          textos,
          caixas: caixas.map((c) => ({ esq: c.left, dir: c.right })),
          corAtual: atual ? getComputedStyle(atual).color : "",
          pesoAtual: atual ? getComputedStyle(atual).fontWeight : "",
          corOutra: getComputedStyle(spans[0]!).color,
          fundo,
        };
      });
      // o marcador cai dentro do trecho aceso
      const trechoSaudavel = medida.caixas[1]!;
      expect(medida.centro).toBeGreaterThan(trechoSaudavel.esq);
      expect(medida.centro).toBeLessThan(trechoSaudavel.dir);
      // os rótulos não se encostam e cabem no próprio trecho
      for (let i = 0; i < medida.textos.length; i++) {
        const t = medida.textos[i]!;
        const c = medida.caixas[i]!;
        expect(t.esq, `${t.chave} dentro do trecho`).toBeGreaterThanOrEqual(c.esq - 0.5);
        expect(t.dir, `${t.chave} dentro do trecho`).toBeLessThanOrEqual(c.dir + 0.5);
        const proximo = medida.textos[i + 1];
        if (proximo) expect(proximo.esq - t.dir, `${t.chave} → ${proximo.chave}`).toBeGreaterThanOrEqual(2);
      }
      // o aceso em negrito; os dois com contraste AA contra o cartão
      expect(Number(medida.pesoAtual)).toBeGreaterThanOrEqual(600);
      expect(contraste(medida.corAtual, medida.fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(medida.corOutra, medida.fundo)).toBeGreaterThanOrEqual(4.5);
      await semRolagemHorizontal(page);
    });
  }
});

/* ------------------------------------------------------------ item 6 */

/** Anota cada `showPicker()` chamado — o seletor do aparelho não é desenhado no teste. */
async function espiarSeletor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __seletor: string[] };
    w.__seletor = [];
    HTMLInputElement.prototype.showPicker = function (this: HTMLInputElement) {
      w.__seletor.push(this.id);
    };
  });
}

async function seletoresAbertos(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __seletor: string[] }).__seletor);
}

/** Os três botões do grupo Data medem ≥ 44 px nos dois sentidos. */
async function tresBotoesDe44(grupo: Locator): Promise<void> {
  const botoes = grupo.getByRole("button");
  await expect(botoes).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const caixa = await botoes.nth(i).boundingBox();
    expect(caixa?.height ?? 0, `botão ${i + 1}`).toBeGreaterThanOrEqual(44);
    expect(caixa?.width ?? 0, `botão ${i + 1}`).toBeGreaterThanOrEqual(44);
  }
}

/** O relógio do aparelho avança e o app volta ao primeiro plano (o `useHoje` relê). */
async function avancarRelogio(page: Page, quando: string): Promise<void> {
  await page.clock.setFixedTime(new Date(quando));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
}

/** Nenhuma data crua na parte visível do cartão (aaaa-mm-dd ou mm/dd/aaaa). */
async function semDataCrua(cartao: Locator): Promise<void> {
  const texto = await cartao.innerText();
  expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/);
}

test.describe("§22.19 item 6 — Hoje · Ontem · Outra data", () => {
  for (const tema of TEMAS) {
    test(`Peso: hoje sem toque, ontem com um, outra pelo seletor (${tema})`, async ({ page }) => {
      await espiarSeletor(page);
      const sessao = await preparar(page, tema);
      await abrirCorpo(page);

      const grupo = page.getByRole("group", { name: "Data" });
      const hoje = grupo.getByRole("button", { name: /^Hoje\s*16\/09$/ });
      const ontem = grupo.getByRole("button", { name: /^Ontem\s*15\/09$/ });
      const outra = grupo.getByRole("button", { name: "Outra data", exact: true });
      await expect(hoje).toHaveAttribute("aria-pressed", "true");
      await expect(ontem).toHaveAttribute("aria-pressed", "false");
      await expect(outra).toHaveAttribute("aria-pressed", "false");
      for (const b of [hoje, ontem, outra]) {
        const caixa = await b.boundingBox();
        expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(44);
      }
      const cartao = page.locator('[data-slot="card"]', { hasText: "Registrar peso" });
      await semDataCrua(cartao);

      // hoje: nenhum toque na data
      await page.getByLabel("Peso (kg)").fill("82,4");
      await page.getByRole("button", { name: "Registrar", exact: true }).click();
      await expect(page.getByText("Peso de 16/09 registrado.")).toBeVisible();

      // ontem: um toque
      await ontem.click();
      await expect(ontem).toHaveAttribute("aria-pressed", "true");
      await expect(hoje).toHaveAttribute("aria-pressed", "false");
      await page.getByLabel("Peso (kg)").fill("82,6");
      await page.getByRole("button", { name: "Registrar", exact: true }).click();
      await expect(page.getByText("Peso de 15/09 registrado.")).toBeVisible();
      // registrado, o campo volta para Hoje: a próxima pesagem é de hoje
      await expect(hoje).toHaveAttribute("aria-pressed", "true");
      await expect(ontem).toHaveAttribute("aria-pressed", "false");

      // outra: o toque abre o seletor do aparelho; ele escreve no campo escondido
      await outra.click();
      expect(await seletoresAbertos(page)).toEqual(["peso-data"]);
      await page.locator("#peso-data").fill("2026-08-16");
      await expect(outra).toHaveAttribute("aria-pressed", "true");
      await expect(outra).toContainText("16/08");
      // o nome não muda com a data (fica na descrição)
      await expect(outra).toHaveAccessibleName("Outra data");
      await expect(outra).toHaveAccessibleDescription("16/08");
      // uma data depois de hoje não vale (o seletor já tem max = hoje) e avisa
      await page.locator("#peso-data").fill("2026-09-20");
      await expect(page.getByText("Escolha uma data até hoje.")).toBeVisible();
      await expect(outra).toContainText("16/08");
      await expect(outra).toHaveAttribute("aria-pressed", "true");
      await page.getByLabel("Peso (kg)").fill("83");
      await page.getByRole("button", { name: "Registrar", exact: true }).click();
      await expect(page.getByText("Peso de 16/08 registrado.")).toBeVisible();
      await expect(hoje).toHaveAttribute("aria-pressed", "true");
      await semDataCrua(cartao);

      await expect
        .poll(async () =>
          (await lerDoMock<{ data: string; peso_kg: number }>(sessao, "body_weights"))
            .map((l) => `${l.data}=${Number(l.peso_kg)}`)
            .sort(),
        )
        .toEqual(["2026-08-16=83", "2026-09-15=82.6", "2026-09-16=82.4"]);
      await semRolagemHorizontal(page);
    });
  }

  test("Medidas e Fotos usam o mesmo campo", async ({ page }, info) => {
    await espiarSeletor(page);
    const sessao = await preparar(page);
    await abrirCorpo(page, "Medidas");

    const grupo = page.getByRole("group", { name: "Data" });
    await expect(grupo.getByRole("button", { name: /^Hoje\s*16\/09$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await tresBotoesDe44(grupo);
    await semDataCrua(page.locator('[data-slot="card"]', { hasText: "Registrar medidas" }));
    await grupo.getByRole("button", { name: /^Ontem\s*15\/09$/ }).click();
    await page.getByLabel("Cintura (cm)").fill("90");
    await page.getByRole("button", { name: "Registrar medidas" }).click();
    await expect(page.getByText("Medidas de 15/09 registradas.")).toBeVisible();
    // registrado, volta para Hoje (como no Peso)
    await expect(grupo.getByRole("button", { name: /^Hoje\s*16\/09$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect
      .poll(async () =>
        (await lerDoMock<{ data: string }>(sessao, "body_measurements")).map((l) => l.data),
      )
      .toEqual(["2026-09-15"]);
    await semRolagemHorizontal(page);

    await page.getByRole("tab", { name: "Fotos" }).click();
    const fotos = page.getByRole("group", { name: "Data" });
    await expect(fotos.getByRole("button", { name: /^Hoje\s*16\/09$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await tresBotoesDe44(fotos);
    expect(await page.evaluate(() => navigator.language)).toBe("pt-BR");
    await info.attach("Data em português no celular emulado", {
      body: await fotos.screenshot(), contentType: "image/png",
    });
    await fotos.getByRole("button", { name: "Outra data", exact: true }).click();
    expect(await seletoresAbertos(page)).toEqual(["fotos-data"]);
    await semDataCrua(page.locator('[data-slot="card"]', { hasText: "Registre sua primeira foto" }));
    await semRolagemHorizontal(page);
  });

  test("a virada do dia com o Corpo aberto: Hoje segue o relógio e nada vai para a véspera", async ({
    page,
  }) => {
    const sessao = await preparar(page);
    await inserirNoMock(sessao, "body_weights", [{ data: "2026-09-16", peso_kg: 82.4 }]);
    await abrirCorpo(page);
    const grupo = page.getByRole("group", { name: "Data" });
    await expect(grupo.getByRole("button", { name: /^Hoje\s*16\/09$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // a tela fica aberta (ou em segundo plano) até a manhã seguinte
    await avancarRelogio(page, "2026-09-17T07:30:00-03:00");
    const hoje17 = grupo.getByRole("button", { name: /^Hoje\s*17\/09$/ });
    await expect(hoje17).toHaveAttribute("aria-pressed", "true");
    await expect(grupo.getByRole("button", { name: /^Ontem\s*16\/09$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // sem tocar na data: grava 17/09, e a pesagem de 16/09 fica como estava
    await page.getByLabel("Peso (kg)").fill("82,1");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(page.getByText("Peso de 17/09 registrado.")).toBeVisible();
    await expect
      .poll(async () =>
        (await lerDoMock<{ data: string; peso_kg: number }>(sessao, "body_weights"))
          .map((l) => `${l.data}=${Number(l.peso_kg)}`)
          .sort(),
      )
      .toEqual(["2026-09-16=82.4", "2026-09-17=82.1"]);

    // um "Ontem" tocado em 17/09 não atravessa a virada: em 18/09 é Hoje de novo
    await grupo.getByRole("button", { name: /^Ontem\s*16\/09$/ }).click();
    await expect(grupo.getByRole("button", { name: /^Ontem\s*16\/09$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await avancarRelogio(page, "2026-09-18T06:10:00-03:00");
    await expect(grupo.getByRole("button", { name: /^Hoje\s*18\/09$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(grupo.getByRole("button", { name: /^Ontem\s*17\/09$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await semRolagemHorizontal(page);
  });

  test("sem showPicker, Outra data põe o foco no campo fora do aria-hidden", async ({ page }) => {
    await page.addInitScript(() => {
      delete (HTMLInputElement.prototype as { showPicker?: unknown }).showPicker;
    });
    const sessao = await preparar(page);
    await abrirCorpo(page);

    const outra = page.getByRole("button", { name: "Outra data", exact: true });
    const campo = page.locator("#peso-data");
    await expect(campo).toHaveAttribute("aria-hidden", "true");
    await outra.click();
    // o foco não cai num elemento fora da árvore
    await expect(campo).toBeFocused();
    await expect(campo).not.toHaveAttribute("aria-hidden");
    await expect(campo).toHaveAccessibleName("Outra data");
    await campo.fill("2026-08-16");
    await expect(outra).toHaveAttribute("aria-pressed", "true");
    await expect(outra).toHaveAccessibleDescription("16/08");
    // ao sair do campo ele volta a ficar escondido da árvore
    await page.getByLabel("Peso (kg)").focus();
    await expect(campo).toHaveAttribute("aria-hidden", "true");
    await page.getByLabel("Peso (kg)").fill("83");
    await page.getByRole("button", { name: "Registrar", exact: true }).click();
    await expect(page.getByText("Peso de 16/08 registrado.")).toBeVisible();
    await expect
      .poll(async () =>
        (await lerDoMock<{ data: string }>(sessao, "body_weights")).map((l) => l.data),
      )
      .toEqual(["2026-08-16"]);
  });

  test("o anel de foco dos controles novos aparece inteiro (Tab)", async ({ page }) => {
    const sessao = await preparar(page, "dark");
    await inserirNoMock(sessao, "body_weights", PESOS);
    await abrirCorpo(page);

    const alvos = [
      page.getByRole("link", { name: "Definir uma meta" }),
      page.getByRole("button", { name: /^Hoje\s*16\/09$/ }),
      page.getByRole("button", { name: /^Ontem\s*15\/09$/ }),
      page.getByRole("button", { name: "Outra data", exact: true }),
    ];
    for (const alvo of alvos) {
      await alvo.scrollIntoViewIfNeeded();
      await alvo.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(alvo).toBeFocused();
      const anel = await alvo.evaluate((el) => {
        const estilo = getComputedStyle(el);
        const caixa = el.getBoundingClientRect();
        const folga = parseFloat(estilo.outlineWidth) + parseFloat(estilo.outlineOffset);
        // o ancestral que corta (o Card tem overflow-hidden)
        let corte: DOMRect | null = null;
        for (let p = el.parentElement; p; p = p.parentElement) {
          if (getComputedStyle(p).overflow !== "visible") {
            corte = p.getBoundingClientRect();
            break;
          }
        }
        return {
          visivel: el.matches(":focus-visible"),
          largura: parseFloat(estilo.outlineWidth),
          estilo: estilo.outlineStyle,
          inteiro:
            !corte ||
            (caixa.left - folga >= corte.left &&
              caixa.right + folga <= corte.right &&
              caixa.top - folga >= corte.top &&
              caixa.bottom + folga <= corte.bottom),
        };
      });
      expect(anel.visivel).toBe(true);
      expect(anel.largura).toBeGreaterThanOrEqual(2);
      expect(anel.estilo).toBe("solid");
      expect(anel.inteiro, "o anel não é cortado pelo cartão").toBe(true);
    }
  });
});
