/**
 * Marco Semana (SPEC §16): a semana visível.
 *
 * O caso do defeito de 16/09/2026 no navegador — a aba Treino dizia "HOJE
 * Treino B" e o calendário dizia outra coisa para o mesmo dia —, a faixa com o
 * treino de cada dia, a semana seguinte continuando a alternância e a Fase 2
 * fixa por dia da semana.
 */
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  fixarRelogio,
  inserirNoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** Quarta-feira, 16/09/2026 — semana 1 da Fase 1 (fase_desde 14/09). */
const QUARTA = "2026-09-16T08:00:00-03:00";
const SEGUNDA = "2026-09-14";

const CAPTURAS =
  process.env.CAPTURAS_DIR ?? "test-results/capturas/semana";
mkdirSync(CAPTURAS, { recursive: true });

/**
 * O usuário do caso: `ultimo_treino = A1` e uma sessão A1 concluída na segunda
 * 14/09. Hoje é quarta — o certo é seg "Treino A ✓", qua "Treino B", sex
 * "Treino A".
 */
async function usuarioDoCaso() {
  const sessao = await usuarioComPerfil({ ultimo_treino: "A1" });
  await inserirNoMock(sessao, "sessions", [
    { data: SEGUNDA, workout_id: "A1", fase: "fase1", status: "concluida" },
  ]);
  return sessao;
}

/** O texto de uma casa da faixa da semana (a sigla do treino está nela). */
function casaDaFaixa(page: Page, data: string) {
  return page.locator(`[data-dia="${data}"]`).first();
}

/** Os rótulos da grade do calendário, um por dia da semana. */
async function rotulos(page: Page): Promise<string[]> {
  const itens = page.getByRole("list", { name: "Semana" }).getByRole("listitem");
  await expect(itens).toHaveCount(7);
  return itens.allInnerTexts();
}

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("Semana visível — a aba Treino e o calendário dizem o mesmo (SPEC §16.2)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`o caso do defeito: seg A ✓, qua B (hoje), sex A — tema ${tema}`, async ({
      page,
    }) => {
      await usuarioDoCaso();
      await page.emulateMedia({ colorScheme: tema });
      await fixarRelogio(page, QUARTA);
      await entrarNoApp(page);
      await esperarAbaTreino(page);

      // 1) o card do dia: hoje é Treino B, na semana 1 da fase
      const hoje = page.getByRole("region", { name: "Hoje" });
      await expect(hoje.getByRole("heading", { name: "Treino B" })).toBeVisible();
      await expect(hoje).toContainText("semana 1");

      // 2) a faixa: a segunda feita mostra A, hoje mostra B, a sexta mostra A
      await expect(casaDaFaixa(page, SEGUNDA)).toContainText("A");
      await expect(casaDaFaixa(page, SEGUNDA)).toHaveAttribute("data-marca", "feito");
      await expect(casaDaFaixa(page, "2026-09-16")).toContainText("B");
      await expect(casaDaFaixa(page, "2026-09-16")).toHaveAttribute("data-marca", "hoje");
      await expect(casaDaFaixa(page, "2026-09-18")).toContainText("A");

      // o nome completo vai no aria-label (SPEC §16.3)
      await expect(casaDaFaixa(page, "2026-09-16")).toHaveAttribute(
        "aria-label",
        "quarta 16/09: Treino B, hoje",
      );
      await expect(casaDaFaixa(page, SEGUNDA)).toHaveAttribute(
        "aria-label",
        "segunda 14/09: Treino A, feito",
      );

      await semRolagemHorizontal(page);
      await page.screenshot({
        path: `${CAPTURAS}/01-treino-faixa${tema === "light" ? "-claro" : ""}.png`,
      });

      // 3) o calendário: a mesma coisa, dia a dia
      await page.goto("/calendario");
      await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
      await expect(page.getByText("14/09 – 20/09")).toBeVisible();
      await expect(page.getByText("Fase 1 · semana 1 de 12")).toBeVisible();

      const textos = await rotulos(page);
      expect(textos[0]).toContain("Treino A · semana 1");
      expect(textos[1]).toContain("Corrida · semana 1 do plano");
      expect(textos[2]).toContain("Treino B · semana 1");
      expect(textos[4]).toContain("Treino A · semana 1");

      await expect(
        page.getByRole("button", { name: /^seg 14\/09.*Treino A, feito$/ }),
      ).toBeVisible();

      await semRolagemHorizontal(page);
      await page.screenshot({
        path: `${CAPTURAS}/02-calendario-semana${tema === "light" ? "-claro" : ""}.png`,
      });
    });
  }

  test("a semana seguinte continua a alternância de onde a corrente terminou", async ({
    page,
  }) => {
    await usuarioDoCaso();
    await fixarRelogio(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/calendario");
    await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();

    await page.getByRole("button", { name: "Próxima semana" }).click();
    await expect(page.getByText("21/09 – 27/09")).toBeVisible();
    await expect(page.getByText("Fase 1 · semana 2 de 12")).toBeVisible();

    // a corrente terminou na sexta em A → seg B, qua A, sex B
    const textos = await rotulos(page);
    expect(textos[0]).toContain("Treino B · semana 2");
    expect(textos[2]).toContain("Treino A · semana 2");
    expect(textos[4]).toContain("Treino B · semana 2");

    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/03-calendario-proxima.png` });
  });

  /*
   * Auditoria: hoje é a semana 1 da fase, então um toque em "‹" já passa do
   * começo dela — ali o cabeçalho dizia "Fase 1 · semana 0 de 12" e os cards
   * "Treino de força · semana 0" (SPEC §16.4).
   */
  test("antes do começo da fase não aparece semana 0 nem negativa", async ({ page }) => {
    await usuarioDoCaso();
    await fixarRelogio(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/calendario");
    await expect(page.getByText("Fase 1 · semana 1 de 12")).toBeVisible();

    await page.getByRole("button", { name: "Semana anterior" }).click();
    await expect(page.getByText("07/09 – 13/09")).toBeVisible();
    await expect(page.getByText("Fase 1", { exact: true })).toBeVisible();
    await expect(page.getByText(/semana (0|-\d)/)).toHaveCount(0);

    const textos = await rotulos(page);
    for (const texto of textos) expect(texto).not.toMatch(/semana (0|-\d)/);
    expect(textos[0]).toContain("Treino de força");

    await semRolagemHorizontal(page);
  });

  /*
   * Auditoria: depois de treinar hoje, o dia de hoje mostrava o treino da
   * projeção (o `ultimo_treino` já tinha contabilizado a sessão) — apareciam
   * dois "Treino A" na mesma semana e a sexta virava B.
   */
  test("depois de treinar hoje, a quarta mostra o B feito e a sexta volta a ser A", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil({ ultimo_treino: "B1" });
    await inserirNoMock(sessao, "sessions", [
      { data: SEGUNDA, workout_id: "A1", fase: "fase1", status: "concluida" },
      { data: "2026-09-16", workout_id: "B1", fase: "fase1", status: "concluida" },
    ]);
    await fixarRelogio(page, QUARTA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    // a faixa: seg A feito, qua B (hoje, feito), sex A
    await expect(casaDaFaixa(page, SEGUNDA)).toContainText("A");
    await expect(casaDaFaixa(page, "2026-09-16")).toContainText("B");
    await expect(casaDaFaixa(page, "2026-09-16")).toHaveAttribute(
      "aria-label",
      "quarta 16/09: Treino B, hoje",
    );
    await expect(casaDaFaixa(page, "2026-09-18")).toContainText("A");

    await page.goto("/calendario");
    await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
    const textos = await rotulos(page);
    expect(textos[0]).toContain("Treino A · semana 1");
    expect(textos[2]).toContain("Treino B · semana 1");
    expect(textos[4]).toContain("Treino A · semana 1");
    await expect(
      page.getByRole("button", { name: /^qua 16\/09.*Treino B, feito$/ }),
    ).toBeVisible();

    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/05-hoje-ja-treinado.png` });
  });

  test("um dia passado sem sessão mostra o treino esperado e a marca de não feito", async ({
    page,
  }) => {
    await usuarioDoCaso();
    // sexta 18/09: a quarta passou sem sessão nenhuma
    await fixarRelogio(page, "2026-09-18T08:00:00-03:00");
    await entrarNoApp(page);
    await page.goto("/calendario");
    await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();

    await expect(
      page.getByRole("button", { name: /^qua 16\/09.*Treino B, faltou$/ }),
    ).toBeVisible();
    // e a sexta (hoje) continua ancorada no ultimo_treino do perfil
    await expect(
      page.getByRole("button", { name: /^sex 18\/09.*Treino B, a fazer$/ }),
    ).toBeVisible();
  });
});

test.describe("Semana visível — a faixa mostra o treino de cada dia (SPEC §16.3)", () => {
  test("sete casas com a sigla do dia, fonte legível e nada rolando de lado", async ({
    page,
  }) => {
    await usuarioDoCaso();
    await fixarRelogio(page, QUARTA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    const faixa = page.getByRole("region", { name: "Semana" }).first();
    const casas = faixa.locator("[data-dia]");
    await expect(casas).toHaveCount(7);

    const siglas = await casas.evaluateAll((nos) =>
      nos.map((n) => (n.textContent ?? "").trim()),
    );
    // seg A · ter corrida · qua B · qui descanso · sex A · sáb corrida · dom descanso
    expect(siglas[0]).toContain("A");
    expect(siglas[1]).toContain("Corr.");
    expect(siglas[2]).toContain("B");
    expect(siglas[3]).toContain("Desc.");
    expect(siglas[4]).toContain("A");
    expect(siglas[5]).toContain("Corr.");
    expect(siglas[6]).toContain("Desc.");

    // sete colunas cabem a 360 px, com alvo de ≥ 44 px e fonte ≥ 11 px
    const medida = await casas.first().evaluate((no) => {
      const caixa = no.getBoundingClientRect();
      const ultima = no.lastElementChild as HTMLElement | null;
      return {
        largura: caixa.width,
        fonte: ultima ? parseFloat(getComputedStyle(ultima).fontSize) : 0,
      };
    });
    expect(medida.largura).toBeGreaterThanOrEqual(36);
    expect(medida.fonte).toBeGreaterThanOrEqual(11);

    const alvo = await faixa
      .getByRole("link", { name: "Abrir o calendário da semana" })
      .boundingBox();
    expect(alvo?.height ?? 0).toBeGreaterThanOrEqual(44);

    // nenhuma sigla cortada: cada casa cabe no que desenha
    const cortou = await casas.evaluateAll((nos) =>
      nos.some((n) => n.scrollWidth > n.clientWidth + 1),
    );
    expect(cortou, "uma sigla da faixa foi cortada").toBe(false);
    await semRolagemHorizontal(page);

    // e tocar na faixa continua abrindo o calendário
    await faixa.getByRole("link", { name: "Abrir o calendário da semana" }).click();
    await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
  });
});

test.describe("Semana visível — a Fase 2 é fixa por dia (SPEC §16.2 item 5)", () => {
  test("SA · IA · corrida · SB · IB · corrida longa · descanso", async ({ page }) => {
    await usuarioComPerfil({ fase_atual: "fase2", ultimo_treino: "IB" });
    await fixarRelogio(page, QUARTA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    const casas = page
      .getByRole("region", { name: "Semana" })
      .first()
      .locator("[data-dia]");
    const siglas = await casas.evaluateAll((nos) =>
      nos.map((n) => (n.textContent ?? "").trim()),
    );
    expect(siglas[0]).toContain("SA");
    expect(siglas[1]).toContain("IA");
    expect(siglas[2]).toContain("Corr.");
    expect(siglas[3]).toContain("SB");
    expect(siglas[4]).toContain("IB");
    expect(siglas[5]).toContain("Longa");
    expect(siglas[6]).toContain("Desc.");

    await page.goto("/calendario");
    await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
    await expect(page.getByText("Fase 2 · semana 1")).toBeVisible();

    const textos = await rotulos(page);
    expect(textos[0]).toContain("Superior A");
    expect(textos[3]).toContain("Superior B");
    expect(textos[4]).toContain("Inferior B");

    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/04-fase2.png` });
  });
});
