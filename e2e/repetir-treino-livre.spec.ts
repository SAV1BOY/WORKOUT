import { expect, test, type Page } from "@playwright/test";
import { montarSessao, type SessaoLocal } from "../lib/sessao";
import type { LinhaSerie, LinhaSessao, PlanoDaSessao } from "../lib/types";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, atualizarNoMock, definirCota, entrarNoApp,
  esperarServiceWorker, fixarData, inserirNoMock, lerDoMock, requisicoesDoMock, resetarMock, sessaoNoMock, type SessaoMock,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

const EMAIL_A = "repetir-a@example.test";
const EMAIL_B = "repetir-b@example.test";
const ORIGEM = "2026-09-14";
const ATUAL = "2026-09-16";
const ROSCA = "rosca-com-elastico";
const ANTERIOR = "agachamento-livre";
const ATIVO = "agachamento-frontal";

async function criarConta(email: string) {
  const conta = await sessaoNoMock(email);
  await atualizarNoMock(conta, "profiles", `user_id=eq.${conta.userId}`, {
    nome: "Atleta", data_inicio: ORIGEM, fase_atual: "fase1", fase_desde: ORIGEM, prefs: { guia_visto: true },
  });
  return conta;
}

async function criarOrigem(conta: SessaoMock, titulo: string, carga: number) {
  const id = crypto.randomUUID();
  const prescricao = {
    tipo: "reps" as const, series: 2, min: 8, max: 10, unilateral: false, descanso_s: 70, descanso_texto: "70 s",
  };
  const plano: PlanoDaSessao = {
    titulo, colecao: null, equipamento_disponivel: ["tatame"],
    itens: [{ ...prescricao, exercicio_id: ROSCA }, { ...prescricao, exercicio_id: ANTERIOR }],
    trocas: {
      "2": [
        { exercicio_id: ATIVO, trabalho: [1], aquecimento: [], ultima_firme: false, nota: "Anotação do substituto" },
        { exercicio_id: ANTERIOR, trabalho: [2], aquecimento: [], ultima_firme: true, nota: "Anotação anterior" },
      ],
    },
  };
  await inserirNoMock(conta, "sessions", [{
    id, user_id: conta.userId, workout_id: "livre", fase: "fase1", data: ORIGEM, status: "concluida",
    iniciada_em: ORIGEM + "T10:00:00Z", concluida_em: ORIGEM + "T10:30:00Z", duracao_s: 1800,
    sensacao: 4, notas: "Só nesta sessão antiga", peso_corporal: 78, plano,
  }]);
  await inserirNoMock(conta, "session_sets", [ROSCA, ANTERIOR, ATIVO].map((ex, i) => ({
    id: crypto.randomUUID(), user_id: conta.userId, session_id: id, exercise_id: ex, ordem_ex: i ? 2 : 1,
    set_index: ex === ANTERIOR ? 2 : 1, tipo: "trabalho", reps: 8, carga_kg: i ? 9.5 : null, concluida: true,
    ultima_firme: false, rpe: 8, registrada_em: ORIGEM + "T10:15:00Z",
  })));
  await inserirNoMock(conta, "exercise_state", [{
    user_id: conta.userId, exercise_id: ATIVO, carga_atual_kg: carga, reps_alvo: 5, falhas_seguidas: 0,
    incremento_reduzido: false, exigir_rep_extra: false, semana_leve: false, sessoes_graca: 0, desativado: false,
  }]);
  return id;
}

async function historico(page: Page) {
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Relatório" }).click();
  await abrirSecaoDoRelatorio(page, "historico");
  return page.getByRole("list", { name: "Registros", exact: true });
}

function repetir(page: Page, titulo: string) {
  return page.getByRole("button", { name: new RegExp(`^Repetir treino: ${titulo} de `) });
}

function series(conta: SessaoMock, id: string) {
  return lerDoMock<LinhaSerie>(conta, "session_sets", `session_id=eq.${id}&order=id.asc`);
}

async function criacoesNoServidor() {
  const requisicoes = await requisicoesDoMock();
  return requisicoes.filter(r => r.metodo === "POST" && r.caminho === "/rest/v1/sessions").length;
}

async function origemIntacta(conta: SessaoMock, id: string) {
  const [sessao] = await lerDoMock<LinhaSessao>(conta, "sessions", `id=eq.${id}`);
  if (!sessao) throw new Error(`Sessão de origem ausente no mock: ${id}`);
  return { sessao, series: await series(conta, id) };
}

async function lerSessaoLocal(page: Page, id: string) {
  return page.evaluate(id => new Promise<SessaoLocal | null>((resolve, reject) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => reject(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const obter = banco.transaction("sessaoAtiva").objectStore("sessaoAtiva").get(id);
      obter.onsuccess = () => { banco.close(); resolve(obter.result?.dados ?? null); };
      obter.onerror = () => { banco.close(); reject(obter.error); };
    };
  }), id);
}

async function conferirSessaoNova(page: Page, origem: string, carga: number) {
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  expect(id).not.toBe(origem);
  await abrirVisaoGeral(page);
  await expect(page.locator('[id^="bloco-"] h2')).toHaveText(["1. Rosca com elástico", "2. Agachamento frontal"]);
  const segunda = page.locator("#bloco-2");
  await expect(segunda.getByRole("group", { name: "Série 1 — Agachamento frontal", exact: true })
    .getByRole("textbox", { name: "carga na barra" })).toHaveValue(String(carga).replace(".", ","));
  await expect(page.locator('[id^="bloco-"]').getByRole("checkbox", { checked: true })).toHaveCount(0);
  const nova = await lerSessaoLocal(page, id);
  expect(nova).toMatchObject({
    id, data: ATUAL, workoutId: "livre", status: "em_andamento",
    concluidaEm: null, sensacao: null, pesoCorporal: null, notas: null,
  });
  expect(nova!.blocos[0]).toMatchObject({ descansoS: 70, prescricao: { series: 2, min: 8, max: 10 } });
  expect(nova!.blocos[1]).toMatchObject({ descansoS: 90, prescricao: { series: 3, min: 6, max: 8 } });
  const novasSeries = nova!.blocos.flatMap(b => b.series);
  expect(novasSeries.every(s => !s.concluida && s.registradaEm === null)).toBe(true);
  expect(nova!.blocos.every(b => b.nota === null && b.ultimaFirme === null)).toBe(true);
  expect(nova!.plano?.trocas).toBeUndefined();

  await segunda.getByRole("button", { name: /substituir hoje/i }).click();
  const folha = page.getByRole("dialog", { name: "Substituir hoje" });
  await folha.locator("summary").filter({ hasText: "Equipamentos disponíveis" }).click();
  const equipamento = folha.getByRole("group", { name: "Equipamento de hoje" });
  const quantidade = await equipamento.getByRole("checkbox").count();
  expect(quantidade).toBeGreaterThan(2);
  await expect(equipamento.getByRole("checkbox", { checked: true })).toHaveCount(quantidade);
  await page.keyboard.press("Escape");
  await expect(folha).toBeHidden();
  return { id, novasSeries };
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await definirCota(3);
  await fixarData(page, ATUAL + "T08:00:00-03:00");
  await page.setViewportSize({ width: 360, height: 740 });
});

test("dois toques repetem uma única vez o treino livre na ordem efetiva e conservam todo o histórico", async ({ page }) => {
  const conta = await criarConta(EMAIL_A);
  const titulo = "Meu treino de quarta";
  const original = await criarOrigem(conta, titulo, 31.5);
  const antes = await origemIntacta(conta, original);
  await entrarNoApp(page, EMAIL_A);
  await historico(page);
  const acao = repetir(page, titulo);
  await expect(acao).toBeEnabled();
  // Dois eventos de ativação antes de o React ter oportunidade de redesenhar o botão.
  await acao.evaluate((b: HTMLButtonElement) => { b.click(); b.click(); });
  const { id, novasSeries } = await conferirSessaoNova(page, original, 31.5);
  for (const s of novasSeries) expect(antes.series.map(s => s.id)).not.toContain(s.id);
  await expect.poll(() => lerDoMock<LinhaSessao>(conta, "sessions", `id=neq.${original}`)).toMatchObject([{
    id, user_id: conta.userId, data: ATUAL, workout_id: "livre", status: "em_andamento",
    plano: { titulo, itens: [{ exercicio_id: ROSCA }, { exercicio_id: ATIVO }] },
  }]);
  expect(await series(conta, id)).toEqual([]);
  expect(await origemIntacta(conta, original)).toEqual(antes);
});

test("repete a cópia preparada sem rede, retoma a nova sessão e envia uma única criação", async ({ page, context }) => {
  const conta = await criarConta(EMAIL_A);
  const titulo = "Treino para repetir offline";
  const original = await criarOrigem(conta, titulo, 31.5);
  const antes = await origemIntacta(conta, original);
  await entrarNoApp(page, EMAIL_A);
  await esperarServiceWorker(page);
  // A ficha usa o mesmo estado de carga por exercício que o motor pode ler sem rede.
  await page.goto(`/exercicios/${ATIVO}`);
  await expect(page.getByText(/31,5 kg/).first()).toBeVisible();
  await historico(page);
  await expect(repetir(page, titulo)).toBeEnabled();
  const postsAntes = await criacoesNoServidor();
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await repetir(page, titulo).click();
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  const rota = page.url();
  await expect(page.getByRole("button", { name: "Começar agora" })).toBeVisible();
  await semRedeNoWorker(worker);
  await page.reload();
  await expect(page).toHaveURL(rota);
  const { id } = await conferirSessaoNova(page, original, 31.5);
  expect(await lerDoMock(conta, "sessions")).toHaveLength(1);
  expect(await criacoesNoServidor()).toBe(postsAntes);
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => lerDoMock(conta, "sessions", `id=eq.${id}`)).toMatchObject([{ id, status: "em_andamento" }]);
  expect(await criacoesNoServidor()).toBe(postsAntes + 1);
  expect(await lerDoMock(conta, "sessions")).toHaveLength(2);
  expect(await series(conta, id)).toEqual([]);
  expect(await origemIntacta(conta, original)).toEqual(antes);
});

test("o histórico de outra conta oferece apenas as sessões livres concluídas dela com plano válido", async ({ page }) => {
  const contaA = await criarConta(EMAIL_A);
  const contaB = await criarConta(EMAIL_B);
  const treinoA = "Treino privado A";
  const treinoB = "Treino privado B";
  await criarOrigem(contaA, treinoA, 31.5);
  const originalB = await criarOrigem(contaB, treinoB, 19.5);
  const baseB = await origemIntacta(contaB, originalB);
  const registro = { data: ORIGEM, fase: "fase1", concluida_em: ORIGEM + "T11:00:00Z", status: "concluida" };
  await inserirNoMock(contaB, "sessions", [
    { ...registro, id: crypto.randomUUID(), workout_id: "livre", plano: null },
    { ...registro, id: crypto.randomUUID(), workout_id: "A1", plano: baseB.sessao.plano },
    { ...registro, id: crypto.randomUUID(), workout_id: "livre", status: "abandonada", plano: baseB.sessao.plano },
    { ...registro, id: crypto.randomUUID(), workout_id: "livre", plano: { titulo: "Modelo vazio", colecao: null, itens: [] } },
  ]);
  await entrarNoApp(page, EMAIL_A);
  await historico(page);
  await expect(repetir(page, treinoA)).toBeVisible();
  await page.goto("/mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarNoApp(page, EMAIL_B);
  const listaB = await historico(page);
  await expect(repetir(page, treinoB)).toBeEnabled();
  await expect(listaB).not.toContainText(treinoA);
  await expect(listaB.getByRole("button", { name: /^Repetir treino/ })).toHaveCount(1);
  await repetir(page, treinoB).click();
  const { id } = await conferirSessaoNova(page, originalB, 19.5);
  await expect.poll(() => lerDoMock(contaB, "sessions", `id=eq.${id}`)).toMatchObject([{ user_id: contaB.userId }]);
  expect(await lerDoMock(contaA, "sessions")).toHaveLength(1);
  expect(await origemIntacta(contaB, originalB)).toEqual(baseB);
});

test("repetir com uma sessão já em andamento retoma o treino aberto da mesma conta", async ({ page }) => {
  const conta = await criarConta(EMAIL_A);
  const titulo = "Treino livre anterior";
  const origem = await criarOrigem(conta, titulo, 31.5);
  const aberta = crypto.randomUUID();
  await inserirNoMock(conta, "sessions", [{
    id: aberta, user_id: conta.userId, workout_id: "A1", fase: "fase1", data: ATUAL,
    status: "em_andamento", iniciada_em: ATUAL + "T09:00:00Z",
  }]);
  const antes = await origemIntacta(conta, origem);
  await entrarNoApp(page, EMAIL_A);
  await historico(page);
  const postsAntes = await criacoesNoServidor();
  await repetir(page, titulo).click();
  await expect(page).toHaveURL(new RegExp(`/treinar/${aberta}$`));
  await expect(page.getByText("Você já tem um treino em andamento. Retomando esse treino.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Começar agora" })).toBeVisible();
  expect(await criacoesNoServidor()).toBe(postsAntes);
  expect(await lerDoMock(conta, "sessions")).toHaveLength(2);
  expect(await origemIntacta(conta, origem)).toEqual(antes);
});

test("sem rede, a rota de uma sessão de outra conta ou desconhecida não mostra aquele treino", async ({ page, context }) => {
  const contaA = await criarConta(EMAIL_A);
  const contaB = await criarConta(EMAIL_B);
  await entrarNoApp(page, EMAIL_B);
  await esperarServiceWorker(page);
  // Simula uma cópia antiga que restou no aparelho compartilhado ao trocar de conta.
  const alheia = montarSessao({
    id: crypto.randomUUID(), userId: contaA.userId, data: ORIGEM, treinoId: "A1", fase: "fase1",
  });
  const propria = montarSessao({
    id: crypto.randomUUID(), userId: contaB.userId, data: ATUAL, treinoId: "B1", fase: "fase1",
  });
  await page.evaluate(sessoes => new Promise<void>((resolve, reject) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => reject(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const tx = banco.transaction("sessaoAtiva", "readwrite");
      for (const dados of sessoes) tx.objectStore("sessaoAtiva").put({ id: dados.id, dados, atualizadoEm: Date.now() });
      tx.oncomplete = () => { banco.close(); resolve(); };
      tx.onerror = () => { banco.close(); reject(tx.error); };
    };
  }), [alheia, propria]);
  await expect.poll(() => page.evaluate(() => new Promise<string | undefined>(resolve => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => resolve(undefined);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const ler = banco.transaction("cache").objectStore("cache").get("player:login-confirmado");
      ler.onsuccess = () => { banco.close(); resolve(ler.result?.valor?.conta); };
      ler.onerror = () => { banco.close(); resolve(undefined); };
    };
  }))).toBe(contaB.userId);

  // O HTML de socorro aparece antes da hidratação. Espere a decisão sobre o UUID
  // desta navegação para que o primeiro quadro genérico não faça o teste passar.
  await page.addInitScript(() => {
    const ler = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (chave) {
      const pedido = ler.call(this, chave);
      if (this.name === "sessaoAtiva" && typeof chave === "string") {
        pedido.addEventListener("success", () => requestAnimationFrame(() => requestAnimationFrame(
          () => { document.documentElement.dataset.ultimaSessaoConferida = chave; },
        )));
      }
      return pedido;
    };
  });
  await context.setOffline(true);
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await page.goto(`/treinar/${propria.id}`);
  await expect(page.getByRole("button", { name: "Começar agora" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-ultima-sessao-conferida", propria.id);
  for (const id of [alheia.id, crypto.randomUUID()]) {
    await semRedeNoWorker(worker);
    await page.goto(`/treinar/${id}`);
    await expect(page.locator("html")).toHaveAttribute("data-ultima-sessao-conferida", id);
    await expect(page.getByRole("heading", { name: "Sem conexão", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Começar agora" })).toHaveCount(0);
  }
});
