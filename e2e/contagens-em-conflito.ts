import { expect, type Page } from "@playwright/test";
import { prepararFechamentoAntigo } from "./contagens-legadas";
import { entrarNoApp, fixarData, lerDoMock, naFila, resetarMock } from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { NOME } from "./treino-livre-ativo";

export const FLEXAO_IMPORTADA = "flexao-de-braco";

export async function importarNaTelaDeBackup(page: Page, conta: string, sessoes: Record<string, unknown>[], series: Record<string, unknown>[]) {
  const arquivo = { app: "treino-terraco", versao: 1, exportado_em: "2026-09-14T15:00:00Z",
    user_id: conta, tabelas: { sessions: sessoes, session_sets: series } };
  await page.locator("#arquivo-backup").setInputFiles({
    name: "treino-do-terraco.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(arquivo)),
  });
  await page.getByRole("button", { name: "Importar tudo", exact: true }).click();
}

export async function corrigirAsDuasContagens(page: Page) {
  await page.getByRole("button", { name: "Corrigir contagens", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Corrigir contagens", exact: true });
  const formulario = (n: number) => dialogo.getByRole("form", { name: `${NOME} · Série ${n}`, exact: true });
  await expect(formulario(1)).toContainText("9,5");
  const reps = formulario(1).getByRole("textbox", { name: "Repetições", exact: true });
  if (await reps.count()) await reps.fill("10");
  await formulario(1).getByRole("button", { name: "Confirmar correção", exact: true }).click();
  await expect(formulario(1)).toHaveCount(0);
  await formulario(2).getByRole("textbox", { name: "Repetições", exact: true }).fill("8");
  await formulario(2).getByRole("button", { name: "Confirmar correção", exact: true }).click();
  await expect(formulario(2)).toHaveCount(0);
  await expect(dialogo).toContainText("Correção salva neste aparelho.");
  return dialogo;
}

/** Um backup mais novo altera os UUIDs que a versão anterior ainda tentava enviar. */
export async function abrirConflitosDoBackup(page: Page) {
  await resetarMock();
  await fixarData(page, "2026-09-14T13:00:00-03:00");
  const rejeitada = page.waitForResponse(r => new URL(r.url()).pathname === "/rest/v1/session_sets"
    && r.request().method() === "POST" && r.status() === 400);
  const { conta, id, series } = await prepararFechamentoAntigo(page);
  await page.reload();
  expect(await (await rejeitada).json()).toMatchObject({ code: "22P02" });
  const sessoes = await lerDoMock(conta, "sessions", `id=eq.${id}`);
  const lerSeries = () => lerDoMock(conta, "session_sets", `session_id=eq.${id}&order=set_index.asc`);
  const agachamento = { ...series[0], reps: 14, carga_kg: 33.5 };
  const flexao = { ...series[1], exercise_id: FLEXAO_IMPORTADA, reps: 18, carga_kg: 0 };
  const importadas = [agachamento, flexao];
  await page.goto("/mais/backup");
  await importarNaTelaDeBackup(page, conta.userId, sessoes, importadas);
  await expect.poll(lerSeries).toMatchObject(importadas);
  expect(await naFila(page)).toBeGreaterThan(0);

  await page.goto("/mais");
  const worker = await workerDoApp(page.context());
  await semRedeNoWorker(worker);
  await page.context().setOffline(true);
  const dialogo = await corrigirAsDuasContagens(page);

  // Outro navegador da mesma conta edita o primeiro UUID com a rede do primeiro desligada.
  const origem = new URL(page.url()).origin;
  const outra = await page.context().browser()!.newContext({ baseURL: origem, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const atualizadas = [{ ...agachamento, reps: 15, carga_kg: 35.5 }, flexao];
  try {
    const aba = await outra.newPage();
    await fixarData(aba, "2026-09-14T13:01:00-03:00");
    await entrarNoApp(aba);
    await aba.goto("/mais/backup");
    await importarNaTelaDeBackup(aba, conta.userId, sessoes, atualizadas);
    await expect.poll(lerSeries).toMatchObject(atualizadas);
    await expect.poll(() => naFila(aba)).toBe(0);
  } finally {
    await outra.close();
  }
  await comRedeNoWorker(worker);
  await page.context().setOffline(false);
  const primeira = dialogo.getByRole("group", { name: `${NOME} · Série 1`, exact: true });
  const segunda = dialogo.getByRole("group", { name: `${NOME} · Série 2`, exact: true });
  await expect(primeira).toBeVisible();
  // A descoberta da divergência não tem permissão para regravar o conteúdo do backup.
  expect(await lerSeries()).toMatchObject(atualizadas);
  return { conta, id, series, dialogo, primeira, segunda, lerSeries };
}
