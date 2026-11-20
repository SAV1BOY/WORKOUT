import { expect, test, type Page } from "@playwright/test";
import type { LinhaSessao } from "../lib/types";
import {
  abrirVisaoGeral, avancarNoPlayerAte, comecarNoPlayer, comecarOTreinoDoDia, entrarNoApp,
  esperarServiceWorker, fixarData, HOJE_FIXO, lerDoMock, naFila, ocuparArmazenamentoDaSessao, requisicoesDoMock, resetarMock,
  semRolagemHorizontal, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

import { abrirCatalogo, busca, catalogo, FRONTAL, geral, NOME, planoSalvo, series, timer, treinoAberto } from "./treino-livre-ativo";

const grupoMuscular = (page: Page) => catalogo(page).getByRole("combobox", { name: "Grupo muscular", exact: true });
const adicionar = (page: Page) => catalogo(page).getByRole("button", { name: `Adicionar ${NOME}`, exact: true });

async function escritasDeSeries() {
  return (await requisicoesDoMock()).filter(p => p.metodo === "POST" && p.caminho === "/rest/v1/session_sets").length;
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

test("busca, grupo muscular e equipamento pelo teclado no tema claro; voltar fecha só o catálogo", async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const { conta, id, plano } = await treinoAberto(page);
  await abrirVisaoGeral(page);
  await expect(geral(page).getByRole("heading", { level: 1 })).toHaveText("Treino livre de segunda");
  const entrada = abrirCatalogo(page);
  await entrada.focus();
  await page.keyboard.press("Enter");
  await expect(catalogo(page).getByRole("heading", { name: "Adicionar exercício", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(busca(page)).toBeFocused();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  await busca(page).press("Tab");
  await expect(grupoMuscular(page)).toBeFocused();
  await grupoMuscular(page).press("p");
  await expect(grupoMuscular(page)).toHaveValue("Peito");
  await grupoMuscular(page).press("Shift+Tab");
  await expect(busca(page)).toBeFocused();
  await busca(page).fill("supino reto com barra"); // O banco não está no equipamento desta sessão.
  await expect(catalogo(page).getByRole("button", { name: "Adicionar Supino reto com barra" })).toHaveCount(0);
  await expect(catalogo(page).getByRole("status")).toContainText("Nenhum exercício disponível para esse grupo");
  await grupoMuscular(page).selectOption("todos");
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
  const visto = primeira.getByRole("checkbox");
  const escritasAntes = await escritasDeSeries();
  await semRedeNoWorker(worker);
  const liberar = await ocuparArmazenamentoDaSessao(page, id);
  try {
    await visto.click();
    expect(await visto.getAttribute("aria-checked"), "a série só fica marcada quando o aparelho confirma a gravação").toBe("false");
    await visto.click();
  } finally {
    await liberar();
  }
  await expect(visto).toBeChecked();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/treinar/${id}$`));
  await expect(page.getByText("Série 2 de 3 · exercício 1 de 3", { exact: true })).toBeVisible();
  await abrirVisaoGeral(page);
  await expect(geral(page).locator('[id^="bloco-"] h2')).toHaveCount(3);
  await expect(geral(page).getByRole("checkbox", { name: `Série 1 concluída — ${NOME}` })).toBeChecked();
  expect(await planoSalvo(conta, id)).toEqual(plano);
  expect(await series(conta, id)).toEqual([anterior]);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => planoSalvo(conta, id)).toMatchObject({ ...plano, itens: [...plano.itens, { exercicio_id: FRONTAL }] });
  await expect.poll(() => series(conta, id)).toMatchObject([
    anterior, { user_id: conta.userId, exercise_id: FRONTAL, ordem_ex: 3, set_index: 1, carga_kg: 31.5, concluida: true },
  ]);
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await escritasDeSeries()).toBe(escritasAntes + 1);
  expect((await lerDoMock<LinhaSessao>(conta, "sessions")).map(s => s.id)).toEqual([id]);
});

test("a fila sem espaço mantém a série pendente e permite confirmar uma única vez após reabrir", async ({ page, context }) => {
  test.slow(); // Inclui recarga offline e sincronização após a tentativa com espaço disponível.
  const { conta, id } = await treinoAberto(page, { comFrontal: true });
  await esperarServiceWorker(page);
  await abrirVisaoGeral(page);
  const visto = geral(page).getByRole("checkbox", { name: `Série 1 concluída — ${NOME}`, exact: true });
  const intervalo = geral(page).getByRole("timer", { name: "Descanso" });
  const antes = await escritasDeSeries();
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await page.evaluate(() => {
    const gravar = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "outbox" && args[0]?.tipo === "serie") {
        IDBObjectStore.prototype.add = gravar;
        throw new DOMException("Sem espaço para a série", "QuotaExceededError");
      }
      return gravar.apply(this, args);
    };
  });
  await visto.click();
  await expect(page.getByText("Não foi possível confirmar a série neste aparelho. Tente de novo.")).toBeVisible();
  await expect(visto).not.toBeChecked();
  await expect(intervalo).toBeHidden();
  await page.reload();
  await abrirVisaoGeral(page);
  await expect(visto).not.toBeChecked();
  await visto.click();
  await expect(visto).toBeChecked();
  await expect(intervalo).toBeVisible();
  expect(await series(conta, id)).toHaveLength(0);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => series(conta, id)).toMatchObject([
    { exercise_id: FRONTAL, set_index: 1, concluida: true, carga_kg: 31.5 },
  ]);
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await escritasDeSeries()).toBe(antes + 1);
});

test("o grupo muscular com busca e material acrescenta uma flexão offline e retoma no tema escuro", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const { conta, id, plano } = await treinoAberto(page);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await esperarServiceWorker(page);
  await abrirVisaoGeral(page);
  await abrirCatalogo(page).click();
  const folha = catalogo(page);
  const grupo = grupoMuscular(page);
  const movimento = (nome: string) => folha.getByRole("button", { name: `Adicionar ${nome}`, exact: true });
  const equipamento = folha.locator("summary").filter({ hasText: "Equipamentos disponíveis" });
  await equipamento.click();
  await folha.getByRole("button", { name: "Só peso do corpo", exact: true }).click();
  await folha.getByRole("checkbox", { name: "Elástico (Super Band)", exact: true }).check();
  await folha.getByRole("checkbox", { name: "Tatame", exact: true }).check();
  await equipamento.click();
  await expect(equipamento).toContainText("Elástico e Tatame");
  await expect.poll(() => planoSalvo(conta, id)).toMatchObject({ equipamento_disponivel: ["tatame", "super-band"] });

  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await busca(page).fill("flexao");
  await grupo.selectOption("Peito");
  const flexao = movimento("Flexão de braço");
  const fechada = movimento("Flexão fechada");
  const inclinada = movimento("Flexão inclinada");
  await expect(flexao).toBeVisible();
  await expect(fechada).toHaveCount(0); // Tríceps.
  await expect(inclinada).toHaveCount(0); // Peito, mas usa banco.
  await expect(folha.getByRole("listitem")).toHaveCount(1);
  await grupo.press("Home"); // "Todos" limpa só o grupo.
  await expect(grupo).toHaveValue("todos");
  await expect(busca(page)).toHaveValue("flexao");
  await expect(equipamento).toContainText("Elástico e Tatame");
  await expect(fechada).toBeVisible();
  await expect(inclinada).toHaveCount(0);
  await grupo.selectOption("Peito");
  await semRolagemHorizontal(page);
  const caixa = await grupo.boundingBox();
  expect(caixa!.height).toBeGreaterThanOrEqual(44);
  await flexao.focus();
  await flexao.press("Enter");
  await expect(abrirCatalogo(page)).toBeFocused();
  await expect(geral(page).getByRole("heading", { name: "3. Flexão de braço" })).toBeVisible();
  expect((await planoSalvo(conta, id))?.itens).toEqual(plano.itens);

  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/treinar/${id}$`));
  await abrirVisaoGeral(page);
  await expect(geral(page).getByRole("heading", { name: "3. Flexão de braço" })).toBeVisible();
  await abrirCatalogo(page).click();
  await expect(grupo).toHaveValue("todos");
  await expect(busca(page)).toHaveValue("");
  await expect(equipamento).toContainText("Elástico e Tatame");
  await busca(page).fill("flexao");
  await grupo.selectOption("Peito");
  await expect(folha.getByRole("status")).toContainText("Nenhum exercício disponível para esse grupo");
  await expect(flexao).toHaveCount(0); // Já está no fim deste treino.
  await comRedeNoWorker(await workerDoApp(context));
  await context.setOffline(false);
  await expect.poll(() => planoSalvo(conta, id)).toMatchObject({
    equipamento_disponivel: ["tatame", "super-band"], itens: [...plano.itens, { exercicio_id: "flexao-de-braco" }],
  });
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
