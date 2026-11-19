import { expect, test, type Locator, type Page } from "@playwright/test";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import type { LinhaSessao } from "../lib/types";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, atualizarNoMock, definirCota, entrarNoApp, esperarAbaTreino,
  esperarServiceWorker, fixarData, inserirNoMock, irNaAba, lerDoMock, naFila, resetarMock, sessaoNoMock,
  usuarioComPerfil, type SessaoMock,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { FRONTAL, geral, NOME, series, treinoAberto } from "./treino-livre-ativo";

const DIA = "2026-09-14";
const SUPINO = "supino-reto-com-barra";
const TITULO = "Força no terraço";
const detalhe = (page: Page) => page.getByRole("dialog", { name: "Séries do treino", exact: true });
const registro = (page: Page, texto: string) => page.getByRole("list", { name: "Registros", exact: true })
  .getByRole("listitem").filter({ hasText: texto });
const verSeries = (item: Locator) => item.getByRole("button", { name: /^Ver séries de / });

async function abrirHistorico(page: Page) {
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
}

async function sessaoConcluida(conta: SessaoMock, hora: string, nota: string) {
  const id = crypto.randomUUID();
  await inserirNoMock(conta, "sessions", [{
    id, data: DIA, workout_id: "livre", fase: "fase1", status: "concluida", nota_geral: nota,
    iniciada_em: `${DIA}T${hora}:00:00Z`, concluida_em: `${DIA}T${hora}:30:00Z`, duracao_s: 1800,
    plano: planoDaSessao(itensDeIds([SUPINO]), { titulo: TITULO }),
  }]);
  return id;
}

function serie(sessao: string, indice: number, reps: number, kg: number | null, exercicio = SUPINO) {
  return {
    id: crypto.randomUUID(), session_id: sessao, exercise_id: exercicio, ordem_ex: 1, set_index: indice,
    tipo: "trabalho", reps, carga_kg: kg, concluida: true, registrada_em: DIA + "T12:05:00Z",
  };
}

function repeticoesOnde(onde: Locator, rotulo: string) {
  return onde.getByRole("listitem").filter({ has: onde.page().getByText(rotulo, { exact: true }) });
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("a sessão escolhida separa aquecimento, movimentos e cargas de cada série e a ficha mostra a carga correspondente", async ({ page }) => {
  const conta = await usuarioComPerfil();
  const primeira = await sessaoConcluida(conta, "12", "Treino no almoço.");
  const segunda = await sessaoConcluida(conta, "18", "Treino após o trabalho.");
  // A troca conserva o supino original e arquiva as séries da mesma posição.
  const plano = planoDaSessao(itensDeIds([SUPINO]), { titulo: TITULO });
  await atualizarNoMock(conta, "sessions", `id=eq.${primeira}`, { plano: { ...plano, trocas: {
    "1": [
      { exercicio_id: "flexao-de-braco", trabalho: [1], aquecimento: [], ultima_firme: true, nota: null },
      { exercicio_id: SUPINO, trabalho: [1, 2, 3], aquecimento: [1], ultima_firme: null, nota: null },
    ],
  } } });
  await inserirNoMock(conta, "session_sets", [
    serie(primeira, 2, 8, 22.5), serie(primeira, 1, 10, 20),
    { ...serie(primeira, 1, 5, 7.5), tipo: "aquecimento" },
    serie(primeira, 1, 11, null, "flexao-de-braco"),
    { ...serie(primeira, 3, 15, 50), concluida: false },
    serie(segunda, 1, 4, 40),
  ]);
  await entrarNoApp(page);
  await abrirHistorico(page);
  const abrir = verSeries(registro(page, "Treino no almoço."));
  await abrir.click();
  const folha = detalhe(page);
  const supino = folha.getByRole("region", { name: /Supino reto com barra/ });
  await expect(supino.getByRole("listitem")).toHaveCount(3);
  await expect(repeticoesOnde(supino, "Aquecimento 1")).toContainText("5 repetições · 7,5 kg na barra");
  await expect(repeticoesOnde(supino, "Série 1")).toContainText("10 repetições · 20 kg na barra");
  await expect(repeticoesOnde(supino, "Série 2")).toContainText("8 repetições · 22,5 kg na barra");
  const flexao = folha.getByRole("region", { name: /Flexão de braço/ });
  await expect(repeticoesOnde(flexao, "Série 1")).toContainText("11 repetições");
  await expect(folha).not.toContainText("50 kg");
  await expect(folha).not.toContainText("40 kg");
  await folha.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(abrir).toBeFocused();
  await verSeries(registro(page, "Treino após o trabalho.")).click();
  const outro = folha.getByRole("region", { name: /Supino reto com barra/ });
  await expect(outro.getByRole("listitem")).toHaveCount(1);
  await expect(repeticoesOnde(outro, "Série 1")).toContainText("4 repetições · 40 kg na barra");
  await folha.getByRole("button", { name: "Fechar", exact: true }).click();

  await page.goto(`/exercicios/${SUPINO}`);
  const anteriores = page.getByRole("list", { name: /Séries de trabalho de / }).filter({ hasText: "22,5 kg" });
  await expect(anteriores.getByRole("listitem")).toHaveCount(2);
  await expect(anteriores.getByRole("listitem").nth(0)).toContainText("10 repetições · 20 kg na barra");
  await expect(anteriores.getByRole("listitem").nth(1)).toContainText("8 repetições · 22,5 kg na barra");
});

test("duas séries concluídas offline aparecem antes de sincronizar, sobrevivem à recarga e chegam uma vez ao servidor", async ({ page, context }) => {
  const { conta, id } = await treinoAberto(page, { comFrontal: true });
  await esperarServiceWorker(page);
  await abrirVisaoGeral(page);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  // A barra de 7,5 kg aceita pares de anilhas em passos de 2 kg.
  for (const [indice, reps, kg] of [[1, "10", "21,5"], [2, "8", "23,5"]] as const) {
    const linha = geral(page).getByRole("group", { name: `Série ${indice} — ${NOME}`, exact: true });
    await linha.getByRole("textbox", { name: "repetições" }).fill(reps);
    const carga = linha.getByRole("textbox", { name: "carga na barra" });
    await carga.fill(kg);
    await linha.getByRole("checkbox").check();
    await expect(carga).toHaveValue(kg);
  }
  await geral(page).getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("dialog", { name: "Treino concluído" }).getByRole("button", { name: "Salvar e voltar" }).click();
  await esperarAbaTreino(page);
  await abrirHistorico(page);
  const abrir = verSeries(registro(page, "Treino livre de segunda"));
  const folha = detalhe(page);
  const conferir = async () => {
    await abrir.click();
    const agachamento = folha.getByRole("region", { name: /Agachamento frontal/ });
    await expect(agachamento.getByRole("listitem")).toHaveCount(2);
    await expect(repeticoesOnde(agachamento, "Série 1")).toContainText("10 repetições · 21,5 kg na barra");
    await expect(repeticoesOnde(agachamento, "Série 2")).toContainText("8 repetições · 23,5 kg na barra");
    await folha.getByRole("button", { name: "Fechar", exact: true }).click();
  };
  await conferir();
  await semRedeNoWorker(worker);
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await conferir();
  expect(await series(conta, id)).toEqual([]);
  await comRedeNoWorker(await workerDoApp(context));
  await context.setOffline(false);
  await expect.poll(() => lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${id}`)).toMatchObject([{ status: "concluida" }]);
  const ordenadas = () => lerDoMock(conta, "session_sets", `session_id=eq.${id}&order=set_index.asc`);
  await expect.poll(ordenadas).toMatchObject([
    { set_index: 1, reps: 10, carga_kg: 21.5, exercise_id: FRONTAL }, { set_index: 2, reps: 8, carga_kg: 23.5, exercise_id: FRONTAL },
  ]);
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await conferir();
});

test("duas pessoas que fizeram o mesmo treino no mesmo dia só releem suas próprias séries", async ({ page, context }) => {
  await definirCota(2);
  const contaA = await usuarioComPerfil();
  const emailB = "segunda.conta@example.test";
  const contaB = await sessaoNoMock(emailB);
  await atualizarNoMock(contaB, "profiles", `user_id=eq.${contaB.userId}`, {
    nome: "Ana", fase_atual: "fase1", data_inicio: DIA, fase_desde: DIA, prefs: { guia_visto: true },
  });
  const a = await sessaoConcluida(contaA, "12", "Treino de hoje");
  const b = await sessaoConcluida(contaB, "12", "Treino de hoje");
  await inserirNoMock(contaA, "session_sets", [serie(a, 1, 12, 35)]);
  await inserirNoMock(contaB, "session_sets", [serie(b, 1, 7, 15)]);
  await entrarNoApp(page);
  await abrirHistorico(page);
  const abrir = verSeries(registro(page, "Treino de hoje"));
  await abrir.click();
  await expect(detalhe(page)).toContainText("12 repetições · 35 kg na barra");
  await detalhe(page).getByRole("button", { name: "Fechar", exact: true }).click();
  await irNaAba(page, "Mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarNoApp(page, emailB);
  await abrirHistorico(page);
  await abrir.click();
  await expect(detalhe(page)).toContainText("7 repetições · 15 kg na barra");
  await esperarServiceWorker(page);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await abrir.click();
  await expect(detalhe(page)).toContainText("7 repetições · 15 kg na barra");
  await expect(detalhe(page)).not.toContainText("35 kg");
});

test("um treino enviado pela fila fora do relatório ainda tem detalhes na primeira consulta sem rede", async ({ page, context }) => {
  const { conta, id } = await treinoAberto(page, { comFrontal: true, apenasUmaSerie: true });
  await esperarServiceWorker(page);
  await abrirVisaoGeral(page);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  const linha = geral(page).getByRole("group", { name: `Série 1 — ${NOME}`, exact: true });
  await linha.getByRole("textbox", { name: "repetições" }).fill("9");
  await linha.getByRole("checkbox").check();
  await geral(page).getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("dialog", { name: "Treino concluído" }).getByRole("button", { name: "Salvar e voltar" }).click();
  await esperarAbaTreino(page);
  expect(await series(conta, id)).toEqual([]);

  await comRedeNoWorker(await workerDoApp(context));
  await context.setOffline(false);
  await expect.poll(() => lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${id}`)).toMatchObject([{ status: "concluida" }]);
  await expect.poll(() => series(conta, id)).toMatchObject([{ set_index: 1, exercise_id: FRONTAL, reps: 9, carga_kg: 31.5 }]);
  await irNaAba(page, "Mais");
  await expect.poll(() => naFila(page)).toBe(0);
  await expect(page.getByLabel("Sincronização").getByText("Tudo sincronizado", { exact: true })).toBeVisible();
  await irNaAba(page, "Treino");
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await page.reload();
  await esperarAbaTreino(page);
  await abrirHistorico(page);
  await verSeries(registro(page, "Treino livre de segunda")).click();
  const linhas = detalhe(page).getByRole("region", { name: /Agachamento frontal/ }).getByRole("listitem");
  await expect(linhas).toHaveCount(1);
  await expect(linhas).toContainText(["9 repetições · 31,5 kg na barra"]);
});
