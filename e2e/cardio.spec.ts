import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import {
  entrarNoApp,
  esperarAbaTreino,
  inserirNoMock,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  usuarioComPerfil,
} from "./fixtures";

/** Terça 15/09/2026: o dia de corrida da semana 1 do plano (SPEC §5.2). */
const TERCA = "2026-09-15T08:00:00-03:00";
/** Quinta 17/09/2026: dia de descanso — o grease the groove da §3.4. */
const QUINTA = "2026-09-17T08:00:00-03:00";

/**
 * `page.clock.install` fixa a data e deixa `runFor` empurrar o tempo: é assim
 * que uma corrida de 34 min cabe num teste. O relógio continua andando junto
 * com o tempo real entre os `runFor` (e o Dexie precisa disso: com
 * `clock.pauseAt` o IndexedDB nunca responde e a tela fica no esqueleto), então
 * as asserções são sobre QUAL bloco está valendo, não sobre o segundo exato.
 */
async function abrir(page: Page, quando: string, rota?: string) {
  await page.clock.install({ time: new Date(quando) });
  await entrarNoApp(page);
  if (rota) await page.goto(rota);
}

/** O cartão grande do bloco atual (o resto da tela também diz "Corrida"). */
function blocoAtual(page: Page): Locator {
  return page.getByRole("region", { name: "Timer de intervalos" });
}

/**
 * Troca `navigator.vibrate` e `speechSynthesis` por espiões: o Chromium de
 * teste não vibra nem fala, e o que interessa é QUE o app avisou na troca.
 */
async function espiarAvisos(page: Page) {
  await page.addInitScript(() => {
    const janela = window as unknown as { __vibrou: unknown[]; __falou: string[] };
    janela.__vibrou = [];
    janela.__falou = [];
    navigator.vibrate = ((padrao: unknown) => {
      janela.__vibrou.push(padrao);
      return true;
    }) as Navigator["vibrate"];
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak(fala: { text: string; lang: string }) {
          janela.__falou.push(`${fala.lang}:${fala.text}`);
        },
      },
    });
  });
}

function avisos(page: Page) {
  return page.evaluate(() => {
    const janela = window as unknown as { __vibrou: unknown[]; __falou: string[] };
    return { vibrou: janela.__vibrou.length, falou: [...janela.__falou] };
  });
}

/** Outro celular: contexto novo, IndexedDB vazio, mesma conta. */
async function outroAparelho(browser: Browser, quando: string, url: string) {
  const contexto = await browser.newContext({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
  const pagina = await contexto.newPage();
  await pagina.clock.install({ time: new Date(quando) });
  await entrarNoApp(pagina);
  await pagina.goto(url);
  return { contexto, pagina };
}

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("Cardio — corrida (SPEC §3.3)", () => {
  test("da Hoje até o registro: 8 blocos de 1 min / 2 min, timer e cardio_sessions", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil({ semana_corrida: 1 });
    await abrir(page, TERCA);

    // o card da Hoje leva para a rota do TIPO, com a semana do plano
    const comecar = page.getByRole("link", { name: "Começar" });
    await expect(comecar).toHaveAttribute("href", "/cardio/corrida?semana=1");
    await comecar.click();

    await expect(page.getByRole("heading", { name: "Corrida · semana 1" })).toBeVisible();
    await expect(page.getByText("8 × (1 min corrida / 2 min caminhada)")).toBeVisible();

    // a lista do plano: aquecimento + 8 × (corrida + caminhada) + soltura
    const blocos = page
      .getByRole("list", { name: "Blocos da sessão" })
      .getByRole("listitem");
    await expect(blocos).toHaveCount(18);
    await expect(blocos.nth(0)).toContainText("Aquecimento");
    await expect(blocos.nth(0)).toContainText("5:00");
    await expect(blocos.nth(1)).toContainText("Corrida 1");
    await expect(blocos.nth(1)).toContainText("1:00");
    await expect(blocos.nth(2)).toContainText("Caminhada 1");
    await expect(blocos.nth(2)).toContainText("2:00");
    await expect(blocos.nth(17)).toContainText("Soltura");

    // nasce PARADA no aquecimento de 5 min (o relógio não anda sozinho)
    const timer = page.getByRole("timer");
    await expect(timer).toHaveText("5:00");
    await expect(page.getByText("faltam 34 min de sessão")).toBeVisible();
    await semRolagemHorizontal(page);

    await page.getByRole("button", { name: "Começar" }).click();

    // fim do aquecimento: entra o primeiro minuto de corrida
    await page.clock.runFor(5 * 60_000);
    await expect(page.getByText("bloco 1 de 8")).toBeVisible();
    await expect(blocoAtual(page)).toContainText("Corrida");
    await expect(blocoAtual(page)).toContainText("depois: Caminhada · 2:00");

    // corrida 1 acabou → caminhada de 2 min, ainda no bloco 1
    await page.clock.runFor(60_000);
    await expect(blocoAtual(page)).toContainText("Caminhada");
    await expect(page.getByText("bloco 1 de 8")).toBeVisible();

    // pausar congela o relógio: o mesmo número depois de meio minuto
    await page.getByRole("button", { name: "Pausar" }).click();
    const parado = await timer.textContent();
    await page.clock.runFor(30_000);
    await expect(timer).toHaveText(parado ?? "");
    await page.getByRole("button", { name: "Retomar" }).click();

    // pular o resto da caminhada leva ao bloco 2 de corrida
    await page.getByRole("button", { name: "Pular bloco" }).click();
    await expect(page.getByText("bloco 2 de 8")).toBeVisible();
    await expect(blocoAtual(page)).toContainText("Corrida");

    await page.getByRole("button", { name: "Encerrar e registrar" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("1 de 8 blocos")).toBeVisible();
    await dialogo.getByRole("radio", { name: /fácil/i }).click();
    await dialogo.getByRole("button", { name: "Salvar e voltar" }).click();

    await esperarAbaTreino(page);

    await expect
      .poll(async () => (await lerDoMock(sessao, "cardio_sessions")).length, {
        timeout: 10_000,
      })
      .toBe(1);
    const [linha] = await lerDoMock<{
      tipo: string;
      semana_plano: number;
      concluida: boolean;
      esforco: string;
      duracao_min: number;
      feito: { repeticoes_cumpridas: number; blocos_cumpridos: number };
      planejado: { repeticoes: number; total_s: number };
    }>(sessao, "cardio_sessions");

    expect(linha?.tipo).toBe("corrida");
    expect(linha?.semana_plano).toBe(1);
    expect(linha?.concluida).toBe(true);
    expect(linha?.esforco).toBe("facil");
    expect(linha?.planejado.repeticoes).toBe(8);
    expect(linha?.planejado.total_s).toBe(2040);
    // aquecimento + corrida 1 cumpridos; a caminhada foi pulada
    expect(linha?.feito.repeticoes_cumpridas).toBe(1);
    expect(linha?.feito.blocos_cumpridos).toBe(2);
    // 5 min de aquecimento + 1 min de corrida, mais o que a caminhada correu
    expect(Number(linha?.duracao_min)).toBeGreaterThanOrEqual(6);
    expect(Number(linha?.duracao_min)).toBeLessThan(10);
  });

  test("o timer sobrevive a recarregar a página (SPEC §8)", async ({ page }) => {
    await usuarioComPerfil({ semana_corrida: 1 });
    await abrir(page, TERCA, "/cardio/corrida");

    await page.getByRole("button", { name: "Começar" }).click();
    await page.clock.runFor(6 * 60_000); // aquecimento + 1 min de corrida
    await expect(blocoAtual(page)).toContainText("Caminhada");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Corrida · semana 1" })).toBeVisible();
    // o relógio continuou correndo: a caminhada do bloco 1 está valendo
    await expect(page.getByText("bloco 1 de 8")).toBeVisible();
    await expect(blocoAtual(page)).toContainText("Caminhada");
    await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();
  });

  test("duas corridas na semana civil avançam a semana do plano (§5.5)", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil({ semana_corrida: 1 });
    // a primeira sessão da semana já está registrada
    await inserirNoMock(sessao, "cardio_sessions", [
      {
        id: "33333333-3333-4333-8333-333333333333",
        data: "2026-09-14",
        tipo: "corrida",
        semana_plano: 1,
        concluida: true,
      },
    ]);

    await abrir(page, TERCA, "/cardio/corrida");
    await page.getByRole("button", { name: "Começar" }).click();
    await page.clock.runFor(2 * 60_000);
    await page.getByRole("button", { name: "Encerrar e registrar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar e voltar" }).click();

    await expect
      .poll(
        async () => {
          const [p] = await lerDoMock<{ semana_corrida: number }>(sessao, "profiles");
          return p?.semana_corrida ?? 1;
        },
        { timeout: 10_000 },
      )
      .toBe(2);
  });

  test("a troca de bloco vibra e fala o nome do bloco (SPEC §3.3)", async ({ page }) => {
    await usuarioComPerfil({ semana_corrida: 1 });
    await espiarAvisos(page);
    await abrir(page, TERCA, "/cardio/corrida");

    await page.getByRole("button", { name: "Começar" }).click();
    // começar não avisa nada: o aviso é da TROCA de bloco
    expect(await avisos(page)).toMatchObject({ vibrou: 0, falou: [] });

    await page.clock.runFor(5 * 60_000); // fim do aquecimento → corrida 1
    await expect(page.getByText("bloco 1 de 8")).toBeVisible();
    expect(await avisos(page)).toMatchObject({ vibrou: 1, falou: ["pt-BR:corrida"] });

    await page.clock.runFor(60_000); // corrida 1 → caminhada 1
    await expect(blocoAtual(page)).toContainText("Caminhada");
    expect(await avisos(page)).toMatchObject({
      vibrou: 2,
      falou: ["pt-BR:corrida", "pt-BR:caminhada"],
    });
  });

  test("uma corrida só na semana civil NÃO avança o plano (§5.5)", async ({ page }) => {
    const sessao = await usuarioComPerfil({ semana_corrida: 1 });
    await abrir(page, TERCA, "/cardio/corrida");

    await page.getByRole("button", { name: "Começar" }).click();
    await page.clock.runFor(60_000);
    await page.getByRole("button", { name: "Encerrar e registrar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar e voltar" }).click();

    await expect
      .poll(async () => (await lerDoMock(sessao, "cardio_sessions")).length, {
        timeout: 10_000,
      })
      .toBe(1);
    const [perfil] = await lerDoMock<{ semana_corrida: number }>(sessao, "profiles");
    expect(perfil?.semana_corrida).toBe(1);
  });

  test("sem rede o 'Encerrar' não perde a sessão: ela sobe quando a rede volta (§8)", async ({
    page,
    context,
  }) => {
    const sessao = await usuarioComPerfil({ semana_corrida: 1 });
    await abrir(page, TERCA, "/cardio/corrida");
    await page.getByRole("button", { name: "Começar" }).click();
    await page.clock.runFor(60_000);

    await context.setOffline(true);
    await page.getByRole("button", { name: "Encerrar e registrar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar e voltar" }).click();

    // a tela volta para a Hoje como se nada fosse; o banco continua vazio
    await esperarAbaTreino(page);
    expect(await lerDoMock(sessao, "cardio_sessions")).toHaveLength(0);

    await context.setOffline(false);
    await expect
      .poll(async () => (await lerDoMock(sessao, "cardio_sessions")).length, {
        timeout: 20_000,
      })
      .toBe(1);
  });

  test("o calendário abre a corrida registrada com o esforço em pt-BR (§3.5)", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil({ semana_corrida: 1 });
    await inserirNoMock(sessao, "cardio_sessions", [
      {
        id: "55555555-5555-4555-8555-555555555555",
        data: "2026-09-15",
        tipo: "corrida",
        semana_plano: 1,
        concluida: true,
        duracao_min: 34,
        distancia_km: 3.6,
        esforco: "facil",
        feito: { repeticoes_cumpridas: 8, repeticoes_planejadas: 8 },
      },
    ]);

    await abrir(page, "2026-09-16T08:00:00-03:00", "/calendario");
    await page.getByText("Corrida").first().click();
    const abrirCardio = page.getByRole("link", { name: "Abrir o cardio" });
    await expect(abrirCardio).toHaveAttribute(
      "href",
      "/cardio/corrida?sessao=55555555-5555-4555-8555-555555555555",
    );
    await abrirCardio.click();

    await expect(page.getByText("Sessão registrada")).toBeVisible();
    await expect(page.getByText("8 de 8")).toBeVisible();
    await expect(page.getByText("3,6 km")).toBeVisible();
    await expect(page.getByText("fácil")).toBeVisible();
  });

  test("a corda usa o estágio da semana e a caminhada é só cronômetro", async ({
    page,
  }) => {
    await usuarioComPerfil({ semana_corda: 1 });
    await abrir(page, TERCA, "/cardio/corda");

    await expect(page.getByRole("heading", { name: "Corda · semana 1" })).toBeVisible();
    await expect(page.getByText("6 × 30 s de corda (60 s de descanso)")).toBeVisible();
    await expect(page.getByRole("timer")).toHaveText("0:30");
    await expect(
      page.getByRole("list", { name: "Blocos da sessão" }).getByRole("listitem"),
    ).toHaveCount(11);

    await page.goto("/cardio/caminhada");
    await expect(page.getByRole("heading", { name: "Caminhada leve" })).toBeVisible();
    await expect(page.getByRole("timer")).toHaveText("0:00");
    await page.getByRole("button", { name: "Começar" }).click();
    await page.clock.runFor(90_000);
    await expect(page.getByRole("timer")).not.toHaveText("0:00");
    await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();

    // SPEC §3.3: "Caminhada leve / outro: só duração e nota"
    await page.getByRole("button", { name: "Encerrar e registrar" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("1:30")).toBeVisible();
    await expect(dialogo.getByLabel("Nota (opcional)")).toBeVisible();
    await expect(dialogo.getByText("Distância (opcional)")).toHaveCount(0);
    await expect(dialogo.getByText("Teste da fala")).toHaveCount(0);
    await expect(dialogo.getByRole("radiogroup", { name: "Esforço" })).toHaveCount(0);
  });
});

test.describe("Barra fixa (SPEC §3.4)", () => {
  test("a semana 1 fica destacada e o +1 grava em pullup_singles", async ({ page }) => {
    const sessao = await usuarioComPerfil({ semana_fixa: 1 });
    await abrir(page, QUINTA, "/barra-fixa");

    await expect(page.getByRole("heading", { name: "Barra fixa" })).toBeVisible();
    await expect(page.getByText("Semana 1–2 · 4 × 5")).toBeVisible();

    const atual = page.locator("tr[aria-current='true']");
    await expect(atual).toHaveCount(1);
    await expect(atual).toContainText("1–2");
    await expect(atual).toContainText("4 × 5");
    await expect(page.getByRole("row")).toHaveCount(7); // cabeçalho + 6 faixas

    const somar = page.getByRole("button", {
      name: "Somar uma repetição solta de barra fixa",
    });
    expect((await somar.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await somar.click();
    await somar.click();

    await expect
      .poll(async () => (await lerDoMock(sessao, "pullup_singles")).length, {
        timeout: 10_000,
      })
      .toBe(2);

    await semRolagemHorizontal(page);
  });

  test("'Fazer sessão de barra fixa' abre a sessão da semana com 4 × 5", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil({ semana_fixa: 1 });
    await abrir(page, QUINTA, "/barra-fixa");

    await page.getByRole("button", { name: "Fazer sessão de barra fixa" }).click();

    await expect(page.getByRole("heading", { name: "Barra fixa" })).toBeVisible();
    await expect(page.getByText("semana 1–2 · 4 × 5")).toBeVisible();
    await expect(page.getByText("Barra fixa assistida")).toBeVisible();
    // 4 séries de trabalho, sem aquecimento (o exercício não é composto pesado)
    await expect(page.getByText("0/4 séries")).toBeVisible();

    await expect
      .poll(
        async () => {
          const linhas = await lerDoMock<{ workout_id: string }>(sessao, "sessions");
          return linhas[0]?.workout_id ?? "";
        },
        { timeout: 10_000 },
      )
      .toBe("fixa");
  });

  test("uma sessão de fixa não avança o plano; duas na semana civil avançam (§5.5)", async ({
    page,
  }) => {
    const sessao = await usuarioComPerfil({ semana_fixa: 1 });
    await inserirNoMock(sessao, "sessions", [
      {
        id: "66666666-6666-4666-8666-666666666666",
        data: "2026-09-14",
        workout_id: "fixa",
        fase: "fase1",
        status: "concluida",
      },
    ]);

    await abrir(page, QUINTA, "/barra-fixa");
    await expect(page.getByText("Semana 1–2 · 4 × 5")).toBeVisible();
    // com uma só, a semana repete
    expect((await lerDoMock<{ semana_fixa: number }>(sessao, "profiles"))[0]?.semana_fixa).toBe(1);

    await inserirNoMock(sessao, "sessions", [
      {
        id: "77777777-7777-4777-8777-777777777777",
        data: "2026-09-16",
        workout_id: "fixa",
        fase: "fase1",
        status: "concluida",
      },
    ]);
    await page.reload();
    await expect
      .poll(
        async () =>
          (await lerDoMock<{ semana_fixa: number }>(sessao, "profiles"))[0]?.semana_fixa,
        { timeout: 10_000 },
      )
      .toBe(2);
  });

  test("a sessão refeita noutro aparelho mantém 'última firme: sim' (§6.2 e §8)", async ({
    page,
    browser,
  }) => {
    await usuarioComPerfil({ semana_fixa: 1 });
    await abrir(page, QUINTA, "/barra-fixa");
    await page.getByRole("button", { name: "Fazer sessão de barra fixa" }).click();
    await expect(page.getByText("0/4 séries")).toBeVisible();

    for (let i = 0; i < 4; i++) {
      await page.getByRole("checkbox").nth(i).click();
    }
    await expect(page.getByText("4/4 séries")).toBeVisible();
    const firme = page.getByRole("switch", { name: /Última repetição firme/ });
    await expect(firme).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("· sincronizado")).toBeVisible();

    /*
     * Outro celular refaz a sessão do que o banco tem. As séries foram
     * gravadas uma a uma, então o `ultima_firme` da 1ª é `false` — o padrão
     * daquele instante, não uma decisão: o toggle tem de continuar em "sim".
     */
    const { contexto, pagina } = await outroAparelho(browser, QUINTA, page.url());
    await expect(pagina.getByText("4/4 séries")).toBeVisible();
    await expect(
      pagina.getByRole("switch", { name: /Última repetição firme/ }),
    ).toHaveAttribute("aria-checked", "true");
    await contexto.close();
  });
});
