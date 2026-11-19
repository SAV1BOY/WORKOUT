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
  comecarNoPlayer,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  inserirNoMock,
  resetarMock,
  semCacheDoAparelho,
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

type ComIndice = {
  navigation?: { currentEntry: { index: number } };
  __indiceDoTeste?: () => number;
};

/**
 * A posição da entrada atual no histórico da aba (Navigation API). Sem ela
 * (`semNavigationApi`), pela referência que o teste guardou antes de apagá-la
 * — o app não a vê.
 */
async function indice(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as unknown as ComIndice;
    return w.__indiceDoTeste ? w.__indiceDoTeste() : w.navigation!.currentEntry.index;
  });
}

/**
 * Simula o Safari do iPhone (e Firefox antigo): `window.navigation` não
 * existe quando o app carrega. Tem de vir antes da primeira navegação.
 */
async function semNavigationApi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as ComIndice & Record<string, unknown>;
    const real = w.navigation;
    if (!real) return;
    Object.defineProperty(window, "__indiceDoTeste", {
      value: () => real.currentEntry.index,
    });
    delete w.navigation;
  });
}

const MODOS = ["com a Navigation API", "sem a Navigation API"] as const;
type Modo = (typeof MODOS)[number];

/** O modo pedido está valendo na página (a simulação não falhou em silêncio). */
async function conferirModo(page: Page, modo: Modo): Promise<void> {
  expect(await page.evaluate(() => "navigation" in window)).toBe(
    modo === "com a Navigation API",
  );
}

/**
 * Um passo no histórico da aba (o voltar ou o avançar do aparelho) e espera
 * o app assentar: devolve quantos `popstate` houve — o do toque e, se o app
 * pulou uma entrada, o do passo a mais.
 */
async function andarNoHistorico(page: Page, para: "back" | "forward"): Promise<number> {
  return page.evaluate(async (para) => {
    let n = 0;
    const contar = () => {
      n += 1;
    };
    window.addEventListener("popstate", contar);
    if (para === "back") window.history.back();
    else window.history.forward();
    // assentou: 400 ms sem popstate novo
    let visto = -1;
    while (visto !== n) {
      visto = n;
      await new Promise((r) => setTimeout(r, 400));
    }
    window.removeEventListener("popstate", contar);
    return n;
  }, para);
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
      // a caixa medida sem arredondar: a folha acabou de subir e o subpixel
      // dá 43,99997 px; a tolerância é explícita (0,01 px), não meio pixel
      const caixas = await folha.locator("select").evaluateAll((els) =>
        els.map((el) => {
          const c = el.getBoundingClientRect();
          return { largura: c.width, altura: c.height };
        }),
      );
      expect(caixas).toHaveLength(3);
      for (const c of caixas) {
        expect(c.altura).toBeGreaterThanOrEqual(43.99);
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
  // o atraso é do page.route: o service worker não pode tratar o pedido (ver semCacheDoAparelho)
  test.use({ serviceWorkers: "block" });

  test("barra W de 5 kg e o perfil atrasado: o histórico nasce com o cartão, e a altura não muda", async ({
    page,
  }) => {
    await preparar(page, "light", SEGUNDA, { prefs: { pesos_barras: { "barra-w": 5 } } });
    await page.addInitScript(() => {
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
    // o cache do aparelho não entrega o perfil: ele vem só da rede, atrasado
    await semCacheDoAparelho(page);

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



/**
 * A leitura `tabela` do mock falha (500) enquanto `falhando()` for verdade —
 * o pedido e as duas repetições do TanStack Query. Devolve quantas falharam.
 */
async function falharLeitura(
  page: Page,
  tabela: string,
  falhando: () => boolean,
): Promise<() => number> {
  let falhas = 0;
  await page.route(new RegExp(`/rest/v1/${tabela}(\\?|$)`), async (rota) => {
    if (rota.request().method() === "GET" && falhando()) {
      falhas += 1;
      await rota.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "XX000", message: "falha simulada", details: null, hint: null }),
      });
      return;
    }
    await rota.continue();
  });
  return () => falhas;
}

test.describe("§22.17 item 4 — leitura do histórico que falha mostra o Erro (Codex, PR #33)", () => {
  // Há duas leituras completas e os atrasos reais das repetições de rede.
  test.slow();
  // a falha é do page.route: o service worker não pode tratar as repetições
  test.use({ serviceWorkers: "block" });

  for (const tema of TEMAS) {
    test(`o perfil falha: o Erro no lugar da carga; 'Tentar de novo' traz a carga das barras (${tema})`, async ({
      page,
    }) => {
      await preparar(page, tema, SEGUNDA, { prefs: { pesos_barras: { "barra-w": 5 } } });
      await semCacheDoAparelho(page);
      let falhando = true;
      const falhas = await falharLeitura(page, "profiles", () => falhando);

      await abrirFicha(page, "rosca-com-barra-w");
      const tentar = page.getByRole("button", { name: "Tentar de novo" });
      await expect(tentar).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Não consegui carregar o seu perfil/)).toBeVisible();
      // nenhum número calculado sem as barras, nem o cartão único
      await expect(page.locator("[data-onde-voce-esta]")).toHaveCount(0);
      await expect(page.locator("[data-historico-vazio]")).toHaveCount(0);
      expect(falhas()).toBeGreaterThan(0);
      await semRolagemHorizontal(page);

      // a rede voltou: o "Tentar de novo" refaz o perfil
      falhando = false;
      await tentar.click();
      await expect(page.locator("[data-onde-voce-esta]")).toContainText("5 kg na barra", {
        timeout: 15_000,
      });
      await expect(page.locator("[data-historico-vazio]")).toBeVisible();
      await expect(tentar).toHaveCount(0);
      await semRolagemHorizontal(page);
    });
  }

  test("os eventos do motor falham: o Erro no lugar do cartão único; 'Tentar de novo' traz o evento", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await inserirNoMock(sessao, "progression_events", [
      {
        id: "33333333-3333-4333-8333-333333333341",
        exercise_id: SUPINO,
        data: "2026-09-14",
        de: { carga_kg: 7.5 },
        para: { carga_kg: 9.5 },
        motivo: "subiu",
      },
    ]);
    await page.setViewportSize({ width: 360, height: 740 });
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await semCacheDoAparelho(page);
    let falhando = true;
    const falhas = await falharLeitura(page, "progression_events", () => falhando);

    await abrirFicha(page, SUPINO);
    const tentar = page.getByRole("button", { name: "Tentar de novo" });
    await expect(tentar).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Não consegui carregar o histórico de progressão/)).toBeVisible();
    await expect(page.locator("[data-historico-vazio]")).toHaveCount(0);
    expect(falhas()).toBeGreaterThan(0);

    falhando = false;
    await tentar.click();
    await expect(page.getByText("subiu +2 kg no treino de 14/09")).toBeVisible({
      timeout: 15_000,
    });
    await expect(tentar).toHaveCount(0);
    await expect(page.locator("[data-historico-vazio]")).toHaveCount(0);
    await semRolagemHorizontal(page);
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

  // o avançar logo depois do Esc não para na entrada desfeita: o app volta
  expect(await andarNoHistorico(page, "forward")).toBe(2);
  expect(await indice(page)).toBe(antes);
  await expect(camada).toHaveCount(0);
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

    for (const modo of MODOS) {
      test(`diálogo "Não vou treinar hoje" do Calendário, ${modo} (${tema})`, async ({
        page,
      }) => {
        if (modo === "sem a Navigation API") await semNavigationApi(page);
        await preparar(page, tema, QUARTA);
        await page.goto("/calendario");
        await conferirModo(page, modo);
        await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
        const gatilho = page.getByRole("button", { name: "Não vou treinar hoje" });
        await expect(gatilho).toBeVisible();
        await voltarFechaACamada(page, gatilho, page.getByRole("dialog"));
      });
    }
  }

  /*
   * A entrada morta pelo caminho real: o diálogo de um dia passado do
   * Calendário tem o link "Abrir o cardio". A camada sai porque a rota mudou,
   * a sessão concluída abre o resumo do cardio, e o voltar (e o avançar)
   * passa por cima dela — um passo do dedo, um passo de tela. Nos dois temas,
   * com e sem a Navigation API (o Safari do iPhone não a tem: até a rodada 28
   * o avançar sem ela virava voltar — revisão do Codex no PR #31).
   */
  for (const tema of TEMAS) for (const modo of MODOS) {
    test(`link dentro da camada: o voltar e o avançar pulam a entrada morta, ${modo} (${tema})`, async ({
      page,
    }) => {
      if (modo === "sem a Navigation API") await semNavigationApi(page);
      const sessao = await usuarioComPerfil({ data_inicio: "2026-07-06", fase_desde: "2026-07-06" });
      const id = "33333333-3333-4333-8333-333333333333";
      await inserirNoMock(sessao, "cardio_sessions", [{
        id, data: "2026-08-18", tipo: "corrida", concluida: true,
        duracao_min: 34, distancia_km: 3.6, notas: "Corrida de agosto.",
      }]);
      await page.setViewportSize({ width: 360, height: 740 });
      await page.emulateMedia({ colorScheme: tema });
      await fixarData(page, QUARTA);
      await entrarNoApp(page);
      await page.goto("/calendario");
      await conferirModo(page, modo);
      await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
      const antes = await indice(page);

      await page.getByRole("button", { name: "Mês anterior" }).click();
      const mes = page.getByRole("region", { name: "Mês de agosto de 2026" });
      await expect(mes).toBeVisible();
      const naSemana = tema === "light";
      const gatilho = naSemana ? page.getByRole("list", { name: "Semana" }).getByRole("button", { name: /^terça 18\/08/ })
        : mes.getByRole("button", { name: /^18\/08:/ });
      // O dia 16/08 está na semana anterior a terça 18/08.
      if (naSemana) await page.getByRole("button", { name: "Próxima semana" }).click();
      await gatilho.focus();
      await gatilho.press("Enter");
      const dialogo = page.getByRole("dialog");
      const link = dialogo.getByRole("link", { name: "Abrir o cardio", exact: true });
      await expect(link).toBeVisible();
      // o diálogo tem a própria entrada, na mesma rota
      await expect.poll(() => indice(page)).toBe(antes + 1);
      await link.click();
      await page.waitForURL((url) => url.pathname === "/cardio/corrida" && url.searchParams.get("sessao") === id);
      await expect(page.getByText("Corrida de agosto.")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // a rota nova foi por cima da entrada do diálogo, que ficou morta embaixo
      await expect.poll(() => indice(page)).toBe(antes + 2);

      // um voltar: do resumo do cardio direto ao Calendário, sem diálogo e sem parar na morta
      // (dois popstate: o do toque, na morta, e o do passo a mais)
      expect(await andarNoHistorico(page, "back")).toBe(2);
      await page.waitForURL((url) => url.pathname === "/calendario");
      await expect(mes).toBeVisible();
      await expect(gatilho).toBeFocused();
      expect(await indice(page)).toBe(antes);
      await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await page.evaluate(() => document.querySelectorAll("[inert]").length)).toBe(0);
      await semRolagemHorizontal(page);

      // um avançar: do Calendário direto ao resumo do cardio, pulando a morta na outra direção
      expect(await andarNoHistorico(page, "forward")).toBe(2);
      await page.waitForURL((url) => url.pathname === "/cardio/corrida" && url.searchParams.get("sessao") === id);
      await expect(page.getByText("Corrida de agosto.")).toBeVisible();
      expect(await indice(page)).toBe(antes + 2);
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // e o voltar de novo continua voltando
      expect(await andarNoHistorico(page, "back")).toBe(2);
      await page.waitForURL((url) => url.pathname === "/calendario");
      await expect(mes).toBeVisible();
      await expect(gatilho).toBeFocused();
      expect(await indice(page)).toBe(antes);
    });
  }

  test("dia do histórico abre a semana e preserva a programação futura ao recarregar e voltar", async ({ page }) => {
    await preparar(page, "light", QUARTA);
    const mes = (nome: string) => page.getByRole("region", { name: `Mês de ${nome} de 2026` });
    for (const dia of ["2026-02-30", "2027-04-10"]) {
      await page.goto(`/calendario?dia=${dia}`);
      await expect(mes("setembro")).toBeVisible();
    }
    await page.goto("/calendario?dia=2026-08-18");
    const semana = page.getByRole("list", { name: "Semana" });
    await expect(semana.getByRole("button", { name: /^terça 18\/08/ })).toBeVisible();
    await page.reload();
    await expect(mes("agosto")).toBeVisible();
    await page.getByRole("button", { name: "Hoje", exact: true }).click();
    await expect(mes("setembro")).toBeVisible();
    await page.getByRole("button", { name: "Próximo mês" }).click();
    await expect(mes("outubro")).toBeVisible();
    expect(new URL(page.url()).searchParams.get("dia")).toBeNull();
    await page.reload();
    await expect(semana.getByRole("button", { name: /^sexta 16\/10/ })).toBeVisible();
    await page.getByRole("link", { name: "Meus dias" }).click();
    await page.waitForURL((url) => url.pathname === "/mais/preferencias");
    await page.goBack();
    await expect(mes("outubro")).toBeVisible();
    await expect(semana.getByRole("button", { name: /^sexta 16\/10/ })).toBeVisible();
  });

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

test("o seletor devolve o foco na lista do dia, na série e na ficha atualizada", async ({ page }) => {
  test.slow(); // Lista, série e ficha em uma mesma sessão.
  await preparar(page);
  const lista = page.getByRole("list", { name: "Exercícios de hoje" });
  const gatilhoDoDia = lista.getByRole("button", { name: "Substituir Agachamento livre" });
  await gatilhoDoDia.focus();
  await page.keyboard.press("Enter");
  const seletor = page.getByRole("dialog", { name: "Substituir hoje" });
  await expect(seletor.getByRole("heading", { name: "Substituir hoje" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(gatilhoDoDia).toBeFocused();

  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  const trocar = page.getByRole("button", { name: "Trocar exercício", exact: true });
  await trocar.focus();
  await page.keyboard.press("Enter");
  await expect(seletor.getByRole("heading")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trocar).toBeFocused();

  await page.getByRole("button", { name: "Como fazer: Agachamento livre" }).click();
  const ficha = page.getByRole("dialog");
  const gatilhoDaFicha = ficha.getByRole("button", { name: "Substituir", exact: true });
  await gatilhoDaFicha.click();
  const alternativa = ficha.getByRole("list", { name: "Exercícios alternativos" }).getByRole("button").first();
  const nome = await alternativa.locator("span").first().innerText();
  await alternativa.click();
  await expect(ficha.getByRole("heading", { name: nome, exact: true })).toBeVisible();
  await expect(gatilhoDaFicha).toBeFocused();
  await expect(gatilhoDaFicha).toHaveAttribute("aria-expanded", "false");
});
