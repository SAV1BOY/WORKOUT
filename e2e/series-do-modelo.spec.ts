import { expect, test, type Locator, type Page } from "@playwright/test";
import type { ModeloDeTreino } from "../lib/modelo-de-treino";
import {
  abrirVisaoGeral, entrarNoApp, esperarAbaTreino, esperarServiceWorker, fixarData, inserirNoMock, lerDoMock,
  marcarSerieNaVisaoGeral, naFila, requisicoesDoMock, resetarMock, semRolagemHorizontal, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { geral, planoSalvo } from "./treino-livre-ativo";
import { ajustar, ajustes, campo, carregar, descanso, dialogo, editor, escolher, iniciar, personalizar, pronto } from "./montar-modelo";

const AGACHAMENTO = "Agachamento livre";
const REMADA = "Remada com elástico";
const TABELA = "modelos_de_treino";
async function preparar(page: Page) {
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  await entrarNoApp(page);
  await personalizar(page).press("Enter");
  return conta;
}

async function conferirSessao(page: Page, agachamentos: number, remadas: number) {
  const visao = geral(page);
  await expect(visao.getByRole("heading", { level: 2 })).toHaveText([`1. ${AGACHAMENTO}`, `2. ${REMADA}`]);
  await expect(visao.getByRole("group", { name: /^Série \d+ — Agachamento livre$/ })).toHaveCount(agachamentos);
  await expect(visao.getByRole("group", { name: /^Aquecimento \d+ — Agachamento livre$/ })).toHaveCount(2);
  await expect(visao.getByRole("group", { name: /^Série \d+ — Remada com elástico$/ })).toHaveCount(remadas);
  await expect(visao.getByRole("group", { name: /^Aquecimento \d+ — Remada com elástico$/ })).toHaveCount(0);
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
  await descanso(page, AGACHAMENTO).fill("100");
  await descanso(page, REMADA).fill("90");
  await pronto(page);
  await editor(page).getByRole("button", { name: "Reordenar escolhidos", exact: true }).click();
  const ordem = dialogo(page, "Reordenar escolhidos");
  await ordem.getByRole("button", { name: `Subir ${AGACHAMENTO}`, exact: true }).click();
  await ordem.getByRole("button", { name: "Pronto", exact: true }).click();
  await ajustar(page).click();
  await expect(ajustes(page).getByRole("combobox").first()).toHaveAccessibleName(`Séries de trabalho de ${AGACHAMENTO}`);
  await expect(campo(page, AGACHAMENTO)).toHaveValue("2");
  await expect(campo(page, REMADA)).toHaveValue("5");
  await expect(descanso(page, AGACHAMENTO)).toHaveValue("100");
  await expect(descanso(page, REMADA)).toHaveValue("90");
  await pronto(page);
  await editor(page).getByRole("button", { name: `Tirar ${REMADA}`, exact: true }).click();
  await escolher(page, REMADA);
  await ajustar(page).click();
  await expect(campo(page, AGACHAMENTO)).toHaveValue("2");
  await expect(campo(page, REMADA).getByRole("option", { selected: true })).toHaveText("Padrão (3)");
  await expect(descanso(page, REMADA)).toHaveValue("");
  await expect(descanso(page, AGACHAMENTO)).toHaveValue("100");
  await pronto(page);
  const id = await iniciar(page);
  await abrirVisaoGeral(page);
  await conferirSessao(page, 2, 3);
  await expect.poll(() => lerDoMock(conta, "sessions")).toMatchObject([{ id, plano: { titulo: "Treino personalizado", itens: [
    { exercicio_id: "agachamento-livre", series: 2 }, { exercicio_id: "remada-com-elastico", series: 3 },
  ] } }]);
  expect((await planoSalvo(conta, id))?.descansos_por_exercicio).toEqual({ "agachamento-livre": 100 });
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
  await descanso(page, AGACHAMENTO).fill("105");
  await pronto(page);
  const nome = "Barra e faixa";
  await editor(page).getByRole("button", { name: "Salvar treino", exact: true }).click();
  const formulario = dialogo(page, "Salvar treino");
  await formulario.getByRole("textbox", { name: "Nome do treino" }).fill(nome);
  await formulario.getByRole("button", { name: "Salvar", exact: true }).click();
  const modelos = () => lerDoMock<ModeloDeTreino>(conta, TABELA);
  const iniciais = { "agachamento-livre": 2, "remada-com-elastico": 4 };
  await expect.poll(modelos).toMatchObject([{ nome, series_por_exercicio: iniciais, descansos_por_exercicio: { "agachamento-livre": 105 } }]);
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
  await marcarSerieNaVisaoGeral(
    geral(page).getByRole("checkbox", { name: `Série 1 concluída — ${AGACHAMENTO}`, exact: true }),
  );
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
  await ajustes(page).getByRole("button", { name: `Restaurar descanso padrão de ${AGACHAMENTO}`, exact: true }).click();
  await descanso(page, REMADA).fill("95");
  await pronto(page);
  await editor(page).getByRole("button", { name: "Atualizar treino", exact: true }).click();
  await dialogo(page, "Atualizar treino").getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(editor(page)).toBeVisible();
  await expect.poll(() => naFila(page)).toBe(1);
  expect(await modelos()).toEqual([modelo]);
  expect(await enviosDeModelos()).toBe(postagens);
  await page.keyboard.press("Escape");
  await expect(personalizar(page)).toBeFocused();
  await semRedeNoWorker(worker);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await carregar(page, nome);
  await ajustar(page).click();
  await expect(campo(page, AGACHAMENTO)).toHaveValue("2");
  await expect(campo(page, REMADA)).toHaveValue("6");
  await expect(descanso(page, AGACHAMENTO)).toHaveValue("");
  await expect(descanso(page, REMADA)).toHaveValue("95");
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
  const salvos = await modelos();
  expect(salvos[0]?.descansos_por_exercicio).toEqual({ "remada-com-elastico": 95 });
  expect(salvos).toMatchObject([{ id: modelo!.id, nome, series_por_exercicio: { "agachamento-livre": 2, "remada-com-elastico": 6 } }]);
  const plano = await planoSalvo(conta, segunda);
  expect(plano).toMatchObject({ titulo: nome, itens: [
    { exercicio_id: "agachamento-livre", series: 2 }, { exercicio_id: "remada-com-elastico", series: 6 },
  ] });
  expect(plano?.descansos_por_exercicio).toEqual({ "remada-com-elastico": 95 });
  expect(await lerDoMock(conta, "sessions", `id=eq.${primeira}`)).toEqual(anterior);
});

test("o teclado ajusta séries e valida os limites do descanso a 320 px com fonte ampliada", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await preparar(page);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const nome = "Desenvolvimento sentado com barra";
  await escolher(page, nome);
  await ajustar(page).press("Enter");
  await expect(ajustes(page).getByRole("heading", { name: "Séries e descanso" })).toBeFocused();
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
  const segundos = descanso(page, nome);
  await expect(segundos).toBeFocused();
  await expect(segundos).toHaveValue("");
  await expect(ajustes(page).getByText(/^Padrão do catálogo:/)).toBeVisible();
  const erro = ajustes(page).getByText("Use um número inteiro de 5 a 900 segundos.", { exact: true });
  for (const [invalido, valido] of [["4", "5"], ["901", "900"]] as const) {
    await segundos.fill(invalido);
    await segundos.press("Enter");
    await expect(erro).toBeVisible();
    await expect(segundos).toBeFocused();
    await semRolagemHorizontal(page);
    const alvo = await segundos.boundingBox();
    expect(alvo!.x).toBeGreaterThanOrEqual(0);
    expect(alvo!.x + alvo!.width).toBeLessThanOrEqual(320);
    expect(alvo!.height).toBeGreaterThanOrEqual(44);
    await segundos.fill(valido);
    await segundos.press("Enter");
    await expect(ajustar(page)).toBeFocused();
    await expect(editor(page).getByRole("list", { name: "Escolhidos" })).toContainText(`${valido} s de descanso`);
    await ajustar(page).press("Enter");
    await expect(segundos).toHaveValue(valido);
  }
  await page.keyboard.press("Tab");
  await expect(seletor).toBeFocused();
  await expect(seletor).toHaveValue("10");
  await page.keyboard.press("Home");
  await expect(seletor).toHaveValue("");
  await segundos.fill("4");
  await segundos.press("Escape");
  await expect(ajustar(page)).toBeFocused();
  await expect(editor(page).getByRole("searchbox")).toHaveValue(nome);
  await ajustar(page).press("Enter");
  await expect(seletor).toHaveValue("");
  await expect(segundos).toHaveValue("900");
});

async function tocarNoCentro(page: Page, alvo: Locator) {
  const ponto = await alvo.evaluate(el => {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    return { x, y, recebeToque: el.contains(document.elementFromPoint(x, y)) };
  });
  expect(ponto, `O centro de ${alvo} deve receber o toque`).toMatchObject({ recebeToque: true });
  await page.touchscreen.tap(ponto.x, ponto.y);
}

test("o sexto descanso permite digitar e restaurar por toque quando a altura cai para 420 px", async ({ page }) => {
  const conta = await usuarioComPerfil({ prefs: { descanso_padrao_s: 70 } });
  const nome = "Sequência com seis";
  await inserirNoMock(conta, TABELA, [{
    id: crypto.randomUUID(), user_id: conta.userId, nome,
    exercicios: ["supino-reto-com-barra", "supino-inclinado-com-barra", "supino-declinado-com-barra",
      "supino-reto-com-halteres", "supino-inclinado-com-halteres", "crucifixo-reto"],
    equipamento_disponivel: null, series_por_exercicio: null, descansos_por_exercicio: null,
  }]);
  await page.setViewportSize({ width: 320, height: 740 });
  await entrarNoApp(page);
  await carregar(page, nome);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await ajustar(page).tap();
  const ultimo = descanso(page, "Crucifixo reto");
  const confirmar = ajustes(page).getByRole("button", { name: "Pronto", exact: true });
  const escolhido = editor(page).getByRole("button", { name: "Tirar Crucifixo reto", exact: true });
  await expect(ajustes(page).getByRole("textbox")).toHaveCount(6);
  await ultimo.tap();
  await expect(ultimo).toBeFocused();

  // A redução representa a área que sobra quando o teclado do celular abre.
  await page.setViewportSize({ width: 320, height: 420 });
  await tocarNoCentro(page, ultimo);
  await page.keyboard.type("95");
  await expect(ultimo).toHaveValue("95");
  await tocarNoCentro(page, confirmar);
  await expect(ajustar(page)).toBeFocused();
  await expect(escolhido).toHaveAccessibleDescription("95 s de descanso");

  await page.setViewportSize({ width: 320, height: 740 });
  await ajustar(page).tap();
  await ultimo.tap();
  await page.setViewportSize({ width: 320, height: 420 });
  const restaurar = ajustes(page).getByRole("button", { name: "Restaurar descanso padrão de Crucifixo reto", exact: true });
  await tocarNoCentro(page, restaurar);
  await expect(ultimo).toBeFocused();
  await expect(ultimo).toHaveValue("");
  await expect(ultimo).toHaveAttribute("placeholder", "70");
  await tocarNoCentro(page, confirmar);
  await expect(ajustar(page)).toBeFocused();
  await expect(escolhido).not.toHaveAccessibleDescription("95 s de descanso");
});
