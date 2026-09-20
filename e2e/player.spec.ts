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
  comecarOTreinoDoDia,
  entrarNoApp,
  esperarAbaTreino,
  esperarServiceWorker,
  fixarData,
  inserirNoMock,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  type SessaoMock,
  usuarioComPerfil,
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
  await comecarOTreinoDoDia(page);
  await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("timer", { name: "Preparação" })).toBeVisible();
  await comecarNoPlayer(page);
  await expect(page.getByRole("button", { name: "Concluir série" })).toBeVisible();
  return sessao;
}

/** ✓ na série atual e pula o descanso que vem logo depois. */
async function concluirSerie(page: Page) {
  await page.getByRole("button", { name: "Concluir série" }).click();
  const pular = page.getByRole("button", { name: "Pular descanso" });
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
    const pular = page.getByRole("button", { name: "Pular descanso" });
    if (await pular.isVisible().catch(() => false)) {
      await pular.click();
      continue;
    }
    // a pergunta "firme?" sai pelo primário dela, não pela seta — e ele se
    // chama "Pular esta pergunta" enquanto ninguém responde (§22.5 item 4)
    const pergunta = page.getByRole("button", {
      name: /^(Pular esta pergunta|Continuar|Concluir sem responder|Concluído)$/,
    });
    if (await pergunta.first().isVisible().catch(() => false)) {
      await pergunta.first().click();
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
    await comecarOTreinoDoDia(page);

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
    await page.getByRole("button", { name: "Concluir série" }).click();
    const descanso = page.getByRole("timer", { name: "Descanso" });
    await expect(descanso).toHaveText("2:30");
    await expect(page.getByText("Aquecimento 2 de 2")).toBeVisible();
    await expect(page.getByText("Agachamento livre")).toBeVisible();

    // +20 s empurra o fim e −20 s o puxa de volta (SPEC §22.5 item 7);
    // editar o tempo recomeça a contagem
    await page.getByRole("button", { name: "Somar 20 segundos ao descanso" }).click();
    await expect(descanso).toHaveText("2:50");
    await page.getByRole("button", { name: "Tirar 20 segundos do descanso" }).click();
    await expect(descanso).toHaveText("2:30");
    await page.getByRole("button", { name: "Editar tempo de descanso" }).click();
    await page
      .getByRole("textbox", { name: "tempo de descanso em segundos" })
      .fill("45");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(descanso).toHaveText("0:45");

    await page.getByRole("button", { name: "Pular descanso" }).click();
    await expect(page.getByText("Aquecimento 2 de 2 · exercício 1 de 6")).toBeVisible();

    // a série do aquecimento já subiu para o banco (§8)
    await expect
      .poll(async () => (await lerDoMock<LinhaSerie>(sessao, "session_sets")).length)
      .toBe(1);
  });

  /*
   * Aqui o relógio é instalado (`clock.install`) em vez de só fixado: `runFor`
   * empurra o tempo do navegador, que é a única forma de ver o descanso zerar
   * e a preferência "avançar sozinho" agir sem esperar de verdade.
   *
   * Regressão guardada: `aoPular` nasce de novo a cada renderização do player
   * (e ele redesenha a cada 250 ms enquanto conta). Com ele na lista de
   * dependências do efeito, o `setTimeout` de 1 s era cancelado e recriado
   * antes de disparar — a tela nunca avançava sozinha.
   */
  test("ao zerar, 'avançar sozinho' passa ao próximo passo; desligado, espera (§14.1.3)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const sessao = await usuarioComPerfil({
      prefs: { preparacao_s: 0, descanso_padrao_s: 20, avancar_sozinho: true },
    });
    await page.clock.install({ time: new Date(SEGUNDA) });
    await entrarNoApp(page);
    await page.goto("/treinar");
    await page.getByRole("button", { name: "Começar Treino A" }).click();
    await expect(page).toHaveURL(/\/treinar\/[0-9a-f-]{36}$/);

    // preparacao_s = 0: sem tela de preparação, o player abre no exercício
    await expect(page.getByRole("button", { name: "Concluir série" })).toBeVisible();
    await expect(page.getByRole("timer", { name: "Preparação" })).toHaveCount(0);

    const descanso = page.getByRole("timer", { name: "Descanso" });
    await page.getByRole("button", { name: "Concluir série" }).click();
    await expect(descanso).toHaveText("0:20");
    // ninguém toca em nada: a tela sai sozinha e o próximo passo aparece
    await page.clock.runFor(22_000);
    await expect(descanso).toBeHidden();
    await expect(page.getByText("Aquecimento 2 de 2 · exercício 1 de 6")).toBeVisible();

    // desligado, o descanso fica em 0:00 esperando o toque
    await page.goto("/mais/preferencias");
    await page.getByRole("switch", { name: "Avançar sozinho" }).click();
    await expect(page.getByRole("switch", { name: "Avançar sozinho" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    /*
     * A preferência sobe pela FILA (§8): enquanto ela não chega ao servidor, o
     * player remontado pode reler o perfil ANTIGO e voltar a avançar sozinho.
     * Esperar a linha no mock tira a corrida sem afrouxar nada — o que o teste
     * prova continua sendo o player obedecendo ao interruptor.
     */
    await expect
      .poll(
        async () =>
          (
            await lerDoMock<{ prefs: { avancar_sozinho?: boolean } }>(
              sessao,
              "profiles",
            )
          )[0]?.prefs.avancar_sozinho,
        { timeout: 15_000 },
      )
      .toBe(false);
    await page.goBack();
    await page.getByRole("button", { name: "Concluir série" }).click();
    await expect(descanso).toHaveText("0:20");
    await page.clock.runFor(25_000);
    await expect(descanso).toHaveText("0:00");
    await expect(descanso).toBeVisible();
    await page.getByRole("button", { name: "Pular descanso" }).click();
    await expect(page.getByRole("button", { name: "Concluir série" })).toBeVisible();
  });

  /*
   * O "Editar tempo de descanso" abre componentes do tema NORMAL (fundo
   * `--background`) dentro da tela de descanso, que pinta o texto de
   * `--descanso-texto`. No tema claro isso era branco sobre quase-branco e o
   * número do tempo sumia. Aqui a conta de contraste da WCAG é feita com as
   * cores que o navegador realmente aplicou, nos dois temas.
   */
  for (const tema of ["dark", "light"] as const) {
    test(`o campo do "Editar tempo de descanso" é legível no tema ${tema} (§14.1.3)`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: tema });
      await abrirPlayer(page);
      await page.getByRole("button", { name: "Concluir série" }).click();
      await expect(page.getByRole("timer", { name: "Descanso" })).toBeVisible();
      await page.getByRole("button", { name: "Editar tempo de descanso" }).click();

      const campo = page.getByRole("textbox", { name: /tempo de descanso/ });
      await expect(campo).toBeVisible();
      const razao = await campo.evaluate((el) => {
        const cor = (v: string) => {
          const [r = 0, g = 0, b = 0] = (v.match(/\d+(\.\d+)?/g) ?? []).map(Number);
          const lin = (c: number) => {
            const n = c / 255;
            return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        };
        const s = getComputedStyle(el);
        const a = cor(s.color);
        const b = cor(s.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(razao, `contraste do campo no tema ${tema}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  test("fechar e reabrir no meio do descanso volta ao mesmo passo (§14.5.2)", async ({
    page,
  }) => {
    await abrirPlayer(page);
    await page.getByRole("button", { name: "Concluir série" }).click();
    await expect(page.getByRole("timer", { name: "Descanso" })).toHaveText("2:30");

    await page.waitForTimeout(500);
    await page.reload();

    // o passo vive no Dexie: volta o MESMO descanso, com o mesmo próximo
    await expect(page.getByRole("timer", { name: "Descanso" })).toHaveText("2:30");
    await expect(page.getByText("Aquecimento 2 de 2")).toBeVisible();
    await page.getByRole("button", { name: "Pular descanso" }).click();
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

test.describe("o peso do dia na conclusão (SPEC §14.1.5)", () => {
  /** Do 1º exercício até a tela de conclusão, com a sessão já aberta. */
  async function irAteAConclusao(page: Page) {
    for (let i = 0; i < 5; i++) await concluirSerie(page);
    await page
      .getByRole("radiogroup", { name: "Última repetição" })
      .getByRole("radio", { name: "Firme" })
      .click();
    const sensacao = page.getByRole("radiogroup", { name: "Sensação" });
    await irAte(page, sensacao);
    await sensacao.getByRole("radio", { name: "Na medida certa" }).click();
    await page.getByRole("button", { name: "Concluído" }).click();
  }

  /*
   * SPEC §22.1: o convite "Registrar o peso de hoje" voltava a cada vez que a
   * conclusão era fechada e reaberta — e voltava mesmo com a pesagem do dia já
   * gravada, pedindo de novo o que já estava no banco.
   */
  test("com a pesagem de hoje no banco, mostra o número em vez de pedir de novo", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const sessao = await usuarioComPerfil();
    await inserirNoMock(sessao, "body_weights", [
      { user_id: sessao.userId, data: "2026-09-14", peso_kg: 82.4 },
    ]);
    await fixarData(page, SEGUNDA);
    await entrarNoApp(page);
    await comecarOTreinoDoDia(page);
    await comecarNoPlayer(page);
    await irAteAConclusao(page);

    const fim = page.getByRole("region", { name: "Treino concluído" });
    await expect(fim.getByText("Peso de hoje: 82,4 kg")).toBeVisible();
    await expect(
      fim.getByRole("button", { name: "Registrar o peso de hoje" }),
    ).toHaveCount(0);

    /*
     * SPEC §22.5 item 2: a sessão é gravada ao ENTRAR aqui, então não há mais
     * "Voltar ao treino" para fechar e reabrir a conclusão — voltar rodaria o
     * motor duas vezes. O que a §22.1 protegia continua valendo: o convite
     * não volta enquanto a tela vive.
     */
    await expect(fim.getByRole("button", { name: "Voltar ao treino" })).toHaveCount(0);
    await expect(fim.getByText(/Treino salvo/)).toBeVisible();

    // "Corrigir" abre o campo já com o valor de hoje
    await fim.getByRole("button", { name: "Corrigir" }).click();
    await expect(fim.getByRole("textbox", { name: "peso de hoje em kg" })).toHaveValue(
      "82,4",
    );
  });

  /*
   * O toque no "Próximo" se perdia: o campo só confirmava no `onBlur`, o card
   * de IMC crescia 94 px entre o apertar e o soltar e o clique nunca chegava
   * ao botão — a sessão ficava aberta, sem a decisão do motor e sem o peso.
   */
  test("digitar o peso e tocar UMA vez conclui, grava o peso e o body_weights", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const sessao = await abrirPlayer(page);

    // os dois aquecimentos e as três séries de trabalho do 1º exercício
    for (let i = 0; i < 5; i++) await concluirSerie(page);
    await page
      .getByRole("radiogroup", { name: "Última repetição" })
      .getByRole("radio", { name: "Firme" })
      .click();

    const sensacao = page.getByRole("radiogroup", { name: "Sensação" });
    await irAte(page, sensacao);
    await sensacao.getByRole("radio", { name: "Na medida certa" }).click();
    await page.getByRole("button", { name: "Concluído" }).click();

    const fim = page.getByRole("region", { name: "Treino concluído" });
    await expect(fim.getByText("Excelente! Você concluiu o treino.")).toBeVisible();

    await fim.getByRole("button", { name: "Registrar o peso de hoje" }).click();
    const campo = fim.getByRole("textbox", { name: "peso de hoje em kg" });
    await campo.fill("82,4");

    // UM toque só: nada de blur antes, nada de segunda tentativa
    await fim.getByRole("button", { name: "Próximo" }).click();
    await esperarAbaTreino(page);

    await expect
      .poll(
        async () =>
          (
            await lerDoMock<{ status: string; peso_corporal: number | null }>(
              sessao,
              "sessions",
            )
          )[0],
        { timeout: 15_000 },
      )
      .toMatchObject({ status: "concluida", peso_corporal: 82.4 });

    await expect
      .poll(async () => (await lerDoMock(sessao, "body_weights")).length, {
        timeout: 15_000,
      })
      .toBe(1);
    const [peso] = await lerDoMock<{ peso_kg: number }>(sessao, "body_weights");
    expect(peso?.peso_kg).toBe(82.4);

    // e o motor decidiu, como no caminho sem peso
    const estados = await lerDoMock<{ exercise_id: string }>(sessao, "exercise_state");
    expect(estados.length).toBeGreaterThan(0);
    const eventos = await lerDoMock(sessao, "progression_events");
    expect(eventos.length).toBeGreaterThan(0);
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

    /*
     * Até a elevação de pernas (peso do corpo, por repetições). O alvo é o
     * `h1` só-leitor do player (SPEC §22.5 item 10): a tela de descanso mostra
     * o nome do próximo e, desde a §22.5, também "· exercício 5 de 6" — só o
     * `h1` existe apenas no passo do exercício.
     */
    await irAte(page, page.getByRole("heading", { level: 1, name: /exercício 5 de 6/ }));
    await expect(
      page.getByRole("heading", { name: "Elevação de pernas na barra fixa" }),
    ).toBeVisible();
    // peso do corpo: só repetições, sem carga
    await expect(page.getByRole("textbox", { name: "repetições" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^carga/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Aumentar repetições" }).click();
    await concluirSerie(page);

    // a prancha: contagem regressiva com Começar/Pausar (SPEC §14.1.2)
    await irAte(page, page.getByRole("heading", { level: 1, name: /exercício 6 de 6/ }));
    await expect(page.getByRole("heading", { name: "Prancha" })).toBeVisible();
    const contagem = page.getByRole("timer", { name: "Contagem do exercício" });
    await expect(contagem).toHaveText("1:00");
    await expect(page.getByRole("button", { name: "Começar" })).toBeVisible();
    await page.getByRole("button", { name: "Concluir série" }).click();

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
  /*
   * Sem service worker NESTES testes, e só neles. O `page.route` do Playwright
   * não alcança o que o service worker busca: assim que o Serwist assume a
   * página (`clientsClaim`), a miniatura do YouTube passa a ser um `fetch` do
   * worker, a rota falsa nunca é chamada (medido: 0 chamadas) e o pedido sai
   * para a internet de verdade — que não existe aqui. O `onError` do `<img>`
   * então troca a miniatura pelo aviso "Precisa de internet" no meio do teste
   * e o toque cai num elemento que saiu do DOM. Como o worker assume num
   * momento que depende da carga da máquina, o teste passava sozinho e caía na
   * suíte inteira. O que se verifica aqui é o comportamento da FICHA (as três
   * abas, o embed só ao tocar, o stepper da sessão), não o do service worker
   * — que tem os seus próprios testes em `e2e/pwa.spec.ts`.
   */
  test.use({ serviceWorkers: "block" });

  test("as três abas, o Tutorial só ao tocar e o stepper só da sessão", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // a miniatura é servida daqui: nenhum teste sai para a internet
    let serviuMiniatura = 0;
    await page.route(/i\.ytimg\.com/, (rota) => {
      serviuMiniatura += 1;
      return rota.fulfill({ contentType: "image/png", body: PNG });
    });
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
    // a miniatura veio da rota falsa: se sair para a internet, o `onError` do
    // `<img>` troca tudo por "Precisa de internet" e o toque abaixo some
    await expect.poll(() => serviuMiniatura).toBeGreaterThan(0);
    await expect(ficha.locator("[data-tutorial=sem-rede]")).toHaveCount(0);
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
    await expect(page.getByRole("button", { name: "Concluir série" })).toBeVisible();
  });

  test('"não gosto" marca a preferência e joga o exercício para o fim', async ({
    page,
  }) => {
    const sessao = await abrirPlayer(page);
    const gostei = page.getByRole("button", { name: "Gostei deste exercício" });
    const naoGosto = page.getByRole("button", { name: "Não gosto deste exercício" });

    /*
     * SPEC §22.1: sem voto nenhum, nenhum dos dois polegares pode afirmar um
     * estado — o "gostei" vinha desenhado como pressionado, dizendo por escrito
     * (`aria-pressed="true"`) uma escolha que o usuário nunca fez.
     */
    await expect(gostei).not.toHaveAttribute("aria-pressed", "true");
    await expect(gostei).not.toHaveAttribute("aria-pressed", "false");
    await expect(naoGosto).not.toHaveAttribute("aria-pressed", "true");

    await naoGosto.click();
    await expect(naoGosto).toHaveAttribute("aria-pressed", "true");
    await expect(gostei).toHaveAttribute("aria-pressed", "false");
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

    // e o "gostei" desfaz — e passa a valer como voto próprio (§22.1)
    await page.goBack();
    await page.getByRole("button", { name: "Gostei deste exercício" }).click();
    await expect
      .poll(
        async () =>
          (
            await lerDoMock<{
              prefs: { evitar_exercicios?: string[]; preferidos?: string[] };
            }>(sessao, "profiles")
          )[0]?.prefs,
        { timeout: 10_000 },
      )
      .toMatchObject({ evitar_exercicios: [], preferidos: ["agachamento-livre"] });
    await expect(
      page.getByRole("button", { name: "Gostei deste exercício" }),
    ).toHaveAttribute("aria-pressed", "true");

    // tocar de novo no polegar aceso desfaz o voto: volta a não haver escolha
    await page.getByRole("button", { name: "Gostei deste exercício" }).click();
    await expect
      .poll(
        async () =>
          (
            await lerDoMock<{ prefs: { preferidos?: string[] } }>(
              sessao,
              "profiles",
            )
          )[0]?.prefs.preferidos,
        { timeout: 10_000 },
      )
      .toEqual([]);
  });
});
