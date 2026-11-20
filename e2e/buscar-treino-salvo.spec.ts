import { expect, test, type Page } from "@playwright/test";
import type { LinhaSessao } from "../lib/types";
import {
  abrirVisaoGeral, atualizarNoMock, definirCota, entrarNoApp, esperarAbaTreino, esperarServiceWorker,
  fixarData, inserirNoMock, irNaAba, lerDoMock, naFila, resetarMock, sessaoNoMock, usuarioComPerfil, type SessaoMock,
} from "./fixtures";
import { dialogo, editor } from "./montar-modelo";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { geral } from "./treino-livre-ativo";

const TABELA = "modelos_de_treino";
const TITULO = "Terraço com elástico";
const FLEXAO = "flexao-de-braco";
const SUPINO = "supino-reto-com-barra";
const REMADA = "remada-com-elastico";
const PONTE = "ponte-de-gluteos-no-tatame";
const lista = (page: Page) => dialogo(page, "Treinos salvos");
const linhas = (page: Page) => lista(page).getByRole("list", { name: "Treinos salvos", exact: true }).locator(":scope > li");
const busca = (page: Page) => lista(page).getByRole("searchbox", { name: "Buscar treino salvo", exact: true });
const atalho = (page: Page) => page.getByRole("region", { name: "Treino", exact: true }).getByRole("button", { name: "Treinos salvos", exact: true });
const modelosSalvos = (conta: SessaoMock) => lerDoMock(conta, TABELA, "order=id.asc");

function modelo(conta: SessaoMock, nome: string, exercicios: string[]) {
  return { id: crypto.randomUUID(), user_id: conta.userId, nome, exercicios,
    equipamento_disponivel: null, series_por_exercicio: null, descansos_por_exercicio: null };
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("a busca offline distingue montagens de mesmo nome e tamanho e inicia a escolhida pelo movimento", async ({ page, context }) => {
  test.slow();
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0 } });
  const escolhida = modelo(conta, TITULO, [FLEXAO, REMADA]);
  await inserirNoMock(conta, TABELA, [
    modelo(conta, "Circuito de domingo", [PONTE]), modelo(conta, TITULO, [PONTE]),
    modelo(conta, TITULO, [SUPINO, REMADA]), escolhida, modelo(conta, "Volta à barra", [SUPINO]),
  ]);
  const salvos = await modelosSalvos(conta);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await atalho(page).tap();
  await expect(linhas(page)).toHaveCount(5);
  await page.keyboard.press("Escape");
  await expect(atalho(page)).toBeFocused();
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  let idDaSessao: string;
  try {
    expect((await page.reload())?.fromServiceWorker()).toBe(true);
    await esperarAbaTreino(page);
    await atalho(page).tap();
    await expect(linhas(page)).toHaveCount(5);
    await busca(page).fill("TERRACO COM ELASTICO");
    await expect(linhas(page)).toHaveCount(3);
    await expect(lista(page).getByRole("status")).toHaveText("3 treinos encontrados.");
    const duplas = linhas(page).filter({ hasText: "2 exercícios" });
    await expect(duplas).toHaveCount(2);
    const flexao = duplas.filter({ hasText: "Flexão de braço" });
    const supino = duplas.filter({ hasText: "Supino reto com barra" });
    await expect(flexao.getByText(/Flexão de braço.*Remada com elástico/)).toBeVisible();
    await expect(supino.getByText(/Supino reto com barra.*Remada com elástico/)).toBeVisible();
    for (const acao of ["Começar", "Carregar", "Excluir"]) {
      const botao = { name: `${acao} ${TITULO}`, exact: true };
      await expect(flexao.getByRole("button", botao)).toHaveAccessibleDescription(/Flexão de braço.*Remada com elástico/);
      await expect(supino.getByRole("button", botao)).toHaveAccessibleDescription(/Supino reto com barra.*Remada com elástico/);
    }
    const excluir = flexao.getByRole("button", { name: `Excluir ${TITULO}`, exact: true });
    await excluir.press("Enter");
    await dialogo(page, "Excluir treino?").getByRole("button", { name: "Cancelar", exact: true }).press("Enter");
    await expect(excluir).toBeFocused();
    await expect(busca(page)).toHaveValue("TERRACO COM ELASTICO");
    await expect(linhas(page)).toHaveCount(3);
    await busca(page).fill("burpee na praia");
    await expect(linhas(page)).toHaveCount(0);
    await expect(lista(page).getByRole("status")).toHaveText("Nenhum treino encontrado para essa busca.");
    await lista(page).getByRole("button", { name: "Limpar busca", exact: true }).press("Enter");
    await expect(busca(page)).toBeFocused();
    await expect(busca(page)).toHaveValue("");
    await expect(linhas(page)).toHaveCount(5);
    await busca(page).fill("elastico");
    await flexao.getByRole("button", { name: `Começar ${TITULO}`, exact: true }).tap();
    await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
    idDaSessao = new URL(page.url()).pathname.split("/").at(-1)!;
    await abrirVisaoGeral(page);
    await expect(geral(page).getByRole("heading", { level: 2 })).toHaveText(["1. Flexão de braço", "2. Remada com elástico"]);
    expect(await lerDoMock(conta, "sessions")).toEqual([]);
    expect(await naFila(page)).toBe(1);
  } finally {
    await comRedeNoWorker(await workerDoApp(context));
    await context.setOffline(false);
  }
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await lerDoMock<LinhaSessao>(conta, "sessions")).toMatchObject([{
    id: idDaSessao, user_id: conta.userId, plano: { titulo: TITULO, itens: escolhida.exercicios.map(exercicio_id => ({ exercicio_id })) },
  }]);
  expect(idDaSessao).not.toBe(escolhida.id);
  expect(await modelosSalvos(conta)).toEqual(salvos);
});

test("a busca no mesmo aparelho mostra e carrega apenas as montagens da conta que entrou", async ({ page }) => {
  test.slow();
  await definirCota(2);
  const ana = await usuarioComPerfil();
  const email = "busca-de-treinos@example.test";
  const bia = await sessaoNoMock(email);
  await atualizarNoMock(bia, "profiles", `user_id=eq.${bia.userId}`, {
    nome: "Bia", altura_cm: 175, data_inicio: "2026-09-14", fase_atual: "fase1", fase_desde: "2026-09-14", prefs: { guia_visto: true },
  });
  const privada = "Elástico de Ana";
  await inserirNoMock(ana, TABELA, [modelo(ana, privada, [REMADA]), modelo(ana, "Ponte de Ana", [PONTE])]);
  const homonima = modelo(bia, TITULO, [FLEXAO, REMADA]);
  const escolhida = modelo(bia, TITULO, [SUPINO, REMADA]);
  await inserirNoMock(bia, TABELA, [homonima, escolhida]);
  await entrarNoApp(page);
  await atalho(page).tap();
  await busca(page).fill("elastico");
  await expect(linhas(page)).toHaveCount(1);
  await expect(linhas(page)).toContainText(privada);
  await page.keyboard.press("Escape");
  await irNaAba(page, "Mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarNoApp(page, email);
  await atalho(page).tap();
  await expect(busca(page)).toHaveValue("");
  await busca(page).fill("elastico");
  await expect(linhas(page)).toHaveCount(2);
  await expect(lista(page).getByText(privada, { exact: true })).toHaveCount(0);
  await linhas(page).filter({ hasText: "Supino reto com barra" }).getByRole("button", { name: `Carregar ${TITULO}`, exact: true }).tap();
  const montagem = editor(page).getByRole("list", { name: "Escolhidos" }).getByRole("button", { name: /^Tirar / });
  await expect(montagem).toHaveCount(2);
  await expect(montagem.first()).toHaveAccessibleName("Tirar Supino reto com barra");
  await expect(montagem.last()).toHaveAccessibleName("Tirar Remada com elástico");
  await editor(page).getByRole("button", { name: "Atualizar treino", exact: true }).press("Enter");
  const formulario = dialogo(page, "Atualizar treino");
  await formulario.getByRole("textbox", { name: "Nome do treino" }).fill("Supino de Bia");
  await formulario.getByRole("button", { name: "Salvar alterações", exact: true }).press("Enter");
  await expect.poll(() => lerDoMock(bia, TABELA, `id=eq.${escolhida.id}`)).toMatchObject([{ nome: "Supino de Bia", exercicios: escolhida.exercicios }]);
  expect(await lerDoMock(bia, TABELA, `id=eq.${homonima.id}`)).toMatchObject([{ nome: TITULO, exercicios: homonima.exercicios }]);
  expect(await lerDoMock(bia, "sessions")).toEqual([]);
});

test("abrir a composição distingue a terceira posição de dois homônimos antes de começar", async ({ page }) => {
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0 } });
  const inicio = ["rosca-com-elastico", REMADA];
  const comSupino = modelo(conta, TITULO, [...inicio, SUPINO]);
  const comFlexao = modelo(conta, TITULO, [...inicio, FLEXAO]);
  await inserirNoMock(conta, TABELA, [comSupino, comFlexao]);
  const idAntigo = crypto.randomUUID();
  await inserirNoMock(conta, "sessions", [{
    id: idAntigo, data: "2026-09-13", workout_id: "A1", fase: "fase1", status: "concluida",
    iniciada_em: "2026-09-13T10:00:00Z", concluida_em: "2026-09-13T10:20:00Z", nota_geral: "Primeiro treino no terraço",
  }]);
  await inserirNoMock(conta, "session_sets", [{
    id: crypto.randomUUID(), session_id: idAntigo, exercise_id: SUPINO, ordem_ex: 1, set_index: 1,
    tipo: "trabalho", reps: 8, carga_kg: 22.5, concluida: true, registrada_em: "2026-09-13T10:08:00Z",
  }]);
  const historico = await lerDoMock(conta, "sessions");
  const seriesAntigas = await lerDoMock(conta, "session_sets");
  const salvos = await modelosSalvos(conta);
  await entrarNoApp(page);
  await atalho(page).tap();
  await busca(page).fill("terraco");
  const detalhes = linhas(page).locator("summary").filter({ hasText: "Ver os 3 exercícios" });
  await expect(detalhes).toHaveCount(2);
  await expect(lista(page).getByRole("list", { name: `Exercícios de ${TITULO}`, exact: true })).toHaveCount(0);
  for (const resumo of await detalhes.all()) {
    await resumo.press("Space");
    await expect(resumo).toBeFocused();
  }
  const composicao = page.getByRole("list", { name: `Exercícios de ${TITULO}`, exact: true });
  const flexao = linhas(page).filter({ has: composicao.getByText("Flexão de braço", { exact: true }) });
  const supino = linhas(page).filter({ has: composicao.getByText("Supino reto com barra", { exact: true }) });
  await expect(flexao.getByRole("listitem")).toHaveText(["Rosca com elástico", "Remada com elástico", "Flexão de braço"]);
  await expect(supino.getByRole("listitem")).toHaveText(["Rosca com elástico", "Remada com elástico", "Supino reto com barra"]);
  const excluir = flexao.getByRole("button", { name: `Excluir ${TITULO}`, exact: true });
  await excluir.press("Enter");
  await dialogo(page, "Excluir treino?").getByRole("button", { name: "Cancelar", exact: true }).press("Enter");
  await expect(excluir).toBeFocused();
  await expect(flexao.getByText("Flexão de braço", { exact: true })).toBeVisible();
  await expect(busca(page)).toHaveValue("terraco");
  expect(await lerDoMock(conta, "sessions")).toEqual(historico);
  expect(await naFila(page)).toBe(0);
  await flexao.getByRole("button", { name: `Começar ${TITULO}`, exact: true }).tap();
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  const idNovo = new URL(page.url()).pathname.split("/").at(-1)!;
  await abrirVisaoGeral(page);
  await expect(geral(page).getByRole("heading", { level: 2 })).toHaveText(["1. Rosca com elástico", "2. Remada com elástico", "3. Flexão de braço"]);
  await expect.poll(() => lerDoMock(conta, "sessions", `id=eq.${idNovo}`)).toMatchObject([{
    plano: { titulo: TITULO, itens: comFlexao.exercicios.map(exercicio_id => ({ exercicio_id })) },
  }]);
  expect(await lerDoMock(conta, "sessions", `id=eq.${idAntigo}`)).toEqual(historico);
  expect(await lerDoMock(conta, "session_sets")).toEqual(seriesAntigas);
  expect(await modelosSalvos(conta)).toEqual(salvos);
});
