/**
 * Marco Retomada (SPEC §18): ele passou dias sem treinar e o app pergunta como
 * voltar.
 *
 * As quatro faixas do §18.2 no card da aba Treino, o que cada escolha grava no
 * banco, a confirmação em duas etapas do "Recomeçar do zero", o card que não
 * volta a perguntar pela mesma pausa e a escolha feita sem rede.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  abrirVisaoGeral,
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  esperarServiceWorker,
  fixarData,
  fixarRelogio,
  inserirNoMock,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

/** Segunda-feira 26/10/2026, dia de força na Fase 1 (SPEC §5). */
const HOJE = "2026-10-26T08:00:00-03:00";

const CAPTURAS =
  "/tmp/claude-0/-home-user-WORKOUT/19b8c32e-5647-551a-b360-eec4ee383d9c/scratchpad/capturas/retomada";

/** A carga do agachamento antes da pausa (barra maciça: 7,5 + 2 kg). */
const CARGA = 39.5;
/** 60 % de 39,5 kg arredondados para baixo na escala da barra (SPEC §6.2). */
const CARGA_LEVE = 23.5;

interface LinhaPerfilMock {
  semana_corrida: number;
  semana_corda: number;
  semana_fixa: number;
  ultimo_treino: string | null;
  fase_atual: string;
  fase_desde: string;
  prefs?: { retomada?: { em: string; dias: number; escolha: string } };
}

interface LinhaEstadoMock {
  exercise_id: string;
  carga_atual_kg: number | null;
  carga_antes_leve: number | null;
  semana_leve: boolean;
  falhas_seguidas: number;
  reps_alvo: number | null;
}

/** Quantos dias antes de hoje (26/10/2026). */
function diasAtras(dias: number): string {
  const d = new Date("2026-10-26T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/**
 * O usuário com a última sessão concluída há `dias` dias e uma carga já
 * conquistada no agachamento. O último treino foi o B, então o de hoje é o A.
 */
async function usuarioParado(dias: number): Promise<SessaoMock> {
  const sessao = await usuarioComPerfil({
    ultimo_treino: "B1",
    semana_corrida: 3,
    semana_corda: 2,
    semana_fixa: 4,
  });
  const data = diasAtras(dias);
  await inserirNoMock(sessao, "sessions", [
    {
      data,
      workout_id: "B1",
      fase: "fase1",
      status: "concluida",
      concluida_em: `${data}T11:00:00-03:00`,
    },
  ]);
  await inserirNoMock(sessao, "exercise_state", [
    { exercise_id: "agachamento-livre", carga_atual_kg: CARGA, falhas_seguidas: 1 },
    { exercise_id: "supino-reto-com-barra", carga_atual_kg: 29.5 },
  ]);
  return sessao;
}

function card(page: Page) {
  return page.locator("[data-retomada]");
}

function opcao(page: Page, escolha: string) {
  return page.locator(`[data-retomada-opcao="${escolha}"]`);
}

async function perfilDoMock(sessao: SessaoMock): Promise<LinhaPerfilMock | undefined> {
  const linhas = await lerDoMock<LinhaPerfilMock>(sessao, "profiles");
  return linhas[0];
}

async function estadosDoMock(sessao: SessaoMock): Promise<LinhaEstadoMock[]> {
  const linhas = await lerDoMock<LinhaEstadoMock>(sessao, "exercise_state");
  return linhas.sort((a, b) => a.exercise_id.localeCompare(b.exercise_id));
}

/** Espera o card sumir e o que foi escolhido chegar ao mock. */
async function esperarEscolha(
  page: Page,
  sessao: SessaoMock,
  escolha: string,
): Promise<void> {
  await expect(card(page)).toHaveCount(0);
  await expect
    .poll(async () => (await perfilDoMock(sessao))?.prefs?.retomada?.escolha, {
      timeout: 15_000,
    })
    .toBe(escolha);
}

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("o card da retomada (SPEC §18.2 e §18.3)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`10 dias parado: continuar ou recomeçar a semana — tema ${tema}`, async ({
      page,
    }) => {
      await usuarioParado(10);
      await page.emulateMedia({ colorScheme: tema });
      await fixarRelogio(page, HOJE);
      await entrarNoApp(page);
      await esperarAbaTreino(page);

      await expect(card(page)).toBeVisible();
      await expect(card(page)).toContainText("Você ficou 10 dias sem treinar");
      // a faixa de 7 a 13 dias tem duas opções, e nenhuma delas é destrutiva
      await expect(opcao(page, "continuar")).toBeVisible();
      await expect(opcao(page, "semana")).toBeVisible();
      await expect(opcao(page, "leve")).toHaveCount(0);
      await expect(opcao(page, "zero")).toHaveCount(0);

      // o card vem ANTES do card do dia (SPEC §18.3)
      const topoCard = (await card(page).boundingBox())?.y ?? 0;
      const topoHoje =
        (await page.getByRole("region", { name: "Hoje" }).boundingBox())?.y ?? 0;
      expect(topoCard).toBeLessThan(topoHoje);

      for (const escolha of ["continuar", "semana"]) {
        const caixa = await opcao(page, escolha).boundingBox();
        expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await semRolagemHorizontal(page);

      await page.screenshot({
        path: `${CAPTURAS}/01-retomada-10-dias${tema === "light" ? "-claro" : ""}.png`,
        fullPage: true,
      });
    });
  }

  test("nada de card com 6 dias parado (SPEC §18.2)", async ({ page }) => {
    await usuarioParado(6);
    await fixarRelogio(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await expect(page.getByRole("region", { name: "Hoje" })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });

  test("recomeçar a semana baixa as semanas dos planos", async ({ page }) => {
    const sessao = await usuarioParado(10);
    await fixarRelogio(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    await opcao(page, "semana").click();
    await esperarEscolha(page, sessao, "semana");

    const perfil = await perfilDoMock(sessao);
    expect(perfil?.semana_corrida).toBe(2);
    expect(perfil?.semana_corda).toBe(1);
    expect(perfil?.semana_fixa).toBe(3);
    expect(perfil?.prefs?.retomada?.dias).toBe(10);
    // a força não mudou: nenhuma carga foi tocada
    const estados = await estadosDoMock(sessao);
    expect(estados.map((e) => e.carga_atual_kg)).toEqual([CARGA, 29.5]);
    expect(await lerDoMock(sessao, "progression_events")).toHaveLength(0);
  });

  test("continuar grava só a decisão (SPEC §18.2)", async ({ page }) => {
    const sessao = await usuarioParado(10);
    await fixarRelogio(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    await opcao(page, "continuar").click();
    await esperarEscolha(page, sessao, "continuar");

    const perfil = await perfilDoMock(sessao);
    expect(perfil?.semana_corrida).toBe(3);
    expect(perfil?.semana_corda).toBe(2);
    expect(perfil?.semana_fixa).toBe(4);
    expect(perfil?.ultimo_treino).toBe("B1");
    const estados = await estadosDoMock(sessao);
    expect(estados.map((e) => e.carga_atual_kg)).toEqual([CARGA, 29.5]);
    expect(await lerDoMock(sessao, "progression_events")).toHaveLength(0);
  });

  test("a mesma pausa não pergunta de novo, nem ao recarregar (SPEC §18.4)", async ({
    page,
  }) => {
    const sessao = await usuarioParado(10);
    await fixarRelogio(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    await opcao(page, "continuar").click();
    await esperarEscolha(page, sessao, "continuar");

    await page.reload();
    await esperarAbaTreino(page);
    await expect(page.getByRole("region", { name: "Hoje" })).toBeVisible();
    await expect(card(page)).toHaveCount(0);
  });

  test("com o card pendente, Começar treino leva ao card (SPEC §18.3)", async ({
    page,
  }) => {
    await usuarioParado(10);
    await fixarRelogio(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    await page.getByRole("button", { name: "Começar treino" }).click();
    // nada de player: a decisão vem antes
    await expect(page).toHaveURL(/\/$/);
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toBeFocused();
  });
});

test.describe("voltar mais leve (SPEC §18.2)", () => {
  test("20 dias parado: a semana leve a 60 % e a carga guardada", async ({ page }) => {
    const sessao = await usuarioParado(20);
    await fixarData(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    await expect(card(page)).toContainText("Você ficou 20 dias sem treinar");
    await expect(opcao(page, "leve")).toBeVisible();
    await expect(opcao(page, "semana")).toHaveCount(0);
    await expect(opcao(page, "zero")).toHaveCount(0);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/02-retomada-20-dias.png`, fullPage: true });

    await opcao(page, "leve").click();
    await esperarEscolha(page, sessao, "leve");

    const estados = await estadosDoMock(sessao);
    const agachamento = estados.find((e) => e.exercise_id === "agachamento-livre");
    expect(agachamento?.semana_leve).toBe(true);
    expect(agachamento?.carga_antes_leve).toBe(CARGA);
    expect(agachamento?.carga_atual_kg).toBe(CARGA_LEVE);
    // a pausa não é falha: a falha que ele já tinha continua onde estava
    expect(agachamento?.falhas_seguidas).toBe(1);
    // as semanas dos planos também voltam uma
    const perfil = await perfilDoMock(sessao);
    expect(perfil?.semana_corrida).toBe(2);

    const eventos = await lerDoMock<{ motivo: string; exercise_id: string | null }>(
      sessao,
      "progression_events",
    );
    expect(eventos.map((e) => e.motivo)).toEqual(["retomada_leve", "retomada_leve"]);

    // a aba Treino já diz a carga de hoje a 60 %
    await expect(
      page.getByRole("button", { name: "Ficha: Agachamento livre" }),
    ).toContainText(`Hoje: ${String(CARGA_LEVE).replace(".", ",")} kg na barra`);

    // e o player abre o treino com ela
    await comecarOTreinoDoDia(page);
    await abrirVisaoGeral(page);
    await expect(
      page.getByText(`${String(CARGA_LEVE).replace(".", ",")} kg na barra`).first(),
    ).toBeVisible();
  });
});

test.describe("recomeçar do zero (SPEC §18.2 e §18.3)", () => {
  test("40 dias parado: confirmação em duas etapas e cargas do começo", async ({
    page,
  }) => {
    const sessao = await usuarioParado(40);
    await fixarRelogio(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    await expect(card(page)).toContainText("Você ficou 40 dias sem treinar");
    await expect(opcao(page, "continuar")).toBeVisible();
    await expect(opcao(page, "leve")).toBeVisible();
    await expect(opcao(page, "zero")).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/03-retomada-40-dias.png`, fullPage: true });

    // 1ª etapa: o que se perde
    await opcao(page, "zero").click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toHaveAttribute("data-retomada-etapa", "1");
    await expect(dialogo).toContainText("volta ao começo do programa");
    await expect(dialogo).toContainText("continuam no histórico");
    await page.screenshot({ path: `${CAPTURAS}/04-confirmacao-zero.png`, fullPage: true });

    // desistir na 1ª etapa não grava nada
    await page.locator('[data-retomada-zero="cancelar"]').click();
    await expect(dialogo).toHaveCount(0);
    expect((await perfilDoMock(sessao))?.prefs?.retomada).toBeUndefined();

    // 2ª etapa: a confirmação de verdade
    await opcao(page, "zero").click();
    await page.locator('[data-retomada-zero="continuar"]').click();
    await expect(page.getByRole("dialog")).toHaveAttribute("data-retomada-etapa", "2");
    await page.locator('[data-retomada-zero="confirmar"]').click();
    await esperarEscolha(page, sessao, "zero");

    const estados = await estadosDoMock(sessao);
    // os dois voltaram à barra maciça vazia (`carga_inicial.kg` do JSON)
    expect(estados.map((e) => e.carga_atual_kg)).toEqual([7.5, 7.5]);
    expect(estados.every((e) => e.semana_leve === false)).toBe(true);
    expect(estados.every((e) => e.falhas_seguidas === 0)).toBe(true);

    const perfil = await perfilDoMock(sessao);
    expect(perfil?.semana_corrida).toBe(1);
    expect(perfil?.semana_corda).toBe(1);
    expect(perfil?.semana_fixa).toBe(1);
    expect(perfil?.ultimo_treino).toBeNull();
    expect(perfil?.fase_desde).toBe(diasAtras(0));
    // a fase continua a mesma (SPEC §18.2)
    expect(perfil?.fase_atual).toBe("fase1");

    const eventos = await lerDoMock<{ motivo: string; exercise_id: string | null }>(
      sessao,
      "progression_events",
    );
    expect(eventos.filter((e) => e.motivo === "recomeco")).toHaveLength(3);
    expect(eventos.filter((e) => e.exercise_id === null)).toHaveLength(1);

    // e o próximo treino volta a ser o Treino A
    await expect(
      page.getByRole("region", { name: "Hoje" }).getByRole("heading", { name: "Treino A" }),
    ).toBeVisible();
  });
});

test.describe("a escolha sem rede (SPEC §8 e §18.2)", () => {
  test("offline a escolha entra na fila e sobe quando a rede volta", async ({
    page,
    context,
  }) => {
    const sessao = await usuarioParado(10);
    await fixarData(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await expect(card(page)).toBeVisible();
    await esperarServiceWorker(page);

    await context.setOffline(true);
    await opcao(page, "semana").click();
    // a tela responde na hora, mesmo sem rede
    await expect(card(page)).toHaveCount(0);
    expect((await perfilDoMock(sessao))?.semana_corrida).toBe(3);

    await context.setOffline(false);
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.dispatchEvent(new Event("online")));
          return (await perfilDoMock(sessao))?.semana_corrida;
        },
        { timeout: 40_000 },
      )
      .toBe(2);
  });
});
