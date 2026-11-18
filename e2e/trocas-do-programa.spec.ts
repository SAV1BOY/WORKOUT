import { expect, test, type Page } from "@playwright/test";
import programa from "../data/programa.json";
import type { LinhaSerie } from "../lib/types";
import {
  abrirVisaoGeral,
  atualizarNoMock,
  comecarOTreinoDoDia,
  definirCota,
  entrarNoApp,
  esperarAbaTreino,
  esperarServiceWorker,
  fixarData,
  inserirNoMock,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  sessaoNoMock,
  type SessaoMock,
} from "./fixtures";

const A = "atleta-a@example.test";
const B = "atleta-b@example.test";
const DIA_A = "2026-09-14T08:00:00-03:00";
const DIA_B = "2026-09-16T08:00:00-03:00";
const PROXIMO_A = "2026-09-18T08:00:00-03:00";
const OUTRA_SEMANA = "2026-09-21T08:00:00-03:00";

async function criarConta(email: string) {
  const conta = await sessaoNoMock(email);
  await atualizarNoMock(conta, "profiles", `user_id=eq.${conta.userId}`, {
    nome: "Atleta de teste",
    data_inicio: "2026-09-14",
    fase_atual: "fase1",
    fase_desde: "2026-09-14",
    prefs: { guia_visto: true },
  });
  return conta;
}

async function preferencias(conta: SessaoMock) {
  const linhas = await lerDoMock<{ workout_id: string; exercicio_original_id: string; substituto_id: string }>(
    conta, "trocas_do_programa",
  );
  return linhas.map(linha => [linha.workout_id, linha.exercicio_original_id, linha.substituto_id]).sort();
}

function seriesDaSessao(conta: SessaoMock, sessaoId: string) {
  return lerDoMock<LinhaSerie>(
    conta, "session_sets", `select=id,session_id,exercise_id,set_index,tipo,reps,carga_kg,concluida&session_id=eq.${sessaoId}&concluida=eq.true`,
  ).then(linhas => linhas.sort((a, b) => a.id.localeCompare(b.id)));
}

async function escolher(page: Page, nome: string, lembrar: boolean) {
  const folha = page.getByRole("dialog", { name: "Substituir hoje" });
  const escopo = folha.getByRole("group", { name: "Aplicar a troca" });
  await expect(escopo.getByRole("radio", { name: "Só neste treino" })).toBeChecked();
  if (lembrar) await escopo.getByRole("radio", { name: "Usar nos próximos A1" }).check();
  await folha.getByRole("list", { name: "Exercícios alternativos" })
    .getByRole("button", { name: new RegExp(`^${nome}(?:\\s|$)`) }).click();
  await expect(folha).toBeHidden();
}

async function marcar(page: Page, nome: string, numero: number) {
  const caixa = page.getByRole("group", { name: `Série ${numero} — ${nome}`, exact: true }).getByRole("checkbox");
  await caixa.click();
  await expect(caixa).toBeChecked();
}

async function concluirNaVisaoGeral(page: Page, conta: SessaoMock, id: string) {
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  const resumo = page.getByRole("dialog");
  await resumo.getByRole("button", { name: "Salvar e voltar" }).click();
  await esperarAbaTreino(page);
  await expect.poll(async () =>
    (await lerDoMock<{ status: string }>(conta, "sessions", `id=eq.${id}`))[0]?.status,
  ).toBe("concluida");
}

async function avancarDia(page: Page, quando: string) {
  await fixarData(page, quando);
  await page.goto("/");
  await esperarAbaTreino(page);
}

async function comecarPelaLista(page: Page) {
  await comecarOTreinoDoDia(page);
  const id = page.url().split("/").pop()!;
  await abrirVisaoGeral(page);
  return id;
}

test.beforeEach(async () => {
  await resetarMock();
  await definirCota(3);
});

test("A1 lembra a troca offline, preserva as séries e permite restaurar só aquele exercício", async ({ page, context }) => {
  test.setTimeout(150_000); // dois usuários, três treinos concluídos e uma recarga com o SW instalado
  const conta = await criarConta(A);
  const outraConta = await criarConta(B);
  const outraFase = ["IA", "agachamento-livre", "agachamento-frontal"];
  await inserirNoMock(conta, "trocas_do_programa", [{
    user_id: conta.userId, workout_id: "IA", exercicio_original_id: "agachamento-livre", substituto_id: "agachamento-frontal",
  }]);
  await fixarData(page, DIA_A);
  await entrarNoApp(page, A);
  await esperarServiceWorker(page);

  const doDia = page.getByRole("list", { name: "Exercícios de hoje" });
  await doDia.getByRole("button", { name: "Substituir Supino reto com barra" }).click();
  await escolher(page, "Flexão de braço", true);
  const supino = ["A1", "supino-reto-com-barra", "flexao-de-braco"];
  const agachamento = ["A1", "agachamento-livre", "agachamento-goblet"];
  await expect.poll(() => preferencias(conta)).toEqual([supino, outraFase]);

  const primeiraSessao = await comecarPelaLista(page);
  const bloco = page.locator("#bloco-1");
  await marcar(page, "Agachamento livre", 2);
  await expect.poll(() => seriesDaSessao(conta, primeiraSessao)).toHaveLength(1);
  const [original] = await seriesDaSessao(conta, primeiraSessao);
  expect(original).toMatchObject({
    exercise_id: "agachamento-livre", session_id: primeiraSessao, tipo: "trabalho", set_index: 2,
  });

  await context.setOffline(true);
  await bloco.getByRole("button", { name: /substituir hoje/i }).click();
  await escolher(page, "Agachamento goblet", true);
  await marcar(page, "Agachamento goblet", 1);
  await expect(bloco).toContainText("Feitas antes da troca: 1 série de Agachamento livre.");
  await page.reload();
  await abrirVisaoGeral(page);
  await expect(bloco.getByRole("heading", { name: "1. Agachamento goblet" })).toBeVisible();
  await expect(bloco.getByRole("checkbox", { checked: true })).toHaveCount(1);
  expect(await preferencias(conta)).toEqual([supino, outraFase]);
  expect(await seriesDaSessao(conta, primeiraSessao)).toEqual([original]);

  await context.setOffline(false);
  await expect.poll(() => preferencias(conta)).toEqual([agachamento, supino, outraFase]);
  await expect.poll(() => seriesDaSessao(conta, primeiraSessao)).toHaveLength(2);
  const historico = await seriesDaSessao(conta, primeiraSessao);
  expect(historico).toContainEqual(original);
  expect(historico.find(s => s.exercise_id === "agachamento-goblet")).toMatchObject({
    id: expect.any(String), session_id: primeiraSessao, tipo: "trabalho", set_index: 1,
  });
  expect(new Set(historico.map(s => s.id)).size).toBe(2);
  await concluirNaVisaoGeral(page, conta, primeiraSessao);

  await avancarDia(page, DIA_B);
  await expect(doDia.getByRole("button", { name: "Substituir Levantamento terra", exact: true })).toBeVisible();
  const b1 = await comecarPelaLista(page);
  const exerciciosB1 = programa.treinos.B1.exercicios.map((ex, i) => `${i + 1}. ${ex.nome}`);
  await expect(page.locator('[id^="bloco-"] h2')).toHaveText(exerciciosB1);
  await marcar(page, "Levantamento terra", 1);
  await concluirNaVisaoGeral(page, conta, b1);

  await avancarDia(page, PROXIMO_A);
  await expect(doDia.getByRole("button", { name: "Substituir Agachamento goblet" })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(doDia.getByRole("button", { name: "Substituir Agachamento goblet" })).toBeVisible();
  await expect(doDia.getByRole("button", { name: "Substituir Flexão de braço" })).toBeVisible();
  await context.setOffline(false);
  const a1 = await comecarPelaLista(page);
  expect(a1).not.toBe(primeiraSessao);
  await bloco.getByRole("button", { name: /substituir hoje/i }).click();
  await page.getByRole("button", { name: "Restaurar Agachamento livre nos próximos A1" }).click();
  await expect(bloco.getByRole("heading", { name: "1. Agachamento goblet" })).toBeVisible();
  await expect.poll(() => preferencias(conta)).toEqual([supino, outraFase]);
  await marcar(page, "Agachamento goblet", 1);
  await concluirNaVisaoGeral(page, conta, a1);

  await fixarData(page, OUTRA_SEMANA);
  await page.goto("/treinar");
  await page.getByRole("button", { name: "Começar o Treino A" }).click();
  await abrirVisaoGeral(page);
  await expect(bloco.getByRole("heading", { name: "1. Agachamento livre" })).toBeVisible();
  await expect(page.locator("#bloco-2").getByRole("heading", { name: "2. Flexão de braço" })).toBeVisible();
  expect(await seriesDaSessao(conta, primeiraSessao)).toEqual(historico);

  // A segunda conta entra no mesmo aparelho, inclusive com a cópia offline da primeira instalada.
  await page.goto("/mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarNoApp(page, B);
  await expect(doDia.getByRole("button", { name: "Substituir Supino reto com barra" })).toBeVisible();
  await expect(doDia.getByRole("button", { name: "Substituir Agachamento livre" })).toBeVisible();
  expect(await preferencias(outraConta)).toEqual([]);
  expect(await preferencias(conta)).toEqual([supino, outraFase]);
});

test("o escopo padrão vale só para a sessão, inclusive sobre uma troca já lembrada", async ({ page }) => {
  const conta = await criarConta(A);
  await inserirNoMock(conta, "trocas_do_programa", [{
    user_id: conta.userId, workout_id: "A1", exercicio_original_id: "agachamento-livre", substituto_id: "agachamento-goblet",
  }]);
  await fixarData(page, DIA_A);
  await entrarNoApp(page, A);
  await page.getByRole("button", { name: "Substituir Agachamento goblet" }).click();
  await escolher(page, "Agachamento frontal", false);
  await page.getByRole("button", { name: "Substituir Supino reto com barra" }).click();
  const escopo = page.getByRole("group", { name: "Aplicar a troca" });
  const hoje = escopo.getByRole("radio", { name: "Só neste treino" });
  const proximos = escopo.getByRole("radio", { name: "Usar nos próximos A1" });
  for (const rotulo of await escopo.locator("label").all()) {
    await expect(rotulo).toBeVisible();
    const caixa = await rotulo.boundingBox();
    expect(caixa?.height).toBeGreaterThanOrEqual(44);
    expect(caixa?.width).toBeGreaterThanOrEqual(44);
  }
  await semRolagemHorizontal(page);
  await hoje.focus();
  await hoje.press("ArrowRight");
  await expect(proximos).toBeChecked();
  await proximos.press("ArrowLeft");
  await expect(hoje).toBeChecked();
  await escolher(page, "Flexão de braço", false);
  const id = await comecarPelaLista(page);
  await expect(page.locator("#bloco-1").getByRole("heading", { name: "1. Agachamento frontal" })).toBeVisible();
  await marcar(page, "Flexão de braço", 1);
  await concluirNaVisaoGeral(page, conta, id);
  expect(await preferencias(conta)).toEqual([["A1", "agachamento-livre", "agachamento-goblet"]]);

  await fixarData(page, PROXIMO_A);
  await page.goto("/treinar");
  await page.getByRole("button", { name: "Começar o Treino A" }).click();
  await abrirVisaoGeral(page);
  await expect(page.locator("#bloco-1").getByRole("heading", { name: "1. Agachamento goblet" })).toBeVisible();
  await expect(page.locator("#bloco-2").getByRole("heading", { name: "2. Supino reto com barra" })).toBeVisible();
  await expect.poll(async () => (await seriesDaSessao(conta, id)).map(s => s.exercise_id)).toEqual(["flexao-de-braco"]);
});
