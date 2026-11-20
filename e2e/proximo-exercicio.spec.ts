import { expect, test, type Page } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import type { LinhaSessao } from "../lib/types";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, comecarNoPlayer, entrarNoApp, esperarAbaTreino, esperarServiceWorker,
  fixarData, HOJE_FIXO, inserirNoMock, irNaAba, lerDoMock, naFila, ocuparArmazenamentoDaSessao, requisicoesDoMock, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { geral, series, timer } from "./treino-livre-ativo";

const IDS = ["pullover-com-halter", "agachamento-livre", "flexao-de-braco"];
const [PULLOVER, AGACHAMENTO, FLEXAO] = ["Pullover com halter", "Agachamento livre", "Flexão de braço"];
const PRIMEIRA_ORDEM = [PULLOVER, AGACHAMENTO, FLEXAO];
const NOVA_ORDEM = [PULLOVER, FLEXAO, AGACHAMENTO];
const TITULO = "Força no terraço";
const resto = (page: Page) => page.getByRole("region", { name: "Descanso", exact: true });
const titulos = (page: Page) => geral(page).locator('[id^="bloco-"] h2');
const escolha = (page: Page) => geral(page).getByRole("button", { name: "Próximo exercício", exact: true });
const anteciparFlexao = (page: Page) => geral(page).getByRole("button", { name: "Fazer Flexão de braço a seguir", exact: true });
const numerados = (nomes: string[]) => nomes.map((nome, indice) => `${indice + 1}. ${nome}`);

async function abrirTreino(page: Page, avancarSozinho: boolean) {
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, descanso_padrao_s: 90, avancar_sozinho: avancarSozinho } });
  const id = crypto.randomUUID();
  const itens = itensDeIds(IDS).map(item => ({ ...item, prescricao: { ...item.prescricao, series: 1 } }));
  await inserirNoMock(conta, "sessions", [{
    id, data: "2026-09-14", iniciada_em: HOJE_FIXO, status: "em_andamento", workout_id: "livre", fase: "fase1",
    plano: planoDaSessao(itens, { titulo: TITULO }),
  }]);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
  return { conta, id };
}

/** Uma série do primeiro movimento, seguida do descanso de transição até o cavalete. */
async function chegarAoCavalete(page: Page, avancarSozinho = false) {
  const sessao = await abrirTreino(page, avancarSozinho);
  const tela = page.getByRole("region", { name: PULLOVER, exact: true });
  const reps = tela.getByRole("textbox", { name: "repetições", exact: true });
  await reps.fill("11");
  await reps.press("Enter");
  const carga = tela.getByRole("textbox", { name: "carga por halter", exact: true });
  await carga.fill("7,5");
  await carga.press("Enter");
  await tela.getByRole("button", { name: "Concluir série", exact: true }).click();
  await page.getByRole("button", { name: "Pular esta pergunta", exact: true }).click();
  await expect(resto(page).getByRole("heading", { name: AGACHAMENTO, exact: true })).toBeVisible();
  await expect(timer(page)).toHaveText("1:30");
  await expect.poll(() => series(sessao.conta, sessao.id)).toMatchObject([{
    exercise_id: IDS[0], ordem_ex: 1, reps: 11, carga_kg: 7.5, concluida: true,
  }]);
  return sessao;
}

async function abrirEscolha(page: Page) {
  await abrirVisaoGeral(page);
  await expect(escolha(page)).toBeVisible();
  await escolha(page).click();
  await expect(anteciparFlexao(page)).toBeVisible();
}

async function escolherFlexao(page: Page) {
  await abrirEscolha(page);
  await anteciparFlexao(page).click();
  await expect(titulos(page)).toHaveText(numerados(NOVA_ORDEM));
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("antecipar a flexão sem rede mantém o prazo, a série corrigida e o cavalete para depois", async ({ page, context }) => {
  test.slow(); // Confere duas recargas pelo worker, antes e depois de esvaziar a fila.
  const { conta, id } = await chegarAoCavalete(page);
  const primeira = (await series(conta, id))[0]!; // chegarAoCavalete confirmou a única série.
  await expect.poll(() => naFila(page)).toBe(0);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await fixarData(page, new Date(Date.parse(HOJE_FIXO) + 17_000).toISOString());
  await expect(timer(page)).toHaveText("1:13");
  await escolherFlexao(page);
  await geral(page).getByRole("button", { name: "Voltar ao treino" }).click();
  await expect(resto(page).getByRole("heading", { name: FLEXAO, exact: true })).toBeVisible();
  await expect(timer(page)).toHaveText("1:13");
  await expect.poll(() => naFila(page)).toBeGreaterThan(0);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);

  await resto(page).getByRole("button", { name: /^Corrigir a série/ }).click();
  const original = page.getByRole("region", { name: PULLOVER, exact: true });
  await expect(original.getByRole("textbox", { name: "carga por halter" })).toHaveValue("7,5");
  await original.getByRole("button", { name: "Aumentar repetições", exact: true }).click();
  await original.getByRole("button", { name: "Série feita", exact: true }).click();
  await expect(timer(page)).toHaveText("1:13");
  expect(await series(conta, id)).toEqual([primeira]);
  await comRedeNoWorker(await workerDoApp(context));
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  await expect.poll(() => series(conta, id)).toMatchObject([{
    id: primeira.id, exercise_id: IDS[0], ordem_ex: 1, reps: 12, carga_kg: 7.5,
  }]);
  const [guardada] = await lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${id}`);
  expect(guardada?.plano?.itens.map(item => item.exercicio_id)).toEqual(IDS);
  expect(guardada?.ordem_execucao).toEqual([IDS[0], IDS[2], IDS[1]]);

  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await fixarData(page, new Date(Date.parse(HOJE_FIXO) + 30_000).toISOString());
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(timer(page)).toHaveText("1:00");
  await expect(resto(page).getByRole("heading", { name: FLEXAO, exact: true })).toBeVisible();
  await resto(page).getByRole("button", { name: "Pular descanso" }).click();
  const flexao = page.getByRole("region", { name: FLEXAO, exact: true });
  await expect(flexao.getByText("Série 1 de 1 · exercício 2 de 3", { exact: true })).toBeVisible();
  await flexao.getByRole("button", { name: "Concluir série", exact: true }).click();
  await page.getByRole("button", { name: "Pular esta pergunta", exact: true }).click();
  await expect(resto(page).getByRole("heading", { name: AGACHAMENTO, exact: true })).toBeVisible();
  await comRedeNoWorker(await workerDoApp(context));
  await context.setOffline(false);
  await expect.poll(() => series(conta, id)).toMatchObject([
    { id: primeira.id, exercise_id: IDS[0], ordem_ex: 1, reps: 12, carga_kg: 7.5 },
    { exercise_id: IDS[2], ordem_ex: 3, set_index: 1, concluida: true },
  ]);
});

test("uma série de agachamento iniciada em outra aba protege a sequência do treino", async ({ page, context }) => {
  test.slow(); // Duas abas abrem o mesmo treino e confirmam o registro antes da recarga.
  const { conta, id } = await chegarAoCavalete(page);
  await abrirEscolha(page);
  const outra = await context.newPage();
  await fixarData(outra);
  await outra.goto(`/treinar/${id}`);
  await abrirVisaoGeral(outra);
  const agachamento = geral(outra).getByRole("group", { name: "Série 1 — Agachamento livre", exact: true });
  await agachamento.getByRole("textbox", { name: "repetições" }).fill("7");
  await agachamento.getByRole("textbox", { name: "carga na barra" }).fill("31,5");
  await agachamento.getByRole("checkbox").check();
  await expect.poll(() => series(conta, id)).toMatchObject([
    { exercise_id: IDS[0] }, { exercise_id: IDS[1], ordem_ex: 2, reps: 7, carga_kg: 31.5 },
  ]);
  const feitas = await series(conta, id);
  await anteciparFlexao(page).click();
  await expect(geral(page).getByRole("status").filter({ hasText: "O treino mudou" })).toBeVisible();
  await page.reload();
  await abrirVisaoGeral(page);
  await expect(titulos(page)).toHaveText(numerados(PRIMEIRA_ORDEM));
  await expect(geral(page).getByRole("group", { name: "Série 1 — Agachamento livre" }).getByRole("checkbox")).toBeChecked();
  expect(await series(conta, id)).toEqual(feitas);
});

test("Histórico e Repetir treino seguem a ordem escolhida na sessão concluída", async ({ page }) => {
  test.slow(); // Percorre a conclusão, o detalhe no Histórico e a reabertura em outra sessão.
  const { conta, id } = await chegarAoCavalete(page);
  await escolherFlexao(page);
  for (const nome of [FLEXAO, AGACHAMENTO]) {
    await geral(page).getByRole("group", { name: `Série 1 — ${nome}`, exact: true }).getByRole("checkbox").check();
  }
  await geral(page).getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("dialog", { name: "Treino concluído", exact: true }).getByRole("button", { name: "Salvar e voltar" }).click();
  await esperarAbaTreino(page);
  await expect.poll(() => naFila(page)).toBe(0);
  const gravadas = await series(conta, id);
  expect(gravadas.map(s => [s.ordem_ex, s.exercise_id])).toEqual(IDS.map((exercicio, i) => [i + 1, exercicio]));
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  const linha = page.getByRole("list", { name: "Registros", exact: true }).getByRole("listitem").filter({ hasText: TITULO });
  await linha.getByRole("button", { name: /^Ver séries de / }).click();
  const detalhe = page.getByRole("dialog", { name: "Séries do treino" });
  await expect(detalhe.getByRole("heading", { level: 3 })).toHaveText(NOVA_ORDEM);
  await detalhe.getByRole("button", { name: "Fechar", exact: true }).click();
  await linha.getByRole("button", { name: /^Repetir treino/ }).click();
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  const repetida = new URL(page.url()).pathname.split("/").at(-1)!;
  expect(repetida).not.toBe(id);
  await abrirVisaoGeral(page);
  await expect(titulos(page)).toHaveText(numerados(NOVA_ORDEM));
  await expect(geral(page).getByRole("checkbox", { checked: true })).toHaveCount(0);
  expect(await series(conta, repetida)).toEqual([]);
  expect(await series(conta, id)).toEqual(gravadas);
});

for (const automatico of [true, false]) {
  test(`ao vencer o descanso durante a gravação, o avanço ${automatico ? "automático mantém o agachamento" : "manual respeita a escolha"}`, async ({ page }) => {
    test.slow(); // Inclui uma gravação retida, o avanço do player e a confirmação pelo servidor.
    const { conta, id } = await chegarAoCavalete(page, automatico);
    await expect.poll(() => naFila(page)).toBe(0);
    const atualizacoes = async () => (await requisicoesDoMock()).filter(r => r.metodo === "PATCH" && r.caminho === "/rest/v1/sessions").length;
    const antes = await atualizacoes();
    const feitas = await series(conta, id);
    await abrirEscolha(page);
    await fixarData(page, new Date(Date.parse(HOJE_FIXO) + 89_000).toISOString());
    const liberar = await ocuparArmazenamentoDaSessao(page, id);
    try {
      await anteciparFlexao(page).click();
      await expect(geral(page).getByRole("status").filter({ hasText: "Guardando a sequência" })).toBeVisible();
      await fixarData(page, new Date(Date.parse(HOJE_FIXO) + 90_000).toISOString());
    } finally {
      await liberar();
    }
    await expect(anteciparFlexao(page)).toBeHidden();
    if (await geral(page).isVisible()) {
      await geral(page).getByRole("button", { name: "Voltar ao treino" }).click();
    }
    if (!automatico) {
      await expect(timer(page)).toHaveText("0:00");
      await resto(page).getByRole("button", { name: "Pular descanso" }).click();
    }
    await expect(page.getByRole("region", { name: automatico ? AGACHAMENTO : FLEXAO, exact: true })).toBeVisible();
    await expect.poll(() => naFila(page)).toBe(0);
    expect(await atualizacoes()).toBe(antes + (automatico ? 0 : 1));
    const [salva] = await lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${id}`);
    expect(salva).toBeDefined();
    expect(salva?.ordem_execucao ?? null).toEqual(automatico ? null : [IDS[0], IDS[2], IDS[1]]);
    expect(await series(conta, id)).toEqual(feitas);
  });
}
