import { expect, test, type Page } from "@playwright/test";
import type { LinhaSerie, PlanoDaSessao } from "../lib/types";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, avancarNoPlayerAte, comecarNoPlayer, comecarOTreinoDoDia, entrarNoApp,
  esperarAbaTreino, esperarServiceWorker, fixarData, HOJE_FIXO, inserirNoMock, lerDoMock, resetarMock,
  semRolagemHorizontal, usuarioComPerfil,
  ocuparArmazenamentoDaSessao,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

const ROSCA = "rosca-com-elastico";
const REMADA = "remada-com-elastico";
const NOME = "Rosca com elástico";
const TITULO = "Minha sessão de elástico";

test.beforeEach(async () => {
  await resetarMock();
});

/** Uma sessão já iniciada antes desta versão, com dois movimentos de trabalho e sem personalização. */
async function prepararTreinoAnterior(page: Page, series: number) {
  await fixarData(page, HOJE_FIXO);
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, descanso_padrao_s: 70 } });
  const id = crypto.randomUUID();
  const plano: PlanoDaSessao = {
    titulo: TITULO, colecao: null, equipamento_disponivel: ["super-band"],
    itens: [ROSCA, REMADA].map(exercicio_id => ({
      exercicio_id, tipo: "reps", series, min: 8, max: 12, unilateral: false,
      descanso_s: 60, descanso_texto: "60 s",
    })),
  };
  await inserirNoMock(conta, "sessions", [{
    id, user_id: conta.userId, workout_id: "livre", fase: "fase1", data: "2026-09-14",
    iniciada_em: new Date(HOJE_FIXO).toISOString(), status: "em_andamento", plano,
  }]);
  await entrarNoApp(page);
  return { conta, id, plano };
}

async function abrirTreinoAnterior(page: Page, series: number) {
  const sessao = await prepararTreinoAnterior(page, series);
  await page.goto(`/treinar/${sessao.id}`);
  await comecarNoPlayer(page);
  await expect(page.getByRole("heading", { name: NOME, exact: true })).toBeVisible();
  return sessao;
}

const timer = (page: Page) => page.getByRole("timer", { name: "Descanso" });
const editar = (page: Page) => page.getByRole("button", { name: "Editar tempo de descanso" });
const tempo = (page: Page) => page.getByRole("textbox", { name: "tempo de descanso em segundos" });
const uso = (page: Page, nome: string) => page.getByRole("checkbox", { name: `Usar nas próximas séries de ${nome}` });
const restaurar = (page: Page) => page.getByRole("button", { name: "Restaurar padrão para as próximas séries" });

async function concluir(page: Page) {
  await page.getByRole("button", { name: "Concluir série", exact: true }).click();
}

async function pular(page: Page) {
  await page.getByRole("button", { name: "Pular descanso", exact: true }).click();
}

async function escolherTempo(page: Page, segundos: number, lembrar: boolean, nome = NOME) {
  await editar(page).click();
  await tempo(page).fill(String(segundos));
  await expect(uso(page, nome)).toBeVisible();
  await expect(uso(page, nome)).not.toBeChecked();
  if (lembrar) {
    await uso(page, nome).focus();
    await page.keyboard.press("Space");
    await expect(uso(page, nome)).toBeChecked();
  }
}

async function salvarTempo(page: Page) {
  const salvar = page.getByRole("button", { name: "Salvar", exact: true });
  await salvar.focus();
  await page.keyboard.press("Enter");
  await expect(editar(page)).toHaveAttribute("aria-expanded", "false");
  await expect(editar(page)).toBeFocused();
}

test("o ajuste avulso dura um intervalo e restaurar o padrão preserva a contagem atual", async ({ page }, info) => {
  const { conta, id, plano } = await abrirTreinoAnterior(page, 6);
  await concluir(page);
  await expect(timer(page)).toHaveText("1:10");
  await escolherTempo(page, 45, false);
  await salvarTempo(page);
  await expect(timer(page)).toHaveText("0:45");
  await pular(page);
  await concluir(page);
  await expect(timer(page)).toHaveText("1:10");
  await escolherTempo(page, 90, true);
  await semRolagemHorizontal(page);
  const alvoDeToque = await uso(page, NOME).evaluate(campo => campo.closest("label")?.getBoundingClientRect().height);
  expect(alvoDeToque).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: info.outputPath("descanso-nas-proximas-series.png") });
  await salvarTempo(page);
  await pular(page);
  await concluir(page);
  await expect(timer(page)).toHaveText("1:30");
  await page.getByRole("button", { name: "Somar 20 segundos ao descanso" }).click();
  await expect(timer(page)).toHaveText("1:50");
  await pular(page);
  await concluir(page);
  await expect(timer(page)).toHaveText("1:30");

  await editar(page).click();
  await expect(restaurar(page)).toBeEnabled();
  await semRolagemHorizontal(page);
  const pularVisivel = await page.getByRole("button", { name: "Pular descanso" }).evaluate(botao => {
    const caixa = botao.getBoundingClientRect();
    return caixa.top >= 0 && caixa.bottom <= window.innerHeight;
  });
  expect(pularVisivel, "Pular descanso cabe na tela de 360 × 740 com a opção de restaurar aberta").toBe(true);
  await page.screenshot({ path: info.outputPath("descanso-restaurar-padrao.png") });
  await restaurar(page).focus();
  await page.keyboard.press("Enter");
  await expect(editar(page)).toHaveAttribute("aria-expanded", "false");
  await expect(editar(page)).toBeFocused();
  await expect(timer(page)).toHaveText("1:30");
  await pular(page);
  await concluir(page);
  await expect(timer(page)).toHaveText("1:10");

  await expect.poll(async () => {
    const [salva] = await lerDoMock<{ plano: PlanoDaSessao }>(conta, "sessions", `id=eq.${id}`);
    return salva?.plano;
  }).toEqual(plano);
  expect((await lerDoMock(conta, "profiles"))[0]?.prefs).toMatchObject({ descanso_padrao_s: 70 });
});

test("a Visão geral usa o descanso salvo no player e mantém o padrão do outro exercício", async ({ page }) => {
  const { conta, id } = await abrirTreinoAnterior(page, 4);
  await concluir(page);
  await escolherTempo(page, 95, true);
  await salvarTempo(page);
  await pular(page);
  await abrirVisaoGeral(page);

  const geral = page.getByRole("dialog", { name: "Visão geral do treino" });
  const barra = geral.getByRole("timer", { name: "Descanso" });
  await geral.getByRole("checkbox", { name: `Série 2 concluída — ${NOME}`, exact: true }).check();
  await expect(barra.getByText("1:35", { exact: true })).toBeVisible();
  await expect(barra).toContainText(NOME);
  await barra.getByRole("button", { name: "Pular" }).click();

  await geral.getByRole("checkbox", { name: "Série 1 concluída — Remada com elástico", exact: true }).check();
  await expect(barra.getByText("1:10", { exact: true })).toBeVisible();
  await expect(barra).toContainText("Remada com elástico");
  await barra.getByRole("button", { name: "Pular" }).click();

  // A lista permite concluir fora de ordem. Ainda falta a terceira Rosca ao marcar a quarta.
  await geral.getByRole("checkbox", { name: `Série 4 concluída — ${NOME}`, exact: true }).check();
  await expect(barra.getByText("1:35", { exact: true })).toBeVisible();
  await barra.getByRole("button", { name: "Pular" }).click();
  await geral.getByRole("checkbox", { name: `Série 3 concluída — ${NOME}`, exact: true }).check();
  await expect(barra.getByText("1:00", { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const series = await lerDoMock<LinhaSerie>(conta, "session_sets", `session_id=eq.${id}`);
    return series.filter(s => s.concluida).map(s => [s.exercise_id, s.set_index]).sort();
  }).toEqual([[REMADA, 1], [ROSCA, 1], [ROSCA, 2], [ROSCA, 3], [ROSCA, 4]]);
});

test("o link do treino ganha controle offline sem recarregar quando a instalação termina durante a navegação", async ({ page, context }) => {
  // No Playwright 1.56 o tráfego do próprio worker requer esta opção no Chromium.
  const opcaoAnterior = process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS;
  process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
  const precacheIniciado = Promise.withResolvers<void>();
  const liberarPrecache = Promise.withResolvers<void>();
  const workerAtivado = Promise.withResolvers<void>();
  const cdp = await context.newCDPSession(page);
  try {
    cdp.on("ServiceWorker.workerVersionUpdated", ({ versions }) => {
      if (versions.some(v => v.status === "activated" && new URL(v.scriptURL).pathname === "/sw.js")) {
        workerAtivado.resolve();
      }
    });
    await cdp.send("ServiceWorker.enable");
    await context.route(url => url.pathname === "/~offline", async rota => {
      if (rota.request().serviceWorker()) {
        precacheIniciado.resolve();
        await liberarPrecache.promise;
      }
      await rota.continue();
    });

    const { id, conta } = await prepararTreinoAnterior(page, 4);
    await test.step("o primeiro acesso começou a preparar o app para uso offline", () => precacheIniciado.promise);
    const caminho = `/treinar/${id}`;
    // O HTML chega depois do clients.claim da ativação, mas a navegação começou antes.
    await page.route(url => url.pathname === caminho, async rota => {
      if (rota.request().isNavigationRequest()) {
        liberarPrecache.resolve();
        await workerAtivado.promise;
      }
      await rota.continue();
    });
    let documentos = 0;
    // O roteador também usa replaceState na mesma URL, sem criar outro documento.
    cdp.on("Page.frameNavigated", ({ frame }) => {
      if (!frame.parentId && new URL(frame.url).pathname === caminho) documentos++;
    });
    await cdp.send("Page.enable");
    await page.goto(caminho);
    await comecarNoPlayer(page);
    await expect.poll(() => page.evaluate(async () => ({
      ativo: (await navigator.serviceWorker.getRegistration())?.active?.state,
      controlador: navigator.serviceWorker.controller && new URL(navigator.serviceWorker.controller.scriptURL).pathname,
    }))).toEqual({ ativo: "activated", controlador: "/sw.js" });
    expect(documentos, "a sessão recebeu controle na página que a pessoa abriu").toBe(1);
    await concluir(page);
    await expect(timer(page)).toHaveText("1:10");
    await expect.poll(() => lerDoMock(conta, "session_sets", `session_id=eq.${id}`)).toHaveLength(1);
    await semRedeNoWorker(await workerDoApp(context));
    await context.setOffline(true);
    await page.reload();
    await expect(timer(page)).toHaveText("1:10");
  } finally {
    liberarPrecache.resolve();
    workerAtivado.resolve();
    if (opcaoAnterior === undefined) delete process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS;
    else process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = opcaoAnterior;
    await cdp.detach();
  }
});

test("a recarga offline mantém o intervalo avulso e a duração das séries seguintes", async ({ page, context }) => {
  test.slow(); // Duas recargas reais sem rede, intercaladas com a sincronização da sessão.
  const { conta, id } = await abrirTreinoAnterior(page, 4);
  await esperarServiceWorker(page);
  const worker = await workerDoApp(context);
  await concluir(page);
  await expect.poll(() => lerDoMock<LinhaSerie>(conta, "session_sets", `session_id=eq.${id}`)).toHaveLength(1);

  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await escolherTempo(page, 90, true);
  await salvarTempo(page);
  const liberar = await ocuparArmazenamentoDaSessao(page, id);
  try {
    await page.getByRole("button", { name: "Tirar 20 segundos do descanso" }).click();
    expect(await timer(page).innerText(), "o prazo exibido continua sendo o último confirmado").toBe("1:30");
  } finally {
    await liberar();
  }
  await expect(timer(page)).toHaveText("1:10");
  await semRedeNoWorker(worker);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/treinar/${id}$`));
  await expect(timer(page)).toHaveText("1:10");
  await pular(page);
  await concluir(page);
  await expect(timer(page)).toHaveText("1:30");
  expect(await lerDoMock(conta, "session_sets", `session_id=eq.${id}`)).toHaveLength(1);

  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => lerDoMock(conta, "sessions", `id=eq.${id}`)).toMatchObject([{
    id, status: "em_andamento", plano: { descansos_por_exercicio: { [ROSCA]: 90 } },
  }]);
  await expect.poll(async () => {
    const linhas = await lerDoMock<LinhaSerie>(conta, "session_sets", `session_id=eq.${id}`);
    return linhas.map(l => [l.set_index, l.exercise_id, l.concluida]).sort();
  }).toEqual([[1, ROSCA, true], [2, ROSCA, true]]);

  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await editar(page).click();
  await restaurar(page).click();
  await expect(editar(page)).toHaveAttribute("aria-expanded", "false");
  await expect(editar(page)).toBeFocused();
  await semRedeNoWorker(worker);
  await page.reload();
  await expect(timer(page)).toHaveText("1:30");
  await pular(page);
  await concluir(page);
  await expect(timer(page)).toHaveText("1:10");
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(async () => {
    const [sessao] = await lerDoMock<{ plano: PlanoDaSessao }>(conta, "sessions", `id=eq.${id}`);
    return sessao?.plano.descansos_por_exercicio;
  }).toBeUndefined();
});

test("os toques rápidos no descanso são gravados em ordem e o ajuste avulso permite tentar de novo", async ({ page, context }) => {
  const { id } = await abrirTreinoAnterior(page, 4);
  await esperarServiceWorker(page);
  const worker = await workerDoApp(context);
  await concluir(page);
  await escolherTempo(page, 90, true);
  await salvarTempo(page);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  const somar = page.getByRole("button", { name: "Somar 20 segundos ao descanso" });
  const tirar = page.getByRole("button", { name: "Tirar 20 segundos do descanso" });
  const liberar = await ocuparArmazenamentoDaSessao(page, id);
  try {
    await somar.evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
    await tirar.click();
    expect(await timer(page).innerText()).toBe("1:30");
  } finally {
    await liberar();
  }
  await expect(timer(page)).toHaveText("1:50");

  // Recusa a próxima escrita de um ajuste avulso, como um aparelho sem espaço.
  await page.evaluate(() => {
    const gravar = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "sessaoAtiva" && args[0]?.dados?.player?.totalS === 55) {
        IDBObjectStore.prototype.put = gravar;
        throw new DOMException("Sem espaço para a sessão", "QuotaExceededError");
      }
      return gravar.apply(this, args);
    };
  });
  await escolherTempo(page, 55, false);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível guardar o descanso." })).toBeVisible();
  await expect(timer(page)).toHaveText("1:50");
  await expect(tempo(page)).toHaveValue("55");
  await salvarTempo(page);
  await expect(timer(page)).toHaveText("0:55");
  await semRedeNoWorker(worker);
  await page.reload();
  await expect(timer(page)).toHaveText("0:55");
  await pular(page);
  await concluir(page);
  await expect(timer(page)).toHaveText("1:30");
});

test("corrigir e pular durante uma gravação respeitam o prazo confirmado e a próxima série", async ({ page }) => {
  const { id } = await abrirTreinoAnterior(page, 4);
  await concluir(page);
  await escolherTempo(page, 90, true);
  await salvarTempo(page);
  const liberarSoma = await ocuparArmazenamentoDaSessao(page, id);
  try {
    await page.getByRole("button", { name: "Somar 20 segundos ao descanso" }).click();
    await page.getByRole("button", { name: /^Corrigir a série/ }).click();
  } finally {
    await liberarSoma();
  }
  await page.getByRole("button", { name: "Série feita", exact: true }).click();
  await expect(timer(page)).toHaveText("1:50");

  const liberarReducao = await ocuparArmazenamentoDaSessao(page, id);
  try {
    await page.getByRole("button", { name: "Tirar 20 segundos do descanso" }).click();
    await pular(page);
  } finally {
    await liberarReducao();
  }
  await expect(page.getByText("Série 2 de 4 · exercício 1 de 2", { exact: true })).toBeVisible();
  await concluir(page);
  await expect(timer(page)).toHaveText("1:30");
});

test("a transição, o outro exercício e a repetição do treino mantêm seus próprios descansos", async ({ page }) => {
  test.slow(); // Percorre os dois movimentos, o resumo, o histórico e o início de outra sessão real.
  const { conta, id } = await abrirTreinoAnterior(page, 3);
  await concluir(page);
  await escolherTempo(page, 95, true);
  await salvarTempo(page);
  await pular(page);
  await concluir(page);
  await expect(timer(page)).toHaveText("1:35");
  await pular(page);
  await concluir(page);
  await page.getByRole("button", { name: "Pular esta pergunta" }).click();
  await expect(page.getByRole("heading", { name: "Remada com elástico", exact: true })).toBeVisible();
  await expect(timer(page)).toHaveText("1:10");
  await editar(page).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await pular(page);
  await concluir(page);
  await expect(timer(page)).toHaveText("1:10");
  await pular(page);

  await abrirVisaoGeral(page);
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Salvar e voltar" }).click();
  await esperarAbaTreino(page);
  await expect.poll(() => lerDoMock(conta, "sessions", `id=eq.${id}`)).toMatchObject([{
    status: "concluida", plano: { descansos_por_exercicio: { [ROSCA]: 95 } },
  }]);
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Relatório" }).click();
  await abrirSecaoDoRelatorio(page, "historico");
  await page.getByRole("button", { name: new RegExp(`Repetir treino.*${TITULO}`) }).click();
  await comecarNoPlayer(page);
  await expect(page).not.toHaveURL(new RegExp(id));
  await concluir(page);
  await expect(timer(page)).toHaveText("1:10");
});

test("o aquecimento é avulso e o substituto começa com o descanso padrão", async ({ page }) => {
  await fixarData(page, HOJE_FIXO);
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0 } });
  await entrarNoApp(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  const id = page.url().split("/").pop()!;
  await concluir(page);
  await expect(timer(page)).toHaveText("2:30");
  await editar(page).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await tempo(page).fill("40");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(timer(page)).toHaveText("0:40");
  await pular(page);
  await concluir(page);
  await expect(timer(page)).toHaveText("2:30");
  await pular(page);

  await concluir(page);
  await escolherTempo(page, 85, true, "Agachamento livre");
  await salvarTempo(page);
  await pular(page);
  await page.getByRole("button", { name: "Trocar exercício" }).click();
  const alternativas = page.getByRole("list", { name: "Exercícios alternativos" });
  await alternativas.getByRole("button", { name: /^Agachamento goblet\b/ }).click();
  await expect(page.getByRole("heading", { name: "Agachamento goblet", exact: true })).toBeVisible();
  await concluir(page);
  await editar(page).click();
  await expect(uso(page, "Agachamento goblet")).not.toBeChecked();
  await expect(restaurar(page)).toHaveCount(0);
  await expect(timer(page)).toHaveText("1:30");
  await expect.poll(() => lerDoMock(conta, "sessions", `id=eq.${id}`)).toMatchObject([{
    plano: { descansos_por_exercicio: { "agachamento-livre": 85 } },
  }]);
  await expect.poll(async () => {
    const series = await lerDoMock<LinhaSerie>(conta, "session_sets", `session_id=eq.${id}&tipo=eq.trabalho`);
    return series.filter(s => s.concluida).map(s => s.exercise_id).sort();
  }).toEqual(["agachamento-goblet", "agachamento-livre"]);
});

test("sem espaço no aparelho, o cronômetro e a sessão permitem tentar novamente", async ({ page }) => {
  const { conta, id, plano } = await abrirTreinoAnterior(page, 3);
  await concluir(page);
  await escolherTempo(page, 95, true);
  await page.evaluate(exercicioId => {
    const adicionar = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      const entrada = args[0];
      if (this.name === "outbox" && entrada?.tipo === "sessao" &&
          entrada.payload?.linha?.plano?.descansos_por_exercicio?.[exercicioId] === 95) {
        IDBObjectStore.prototype.add = adicionar;
        throw new DOMException("Armazenamento cheio", "QuotaExceededError");
      }
      return adicionar.apply(this, args);
    };
  }, ROSCA);

  const salvar = page.getByRole("button", { name: "Salvar", exact: true });
  await salvar.click();
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível guardar o descanso." })).toBeVisible();
  await expect(editar(page)).toHaveAttribute("aria-expanded", "true");
  await expect(tempo(page)).toHaveValue("95");
  await expect(uso(page, NOME)).toBeChecked();
  await expect(salvar).toBeFocused();
  await expect(timer(page)).toHaveText("1:10");
  expect((await lerDoMock(conta, "sessions", `id=eq.${id}`))[0]?.plano).toEqual(plano);
  await salvarTempo(page);
  await expect(timer(page)).toHaveText("1:35");
  await expect.poll(() => lerDoMock(conta, "sessions", `id=eq.${id}`)).toMatchObject([{
    plano: { descansos_por_exercicio: { [ROSCA]: 95 } },
  }]);
});

test("com avanço automático, o intervalo pode zerar sem fechar a edição", async ({ page }) => {
  await usuarioComPerfil({ prefs: { preparacao_s: 0, descanso_padrao_s: 20, avancar_sozinho: true } });
  await page.clock.install({ time: new Date(HOJE_FIXO) });
  await entrarNoApp(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  await avancarNoPlayerAte(page, page.getByText("Série 1 de 3 · exercício 1 de 6", { exact: true }));
  await concluir(page);
  await escolherTempo(page, 90, true, "Agachamento livre");
  await page.clock.fastForward(21_000);
  await expect(timer(page)).toHaveText("0:00");
  await page.clock.fastForward(1_500);
  await expect(editar(page)).toHaveAttribute("aria-expanded", "true");
  await expect(tempo(page)).toHaveValue("90");

  // Fechar sem salvar deixa o avanço automático seguir e conserva o padrão de 20 s.
  await editar(page).click();
  await page.clock.runFor(1_100);
  await expect(page.getByText("Série 2 de 3 · exercício 1 de 6", { exact: true })).toBeVisible();
  await concluir(page);
  await expect(timer(page)).toHaveText("0:20");
});
