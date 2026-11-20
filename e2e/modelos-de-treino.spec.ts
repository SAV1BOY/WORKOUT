import { expect, test, type Locator, type Page } from "@playwright/test";
import type { ModeloDeTreino } from "../lib/modelo-de-treino";
import type { LinhaSessao } from "../lib/types";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, atualizarNoMock, definirCota, entrarNoApp, esperarAbaTreino,
  esperarServiceWorker, fixarData, inserirNoMock, irNaAba, lerDoMock, naFila, requisicoesDoMock,
  resetarMock, sessaoNoMock, usuarioComPerfil, type SessaoMock,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { abrirCatalogo, catalogo, FRONTAL, geral, NOME as AGACHAMENTO, series } from "./treino-livre-ativo";

const PONTE = "Ponte de glúteos no tatame";
const REMADA = "Remada com elástico";
const FAIXA = "Elástico (Super Band)";
const TABELA = "modelos_de_treino";
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const personalizar = (page: Page) => page.getByRole("button", { name: /Personalizar treino/ });
const dialogo = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });
const editor = (page: Page) => dialogo(page, "Crie o seu próprio");
const biblioteca = (page: Page) => dialogo(page, "Treinos salvos");
const botao = (onde: Locator, name: string) => onde.getByRole("button", { name, exact: true });

async function escolher(page: Page, nome: string) {
  const folha = editor(page);
  await folha.getByRole("searchbox", { name: "Buscar exercício pelo nome" }).fill(nome);
  const item = folha.getByRole("list", { name: "Catálogo" }).getByRole("button")
    .filter({ has: page.getByText(nome, { exact: true }) });
  await item.click();
  await expect(item).toHaveAttribute("aria-pressed", "true");
}

async function conferirEscolhidos(page: Page, nomes: string[]) {
  const botoes = editor(page).getByRole("list", { name: "Escolhidos" }).getByRole("button");
  await expect(botoes).toHaveCount(nomes.length);
  for (const [i, nome] of nomes.entries()) await expect(botoes.nth(i)).toHaveAccessibleName(`Tirar ${nome}`);
}

async function abrirMaterial(folha: Locator) {
  const grupo = folha.getByRole("group", { name: "Equipamento de hoje", exact: true });
  if (!await grupo.isVisible()) await folha.locator("summary").filter({ hasText: "Equipamentos disponíveis" }).click();
  return grupo;
}

async function conferirKit(folha: Locator) {
  const grupo = await abrirMaterial(folha);
  await expect(grupo.getByRole("checkbox", { checked: true })).toHaveCount(2);
  for (const nome of ["Tatame", FAIXA]) await expect(grupo.getByRole("checkbox", { name: nome, exact: true })).toBeChecked();
}

async function abrirBiblioteca(page: Page) {
  await botao(editor(page), "Treinos salvos").press("Enter");
  await expect(biblioteca(page)).toBeVisible();
}

async function carregar(page: Page, nome: string) {
  await botao(biblioteca(page), `Carregar ${nome}`).press("Enter");
  await expect(editor(page)).toBeVisible();
}

async function tocarDuasVezes(acao: Locator) {
  await expect(acao).toBeEnabled();
  // Ativa o mesmo controle duas vezes antes do redesenho que o desabilita.
  await acao.evaluate((alvo: HTMLButtonElement) => { alvo.click(); alvo.click(); });
}

async function nomear(page: Page, nome: string) {
  const salvar = botao(editor(page), "Salvar treino");
  await expect(salvar).toBeVisible();
  await salvar.click();
  const formulario = dialogo(page, "Salvar treino");
  await formulario.getByRole("textbox", { name: "Nome do treino" }).fill(nome);
  return botao(formulario, "Salvar");
}

async function iniciar(page: Page, acao: string) {
  await tocarDuasVezes(botao(editor(page), acao));
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  expect(id).toMatch(UUID);
  await abrirVisaoGeral(page);
  return id;
}

async function contarEnvios(tabela: string) {
  return (await requisicoesDoMock()).filter(r => r.metodo === "POST" && r.caminho === `/rest/v1/${tabela}`).length;
}

async function sair(page: Page) {
  await expect.poll(() => naFila(page)).toBe(0);
  await irNaAba(page, "Mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("salva antes da primeira sessão, reabre o modelo sem rede e envia cada criação uma vez", async ({ page, context }) => {
  test.slow(); // Instala o worker, recarrega a aba Treino e inicia o player com ambas as redes desligadas.
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0 } });
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await personalizar(page).press("Enter");
  const grupo = await abrirMaterial(editor(page));
  await botao(grupo, "Só peso do corpo").click();
  for (const nome of ["Tatame", FAIXA]) await grupo.getByRole("checkbox", { name: nome, exact: true }).check();
  await escolher(page, PONTE);
  await escolher(page, REMADA);
  await botao(editor(page), "Reordenar escolhidos").click();
  const ordem = dialogo(page, "Reordenar escolhidos");
  await botao(ordem, `Subir ${REMADA}`).click();
  await botao(ordem, "Pronto").click();
  await conferirEscolhidos(page, [REMADA, PONTE]);

  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  const nome = "Tatame e faixa";
  await tocarDuasVezes(await nomear(page, nome));
  await expect(botao(editor(page), "Atualizar treino")).toBeVisible();
  await expect.poll(() => naFila(page)).toBe(1);
  await page.keyboard.press("Escape");
  await expect(personalizar(page)).toBeFocused();
  await semRedeNoWorker(worker);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await esperarAbaTreino(page);
  await expect(page.getByRole("region", { name: "Treino aberto", exact: true })).toHaveCount(0);
  await personalizar(page).press("Enter");
  await abrirBiblioteca(page);
  await expect(biblioteca(page).getByRole("button", { name: /^Carregar / })).toHaveCount(1);
  await carregar(page, nome);
  await conferirEscolhidos(page, [REMADA, PONTE]);
  await conferirKit(editor(page));
  expect(await lerDoMock(conta, TABELA)).toHaveLength(0);
  expect(await lerDoMock(conta, "sessions")).toHaveLength(0);
  expect(await lerDoMock(conta, "session_sets")).toHaveLength(0);

  const id = await iniciar(page, "Começar com 2 exercícios");
  await expect(geral(page).getByRole("heading", { level: 1 })).toHaveText(nome);
  await expect(geral(page).getByRole("heading", { level: 2 })).toHaveText([`1. ${REMADA}`, `2. ${PONTE}`]);
  await abrirCatalogo(page).click();
  await conferirKit(catalogo(page));
  await catalogo(page).getByRole("searchbox").fill("Remada baixa na polia");
  await expect(catalogo(page).getByRole("button", { name: "Adicionar Remada baixa na polia", exact: true })).toHaveCount(0);
  expect(await contarEnvios(TABELA)).toBe(0);
  expect(await contarEnvios("sessions")).toBe(0);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  const modelos = await lerDoMock<ModeloDeTreino>(conta, TABELA);
  expect(modelos).toMatchObject([{
    id: expect.stringMatching(UUID), user_id: conta.userId, nome, exercicios: ["remada-com-elastico", "ponte-de-gluteos-no-tatame"],
  }]);
  expect(modelos[0]?.equipamento_disponivel?.toSorted()).toEqual(["super-band", "tatame"]);
  const sessoes = await lerDoMock<LinhaSessao>(conta, "sessions");
  expect(sessoes).toMatchObject([{ id, workout_id: "livre", plano: { titulo: nome, itens: [
    { exercicio_id: "remada-com-elastico" }, { exercicio_id: "ponte-de-gluteos-no-tatame" },
  ] } }]);
  expect(sessoes[0]?.plano?.equipamento_disponivel?.toSorted()).toEqual(["super-band", "tatame"]);
  expect(await contarEnvios(TABELA)).toBe(1);
  expect(await contarEnvios("sessions")).toBe(1);
  expect(await series(conta, id)).toHaveLength(0);
});

test("editar e excluir o modelo preserva as sessões e a progressão usada em cada início", async ({ page }) => {
  test.slow(); // Dois treinos reais do mesmo modelo, com uma alteração da carga entre as sessões.
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  await inserirNoMock(conta, "exercise_state", [{
    user_id: conta.userId, exercise_id: FRONTAL, carga_atual_kg: 15.5, reps_alvo: 5, falhas_seguidas: 0,
    incremento_reduzido: false, exigir_rep_extra: false, semana_leve: false, sessoes_graca: 0, desativado: false,
  }]);
  const anterior = "Força de segunda";
  const atual = "Agachamento de quarta";
  await entrarNoApp(page);
  await personalizar(page).click();
  await escolher(page, AGACHAMENTO);
  await escolher(page, REMADA);
  await (await nomear(page, anterior)).click();
  await expect(botao(editor(page), "Atualizar treino")).toBeVisible();
  await expect.poll(() => lerDoMock(conta, TABELA)).toMatchObject([{ nome: anterior }]);
  expect(await lerDoMock(conta, "sessions")).toHaveLength(0);
  expect(await lerDoMock(conta, "session_sets")).toHaveLength(0);
  const primeira = await iniciar(page, "Começar com 2 exercícios");
  const primeiraSerie = geral(page).getByRole("group", { name: `Série 1 — ${AGACHAMENTO}`, exact: true });
  const carga = primeiraSerie.getByRole("textbox", { name: "carga na barra" });
  await expect(carga).toHaveValue("15,5");
  await primeiraSerie.getByRole("checkbox").check();
  await botao(geral(page), "Concluir").click();
  await botao(dialogo(page, "Treino concluído"), "Salvar e voltar").click();
  await esperarAbaTreino(page);
  await expect.poll(() => lerDoMock(conta, "sessions")).toMatchObject([{ id: primeira, status: "concluida", plano: { titulo: anterior } }]);
  await expect.poll(() => series(conta, primeira)).toMatchObject([{ id: expect.stringMatching(UUID), carga_kg: 15.5, concluida: true }]);
  await expect.poll(() => naFila(page)).toBe(0);
  const sessaoAnterior = await lerDoMock(conta, "sessions");
  const seriesAnteriores = await series(conta, primeira);
  const [modelo] = await lerDoMock<ModeloDeTreino>(conta, TABELA);
  if (!modelo) throw new Error("O treino salvo precisa continuar na conta depois da primeira sessão.");

  // A conta atualizou sua progressão enquanto a montagem estava salva.
  await atualizarNoMock(conta, "exercise_state", `exercise_id=eq.${FRONTAL}`, { carga_atual_kg: 31.5 });
  await page.reload();
  await personalizar(page).click();
  await abrirBiblioteca(page);
  await carregar(page, anterior);
  await botao(editor(page), `Tirar ${REMADA}`).click();
  await botao(editor(page), "Atualizar treino").press("Enter");
  const formulario = dialogo(page, "Atualizar treino");
  const campo = formulario.getByRole("textbox", { name: "Nome do treino" });
  await expect(campo).toHaveValue(anterior);
  await campo.fill(atual);
  await botao(formulario, "Salvar alterações").press("Enter");
  await expect.poll(() => lerDoMock(conta, TABELA)).toMatchObject([{ id: modelo.id, nome: atual, exercicios: [FRONTAL] }]);
  await abrirBiblioteca(page);
  await expect(botao(biblioteca(page), `Carregar ${anterior}`)).toHaveCount(0);
  await carregar(page, atual);
  await conferirEscolhidos(page, [AGACHAMENTO]);
  const segunda = await iniciar(page, "Começar com 1 exercício");
  expect(segunda).not.toBe(primeira);
  await expect(geral(page).getByRole("heading", { level: 1 })).toHaveText(atual);
  await expect(geral(page).getByRole("heading", { level: 2 })).toHaveText([`1. ${AGACHAMENTO}`]);
  await expect(geral(page).getByRole("checkbox", { checked: true })).toHaveCount(0);
  await expect(carga).toHaveValue("31,5");
  await primeiraSerie.getByRole("checkbox").check();
  await expect.poll(() => series(conta, segunda)).toMatchObject([{ id: expect.stringMatching(UUID), concluida: true, carga_kg: 31.5 }]);
  const seriesNovas = await series(conta, segunda);
  expect(seriesNovas[0]!.id).not.toBe(seriesAnteriores[0]!.id);
  await geral(page).getByRole("link", { name: "Continuar depois", exact: true }).click();
  await esperarAbaTreino(page);
  await personalizar(page).click();
  await abrirBiblioteca(page);
  const excluir = botao(biblioteca(page), `Excluir ${atual}`);
  await excluir.press("Enter");
  const confirmacao = dialogo(page, "Excluir treino?");
  await botao(confirmacao, "Cancelar").press("Enter");
  await expect(excluir).toBeFocused();
  expect(await lerDoMock(conta, TABELA)).toHaveLength(1);
  await excluir.press("Enter");
  await botao(confirmacao, "Excluir treino").press("Enter");
  await expect(biblioteca(page)).toBeVisible();
  await expect(botao(biblioteca(page), `Carregar ${atual}`)).toHaveCount(0);
  await expect.poll(() => lerDoMock(conta, TABELA)).toHaveLength(0);
  expect(await lerDoMock(conta, "sessions", `id=eq.${primeira}`)).toEqual(sessaoAnterior);
  expect(await series(conta, primeira)).toEqual(seriesAnteriores);
  expect(await lerDoMock(conta, "sessions", `id=eq.${segunda}`)).toMatchObject([{ status: "em_andamento", plano: { titulo: atual } }]);
  expect(await series(conta, segunda)).toEqual(seriesNovas);
  await page.keyboard.press("Escape");
  await expect(botao(editor(page), "Treinos salvos")).toBeFocused();
  await page.keyboard.press("Escape");
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  await expect(page.getByRole("list", { name: "Registros", exact: true })).toContainText(anterior);
});

test("duas contas no mesmo celular guardam e recuperam suas próprias montagens", async ({ page }) => {
  test.slow(); // Sai e volta à primeira conta na mesma instalação.
  await definirCota(2);
  const a = await usuarioComPerfil();
  const emailB = "modelos-b@example.test";
  const b = await sessaoNoMock(emailB);
  await atualizarNoMock(b, "profiles", `user_id=eq.${b.userId}`, {
    nome: "Beatriz", altura_cm: 175, data_inicio: "2026-09-14", fase_atual: "fase1", fase_desde: "2026-09-14", prefs: { guia_visto: true },
  });
  const salvarNaConta = async (nome: string, exercicio: string, conta: SessaoMock) => {
    await escolher(page, exercicio);
    await (await nomear(page, nome)).click();
    await expect(botao(editor(page), "Atualizar treino")).toBeVisible();
    await expect.poll(() => lerDoMock(conta, TABELA)).toMatchObject([{ user_id: conta.userId, nome }]);
    await page.keyboard.press("Escape");
    await sair(page);
  };

  const treinoA = "Remada de Ana";
  const treinoB = "Ponte de Beatriz";
  await entrarNoApp(page);
  await personalizar(page).click();
  await salvarNaConta(treinoA, REMADA, a);
  await entrarNoApp(page, emailB);
  await personalizar(page).click();
  await abrirBiblioteca(page);
  await expect(biblioteca(page).getByText(/^Nenhum treino salvo/)).toBeVisible();
  await expect(biblioteca(page).getByRole("button", { name: /^Carregar / })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(botao(editor(page), "Treinos salvos")).toBeFocused();
  await salvarNaConta(treinoB, PONTE, b);

  await entrarNoApp(page);
  await personalizar(page).click();
  await abrirBiblioteca(page);
  await expect(biblioteca(page).getByRole("button", { name: /^Carregar / })).toHaveCount(1);
  await expect(botao(biblioteca(page), `Carregar ${treinoB}`)).toHaveCount(0);
  await carregar(page, treinoA);
  await conferirEscolhidos(page, [REMADA]);
  expect(await lerDoMock(b, TABELA)).toMatchObject([{ user_id: b.userId, nome: treinoB, exercicios: ["ponte-de-gluteos-no-tatame"] }]);
  for (const conta of [a, b]) expect(await lerDoMock(conta, "sessions")).toHaveLength(0);
});

test("um treino de catálogo futuro deixa os outros treinos disponíveis na biblioteca", async ({ page }) => {
  const conta = await usuarioComPerfil();
  const conhecido = "Água e tatame";
  const futuro = "Zigue-zague no trenó";
  // O servidor entrega pelo UUID. Na tela os nomes precisam continuar em ordem de leitura em português.
  await inserirNoMock(conta, TABELA, [
    { id: "10000000-0000-4000-8000-000000000001", user_id: conta.userId, nome: futuro,
      exercicios: ["zigue-zague-no-treno"], equipamento_disponivel: ["treno-de-treino"] },
    { id: "20000000-0000-4000-8000-000000000002", user_id: conta.userId, nome: conhecido,
      exercicios: ["ponte-de-gluteos-no-tatame"], equipamento_disponivel: ["tatame"] },
  ]);
  await entrarNoApp(page);
  await personalizar(page).click();
  await abrirBiblioteca(page);
  const linhas = biblioteca(page).getByRole("listitem");
  await expect(linhas).toHaveCount(2);
  const vizinho = botao(linhas.first(), `Carregar ${conhecido}`);
  await expect(vizinho).toBeEnabled();
  const novo = botao(linhas.last(), `Carregar ${futuro}`);
  await expect(novo).toBeDisabled();
  const aviso = "Atualize o app para usar este treino";
  await expect(linhas.last().getByText(aviso, { exact: true })).toBeVisible();
  await expect(novo).toHaveAccessibleDescription(aviso);
  await vizinho.press("Enter");
  await conferirEscolhidos(page, [PONTE]);
  await expect(botao(editor(page), "Começar com 1 exercício")).toBeEnabled();
  expect(await lerDoMock(conta, "sessions")).toHaveLength(0);
  expect(await lerDoMock(conta, "session_sets")).toHaveLength(0);
});
