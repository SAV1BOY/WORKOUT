import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { LinhaSessao } from "../lib/types";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, esperarAbaTreino, esperarServiceWorker, fixarData, HOJE_FIXO,
  irNaAba, lerDoMock, resetarMock, semRolagemHorizontal,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { abrirCatalogo, busca, catalogo, FRONTAL, geral, NOME, planoSalvo, series, timer, treinoAberto } from "./treino-livre-ativo";

const FLEXAO = "Flexão de braço";
const FLEXAO_ID = "flexao-de-braco";
const desfazer = (page: Page) => geral(page).getByRole("button", { name: `Desfazer inclusão de ${FLEXAO}`, exact: true });
const blocos = (page: Page) => geral(page).locator('[id^="bloco-"] h2');
const notaDoFrontal = (page: Page) => geral(page).getByRole("textbox", { name: `Nota: ${NOME}`, exact: true });

async function acrescentarFlexao(page: Page) {
  await abrirCatalogo(page).click();
  await busca(page).fill("flexao de braco");
  await catalogo(page).getByRole("button", { name: `Adicionar ${FLEXAO}`, exact: true }).click();
  await expect(blocos(page).filter({ hasText: FLEXAO })).toBeVisible();
  await expect(desfazer(page)).toBeVisible();
}

async function abrirSegundaAba(context: BrowserContext, id: string) {
  const aba = await context.newPage();
  await fixarData(aba);
  await aba.goto(`/treinar/${id}`);
  await abrirVisaoGeral(aba);
  await expect(blocos(aba)).toHaveCount(3);
  return aba;
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("desfazer a inclusão acidental durante o descanso preserva série e nota, reabre offline e repete o treino corrigido", async ({ page, context }) => {
  const { conta, id, plano } = await treinoAberto(page, { comFrontal: true });
  await esperarServiceWorker(page);
  await page.getByRole("button", { name: "Concluir série", exact: true }).click();
  await expect(timer(page)).toHaveText("1:35");
  await expect.poll(() => series(conta, id)).toHaveLength(1);
  const [anterior] = await series(conta, id);
  expect(anterior).toMatchObject({ session_id: id, user_id: conta.userId, exercise_id: FRONTAL, carga_kg: 31.5, concluida: true });
  expect(anterior?.reps).toBeGreaterThan(0);
  await abrirVisaoGeral(page);
  // O plano veio de uma versão anterior e os dois exercícios fazem parte da prescrição.
  await expect(geral(page).getByRole("button", { name: /Desfazer inclusão/ })).toHaveCount(0);
  const nota = "Mantive a profundidade no primeiro movimento.";
  await notaDoFrontal(page).fill(nota);
  await acrescentarFlexao(page);
  await expect.poll(() => planoSalvo(conta, id)).toMatchObject({ itens: [...plano.itens, { exercicio_id: FLEXAO_ID }] });
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await fixarData(page, new Date(Date.parse(HOJE_FIXO) + 15_000).toISOString());
  await page.reload();
  await expect(timer(page)).toHaveText("1:20");
  await abrirVisaoGeral(page);
  await page.addStyleTag({ content: "html { font-size: 125% !important; }" });
  const acao = desfazer(page);
  await expect(acao).toBeVisible();
  await abrirCatalogo(page).focus();
  await page.keyboard.press("Tab");
  await expect(acao).toBeFocused();
  await expect(acao).toBeInViewport({ ratio: 0.95 });
  const alvo = await acao.boundingBox();
  expect(alvo!.height).toBeGreaterThanOrEqual(44);
  expect(alvo!.width).toBeGreaterThanOrEqual(44);
  expect(await geral(page).evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await semRolagemHorizontal(page);
  await acao.press("Enter");
  await expect(abrirCatalogo(page)).toBeFocused();
  await expect(geral(page).getByRole("status").filter({ hasText: "desfeita" })).toContainText(FLEXAO);
  await expect(blocos(page)).toHaveText([`1. ${NOME}`, "2. Remada com elástico"]);
  await expect(notaDoFrontal(page)).toHaveValue(nota);
  expect((await planoSalvo(conta, id))?.itens).toHaveLength(3); // A remoção ainda está só no aparelho.

  await page.reload();
  await expect(timer(page)).toHaveText("1:20");
  await abrirVisaoGeral(page);
  await expect(blocos(page)).toHaveCount(2);
  await expect(notaDoFrontal(page)).toHaveValue(nota);
  await expect(desfazer(page)).toHaveCount(0);
  await comRedeNoWorker(await workerDoApp(context));
  await context.setOffline(false);
  await expect.poll(() => planoSalvo(conta, id)).toMatchObject({
    itens: plano.itens, equipamento_disponivel: plano.equipamento_disponivel, descansos_por_exercicio: plano.descansos_por_exercicio,
  });
  expect(await series(conta, id)).toEqual([anterior]);
  await geral(page).getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("dialog", { name: "Treino concluído" }).getByRole("button", { name: "Salvar e voltar" }).click();
  await esperarAbaTreino(page);
  await expect.poll(() => lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${id}`)).toMatchObject([
    { id, status: "concluida", notas: `${NOME}: ${nota}`, plano: { itens: plano.itens } },
  ]);
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  const registro = page.getByRole("list", { name: "Registros" }).getByRole("listitem").filter({ hasText: plano.titulo! });
  await expect(registro).toContainText("1 série");
  await registro.getByRole("button", { name: /^Repetir treino/ }).click();
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  expect(page.url()).not.toContain(id);
  await abrirVisaoGeral(page);
  await expect(blocos(page)).toHaveText([`1. ${NOME}`, "2. Remada com elástico"]);
  await expect(desfazer(page)).toHaveCount(0);
});

test("desfazer a inclusão do próximo movimento mantém o descanso de transição e leva à avaliação", async ({ page }) => {
  const { conta, id, plano } = await treinoAberto(page, { apenasUmaSerie: true });
  await abrirVisaoGeral(page);
  await acrescentarFlexao(page);
  await geral(page).getByRole("button", { name: "Voltar ao treino" }).click();
  await page.getByRole("button", { name: "Concluir série", exact: true }).click();
  await page.getByRole("radiogroup", { name: "Última repetição" }).getByRole("radio", { name: "Firme" }).click();
  const descanso = page.getByRole("region", { name: "Descanso", exact: true });
  await expect(descanso).toContainText(FLEXAO);
  const anterior = await timer(page).innerText();
  await descanso.getByRole("button", { name: "Somar 20 segundos ao descanso" }).click();
  await expect(timer(page)).not.toHaveText(anterior);
  const ajustado = await timer(page).innerText();
  await abrirVisaoGeral(page);
  await desfazer(page).click();
  await expect(blocos(page)).toHaveCount(1);
  await geral(page).getByRole("button", { name: "Voltar ao treino" }).click();
  await expect(timer(page)).toHaveText(ajustado);
  await expect(descanso).not.toContainText(FLEXAO);
  await descanso.getByRole("button", { name: "Pular descanso" }).click();
  await expect(page.getByRole("region", { name: "Feedback do treino" })).toBeVisible();
  await expect.poll(() => planoSalvo(conta, id)).toMatchObject({ itens: plano.itens });
  expect(await series(conta, id)).toMatchObject([{ exercise_id: "rosca-com-elastico", ordem_ex: 1, concluida: true }]);
});

test("a segunda aba ainda pode registrar uma série do treino depois que a primeira desfez a inclusão", async ({ page, context }) => {
  const { conta, id, plano } = await treinoAberto(page);
  await abrirVisaoGeral(page);
  await acrescentarFlexao(page);
  const outra = await abrirSegundaAba(context, id);
  await desfazer(page).click();
  await expect(blocos(page)).toHaveCount(2);
  const removida = geral(outra).getByRole("checkbox", { name: `Série 1 concluída — ${FLEXAO}`, exact: true });
  if (await removida.isVisible()) {
    // A aba ainda mostra uma linha que acabou de sair no outro documento.
    await removida.click();
    await expect(outra.getByText("O treino mudou. A série não foi registrada.", { exact: true })).toBeVisible();
  }
  await expect(blocos(outra)).toHaveCount(2);
  expect(await series(conta, id)).toEqual([]);
  const remada = outra.getByRole("checkbox", { name: "Série 1 concluída — Remada com elástico", exact: true });
  await remada.check();
  await expect.poll(() => series(conta, id)).toMatchObject([{ session_id: id, exercise_id: "remada-com-elastico", ordem_ex: 2, concluida: true }]);
  await outra.reload();
  await abrirVisaoGeral(outra);
  await expect(blocos(outra)).toHaveText(["1. Rosca com elástico", "2. Remada com elástico"]);
  await expect(remada).toBeChecked();
  await expect.poll(() => planoSalvo(conta, id)).toMatchObject({ itens: plano.itens });
});

test("uma inclusão usada na segunda aba conserva seu bloco e a série mesmo se a primeira tentar desfazer", async ({ page, context }) => {
  const { conta, id, plano } = await treinoAberto(page);
  await abrirVisaoGeral(page);
  await acrescentarFlexao(page);
  const outra = await abrirSegundaAba(context, id);
  const rotulo = `Série 1 concluída — ${FLEXAO}`;
  await geral(outra).getByRole("checkbox", { name: rotulo, exact: true }).check();
  await expect.poll(() => series(conta, id)).toMatchObject([{ session_id: id, exercise_id: FLEXAO_ID, ordem_ex: 3, concluida: true }]);
  if (await desfazer(page).isVisible()) {
    await desfazer(page).click();
    await expect(geral(page).getByRole("alert")).toContainText("Confira a lista antes de desfazer a inclusão");
  }
  await expect(desfazer(page)).toHaveCount(0);
  await page.reload();
  await abrirVisaoGeral(page);
  await expect(blocos(page)).toHaveCount(3);
  await expect(geral(page).getByRole("checkbox", { name: rotulo, exact: true })).toBeChecked();
  await expect(desfazer(page)).toHaveCount(0);
  expect(await planoSalvo(conta, id)).toMatchObject({ itens: [...plano.itens, { exercicio_id: FLEXAO_ID }] });
});

test("a troca aberta em outra aba respeita a série e a nota da flexão antes de substituir as restantes", async ({ page, context }) => {
  const { conta, id } = await treinoAberto(page);
  await abrirVisaoGeral(page);
  await acrescentarFlexao(page);
  const outra = await abrirSegundaAba(context, id);
  const bloco = geral(page).locator("#bloco-3");
  const trocar = bloco.getByRole("button", { name: /substituir hoje/i });
  await trocar.click();
  const seletor = page.getByRole("dialog", { name: "Substituir hoje" });
  const fechada = seletor.getByRole("list", { name: "Exercícios alternativos" })
    .getByRole("button", { name: /^Flexão fechada(?:\s|$)/ });
  await expect(fechada).toBeVisible();

  const nota = "Apoiei as mãos na largura dos ombros.";
  const serieDoBloco = `Série 1 concluída — ${FLEXAO}`;
  await geral(outra).getByRole("textbox", { name: `Nota: ${FLEXAO}`, exact: true }).fill(nota);
  await geral(outra).getByRole("checkbox", { name: serieDoBloco, exact: true }).check();
  await expect.poll(() => series(conta, id)).toMatchObject([{ exercise_id: FLEXAO_ID, set_index: 1, concluida: true }]);
  const originais = await series(conta, id);

  await fechada.click();
  await expect(seletor).toBeHidden();
  await expect(page.getByText("Outra aba atualizou este exercício. Confira o que foi registrado antes de trocar.", { exact: true })).toBeVisible();
  await expect(bloco.getByRole("textbox", { name: `Nota: ${FLEXAO}`, exact: true })).toHaveValue(nota);
  await expect(bloco.getByRole("checkbox", { name: serieDoBloco, exact: true })).toBeChecked();
  await trocar.click();
  await fechada.click();
  await expect(bloco.getByRole("heading", { name: "3. Flexão fechada" })).toBeVisible();
  await expect.poll(async () => (await planoSalvo(conta, id))?.trocas?.["3"]).toMatchObject([
    { exercicio_id: "flexao-fechada", trabalho: [2, 3] },
    { exercicio_id: FLEXAO_ID, trabalho: [1], nota },
  ]);
  expect(await series(conta, id)).toEqual(originais);
});
