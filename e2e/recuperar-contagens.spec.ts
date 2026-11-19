import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { prepararFechamentoAntigo } from "./contagens-legadas";
import { abrirSecaoDoRelatorio, fixarData, irNaAba, lerDoMock, naFila, resetarMock } from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { NOME } from "./treino-livre-ativo";

test("uma correção já digitada e outra feita sem rede destravam o mesmo treino antigo e seu backup", async ({ page, context }) => {
  await resetarMock();
  await fixarData(page, "2026-09-14T13:00:00-03:00");
  const resposta = page.waitForResponse(r => r.url().includes("/rest/v1/session_sets") && r.request().method() === "POST" && r.status() === 400);
  const { conta, id, series } = await prepararFechamentoAntigo(page);
  await page.reload();
  expect(await (await resposta).json()).toMatchObject({ code: "22P02" });
  expect(await lerDoMock(conta, "session_sets", "session_id=eq." + id)).toHaveLength(0);

  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Corrigir contagens" }).click();
  const dialogo = page.getByRole("dialog", { name: "Corrigir contagens" });
  const primeira = dialogo.getByRole("form", { name: NOME + " · Série 1" });
  await expect(primeira).toContainText("9,5");
  await expect(primeira).toContainText("10");
  await primeira.getByRole("button", { name: "Confirmar correção" }).click();
  await expect(primeira).toHaveCount(0);
  const segunda = dialogo.getByRole("form", { name: NOME + " · Série 2" });
  await expect(segunda).toContainText("8,5");
  await segunda.getByRole("textbox", { name: "Repetições", exact: true }).fill("8");
  await segunda.getByRole("button", { name: "Confirmar correção" }).click();
  await expect(segunda).toHaveCount(0);
  await expect(dialogo).toContainText("Correção salva neste aparelho.");
  await page.keyboard.press("Escape");
  await semRedeNoWorker(worker);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mais", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Corrigir contagens" })).toHaveCount(0);
  expect(await naFila(page)).toBeGreaterThan(0);

  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  await page.getByRole("button", { name: /^Ver séries de Treino da varanda/ }).click();
  const detalhe = page.getByRole("dialog", { name: "Séries do treino" });
  await expect(detalhe).toContainText("10 repetições · 21,5 kg na barra");
  await expect(detalhe).toContainText("8 repetições · 23,5 kg na barra");
  await comRedeNoWorker(worker);
  await context.setOffline(false);
  await expect.poll(() => naFila(page)).toBe(0);
  const gravadas = await lerDoMock(conta, "session_sets", "session_id=eq." + id + "&order=set_index.asc");
  expect(gravadas).toMatchObject([
    { id: series[0].id, reps: 10, carga_kg: 21.5 }, { id: series[1].id, reps: 8, carga_kg: 23.5 },
  ]);
  await page.goto("/mais/backup");
  const arquivo = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar backup", exact: true }).click();
  const caminho = await (await arquivo).path();
  expect(caminho).toBeTruthy();
  const backup = JSON.parse(await readFile(caminho!, "utf8"));
  expect(backup.tabelas.sessions).toEqual(expect.arrayContaining([expect.objectContaining({ id, status: "concluida", nota_geral: "Voltei ao terraço." })]));
  expect(backup.tabelas.session_sets).toHaveLength(2);
});
