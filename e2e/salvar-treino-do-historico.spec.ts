import { expect, test, type Page } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import type { ModeloDeTreino } from "../lib/modelo-de-treino";
import type { PlanoDaSessao } from "../lib/types";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, atualizarNoMock, definirCota, entrarNoApp, esperarAbaTreino, esperarServiceWorker,
  fixarData, inserirNoMock, irNaAba, lerDoMock, naFila, requisicoesDoMock, resetarMock, sessaoNoMock,
  usuarioComPerfil, type SessaoMock,
} from "./fixtures";
import { ajustar, campo, carregar, descanso, dialogo, editor, personalizar } from "./montar-modelo";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { geral, series as seriesDaSessao, treinoAberto } from "./treino-livre-ativo";

const ROSCA = "rosca-com-elastico";
const SUPINO = "supino-reto-com-barra";
const FLEXAO = "flexao-de-braco";
const TITULO = "Terraço sem banco";
const DIA = "2026-09-14";
const TABELA = "modelos_de_treino";
const detalhe = (page: Page) => dialogo(page, "Séries do treino");
const salvarComo = (page: Page) => detalhe(page).getByRole("button", { name: "Salvar como treino", exact: true });
const formulario = (page: Page) => dialogo(page, "Salvar como treino");
const nomeDoTreino = (page: Page) => formulario(page).getByRole("textbox", { name: "Nome do treino" });
const confirmar = (page: Page) => formulario(page).getByRole("button", { name: "Salvar", exact: true });

async function semearConcluida(conta: SessaoMock, plano: PlanoDaSessao | null, nota: string) {
  const id = crypto.randomUUID();
  await inserirNoMock(conta, "sessions", [{
    id, data: DIA, workout_id: "livre", fase: "fase1", status: "concluida", plano,
    iniciada_em: DIA + "T10:00:00Z", concluida_em: DIA + "T10:30:00Z", duracao_s: 1800, nota_geral: nota,
  }]);
  const serie = { session_id: id, ordem_ex: 2, tipo: "trabalho", concluida: true };
  await inserirNoMock(conta, "session_sets", [
    { ...serie, id: crypto.randomUUID(), exercise_id: SUPINO, set_index: 1, reps: 8, carga_kg: 22.5, registrada_em: DIA + "T10:05:00Z" },
    { ...serie, id: crypto.randomUUID(), exercise_id: FLEXAO, set_index: 2, reps: 7, carga_kg: null, registrada_em: DIA + "T10:09:00Z" },
  ]);
}

function planoFinal() {
  const plano = planoDaSessao(itensDeIds([ROSCA, SUPINO], { [ROSCA]: 4 }), { titulo: TITULO });
  plano.ordem_execucao = [SUPINO, ROSCA];
  plano.equipamento_disponivel = ["tatame", "super-band"];
  plano.descansos_por_exercicio = { [FLEXAO]: 95, [SUPINO]: 75 };
  plano.trocas = { "2": [
    { exercicio_id: FLEXAO, trabalho: [2, 3], aquecimento: [], nota: "Na última série", ultima_firme: false },
    { exercicio_id: SUPINO, trabalho: [1], aquecimento: [], nota: "Antes da troca", ultima_firme: true },
  ] };
  return plano;
}

async function abrirSeries(page: Page, nota: string) {
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  const registro = page.getByRole("list", { name: "Registros", exact: true })
    .getByRole("listitem").filter({ hasText: nota });
  await registro.getByRole("button", { name: /^Ver séries de / }).click();
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("salva a composição final offline, permite cancelar e reabrir sem iniciar outra sessão", async ({ page, context }) => {
  test.slow();
  const conta = await usuarioComPerfil();
  const nome = "Minha sessão com elástico";
  const nota = "Hoje treinei sem banco";
  await semearConcluida(conta, planoFinal(), nota);
  const sessoes = await lerDoMock(conta, "sessions");
  const series = await lerDoMock(conta, "session_sets");
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await abrirSeries(page, nota);
  await expect(salvarComo(page)).toBeVisible();
  await salvarComo(page).press("Enter");
  await expect(formulario(page).getByRole("heading", { name: "Salvar como treino" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(nomeDoTreino(page)).toBeFocused();
  await expect(nomeDoTreino(page)).toHaveValue(TITULO);
  await nomeDoTreino(page).fill("Rascunho");
  await formulario(page).getByRole("button", { name: "Cancelar" }).press("Enter");
  await expect(salvarComo(page)).toBeFocused();
  expect(await lerDoMock(conta, TABELA)).toEqual([]);

  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await salvarComo(page).click();
  await expect(nomeDoTreino(page)).toHaveValue(TITULO);
  await nomeDoTreino(page).fill("  ");
  await expect(confirmar(page)).toBeDisabled();
  await nomeDoTreino(page).fill(nome);

  // Uma falha real de armazenamento na primeira tentativa mantém o nome e permite tentar de novo.
  await page.evaluate(() => {
    const adicionar = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "outbox" && args[0]?.tipo === "modelo_de_treino") {
        IDBObjectStore.prototype.add = adicionar;
        throw new DOMException("Armazenamento cheio", "QuotaExceededError");
      }
      return adicionar.apply(this, args);
    };
  });
  await confirmar(page).click();
  await expect(formulario(page).getByRole("alert")).toBeVisible();
  await expect(nomeDoTreino(page)).toHaveValue(nome);
  expect(await naFila(page)).toBe(0);
  // O segundo toque chega antes de o React redesenhar o controle.
  await confirmar(page).evaluate((btn: HTMLButtonElement) => { btn.click(); btn.click(); });
  await expect(salvarComo(page)).toBeFocused();
  await expect(detalhe(page).getByRole("status").filter({ hasText: /Treino salvo/ })).toBeVisible();
  await expect(detalhe(page).getByRole("region", { name: /Flexão de braço/ })).toContainText("7 repetições");
  await expect(detalhe(page).getByRole("region", { name: /Supino reto com barra/ })).toContainText("8 repetições · 22,5 kg na barra");
  await expect.poll(() => naFila(page)).toBe(1);
  expect(await lerDoMock(conta, TABELA)).toEqual([]);

  await detalhe(page).getByRole("button", { name: "Fechar", exact: true }).click();
  await irNaAba(page, "Treino");
  await semRedeNoWorker(worker);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await esperarAbaTreino(page);
  await expect(page.getByRole("region", { name: "Treino aberto", exact: true })).toHaveCount(0);
  await carregar(page, nome);
  const escolhidos = editor(page).getByRole("list", { name: "Escolhidos" }).getByRole("button", { name: /^Tirar / });
  await expect(escolhidos).toHaveCount(2);
  await expect(escolhidos.nth(0)).toHaveAccessibleName("Tirar Flexão de braço");
  await expect(escolhidos.nth(1)).toHaveAccessibleName("Tirar Rosca com elástico");
  await expect(editor(page).locator("summary").filter({ hasText: "Equipamentos disponíveis" })).toContainText("Elástico e Tatame");
  await ajustar(page).click();
  await expect(campo(page, "Flexão de braço")).toHaveValue("2");
  await expect(campo(page, "Rosca com elástico")).toHaveValue("4");
  await expect(descanso(page, "Flexão de braço")).toHaveValue("95");

  await comRedeNoWorker(await workerDoApp(context));
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  const modelos = await lerDoMock<ModeloDeTreino>(conta, TABELA);
  expect(modelos).toMatchObject([{
    user_id: conta.userId, nome, exercicios: [FLEXAO, ROSCA],
    series_por_exercicio: { [FLEXAO]: 2, [ROSCA]: 4 }, descansos_por_exercicio: { [FLEXAO]: 95 },
  }]);
  expect(modelos[0]?.descansos_por_exercicio).toEqual({ [FLEXAO]: 95 });
  expect(modelos[0]?.equipamento_disponivel?.toSorted()).toEqual(["super-band", "tatame"]);
  const envios = (await requisicoesDoMock()).filter(r => r.metodo === "POST" && r.caminho === "/rest/v1/" + TABELA);
  expect(envios).toHaveLength(1);
  expect(await lerDoMock(conta, "sessions")).toEqual(sessoes);
  expect(await lerDoMock(conta, "session_sets")).toEqual(series);
});

test("um modelo do Histórico pertence à conta que o salvou e os registros antigos sem plano continuam legíveis", async ({ page }) => {
  test.slow(); // O mesmo aparelho sai da primeira conta e autentica a segunda.
  await definirCota(2);
  const a = await usuarioComPerfil();
  const emailB = "modelo-historico-b@example.test";
  const b = await sessaoNoMock(emailB);
  await atualizarNoMock(b, "profiles", `user_id=eq.${b.userId}`, {
    nome: "Beatriz", data_inicio: DIA, fase_atual: "fase1", fase_desde: DIA, prefs: { guia_visto: true },
  });
  await semearConcluida(a, planoFinal(), "Treino da primeira conta");
  const notaB = "Meu registro antigo";
  await semearConcluida(b, null, notaB);
  await entrarNoApp(page);
  await abrirSeries(page, "Treino da primeira conta");
  await expect(salvarComo(page)).toBeVisible();
  await salvarComo(page).click();
  await confirmar(page).click();
  await expect.poll(() => lerDoMock(a, TABELA)).toMatchObject([{ user_id: a.userId, nome: TITULO }]);
  await expect.poll(() => naFila(page)).toBe(0);
  await detalhe(page).getByRole("button", { name: "Fechar", exact: true }).click();
  await irNaAba(page, "Mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarNoApp(page, emailB);
  await abrirSeries(page, notaB);
  await expect(detalhe(page)).toContainText("8 repetições · 22,5 kg na barra");
  await expect(salvarComo(page)).toHaveCount(0);
  await detalhe(page).getByRole("button", { name: "Fechar", exact: true }).click();
  await irNaAba(page, "Treino");
  await personalizar(page).click();
  await editor(page).getByRole("button", { name: "Treinos salvos", exact: true }).click();
  await expect(dialogo(page, "Treinos salvos").getByText(/Nenhum treino salvo/)).toBeVisible();
  expect(await lerDoMock(b, TABELA)).toEqual([]);
});

test("salvar uma sessão concluída deixa o outro treino aberto na mesma série", async ({ page }) => {
  test.slow(); // Faz o percurso player → Histórico → player, com uma gravação em cada tela.
  const { conta, id } = await treinoAberto(page);
  await page.getByRole("button", { name: "Concluir série", exact: true }).click();
  await expect.poll(() => seriesDaSessao(conta, id)).toHaveLength(1);
  await abrirVisaoGeral(page);
  await geral(page).getByRole("link", { name: "Continuar depois", exact: true }).click();
  await esperarAbaTreino(page);
  await expect.poll(() => naFila(page)).toBe(0);
  const aberta = () => lerDoMock(conta, "sessions", `id=eq.${id}`);
  const sessaoAntes = await aberta();
  const seriesAntes = await seriesDaSessao(conta, id);
  const nota = "Sessão anterior à atual";
  await semearConcluida(conta, planoFinal(), nota);
  await abrirSeries(page, nota);
  await expect(salvarComo(page)).toBeVisible();
  await salvarComo(page).click();
  await confirmar(page).click();
  await expect.poll(() => lerDoMock(conta, TABELA)).toMatchObject([{ nome: TITULO }]);
  await detalhe(page).getByRole("button", { name: "Fechar", exact: true }).click();

  await irNaAba(page, "Treino");
  const continuar = page.getByRole("region", { name: "Treino aberto", exact: true }).getByRole("link", { name: "Continuar" });
  await expect(continuar).toHaveAttribute("href", `/treinar/${id}`);
  await continuar.click();
  await expect(page).toHaveURL(new RegExp(`/treinar/${id}$`));
  await abrirVisaoGeral(page);
  await expect(geral(page).getByRole("checkbox", { name: "Série 1 concluída — Rosca com elástico", exact: true })).toBeChecked();
  expect(await lerDoMock(conta, "sessions", "select=id&status=eq.em_andamento")).toEqual([{ id }]);
  expect(await aberta()).toEqual(sessaoAntes);
  expect(await seriesDaSessao(conta, id)).toEqual(seriesAntes);
});
