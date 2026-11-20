import { expect, test, type Page } from "@playwright/test";
import type { LinhaSessao } from "../lib/types";
import {
  abrirVisaoGeral, entrarNoApp, esperarServiceWorker, fixarData, inserirNoMock, lerDoMock, naFila,
  requisicoesDoMock, resetarMock, usuarioComPerfil,
} from "./fixtures";
import { dialogo, editor, escolher } from "./montar-modelo";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { FRONTAL, geral, NOME as AGACHAMENTO, series } from "./treino-livre-ativo";

declare global {
  interface Window {
    reterEntradaNoPlayer(caminho: string): Promise<void>;
  }
}

const MODELO = "Força de quinta";
const OUTRO = "Core no tatame";
const REMADA = "remada-com-elastico";
const PONTE = "ponte-de-gluteos-no-tatame";
const EQUIPAMENTO = ["barra-macica", "cavalete", "anilhas", "super-band"];
const aba = (page: Page) => page.getByRole("region", { name: "Treino", exact: true });
const lista = (page: Page) => dialogo(page, "Treinos salvos");
const comecar = (page: Page, nome: string) => lista(page).getByRole("button", { name: `Começar ${nome}`, exact: true });
const atalho = (page: Page) => aba(page).getByRole("button", { name: "Treinos salvos", exact: true });
const rotaDoPlayer = /\/treinar\/[a-f\d-]{36}$/;

async function preparar(page: Page) {
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  await inserirNoMock(conta, "modelos_de_treino", [
    { id: crypto.randomUUID(), user_id: conta.userId, nome: OUTRO, exercicios: [PONTE],
      equipamento_disponivel: ["tatame"], series_por_exercicio: { [PONTE]: 2 }, descansos_por_exercicio: { [PONTE]: 55 } },
    { id: crypto.randomUUID(), user_id: conta.userId, nome: MODELO, exercicios: [FRONTAL, REMADA],
      equipamento_disponivel: EQUIPAMENTO, series_por_exercicio: { [FRONTAL]: 2, [REMADA]: 4 },
      descansos_por_exercicio: { [FRONTAL]: 85, [REMADA]: 65 } },
  ]);
  await entrarNoApp(page);
  return conta;
}

async function conferirPlanoDoModelo(page: Page) {
  await abrirVisaoGeral(page);
  await expect(geral(page).getByRole("heading", { level: 1 })).toHaveText(MODELO);
  await expect(geral(page).getByRole("heading", { level: 2 })).toHaveText([`1. ${AGACHAMENTO}`, "2. Remada com elástico"]);
  await expect(geral(page).getByRole("group", { name: /^Série \d+ — Agachamento frontal$/ })).toHaveCount(2);
  await expect(geral(page).getByRole("group", { name: /^Série \d+ — Remada com elástico$/ })).toHaveCount(4);
  await expect(geral(page).getByRole("checkbox", { checked: true })).toHaveCount(0);
}

async function treinosNoAparelho(page: Page) {
  return page.evaluate(() => new Promise<IDBValidKey[]>((resolve, reject) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => reject(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const chaves = banco.transaction("sessaoAtiva").objectStore("sessaoAtiva").getAllKeys();
      chaves.onsuccess = () => { banco.close(); resolve(chaves.result); };
      chaves.onerror = () => { banco.close(); reject(chaves.error); };
    };
  }));
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("dois toques desde a aba Treino abrem a sessão do modelo escolhido com a carga atual da conta", async ({ page }) => {
  const conta = await preparar(page);
  await atalho(page).tap();
  await expect(comecar(page, OUTRO)).toBeVisible();
  await expect(comecar(page, MODELO)).toBeEnabled();
  // A carga da conta muda depois de a biblioteca apresentar os modelos.
  await inserirNoMock(conta, "exercise_state", [{
    user_id: conta.userId, exercise_id: FRONTAL, carga_atual_kg: 31.5, reps_alvo: 6, falhas_seguidas: 0,
    incremento_reduzido: false, exigir_rep_extra: false, semana_leve: false, sessoes_graca: 0, desativado: false,
  }]);
  await comecar(page, MODELO).tap();
  await expect(page).toHaveURL(rotaDoPlayer);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await conferirPlanoDoModelo(page);
  const primeira = geral(page).getByRole("group", { name: `Série 1 — ${AGACHAMENTO}`, exact: true });
  await expect(primeira.getByRole("textbox", { name: "carga na barra" })).toHaveValue("31,5");
  await expect.poll(() => lerDoMock<LinhaSessao>(conta, "sessions")).toMatchObject([{
    id, user_id: conta.userId, status: "em_andamento", workout_id: "livre",
    plano: { titulo: MODELO, itens: [{ exercicio_id: FRONTAL, series: 2 }, { exercicio_id: REMADA, series: 4 }],
      descansos_por_exercicio: { [FRONTAL]: 85, [REMADA]: 65 } },
  }]);
  const [sessao] = await lerDoMock<LinhaSessao>(conta, "sessions");
  expect(sessao?.plano?.equipamento_disponivel?.toSorted()).toEqual(EQUIPAMENTO.toSorted());
  expect(await series(conta, id)).toEqual([]);
});

test("Carregar abre o editor e Cancelar pelo teclado mantém os exercícios do rascunho", async ({ page }) => {
  const conta = await preparar(page);
  const salvos = await lerDoMock(conta, "modelos_de_treino", "order=id.asc");
  await atalho(page).press("Enter");
  await expect(lista(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(atalho(page)).toBeFocused();
  await atalho(page).press("Enter");
  await lista(page).getByRole("button", { name: `Carregar ${MODELO}`, exact: true }).press("Enter");
  await expect(editor(page).getByRole("button", { name: `Tirar ${AGACHAMENTO}`, exact: true })).toBeVisible();
  await escolher(page, "Rosca com elástico");
  const abrirLista = editor(page).getByRole("button", { name: "Treinos salvos", exact: true });
  const confirmar = dialogo(page, "Começar o treino salvo?");
  await abrirLista.press("Enter");
  await comecar(page, OUTRO).press("Enter");
  await confirmar.getByRole("button", { name: "Cancelar", exact: true }).press("Enter");
  await expect(comecar(page, OUTRO)).toBeFocused();
  await lista(page).getByRole("button", { name: "Voltar", exact: true }).press("Enter");
  await expect(abrirLista).toBeFocused();
  const escolhidos = editor(page).getByRole("list", { name: "Escolhidos" });
  await expect(escolhidos.getByRole("button", { name: /^Tirar / })).toHaveCount(3);
  await expect(escolhidos.getByRole("button", { name: "Tirar Rosca com elástico", exact: true })).toBeVisible();
  expect(await lerDoMock(conta, "sessions")).toEqual([]);
  await abrirLista.press("Enter");
  await comecar(page, OUTRO).press("Enter");
  await confirmar.getByRole("button", { name: "Começar treino", exact: true }).press("Enter");
  await expect(page).toHaveURL(rotaDoPlayer);
  await abrirVisaoGeral(page);
  await expect(geral(page).getByRole("heading", { level: 1 })).toHaveText(OUTRO);
  await expect(geral(page).getByRole("heading", { level: 2 })).toHaveText(["1. Ponte de glúteos no tatame"]);
  expect(await lerDoMock(conta, "modelos_de_treino", "order=id.asc")).toEqual(salvos);
});

test("uma falha de gravação mantém a lista e permite iniciar, recarregar offline e sincronizar uma única sessão", async ({ page, context }) => {
  test.slow(); // Instala o worker, inicia e recarrega o player com página e worker sem rede.
  const conta = await preparar(page);
  await esperarServiceWorker(page);
  await atalho(page).tap();
  const iniciar = comecar(page, MODELO);
  await expect(iniciar).toBeEnabled();
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  // Falha depois da escrita de sessaoAtiva, dentro da mesma transação que tenta enfileirar o início.
  await page.evaluate(() => {
    const adicionar = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "outbox" && args[0]?.tipo === "sessao") {
        IDBObjectStore.prototype.add = adicionar;
        throw new DOMException("Sem espaço para enfileirar o treino", "QuotaExceededError");
      }
      return adicionar.apply(this, args);
    };
  });
  await iniciar.tap();
  await expect(page.getByText("Não consegui começar o treino agora.", { exact: true })).toBeVisible();
  await expect(iniciar).toBeEnabled();
  await expect(page).toHaveURL(url => url.pathname === "/");
  expect(await naFila(page)).toBe(0);
  expect(await treinosNoAparelho(page)).toEqual([]);
  // Dois eventos antes que o React desabilite a ação representam duas ativações do mesmo controle.
  await iniciar.evaluate((botao: HTMLButtonElement) => { botao.click(); botao.click(); });
  await expect(page).toHaveURL(rotaDoPlayer);
  const rota = page.url();
  const id = new URL(rota).pathname.split("/").at(-1)!;
  await conferirPlanoDoModelo(page);
  await expect.poll(() => naFila(page)).toBe(1);
  await semRedeNoWorker(worker);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(page).toHaveURL(rota);
  await conferirPlanoDoModelo(page);
  expect(await treinosNoAparelho(page)).toEqual([id]);
  expect(await lerDoMock(conta, "sessions")).toEqual([]);
  await comRedeNoWorker(await workerDoApp(context));
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await lerDoMock(conta, "sessions")).toMatchObject([{ id, status: "em_andamento", plano: { titulo: MODELO } }]);
  expect((await requisicoesDoMock()).filter(r => r.metodo === "POST" && r.caminho === "/rest/v1/sessions")).toHaveLength(1);
  expect(await series(conta, id)).toEqual([]);
});

test("Abrir treino criado recupera a mesma sessão se a primeira navegação demora", async ({ page, context }) => {
  test.slow();
  const liberar = Promise.withResolvers<void>();
  let caminhoRetido: string | undefined;
  await page.exposeFunction("reterEntradaNoPlayer", (caminho: string) => {
    caminhoRetido = caminho;
    return liberar.promise;
  });
  // Retém o pedido RSC do roteador. A navegação pelo link continua a pedir o documento ao worker real.
  await page.addInitScript(() => {
    const buscar = window.fetch.bind(window);
    window.fetch = async (entrada, opcoes) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada), location.href);
      if (url.origin === location.origin && /^\/treinar\/[a-f\d-]{36}$/.test(url.pathname) && url.searchParams.has("_rsc")) {
        await window.reterEntradaNoPlayer(url.pathname);
      }
      return buscar(entrada, opcoes);
    };
  });
  const conta = await preparar(page);
  const salvos = await lerDoMock(conta, "modelos_de_treino", "order=id.asc");
  await esperarServiceWorker(page);
  await atalho(page).tap();
  const iniciar = comecar(page, MODELO);
  await expect(iniciar).toBeEnabled();
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  let id: string;
  try {
    await iniciar.tap();
    const abrir = lista(page).getByRole("link", { name: "Abrir treino criado", exact: true });
    await expect(abrir).toHaveAttribute("href", rotaDoPlayer);
    const caminho = (await abrir.getAttribute("href"))!;
    id = caminho.split("/").at(-1)!;
    await expect.poll(() => caminhoRetido).toBe(caminho);
    await expect(page).toHaveURL(url => url.pathname === "/");
    expect(await treinosNoAparelho(page)).toEqual([id]);
    expect(await naFila(page)).toBe(1);
    if (!await abrir.evaluate(link => link === document.activeElement)) await page.keyboard.press("Tab");
    await expect(abrir).toBeFocused();
    await semRedeNoWorker(worker);
    const documento = page.waitForResponse(r => r.request().isNavigationRequest() && new URL(r.url()).pathname === caminho);
    await page.keyboard.press("Enter");
    expect((await documento).fromServiceWorker()).toBe(true);
    await expect(page).toHaveURL(url => url.pathname === caminho);
    await conferirPlanoDoModelo(page);
    await semRedeNoWorker(await workerDoApp(context));
    expect((await page.reload())?.fromServiceWorker()).toBe(true);
    await expect(page).toHaveURL(url => url.pathname === caminho);
    await conferirPlanoDoModelo(page);
    expect(await treinosNoAparelho(page)).toEqual([id]);
    expect(await naFila(page)).toBe(1);
  } finally {
    liberar.resolve();
    await comRedeNoWorker(await workerDoApp(context));
    await context.setOffline(false);
  }
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await lerDoMock(conta, "sessions")).toMatchObject([{ id, plano: { titulo: MODELO } }]);
  expect((await requisicoesDoMock()).filter(r => r.metodo === "POST" && r.caminho === "/rest/v1/sessions")).toHaveLength(1);
  expect(await lerDoMock(conta, "modelos_de_treino", "order=id.asc")).toEqual(salvos);
});
