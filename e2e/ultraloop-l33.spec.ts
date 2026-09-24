/**
 * Ultraloop — Rodada 25, Lote 33 (SPEC §22.17): sobras do L14 e do L32 —
 * ficha, catálogo e camadas modais. Tudo a 360×740, contra o mock, pelo
 * caminho que o dedo faz, nos dois temas onde o aceite pede.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { filtrarExercicios, rotuloDoImplemento } from "../lib/catalogo";
import { acharExercicio, exercicios } from "../lib/dados";
import { textosDaPagina } from "../lib/ficha-espelho";
import { opcoesDeMontagem } from "../lib/preferencias";
import {
  abrirVisaoGeral,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** Segunda, 14/09/2026: dia de treino (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";
/** Quarta, 16/09/2026: o Calendário tem o "Não vou treinar hoje". */
const QUARTA = "2026-09-16T08:00:00-03:00";
const TEMAS = ["light", "dark"] as const;
type Tema = (typeof TEMAS)[number];

const SUPINO = "supino-reto-com-barra";

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
  data: string = SEGUNDA,
  ajustes: Record<string, unknown> = {},
): Promise<void> {
  await usuarioComPerfil(ajustes);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: tema });
  await fixarData(page, data);
  await entrarNoApp(page);
}

/** A posição da entrada atual no histórico da aba (Navigation API). */
async function indice(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { navigation: { currentEntry: { index: number } } }).navigation
        .currentEntry.index,
  );
}

async function abrirFicha(page: Page, id: string): Promise<void> {
  await page.goto(`/exercicios/${id}`);
  await expect(
    page.getByRole("heading", { name: acharExercicio(id).nome, level: 1 }),
  ).toBeVisible();
}

/* ============================================================ item 1 */

test.describe("§22.17 item 1 — um rótulo por filtro", () => {
  for (const tema of TEMAS) {
    test(`implemento 'Super Band (principal)' × equipamento 'Super Band', chips diferentes (${tema})`, async ({
      page,
    }) => {
      await preparar(page, tema);
      await page.goto("/exercicios");
      await page.getByRole("button", { name: /^Filtros/ }).click();
      const folha = page.getByRole("dialog");
      await expect(folha).toBeVisible();
      const implemento = folha.getByLabel("Implemento");
      const equipamento = folha.getByLabel("Equipamento");
      const opcoes = async (s: Locator) =>
        s.evaluate((el) => [...(el as HTMLSelectElement).options].map((o) => o.text));
      const doImplemento = await opcoes(implemento);
      const doEquipamento = await opcoes(equipamento);
      // nenhum rótulo igual nos dois seletores com listas diferentes
      for (const rotulo of ["Super Band", "Halteres", "Barra maciça"]) {
        expect(doImplemento).toContain(`${rotulo} (principal)`);
        expect(doImplemento).not.toContain(rotulo);
        expect(doEquipamento).toContain(rotulo);
      }
      for (const rotulo of ["Barra fixa", "Barra W", "Corda"]) {
        expect(doImplemento).toContain(rotulo);
        expect(doEquipamento).toContain(rotulo);
      }
      // um seletor por linha: o rótulo inteiro cabe, e nada vaza
      // arredondado: a folha acabou de subir e a caixa vem com 43,99997 px
      const caixas = await folha.locator("select").evaluateAll((els) =>
        els.map((el) => {
          const c = el.getBoundingClientRect();
          return { largura: Math.round(c.width), altura: Math.round(c.height) };
        }),
      );
      expect(caixas).toHaveLength(3);
      for (const c of caixas) {
        expect(c.altura).toBeGreaterThanOrEqual(44);
        expect(c.largura).toBeGreaterThanOrEqual(300);
      }
      await semRolagemHorizontal(page);

      await implemento.selectOption({ label: "Super Band (principal)" });
      await equipamento.selectOption({ label: "Super Band" });
      const n = filtrarExercicios(exercicios, {
        implemento: "band",
        equipamento: "super-band",
      }).length;
      await folha
        .getByRole("button", { name: n === 1 ? "Ver 1 exercício" : `Ver ${n} exercícios` })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const chips = page.getByRole("list", { name: "Filtros ligados" }).getByRole("button");
      await expect(chips).toHaveText([rotuloDoImplemento("band"), "Super Band"]);
      await expect(chips.first()).toHaveText("Super Band (principal)");
      await semRolagemHorizontal(page);
    });
  }
});

/* ============================================================ item 3 */

/**
 * Os parágrafos e itens visíveis do `<main>` (12 caracteres ou mais), sem
 * os que contêm outro parágrafo ou item — o mesmo recorte do §22.14 item 3.
 */
async function textosDoMain(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("main p, main li")]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .filter((el) => !el.querySelector("p, li"))
      .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((t) => t.length >= 12),
  );
}

test.describe("§22.17 item 3 — o espelho dos textos é o DOM, nas 81 fichas", () => {
  const LOTE = 27;
  for (let de = 0; de < exercicios.length; de += LOTE) {
    const lote = exercicios.slice(de, de + LOTE);
    test(`fichas ${de + 1}–${de + lote.length}: DOM igual ao espelho`, async ({ page }) => {
      test.setTimeout(240_000);
      await preparar(page);
      const opcoes = opcoesDeMontagem(null);
      const falhas: string[] = [];
      for (const e of lote) {
        await abrirFicha(page, e.id);
        await expect(page.locator("[data-historico-vazio]")).toBeVisible();
        const dom = (await textosDoMain(page)).sort();
        const espelho = textosDaPagina(e, opcoes).sort();
        const soNoDom = dom.filter((t) => !espelho.includes(t));
        const soNoEspelho = espelho.filter((t) => !dom.includes(t));
        if (soNoDom.length > 0 || soNoEspelho.length > 0 || dom.length !== espelho.length) {
          falhas.push(
            `${e.id}: só no DOM ${JSON.stringify(soNoDom)} · só no espelho ${JSON.stringify(soNoEspelho)} · ${dom.length} × ${espelho.length}`,
          );
        }
      }
      expect(falhas).toEqual([]);
    });
  }
});

/* ============================================================ item 4 */

test.describe("§22.17 item 4 — 'Onde você está' espera o perfil", () => {
  test("barra W de 5 kg e o perfil atrasado: o histórico nasce com o cartão, e a altura não muda", async ({
    page,
  }) => {
    await preparar(page, "light", SEGUNDA, { prefs: { pesos_barras: { "barra-w": 5 } } });
    // o cache do aparelho não entrega o perfil: ele vem só da rede, atrasado
    await page.addInitScript(() => {
      const pedido = indexedDB.open("treino-terraco");
      pedido.onsuccess = () => {
        const banco = pedido.result;
        if (banco.objectStoreNames.contains("cache")) {
          banco.transaction("cache", "readwrite").objectStore("cache").delete("react-query-v1");
        }
        banco.close();
      };
      /*
       * O primeiro quadro em que o histórico saiu do esqueleto: o cartão
       * "Onde você está" já estava lá? E a altura do histórico nesse quadro.
       */
      const w = window as unknown as {
        primeiroDesenho?: { onde: boolean; altura: number };
      };
      new MutationObserver(() => {
        if (w.primeiroDesenho) return;
        const vazio = document.querySelector("[data-historico-vazio]");
        if (!vazio?.parentElement) return;
        w.primeiroDesenho = {
          onde: document.querySelector("[data-onde-voce-esta]") !== null,
          altura: vazio.parentElement.getBoundingClientRect().height,
        };
      }).observe(document, { childList: true, subtree: true });
    });
    let atrasados = 0;
    await page.route(/\/rest\/v1\/profiles/, async (rota) => {
      if (rota.request().method() === "GET") {
        atrasados += 1;
        await new Promise((r) => setTimeout(r, 2_500));
      }
      await rota.continue();
    });

    await abrirFicha(page, "rosca-com-barra-w");
    const onde = page.locator("[data-onde-voce-esta]");
    await expect(onde).toContainText("5 kg na barra", { timeout: 15_000 });
    await expect(page.locator("[data-historico-vazio]")).toBeVisible();
    expect(atrasados).toBeGreaterThan(0);

    const primeiro = await page.evaluate(
      () =>
        (window as unknown as { primeiroDesenho?: { onde: boolean; altura: number } })
          .primeiroDesenho,
    );
    expect(primeiro, "o histórico nunca saiu do esqueleto").toBeTruthy();
    expect(primeiro!.onde, "o histórico desenhou sem 'Onde você está'").toBe(true);
    const agora = await page
      .locator("[data-historico-vazio]")
      .evaluate((el) => el.parentElement!.getBoundingClientRect().height);
    expect(Math.abs(agora - primeiro!.altura)).toBeLessThanOrEqual(1);
  });
});

/* ============================================================ item 6 */

/**
 * O voltar do celular com a camada aberta pelo teclado: fecha só a camada, a
 * rota e o índice do histórico voltam aos de antes de abrir e o foco volta ao
 * gatilho. Depois, fechar pelo Esc não deixa entrada sobrando.
 */
async function voltarFechaACamada(
  page: Page,
  gatilho: Locator,
  camada: Locator,
): Promise<void> {
  const url = page.url();
  const antes = await indice(page);
  await gatilho.focus();
  await page.keyboard.press("Enter");
  await expect(camada).toBeVisible();
  // a camada tem a própria entrada, na mesma rota
  await expect.poll(() => indice(page)).toBe(antes + 1);
  expect(page.url()).toBe(url);

  // o voltar do Android (e do TalkBack) é um history.back() na aba
  await page.evaluate(() => window.history.back());
  await expect(camada).toHaveCount(0);
  await expect(gatilho).toBeFocused();
  expect(page.url()).toBe(url);
  await expect.poll(() => indice(page)).toBe(antes);
  expect(await page.evaluate(() => document.querySelectorAll("[inert]").length)).toBe(0);

  // pelo Esc: a entrada sai junto, nada sobra
  await page.keyboard.press("Enter");
  await expect(camada).toBeVisible();
  await expect.poll(() => indice(page)).toBe(antes + 1);
  await page.keyboard.press("Escape");
  await expect(camada).toHaveCount(0);
  await expect(gatilho).toBeFocused();
  await expect.poll(() => indice(page)).toBe(antes);
  expect(page.url()).toBe(url);
  await semRolagemHorizontal(page);
}

test.describe("§22.17 item 6 — o voltar do celular fecha só a camada de cima", () => {
  for (const tema of TEMAS) {
    test(`filtros do catálogo (${tema})`, async ({ page }) => {
      await preparar(page, tema);
      await page.goto("/exercicios");
      const gatilho = page.getByRole("button", { name: /^Filtros/ });
      await expect(gatilho).toBeVisible();
      await voltarFechaACamada(page, gatilho, page.getByRole("dialog"));

      // "Ver resultados" também desfaz a entrada, e o primeiro resultado fica à vista
      const antes = await indice(page);
      await gatilho.click();
      const folha = page.getByRole("dialog");
      await folha.getByLabel("Grupo").selectOption({ index: 1 });
      await folha.getByRole("button", { name: /^Ver \d+ exercícios?$/ }).click();
      await expect(folha).toHaveCount(0);
      await expect.poll(() => indice(page)).toBe(antes);
      await expect(page.locator('main a[href^="/exercicios/"]').first()).toBeInViewport();
    });

    test(`foto ampliada da ficha (${tema})`, async ({ page }) => {
      await preparar(page, tema);
      await abrirFicha(page, SUPINO);
      const gatilho = page.getByRole("button", { name: /Ampliar a foto do início/ });
      await voltarFechaACamada(page, gatilho, page.getByRole("dialog"));
    });

    test(`diálogo "Não vou treinar hoje" do Calendário (${tema})`, async ({ page }) => {
      await preparar(page, tema, QUARTA);
      await page.goto("/calendario");
      await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
      const gatilho = page.getByRole("button", { name: "Não vou treinar hoje" });
      await expect(gatilho).toBeVisible();
      await voltarFechaACamada(page, gatilho, page.getByRole("dialog"));
    });
  }

  test("dentro da Visão geral a folha não empilha: o índice não sobe ao abrir", async ({
    page,
  }) => {
    await preparar(page);
    await esperarAbaTreino(page);
    await comecarOTreinoDoDia(page);
    await abrirVisaoGeral(page);
    const geral = page.getByRole("dialog", { name: "Visão geral do treino" });
    await expect(geral).toBeVisible();
    const antes = await indice(page);
    await geral.getByRole("button", { name: "substituir hoje" }).first().click();
    const folha = page.locator('[data-slot="sheet-content"]');
    await expect(folha).toBeVisible();
    // dá tempo de uma entrada aparecer, se fosse aparecer
    await page.waitForTimeout(300);
    expect(await indice(page)).toBe(antes);
    // o voltar fecha só a folha (a regra da Visão geral, §22.14 item 6)
    await page.evaluate(() => window.history.back());
    await expect(folha).toHaveCount(0);
    await expect(geral).toBeVisible();
    await expect.poll(() => indice(page)).toBe(antes);
  });
});
