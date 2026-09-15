/**
 * A camada visual v2 da aba Treino (SPEC §13.2 e §13.3): faixa da semana, meta
 * semanal, todos os cards do dia, a lista com miniatura/prescrição/carga, o
 * "Continuar" da sessão aberta, a preferência da meta e o vídeo opcional.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
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

const SEGUNDA = "2026-09-14T08:00:00-03:00";
const TERCA = "2026-09-15T08:00:00-03:00";
const QUARTA = "2026-09-16T08:00:00-03:00";
const QUINTA = "2026-09-17T08:00:00-03:00";
const DOMINGO = "2026-09-20T08:00:00-03:00";

const SESSAO_ABERTA = "22222222-2222-4222-8222-222222222222";

/**
 * `fixarData` (e não `fixarRelogio`): a tela guarda o cache e sobe a fila com
 * temporizadores, que `page.clock.install` congelaria (e2e/README.md).
 */
async function abrir(page: Page, quando: string) {
  await fixarData(page, quando);
  await entrarNoApp(page);
  await esperarAbaTreino(page);
}

/** Segunda de força concluída + terça de corrida concluída = 2 da meta. */
async function semearDuasFeitas(sessao: SessaoMock) {
  await inserirNoMock(sessao, "sessions", [
    {
      id: "33333333-3333-4333-8333-333333333333",
      data: "2026-09-14",
      workout_id: "A1",
      fase: "fase1",
      status: "concluida",
      concluida_em: "2026-09-14T10:00:00.000Z",
    },
  ]);
  await inserirNoMock(sessao, "cardio_sessions", [
    { data: "2026-09-15", tipo: "corrida", semana_plano: 1, concluida: true, duracao_min: 34 },
  ]);
}

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("cabeçalho da aba Treino (SPEC §13.3)", () => {
  test("saudação, faixa da semana com ✓ e a meta em 2/5", async ({ page }) => {
    const sessao = await usuarioComPerfil({ ultimo_treino: "A1" });
    await semearDuasFeitas(sessao);
    await abrir(page, QUARTA);

    // a saudação é o dia da semana com a data (§13.3)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("quarta, 16/09");

    const semana = page.getByRole("region", { name: "Semana" });
    await expect(semana).toBeVisible();
    // seg e ter feitos, qua é hoje, qui é descanso
    await expect(semana.locator('[data-dia="2026-09-14"]')).toHaveAttribute(
      "data-marca",
      "feito",
    );
    await expect(semana.locator('[data-dia="2026-09-15"]')).toHaveAttribute(
      "data-marca",
      "feito",
    );
    await expect(semana.locator('[data-dia="2026-09-16"]')).toHaveAttribute(
      "data-marca",
      "hoje",
    );
    await expect(semana.locator('[data-dia="2026-09-17"]')).toHaveAttribute(
      "data-marca",
      "descanso",
    );

    // meta padrão da Fase 1: 3 de força + 2 de cardio
    await expect(page.getByText("Meta semanal")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Meta semanal" })).toHaveAttribute(
      "aria-valuemax",
      "5",
    );
    await expect(page.getByText("2/5", { exact: true })).toBeVisible();

    // a faixa leva ao calendário
    await semana.getByRole("link", { name: "Abrir o calendário da semana" }).click();
    await expect(page).toHaveURL(/\/calendario$/);
  });

  test("a sequência de semanas com a meta cumprida aparece com a chama", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    // a semana anterior (07 a 13/09) fechou com duas sessões de cardio
    await inserirNoMock(sessao, "cardio_sessions", [
      { data: "2026-09-08", tipo: "corrida", semana_plano: 1, concluida: true, duracao_min: 34 },
      { data: "2026-09-12", tipo: "corrida", semana_plano: 1, concluida: true, duracao_min: 34 },
    ]);
    await abrir(page, SEGUNDA);

    // com a meta padrão (5) a semana passada não conta: nada de sequência
    await expect(page.getByLabel(/^Sequência:/)).toHaveCount(0);

    // baixando a meta para 2, a semana passada passa a contar (SPEC §13.7)
    await page.goto("/mais/preferencias");
    await page.getByLabel("Sessões por semana").fill("2");
    await page.getByRole("button", { name: "Salvar meta semanal" }).click();
    await expect(page.getByText("usando 2 por semana")).toBeVisible();

    await page.goto("/");
    await esperarAbaTreino(page);
    await expect(page.getByRole("progressbar", { name: "Meta semanal" })).toHaveAttribute(
      "aria-valuemax",
      "2",
    );
    await expect(page.getByLabel(/^Sequência: 1 semana/)).toBeVisible();

    const [perfil] = await lerDoMock<{ prefs: { meta_semanal?: number } }>(
      sessao,
      "profiles",
    );
    expect(perfil?.prefs.meta_semanal).toBe(2);
  });
});

test.describe("cards do dia (SPEC §13.3)", () => {
  test("segunda: card de força com capa, raios e a lista do treino", async ({ page }) => {
    await usuarioComPerfil();
    await abrir(page, SEGUNDA);

    const hoje = page.getByRole("region", { name: "Hoje" });
    await expect(hoje.getByRole("heading", { name: "Treino A" })).toBeVisible();
    await expect(hoje.getByText("44 min · 6 exercícios")).toBeVisible();
    // a capa é a foto -1 do primeiro exercício do treino (§13.3)
    const capa = hoje.locator('img[src="/fotos/agachamento-livre-1.jpg"]');
    await expect(capa).toBeVisible();
    expect(await capa.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    // raios de dificuldade: o agachamento é composto pesado (3 de 3)
    await expect(hoje.getByLabel("Dificuldade: pesado (3 de 3)").first()).toBeVisible();

    const itens = page.getByRole("list", { name: "Exercícios de hoje" }).getByRole("listitem");
    await expect(itens).toHaveCount(6);

    const primeiro = itens.first();
    await expect(primeiro).toContainText("1. Agachamento livre");
    await expect(primeiro).toContainText("3 × 5");
    await expect(primeiro).toContainText("Hoje: 7,5 kg na barra");
    // miniatura: a figura animada do exercício
    await expect(primeiro.locator('img[src="/figuras/agachamento-livre.svg"]')).toBeVisible();
    // tocar no item abre a ficha
    await expect(primeiro.getByRole("link").first()).toHaveAttribute(
      "href",
      "/exercicios/agachamento-livre",
    );

    // um exercício de halteres traz o rótulo do implemento (§4)
    await expect(
      page.getByRole("list", { name: "Exercícios de hoje" }),
    ).toContainText("1,5 kg por halter");

    await semRolagemHorizontal(page);
  });

  test("terça: cardio com capa e o treinar mesmo assim", async ({ page }) => {
    await usuarioComPerfil();
    await abrir(page, TERCA);

    await expect(page.getByRole("heading", { name: "Corrida · semana 1" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Começar" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Treinar mesmo assim (Treino A)" }),
    ).toBeVisible();

    // a corda tem foto de execução no kit; a corrida não (§13.3)
    await page.getByRole("button", { name: "Fazer corda em vez de corrida" }).click();
    await expect(page.getByRole("heading", { name: "Corda · semana 1" })).toBeVisible();
    await expect(
      page.locator('img[src="/fotos/corrida-no-lugar-com-a-corda-1.jpg"]'),
    ).toBeVisible();

    await semRolagemHorizontal(page);
  });

  test("quinta: descanso com o +1 das soltas; domingo: caminhada leve", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await abrir(page, QUINTA);

    await expect(page.getByRole("heading", { name: "Descanso" })).toBeVisible();
    await expect(page.getByText("Soltas de hoje")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Começar caminhada leve" }),
    ).toHaveCount(0);

    await fixarData(page, DOMINGO);
    await page.goto("/");
    await esperarAbaTreino(page);
    await expect(page.getByRole("heading", { name: "Descanso" })).toBeVisible();
    await expect(page.getByText("caminhada leve").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Começar caminhada leve" }),
    ).toHaveAttribute("href", "/cardio/caminhada");

    await semRolagemHorizontal(page);
  });

  test("com sessão aberta do dia, o card vira Continuar com as séries feitas", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await inserirNoMock(sessao, "sessions", [
      {
        id: SESSAO_ABERTA,
        data: "2026-09-14",
        workout_id: "A1",
        fase: "fase1",
        status: "em_andamento",
      },
    ]);
    await inserirNoMock(sessao, "session_sets", [
      {
        session_id: SESSAO_ABERTA,
        exercise_id: "agachamento-livre",
        set_index: 1,
        tipo: "trabalho",
        reps: 5,
        carga_kg: 7.5,
        concluida: true,
        registrada_em: "2026-09-14T10:00:00.000Z",
      },
      {
        session_id: SESSAO_ABERTA,
        exercise_id: "agachamento-livre",
        set_index: 2,
        tipo: "trabalho",
        reps: 5,
        carga_kg: 7.5,
        concluida: true,
        registrada_em: "2026-09-14T10:04:00.000Z",
      },
    ]);

    await abrir(page, SEGUNDA);

    const continuar = page.getByRole("link", { name: "Continuar" });
    await expect(continuar).toHaveAttribute("href", `/treinar/${SESSAO_ABERTA}`);
    await expect(page.getByText("2/16 séries")).toBeVisible();
    await expect(page.getByText("em andamento")).toBeVisible();
  });
});

test.describe("substituir pela lista do dia (SPEC §13.3)", () => {
  test("a escolha vale para a sessão que começa depois", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await abrir(page, SEGUNDA);

    const itens = page.getByRole("list", { name: "Exercícios de hoje" }).getByRole("listitem");
    await itens.first().getByRole("button", { name: "Substituir Agachamento livre" }).click();

    const folha = page.getByRole("dialog");
    await expect(folha.getByText("Substituir hoje")).toBeVisible();
    const escolhido = folha.locator("ul li button").first();
    const nome = (await escolhido.innerText()).split("\n")[0]!;
    await escolhido.click();

    // a lista já mostra o substituto, com o original ao lado
    await expect(itens.first()).toContainText(nome);
    await expect(itens.first()).toContainText("no lugar de Agachamento livre");

    // e a sessão nasce com ele
    await page.getByRole("link", { name: "Começar treino" }).click();
    await page.getByRole("button", { name: "Começar Treino A" }).click();
    await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: `1. ${nome}` })).toBeVisible();
    await expect(page.getByText("no lugar de Agachamento livre (só hoje)")).toBeVisible();

    await expect
      .poll(async () => (await lerDoMock(sessao, "sessions")).length, { timeout: 10_000 })
      .toBe(1);
  });
});

test.describe("navegação v2 (SPEC §13.2)", () => {
  test("/progresso redireciona para /relatorio", async ({ page }) => {
    await usuarioComPerfil();
    await abrir(page, SEGUNDA);

    await page.goto("/progresso");
    await expect(page).toHaveURL(/\/relatorio$/);
    await expect(page.getByRole("heading", { name: "Relatório" })).toBeVisible();
  });

  test("Explorar existe e diz o que ainda não é", async ({ page }) => {
    await usuarioComPerfil();
    await abrir(page, SEGUNDA);

    await irNaAba(page, "Explorar");
    await expect(page.getByRole("heading", { name: "Explorar" })).toBeVisible();
    await expect(page.getByText("Em construção — marco V2")).toBeVisible();
    await semRolagemHorizontal(page);
  });
});

test.describe("raios de dificuldade (SPEC §13.4 e §13.7)", () => {
  test("a preferência desliga os raios", async ({ page }) => {
    await usuarioComPerfil();
    await abrir(page, SEGUNDA);
    await expect(page.getByLabel("Dificuldade: pesado (3 de 3)").first()).toBeVisible();

    await page.goto("/mais/preferencias");
    await page.getByLabel("Mostrar raios de dificuldade").click();
    await page.goto("/");
    await esperarAbaTreino(page);
    await expect(page.getByLabel(/^Dificuldade:/)).toHaveCount(0);
  });
});

test.describe("vídeo opcional (SPEC §13.1)", () => {
  const VIDEO = join(process.cwd(), "public", "videos", "agachamento-livre.mp4");

  test.afterEach(() => {
    rmSync(VIDEO, { force: true });
  });

  test("sem o arquivo é a figura; com o arquivo é o vídeo", async ({ page }) => {
    await usuarioComPerfil();
    await abrir(page, SEGUNDA);
    await page.getByRole("link", { name: "Começar treino" }).click();
    await page.getByRole("button", { name: "Começar Treino A" }).click();
    await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
    const url = page.url();

    // sem vídeo nenhum (o estado do kit): a figura animada
    await expect(
      page.locator('img[src="/figuras/agachamento-livre.svg"]').first(),
    ).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);

    // um mp4 temporário em public/videos (o npm run assets copia de assets/videos)
    mkdirSync(join(process.cwd(), "public", "videos"), { recursive: true });
    writeFileSync(VIDEO, Buffer.from("00000018667479706d703432", "hex"));

    await page.goto(url);
    const video = page.locator('video[data-video="agachamento-livre"]');
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute("src", "/videos/agachamento-livre.mp4");

    rmSync(VIDEO, { force: true });
    await page.goto(url);
    await expect(page.locator("video")).toHaveCount(0);
  });
});
