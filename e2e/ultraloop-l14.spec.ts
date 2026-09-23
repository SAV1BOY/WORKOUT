/**
 * Ultraloop — Rodada 14, Lote 14 (SPEC §22.14): ficha — conteúdo e ações;
 * nomes do catálogo e créditos. Tudo a 360×740, contra o mock, pelo caminho
 * que o dedo faz, nos dois temas onde o aceite pede.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { treinosDoExercicio } from "../lib/catalogo";
import { acharExercicio, exercicios } from "../lib/dados";
import { linksDosTreinos, tagsDoEquipamento } from "../lib/ficha";
import {
  comecarNoPlayer,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  inserirNoMock,
  irNaAba,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** Segunda, 14/09/2026: dia de treino (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";
const QUARTA = "2026-09-16T08:00:00-03:00";
const TEMAS = ["light", "dark"] as const;
type Tema = (typeof TEMAS)[number];

const SUPINO = "supino-reto-com-barra";

/** Um PNG 16 × 16 de verdade (o app o decodifica no canvas antes de subir). */
const PNG_16 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4YSNHEmIY1TCqYfhqAADXFCIQU/5f4AAAAABJRU5ErkJggg==",
  "base64",
);

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
): Promise<void> {
  await usuarioComPerfil();
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: tema });
  await fixarData(page, data);
  await entrarNoApp(page);
}

async function abrirFicha(page: Page, id: string): Promise<void> {
  await page.goto(`/exercicios/${id}`);
  await expect(
    page.getByRole("heading", { name: acharExercicio(id).nome, level: 1 }),
  ).toBeVisible();
}

/** A caixa de um alvo de toque (SPEC §22.0.1 item 2). */
async function caixa(alvo: Locator): Promise<{ width: number; height: number }> {
  const c = await alvo.boundingBox();
  if (!c) throw new Error("sem caixa");
  return c;
}

/* ------------------------------------------------ item 1: volta e ação */

test.describe("§22.14 item 1 — a ficha em página tem volta e ação", () => {
  test("do catálogo, 'Voltar' volta ao catálogo; aberta direto, leva a /exercicios", async ({
    page,
  }) => {
    await preparar(page);
    await page.goto("/exercicios");
    await page.getByLabel("Buscar exercício pelo nome").fill("supino reto");
    await page.getByRole("link", { name: /Supino reto com barra/ }).first().click();
    await expect(page.getByRole("heading", { name: "Supino reto com barra", level: 1 })).toBeVisible();

    const voltar = page.getByRole("link", { name: "Voltar" });
    await expect(voltar).toBeVisible();
    const c = await caixa(voltar);
    expect(c.height).toBeGreaterThanOrEqual(44);
    // o "Voltar" é a primeira coisa da página, acima do título
    const topoDoTitulo = (await page.getByRole("heading", { level: 1 }).boundingBox())!.y;
    const topoDoVoltar = (await voltar.boundingBox())!.y;
    expect(topoDoVoltar).toBeLessThan(topoDoTitulo);
    await voltar.click();
    await expect(page).toHaveURL(/\/exercicios$/);
    // a busca continua lá: voltou à mesma página, não abriu outra
    await expect(page.getByRole("link", { name: /Supino reto com barra/ }).first()).toBeVisible();

    // numa aba aberta direto na ficha não há página anterior: vai ao catálogo
    const nova = await page.context().newPage();
    await nova.setViewportSize({ width: 360, height: 740 });
    await nova.goto(`/exercicios/${SUPINO}`);
    await expect(nova.getByRole("heading", { level: 1 })).toBeVisible();
    // o about:blank da aba nova conta no history.length (2), mas não é do app
    expect(
      await nova.evaluate(
        () => (window as unknown as { navigation?: { canGoBack: boolean } }).navigation?.canGoBack,
      ),
    ).toBe(false);
    await nova.getByRole("link", { name: "Voltar" }).click();
    await expect(nova).toHaveURL(/\/exercicios$/);
    await nova.close();
  });

  test("'Fazer agora' abre a sessão livre do exercício e a série vai ao IndexedDB na hora", async ({
    page,
    context,
  }) => {
    await preparar(page);
    await abrirFicha(page, SUPINO);
    const fazer = page.getByRole("button", { name: "Fazer agora" });
    await fazer.scrollIntoViewIfNeeded();
    await expect(fazer).toBeEnabled();
    const c = await caixa(fazer);
    expect(c.height).toBeGreaterThanOrEqual(44);
    await semRolagemHorizontal(page);

    await fazer.click();
    await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/);
    await comecarNoPlayer(page);
    await expect(page.getByText("Supino reto com barra").first()).toBeVisible();

    // sem rede: nada sai para o Supabase, e a série tem de estar no aparelho
    await context.setOffline(true);
    try {
      await page.getByRole("button", { name: "Concluir série" }).click();
      const local = async () =>
        page.evaluate(
          () =>
            new Promise<{ sessao: string; saida: string }>((resolver) => {
              const pedido = indexedDB.open("treino-terraco");
              pedido.onerror = () => resolver({ sessao: "", saida: "" });
              pedido.onsuccess = () => {
                const banco = pedido.result;
                const tx = banco.transaction(["sessaoAtiva", "outbox"], "readonly");
                const a = tx.objectStore("sessaoAtiva").getAll();
                const b = tx.objectStore("outbox").getAll();
                tx.oncomplete = () =>
                  resolver({
                    sessao: JSON.stringify(a.result),
                    saida: JSON.stringify(b.result),
                  });
              };
            }),
        );
      await expect
        .poll(async () => (await local()).saida, { timeout: 10_000 })
        .toMatch(/"tipo":"serie"/);
      const { sessao, saida } = await local();
      expect(sessao).toContain(SUPINO);
      expect(saida).toContain(SUPINO);
    } finally {
      await context.setOffline(false);
    }
  });
});

/* -------------------------------------- item 2 e copy-13: o histórico */

test.describe("§22.14 itens 2 e 7 — histórico da ficha", () => {
  test("exercício nunca treinado: um cartão de histórico, não quatro", async ({ page }) => {
    await preparar(page);
    await abrirFicha(page, SUPINO);
    const vazio = page.locator("[data-historico-vazio]");
    await expect(vazio).toHaveCount(1);
    await expect(vazio).toContainText("Ainda sem histórico deste exercício");
    await expect(vazio).toContainText("Ele começa na primeira série registrada.");
    for (const titulo of [
      "Recorde",
      "Carga por sessão",
      "Repetições por sessão",
      "Últimas sessões",
      "O que o motor decidiu",
    ]) {
      await expect(page.getByText(titulo, { exact: true }), titulo).toHaveCount(0);
    }
    // na página, "Onde você está" sem avaliação do motor seria a carga inicial
    // e a prescrição padrão das seções acima: sai, e fica o cartão único
    await expect(page.getByText("Onde você está")).toHaveCount(0);
    await expect(page.locator('main [data-slot="card"]')).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Carga inicial" })).toBeVisible();
  });

  test("com séries e sem eventos do motor: 'manutenção', não 'repetição'", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    const S1 = "aaaaaaaa-1414-4141-8141-000000000001";
    await inserirNoMock(sessao, "sessions", [
      { id: S1, data: "2026-09-14", workout_id: "A1", fase: "fase1", status: "concluida" },
    ]);
    await inserirNoMock(sessao, "session_sets", [1, 2, 3].map((n) => ({
      id: `bbbbbbbb-1414-4141-8141-${String(n).padStart(12, "0")}`,
      session_id: S1,
      exercise_id: SUPINO,
      ordem_ex: 1,
      set_index: n,
      tipo: "trabalho",
      concluida: true,
      carga_kg: 20,
      reps: 8,
      registrada_em: `2026-09-14T12:0${n}:00.000Z`,
    })));
    await page.setViewportSize({ width: 360, height: 740 });
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await abrirFicha(page, SUPINO);

    await expect(page.locator("[data-historico-vazio]")).toHaveCount(0);
    const motor = page.locator('[data-slot="card"]').filter({ hasText: "O que o motor decidiu" });
    await expect(motor).toContainText(
      "Cada subida, manutenção ou volta de carga aparece aqui depois do treino.",
    );
    await expect(motor).not.toContainText("repetição");
    await expect(page.getByText("Últimas sessões", { exact: true })).toBeVisible();
  });
});

/* --------------------------------- item 3: nada repetido, títulos em ordem */

/** Os títulos visíveis do `<main>` na ordem do DOM: [nível, texto]. */
async function titulosDoMain(page: Page): Promise<[number, string][]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("main h1, main h2, main h3, main h4, main h5, main h6")]
      .filter((h) => (h as HTMLElement).offsetParent !== null)
      .map((h) => [Number(h.tagName[1]), (h.textContent ?? "").trim()] as [number, string]),
  );
}

test.describe("§22.14 item 3 — nada repetido na ficha e títulos em ordem", () => {
  for (const tema of TEMAS) {
    test(`página (${tema}): sem repetição, tags e treinos como links, H1 → H2`, async ({
      page,
    }) => {
      await preparar(page, tema);
      await abrirFicha(page, SUPINO);
      await expect(page.locator("[data-historico-vazio]")).toBeVisible();

      // (e) a navegação por títulos não pula nível
      const titulos = await titulosDoMain(page);
      expect(titulos[0]).toEqual([1, "Supino reto com barra"]);
      for (let i = 1; i < titulos.length; i += 1) {
        expect(titulos[i]![0], JSON.stringify(titulos)).toBeLessThanOrEqual(titulos[i - 1]![0] + 1);
      }
      for (const nome of ["Instruções", "Equipamento", "Como progredir", "Erro comum", "Seu histórico"]) {
        await expect(page.getByRole("heading", { name: nome, level: 2 })).toBeVisible();
      }

      // (b) sem "Área de foco" na página
      await expect(page.getByRole("list", { name: "Área de foco" })).toHaveCount(0);

      // nenhum parágrafo ou item visível se repete, nem inteiro dentro de outro
      const repetidos = await page.evaluate(() => {
        const textos = [...document.querySelectorAll("main p, main li")]
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .filter((el) => !el.querySelector("p, li"))
          .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
          .filter((t) => t.length >= 12);
        const achados: string[] = [];
        textos.forEach((a, i) =>
          textos.forEach((b, j) => {
            if (i !== j && (a === b ? i < j : b.includes(a))) achados.push(`${a} ⊂ ${b}`);
          }),
        );
        return achados;
      });
      expect(repetidos).toEqual([]);
      // o subtítulo do cabeçalho é o único lugar do equipamento_texto
      await expect(
        page.getByText(acharExercicio(SUPINO).equipamento_texto, { exact: false }),
      ).toHaveCount(1);

      // (c) as tags: com coleção, link para o aparelho; sem, texto
      const tags = page.locator("[data-tags-equipamento] li");
      const esperadas = tagsDoEquipamento(acharExercicio(SUPINO).equipamento);
      await expect(tags).toHaveCount(esperadas.length);
      for (const t of esperadas) {
        const link = page.locator("[data-tags-equipamento]").getByRole("link", { name: t.rotulo });
        if (t.href) {
          await expect(link).toHaveAttribute("href", t.href);
          const c = await caixa(link);
          expect(c.height).toBeGreaterThanOrEqual(44);
          expect(c.width).toBeGreaterThanOrEqual(44);
        } else {
          await expect(link).toHaveCount(0);
          await expect(page.locator("[data-tags-equipamento]")).toContainText(t.rotulo);
        }
      }
      expect(esperadas.some((t) => t.href)).toBe(true);

      // (d) "Aparece em:" e os treinos como links
      const treinos = linksDosTreinos(treinosDoExercicio(SUPINO));
      expect(treinos.length).toBeGreaterThan(0);
      const aparece = page.locator("[data-aparece-em]");
      await expect(aparece).toContainText("Aparece em:");
      for (const t of treinos) {
        await expect(aparece.getByRole("link", { name: t.nome })).toHaveAttribute("href", t.href);
      }

      // (a) a aba Músculos só tem o mapa: nenhuma imagem de execução
      await page.getByRole("tab", { name: "Músculos" }).click();
      const painel = page.getByRole("tabpanel");
      await expect(painel.getByRole("img", { name: "Frente" })).toBeVisible();
      await expect(painel.getByRole("img", { name: /Execução/ })).toHaveCount(0);
      await expect(painel.locator("img")).toHaveCount(0);
      await semRolagemHorizontal(page);

      // o link da tag e o do treino abrem a coleção
      const primeira = esperadas.find((t) => t.href)!;
      await page.locator("[data-tags-equipamento]").getByRole("link", { name: primeira.rotulo }).click();
      await expect(page).toHaveURL(new RegExp(`${primeira.href}$`));
      await page.goBack();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Supino reto com barra");
      await aparece.getByRole("link", { name: treinos[0]!.nome }).click();
      await expect(page).toHaveURL(new RegExp(`${treinos[0]!.href}$`));
    });
  }

  test("folha: o título da folha é H2 e as seções H3; a Área de foco continua", async ({
    page,
  }) => {
    await preparar(page);
    await esperarAbaTreino(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);
    await page.getByRole("button", { name: /^Como fazer: / }).first().click();
    const folha = page.getByRole("dialog");
    await expect(folha).toBeVisible();
    await expect(folha.getByRole("heading", { level: 2 })).toHaveCount(1);
    for (const nome of ["Instruções", "Erro comum", "Como progredir", "Seu histórico"]) {
      await expect(folha.getByRole("heading", { name: nome, level: 3 })).toBeVisible();
    }
    await expect(folha.getByRole("heading", { level: 1 })).toHaveCount(0);
    await expect(folha.getByRole("list", { name: "Área de foco" })).toBeVisible();
    // na folha (sem as seções da página), "Onde você está" continua
    await expect(folha.getByText("Onde você está")).toBeVisible();
    await folha.getByRole("tab", { name: "Músculos" }).click();
    await expect(folha.getByRole("tabpanel").locator("img")).toHaveCount(0);
  });
});

test.describe("§22.14 itens 1 e 3 — foco visível nos links e botões novos", () => {
  for (const tema of TEMAS) {
    test(`Tab chega a Voltar, tags, treinos e Fazer agora com anel inteiro (${tema})`, async ({
      page,
    }) => {
      await preparar(page, tema);
      await abrirFicha(page, SUPINO);
      await expect(page.locator("[data-historico-vazio]")).toBeVisible();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      const vistos = new Map<string, { anel: boolean; inteiro: boolean }>();
      for (let i = 0; i < 90; i += 1) {
        await page.keyboard.press("Tab");
        const r = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el) return null;
          const qual = el.matches("[data-voltar-da-ficha]")
            ? "voltar"
            : el.closest("[data-tags-equipamento]")
              ? `tag:${el.textContent?.trim()}`
              : el.closest("[data-aparece-em]")
                ? `treino:${el.textContent?.trim()}`
                : el.matches("[data-fazer-agora]")
                  ? "fazer"
                  : null;
          if (!qual) return null;
          const e = getComputedStyle(el);
          const contorno = e.outlineStyle !== "none" && parseFloat(e.outlineWidth) >= 2;
          const sombra = e.boxShadow !== "none" && e.boxShadow !== "";
          // o anel de fora (2 px + 2 px de offset) não é cortado por ancestral
          const folga = contorno ? parseFloat(e.outlineWidth) + parseFloat(e.outlineOffset) : 0;
          const caixa = el.getBoundingClientRect();
          let inteiro = true;
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const o = getComputedStyle(a);
            if (/(hidden|clip|auto|scroll)/.test(o.overflowX + o.overflowY)) {
              const c = a.getBoundingClientRect();
              if (
                caixa.left - folga < c.left - 0.5 ||
                caixa.right + folga > c.right + 0.5
              )
                inteiro = false;
            }
          }
          return { qual, anel: contorno || sombra, inteiro };
        });
        if (r) vistos.set(r.qual, { anel: r.anel, inteiro: r.inteiro });
        if (vistos.has("fazer")) break;
      }
      const esperados = [
        "voltar",
        "fazer",
        ...tagsDoEquipamento(acharExercicio(SUPINO).equipamento)
          .filter((t) => t.href)
          .map((t) => `tag:${t.rotulo}`),
        ...linksDosTreinos(treinosDoExercicio(SUPINO)).map((t) => `treino:${t.nome}`),
      ];
      for (const q of esperados) {
        expect(vistos.get(q), `${q} ${JSON.stringify([...vistos])}`).toEqual({
          anel: true,
          inteiro: true,
        });
      }
    });
  }
});

/* ------------------------------------------- item 4: a aba do tutorial */

async function conferirAbas(escopo: Locator, page: Page): Promise<void> {
  const aba = escopo.getByRole("tab", { name: "Tutorial no YouTube" });
  await expect(aba).toBeVisible();
  await expect(aba.locator("svg[data-icone-externo]")).toHaveCount(1);
  const medidas = await escopo.getByRole("tablist").evaluate((lista) => ({
    lista: [lista.scrollWidth, lista.clientWidth],
    abas: [...lista.querySelectorAll('[role="tab"]')].map((t) => [
      (t as HTMLElement).scrollWidth,
      (t as HTMLElement).clientWidth,
      Math.round(t.getBoundingClientRect().height),
    ]),
  }));
  expect(medidas.lista[0]).toBeLessThanOrEqual(medidas.lista[1]!);
  for (const [sw, cw, altura] of medidas.abas) {
    expect(sw).toBeLessThanOrEqual(cw!);
    expect(altura).toBeGreaterThanOrEqual(44);
  }
  await semRolagemHorizontal(page);
}

test.describe("§22.14 item 4 — a aba do tutorial diz para onde leva", () => {
  test("página e folha: 'Tutorial no YouTube' com o ícone, sem cortar a 360 px", async ({
    page,
  }) => {
    await preparar(page);
    await abrirFicha(page, SUPINO);
    await conferirAbas(page.locator("main"), page);

    await page.goto("/");
    await esperarAbaTreino(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);
    await page.getByRole("button", { name: /^Como fazer: / }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await conferirAbas(page.getByRole("dialog"), page);
  });
});

/* ------------------------------------ item 5: "Apagar esta foto?" flutua */

test.describe("§22.14 item 5 — o cartão 'Apagar esta foto?' usa .flutuante", () => {
  for (const tema of TEMAS) {
    test(`a sombra é a --sombra-flutuante (${tema})`, async ({ page }) => {
      await preparar(page, tema, QUARTA);
      await irNaAba(page, "Corpo");
      await expect(page.getByRole("heading", { name: "Corpo", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Fotos" }).click();
      await page.getByLabel("Foto de frente").setInputFiles({
        name: "frente.png",
        mimeType: "image/png",
        buffer: PNG_16,
      });
      await page.getByRole("button", { name: /Ver a foto: Frente/ }).click();
      const camada = page.getByRole("dialog", { name: "Frente em 16/09" });
      await expect(camada).toBeVisible();
      await camada.getByRole("button", { name: "Apagar" }).click();
      const cartao = page.getByRole("alertdialog", { name: "Apagar esta foto?" });
      await expect(cartao).toBeVisible();

      const { doCartao, daClasse } = await cartao.evaluate((el) => {
        const sonda = document.createElement("div");
        sonda.className = "flutuante";
        document.body.appendChild(sonda);
        const daClasse = getComputedStyle(sonda).boxShadow;
        sonda.remove();
        return { doCartao: getComputedStyle(el).boxShadow, daClasse };
      });
      expect(daClasse).not.toBe("none");
      expect(doCartao).toBe(daClasse);
      // no escuro, a elevação é o anel de 1 px (a sombra preta some no #0a0a0a)
      if (tema === "dark") expect(doCartao).toMatch(/0px 0px 0px 1px/);
    });
  }
});

/* ----------------------------------------- item 6: as folhas são modais */

/** Com a folha aberta: aria-modal, fundo inerte, foco no título, Tab preso. */
async function conferirFolhaModal(page: Page): Promise<void> {
  const folha = page.getByRole("dialog");
  await expect(folha).toBeVisible();
  await expect(folha).toHaveAttribute("aria-modal", "true");

  const fundo = await page.evaluate(() =>
    ["main", "header", "nav"].map((sel) => {
      const el = document.querySelector(sel);
      return el ? [sel, el.closest("[inert]") !== null] : [sel, null];
    }),
  );
  expect(fundo.find(([sel]) => sel === "main")?.[1]).toBe(true);
  for (const [sel, inerte] of fundo) if (inerte !== null) expect(inerte, String(sel)).toBe(true);

  // o primeiro foco é o título da folha
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.getAttribute("data-slot") ?? null),
    )
    .toBe("sheet-title");

  // Tab não sai da folha
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press("Tab");
    const dentro = await page.evaluate(
      () => document.activeElement?.closest('[role="dialog"]') !== null,
    );
    expect(dentro, `Tab ${i + 1}`).toBe(true);
  }
}

async function conferirFechamento(page: Page, gatilho: Locator): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(gatilho).toBeFocused();
  expect(await page.evaluate(() => document.querySelectorAll("[inert]").length)).toBe(0);
}

test.describe("§22.14 item 6 — as folhas são modais de verdade", () => {
  test("folha da ficha no player", async ({ page }) => {
    await preparar(page);
    await esperarAbaTreino(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);
    const gatilho = page.getByRole("button", { name: /^Como fazer: / }).first();
    await gatilho.focus();
    await page.keyboard.press("Enter");
    await conferirFolhaModal(page);
    await conferirFechamento(page, gatilho);
  });

  test("'Substituir hoje' da lista do dia", async ({ page }) => {
    await preparar(page);
    await esperarAbaTreino(page);
    const gatilho = page
      .getByRole("list", { name: "Exercícios de hoje" })
      .getByRole("button", { name: "Substituir Agachamento livre" });
    await gatilho.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog").getByText("Substituir hoje")).toBeVisible();
    await conferirFolhaModal(page);
    await conferirFechamento(page, gatilho);
  });

  test("filtros do catálogo", async ({ page }) => {
    await preparar(page);
    await page.goto("/exercicios");
    const gatilho = page.getByRole("button", { name: /^Filtros/ });
    await gatilho.focus();
    await page.keyboard.press("Enter");
    await conferirFolhaModal(page);
    await conferirFechamento(page, gatilho);
  });
});

/* ------------------------------ itens 8 e 9: uma grafia por equipamento */

test.describe("§22.14 itens 8 e 9 — nomes do catálogo", () => {
  test("o filtro 'Cross over' mostra só cards com 'Cross over'; nada de 'Elástico'", async ({
    page,
  }) => {
    await preparar(page);
    await page.goto("/exercicios");
    await page.getByRole("button", { name: /^Filtros/ }).click();
    const folha = page.getByRole("dialog");
    const implemento = folha.getByLabel("Implemento");
    const equipamento = folha.getByLabel("Equipamento");
    const opcoes = async (s: Locator) =>
      s.evaluate((el) => [...(el as HTMLSelectElement).options].map((o) => o.text));
    const doImplemento = await opcoes(implemento);
    const doEquipamento = await opcoes(equipamento);
    expect([...doImplemento, ...doEquipamento]).not.toContain("Elástico");
    expect(doImplemento).toContain("Super Band");
    expect(doEquipamento).toContain("Super Band");
    expect(doImplemento).toContain("Peso corporal");
    expect(doEquipamento).toContain("Cross over");
    expect(doEquipamento).not.toContain("Cross-over");

    await equipamento.selectOption({ label: "Cross over" });
    const esperados = exercicios.filter((e) => e.equipamento.includes("cross-over"));
    await folha.getByRole("button", { name: `Ver ${esperados.length} exercícios` }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const cards = page.locator('main a[href^="/exercicios/"]');
    await expect(cards).toHaveCount(esperados.length);
    for (const texto of await cards.allTextContents()) expect(texto).toContain("Cross over");
  });
});

/* ------------------------------------------------ item 10: créditos */

test.describe("§22.14 item 10 — créditos em linguagem de gente", () => {
  test("sem 'variáveis CSS' nem 'anda junto'; fonte e licença continuam", async ({ page }) => {
    await preparar(page);
    await page.goto("/mais/creditos");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const texto = await page.locator("main").innerText();
    expect(texto).not.toContain("variáveis CSS");
    expect(texto).not.toContain("anda junto");
    await expect(
      page.getByText("Nenhuma linha do desenho foi alterada; só reagrupamos os músculos e trocamos as cores."),
    ).toBeVisible();
    await expect(
      page.locator('a[href="/mapa-muscular/LICENCA-mapa-anatomico.md"]'),
    ).toHaveText("Texto completo da licença MIT");
    await expect(page.locator('a[href="https://github.com/melihcolpan/MuscleMap"]')).toHaveCount(1);
    await semRolagemHorizontal(page);
  });
});
