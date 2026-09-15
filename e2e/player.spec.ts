/**
 * O player unificado e a ficha em folha (SPEC §14.1, §14.2 e os critérios
 * §14.5 1–4), num Chromium de 360 × 740 contra o mock do Supabase.
 *
 * O relógio do navegador fica **parado** (`fixarData`): as contagens do player
 * são ancoradas em `Date.now()`, então parar o relógio congela o descanso e a
 * preparação — é o que deixa estes testes assertarem o número exato.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  comecarNoPlayer,
  entrarNoApp,
  esperarAbaTreino,
  esperarServiceWorker,
  fixarData,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

/** 14/09/2026 é a segunda-feira que abre o programa: Treino A (SPEC §5). */
const SEGUNDA = "2026-09-14T08:00:00-03:00";

/** 1 × 1 px transparente: a miniatura do YouTube sem sair para a internet. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

interface LinhaSerie {
  exercise_id: string;
  set_index: number;
  tipo: string;
  reps: number | null;
  carga_kg: number | null;
  tempo_s: number | null;
  concluida: boolean;
  ultima_firme: boolean | null;
}

test.beforeEach(async () => {
  await resetarMock();
});

/** Entra, começa o Treino A e passa da preparação para o 1º exercício. */
async function abrirPlayer(page: Page): Promise<SessaoMock> {
  const sessao = await usuarioComPerfil();
  await fixarData(page, SEGUNDA);
  await entrarNoApp(page);
  await page.getByRole("link", { name: "Começar treino" }).click();
  await page.getByRole("button", { name: "Começar Treino A" }).click();
  await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("timer", { name: "Preparação" })).toBeVisible();
  await comecarNoPlayer(page);
  await expect(page.getByRole("button", { name: "Concluir a série" })).toBeVisible();
  return sessao;
}

/** ✓ na série atual e pula o descanso que vem logo depois. */
async function concluirSerie(page: Page) {
  await page.getByRole("button", { name: "Concluir a série" }).click();
  const pular = page.getByRole("button", { name: "Pular" });
  if (await pular.isVisible().catch(() => false)) await pular.click();
}

/**
 * Anda pelo player (seta "próximo", pulando descansos) até `alvo` aparecer.
 * Para sozinho quando não há mais para onde ir — o feedback e a conclusão não
 * têm seta.
 */
async function irAte(page: Page, alvo: ReturnType<Page["getByText"]>) {
  for (let i = 0; i < 40; i++) {
    if (await alvo.isVisible().catch(() => false)) return;
    const pular = page.getByRole("button", { name: "Pular" });
    if (await pular.isVisible().catch(() => false)) {
      await pular.click();
      continue;
    }
    // a pergunta "firme?" sai pelo "Continuar", não pela seta
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

test.describe("preparação → exercício → descanso (SPEC §14.1.1–3)", () => {
  test("a preparação anuncia o 1º exercício e o ✓ abre o descanso com o próximo", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil();
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await page.getByRole("link", { name: "Começar treino" }).click();
    await page.getByRole("button", { name: "Começar Treino A" }).click();

    // 1. preparação: contagem de 10 s (prefs.preparacao_s) e o nome do 1º
    await expect(page.getByText("Preparado para começar")).toBeVisible();
    await expect(page.getByRole("timer", { name: "Preparação" })).toHaveText("10");
    await expect(
      page.getByRole("heading", { name: "Agachamento livre" }),
    ).toBeVisible();
    await semRolagemHorizontal(page);

    await page.getByRole("button", { name: "Começar agora" }).click();

    // 2. exercício: aquecimento 1 de 2, carga e reps em números grandes
    await expect(page.getByText("Aquecimento 1 de 2 · exercício 1 de 6")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "repetições" })).toHaveValue("5");
    await expect(page.getByRole("textbox", { name: "carga na barra" })).toHaveValue(
      "7,5",
    );
    await semRolagemHorizontal(page);

    // 3. o ✓ grava e abre o descanso em tela cheia com o próximo passo
    await page.getByRole("button", { name: "Concluir a série" }).click();
    const descanso = page.getByRole("timer", { name: "Descanso" });
    await expect(descanso).toHaveText("2:30");
    await expect(page.getByText("Aquecimento 2 de 2")).toBeVisible();
    await expect(page.getByText("Agachamento livre")).toBeVisible();

    // +20 s empurra o fim; editar o tempo recomeça a contagem
    await page.getByRole("button", { name: "20 s" }).click();
    await expect(descanso).toHaveText("2:50");
    await page.getByRole("button", { name: "Editar tempo de descanso" }).click();
    await page
      .getByRole("textbox", { name: "tempo de descanso em segundos" })
      .fill("45");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(descanso).toHaveText("0:45");

    await page.getByRole("button", { name: "Pular" }).click();
    await expect(page.getByText("Aquecimento 2 de 2 · exercício 1 de 6")).toBeVisible();

    // a série do aquecimento já subiu para o banco (§8)
    await expect
      .poll(async () => (await lerDoMock<LinhaSerie>(sessao, "session_sets")).length)
      .toBe(1);
  });

  test("fechar e reabrir no meio do descanso volta ao mesmo passo (§14.5.2)", async ({
    page,
  }) => {
    await abrirPlayer(page);
    await page.getByRole("button", { name: "Concluir a série" }).click();
    await expect(page.getByRole("timer", { name: "Descanso" })).toHaveText("2:30");

    await page.waitForTimeout(500);
    await page.reload();

    // o passo vive no Dexie: volta o MESMO descanso, com o mesmo próximo
    await expect(page.getByRole("timer", { name: "Descanso" })).toHaveText("2:30");
    await expect(page.getByText("Aquecimento 2 de 2")).toBeVisible();
    await page.getByRole("button", { name: "Pular" }).click();
    await expect(page.getByText("Aquecimento 2 de 2 · exercício 1 de 6")).toBeVisible();
  });

  test("sem rede o player continua registrando e a fila sobe depois (§14.5.2)", async ({
    page,
    context,
  }) => {
    const sessao = await abrirPlayer(page);
    await concluirSerie(page);
    await expect
      .poll(async () => (await lerDoMock<LinhaSerie>(sessao, "session_sets")).length)
      .toBe(1);

    // "o app instalado": sem o service worker no controle, recarregar sem rede
    // morre em ERR_INTERNET_DISCONNECTED antes de chegar ao app
    await esperarServiceWorker(page);
    await context.setOffline(true);
    await concluirSerie(page);
    await concluirSerie(page);
    // nada chegou ao banco enquanto não havia rede
    expect(await lerDoMock<LinhaSerie>(sessao, "session_sets")).toHaveLength(1);

    // e nada se perdeu: recarregar sem rede volta ao passo certo
    // (o IndexedDB grava ~60 ms depois do toque, SPEC §8)
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByText("Série 2 de 3 · exercício 1 de 6")).toBeVisible();

    await context.setOffline(false);
    await expect
      .poll(
        async () => (await lerDoMock<LinhaSerie>(sessao, "session_sets")).length,
        { timeout: 15_000 },
      )
      .toBe(3);
  });
});

test.describe("o Treino A inteiro pelo player (SPEC §14.5.1 e §14.5.2)", () => {
  test("3 séries do agachamento, 'firme?', feedback e a subida no resumo", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const sessao = await abrirPlayer(page);

    // os dois aquecimentos e as três séries de trabalho, todas no topo (3 × 5)
    for (let i = 0; i < 5; i++) await concluirSerie(page);

    // a pergunta do fim do exercício (SPEC §14.1.2)
    const firme = page.getByRole("radiogroup", { name: "Última repetição" });
    await expect(firme).toBeVisible();
    await expect(page.getByText("Última repetição saiu firme?")).toBeVisible();
    await firme.getByRole("radio", { name: "Firme" }).click();

    // as três séries de trabalho do agachamento estão gravadas
    await expect
      .poll(async () =>
        (await lerDoMock<LinhaSerie>(sessao, "session_sets")).filter(
          (s) => s.exercise_id === "agachamento-livre" && s.tipo === "trabalho",
        ).length,
      )
      .toBe(3);
    const trabalho = (await lerDoMock<LinhaSerie>(sessao, "session_sets")).filter(
      (s) => s.tipo === "trabalho",
    );
    expect(trabalho.every((s) => s.reps === 5 && s.carga_kg === 7.5)).toBe(true);

    // as setas levam até o fim do treino
    const sensacao = page.getByRole("radiogroup", { name: "Sensação" });
    await irAte(page, sensacao);

    // 4. feedback (SPEC §14.1.4): 1 = muito difícil … 5 = muito fácil
    await expect(page.getByText("O que você achou do treino de hoje?")).toBeVisible();
    await sensacao.getByRole("radio", { name: "Um pouco fácil" }).click();
    await semRolagemHorizontal(page);
    await page.getByRole("button", { name: "Concluído" }).click();

    // 5. conclusão: capa, contadores e o resumo do motor com a subida
    const fim = page.getByRole("region", { name: "Treino concluído" });
    await expect(fim.getByText("Excelente! Você concluiu o treino.")).toBeVisible();
    await expect(fim.getByText("Exercícios")).toBeVisible();
    await expect(fim.getByText("Volume")).toBeVisible();
    // 3 × 5 × 7,5 kg = 112,5
    await expect(fim.getByText("112,5")).toBeVisible();

    const linha = fim
      .getByRole("list", { name: "Resumo por exercício" })
      .getByRole("listitem")
      .filter({ hasText: "Agachamento livre" });
    await expect(linha).toContainText("↑");
    await expect(linha).toContainText("7,5 → 11,5 kg na barra");
    // o card da semana e o IMC (SPEC §14.1.5)
    await expect(fim.getByRole("region", { name: "Semana e meta" })).toBeVisible();
    await expect(fim.getByRole("region", { name: "IMC" })).toBeVisible();
    await semRolagemHorizontal(page);

    await fim.getByRole("button", { name: "Próximo" }).click();
    await esperarAbaTreino(page);

    // o motor gravou a decisão inteira (§6.6 e §8)
    await expect
      .poll(
        async () =>
          (await lerDoMock<{ ultimo_treino: string | null }>(sessao, "profiles"))[0]
            ?.ultimo_treino,
        { timeout: 15_000 },
      )
      .toBe("A1");
    const estados = await lerDoMock<{ exercise_id: string; carga_atual_kg: number }>(
      sessao,
      "exercise_state",
    );
    expect(estados.find((e) => e.exercise_id === "agachamento-livre")).toMatchObject({
      carga_atual_kg: 11.5,
    });
    const [treino] = await lerDoMock<{ status: string; sensacao: number | null }>(
      sessao,
      "sessions",
    );
    expect(treino).toMatchObject({ status: "concluida", sensacao: 4 });

    /*
     * A conclusão reenvia as séries com o valor final de `ultima_firme` — as
     * primeiras subiram com o padrão calculado (§3.2), antes de a pergunta
     * existir.
     */
    const depois = (await lerDoMock<LinhaSerie>(sessao, "session_sets")).filter(
      (s) => s.exercise_id === "agachamento-livre" && s.tipo === "trabalho",
    );
    expect(depois.every((s) => s.ultima_firme === true)).toBe(true);
  });
});

test.describe("circuito de core: reps e tempo (SPEC §14.5.3)", () => {
  test("o passo por reps tem ×N e o de tempo tem contagem regressiva", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const sessao = await usuarioComPerfil({
      fase_atual: "fase2",
      fase_desde: "2026-06-01",
    });
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await page.goto("/treinar");
    await page.getByRole("button", { name: "Começar Inferior A" }).click();
    await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
    await comecarNoPlayer(page);

    // até a elevação de pernas (peso do corpo, por repetições)
    // o alvo é o passo do exercício (a tela de descanso também mostra o nome)
    await irAte(page, page.getByText("· exercício 5 de 6"));
    await expect(
      page.getByRole("heading", { name: "Elevação de pernas na barra fixa" }),
    ).toBeVisible();
    // peso do corpo: só repetições, sem carga
    await expect(page.getByRole("textbox", { name: "repetições" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^carga/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Aumentar repetições" }).click();
    await concluirSerie(page);

    // a prancha: contagem regressiva com Começar/Pausar (SPEC §14.1.2)
    await irAte(page, page.getByText("· exercício 6 de 6"));
    await expect(page.getByRole("heading", { name: "Prancha" })).toBeVisible();
    const contagem = page.getByRole("timer", { name: "Contagem do exercício" });
    await expect(contagem).toHaveText("1:00");
    await expect(page.getByRole("button", { name: "Começar" })).toBeVisible();
    await page.getByRole("button", { name: "Concluir a série" }).click();

    await expect
      .poll(async () =>
        (await lerDoMock<LinhaSerie>(sessao, "session_sets")).find(
          (s) => s.exercise_id === "prancha",
        )?.tempo_s,
      )
      .toBe(60);
    const elevacao = (await lerDoMock<LinhaSerie>(sessao, "session_sets")).find(
      (s) => s.exercise_id === "elevacao-de-pernas-na-barra-fixa",
    );
    // peso do corpo: repetições registradas, sem carga (o + subiu de 15 para 16)
    expect(elevacao).toMatchObject({ concluida: true, reps: 16 });
    await semRolagemHorizontal(page);
  });
});

test.describe("ficha em folha (SPEC §14.2 e §14.5.4)", () => {
  test("as três abas, o Tutorial só ao tocar e o stepper só da sessão", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // a miniatura é servida daqui: nenhum teste sai para a internet
    await page.route(/i\.ytimg\.com/, (rota) =>
      rota.fulfill({ contentType: "image/png", body: PNG }),
    );
    let pediuEmbed = 0;
    await page.route(/youtube-nocookie\.com/, (rota) => {
      pediuEmbed += 1;
      return rota.abort();
    });

    await abrirPlayer(page);
    await page.getByRole("button", { name: "Como fazer: Agachamento livre" }).click();

    const ficha = page.getByRole("dialog");
    await expect(ficha.getByRole("tab", { name: "Vídeo" })).toBeVisible();
    await expect(
      ficha.getByRole("img", { name: "Execução do Agachamento livre" }),
    ).toBeVisible();

    // Músculos: o mapa frente/costas e a área de foco em chips
    await ficha.getByRole("tab", { name: "Músculos" }).click();
    await expect(ficha.getByRole("img", { name: "Frente" })).toBeVisible();
    await expect(ficha.getByRole("list", { name: "Área de foco" })).toContainText(
      "Quadríceps",
    );

    // Tutorial: miniatura + play; o YouTube só entra ao tocar
    await ficha.getByRole("tab", { name: "Tutorial" }).click();
    await expect(ficha.locator("[data-tutorial=miniatura]")).toBeVisible();
    await expect(ficha.locator("[data-tutorial=miniatura] img")).toHaveAttribute(
      "src",
      /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/hqdefault\.jpg$/,
    );
    // antes do toque o YouTube não é chamado (SPEC §14.2)
    await expect(ficha.locator("[data-tutorial=embed]")).toHaveCount(0);
    expect(pediuEmbed).toBe(0);
    await ficha.locator("[data-tutorial=miniatura]").click();
    const embed = ficha.locator("[data-tutorial=embed]");
    await expect(embed).toHaveCount(1);
    await expect(embed).toHaveAttribute(
      "src",
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}/,
    );
    await expect(embed).toHaveAttribute("allow", /autoplay/);
    await expect.poll(() => pediuEmbed).toBeGreaterThan(0);

    // o stepper muda SÓ a prescrição desta sessão
    await ficha.getByRole("button", { name: "Aumentar Repetições" }).click();
    await expect(ficha.getByRole("textbox", { name: "Repetições" })).toHaveValue("6");
    await ficha.getByRole("button", { name: "Aumentar Séries" }).click();
    await expect(ficha.getByRole("textbox", { name: "Séries" })).toHaveValue("4");
    await ficha.getByRole("button", { name: "Fechar" }).first().click();

    // o passo do player já nasce com a prescrição nova
    await page.getByRole("button", { name: "Próximo passo" }).click();
    await page.getByRole("button", { name: "Próximo passo" }).click();
    await expect(page.getByText("Série 1 de 4 · exercício 1 de 6")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "repetições" })).toHaveValue("6");
    await semRolagemHorizontal(page);
  });

  test("sem rede o Tutorial some e sobra o link do YouTube", async ({ page }) => {
    await page.route(/i\.ytimg\.com/, (rota) => rota.abort("connectionfailed"));
    await abrirPlayer(page);
    await page.getByRole("button", { name: "Como fazer: Agachamento livre" }).click();

    const ficha = page.getByRole("dialog");
    await ficha.getByRole("tab", { name: "Tutorial" }).click();
    await expect(ficha.locator("[data-tutorial=sem-rede]")).toBeVisible();
    await expect(ficha.getByText("Precisa de internet")).toBeVisible();
    await expect(ficha.getByRole("link", { name: "Abrir no YouTube" })).toHaveAttribute(
      "href",
      /^https:\/\/www\.youtube\.com\/watch\?v=/,
    );
    await expect(ficha.locator("[data-tutorial=embed]")).toHaveCount(0);
  });
});

test.describe("visão geral e gostei/não gosto (SPEC §14.1.2)", () => {
  test("o ícone de lista abre a folha com todas as séries e volta ao player", async ({
    page,
  }) => {
    await abrirPlayer(page);
    await page.getByRole("button", { name: "Visão geral do treino" }).click();

    await expect(page.getByRole("heading", { name: "Treino A", level: 1 })).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Série 1 — Agachamento livre" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "6. Elevação de pernas na barra fixa" }),
    ).toBeVisible();
    await semRolagemHorizontal(page);

    await page.getByRole("button", { name: "Voltar ao treino" }).click();
    await expect(page.getByRole("button", { name: "Concluir a série" })).toBeVisible();
  });

  test('"não gosto" marca a preferência e joga o exercício para o fim', async ({
    page,
  }) => {
    const sessao = await abrirPlayer(page);
    await page.getByRole("button", { name: "Não gosto deste exercício" }).click();
    await expect
      .poll(
        async () =>
          (
            await lerDoMock<{ prefs: { evitar_exercicios?: string[] } }>(
              sessao,
              "profiles",
            )
          )[0]?.prefs.evitar_exercicios,
        { timeout: 10_000 },
      )
      .toEqual(["agachamento-livre"]);

    // no catálogo ele cai para o fim da lista, com a etiqueta (SPEC §14.1.2)
    await page.goto("/exercicios");
    const item = page.getByRole("link", { name: /Agachamento livre/ });
    await expect(item.first()).toContainText("você marcou como evitar");
    const todos = page.locator("main ul > li");
    await expect(todos.last()).toContainText("Agachamento livre");

    // e o "gostei" desfaz
    await page.goBack();
    await page.getByRole("button", { name: "Gostei deste exercício" }).click();
    await expect
      .poll(
        async () =>
          (
            await lerDoMock<{ prefs: { evitar_exercicios?: string[] } }>(
              sessao,
              "profiles",
            )
          )[0]?.prefs.evitar_exercicios,
        { timeout: 10_000 },
      )
      .toEqual([]);
  });
});
