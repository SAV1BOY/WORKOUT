import { expect, test } from "@playwright/test";
import { abrirSecaoDoRelatorio, entrarNoApp, esperarServiceWorker, fixarData, inserirNoMock, irNaAba, naFila, resetarMock, usuarioComPerfil } from "./fixtures";
import { semRedeNoWorker, workerDoApp } from "./rede-do-worker";

test("o primeiro toque num cardio guardado no Histórico abre o resumo daquele treino sem rede", async ({ page, context }) => {
  test.setTimeout(60_000);
  await resetarMock();
  const conta = await usuarioComPerfil();
  await fixarData(page, "2026-09-14T13:00:00-03:00");
  const id = crypto.randomUUID();
  const corrida = { id, user_id: conta.userId, tipo: "corrida", data: "2026-09-14", concluida: true,
    duracao_min: 37, distancia_km: 5.25, notas: "Corrida do backup ao entardecer." };
  const vizinha = { ...corrida, id: crypto.randomUUID(), duracao_min: 29, distancia_km: 4.75, notas: "Treino da manhã." };
  await inserirNoMock(conta, "cardio_sessions", [corrida, vizinha]);
  await entrarNoApp(page);
  await esperarServiceWorker(page);
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  const link = page.getByRole("list", { name: "Registros" }).getByRole("link").filter({ hasText: "37 min" });
  const caminho = "/cardio/corrida?sessao=" + id;
  await expect(link).toHaveAttribute("href", caminho);
  await semRedeNoWorker(await workerDoApp(context));
  await context.setOffline(true);
  await link.focus();
  await link.press("Enter");
  await expect(page).toHaveURL(url => url.pathname + url.search === caminho);
  await expect(page.getByText(corrida.notas, { exact: true })).toBeVisible();
  await expect(page.getByText("5,25 km", { exact: true })).toBeVisible();
  await expect(page.getByText(vizinha.notas, { exact: true })).toHaveCount(0);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(page.getByText(corrida.notas, { exact: true })).toBeVisible();
  await page.goto("/cardio/corrida?sessao=" + crypto.randomUUID());
  await expect(page.getByText("Não achei esta sessão de cardio.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Começar", exact: true })).toHaveCount(0);
  expect(await naFila(page)).toBe(0);
  const ativas = await page.evaluate(() => new Promise<number>((ok, erro) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => erro(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const contar = banco.transaction("cardioAtivo").objectStore("cardioAtivo").count();
      contar.onsuccess = () => { banco.close(); ok(contar.result); };
      contar.onerror = () => { banco.close(); erro(contar.error); };
    };
  }));
  expect(ativas).toBe(0);
  await page.goto(caminho);
  await expect(page.getByText(corrida.notas, { exact: true })).toBeVisible();
  const outraAba = await context.newPage();
  await context.clearCookies();
  await page.bringToFront();
  await outraAba.close();
  await expect(page.getByRole("heading", { name: "Sem conexão", exact: true })).toBeVisible();
  await expect(page.getByText(corrida.notas, { exact: true })).toHaveCount(0);
});
