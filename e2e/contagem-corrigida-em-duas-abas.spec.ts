import { expect, test } from "@playwright/test";
import { prepararFechamentoAntigo } from "./contagens-legadas";
import { atualizarNoMock, esperarServiceWorker, fixarData, inserirNoMock, lerDoMock, naFila, resetarMock } from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { FRONTAL, NOME } from "./treino-livre-ativo";

declare global {
  interface Window {
    leituraAntigaDaFicha: { ids: string[]; liberar: () => void };
  }
}

test("um GET antigo da ficha não repõe 8,5 após a correção da série em outra aba", async ({ page, context }) => {
  test.setTimeout(60_000);
  await resetarMock();
  await fixarData(page, "2026-09-14T13:00:00-03:00");
  const { conta, id, series } = await prepararFechamentoAntigo(page);
  // A primeira série já existe no servidor. A segunda existe apenas no fechamento e na fila do aparelho.
  await inserirNoMock(conta, "session_sets", [{ ...series[0], reps: 10 }]);
  await page.reload();
  const corrigir = page.getByRole("button", { name: "Corrigir contagens", exact: true });
  await expect(corrigir).toBeVisible();

  const ficha = await context.newPage();
  await fixarData(ficha, "2026-09-14T13:01:00-03:00");
  await ficha.addInitScript(sessaoId => {
    // A aba Mais foi a última a guardar seu conjunto de consultas. Mantemos essa ordem
    // mesmo quando o temporizador de persistência da ficha dispara primeiro no Chromium.
    const gravar = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const registro = args[0];
      if (this.name === "cache" && registro?.chave === "react-query-v1") {
        const estado = registro.valor.estado;
        const queries = estado.queries.filter((q: { queryKey: string[] }) => q.queryKey[1] !== "series-ex");
        args[0] = { ...registro, valor: { ...registro.valor, estado: { ...estado, queries } } };
      }
      return gravar.apply(this, args);
    };
    const buscar = window.fetch.bind(window);
    let liberar!: () => void;
    const barreira = new Promise<void>(ok => { liberar = ok; });
    const sinal = { ids: [] as string[], liberar };
    window.leituraAntigaDaFicha = sinal;
    window.fetch = async (entrada, opcoes) => {
      const resposta = await buscar(entrada, opcoes);
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada), location.href);
      const metodo = opcoes?.method ?? (entrada instanceof Request ? entrada.method : "GET");
      if (metodo === "GET" && url.pathname === "/rest/v1/session_sets" && url.searchParams.get("session_id") === "eq." + sessaoId) {
        const linhas: { id: string }[] = await resposta.clone().json();
        sinal.ids = linhas.map(linha => linha.id);
        await barreira;
      }
      return resposta;
    };
  }, id);
  await ficha.goto(`/exercicios/${FRONTAL}`);
  await esperarServiceWorker(ficha);
  const abrir = ficha.getByRole("button", { name: /^Ver séries de Treino da varanda/ });
  await abrir.click();
  await expect.poll(() => ficha.evaluate(() => window.leituraAntigaDaFicha.ids)).toEqual([series[0].id]);
  const detalhe = ficha.getByRole("dialog", { name: "Séries do treino", exact: true });
  await expect(detalhe).toContainText("8,5 repetições · 23,5 kg na barra");

  await fixarData(page, "2026-09-14T13:02:00-03:00");
  await corrigir.click();
  const correcoes = page.getByRole("dialog", { name: "Corrigir contagens", exact: true });
  const confirmar = (n: number) => correcoes.getByRole("form", { name: `${NOME} · Série ${n}`, exact: true });
  await confirmar(1).getByRole("button", { name: "Confirmar correção", exact: true }).click();
  await expect(confirmar(1)).toHaveCount(0);
  await confirmar(2).getByRole("textbox", { name: "Repetições", exact: true }).fill("8");
  await confirmar(2).getByRole("button", { name: "Confirmar correção", exact: true }).click();
  await expect(confirmar(2)).toHaveCount(0);
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await lerDoMock(conta, "session_sets", `session_id=eq.${id}&order=set_index.asc`)).toMatchObject([
    { id: series[0].id, reps: 10 }, { id: series[1].id, reps: 8 },
  ]);

  await ficha.evaluate(() => window.leituraAntigaDaFicha.liberar());
  const segundaSerie = detalhe.getByRole("listitem").filter({ has: ficha.getByText("Série 2", { exact: true }) });
  await expect(segundaSerie).toContainText("8 repetições · 23,5 kg na barra");
  await expect(detalhe).not.toContainText("8,5 repetições");
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  expect((await ficha.reload())?.fromServiceWorker()).toBe(true);
  await expect(ficha.getByRole("heading", { name: NOME, exact: true })).toBeVisible();
  await expect(abrir).toBeVisible();
  await abrir.click();
  await expect(segundaSerie).toContainText("8 repetições · 23,5 kg na barra");
  await expect(detalhe).not.toContainText("8,5 repetições");

  // O detalhe segue aberto quando o celular volta a receber as séries da conta.
  await atualizarNoMock(conta, "session_sets", `id=eq.${series[1].id}&user_id=eq.${conta.userId}`, { reps: 11 });
  await ficha.evaluate(() => window.leituraAntigaDaFicha.liberar());
  const voltou = ficha.waitForResponse(r => {
    const url = new URL(r.url());
    return r.ok() && url.pathname === "/rest/v1/session_sets" && url.searchParams.get("exercise_id") === `eq.${FRONTAL}`;
  });
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await voltou;
  await expect(detalhe).toBeVisible();
  await expect(segundaSerie).toContainText("11 repetições · 23,5 kg na barra");
  await ficha.keyboard.press("Escape");
  await expect(abrir).toBeFocused();
});
