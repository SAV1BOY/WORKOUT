import { expect, test, type Page } from "@playwright/test";
import type { ModeloDeTreino } from "../lib/modelo-de-treino";
import {
  abrirVisaoGeral, entrarNoApp, esperarAbaTreino, esperarServiceWorker, fixarData, lerDoMock,
  naFila, requisicoesDoMock, resetarMock, semRolagemHorizontal, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { geral } from "./treino-livre-ativo";

const AGACHAMENTO = "Agachamento livre";
const REMADA = "Remada com elástico";
const TABELA = "modelos_de_treino";
const dialogo = (p: Page, name: string) => p.getByRole("dialog", { name, exact: true });
const editor = (p: Page) => dialogo(p, "Crie o seu próprio");
const ajustar = (p: Page) => editor(p).getByRole("button", { name: "Ajustar séries", exact: true });
const ajustes = (p: Page) => dialogo(p, "Ajustar séries");
const campo = (p: Page, nome: string) => ajustes(p).getByRole("combobox", { name: `Séries de trabalho de ${nome}`, exact: true });
const personalizar = (p: Page) => p.getByRole("button", { name: /Personalizar treino/ });

async function preparar(page: Page) {
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  await entrarNoApp(page);
  await personalizar(page).press("Enter");
  return conta;
}

async function escolher(page: Page, nome: string) {
  await editor(page).getByRole("searchbox").fill(nome);
  const resultado = editor(page).getByRole("list", { name: "Catálogo" }).getByRole("button")
    .filter({ has: page.getByText(nome, { exact: true }) });
  await resultado.press("Space");
  await expect(resultado).toHaveAttribute("aria-pressed", "true");
}

async function pronto(page: Page) {
  await ajustes(page).getByRole("button", { name: "Pronto", exact: true }).press("Enter");
  await expect(ajustar(page)).toBeFocused();
}

async function iniciar(page: Page) {
  await editor(page).getByRole("button", { name: "Começar com 2 exercícios", exact: true }).click();
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

async function conferirSessao(page: Page, agachamentos: number, remadas: number) {
  const visao = geral(page);
  await expect(visao.getByRole("heading", { level: 2 })).toHaveText([`1. ${AGACHAMENTO}`, `2. ${REMADA}`]);
  await expect(visao.getByRole("group", { name: /^Série \d+ — Agachamento livre$/ })).toHaveCount(agachamentos);
  await expect(visao.getByRole("group", { name: /^Aquecimento \d+ — Agachamento livre$/ })).toHaveCount(2);
  await expect(visao.getByRole("group", { name: /^Série \d+ — Remada com elástico$/ })).toHaveCount(remadas);
  await expect(visao.getByRole("group", { name: /^Aquecimento \d+ — Remada com elástico$/ })).toHaveCount(0);
}

async function carregar(page: Page, nome: string) {
  await personalizar(page).press("Enter");
  await editor(page).getByRole("button", { name: "Treinos salvos", exact: true }).click();
  await dialogo(page, "Treinos salvos").getByRole("button", { name: `Carregar ${nome}`, exact: true }).click();
  await expect(ajustar(page)).toBeVisible();
}

async function enviosDeModelos() {
  return (await requisicoesDoMock()).filter(r => r.metodo === "POST" && r.caminho === `/rest/v1/${TABELA}`).length;
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("o treino avulso mantém as séries de cada movimento ao reordenar e volta ao padrão ao reinseri-lo", async ({ page }) => {
  const conta = await preparar(page);
  await escolher(page, REMADA);
  await escolher(page, AGACHAMENTO);
  await ajustar(page).click();
  await expect(campo(page, AGACHAMENTO).getByRole("option", { selected: true })).toHaveText("Padrão (3)");
  await campo(page, AGACHAMENTO).selectOption("2");
  await campo(page, REMADA).selectOption("5");
  await pronto(page);
  await editor(page).getByRole("button", { name: "Reordenar escolhidos", exact: true }).click();
  const ordem = dialogo(page, "Reordenar escolhidos");
  await ordem.getByRole("button", { name: `Subir ${AGACHAMENTO}`, exact: true }).click();
  await ordem.getByRole("button", { name: "Pronto", exact: true }).click();
  await ajustar(page).click();
  await expect(ajustes(page).getByRole("combobox").first()).toHaveAccessibleName(`Séries de trabalho de ${AGACHAMENTO}`);
  await expect(campo(page, AGACHAMENTO)).toHaveValue("2");
  await expect(campo(page, REMADA)).toHaveValue("5");
  await pronto(page);
  await editor(page).getByRole("button", { name: `Tirar ${REMADA}`, exact: true }).click();
  await escolher(page, REMADA);
  await ajustar(page).click();
  await expect(campo(page, AGACHAMENTO)).toHaveValue("2");
  await expect(campo(page, REMADA).getByRole("option", { selected: true })).toHaveText("Padrão (3)");
  await pronto(page);
  const id = await iniciar(page);
  await abrirVisaoGeral(page);
  await conferirSessao(page, 2, 3);
  await expect.poll(() => lerDoMock(conta, "sessions")).toMatchObject([{ id, plano: { titulo: "Treino personalizado", itens: [
    { exercicio_id: "agachamento-livre", series: 2 }, { exercicio_id: "remada-com-elastico", series: 3 },
  ] } }]);
  expect(await lerDoMock(conta, TABELA)).toHaveLength(0);
});

test("editar o modelo sem rede altera as séries da próxima sessão e sincroniza uma única atualização", async ({ page, context }) => {
  test.slow(); // Duas sessões, uma edição offline e recarga da aba sob controle do worker.
  const conta = await preparar(page);
  await esperarServiceWorker(page);
  await escolher(page, AGACHAMENTO);
  await escolher(page, REMADA);
  await ajustar(page).click();
  await campo(page, AGACHAMENTO).selectOption("2");
  await campo(page, REMADA).selectOption("4");
  await pronto(page);
  const nome = "Barra e faixa";
  await editor(page).getByRole("button", { name: "Salvar treino", exact: true }).click();
  const formulario = dialogo(page, "Salvar treino");
  await formulario.getByRole("textbox", { name: "Nome do treino" }).fill(nome);
  await formulario.getByRole("button", { name: "Salvar", exact: true }).click();
  const modelos = () => lerDoMock<ModeloDeTreino>(conta, TABELA);
  const iniciais = { "agachamento-livre": 2, "remada-com-elastico": 4 };
  await expect.poll(modelos).toMatchObject([{ nome, series_por_exercicio: iniciais }]);
  const [modelo] = await modelos();
  expect(await lerDoMock(conta, "sessions")).toHaveLength(0);

  const primeira = await iniciar(page);
  await page.getByRole("button", { name: `Como fazer: ${AGACHAMENTO}`, exact: true }).click();
  const ficha = dialogo(page, AGACHAMENTO);
  await expect(ficha.getByRole("textbox", { name: "Séries", exact: true })).toHaveValue("2");
  await ficha.getByRole("button", { name: "Diminuir Séries", exact: true }).click();
  await expect(ficha.getByRole("textbox", { name: "Séries", exact: true })).toHaveValue("1");
  await page.keyboard.press("Escape");
  await abrirVisaoGeral(page);
  await conferirSessao(page, 1, 4);
  await geral(page).getByRole("checkbox", { name: `Série 1 concluída — ${AGACHAMENTO}`, exact: true }).check();
  await geral(page).getByRole("button", { name: "Concluir", exact: true }).click();
  await dialogo(page, "Treino concluído").getByRole("button", { name: "Salvar e voltar", exact: true }).click();
  await esperarAbaTreino(page);
  await expect.poll(() => lerDoMock(conta, "sessions")).toMatchObject([{ id: primeira, status: "concluida" }]);
  await expect.poll(() => naFila(page)).toBe(0);
  const anterior = await lerDoMock(conta, "sessions", `id=eq.${primeira}`);
  const postagens = await enviosDeModelos();
  expect(postagens).toBe(1);

  await carregar(page, nome);
  await ajustar(page).click();
  await expect(campo(page, AGACHAMENTO)).toHaveValue("2");
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await campo(page, REMADA).selectOption("6");
  await pronto(page);
  await editor(page).getByRole("button", { name: "Atualizar treino", exact: true }).click();
  await dialogo(page, "Atualizar treino").getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(editor(page)).toBeVisible();
  await expect.poll(() => naFila(page)).toBe(1);
  expect(await modelos()).toMatchObject([{ id: modelo!.id, series_por_exercicio: iniciais }]);
  expect(await enviosDeModelos()).toBe(postagens);
  await page.keyboard.press("Escape");
  await expect(personalizar(page)).toBeFocused();
  await semRedeNoWorker(worker);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await carregar(page, nome);
  await ajustar(page).click();
  await expect(campo(page, AGACHAMENTO)).toHaveValue("2");
  await expect(campo(page, REMADA)).toHaveValue("6");
  await pronto(page);
  const segunda = await iniciar(page);
  expect(segunda).not.toBe(primeira);
  await abrirVisaoGeral(page);
  await conferirSessao(page, 2, 6);
  await expect(geral(page).getByRole("checkbox", { checked: true })).toHaveCount(0);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await enviosDeModelos()).toBe(postagens + 1);
  expect(await modelos()).toMatchObject([{ id: modelo!.id, nome, series_por_exercicio: { "agachamento-livre": 2, "remada-com-elastico": 6 } }]);
  expect(await lerDoMock(conta, "sessions", `id=eq.${segunda}`)).toMatchObject([{ plano: { titulo: nome, itens: [
    { exercicio_id: "agachamento-livre", series: 2 }, { exercicio_id: "remada-com-elastico", series: 6 },
  ] } }]);
  expect(await lerDoMock(conta, "sessions", `id=eq.${primeira}`)).toEqual(anterior);
});

test("o teclado alcança o padrão e os limites de séries a 320 px com fonte ampliada", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await preparar(page);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const nome = "Desenvolvimento sentado com barra";
  await escolher(page, nome);
  await ajustar(page).press("Enter");
  await expect(ajustes(page).getByRole("heading", { name: "Ajustar séries" })).toBeFocused();
  await page.keyboard.press("Tab");
  const seletor = campo(page, nome);
  await expect(seletor).toBeFocused();
  await semRolagemHorizontal(page);
  const caixa = await seletor.boundingBox();
  expect(caixa!.x).toBeGreaterThanOrEqual(0);
  expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(320);
  expect(caixa!.height).toBeGreaterThanOrEqual(44);
  await expect.poll(() => seletor.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  })).toBe(true);
  const valores = await seletor.getByRole("option").evaluateAll(opcoes => opcoes.map(o => (o as HTMLOptionElement).value));
  expect(valores).toEqual(["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  await page.keyboard.press("ArrowDown");
  await expect(seletor).toHaveValue("1");
  await page.keyboard.press("End");
  await expect(seletor).toHaveValue("10");
  await page.keyboard.press("Tab");
  await expect(ajustes(page).getByRole("button", { name: "Pronto", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(ajustar(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(seletor).toHaveValue("10");
  await page.keyboard.press("Home");
  await expect(seletor).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(ajustar(page)).toBeFocused();
  await expect(editor(page).getByRole("searchbox")).toHaveValue(nome);
});
