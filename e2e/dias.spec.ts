/**
 * Marco Dias (SPEC §17): o usuário escolhe em quais dias vai treinar e o app
 * distribui o plano nesses dias.
 *
 * O card "Dias de treino" das Preferências, a faixa da aba Treino e a grade do
 * calendário concordando com a escolha, o dia não escolhido virando descanso
 * com "Treinar mesmo assim", a meta semanal seguindo os dias e a volta ao
 * programa.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  fixarRelogio,
  irNaAba,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

/** Segunda-feira 14/09/2026 — semana 1 da Fase 1 (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";
/** Domingo 20/09/2026 — o dia que ninguém escolheu. */
const DOMINGO = "2026-09-20T08:00:00-03:00";

const DIAS_DA_SEMANA = [
  "2026-09-14",
  "2026-09-15",
  "2026-09-16",
  "2026-09-17",
  "2026-09-18",
  "2026-09-19",
  "2026-09-20",
];

const CAPTURAS =
  "/tmp/claude-0/-home-user-WORKOUT/19b8c32e-5647-551a-b360-eec4ee383d9c/scratchpad/capturas/dias";

/** O chip de um dia no card "Dias de treino". */
function chip(page: Page, dia: string) {
  return page.locator(`[data-dia-chip="${dia}"]`);
}

/** As siglas da faixa da semana da aba Treino, de segunda a domingo. */
async function siglasDaFaixa(page: Page): Promise<string[]> {
  const siglas: string[] = [];
  for (const data of DIAS_DA_SEMANA) {
    const casa = page.locator(`[data-dia="${data}"]`).first();
    await expect(casa).toBeVisible();
    siglas.push(((await casa.innerText()) ?? "").split("\n").pop()?.trim() ?? "");
  }
  return siglas;
}

/** Os rótulos da grade do calendário, um por dia da semana. */
async function rotulosDoCalendario(page: Page): Promise<string[]> {
  const itens = page.getByRole("list", { name: "Semana" }).getByRole("listitem");
  await expect(itens).toHaveCount(7);
  return (await itens.allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
}

/** Abre Mais → Preferências e espera o card "Dias de treino". */
async function abrirPreferencias(page: Page): Promise<void> {
  await irNaAba(page, "Mais");
  await page.getByRole("link", { name: "Preferências" }).click();
  await expect(page.getByRole("group", { name: "Dias de treino" })).toBeVisible({
    timeout: 15_000,
  });
}

/** O que o app gravou em `profiles.prefs.dias_de_treino`. */
async function diasGravados(sessao: SessaoMock): Promise<unknown> {
  const linhas = await lerDoMock<{ prefs?: { dias_de_treino?: unknown } }>(
    sessao,
    "profiles",
    "select=prefs",
  );
  return linhas[0]?.prefs?.dias_de_treino;
}

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("o card Dias de treino (SPEC §17.1)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`escolher a quinta liga o sexto dia da semana — tema ${tema}`, async ({
      page,
    }) => {
      const sessao = await usuarioComPerfil();
      await page.emulateMedia({ colorScheme: tema });
      await fixarRelogio(page, SEGUNDA);
      await entrarNoApp(page);
      await esperarAbaTreino(page);
      await abrirPreferencias(page);

      // os chips nascem nos dias do programa da Fase 1 (SPEC §17.1)
      for (const dia of ["seg", "ter", "qua", "sex", "sab"]) {
        await expect(chip(page, dia)).toHaveAttribute("aria-pressed", "true");
      }
      for (const dia of ["qui", "dom"]) {
        await expect(chip(page, dia)).toHaveAttribute("aria-pressed", "false");
      }

      // os sete alvos têm 44 px e nada rola para o lado a 360 px
      for (const dia of ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]) {
        const caixa = await chip(page, dia).boundingBox();
        expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await semRolagemHorizontal(page);

      await chip(page, "qui").click();
      await expect(chip(page, "qui")).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("[data-resumo-dias]")).toContainText(
        "3 de força · 2 de cardio · 1 livre",
      );

      await expect
        .poll(async () => diasGravados(sessao), { timeout: 15_000 })
        .toEqual(["seg", "ter", "qua", "qui", "sex", "sab"]);

      await page.screenshot({
        path: `${CAPTURAS}/01-preferencias-dias${tema === "light" ? "-claro" : ""}.png`,
        fullPage: true,
      });
    });
  }
});

test.describe("seis dias: a faixa e o calendário seguem a escolha (SPEC §17.4)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`seg a sáb: A · Corr. · B · Desc. · A · Corr. · Desc. — tema ${tema}`, async ({
      page,
    }) => {
      await usuarioComPerfil({
        prefs: { dias_de_treino: ["seg", "ter", "qua", "qui", "sex", "sab"] },
      });
      await page.emulateMedia({ colorScheme: tema });
      await fixarRelogio(page, SEGUNDA);
      await entrarNoApp(page);
      await esperarAbaTreino(page);

      // força seg/qua/sex, cardio ter/sáb, quinta livre e domingo descanso
      expect(await siglasDaFaixa(page)).toEqual([
        "A",
        "Corr.",
        "B",
        "Desc.",
        "A",
        "Corr.",
        "Desc.",
      ]);

      // a meta padrão continua 5 (3 de força + 2 de cardio)
      await expect(page.getByRole("progressbar", { name: "Meta semanal" })).toHaveAttribute(
        "aria-valuemax",
        "5",
      );
      await semRolagemHorizontal(page);

      await page.screenshot({
        path: `${CAPTURAS}/02-treino-faixa-6-dias${tema === "light" ? "-claro" : ""}.png`,
        fullPage: true,
      });

      // o calendário diz exatamente o mesmo (SPEC §16.2 continua valendo)
      await page.goto("/calendario");
      const rotulos = await rotulosDoCalendario(page);
      expect(rotulos[0]).toContain("Treino A");
      expect(rotulos[1]).toContain("Corrida");
      expect(rotulos[2]).toContain("Treino B");
      expect(rotulos[3]).toContain("Descanso");
      expect(rotulos[3]).toContain("barra fixa");
      expect(rotulos[4]).toContain("Treino A");
      expect(rotulos[5]).toContain("Corrida");
      expect(rotulos[6]).toContain("Descanso");
      // domingo não foi escolhido: descanso sem nota nenhuma
      expect(rotulos[6]).not.toContain("caminhada");
      await semRolagemHorizontal(page);

      await page.screenshot({ path: `${CAPTURAS}/03-calendario-6-dias.png`, fullPage: true });
    });
  }

  test("o atalho Meus dias leva ao card das Preferências", async ({ page }) => {
    await usuarioComPerfil();
    await fixarRelogio(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await page.goto("/calendario");

    await page.getByRole("link", { name: "Meus dias" }).click();
    await expect(page).toHaveURL(/\/mais\/preferencias/);
    await expect(page.getByRole("group", { name: "Dias de treino" })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("o dia que ninguém escolheu (SPEC §17.4 item 7)", () => {
  test("domingo: Descanso com Treinar mesmo assim", async ({ page }) => {
    await usuarioComPerfil({
      ultimo_treino: "A1",
      prefs: { dias_de_treino: ["seg", "ter", "qua", "qui", "sex", "sab"] },
    });
    await fixarRelogio(page, DOMINGO);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    const hoje = page.getByRole("region", { name: "Hoje" });
    await expect(hoje.getByRole("heading", { name: "Descanso" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Treinar mesmo assim/ }),
    ).toBeVisible();
    await semRolagemHorizontal(page);

    await page.screenshot({ path: `${CAPTURAS}/04-domingo.png`, fullPage: true });
  });
});

test.describe("três dias: sem cardio e meta 3 (SPEC §17.4 item 3)", () => {
  test("seg, qua e sex: só força, meta semanal 3", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await fixarRelogio(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await abrirPreferencias(page);

    // do padrão da fase (seg ter qua sex sáb) desligando os dois de cardio
    await chip(page, "ter").click();
    await expect(chip(page, "ter")).toHaveAttribute("aria-pressed", "false");
    await chip(page, "sab").click();
    await expect(chip(page, "sab")).toHaveAttribute("aria-pressed", "false");

    await expect(page.locator("[data-resumo-dias]")).toContainText("3 de força");
    await expect(page.locator("[data-resumo-dias]")).toContainText("0 de cardio");
    await expect(page.locator("[data-resumo-dias]")).toContainText("meta semanal 3");

    await expect
      .poll(async () => diasGravados(sessao), { timeout: 15_000 })
      .toEqual(["seg", "qua", "sex"]);

    // a aba Treino já reflete a escolha: nenhum cardio e a meta em 3
    await irNaAba(page, "Treino");
    await esperarAbaTreino(page);
    expect(await siglasDaFaixa(page)).toEqual([
      "A",
      "Desc.",
      "B",
      "Desc.",
      "A",
      "Desc.",
      "Desc.",
    ]);
    await expect(page.getByRole("progressbar", { name: "Meta semanal" })).toHaveAttribute(
      "aria-valuemax",
      "3",
    );

    // e o Relatório conta as semanas seguidas contra a mesma meta
    await irNaAba(page, "Relatório");
    await expect(page.getByText("com a meta de 3").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("voltar ao programa (SPEC §17.1)", () => {
  test("o botão apaga a escolha e a semana volta a ser a do JSON", async ({ page }) => {
    const sessao = await usuarioComPerfil({
      prefs: { dias_de_treino: ["seg", "qua", "sex"] },
    });
    await fixarRelogio(page, SEGUNDA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await abrirPreferencias(page);

    await page.getByRole("button", { name: "Voltar aos dias do programa" }).click();
    await expect(
      page.getByRole("button", { name: "Voltar aos dias do programa" }),
    ).toHaveCount(0);

    await expect
      .poll(async () => diasGravados(sessao), { timeout: 15_000 })
      .toBeUndefined();

    await irNaAba(page, "Treino");
    await esperarAbaTreino(page);
    expect(await siglasDaFaixa(page)).toEqual([
      "A",
      "Corr.",
      "B",
      "Desc.",
      "A",
      "Corr.",
      "Desc.",
    ]);
    await expect(page.getByRole("progressbar", { name: "Meta semanal" })).toHaveAttribute(
      "aria-valuemax",
      "5",
    );
  });
});
