import { expect, test, type Page } from "@playwright/test";
import { chaveDoDetalheDaSessao } from "../lib/chaves-do-historico";
import { itensDeIds, planoDaSessao } from "../lib/livre";
import {
  abrirSecaoDoRelatorio, abrirVisaoGeral, atualizarNoMock, comecarNoPlayer, definirCota,
  entrarNoApp, esperarAbaTreino, esperarServiceWorker, fixarData, inserirNoMock, irNaAba,
  naFila, resetarMock, sessaoNoMock, usuarioComPerfil, type SessaoMock,
} from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { FRONTAL, geral, series } from "./treino-livre-ativo";

const DIA = "2026-09-14";
const TITULO = "Força de segunda";
const FLEXAO = "flexao-de-braco";
const FICHA = `/exercicios/${FRONTAL}`;
const PARCIAL = "O histórico de séries deste treino está incompleto neste aparelho.";
const abrir = (page: Page) => page.getByRole("button", { name: `Ver séries de ${TITULO} de 14/09/2026`, exact: true });
const folha = (page: Page) => page.getByRole("dialog", { name: "Séries do treino", exact: true });
const flexao = (page: Page) => folha(page).getByRole("region", { name: "Flexão de braço", exact: true });

async function semearTreino(conta: SessaoMock, repeticoes: number, carga: number, concluido = true) {
  const id = crypto.randomUUID();
  const outraSerie = crypto.randomUUID();
  const plano = planoDaSessao(itensDeIds([FRONTAL, FLEXAO]), { titulo: TITULO });
  await inserirNoMock(conta, "sessions", [{
    id, data: DIA, status: concluido ? "concluida" : "em_andamento", workout_id: "livre", fase: "fase1", plano,
    iniciada_em: `${DIA}T10:00:00Z`, concluida_em: concluido ? `${DIA}T10:30:00Z` : null,
  }]);
  const primeira = {
    id: crypto.randomUUID(), session_id: id, exercise_id: FRONTAL, ordem_ex: 1, set_index: 1,
    tipo: "trabalho", reps: 7, carga_kg: carga, concluida: true, registrada_em: `${DIA}T10:05:00Z`,
  };
  const segunda = {
    ...primeira, id: outraSerie, exercise_id: FLEXAO, ordem_ex: 2, reps: repeticoes, carga_kg: null,
  };
  await inserirNoMock(conta, "session_sets", concluido ? [primeira, segunda] : [primeira]);
  return { id, outraSerie };
}

/** A recarga começa depois de a própria ficha ter persistido as leituras auxiliares. */
async function lerCache<T>(page: Page, chave: string): Promise<T | null> {
  return page.evaluate(k => new Promise((resolve, reject) => {
    const abertura = indexedDB.open("treino-terraco");
    abertura.onerror = () => reject(abertura.error);
    abertura.onsuccess = () => {
      const banco = abertura.result;
      const leitura = banco.transaction("cache").objectStore("cache").get(k);
      leitura.onsuccess = () => { banco.close(); resolve(leitura.result?.valor ?? null); };
      leitura.onerror = () => { banco.close(); reject(leitura.error); };
    };
  }), chave);
}

async function prepararFicha(page: Page, carga: string) {
  await esperarServiceWorker(page);
  await page.goto(FICHA);
  await expect(page.getByText(`7 repetições · ${carga} kg na barra`, { exact: true })).toBeVisible();
  type Consultas = { estado: { queries: { queryKey: string[]; state: { data?: { carga_kg?: number }[] } }[] } };
  await expect.poll(async () => {
    const cache = await lerCache<Consultas>(page, "react-query-v1");
    return cache?.estado.queries.some(q => q.queryKey.includes(FRONTAL) && q.queryKey.includes("series-ex")
      && q.state.data?.some(s => s.carga_kg === Number(carga.replace(",", "."))));
  }).toBe(true);
}

async function desligarRede(page: Page) {
  await esperarServiceWorker(page);
  await semRedeNoWorker(await workerDoApp(page.context()));
  await page.context().setOffline(true);
}

async function ligarRede(page: Page) {
  await comRedeNoWorker(await workerDoApp(page.context()));
  await page.context().setOffline(false);
}

test.beforeEach(async ({ page }) => {
  await resetarMock();
  await fixarData(page);
});

test("na conta seguinte a ficha indica a cópia parcial, completa pela primeira reconexão e reabre o treino dessa conta sem rede", async ({ page }) => {
  test.setTimeout(60_000);
  await definirCota(2);
  const a = await usuarioComPerfil();
  const emailB = "ficha.segunda@example.test";
  const b = await sessaoNoMock(emailB);
  await atualizarNoMock(b, "profiles", `user_id=eq.${b.userId}`, {
    nome: "Ana", fase_atual: "fase1", data_inicio: DIA, fase_desde: DIA, prefs: { guia_visto: true },
  });
  const primeira = await semearTreino(a, 19, 33.5);
  const segunda = await semearTreino(b, 9, 21.5);
  await entrarNoApp(page);
  await prepararFicha(page, "33,5");
  await abrir(page).click();
  await expect(flexao(page)).toContainText("19 repetições");
  await expect.poll(() => lerCache(page, chaveDoDetalheDaSessao(a.userId, primeira.id))).not.toBeNull();
  await folha(page).getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(folha(page)).toBeHidden();
  await irNaAba(page, "Mais");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);

  await entrarNoApp(page, emailB);
  await prepararFicha(page, "21,5");
  await desligarRede(page);
  await page.reload();
  await abrir(page).click();
  await expect(folha(page)).toContainText("7 repetições · 21,5 kg na barra");
  await expect(folha(page).getByRole("status")).toHaveText(PARCIAL);
  await expect(flexao(page)).toHaveCount(0);
  await expect(folha(page)).not.toContainText("33,5 kg");

  await ligarRede(page);
  await expect(flexao(page)).toContainText("9 repetições");
  await expect(folha(page).getByText(PARCIAL)).toHaveCount(0);
  await expect.poll(() => lerCache(page, chaveDoDetalheDaSessao(b.userId, segunda.id))).not.toBeNull();
  await page.reload();
  const confirmacao = page.waitForResponse(res => {
    const url = new URL(res.url());
    return res.ok() && url.pathname === "/rest/v1/session_sets" && url.searchParams.get("session_id") === `eq.${segunda.id}`;
  });
  await abrir(page).click();
  await confirmacao;
  await expect(flexao(page)).toContainText("9 repetições");
  await desligarRede(page);
  await page.reload();
  await abrir(page).click();
  await expect(flexao(page)).toContainText("9 repetições");
  await expect(folha(page).getByText(PARCIAL)).toHaveCount(0);

  await fixarData(page, "2026-09-14T08:05:00-03:00");
  await atualizarNoMock(b, "session_sets", `id=eq.${segunda.outraSerie}`, { reps: 12 });
  await ligarRede(page);
  await expect(flexao(page)).toContainText("12 repetições");
  await expect(folha(page)).not.toContainText("19 repetições");
});

test("a primeira abertura da ficha sem rede mostra também o segundo exercício já guardado no Relatório", async ({ page }) => {
  const conta = await usuarioComPerfil();
  const { id } = await semearTreino(conta, 11, 23.5);
  await entrarNoApp(page);
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  await expect(page.getByRole("list", { name: "Registros" })).toContainText(TITULO);
  await expect.poll(() => lerCache(page, `series-do-historico-v2:${conta.userId}`)).not.toBeNull();
  await prepararFicha(page, "23,5");
  expect(await lerCache(page, chaveDoDetalheDaSessao(conta.userId, id))).toBeNull();

  await desligarRede(page);
  await page.reload();
  await abrir(page).click();
  await expect(folha(page)).toContainText("7 repetições · 23,5 kg na barra");
  await expect(flexao(page)).toContainText("11 repetições");
  await expect(folha(page).getByText(PARCIAL)).toHaveCount(0);
});

type LeiturasRetidas = {
  segurar: boolean;
  capturadas?: { exercise_id: string }[];
  entregue?: boolean;
  enviarEscritas: () => void;
  entregarResposta: () => void;
};

declare global {
  interface Window { provaDaFicha: LeiturasRetidas }
}

/** Segura o resultado já recebido e as escritas da fila no próprio cliente, antes do worker. */
async function instalarBarreiras(page: Page, id: string) {
  await page.addInitScript(alvo => {
    let enviarEscritas!: () => void;
    let entregarResposta!: () => void;
    const podeEscrever = new Promise<void>(resolve => { enviarEscritas = resolve; });
    const podeEntregar = new Promise<void>(resolve => { entregarResposta = resolve; });
    const prova = window.provaDaFicha = { segurar: false, enviarEscritas, entregarResposta } as LeiturasRetidas;
    const buscar = window.fetch.bind(window);
    window.fetch = async (entrada, opcoes) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada), location.href);
      const metodo = opcoes?.method ?? (entrada instanceof Request ? entrada.method : "GET");
      if (prova.segurar && url.pathname.startsWith("/rest/v1/") && metodo !== "GET") await podeEscrever;
      const resultado = await buscar(entrada, opcoes);
      if (prova.segurar && metodo === "GET" && url.pathname === "/rest/v1/session_sets" &&
        url.searchParams.get("session_id") === `eq.${alvo}`) {
        prova.capturadas = await resultado.clone().json();
        await podeEntregar;
        prova.entregue = true;
      }
      return resultado;
    };
  }, id);
}

test("um GET iniciado antes de a fila enviar a segunda série conserva o fechamento depois que a resposta antiga chega", async ({ page }) => {
  test.setTimeout(60_000);
  const conta = await usuarioComPerfil({ prefs: { preparacao_s: 0, avancar_sozinho: false } });
  const { id } = await semearTreino(conta, 0, 23.5, false);
  await instalarBarreiras(page, id);
  await entrarNoApp(page);
  await prepararFicha(page, "23,5");
  await page.goto(`/treinar/${id}`);
  await comecarNoPlayer(page);
  await abrirVisaoGeral(page);
  await desligarRede(page);
  const segunda = geral(page).getByRole("group", { name: "Série 1 — Flexão de braço", exact: true });
  await segunda.getByRole("textbox", { name: "repetições" }).fill("13");
  await segunda.getByRole("checkbox").check();
  await geral(page).getByRole("button", { name: "Concluir", exact: true }).click();
  await page.getByRole("dialog", { name: "Treino concluído" }).getByRole("button", { name: "Salvar e voltar" }).click();
  await esperarAbaTreino(page);
  expect(await series(conta, id)).toHaveLength(1);
  expect(await naFila(page)).toBeGreaterThan(0);

  await page.goto(FICHA);
  await expect(abrir(page)).toBeVisible();
  await fixarData(page, "2026-09-14T08:01:00-03:00");
  await page.evaluate(() => { window.provaDaFicha.segurar = true; });

  await ligarRede(page);
  await abrir(page).click();
  await expect.poll(() => page.evaluate(() => window.provaDaFicha.capturadas)).toMatchObject([{ exercise_id: FRONTAL }]);
  await expect(flexao(page)).toContainText("13 repetições");
  await page.evaluate(() => window.provaDaFicha.enviarEscritas());
  await expect.poll(() => naFila(page)).toBe(0);
  await expect.poll(() => series(conta, id)).toHaveLength(2);
  await page.evaluate(() => window.provaDaFicha.entregarResposta());
  await expect.poll(() => page.evaluate(() => window.provaDaFicha.entregue)).toBe(true);
  await expect(flexao(page)).toContainText("13 repetições");
  await desligarRede(page);
  await page.reload();
  await abrir(page).click();
  await expect(folha(page)).toContainText("7 repetições · 23,5 kg na barra");
  await expect(flexao(page)).toContainText("13 repetições");
  await expect(folha(page).getByText(PARCIAL)).toHaveCount(0);
});
