import { expect, test } from "@playwright/test";
import {
  abrirSecaoDoRelatorio,
  entrarNoApp,
  fixarData,
  inserirNoMock,
  irNaAba,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

/** Quarta, 16/09/2026 — a semana civil vai de 14 a 20/09 (SPEC §5). */
const QUARTA = "2026-09-16T08:00:00-03:00";

const SESSAO_A = "11111111-1111-4111-8111-111111111111";
const SESSAO_B = "11111111-1111-4111-8111-111111111112";

/** Duas sessões de força, uma corrida e duas soltas de barra fixa. */
async function semearTreinos(sessao: SessaoMock) {
  await inserirNoMock(sessao, "sessions", [
    {
      id: SESSAO_A,
      data: "2026-09-14",
      workout_id: "A1",
      fase: "fase1",
      status: "concluida",
      concluida_em: "2026-09-14T13:00:00.000Z",
    },
    {
      id: SESSAO_B,
      data: "2026-09-16",
      workout_id: "B1",
      fase: "fase1",
      status: "concluida",
      concluida_em: "2026-09-16T13:00:00.000Z",
    },
  ]);

  const serie = (
    id: string,
    sessionId: string,
    exercicio: string,
    quando: string,
    carga: number,
    reps: number,
    ordem = 1,
    indice = 1,
  ) => ({
    id,
    session_id: sessionId,
    exercise_id: exercicio,
    ordem_ex: ordem,
    set_index: indice,
    tipo: "trabalho",
    reps,
    carga_kg: carga,
    concluida: true,
    registrada_em: quando,
  });

  await inserirNoMock(sessao, "session_sets", [
    serie("22222222-2222-4222-8222-000000000001", SESSAO_A, "agachamento-livre", "2026-09-14T12:00:00.000Z", 7.5, 5),
    serie("22222222-2222-4222-8222-000000000002", SESSAO_A, "agachamento-livre", "2026-09-14T12:05:00.000Z", 7.5, 5, 1, 2),
    serie("22222222-2222-4222-8222-000000000003", SESSAO_A, "supino-reto-com-barra", "2026-09-14T12:10:00.000Z", 7.5, 8, 2),
    serie("22222222-2222-4222-8222-000000000004", SESSAO_B, "agachamento-livre", "2026-09-16T12:00:00.000Z", 11.5, 5),
    serie("22222222-2222-4222-8222-000000000005", SESSAO_B, "barra-fixa-assistida", "2026-09-16T12:20:00.000Z", 0, 6, 3),
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
      feito: {
        blocos: [
          { tipo: "aquecimento", s: 300 },
          { tipo: "corrida", s: 60 },
          { tipo: "caminhada", s: 120 },
          { tipo: "corrida", s: 60 },
        ],
      },
    },
  ]);

  await inserirNoMock(sessao, "pullup_singles", [
    { id: "55555555-5555-4555-8555-000000000001", data: "2026-09-15", reps: 2 },
    { id: "55555555-5555-4555-8555-000000000002", data: "2026-09-16", reps: 1 },
  ]);
}

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("Relatório (SPEC §3.7 e §13.5)", () => {
  test("os cards contam treinos, aderência, volume e recordes", async ({ page }) => {
    const sessao = await usuarioComPerfil({ ultimo_treino: "B1" });
    await semearTreinos(sessao);

    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await irNaAba(page, "Relatório");
    await expect(page.getByRole("heading", { name: "Relatório" })).toBeVisible();
    /* SPEC §22.6 item 1: os gráficos moram numa seção dobrável */
    await abrirSecaoDoRelatorio(page, "graficos");

    // 2 treinos na semana civil (14 e 16/09)
    const treinos = page.locator("div", { hasText: /^Treinos na semana/ }).last();
    await expect(treinos).toContainText("2");
    await expect(treinos).toContainText("2 no mês");

    // seg (força ✓), ter (cardio ✓), qua (força ✓) = 3 de 3
    const ade = page.locator("div", { hasText: /^Constância \(4 semanas\)/ }).last();
    await expect(ade).toContainText("100%");
    await expect(ade).toContainText("3 de 3 dias");

    // volume da semana: 7,5×5 + 7,5×5 + 7,5×8 + 11,5×5 = 192,5 → 193 kg
    // (a barra fixa sem lastro entra com 0 kg)
    const volume = page.locator("div", { hasText: /^Volume da semana/ }).last();
    await expect(volume).toContainText("193 kg");

    // recordes recentes: agachamento 11,5 kg em 16/09
    await expect(page.getByText("Recordes recentes")).toBeVisible();
    await expect(page.getByText("11,5 kg").first()).toBeVisible();

    await semRolagemHorizontal(page);
  });

  test("os gráficos aparecem com os três grandes, o volume e a corrida", async ({ page }) => {
    const sessao = await usuarioComPerfil({ ultimo_treino: "B1" });
    await semearTreinos(sessao);

    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/relatorio");
    await abrirSecaoDoRelatorio(page, "graficos");

    // um gráfico por grande, mesmo com um ponto só
    await expect(page.getByLabel("Carga por sessão: Agachamento livre")).toBeVisible();
    await expect(page.getByLabel("Carga por sessão: Supino reto com barra")).toBeVisible();
    await expect(
      page.getByLabel("Carga por sessão: Desenvolvimento militar em pé"),
    ).toBeHidden();
    /* SPEC §22.6 item 9: sem registro, o grande vira UMA linha */
    await expect(
      page.locator('[data-grande="desenvolvimento-militar-em-pe"]'),
    ).toContainText("sem registro");

    await expect(page.getByLabel("Volume por semana")).toBeVisible();
    await expect(page.getByLabel("Repetições de barra fixa por semana")).toBeVisible();
    await expect(page.getByLabel("Minutos correndo por semana")).toBeVisible();
    await expect(page.getByLabel("Quilômetros por semana")).toBeVisible();
    await expect(page.getByText("3,2 km no período")).toBeVisible();

    // a lista de recordes vem da view v_records
    await expect(page.getByRole("table", { name: "Recordes por exercício" })).toBeVisible();
    const linha = page.getByRole("row", { name: /Agachamento livre/ });
    await expect(linha).toContainText("11,5 kg");
    await semRolagemHorizontal(page);
  });

  test("sem nenhum treino a tela abre vazia, sem quebrar", async ({ page }) => {
    await usuarioComPerfil();
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/relatorio");

    await expect(page.getByRole("heading", { name: "Relatório" })).toBeVisible();
    await abrirSecaoDoRelatorio(page, "graficos");
    await expect(
      page.getByText("O volume aparece depois do primeiro treino registrado."),
    ).toBeVisible();
    await expect(page.getByText("A lista nasce com a primeira série concluída.")).toBeVisible();
    await semRolagemHorizontal(page);
  });

  test("o recorde recente leva para a ficha do exercício", async ({ page }) => {
    const sessao = await usuarioComPerfil({ ultimo_treino: "B1" });
    await semearTreinos(sessao);
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/relatorio");
    await abrirSecaoDoRelatorio(page, "graficos");

    await page.getByRole("link", { name: "Agachamento livre" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Agachamento livre", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Últimas sessões")).toBeVisible();
  });
});
