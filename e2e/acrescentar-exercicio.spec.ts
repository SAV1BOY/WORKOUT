import { expect, test, type Page } from "@playwright/test";
import type { LinhaSerie, LinhaSessao, PlanoDaSessao, Prefs } from "../lib/types";
import {
  abrirVisaoGeral, avancarNoPlayerAte, comecarNoPlayer, comecarOTreinoDoDia, entrarNoApp,
  esperarServiceWorker, fixarData, HOJE_FIXO, inserirNoMock, lerDoMock, resetarMock,
  semRolagemHorizontal, usuarioComPerfil, type SessaoMock,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

const ROSCA = "rosca-com-elastico";
const REMADA = "remada-com-elastico";
const FRONTAL = "agachamento-frontal";
const NOME = "Agachamento frontal";

const geral = (page: Page) => page.getByRole("dialog", { name: "Visão geral do treino" });
const abrirCatalogo = (page: Page) => geral(page).getByRole("button", { name: "Adicionar exercício", exact: true });
const catalogo = (page: Page) => page.getByRole("dialog", { name: "Adicionar exercício", exact: true });
const busca = (page: Page) => catalogo(page).getByRole("searchbox", { name: "Buscar exercício pelo nome" });
const adicionar = (page: Page) => catalogo(page).getByRole("button", { name: `Adicionar ${NOME}`, exact: true });
const timer = (page: Page) => page.getByRole("region", { name: "Descanso", exact: true }).getByRole("timer");

async function treinoAberto(page: Page, opcoes: { prepararCargaOffline?: boolean; prefs?: Prefs } = {}) {
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false, ...opcoes.prefs } });
  const id = crypto.randomUUID();
  const plano: PlanoDaSessao = {
    titulo: "Treino livre de segunda", colecao: null,
    equipamento_disponivel: ["super-band", "tatame", "anilhas", "barra-macica", "cavalete"],
    descansos_por_exercicio: { [ROSCA]: 95 },
    itens: [ROSCA, REMADA].map(exercicio_id => ({
      exercicio_id, tipo: "reps", series: 3, min: 8, max: 12, unilateral: false, descanso_s: 60, descanso_texto: "60 s",
    })),
  };
  await inserirNoMock(conta, "sessions", [{
    id, user_id: conta.userId, workout_id: "livre", fase: "fase1", data: "2026-09-14",
    iniciada_em: new Date(HOJE_FIXO).toISOString(), status: "em_andamento", plano,
  }]);
  await inserirNoMock(conta, "exercise_state", [{
    user_id: conta.userId, exercise_id: FRONTAL, carga_atual_kg: 31.5, reps_alvo: 7, falhas_seguidas: 0,
    incremento_reduzido: false, exigir_rep_extra: false, semana_leve: false, sessoes_graca: 0, desativado: false,
  }]);
  await entrarNoApp(page);
  if (opcoes.prepararCargaOffline) {
    await page.goto(`/exercicios/${FRONTAL}`);
    await expect(page.getByText(/31,5 kg/).first()).toBeVisible();
  }
  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
  await expect(page.getByRole("heading", { name: "Rosca com elástico", exact: true })).toBeVisible();
  return { conta, id, plano };
}

function series(conta: SessaoMock, id: string) {
  return lerDoMock<LinhaSerie>(conta, "session_sets", `session_id=eq.${id}&order=ordem_ex.asc`);
}

async function conferirBlocoNovo(page: Page) {
  await expect(geral(page).locator('[id^="bloco-"] h2')).toHaveText([
    "1. Rosca com elástico", "2. Remada com elástico", "3. Agachamento frontal",
  ]);
  const bloco = geral(page).locator("#bloco-3");
  const primeira = bloco.getByRole("group", { name: `Série 1 — ${NOME}`, exact: true });
  await expect(primeira.getByRole("textbox", { name: "carga na barra" })).toHaveValue("31,5");
  await expect(bloco.getByRole("checkbox", { checked: true })).toHaveCount(0);
  return primeira;
}

async function planoSalvo(conta: SessaoMock, id: string) {
  const [sessao] = await lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${id}`);
  return sessao?.plano;
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, HOJE_FIXO);
});

test("durante o descanso, acrescentar no fim preserva a série registrada e o prazo do cronômetro", async ({ page }, info) => {
  const { conta, id, plano } = await treinoAberto(page);
  await page.getByRole("button", { name: "Concluir série", exact: true }).click();
  await expect(timer(page)).toHaveText("1:35");
  await expect.poll(() => series(conta, id)).toHaveLength(1);
  const registrosAnteriores = await series(conta, id);
  await expect(page.getByRole("button", { name: "Visão geral do treino" })).toBeInViewport();
  await page.screenshot({ path: info.outputPath("visao-geral-durante-o-descanso.png") });
  await abrirVisaoGeral(page);

  await abrirCatalogo(page).click();
  await busca(page).fill("agachamento frontal");
  await fixarData(page, new Date(Date.parse(HOJE_FIXO) + 15_000).toISOString());
  await adicionar(page).focus();
  await page.keyboard.press("Enter");
  await expect(catalogo(page)).toBeHidden();
  await expect(abrirCatalogo(page)).toBeFocused();
  await conferirBlocoNovo(page);
  await expect.poll(() => planoSalvo(conta, id)).toMatchObject({
    ...plano, itens: [...plano.itens, { exercicio_id: FRONTAL }],
  });
  expect(await series(conta, id)).toEqual(registrosAnteriores);
  await geral(page).getByRole("button", { name: "Voltar ao treino" }).click();
  await expect(timer(page)).toHaveText("1:20");
  await expect(page.getByRole("button", { name: "Visão geral do treino" })).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/treinar/${id}$`));
  await page.getByRole("button", { name: "Pular descanso" }).click();
  await expect(page.getByText("Série 2 de 3 · exercício 1 de 3", { exact: true })).toBeVisible();

  const movimento = page.getByRole("region", { name: NOME, exact: true });
  await avancarNoPlayerAte(page, movimento.getByText("Série 1 de 3 · exercício 3 de 3", { exact: true }));
  await movimento.getByRole("button", { name: "Concluir série" }).click();
  await expect.poll(() => series(conta, id)).toMatchObject([
    registrosAnteriores[0], { exercise_id: FRONTAL, ordem_ex: 3, set_index: 1, carga_kg: 31.5, concluida: true },
  ]);
});

test("a busca filtra por equipamento e o teclado e o voltar fecham só a folha do catálogo", async ({ page }, info) => {
  const { conta, id, plano } = await treinoAberto(page);
  await abrirVisaoGeral(page);
  await expect(geral(page).getByRole("heading", { level: 1 })).toHaveText("Treino livre de segunda");
  const entrada = abrirCatalogo(page);
  await entrada.focus();
  await page.keyboard.press("Enter");
  await expect(catalogo(page).getByRole("heading", { name: "Adicionar exercício", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(busca(page)).toBeFocused();
  await busca(page).fill("supino reto com barra"); // O banco não está no equipamento desta sessão.
  await expect(catalogo(page).getByRole("button", { name: "Adicionar Supino reto com barra" })).toHaveCount(0);
  await busca(page).fill("rosca com elástico"); // Já ocupa o primeiro bloco.
  await expect(catalogo(page).getByRole("button", { name: "Adicionar Rosca com elástico" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(entrada).toBeFocused();
  await page.keyboard.press("Enter");
  await busca(page).fill("agachamento frontal");
  await expect(adicionar(page)).toBeVisible();
  await semRolagemHorizontal(page);
  const caixa = await adicionar(page).boundingBox();
  expect(caixa!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: info.outputPath("adicionar-exercicio-no-celular.png") });
  await page.evaluate(() => window.history.back());
  await expect(catalogo(page)).toBeHidden();
  await expect(entrada).toBeFocused();
  await expect(geral(page).locator('[id^="bloco-"] h2')).toHaveCount(2);
  expect(await planoSalvo(conta, id)).toEqual(plano);
});

test("dois toques sem rede acrescentam uma vez e a recarga retoma o mesmo treino e suas cargas", async ({ page, context }) => {
  test.slow(); // O cenário abre uma ficha, retoma o treino e força uma navegação offline real.
  const { conta, id, plano } = await treinoAberto(page, { prepararCargaOffline: true });
  await esperarServiceWorker(page);
  await page.getByRole("button", { name: "Concluir série" }).click();
  await expect(timer(page)).toHaveText("1:35");
  await expect.poll(() => series(conta, id)).toHaveLength(1);
  const [anterior] = await series(conta, id);
  await page.getByRole("button", { name: "Pular descanso" }).click();
  await abrirVisaoGeral(page);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);

  await abrirCatalogo(page).click();
  await busca(page).fill("agachamento frontal");
  await adicionar(page).evaluate((botao: HTMLButtonElement) => { botao.click(); botao.click(); });
  await expect(catalogo(page)).toBeHidden();
  const primeira = await conferirBlocoNovo(page);
  await primeira.getByRole("checkbox").check();
  expect(await planoSalvo(conta, id)).toEqual(plano);
  expect(await series(conta, id)).toEqual([anterior]);

  await semRedeNoWorker(worker);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/treinar/${id}$`));
  await expect(page.getByText("Série 2 de 3 · exercício 1 de 3", { exact: true })).toBeVisible();
  await abrirVisaoGeral(page);
  await expect(geral(page).locator('[id^="bloco-"] h2')).toHaveCount(3);
  await expect(geral(page).getByRole("checkbox", { name: `Série 1 concluída — ${NOME}` })).toBeChecked();
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => planoSalvo(conta, id)).toMatchObject({ ...plano, itens: [...plano.itens, { exercicio_id: FRONTAL }] });
  await expect.poll(() => series(conta, id)).toMatchObject([
    anterior, { user_id: conta.userId, exercise_id: FRONTAL, ordem_ex: 3, set_index: 1, carga_kg: 31.5, concluida: true },
  ]);
  expect((await lerDoMock<LinhaSessao>(conta, "sessions")).map(s => s.id)).toEqual([id]);
});

test("a falha ao gravar mantém o catálogo e permite tentar outra vez", async ({ page }) => {
  const { conta, id, plano } = await treinoAberto(page);
  await abrirVisaoGeral(page);
  await abrirCatalogo(page).click();
  await busca(page).fill("agachamento frontal");
  await page.evaluate(exercicioId => {
    const adicionar = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      const valor = args[0];
      if (this.name === "outbox" && valor?.tipo === "sessao" &&
        valor.payload?.linha?.plano?.itens?.some((item: { exercicio_id: string }) => item.exercicio_id === exercicioId)) {
        IDBObjectStore.prototype.add = adicionar;
        throw new DOMException("Sem espaço para a fila", "QuotaExceededError");
      }
      return adicionar.apply(this, args);
    };
  }, FRONTAL);
  await adicionar(page).click();
  await expect(catalogo(page).getByRole("alert")).toBeVisible();
  await expect(busca(page)).toHaveValue("agachamento frontal");
  expect(await planoSalvo(conta, id)).toEqual(plano);
  await adicionar(page).click();
  await expect(catalogo(page)).toBeHidden();
  await conferirBlocoNovo(page);
  await expect.poll(() => planoSalvo(conta, id)).toMatchObject({ itens: [...plano.itens, { exercicio_id: FRONTAL }] });
});

test("o treino do programa mantém a substituição e sua lista prescrita", async ({ page }) => {
  await usuarioComPerfil();
  await entrarNoApp(page);
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  await abrirVisaoGeral(page);
  await expect(geral(page).getByRole("heading", { name: /Agachamento livre/ })).toBeVisible();
  await expect(geral(page).getByRole("button", { name: /substituir hoje/i }).first()).toBeVisible();
  await expect(abrirCatalogo(page)).toHaveCount(0);
});

for (const vibra of [true, false]) {
  test(`o descanso termina com o catálogo aberto e vibração ${vibra ? "ligada" : "desligada"}`, async ({ page }) => {
    await treinoAberto(page, { prefs: { descanso_vibra: vibra, descanso_som: false, avancar_sozinho: true } });
    await page.clock.install({ time: new Date(HOJE_FIXO) });
    await page.evaluate(() => {
      let avisos = 0;
      document.documentElement.dataset.vibracoes = "0";
      Object.defineProperty(navigator, "vibrate", { configurable: true, value() {
        document.documentElement.dataset.vibracoes = String(++avisos);
        return true;
      } });
    });
    await page.getByRole("button", { name: "Concluir série" }).click();
    await expect(timer(page)).toHaveText("1:35");
    await abrirVisaoGeral(page);
    await abrirCatalogo(page).click();
    await busca(page).fill("agachamento frontal");
    await expect(adicionar(page)).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-vibracoes", "0");
    await page.clock.fastForward(96_000);
    await page.clock.runFor(1_250); // Também passa o segundo que normalmente dispara o avanço automático.
    const quantidade = vibra ? "1" : "0";
    await expect(page.locator("html")).toHaveAttribute("data-vibracoes", quantidade);
    await expect(busca(page)).toHaveValue("agachamento frontal");
    await page.keyboard.press("Escape");
    await expect(abrirCatalogo(page)).toBeFocused();
    await geral(page).getByRole("button", { name: "Voltar ao treino" }).click();
    await expect(page.getByText("Série 2 de 3 · exercício 1 de 2", { exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-vibracoes", quantidade);
  });
}
