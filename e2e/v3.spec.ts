/**
 * O marco V3 da camada visual (SPEC §14.3 e §14.4): Desafios, Parte do corpo
 * em foco, Personalizar treino, Editar/reordenar, Explorar com as coleções
 * derivadas, o Relatório com histórico e sequências, o IMC no Corpo e as
 * preferências.
 *
 * Também prova a §14.5.3 inteira: uma sessão **livre** de core sai da aba
 * Treino, roda no player com um passo de reps e um de tempo, e o mock mostra a
 * linha em `sessions` com `workout_id = 'livre'` + `plano` e as séries em
 * `session_sets`.
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
  type SessaoMock,
  usuarioComPerfil,
} from "./fixtures";

const SEGUNDA = "2026-09-14T08:00:00-03:00";
const QUARTA = "2026-09-16T08:00:00-03:00";

async function abrir(page: Page, quando: string = SEGUNDA) {
  await fixarData(page, quando);
  await entrarNoApp(page);
  await esperarAbaTreino(page);
}

test.beforeEach(async () => {
  await resetarMock();
});

/** ✓ na série atual e pula o descanso que vem logo depois. */
async function concluirSerie(page: Page) {
  await page.getByRole("button", { name: "Concluir a série" }).click();
  const pular = page.getByRole("button", { name: "Pular" });
  if (await pular.isVisible().catch(() => false)) await pular.click();
}

/** Anda pelo player (seta "próximo", pulando descansos) até `alvo` aparecer. */
async function irAte(page: Page, alvo: ReturnType<Page["getByText"]>) {
  for (let i = 0; i < 40; i++) {
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

/* --------------------------------------------------- aba Treino (§14.3) */

test.describe("aba Treino — Desafios (§14.3)", () => {
  test("carrossel manual com os três planos reais e a semana do perfil", async ({
    page,
  }) => {
    await usuarioComPerfil({ semana_fixa: 3, semana_corrida: 5 });
    await abrir(page);

    const desafios = page.getByRole("region", { name: "Desafios" });
    await expect(desafios).toBeVisible();

    const cards = desafios.locator("[data-desafio]");
    await expect(cards).toHaveCount(3);
    await expect(desafios.locator('[data-desafio="barra_fixa"]')).toContainText(
      "Semana 3 de 12",
    );
    await expect(desafios.locator('[data-desafio="corrida"]')).toContainText(
      "Semana 5 de 12",
    );
    await expect(desafios.locator('[data-desafio="fase"]')).toContainText(
      "Fase 1 — corpo inteiro",
    );

    // o botão da semana leva ao plano de verdade
    await expect(
      desafios
        .locator('[data-desafio="barra_fixa"]')
        .getByRole("link", { name: "Fazer a sessão da semana" }),
    ).toHaveAttribute("href", "/barra-fixa");

    // carrossel **manual**: a lista rola para o lado sem a página rolar
    await semRolagemHorizontal(page);
    const lista = desafios.getByRole("list").first();
    const antes = await lista.evaluate((el) => el.scrollLeft);
    await lista.evaluate((el) => {
      el.scrollLeft = 300;
    });
    expect(await lista.evaluate((el) => el.scrollLeft)).toBeGreaterThan(antes);
  });
});

test.describe("aba Treino — Parte do corpo em foco (§14.3)", () => {
  test("chips dos 8 grupos, contagem, filtros derivados e Ver tudo", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await abrir(page);

    const secao = page.getByRole("region", { name: "Parte do corpo em foco" });
    const grupos = secao.getByRole("list", { name: "Grupos" });
    await expect(grupos.getByRole("button")).toHaveCount(8);
    await expect(
      grupos.getByRole("button", { name: "Parte do corpo: Peito" }),
    ).toHaveAttribute("aria-pressed", "true");

    await grupos.getByRole("button", { name: "Parte do corpo: Core" }).click();
    // 13 exercícios de Core em data/exercicios.json
    await expect(secao).toContainText("13 exercícios");
    // `formatarMinutos`: "~44 min" ou "~1 h 19" quando passa de uma hora
    await expect(secao).toContainText(/~(\d+ min|\d+ h( \d+)?)/);
    await expect(
      secao.getByRole("button", { name: /^Começar Core$/ }),
    ).toBeVisible();

    await expect(secao.getByRole("link", { name: "Ver tudo" })).toHaveAttribute(
      "href",
      "/explorar/grupo/Core",
    );

    // o filtro derivado "sem equipamento" encolhe a lista e some com o Bíceps,
    // que não tem exercício de peso do corpo no catálogo
    await secao.getByRole("button", { name: "Filtro: Sem equipamento" }).click();
    await expect(
      grupos.getByRole("button", { name: "Parte do corpo: Bíceps" }),
    ).toHaveCount(0);
    await expect(
      grupos.getByRole("button", { name: "Parte do corpo: Core" }),
    ).toBeVisible();
    await expect(secao).not.toContainText("13 exercícios");
    await expect(secao).toContainText(/\d+ exercícios · ~\d+ min/);
    await expect(secao).not.toContainText("Abdominal com anilha");
    await semRolagemHorizontal(page);
  });

  test("Começar abre uma sessão livre de core e grava plano e séries (§14.5.3)", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await abrir(page);

    const secao = page.getByRole("region", { name: "Parte do corpo em foco" });
    await secao
      .getByRole("list", { name: "Grupos" })
      .getByRole("button", { name: "Parte do corpo: Core" })
      .click();
    await secao.getByRole("button", { name: /^Começar Core$/ }).click();

    await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/);
    await comecarNoPlayer(page);

    // 1) um passo de REPS: o ✓ grava e o descanso vem logo atrás
    await expect(
      page.getByRole("heading", { name: "Elevação de pernas na barra fixa" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "repetições" })).toBeVisible();
    await concluirSerie(page);

    // 2) o passo de TEMPO (a prancha): contagem regressiva, como na §14.1.2
    await irAte(page, page.getByText("· exercício 5 de 6"));
    await expect(page.getByRole("heading", { name: "Prancha" })).toBeVisible();
    await expect(
      page.getByRole("timer", { name: "Contagem do exercício" }),
    ).toHaveText("1:00");
    await page.getByRole("button", { name: "Concluir a série" }).click();

    // 3) o mock tem a sessão livre com o plano e as séries
    const sessoes = await lerDoMock<{
      workout_id: string;
      plano: { titulo: string; colecao: string; itens: { exercicio_id: string }[] } | null;
    }>(sessao, "sessions");
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]?.workout_id).toBe("livre");
    expect(sessoes[0]?.plano?.titulo).toBe("Core");
    expect(sessoes[0]?.plano?.colecao).toBe("grupo:Core");
    expect(sessoes[0]?.plano?.itens.length).toBe(6);

    /* a série vai para o IndexedDB na hora e sobe pela fila: esperar a fila */
    const lerSeries = () =>
      lerDoMock<{ exercise_id: string; concluida: boolean }>(
        sessao,
        "session_sets",
        "select=exercise_id,concluida,tempo_s,reps&concluida=is.true",
      );
    await expect
      .poll(async () => (await lerSeries()).length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);
    const series = await lerSeries();
    for (const s of series) {
      expect(sessoes[0]?.plano?.itens.map((i) => i.exercicio_id)).toContain(
        s.exercise_id,
      );
    }
  });
});

test.describe("aba Treino — Personalizar e Editar (§14.3)", () => {
  test("Personalizar: escolher 3 exercícios e começar a sessão", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await abrir(page);

    await page.getByRole("button", { name: /Personalizar treino/ }).click();
    const folha = page.getByRole("dialog");
    await expect(folha.getByText("Crie o seu próprio")).toBeVisible();

    await folha.getByLabel("Buscar exercício pelo nome").fill("abdominal");
    const catalogo = folha.getByRole("list", { name: "Catálogo" });
    for (const nome of [
      "Abdominal supra",
      "Abdominal completo",
      "Abdominal bicicleta",
    ]) {
      await catalogo.getByRole("button", { name: new RegExp(nome) }).first().click();
    }

    await folha.getByRole("button", { name: "Começar (3)" }).click();
    await page.waitForURL(/\/treinar\/[0-9a-f-]+$/);
    await comecarNoPlayer(page);

    const sessoes = await lerDoMock<{
      workout_id: string;
      plano: { itens: { exercicio_id: string }[] } | null;
    }>(sessao, "sessions");
    expect(sessoes[0]?.workout_id).toBe("livre");
    expect(sessoes[0]?.plano?.itens.map((i) => i.exercicio_id)).toEqual([
      "abdominal-supra",
      "abdominal-completo",
      "abdominal-bicicleta",
    ]);
  });

  test("Editar reordena só esta sessão e “voltar à ordem do programa” desfaz", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await abrir(page);

    const lista = page.getByRole("list", { name: "Exercícios de hoje" });
    await expect(lista.getByRole("listitem").first()).toContainText(
      "1. Agachamento livre",
    );

    await page.getByRole("button", { name: "Editar" }).click();
    const reordenar = page.getByRole("region", { name: "Reordenar os exercícios" });
    await expect(reordenar.getByRole("listitem").first()).toContainText(
      "1. Agachamento livre",
    );
    await reordenar.getByRole("button", { name: /^Descer Agachamento livre$/ }).click();
    await expect(reordenar.getByRole("listitem").first()).not.toContainText(
      "Agachamento livre",
    );
    await reordenar.getByRole("button", { name: "Pronto" }).click();

    // a lista do dia já mostra a ordem nova
    await expect(lista.getByRole("listitem").first()).not.toContainText(
      "Agachamento livre",
    );

    // e a sessão nasce com essa ordem em sessions.plano
    await comecarOTreinoDoDia(page);
    await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/);
    await comecarNoPlayer(page);

    const sessoes = await lerDoMock<{
      workout_id: string;
      plano: { itens: { exercicio_id: string }[] } | null;
    }>(sessao, "sessions");
    expect(sessoes[0]?.workout_id).toBe("A1");
    expect(sessoes[0]?.plano?.itens[0]?.exercicio_id).not.toBe("agachamento-livre");

    // de volta na aba Treino pelo "Sair do treino" da visão geral (§14.1)
    await page.getByRole("button", { name: "Visão geral do treino" }).click();
    await page.getByRole("link", { name: "Sair do treino" }).click();
    await esperarAbaTreino(page);
  });

  test("o FAB Ajustar abre os mesmos ajustes do player", async ({ page }) => {
    await usuarioComPerfil();
    await abrir(page);

    const fab = page.getByRole("button", { name: "Ajustar" });
    const caixa = await fab.boundingBox();
    expect(caixa?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(caixa?.height ?? 0).toBeGreaterThanOrEqual(44);

    await fab.click();
    const folha = page.getByRole("dialog");
    await expect(folha.getByLabel("Preparação (s)")).toBeVisible();
    await expect(folha.getByLabel("Descanso padrão (s)")).toBeVisible();
    await expect(folha.getByLabel("Avançar sozinho")).toBeVisible();
  });
});

/* ------------------------------------------------------ Explorar (§14.4) */

test.describe("Explorar (§14.4)", () => {
  test("destaque, coleções derivadas e busca sem acento que abre a coleção", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await abrir(page);
    await irNaAba(page, "Explorar");

    const tela = page.getByRole("region", { name: "Explorar" });
    await expect(tela.getByRole("heading", { name: "Explorar" })).toBeVisible();
    await expect(tela.getByText("Escolhas para você")).toBeVisible();

    // destaque do dia: segunda é Treino A
    await expect(tela.getByRole("heading", { name: "Treino A" })).toBeVisible();

    // as cinco seções derivadas dos JSON
    for (const nome of [
      "Treinos do programa",
      "Parte do corpo",
      "Circuitos",
      "Por aparelho",
      "Planos",
    ]) {
      await expect(page.getByRole("region", { name: nome })).toBeVisible();
    }

    // "Ver todos" abre a seção inteira: 8 grupos
    const corpo = page.getByRole("region", { name: "Parte do corpo" });
    await expect(corpo.locator("[data-colecao]")).toHaveCount(3);
    await corpo.getByRole("button", { name: "Ver todos (8)" }).click();
    await expect(corpo.locator("[data-colecao]")).toHaveCount(8);

    // circuitos com a contagem do JSON
    const circuitos = page.getByRole("region", { name: "Circuitos" });
    await expect(circuitos.locator('[data-colecao="circuito:tatame"]')).toContainText(
      "8 exercícios",
    );
    await expect(circuitos.locator('[data-colecao="circuito:corda"]')).toContainText(
      "3 exercícios",
    );

    // busca sem acento acha a coleção e o exercício
    await tela.getByLabel("Buscar exercício ou coleção").fill("triceps");
    const achadas = page.getByRole("region", { name: "Coleções encontradas" });
    await expect(achadas.locator('[data-colecao="grupo:Tríceps"]')).toBeVisible();

    await achadas.locator('[data-colecao="grupo:Tríceps"]').click();
    await page.waitForURL(/\/explorar\/grupo\//);
    await expect(
      page.getByRole("heading", { name: "Tríceps", level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Começar" })).toBeVisible();
    await semRolagemHorizontal(page);
  });

  test("a tela de uma coleção começa uma sessão livre", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await abrir(page);
    await page.goto("/explorar/circuito/tatame");

    await expect(page.getByRole("heading", { name: "Core no tatame" })).toBeVisible();
    await expect(page.getByText("8 exercícios")).toBeVisible();
    await page.getByRole("button", { name: "Começar", exact: true }).click();
    await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/);
    await comecarNoPlayer(page);

    const sessoes = await lerDoMock<{
      workout_id: string;
      plano: { titulo: string; colecao: string } | null;
    }>(sessao, "sessions");
    expect(sessoes[0]?.workout_id).toBe("livre");
    expect(sessoes[0]?.plano?.titulo).toBe("Core no tatame");
    expect(sessoes[0]?.plano?.colecao).toBe("circuito:tatame");
  });

  test("a coleção de um plano leva ao plano, não a uma sessão livre", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await abrir(page);
    await page.goto("/explorar/plano/barra_fixa");
    await expect(
      page.getByRole("link", { name: "Fazer a sessão da semana" }),
    ).toHaveAttribute("href", "/barra-fixa");

    /*
     * Um plano se descreve pelo tamanho, não por uma contagem de exercícios:
     * a corrida não tem exercício em `exercicios.json` e a tela dela mostrava
     * "0 exercícios · ~1 min" (auditoria do V3).
     */
    await page.goto("/explorar/plano/corrida");
    // `exact`: o próprio objetivo do plano termina em "em 12 semanas (…)"
    await expect(page.getByText("12 semanas", { exact: true })).toBeVisible();
    await expect(page.getByText(/exercícios? · ~/)).toHaveCount(0);
  });
});

/* ----------------------------------------------------- Relatório (§14.4) */

/** Uma semana com força, cardio e reps soltas registradas. */
async function semearRegistros(sessao: SessaoMock) {
  const idForca = "33333333-3333-4333-8333-333333333333";
  await inserirNoMock(sessao, "sessions", [
    {
      id: idForca,
      data: "2026-09-14",
      workout_id: "A1",
      fase: "fase1",
      status: "concluida",
      iniciada_em: "2026-09-14T09:00:00.000Z",
      concluida_em: "2026-09-14T09:45:00.000Z",
      duracao_s: 2_700,
    },
  ]);
  await inserirNoMock(sessao, "session_sets", [
    {
      session_id: idForca,
      exercise_id: "agachamento-livre",
      ordem_ex: 1,
      set_index: 1,
      tipo: "trabalho",
      reps: 5,
      carga_kg: 20,
      concluida: true,
      registrada_em: "2026-09-14T09:10:00.000Z",
    },
    {
      session_id: idForca,
      exercise_id: "agachamento-livre",
      ordem_ex: 1,
      set_index: 2,
      tipo: "trabalho",
      reps: 5,
      carga_kg: 20,
      concluida: true,
      registrada_em: "2026-09-14T09:15:00.000Z",
    },
  ]);
  await inserirNoMock(sessao, "progression_events", [
    {
      exercise_id: "agachamento-livre",
      session_id: idForca,
      data: "2026-09-14",
      de: { carga_kg: 18 },
      para: { carga_kg: 20 },
      motivo: "subiu",
    },
  ]);
  await inserirNoMock(sessao, "cardio_sessions", [
    {
      data: "2026-09-15",
      tipo: "corrida",
      semana_plano: 1,
      duracao_min: 34,
      concluida: true,
    },
  ]);
  await inserirNoMock(sessao, "pullup_singles", [
    { data: "2026-09-15", reps: 3 },
    { data: "2026-09-15", reps: 5 },
  ]);
  await inserirNoMock(sessao, "body_weights", [
    { data: "2026-09-10", peso_kg: 86 },
    { data: "2026-09-14", peso_kg: 85.2 },
  ]);
}

test.describe("Relatório (§13.5 e §14.4)", () => {
  test("contadores, registros, sequências, Peso e IMC", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await semearRegistros(sessao);
    await abrir(page, QUARTA);
    await irNaAba(page, "Relatório");

    const tela = page.getByRole("region", { name: "Relatório" });
    await expect(tela).toContainText("Treinos");
    await expect(tela).toContainText("Minutos");
    await expect(tela).toContainText("Volume");

    /*
     * 1 força + 1 cardio = 2 treinos; 45 + 34 = 79 min; 2 × 5 × 20 = 200 kg.
     * Os contadores do topo são os acumulados: a seção "Totais" (a de "Números",
     * SPEC §19.2, tem os mesmos rótulos recortados por período).
     */
    const totais = tela.getByRole("region", { name: "Totais" });
    await expect(totais.locator('[data-contador="Treinos"]')).toContainText("2");
    await expect(totais.locator('[data-contador="Minutos"]')).toContainText("79");
    await expect(totais.locator('[data-contador="Volume (kg)"]')).toContainText("200");

    // histórico: a faixa da semana navegável e os registros da semana
    const historico = page.getByRole("region", { name: "Histórico" });
    await expect(historico.getByRole("button", { name: "Semana anterior" })).toBeVisible();
    const registros = historico.getByRole("list", { name: "Registros" });
    await expect(registros.getByRole("listitem")).toHaveCount(3);
    await expect(registros).toContainText("Treino A");
    await expect(registros).toContainText("45 min · 2 séries · ↑ 1");
    await expect(registros).toContainText("Corrida");
    await expect(registros).toContainText("semana 1 · 34 min");
    await expect(registros).toContainText("Barra fixa no descanso");
    await expect(registros).toContainText("8 repetições");

    // o toque num registro de força abre o resumo da sessão
    await expect(
      registros.getByRole("link").filter({ hasText: "Treino A" }),
    ).toHaveAttribute("href", /\/treinar\//);

    // sequências
    const sequencias = page.getByRole("region", { name: "Sequências" });
    await expect(sequencias).toContainText("Dias seguidos");
    await expect(sequencias).toContainText("Semanas seguidas");

    // Peso e IMC
    const peso = page.getByRole("region", { name: "Peso" });
    await expect(peso).toContainText("85,2 kg");
    await expect(peso).toContainText("maior 86 kg");
    await expect(peso).toContainText("menor 85,2 kg");

    const imc = page.getByRole("region", { name: "IMC" });
    // 85,2 kg e 1,90 m → 23,6 (peso saudável)
    await expect(imc).toContainText("23,6");
    await expect(imc).toContainText("Saudável");

    await semRolagemHorizontal(page);
  });

  test("“Todos os registros” mostra também o que está fora da semana", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await semearRegistros(sessao);
    // a semana civil de 21/09 não tem nada: a faixa fica vazia
    await abrir(page, "2026-09-23T08:00:00-03:00");
    await irNaAba(page, "Relatório");

    const historico = page.getByRole("region", { name: "Histórico" });
    await expect(historico).toContainText("Nada registrado nesta semana");
    await historico.getByRole("button", { name: "Todos os registros" }).click();
    await expect(
      historico.getByRole("list", { name: "Registros" }),
    ).toContainText("Treino A");
  });
});

/* ----------------------------------------------- Corpo e Mais (§14.4) */

test.describe("Corpo e Preferências (§14.4)", () => {
  test("o IMC aparece na aba Peso do Corpo", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await inserirNoMock(sessao, "body_weights", [{ data: "2026-09-14", peso_kg: 85.2 }]);
    await abrir(page);
    await irNaAba(page, "Corpo");

    const imc = page.getByRole("region", { name: "IMC" });
    await expect(imc).toContainText("23,6");
    await expect(imc).toContainText("Saudável");

    // a altura é editável e grava no perfil
    await imc.getByRole("button", { name: "Editar altura" }).click();
    await imc.getByRole("textbox", { name: "altura em cm" }).fill("185");
    await imc.getByRole("button", { name: "Salvar" }).click();
    await expect.poll(async () => {
      const perfis = await lerDoMock<{ altura_cm: number }>(sessao, "profiles");
      return perfis[0]?.altura_cm;
    }).toBe(185);
  });

  test("Preferências tem tudo da §14.4 e grava", async ({ page }) => {
    const sessao = await usuarioComPerfil();
    await abrir(page);
    await irNaAba(page, "Mais");
    await page.getByRole("link", { name: /Preferências/ }).click();

    await expect(page.getByLabel("Meta semanal")).toBeVisible();
    await expect(page.getByLabel("Preparação (s)")).toBeVisible();
    await expect(page.getByLabel("Descanso padrão (s)")).toBeVisible();
    for (const nome of [
      "Avançar sozinho",
      "Som no fim do descanso",
      "Vibração",
      "Voz no cardio",
      "Manter a tela acesa",
      "Mostrar raios de dificuldade",
    ]) {
      await expect(page.getByLabel(nome)).toBeVisible();
    }
    await expect(page.getByText("Exercícios marcados como")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver os créditos" })).toHaveAttribute(
      "href",
      "/mais/creditos",
    );

    await page.getByLabel("Descanso padrão (s)").fill("75");
    await page.getByRole("button", { name: "Salvar descanso padrão" }).click();
    await expect.poll(async () => {
      const perfis = await lerDoMock<{ prefs: Record<string, unknown> }>(
        sessao,
        "profiles",
      );
      return perfis[0]?.prefs?.descanso_padrao_s;
    }).toBe(75);
  });
});
