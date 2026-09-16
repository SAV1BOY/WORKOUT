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
  irNaAba,
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

/** Terça 27/10/2026, dia de cardio (corrida) na Fase 1 (SPEC §5). */
const HOJE_CARDIO = "2026-10-27T08:00:00-03:00";
/** Quinta 29/10/2026, dia de descanso. */
const HOJE_DESCANSO = "2026-10-29T08:00:00-03:00";
/** Domingo 01/11/2026, descanso com caminhada leve. */
const HOJE_DOMINGO = "2026-11-01T08:00:00-03:00";

/** Quantos dias antes do dia de referência (26/10/2026, por padrão). */
function diasAtras(dias: number, base = "2026-10-26"): string {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

/**
 * O usuário com a última sessão concluída há `dias` dias e uma carga já
 * conquistada no agachamento. O último treino foi o B, então o de hoje é o A.
 */
async function usuarioParado(dias: number, base?: string): Promise<SessaoMock> {
  const sessao = await usuarioComPerfil({
    ultimo_treino: "B1",
    semana_corrida: 3,
    semana_corda: 2,
    semana_fixa: 4,
  });
  const data = diasAtras(dias, base);
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

/* ------------------------------------------ auditoria do marco (16/09/2026) */

test.describe("auditoria do marco Retomada", () => {
  test("as bordas das quatro faixas: 7, 13, 14, 27 e 28 dias (SPEC §18.2)", async ({
    page,
  }) => {
    const faixas: [number, string[]][] = [
      [7, ["continuar", "semana"]],
      [13, ["continuar", "semana"]],
      [14, ["continuar", "leve"]],
      [27, ["continuar", "leve"]],
      [28, ["continuar", "leve", "zero"]],
    ];
    for (const [dias, esperadas] of faixas) {
      await resetarMock();
      await usuarioParado(dias);
      await fixarData(page, HOJE);
      await entrarNoApp(page);
      await esperarAbaTreino(page);
      await expect(card(page)).toContainText(`Você ficou ${dias} dias sem treinar`);
      for (const e of ["continuar", "semana", "leve", "zero"]) {
        await expect(opcao(page, e)).toHaveCount(esperadas.includes(e) ? 1 : 0);
      }
      for (const e of esperadas) {
        const caixa = await opcao(page, e).boundingBox();
        expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect((caixa?.x ?? 0) + (caixa?.width ?? 0)).toBeLessThanOrEqual(360);
      }
      await semRolagemHorizontal(page);
      await page.context().clearCookies();
    }
  });

  test("uma pausa NOVA pergunta de novo (SPEC §18.4)", async ({ page }) => {
    const sessao = await usuarioParado(10);
    await fixarData(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await opcao(page, "continuar").click();
    await esperarEscolha(page, sessao, "continuar");

    // voltou a treinar no dia seguinte e parou outros 9 dias
    await inserirNoMock(sessao, "sessions", [
      {
        data: "2026-10-27",
        workout_id: "A1",
        fase: "fase1",
        status: "concluida",
        concluida_em: "2026-10-27T11:00:00-03:00",
      },
    ]);
    await fixarData(page, "2026-11-05T08:00:00-03:00");
    await page.reload();
    await esperarAbaTreino(page);
    await expect(card(page)).toContainText("Você ficou 9 dias sem treinar");
  });

  test("a sessão depois da semana leve devolve a carga cheia, sem falha (§6.2)", async ({
    page,
  }) => {
    const sessao = await usuarioParado(20);
    await fixarData(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    await opcao(page, "leve").click();
    await esperarEscolha(page, sessao, "leve");

    await comecarOTreinoDoDia(page);
    await abrirVisaoGeral(page);
    for (const n of [1, 2, 3]) {
      const grupo = page.getByRole("group", { name: `Série ${n} — Agachamento livre` });
      await grupo.getByRole("checkbox").click();
      await expect(grupo.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    }
    await page.getByRole("button", { name: "Concluir" }).click();
    const resumo = page.getByRole("dialog");
    await expect(resumo.getByText("Treino concluído")).toBeVisible();
    await resumo.getByRole("button", { name: "Salvar e voltar" }).click();
    await esperarAbaTreino(page);

    await expect
      .poll(
        async () =>
          (await estadosDoMock(sessao)).find(
            (e) => e.exercise_id === "agachamento-livre",
          ),
        { timeout: 20_000 },
      )
      .toMatchObject({
        carga_atual_kg: CARGA,
        semana_leve: false,
        carga_antes_leve: null,
        falhas_seguidas: 0,
      });

    const eventos = await lerDoMock<{ motivo: string }>(sessao, "progression_events");
    expect(eventos.map((e) => e.motivo)).toContain("retomada_leve");
    expect(eventos.map((e) => e.motivo)).toContain("fim_semana_leve");
  });

  test("o Histórico do Relatório ganha a linha da pausa (SPEC §18.5)", async ({
    page,
  }) => {
    const sessao = await usuarioParado(10);
    await fixarData(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await opcao(page, "semana").click();
    await esperarEscolha(page, sessao, "semana");

    await irNaAba(page, "Relatório");
    const linha = page.locator('[data-registro="pausa"]');
    await expect(linha).toContainText("Pausa de 10 dias");
    await expect(linha).toContainText("recomeçar a semana");
    await semRolagemHorizontal(page);
  });

  test("offline, com 20 dias, 'Voltar mais leve' vale na hora e sobe depois (§18.6)", async ({
    page,
    context,
  }) => {
    const sessao = await usuarioParado(20);
    await fixarData(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await expect(opcao(page, "leve")).toBeEnabled();
    await esperarServiceWorker(page);
    // o cache de leitura é gravado no máximo 1× por segundo
    await page.waitForTimeout(1_500);

    await context.setOffline(true);
    await page.reload();
    await esperarAbaTreino(page);
    // as cargas vêm do cache persistido: sem elas a decisão ficaria travada
    await expect(opcao(page, "leve")).toBeEnabled({ timeout: 15_000 });
    await opcao(page, "leve").click();
    await expect(card(page)).toHaveCount(0);

    await context.setOffline(false);
    await expect
      .poll(
        async () => {
          await page.evaluate(() => window.dispatchEvent(new Event("online")));
          return (await estadosDoMock(sessao)).find(
            (e) => e.exercise_id === "agachamento-livre",
          )?.carga_atual_kg;
        },
        { timeout: 40_000 },
      )
      .toBe(CARGA_LEVE);
  });

  test("sem as cargas lidas, só 'Continuar' fica de pé (SPEC §18.3 e §18.6-9)", async ({
    page,
  }) => {
    /*
     * A primeira vez que o card é desenhado sem rede é a primeira vez que a
     * leitura de TODAS as cargas não chega (ela só roda quando a faixa tem
     * "mais leve"). Se ela desligasse o card inteiro, a pausa trancaria a aba
     * Treino: o card barra todo gesto e o FAB some.
     */
    const sessao = await usuarioParado(20);
    await fixarData(page, HOJE);
    await page.route(/exercise_state\?select=\*$/, (rota) => rota.abort());
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    await expect(card(page)).toContainText("Você ficou 20 dias sem treinar");
    await expect(opcao(page, "leve")).toBeDisabled();
    await expect(page.locator("[data-retomada-sem-cargas]")).toBeVisible();
    await expect(opcao(page, "continuar")).toBeEnabled();
    await semRolagemHorizontal(page);

    await opcao(page, "continuar").click();
    await esperarEscolha(page, sessao, "continuar");
    // e daí em diante dá para treinar
    await expect(page.getByRole("button", { name: "Começar treino" })).toBeVisible();
    const estados = await estadosDoMock(sessao);
    expect(estados.map((e) => e.carga_atual_kg)).toEqual([CARGA, 29.5]);
  });

  test("o FAB Ajustar sai da tela enquanto a pausa não foi decidida (SPEC §18.3)", async ({
    page,
  }) => {
    const sessao = await usuarioParado(40);
    await fixarData(page, HOJE);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    const fab = page.getByRole("button", { name: "Ajustar" });
    await expect(card(page)).toBeVisible();
    await expect(fab).toHaveCount(0);

    await opcao(page, "continuar").click();
    await esperarEscolha(page, sessao, "continuar");
    await expect(fab).toBeVisible();
  });
});

/* --------------------------- correção da auditoria: os outros gestos (§18.3) */

test.describe("todo gesto passa pelo card (SPEC §18.3)", () => {
  test("no dia de cardio, 'Começar' leva ao card e não abre a sessão", async ({
    page,
  }) => {
    const sessao = await usuarioParado(30, "2026-10-27");
    await fixarData(page, HOJE_CARDIO);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await expect(card(page)).toContainText("Você ficou 30 dias sem treinar");

    const hojeNaTela = page.getByRole("region", { name: "Hoje" });
    await hojeNaTela.getByRole("button", { name: "Começar", exact: true }).click();

    // nada de /cardio/corrida: a decisão vem antes
    await expect(page).toHaveURL(/\/$/);
    await expect(card(page)).toBeVisible();
    await expect(card(page)).toBeFocused();
    expect((await perfilDoMock(sessao))?.prefs?.retomada).toBeUndefined();
    await semRolagemHorizontal(page);
    await page.screenshot({
      path: `${CAPTURAS}/05-dia-de-cardio-bloqueado.png`,
      fullPage: true,
    });

    // e "Treinar mesmo assim" também passa pelo card
    await hojeNaTela.getByRole("button", { name: /Treinar mesmo assim/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(card(page)).toBeVisible();
  });

  test("no dia de descanso, o '+1' leva ao card e não registra a repetição", async ({
    page,
  }) => {
    const sessao = await usuarioParado(30, "2026-10-29");
    await fixarData(page, HOJE_DESCANSO);
    await entrarNoApp(page);
    await esperarAbaTreino(page);
    await expect(card(page)).toContainText("Você ficou 30 dias sem treinar");

    await page
      .getByRole("button", { name: "Somar uma repetição solta de barra fixa" })
      .click();
    await expect(card(page)).toBeFocused();
    await semRolagemHorizontal(page);
    await page.screenshot({
      path: `${CAPTURAS}/06-dia-de-descanso-mais-um.png`,
      fullPage: true,
    });
    // nada foi gravado: nem no banco, nem na fila que sobe para ele
    await page.waitForTimeout(1_000);
    expect(await lerDoMock(sessao, "pullup_singles")).toHaveLength(0);
    expect((await perfilDoMock(sessao))?.prefs?.retomada).toBeUndefined();

    // decidida a pausa, o mesmo toque registra
    await opcao(page, "leve").click();
    await esperarEscolha(page, sessao, "leve");
    await page
      .getByRole("button", { name: "Somar uma repetição solta de barra fixa" })
      .click();
    await expect
      .poll(async () => (await lerDoMock(sessao, "pullup_singles")).length, {
        timeout: 15_000,
      })
      .toBe(1);
  });

  test("no domingo, a caminhada leve também leva ao card", async ({ page }) => {
    await usuarioParado(30, "2026-11-01");
    await fixarData(page, HOJE_DOMINGO);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    await page.getByRole("button", { name: "Começar caminhada leve" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(card(page)).toBeFocused();
  });

  test("a atividade de hoje não apaga a pausa por decidir (SPEC §18.1)", async ({
    page,
  }) => {
    // ele voltou de 30 dias e já registrou algo hoje (de outra tela)
    const sessao = await usuarioParado(30, "2026-10-29");
    await inserirNoMock(sessao, "pullup_singles", [
      { data: diasAtras(0, "2026-10-29"), reps: 1 },
    ]);
    await fixarData(page, HOJE_DESCANSO);
    await entrarNoApp(page);
    await esperarAbaTreino(page);

    await expect(card(page)).toContainText("Você ficou 30 dias sem treinar");
    await expect(opcao(page, "zero")).toBeVisible();

    // decidido, o card some e não volta
    await opcao(page, "leve").click();
    await esperarEscolha(page, sessao, "leve");
    await page.reload();
    await esperarAbaTreino(page);
    await expect(card(page)).toHaveCount(0);
  });
});
