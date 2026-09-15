import { expect, test, type Page } from "@playwright/test";
import {
  entrarNoApp,
  fixarRelogio,
  inserirNoMock,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

const SEGUNDA = "2026-09-14T08:00:00-03:00";

async function abrirCalendario(page: Page, quando: string = SEGUNDA) {
  await fixarRelogio(page, quando);
  await entrarNoApp(page);
  await page.goto("/calendario");
  await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
}

/** Os rótulos da grade, um por dia da semana. */
async function rotulos(page: Page): Promise<string[]> {
  const itens = page.getByRole("list", { name: "Semana" }).getByRole("listitem");
  await expect(itens).toHaveCount(7);
  return itens.allInnerTexts();
}

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("Calendário — a semana (SPEC §3.5 e §10.6)", () => {
  test("mostra a semana da Fase 1 com A e B alternando", async ({ page }) => {
    await usuarioComPerfil();
    await abrirCalendario(page);

    await expect(page.getByText("14/09 – 20/09")).toBeVisible();
    const textos = await rotulos(page);
    expect(textos[0]).toContain("Treino A");
    expect(textos[0]).toContain("6 exercícios · 44 min");
    expect(textos[1]).toContain("Corrida");
    expect(textos[1]).toContain("8 × (1 min corrida / 2 min caminhada) · 34 min");
    expect(textos[2]).toContain("Treino B");
    expect(textos[3]).toContain("Descanso");
    expect(textos[4]).toContain("Treino A");
    expect(textos[5]).toContain("Corrida");

    await semRolagemHorizontal(page);
  });

  test("a alternância segue o último treino do perfil", async ({ page }) => {
    await usuarioComPerfil({ ultimo_treino: "A1" });
    await abrirCalendario(page);

    const textos = await rotulos(page);
    expect(textos[0]).toContain("Treino B");
    expect(textos[2]).toContain("Treino A");
    expect(textos[4]).toContain("Treino B");
  });

  test("marca o que foi feito e o que faltou", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await inserirNoMock(sessao, "sessions", [
      {
        data: "2026-09-14",
        workout_id: "A1",
        fase: "fase1",
        status: "concluida",
      },
    ]);

    // quarta-feira: a segunda já passou e a terça (corrida) ficou para trás
    await abrirCalendario(page, "2026-09-16T08:00:00-03:00");

    await expect(page.getByRole("button", { name: /^seg 14\/09.*feito$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^ter 15\/09.*faltou$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^sex 18\/09.*a fazer$/ })).toBeVisible();
    await expect(page.getByText("1 feito · 3 a fazer · 1 perdido")).toBeVisible();
  });

  test("navega entre as semanas e volta para hoje", async ({ page }) => {
    await usuarioComPerfil();
    await abrirCalendario(page);

    await page.getByRole("button", { name: "Próxima semana" }).click();
    await expect(page.getByText("21/09 – 27/09")).toBeVisible();

    await page.getByRole("button", { name: "Semana anterior" }).click();
    await page.getByRole("button", { name: "Semana anterior" }).click();
    await expect(page.getByText("07/09 – 13/09")).toBeVisible();

    await page.getByRole("button", { name: "Hoje", exact: true }).click();
    await expect(page.getByText("14/09 – 20/09")).toBeVisible();
  });

  test("o mês em miniatura aparece abaixo da semana", async ({ page }) => {
    await usuarioComPerfil();
    await abrirCalendario(page);
    await expect(page.getByRole("region", { name: /Mês de setembro de 2026/ })).toBeVisible();
  });
});

test.describe("Calendário — trocar o tipo de um dia (SPEC §3.5)", () => {
  test("um dia futuro pode virar descanso, e a troca é gravada", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await abrirCalendario(page);

    await page.getByRole("button", { name: /^qua 16\/09/ }).click();
    await expect(page.getByRole("dialog")).toContainText("16 de setembro de 2026");

    await page.getByRole("button", { name: "Descanso" }).click();
    await page.getByLabel("Motivo (opcional)").fill("chuva");
    await page.getByRole("button", { name: "Salvar a troca" }).click();

    await expect(page.getByRole("button", { name: /^qua 16\/09.*Descanso/ })).toBeVisible();

    await expect
      .poll(
        async () => {
          const linhas = await lerDoMock<{ data: string; tipo: string; motivo: string }>(
            sessao,
            "schedule_overrides",
          );
          return linhas.map((l) => `${l.data}:${l.tipo}:${l.motivo}`);
        },
        { timeout: 10_000 },
      )
      .toEqual(["2026-09-16:descanso:chuva"]);
  });

  test("um dia passado abre o resumo em vez do formulário", async ({ page }) => {
    await usuarioComPerfil();
    await abrirCalendario(page, "2026-09-16T08:00:00-03:00");

    await page.getByRole("button", { name: /^seg 14\/09/ }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toContainText("Nada registrado neste dia.");
    await expect(dialogo.getByRole("button", { name: "Salvar a troca" })).toBeHidden();
  });
});

test.describe("Calendário — semana curta (SPEC §5.4)", () => {
  test("mostra o que vai mudar antes de gravar e depois grava", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await abrirCalendario(page);

    await page.getByRole("button", { name: "Não vou treinar hoje" }).click();

    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toContainText("14/09 · Treino A → Descanso");
    // a alternância se reencadeia nos dias que sobraram
    await expect(dialogo).toContainText("16/09 · Treino B → Treino A");
    await expect(dialogo).toContainText("17/09 · Descanso → Treino B");

    await dialogo.getByRole("button", { name: "Aplicar à semana" }).click();

    await expect(page.getByRole("button", { name: /^seg 14\/09.*Descanso/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^qui 17\/09.*Treino B/ })).toBeVisible();

    await expect
      .poll(
        async () => {
          const linhas = await lerDoMock<{ data: string }>(sessao, "schedule_overrides");
          return linhas.map((l) => l.data).sort();
        },
        { timeout: 10_000 },
      )
      .toEqual(["2026-09-14", "2026-09-16", "2026-09-17"]);
  });
});

test.describe("Calendário — auditoria do marco 2", () => {
  test("um dia passado de cardio abre a sessão de cardio, não a de força", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await inserirNoMock(sessao, "cardio_sessions", [
      {
        id: "22222222-2222-4222-8222-222222222222",
        data: "2026-09-15",
        tipo: "corrida",
        semana_plano: 1,
        concluida: true,
      },
    ]);

    await abrirCalendario(page, "2026-09-18T08:00:00-03:00");

    await page.getByRole("button", { name: /^ter 15\/09/ }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByRole("link", { name: "Abrir o cardio" })).toHaveAttribute(
      "href",
      "/cardio/22222222-2222-4222-8222-222222222222",
    );
  });

  test("o X do diálogo também é um alvo de 44 px e está em pt-BR", async ({ page }) => {
    await usuarioComPerfil();
    await abrirCalendario(page);

    await page.getByRole("button", { name: /^qua 16\/09/ }).click();
    const fechar = page.getByRole("dialog").getByRole("button", { name: "Fechar" });
    await expect(fechar).toBeVisible();
    // offsetWidth/Height é a caixa de layout: o boundingBox pega a animação de
    // entrada do diálogo (zoom-in-95) ainda no meio do caminho
    const caixa = await fechar.evaluate((el) => ({
      largura: (el as HTMLElement).offsetWidth,
      altura: (el as HTMLElement).offsetHeight,
    }));
    expect(caixa.altura).toBeGreaterThanOrEqual(44);
    expect(caixa.largura).toBeGreaterThanOrEqual(44);

    await fechar.click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
