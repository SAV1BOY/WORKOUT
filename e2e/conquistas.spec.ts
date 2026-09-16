/**
 * Marco Números e Conquistas (SPEC §19): "quantos treinos fizemos, quantos de
 * força, cardio, barra" e as conquistas sóbrias derivadas dos registros.
 *
 * Os Números com o seletor Semana · Mês · Tudo, a grade de conquistas com a
 * data e o que falta, a folha de detalhe e o aviso de conquista nova na
 * Conclusão do player — que, depois do "Ok", não repete.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  comecarNoPlayer,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  fixarData,
  inserirNoMock,
  irNaAba,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

/** Quarta, 16/09/2026: semana civil 14–20/09, mês 01–30/09 (SPEC §5). */
const QUARTA = "2026-09-16T08:00:00-03:00";

const CAPTURAS =
  "/tmp/claude-0/-home-user-WORKOUT/19b8c32e-5647-551a-b360-eec4ee383d9c/scratchpad/capturas/conquistas";

/**
 * Os 26 ids da SPEC §19.3, na ordem de `lib/conquistas.ts` (um unitário prende
 * as duas listas). Semear `prefs.conquistas_vistas` com todos menos um deixa o
 * aviso da Conclusão com exatamente uma conquista.
 */
const IDS = [
  "forca-1",
  "forca-10",
  "forca-25",
  "forca-50",
  "forca-100",
  "dias-3",
  "dias-7",
  "semanas-2",
  "semanas-4",
  "semanas-8",
  "semanas-12",
  "semana-completa",
  "corrida-1",
  "corrida-20min",
  "corrida-5km",
  "corda-1000",
  "fixa-sem-elastico",
  "fixa-5",
  "fixa-10",
  "fixa-100-soltas",
  "carga-20",
  "carga-40",
  "carga-60",
  "volume-10k",
  "volume-50k",
  "fase-2",
];

function uuid(prefixo: string, n: number): string {
  return `${prefixo}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

/* ------------------------------------------------------------- a semente */

/**
 * 12 sessões de força (8 do Treino A, 4 do Treino B), 3 corridas, 2 sessões de
 * barra fixa e 2 dias de repetições soltas.
 *
 * As contas à mão (SPEC §19.7.1):
 * - Tudo: força 12 = Treino A 8 · Treino B 4; a 10ª por data é a de 14/09.
 * - Tudo: cardio 3 (todas corrida), 25 + 30 + 34 = 89 min, 2,5 + 3 + 3,2 = 8,7 km.
 * - Tudo: barra fixa 2 sessões, 4+3+5+4 = 16 reps em sessão, 3+2 = 5 soltas,
 *   21 no total, melhor série 5.
 * - Semana (14–20/09): força 3 (A 2 · B 1), cardio 1 (34 min · 3,2 km),
 *   barra fixa 1 sessão, 9 reps em sessão, 2 soltas, 11 no total.
 */
const FORCA: { data: string; treino: string }[] = [
  { data: "2026-07-06", treino: "A1" },
  { data: "2026-07-08", treino: "A1" },
  { data: "2026-07-10", treino: "B1" },
  { data: "2026-07-13", treino: "A1" },
  { data: "2026-07-15", treino: "A1" },
  { data: "2026-07-17", treino: "B1" },
  { data: "2026-07-20", treino: "A1" },
  { data: "2026-07-22", treino: "A1" },
  { data: "2026-07-24", treino: "B1" },
  { data: "2026-09-14", treino: "A1" },
  { data: "2026-09-15", treino: "A1" },
  { data: "2026-09-16", treino: "B1" },
];

const FIXA = [
  { id: uuid("bbbbbbbb", 1), data: "2026-09-13", reps: [4, 3] },
  { id: uuid("bbbbbbbb", 2), data: "2026-09-16", reps: [5, 4] },
];

async function semear(sessao: SessaoMock): Promise<void> {
  await inserirNoMock(
    sessao,
    "sessions",
    FORCA.map((s, i) => ({
      id: uuid("aaaaaaaa", i + 1),
      data: s.data,
      workout_id: s.treino,
      fase: "fase1",
      status: "concluida",
      concluida_em: `${s.data}T13:00:00.000Z`,
      duracao_s: 2700,
    })),
  );

  await inserirNoMock(
    sessao,
    "sessions",
    FIXA.map((f) => ({
      id: f.id,
      data: f.data,
      workout_id: "fixa",
      fase: "fase1",
      status: "concluida",
      concluida_em: `${f.data}T13:00:00.000Z`,
      duracao_s: 600,
    })),
  );

  /* uma sessão em andamento e uma abandonada: nenhuma das duas conta (§19.1) */
  await inserirNoMock(sessao, "sessions", [
    {
      id: uuid("cccccccc", 1),
      data: "2026-09-16",
      workout_id: "A1",
      fase: "fase1",
      status: "em_andamento",
      duracao_s: 900,
    },
    {
      id: uuid("cccccccc", 2),
      data: "2026-09-12",
      workout_id: "B1",
      fase: "fase1",
      status: "abandonada",
      duracao_s: 900,
    },
  ]);

  const serie = (
    n: number,
    sessionId: string,
    exercicio: string,
    reps: number,
    carga: number | null,
    quando: string,
  ) => ({
    id: uuid("dddddddd", n),
    session_id: sessionId,
    exercise_id: exercicio,
    ordem_ex: 1,
    set_index: 1,
    tipo: "trabalho",
    reps,
    carga_kg: carga,
    concluida: true,
    registrada_em: quando,
  });

  await inserirNoMock(sessao, "session_sets", [
    /* barra fixa nas duas sessões de barra fixa: 4 + 3 e 5 + 4 */
    serie(1, FIXA[0]!.id, "barra-fixa-assistida", 4, null, "2026-09-13T12:00:00.000Z"),
    serie(2, FIXA[0]!.id, "barra-fixa-assistida", 3, null, "2026-09-13T12:05:00.000Z"),
    serie(3, FIXA[1]!.id, "barra-fixa-assistida", 5, null, "2026-09-16T12:00:00.000Z"),
    serie(4, FIXA[1]!.id, "barra-fixa-assistida", 4, null, "2026-09-16T12:05:00.000Z"),
    /* volume: 2 × 5 × 20 kg na segunda da semana = 200 kg */
    serie(5, uuid("aaaaaaaa", 10), "agachamento-livre", 5, 20, "2026-09-14T12:00:00.000Z"),
    serie(6, uuid("aaaaaaaa", 10), "agachamento-livre", 5, 20, "2026-09-14T12:05:00.000Z"),
  ]);

  await inserirNoMock(sessao, "cardio_sessions", [
    {
      id: uuid("eeeeeeee", 1),
      data: "2026-07-07",
      tipo: "corrida",
      semana_plano: 1,
      duracao_min: 25,
      distancia_km: 2.5,
      concluida: true,
    },
    {
      id: uuid("eeeeeeee", 2),
      data: "2026-08-05",
      tipo: "corrida",
      semana_plano: 2,
      duracao_min: 30,
      distancia_km: 3,
      concluida: true,
    },
    {
      id: uuid("eeeeeeee", 3),
      data: "2026-09-15",
      tipo: "corrida",
      semana_plano: 3,
      duracao_min: 34,
      distancia_km: 3.2,
      concluida: true,
    },
    /* não concluída: não conta em número nenhum (§19.1) */
    {
      id: uuid("eeeeeeee", 4),
      data: "2026-09-16",
      tipo: "corda",
      semana_plano: 1,
      duracao_min: 13,
      saltos: 300,
      concluida: false,
    },
  ]);

  await inserirNoMock(sessao, "pullup_singles", [
    { id: uuid("ffffffff", 1), data: "2026-09-12", reps: 3 },
    { id: uuid("ffffffff", 2), data: "2026-09-16", reps: 2 },
  ]);
}

/* ------------------------------------------------------------- ajudantes */

function periodo(page: Page, qual: string) {
  return page.locator(`[data-periodo="${qual}"]`);
}

function detalhe(page: Page, qual: string) {
  return page.locator(`[data-detalhe="${qual}"]`);
}

function conquista(page: Page, id: string) {
  return page.locator(`[data-conquista="${id}"]`);
}

/**
 * Com a semente cheia o Relatório abre com o aviso de conquista nova (SPEC
 * §19.5): ele aparece, o "Ok" o dispensa e ele não volta. Os testes dos Números
 * e da grade começam por aqui, para a tela ficar como no uso do dia a dia.
 */
async function reconhecerOAviso(page: Page): Promise<void> {
  const aviso = page.getByRole("region", { name: "Conquista nova" });
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText("10 treinos");
  await aviso.getByRole("button", { name: "Ok" }).click();
  await expect(aviso).toHaveCount(0);
}

test.beforeEach(async () => {
  await resetarMock();
});

/* --------------------------------------------------------------- Números */

test.describe("Números por tipo e período (SPEC §19.2)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`as contagens de Tudo e da Semana — tema ${tema}`, async ({ page }) => {
      const sessao = await usuarioComPerfil({ ultimo_treino: "B1" });
      await semear(sessao);

      await page.emulateMedia({ colorScheme: tema });
      await fixarData(page, QUARTA);
      await entrarNoApp(page);
      await irNaAba(page, "Relatório");
      await expect(page.getByRole("heading", { name: "Relatório" })).toBeVisible();
      await reconhecerOAviso(page);

      const numeros = page.getByRole("region", { name: "Números" });
      await expect(numeros).toBeVisible();

      /* a Semana (14–20/09) abre selecionada */
      await expect(periodo(page, "semana")).toHaveAttribute("aria-pressed", "true");
      await expect(numeros.locator('[data-contador="Força"]')).toContainText("3");
      await expect(numeros.locator('[data-contador="Cardio"]')).toContainText("1");
      /* 9 na sessão de barra fixa de 16/09 + 2 soltas = 11 */
      await expect(numeros.locator('[data-contador="Barra fixa"]')).toContainText("11");
      await expect(detalhe(page, "Força")).toContainText("Treino A 2");
      await expect(detalhe(page, "Força")).toContainText("Treino B 1");
      await expect(detalhe(page, "Cardio")).toContainText("Corrida 1");
      await expect(detalhe(page, "Cardio")).toContainText("34 min");
      await expect(detalhe(page, "Cardio")).toContainText("3,2 km");
      await expect(detalhe(page, "Barra fixa")).toContainText("1 sessão");
      await expect(detalhe(page, "Barra fixa")).toContainText("9 em sessão");
      await expect(detalhe(page, "Barra fixa")).toContainText("2 soltas");
      await expect(detalhe(page, "Barra fixa")).toContainText("melhor série 5");
      /* volume da semana: 2 × 5 × 20 kg */
      await expect(numeros.locator('[data-contador="Volume (kg)"]')).toContainText("200");

      /* Tudo: 12 treinos de força, 8 do A e 4 do B */
      await periodo(page, "tudo").click();
      await expect(periodo(page, "tudo")).toHaveAttribute("aria-pressed", "true");
      await expect(numeros.locator('[data-contador="Força"]')).toContainText("12");
      await expect(detalhe(page, "Força")).toContainText("Treino A 8");
      await expect(detalhe(page, "Força")).toContainText("Treino B 4");
      await expect(numeros.locator('[data-contador="Cardio"]')).toContainText("3");
      await expect(detalhe(page, "Cardio")).toContainText("Corrida 3");
      await expect(detalhe(page, "Cardio")).toContainText("89 min");
      await expect(detalhe(page, "Cardio")).toContainText("8,7 km");
      /* 16 nas sessões + 5 soltas = 21 */
      await expect(numeros.locator('[data-contador="Barra fixa"]')).toContainText("21");
      await expect(detalhe(page, "Barra fixa")).toContainText("2 sessões");
      await expect(detalhe(page, "Barra fixa")).toContainText("5 soltas");

      /* os três botões do seletor são alvo de dedo (SPEC §19.2) */
      for (const qual of ["semana", "mes", "tudo"]) {
        const caixa = await periodo(page, qual).boundingBox();
        expect(caixa?.height ?? 0, qual).toBeGreaterThanOrEqual(44);
      }
      await semRolagemHorizontal(page);

      await numeros.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${CAPTURAS}/01-relatorio-numeros${tema === "light" ? "-claro" : ""}.png`,
        fullPage: true,
      });
    });
  }

  test("o Mês recorta setembro, sem julho nem agosto", async ({ page }) => {
    const sessao = await usuarioComPerfil({ ultimo_treino: "B1" });
    await semear(sessao);
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/relatorio");
    await reconhecerOAviso(page);

    await periodo(page, "mes").click();
    const numeros = page.getByRole("region", { name: "Números" });
    /* setembro tem as 3 sessões da semana, nenhuma de julho */
    await expect(numeros.locator('[data-contador="Força"]')).toContainText("3");
    await expect(numeros.locator('[data-contador="Cardio"]')).toContainText("1");
    /* as duas sessões de barra fixa de setembro: 16 reps + 5 soltas = 21 */
    await expect(numeros.locator('[data-contador="Barra fixa"]')).toContainText("21");
  });
});

/* ------------------------------------------------------------ Conquistas */

test.describe("a grade de conquistas (SPEC §19.4)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`10 treinos desbloqueada e 25 bloqueada — tema ${tema}`, async ({ page }) => {
      const sessao = await usuarioComPerfil({ ultimo_treino: "B1" });
      await semear(sessao);

      await page.emulateMedia({ colorScheme: tema });
      await fixarData(page, QUARTA);
      await entrarNoApp(page);
      await page.goto("/relatorio");
      await reconhecerOAviso(page);

      const grade = page.getByRole("region", { name: "Conquistas" });
      await expect(grade).toBeVisible();

      /* o 10º treino por data é o de 14/09 (SPEC §19.3: acumulado) */
      const dez = conquista(page, "forca-10");
      await expect(dez).toHaveAttribute("data-atingida", "sim");
      await expect(dez).toContainText("10 treinos");
      await expect(dez).toContainText("14/09");

      /* 12 feitos de 25: faltam 13 */
      const vinteCinco = conquista(page, "forca-25");
      await expect(vinteCinco).toHaveAttribute("data-atingida", "nao");
      await expect(vinteCinco).toContainText("faltam 13");

      /* alvo de dedo nas células da grade de 3 colunas */
      for (const id of ["forca-10", "forca-25"]) {
        const caixa = await conquista(page, id).boundingBox();
        expect(caixa?.height ?? 0, id).toBeGreaterThanOrEqual(44);
      }
      await semRolagemHorizontal(page);

      await grade.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${CAPTURAS}/02-relatorio-conquistas${tema === "light" ? "-claro" : ""}.png`,
        fullPage: true,
      });
    });
  }

  test("o toque abre a folha com a descrição, a regra e o progresso", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil({ ultimo_treino: "B1" });
    await semear(sessao);
    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await page.goto("/relatorio");
    await reconhecerOAviso(page);

    await conquista(page, "forca-25").click();
    const folha = page.getByRole("dialog");
    await expect(folha).toBeVisible();
    await expect(folha).toContainText("25 treinos");
    await expect(folha).toContainText("Como fecha:");
    await expect(folha).toContainText("25 sessões de força concluídas");
    await expect(folha).toContainText("12 de 25");
    await expect(folha).toContainText("faltam 13 treinos");
    await semRolagemHorizontal(page);

    await page.screenshot({ path: `${CAPTURAS}/03-conquista-detalhe.png` });

    await folha.getByRole("button", { name: "Fechar" }).click();
    await expect(folha).toBeHidden();

    /* a desbloqueada mostra a data por extenso */
    await conquista(page, "forca-10").click();
    await expect(page.getByRole("dialog")).toContainText("Conquistada em 14/09/2026");
  });
});

/* ------------------------------------------------- o aviso (SPEC §19.5) */

test.describe("o aviso de conquista nova", () => {
  /**
   * A semana 14–20/09 já tem 4 sessões planejadas feitas; a meta padrão da
   * Fase 1 é 5 (3 de força + 2 de cardio). A sessão de hoje é a 5ª e fecha
   * "Semana completa" — a única conquista fora de `conquistas_vistas`.
   */
  async function usuarioAUmaSessaoDaSemanaCompleta(): Promise<SessaoMock> {
    const sessao = await usuarioComPerfil({
      ultimo_treino: "B1",
      prefs: { conquistas_vistas: IDS.filter((id) => id !== "semana-completa") },
    });
    await inserirNoMock(sessao, "sessions", [
      {
        id: uuid("aaaaaaaa", 1),
        data: "2026-09-14",
        workout_id: "A1",
        fase: "fase1",
        status: "concluida",
        concluida_em: "2026-09-14T13:00:00.000Z",
        duracao_s: 2700,
      },
      {
        id: uuid("bbbbbbbb", 1),
        data: "2026-09-14",
        workout_id: "fixa",
        fase: "fase1",
        status: "concluida",
        concluida_em: "2026-09-14T22:00:00.000Z",
        duracao_s: 600,
      },
    ]);
    await inserirNoMock(sessao, "cardio_sessions", [
      {
        id: uuid("eeeeeeee", 1),
        data: "2026-09-15",
        tipo: "corrida",
        semana_plano: 1,
        duracao_min: 34,
        distancia_km: 3.2,
        concluida: true,
      },
      {
        id: uuid("eeeeeeee", 2),
        data: "2026-09-15",
        tipo: "corda",
        semana_plano: 1,
        duracao_min: 13,
        saltos: 300,
        concluida: true,
      },
    ]);
    return sessao;
  }

  test('a Conclusão avisa "Semana completa" e, depois do "Ok", não repete', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const sessao = await usuarioAUmaSessaoDaSemanaCompleta();

    await fixarData(page, QUARTA);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    /* nada de aviso na aba Treino: as conquistas moram no Relatório (§19.6) */
    await expect(page.getByRole("region", { name: "Conquista nova" })).toHaveCount(0);

    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);
    await page.getByRole("button", { name: "Concluir a série" }).click();

    /* as setas levam até o feedback e dele à conclusão (SPEC §14.1) */
    const sensacao = page.getByRole("radiogroup", { name: "Sensação" });
    await irAte(page, sensacao);
    await sensacao.getByRole("radio", { name: "Um pouco fácil" }).click();
    await page.getByRole("button", { name: "Concluído" }).click();

    const fim = page.getByRole("region", { name: "Treino concluído" });
    await expect(fim.getByText("Excelente! Você concluiu o treino.")).toBeVisible();

    const aviso = page.getByRole("region", { name: "Conquista nova" });
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("Conquista");
    await expect(aviso).toContainText("Semana completa");
    await expect(aviso).toHaveAttribute("data-aviso-conquista", "semana-completa");
    await semRolagemHorizontal(page);

    await aviso.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${CAPTURAS}/04-conclusao-conquista.png`,
      fullPage: true,
    });

    await aviso.getByRole("button", { name: "Ok" }).click();
    await expect(aviso).toHaveCount(0);

    /* o "Ok" grava em prefs.conquistas_vistas pela fila (SPEC §8 e §19.5) */
    await expect
      .poll(
        async () => {
          const perfis = await lerDoMock<{
            prefs?: { conquistas_vistas?: string[] };
          }>(sessao, "profiles");
          return perfis[0]?.prefs?.conquistas_vistas?.includes("semana-completa");
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    await fim.getByRole("button", { name: "Próximo" }).click();
    await esperarAbaTreino(page);

    /* e o Relatório não repete o aviso */
    await irNaAba(page, "Relatório");
    await expect(page.getByRole("heading", { name: "Relatório" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Números" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Conquista nova" })).toHaveCount(0);
    await expect(conquista(page, "semana-completa")).toHaveAttribute(
      "data-atingida",
      "sim",
    );
    await semRolagemHorizontal(page);
  });
});

/**
 * Anda pelo player (seta "próximo", pulando descansos) até `alvo` aparecer —
 * o mesmo caminho de `e2e/player.spec.ts`.
 */
async function irAte(page: Page, alvo: ReturnType<Page["getByRole"]>) {
  for (let i = 0; i < 60; i++) {
    if (await alvo.isVisible().catch(() => false)) return;
    const pular = page.getByRole("button", { name: "Pular" });
    if (await pular.isVisible().catch(() => false)) {
      await pular.click();
      continue;
    }
    const continuar = page.getByRole("button", { name: "Continuar" });
    if (await continuar.isVisible().catch(() => false)) {
      await continuar.click();
      continue;
    }
    const proximo = page.getByRole("button", { name: "Próximo passo" });
    if (!(await proximo.isVisible().catch(() => false))) break;
    await proximo.click();
  }
  await expect(alvo).toBeVisible();
}
