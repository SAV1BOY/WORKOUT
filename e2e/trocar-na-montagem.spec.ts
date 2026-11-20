import { expect, test, type Locator, type Page } from "@playwright/test";
import type { ModeloDeTreino } from "../lib/modelo-de-treino";
import type { LinhaSessao } from "../lib/types";
import {
  abrirVisaoGeral, entrarNoApp, esperarServiceWorker, fixarData, inserirNoMock,
  lerDoMock, marcarSerieNaVisaoGeral, naFila, requisicoesDoMock, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { ajustar, campo, carregar, descanso, dialogo, editor, personalizar, pronto } from "./montar-modelo";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { geral, series } from "./treino-livre-ativo";

const PONTE = "ponte-de-gluteos-no-tatame";
const ORIGINAL = "agachamento-livre";
const ALTERNATIVA = "agachamento-com-peso-corporal";
const REMADA = "remada-com-elastico";
const nomeOriginal = "Agachamento livre";
const nomeAlternativa = "Agachamento com peso corporal";
const nomeRemada = "Remada com elástico";
const tabela = "modelos_de_treino";

async function prepararModelo(page: Page) {
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  const modelo: ModeloDeTreino = {
    id: crypto.randomUUID(), user_id: conta.userId, nome: "Força de segunda",
    exercicios: [PONTE, ORIGINAL, REMADA], equipamento_disponivel: null,
    series_por_exercicio: { [ORIGINAL]: 4, [REMADA]: 5 },
    descansos_por_exercicio: { [ORIGINAL]: 120, [REMADA]: 95 },
  };
  await inserirNoMock(conta, tabela, [{ ...modelo }]);
  await entrarNoApp(page);
  await carregar(page, modelo.nome);
  return { conta, modelo };
}

const escolhidos = (page: Page) => editor(page).getByRole("list", { name: "Escolhidos", exact: true });
const acao = (onde: Locator, nome: string) => onde.getByRole("button", { name: nome, exact: true });

async function abrirTroca(page: Page) {
  await acao(escolhidos(page), "Trocar " + nomeOriginal).click();
  return dialogo(page, "Trocar exercício");
}

function alternativa(folha: Locator, page: Page) {
  return folha.getByRole("list", { name: "Exercícios alternativos" }).getByRole("button")
    .filter({ has: page.getByText(nomeAlternativa, { exact: true }) });
}

async function ativarDuasVezes(botao: Locator) {
  await expect(botao).toBeEnabled();
  // Duas ativações antes de o React desmontar ou desabilitar o controle.
  await botao.evaluate((el: HTMLButtonElement) => { el.click(); el.click(); });
}

async function conferirOrdem(page: Page, segundo: string) {
  const itens = escolhidos(page).getByRole("listitem");
  await expect(itens).toHaveCount(3);
  for (const [i, nome] of ["Ponte de glúteos no tatame", segundo, nomeRemada].entries()) {
    await expect(acao(itens.nth(i), "Tirar " + nome)).toBeVisible();
  }
}

async function escritasDeModelos() {
  return (await requisicoesDoMock()).filter(r =>
    r.caminho === "/rest/v1/" + tabela && !["GET", "HEAD"].includes(r.metodo),
  ).length;
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("trocar um agachamento sem cavalete mantém a posição e inicia com a progressão do substituto", async ({ page }) => {
  const { conta, modelo } = await prepararModelo(page);
  await inserirNoMock(conta, "exercise_state", [
    { user_id: conta.userId, exercise_id: ORIGINAL, carga_atual_kg: 41.5, reps_alvo: 5, falhas_seguidas: 0 },
    { user_id: conta.userId, exercise_id: ALTERNATIVA, reps_alvo: 17, falhas_seguidas: 0 },
  ]);
  const escritasAntes = await escritasDeModelos();
  await editor(page).locator("summary").filter({ hasText: "Equipamentos disponíveis" }).click();
  await editor(page).getByRole("checkbox", { name: /cavalete/i }).uncheck();
  await expect(acao(escolhidos(page), "Tirar " + nomeOriginal)).toHaveAccessibleDescription(/Requer outro material/);

  const folha = await abrirTroca(page);
  const opcoes = folha.getByRole("list", { name: "Exercícios alternativos" });
  await expect(alternativa(folha, page)).toBeVisible();
  // Ambos seriam equivalentes: o frontal precisa do cavalete e a ponte já ocupa a primeira posição.
  await expect(opcoes.getByText("Agachamento frontal", { exact: true })).toHaveCount(0);
  await expect(opcoes.getByText("Ponte de glúteos no tatame", { exact: true })).toHaveCount(0);
  await folha.getByRole("searchbox").fill("corporal agachamento");
  await ativarDuasVezes(alternativa(folha, page));
  await conferirOrdem(page, nomeAlternativa);
  await ativarDuasVezes(acao(editor(page), "Começar com 3 exercícios"));
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;

  await abrirVisaoGeral(page);
  const visao = geral(page);
  await expect(visao.getByRole("heading", { level: 2 })).toHaveText([
    "1. Ponte de glúteos no tatame", "2. " + nomeAlternativa, "3. " + nomeRemada,
  ]);
  const primeira = visao.getByRole("group", { name: "Série 1 — " + nomeAlternativa, exact: true });
  await expect(primeira.getByRole("textbox", { name: "repetições", exact: true })).toHaveValue("17");
  await marcarSerieNaVisaoGeral(primeira.getByRole("checkbox"));
  await expect.poll(() => series(conta, id)).toMatchObject([{
    exercise_id: ALTERNATIVA, ordem_ex: 2, reps_alvo_min: 8, reps_alvo_max: 17, reps: 17, concluida: true,
  }]);
  await expect.poll(() => naFila(page)).toBe(0);
  const sessoes = await lerDoMock<LinhaSessao>(conta, "sessions");
  expect(sessoes).toMatchObject([{ id, workout_id: "livre", plano: { titulo: modelo.nome, itens: [
    { exercicio_id: PONTE }, { exercicio_id: ALTERNATIVA, series: 3, tipo: "reps", min: 8, max: 12, descanso_s: 60 },
    { exercicio_id: REMADA, series: 5 },
  ] } }]);
  expect(sessoes[0]?.plano?.descansos_por_exercicio).toEqual({ [REMADA]: 95 });
  expect(sessoes[0]?.plano?.equipamento_disponivel).toContain("tatame");
  expect(sessoes[0]?.plano?.equipamento_disponivel).not.toContain("cavalete");
  expect(await lerDoMock(conta, tabela)).toEqual([modelo]);
  expect(await escritasDeModelos()).toBe(escritasAntes);
});

test("desfazer recupera os ajustes, e atualizar sem rede envia só a troca confirmada após a recarga", async ({ page, context }) => {
  test.slow(); // O teste instala o worker e reabre o modelo com a página e o worker sem rede.
  const { conta, modelo } = await prepararModelo(page);
  await esperarServiceWorker(page);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  const escritasAntes = await escritasDeModelos();
  await alternativa(await abrirTroca(page), page).click();
  await conferirOrdem(page, nomeAlternativa);
  await acao(editor(page), "Desfazer troca").click();
  await conferirOrdem(page, nomeOriginal);
  await ajustar(page).click();
  await expect(campo(page, nomeOriginal)).toHaveValue("4");
  await expect(descanso(page, nomeOriginal)).toHaveValue("120");
  await expect(campo(page, nomeRemada)).toHaveValue("5");
  await expect(descanso(page, nomeRemada)).toHaveValue("95");
  await pronto(page);
  await alternativa(await abrirTroca(page), page).click();
  await conferirOrdem(page, nomeAlternativa);
  expect(await naFila(page)).toBe(0);

  await acao(editor(page), "Atualizar treino").click();
  await ativarDuasVezes(acao(dialogo(page, "Atualizar treino"), "Salvar alterações"));
  await expect(editor(page)).toBeVisible();
  await expect.poll(() => naFila(page)).toBe(1);
  expect(await lerDoMock(conta, tabela)).toEqual([modelo]);
  expect(await escritasDeModelos()).toBe(escritasAntes);
  await page.keyboard.press("Escape");
  await expect(personalizar(page)).toBeFocused();
  await semRedeNoWorker(worker);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await carregar(page, modelo.nome);
  await conferirOrdem(page, nomeAlternativa);
  await ajustar(page).click();
  await expect(campo(page, nomeAlternativa).getByRole("option", { selected: true })).toHaveText("Padrão (3)");
  await expect(descanso(page, nomeAlternativa)).toHaveValue("");
  await expect(campo(page, nomeRemada)).toHaveValue("5");
  await expect(descanso(page, nomeRemada)).toHaveValue("95");
  await pronto(page);

  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await escritasDeModelos()).toBe(escritasAntes + 1);
  expect(await lerDoMock(conta, tabela)).toEqual([{
    ...modelo, exercicios: [PONTE, ALTERNATIVA, REMADA], series_por_exercicio: { [REMADA]: 5 },
    descansos_por_exercicio: { [REMADA]: 95 },
  }]);
  expect(await lerDoMock(conta, "sessions")).toHaveLength(0);
});

test("explica quando a única alternativa compatível com o material já está no treino", async ({ page }) => {
  const conta = await usuarioComPerfil();
  const nome = "Posteriores com elástico";
  await inserirNoMock(conta, tabela, [{
    id: crypto.randomUUID(), user_id: conta.userId, nome,
    exercicios: ["stiff-terra-romeno", "good-morning-com-elastico"], equipamento_disponivel: ["super-band"],
    series_por_exercicio: null, descansos_por_exercicio: null,
  }]);
  await entrarNoApp(page);
  await carregar(page, nome);
  const trocar = acao(escolhidos(page), "Trocar Stiff / terra romeno");
  await trocar.click();
  const folha = dialogo(page, "Trocar exercício");
  await expect(folha.getByRole("status")).toHaveText("As alternativas compatíveis com este filtro já estão no treino.");
  await expect(folha.getByRole("list", { name: "Exercícios alternativos" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await acao(escolhidos(page), "Tirar Good morning com elástico").click();
  await trocar.click();
  const opcoes = folha.getByRole("list", { name: "Exercícios alternativos" });
  await expect(opcoes.getByRole("button", { name: /^Good morning com elástico / })).toBeVisible();
});
