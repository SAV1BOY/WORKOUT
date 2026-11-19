import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  abrirSecaoDoRelatorio, atualizarNoMock, definirCota, entrarNoApp, esperarServiceWorker, fixarData,
  inserirNoMock, irNaAba, resetarMock, semRolagemHorizontal, sessaoNoMock, usuarioComPerfil, type SessaoMock,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

const HOJE = "2026-11-19T08:00:00-03:00";
const DOMINGO = "2026-05-24";
const SEGUNDA = "2026-05-25";
const SUPINO = "supino-reto-com-barra";
const NOTA = "Domingo antes da viagem.";
const NOTA_LIMITE = "Voltei para o treino de segunda.";

const historico = (page: Page) => page.getByRole("region", { name: "Histórico", exact: true });
const linhas = (page: Page) => historico(page).getByRole("list", { name: "Registros", exact: true }).getByRole("listitem");

async function abrirHistorico(page: Page) {
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
}

async function todos(page: Page) {
  await historico(page).getByRole("button", { name: "Todos os registros", exact: true }).click();
}

async function semanaDoDomingo(page: Page) {
  const anterior = historico(page).getByRole("button", { name: "Semana anterior", exact: true });
  for (let i = 0; i < 26; i++) await anterior.click();
  const faixa = historico(page).getByRole("region", { name: "Semana", exact: true });
  await expect(faixa).toContainText("18/05 – 24/05");
  await expect(faixa.getByRole("img", { name: /18\/05: Descanso/ })).toBeVisible();
}

async function treino(conta: SessaoMock, dia: string, treinoId: string, duracao: number, nota: string) {
  const id = crypto.randomUUID();
  await inserirNoMock(conta, "sessions", [{
    id, data: dia, workout_id: treinoId, fase: "fase1", status: "concluida",
    iniciada_em: dia + "T12:00:00Z", concluida_em: dia + `T12:${duracao}:00Z`,
    duracao_s: duracao * 60, nota_geral: nota,
  }]);
  return id;
}

function serie(id: string, data: string, indice: number, tipo = "trabalho", concluida = true) {
  return {
    id: crypto.randomUUID(), session_id: id, exercise_id: SUPINO, ordem_ex: 1, set_index: indice, tipo,
    concluida, reps: 5, carga_kg: 10, registrada_em: data + "T12:08:00Z",
  };
}

async function semearNoCorte(conta: SessaoMock) {
  const antiga = await treino(conta, DOMINGO, "A1", 15, NOTA);
  const limite = await treino(conta, SEGUNDA, "B1", 10, NOTA_LIMITE);
  await inserirNoMock(conta, "session_sets", [
    ...[1, 2, 3].map(i => serie(antiga, DOMINGO, i)), serie(antiga, DOMINGO, 1, "aquecimento"),
    serie(antiga, DOMINGO, 4, "trabalho", false), serie(limite, SEGUNDA, 1),
  ]);
  await inserirNoMock(conta, "cardio_sessions", [{
    id: crypto.randomUUID(), data: DOMINGO, tipo: "corrida", semana_plano: 2, concluida: true, duracao_min: 20,
  }]);
  await inserirNoMock(conta, "pullup_singles", [2, 4].map(reps => ({ data: DOMINGO, reps })));
  await inserirNoMock(conta, "progression_events", [{
    data: DOMINGO, session_id: antiga, exercise_id: SUPINO, motivo: "subiu",
  }]);
  // Nessa segunda sem registro a rotina normalmente prescreve força. A pessoa marcou descanso.
  await inserirNoMock(conta, "schedule_overrides", [{ data: "2026-05-18", tipo: "descanso", motivo: "Viagem" }]);
}

async function conferirDomingo(registros: Locator) {
  const forca = registros.filter({ hasText: NOTA });
  await expect(forca).toContainText("15 min · 3 séries · ↑ 1");
  await expect(registros.filter({ hasText: "Corrida" })).toContainText("semana 2 · 20 min");
  await expect(registros.filter({ hasText: "Barra fixa no descanso" })).toContainText("6 repetições");
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page, HOJE);
});

test("Todos e a semana anterior ao corte trazem força, corrida, soltas, progressão e a troca do calendário", async ({ page, context }) => {
  const conta = await usuarioComPerfil({ data_inicio: "2026-05-01", fase_desde: "2026-05-01" });
  await semearNoCorte(conta);
  await entrarNoApp(page);
  await abrirHistorico(page);
  await todos(page);
  const registros = linhas(page);
  await expect(registros).toHaveCount(4);
  await conferirDomingo(registros);
  await expect(registros.filter({ hasText: NOTA_LIMITE })).toContainText("10 min · 1 série");
  await expect(page.locator('[data-contador="Sessões"] .numero-grande')).toHaveText("3");
  await historico(page).getByRole("button", { name: "Só esta semana", exact: true }).click();
  await semanaDoDomingo(page);
  await expect(registros).toHaveCount(3);
  await conferirDomingo(registros);
  await historico(page).getByRole("button", { name: "Próxima semana" }).click();
  await expect(registros).toHaveCount(1);
  await expect(registros).toContainText(NOTA_LIMITE);
  await semRolagemHorizontal(page);
  await esperarServiceWorker(page);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await semanaDoDomingo(page);
  await conferirDomingo(registros);
});

test("a conta que entrou por último relê seu histórico offline e recebe novas séries e repetições na primeira reconexão", async ({ page, context }) => {
  await definirCota(2);
  const contaA = await usuarioComPerfil({ data_inicio: "2025-01-01", fase_desde: "2025-01-01" });
  const emailB = "historico.segunda.pessoa@example.test";
  const contaB = await sessaoNoMock(emailB);
  await atualizarNoMock(contaB, "profiles", `user_id=eq.${contaB.userId}`, {
    nome: "Ana", fase_atual: "fase1", fase_desde: "2025-01-01", data_inicio: "2025-01-01", prefs: { guia_visto: true },
  });
  await semearNoCorte(contaA);
  const notaB = "Treino antes do trabalho.";
  const idB = await treino(contaB, DOMINGO, "B1", 25, notaB);
  await inserirNoMock(contaB, "session_sets", [serie(idB, DOMINGO, 1)]);
  await inserirNoMock(contaB, "cardio_sessions", [{ data: DOMINGO, tipo: "corrida", concluida: true, duracao_min: 35 }]);
  await inserirNoMock(contaB, "pullup_singles", [{ data: DOMINGO, reps: 2 }]);
  await inserirNoMock(contaB, "progression_events", [{ data: DOMINGO, session_id: idB, exercise_id: SUPINO, motivo: "falha_2x_voltou_10" }]);
  await entrarNoApp(page);
  await abrirHistorico(page);
  await todos(page);
  await conferirDomingo(linhas(page));
  await irNaAba(page, "Mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarNoApp(page, emailB);
  await abrirHistorico(page);
  await todos(page);
  const registros = linhas(page);
  const conferirB = async (forca = "1 série · ↓ 1", repeticoes = 2) => {
    await expect(registros).toHaveCount(3);
    await expect(registros.filter({ hasText: notaB })).toContainText(`25 min · ${forca}`);
    await expect(registros.filter({ hasText: "Corrida" })).toContainText("35 min");
    await expect(registros.filter({ hasText: "Barra fixa no descanso" })).toContainText(`${repeticoes} repetições`);
    await expect(historico(page)).not.toContainText(NOTA);
  };
  await conferirB();
  await esperarServiceWorker(page);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await todos(page);
  await conferirB();

  // Outro aparelho sincroniza enquanto este documento mostra a cópia offline.
  const rosca = "rosca-com-elastico";
  await inserirNoMock(contaB, "session_sets", [{ ...serie(idB, DOMINGO, 1), exercise_id: rosca, ordem_ex: 2 }]);
  await inserirNoMock(contaB, "progression_events", [{ data: DOMINGO, session_id: idB, exercise_id: rosca, motivo: "subiu" }]);
  await inserirNoMock(contaB, "pullup_singles", [{ data: DOMINGO, reps: 5 }]);
  const worker = await workerDoApp(context);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  const forcaAtual = "2 séries · ↑ 1 · ↓ 1";
  await conferirB(forcaAtual, 7);

  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await page.reload();
  await abrirSecaoDoRelatorio(page, "historico");
  await todos(page);
  await conferirB(forcaAtual, 7);
});

test.describe("histórico com leitura incompleta", () => {
  test.use({ serviceWorkers: "block" });
  test("uma sessão antiga mostra a nota sem inventar zero séries e recupera a contagem quando a leitura volta", async ({ page }) => {
    const conta = await usuarioComPerfil({ data_inicio: "2026-05-01", fase_desde: "2026-05-01" });
    await semearNoCorte(conta);
    await entrarNoApp(page);
    const series = (url: URL) => url.pathname === "/rest/v1/session_sets" && !url.searchParams.has("session_id");
    let recusas = 0;
    await page.route(series, async rota => {
      recusas++;
      await rota.fulfill({
        status: 403, contentType: "application/json",
        body: JSON.stringify({ code: "42501", message: "Leitura da tabela de séries indisponível" }),
      });
    });
    await abrirHistorico(page);
    await todos(page);
    const antiga = linhas(page).filter({ hasText: NOTA });
    await expect(antiga).toContainText("15 min");
    await expect.poll(() => recusas).toBeGreaterThan(0);
    await expect(antiga).not.toContainText(/\d+ séries?/);
    await page.unroute(series);
    await page.reload();
    await abrirSecaoDoRelatorio(page, "historico");
    await todos(page);
    await expect(antiga).toContainText("3 séries");
  });
});

test("a progressão do treino depois de mil eventos também aparece no histórico", async ({ page }) => {
  const conta = await usuarioComPerfil({ data_inicio: "2023-01-01", fase_desde: "2023-01-01" });
  const sessoes = [];
  const eventos = [];
  const exercicios = [SUPINO, "agachamento-livre", "rosca-com-elastico", "remada-com-elastico", "abdominal-supra"];
  for (let i = 0; i < 200; i++) {
    const id = crypto.randomUUID();
    const data = new Date(Date.UTC(2023, 0, 2 + 3 * i)).toISOString().slice(0, 10);
    sessoes.push({ id, data, workout_id: i % 2 ? "A1" : "B1", fase: "fase1", status: "concluida" });
    for (let j = 0; j < exercicios.length; j++) {
      eventos.push({
        id: `00000000-0000-4000-8000-${String(i * 5 + j + 1).padStart(12, "0")}`,
        data, session_id: id, exercise_id: exercicios[j], motivo: "subiu",
      });
    }
  }
  await inserirNoMock(conta, "sessions", sessoes);
  const nota = "Retorno após a mudança.";
  const ultima = await treino(conta, DOMINGO, "A1", 15, nota);
  await inserirNoMock(conta, "progression_events", [...eventos, {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff", data: DOMINGO, session_id: ultima, exercise_id: SUPINO, motivo: "subiu",
  }]);
  await entrarNoApp(page);
  let avancouPagina = false;
  page.on("request", pedido => {
    const url = new URL(pedido.url());
    if (url.pathname === "/rest/v1/progression_events" && url.searchParams.get("user_id") === `eq.${conta.userId}` &&
        url.searchParams.get("id")?.startsWith("gt.")) avancouPagina = true;
  });
  await abrirHistorico(page);
  await todos(page);
  await expect(linhas(page).filter({ hasText: nota })).toContainText("↑ 1");
  expect(avancouPagina).toBe(true);
});
