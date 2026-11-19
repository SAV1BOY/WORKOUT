import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import type { LinhaSessaoCardio } from "../lib/types";
import { abrirCorrecaoDaCorda, nomeDaCorda, prepararCordaAntiga } from "./corda-antiga";
import { abrirSecaoDoRelatorio, irNaAba, lerDoMock, naFila, semRolagemHorizontal } from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";

async function rede(page: Page, online: boolean) {
  const worker = await workerDoApp(page.context());
  if (online) await comRedeNoWorker(worker);
  else await semRedeNoWorker(worker);
  await page.context().setOffline(!online);
}

async function exportarCardios(page: Page) {
  await page.goto("/mais/backup");
  const baixando = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar backup", exact: true }).click();
  const arquivo = await (await baixando).path();
  const { tabelas } = JSON.parse(await readFile(arquivo!, "utf8"));
  return tabelas.cardio_sessions as LinhaSessaoCardio[];
}

async function abrirHistorico(page: Page) {
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  return page.getByRole("list", { name: "Registros" }).locator("a[data-registro=cardio]");
}

test("duas cordas antigas do mesmo dia: corrigir 42,5 e deixar a outra sem contagem preserva cada treino", async ({ page }) => {
  test.setTimeout(90_000);
  const { conta, id, linha, segunda } = await prepararCordaAntiga(page, { segunda: true });
  if (!segunda) throw new Error("A segunda corda não foi preparada");
  const lerCardios = () => lerDoMock<LinhaSessaoCardio>(conta, "cardio_sessions");
  const lerMotor = () => lerDoMock(conta, "profiles", "select=semana_corda,semana_corrida,prefs");
  const motor = await lerMotor();
  expect(await lerCardios()).toEqual([]);

  await rede(page, false);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addStyleTag({ content: "html { font-size: 200% !important }" });
  const { dialogo, formulario } = await abrirCorrecaoDaCorda(page, id);
  const vizinha = dialogo.getByRole("form", { name: nomeDaCorda(segunda.id), exact: true });
  await expect(formulario).toContainText("42,5");
  await expect(vizinha).toContainText("71,5");
  const campo = formulario.getByRole("textbox", { name: "Saltos", exact: true });
  await campo.fill("42");
  const confirmar = formulario.getByRole("button", { name: "Confirmar correção", exact: true });
  await confirmar.focus();
  await expect(confirmar).toBeInViewport({ ratio: 1 });
  await semRolagemHorizontal(page);
  await confirmar.press("Enter");
  await expect(formulario).toHaveCount(0);
  const semContagem = vizinha.getByRole("checkbox", { name: "Deixar sem contagem", exact: true });
  await semContagem.focus();
  await semContagem.press("Space");
  await expect(semContagem).toBeChecked();
  await vizinha.getByRole("button", { name: "Confirmar correção", exact: true }).click();
  await expect(vizinha).toHaveCount(0);
  await expect(dialogo).toContainText("Correção salva neste aparelho.");
  expect(await lerCardios()).toEqual([]);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole("heading", { name: "Mais", exact: true })).toBeVisible();
  expect(await naFila(page)).toBeGreaterThan(0);

  const registros = await abrirHistorico(page);
  await expect(registros).toHaveCount(2);
  await expect(registros.filter({ hasText: "Corda" })).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Números" })).toContainText("42 saltos");
  await rede(page, true);
  await expect.poll(() => naFila(page)).toBe(0);
  const esperadas = [{ ...linha, saltos: 42 }, { ...segunda, saltos: null }];
  const servidor = await lerCardios();
  expect(servidor).toHaveLength(2);
  expect(servidor).toEqual(expect.arrayContaining(esperadas.map(c => expect.objectContaining(c))));
  expect(await lerMotor()).toEqual(motor);

  await registros.and(page.locator(`[href="/cardio/corda?sessao=${id}"]`)).click();
  await expect(page.getByText("Corda antes do almoço.", { exact: true })).toBeVisible();
  await expect(page.getByText("2 de 6", { exact: true })).toBeVisible();
  const saltosNoResumo = page.locator("dl > div").filter({ has: page.getByText("Saltos", { exact: true }) }).locator("dd");
  await expect(saltosNoResumo).toHaveText("42");
  await page.goBack();
  await registros.and(page.locator(`[href="/cardio/corda?sessao=${segunda.id}"]`)).click();
  await expect(page.getByText("Corda no fim do dia.", { exact: true })).toBeVisible();
  await expect(saltosNoResumo).toHaveText("—");
  const backup = await exportarCardios(page);
  expect(backup).toHaveLength(2);
  expect(backup).toEqual(expect.arrayContaining(esperadas.map(c => expect.objectContaining(c))));
});

test("restaurar pelo backup uma corrida de 4,25 km no UUID da corda conserva o registro que foi escolhido", async ({ page }) => {
  test.setTimeout(90_000);
  const { conta, id, data, linha } = await prepararCordaAntiga(page);
  const corrida = {
    ...linha, tipo: "corrida" as const, data, saltos: null, distancia_km: 4.25, duracao_min: 28.5,
    feito: { repeticoes_cumpridas: 4, repeticoes_planejadas: 5, decorrido_s: 1710 },
    planejado: { tipo: "corrida", semana: 2, repeticoes: 5, total_s: 1800 },
    semana_plano: 2, esforco: "facil" as const, notas: "Volta no parque com a Ana.",
  };
  const lerCardios = () => lerDoMock<LinhaSessaoCardio>(conta, "cardio_sessions");
  await page.goto("/mais/backup");
  const arquivo = { app: "treino-terraco", versao: 1, exportado_em: data + "T16:00:00Z", user_id: conta.userId,
    tabelas: { cardio_sessions: [corrida] } };
  await page.locator("#arquivo-backup").setInputFiles({ name: "corrida.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(arquivo)) });
  await page.getByRole("button", { name: "Importar tudo", exact: true }).click();
  await expect.poll(lerCardios).toMatchObject([corrida]);
  expect(await naFila(page)).toBeGreaterThan(0);
  await page.goto("/mais");
  await rede(page, false);
  const { dialogo, formulario, conflito } = await abrirCorrecaoDaCorda(page, id);
  await formulario.getByRole("textbox", { name: "Saltos", exact: true }).fill("42");
  await formulario.getByRole("button", { name: "Confirmar correção", exact: true }).click();
  await expect(dialogo).toContainText("Correção salva neste aparelho.");
  await rede(page, true);
  await expect(conflito).toContainText("Corrida");
  await expect(conflito.getByRole("button", { name: "Usar a contagem do aparelho", exact: true })).toHaveCount(0);
  await conflito.getByRole("button", { name: "Manter o treino do histórico", exact: true }).click();
  await expect(conflito).toHaveCount(0);
  await expect.poll(() => naFila(page)).toBe(0);
  expect(await lerCardios()).toMatchObject([corrida]);
  await page.keyboard.press("Escape");
  const registros = await abrirHistorico(page);
  await expect(registros).toHaveCount(1);
  await expect(registros).toHaveAttribute("href", `/cardio/corrida?sessao=${id}`);
  const conferirResumo = async () => {
    await expect(page.getByText("Sessão registrada", { exact: true })).toBeVisible();
    const valor = (termo: string) => page.locator("dl > div").filter({ has: page.getByText(termo, { exact: true }) }).locator("dd");
    await expect(valor("Distância")).toHaveText("4,25 km");
    await expect(valor("Duração")).toHaveText("29 min");
    await expect(valor("Blocos cumpridos")).toHaveText("4 de 5");
    await expect(valor("Nota")).toHaveText(corrida.notas);
    await expect(page.getByRole("button", { name: "Começar", exact: true })).toHaveCount(0);
  };
  await registros.click();
  await conferirResumo();
  expect(await page.evaluate(() => new Promise<number>((ok, erro) => {
    const abrir = indexedDB.open("treino-terraco");
    abrir.onerror = () => erro(abrir.error);
    abrir.onsuccess = () => {
      const banco = abrir.result;
      const ativos = banco.transaction("cardioAtivo").objectStore("cardioAtivo").count();
      ativos.onsuccess = () => { banco.close(); ok(ativos.result); };
      ativos.onerror = () => { banco.close(); erro(ativos.error); };
    };
  }))).toBe(0);

  expect(await exportarCardios(page)).toMatchObject([corrida]);
  await page.goto("/mais");
  await rede(page, false);
  expect((await page.reload())?.fromServiceWorker()).toBe(true);
  const semRede = await abrirHistorico(page);
  await expect(semRede).toHaveCount(1);
  await expect(semRede).toHaveAttribute("href", `/cardio/corrida?sessao=${id}`);
  await expect(page.getByRole("region", { name: "Números" })).toContainText("4,25 km");
  await semRede.click();
  await conferirResumo();
});
