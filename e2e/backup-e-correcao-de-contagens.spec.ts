import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { prepararFechamentoAntigo } from "./contagens-legadas";
import { abrirConflitosDoBackup, corrigirAsDuasContagens, FLEXAO_IMPORTADA, importarNaTelaDeBackup } from "./contagens-em-conflito";
import { abrirSecaoDoRelatorio, fixarData, irNaAba, lerDoMock, naFila, resetarMock } from "./fixtures";
import { comRedeNoWorker, semRedeNoWorker, workerDoApp } from "./rede-do-worker";
import { FRONTAL, NOME } from "./treino-livre-ativo";

for (const escolha of ["histórico", "aparelho"] as const) {
  test(`um backup e outro aparelho alteraram o treino: escolher a contagem do ${escolha} preserva carga e movimento`, async ({ page, context }) => {
    test.setTimeout(90_000);
    const { id, series, dialogo, primeira, segunda, lerSeries } = await abrirConflitosDoBackup(page);
    await expect(primeira).toContainText("No aparelho");
    await expect(primeira).toContainText("No histórico");
    await expect(primeira).toContainText("15");
    await expect(primeira).toContainText("10");
    await expect(primeira).toContainText("35,5");
    const acao = escolha === "histórico" ? "Manter a contagem do histórico" : "Usar a contagem do aparelho";
    await primeira.getByRole("button", { name: acao, exact: true }).click();
    await expect(primeira).toHaveCount(0);

    await expect(segunda).toContainText(NOME);
    await expect(segunda).toContainText("Flexão de braço");
    await expect(segunda.getByRole("button", { name: "Usar a contagem do aparelho" })).toHaveCount(0);
    await segunda.getByRole("button", { name: "Manter a série do histórico", exact: true }).click();
    await expect(segunda).toHaveCount(0);
    await expect.poll(() => naFila(page)).toBe(0);
    const reps = escolha === "histórico" ? 15 : 10;
    const esperadas = [
      { id: series[0].id, session_id: id, exercise_id: FRONTAL, reps, carga_kg: 35.5 },
      { id: series[1].id, session_id: id, exercise_id: FLEXAO_IMPORTADA, reps: 18, carga_kg: 0 },
    ];
    expect(await lerSeries()).toMatchObject(esperadas);
    await page.keyboard.press("Escape");
    await expect(dialogo).toHaveCount(0);

    await page.goto("/mais/backup");
    const baixando = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar backup", exact: true }).click();
    const caminho = await (await baixando).path();
    const arquivo = JSON.parse(await readFile(caminho!, "utf8"));
    expect(arquivo.tabelas.session_sets).toHaveLength(2);
    expect(arquivo.tabelas.session_sets).toEqual(expect.arrayContaining(esperadas.map(s => expect.objectContaining(s))));
    expect(arquivo.tabelas.sessions).toMatchObject([{ id, status: "concluida", nota_geral: "Voltei ao terraço." }]);

    await page.goto("/mais");
    await semRedeNoWorker(await workerDoApp(context));
    await context.setOffline(true);
    await page.reload();
    await irNaAba(page, "Relatório");
    await abrirSecaoDoRelatorio(page, "historico");
    await page.getByRole("button", { name: /^Ver séries de Treino da varanda/ }).click();
    const detalhe = page.getByRole("dialog", { name: "Séries do treino", exact: true });
    await expect(detalhe.getByRole("region", { name: NOME, exact: true })).toContainText(`${reps} repetições · 35,5 kg na barra`);
    await expect(detalhe.getByRole("region", { name: "Flexão de braço", exact: true })).toContainText("18 repetições");
    await expect(detalhe.getByRole("listitem")).toHaveCount(2);
  });
}

test("um backup que só identifica outro exercício permite criar a série sem medidas e manter outro UUID ausente", async ({ page, context }) => {
  test.setTimeout(90_000);
  await resetarMock();
  await fixarData(page, "2026-09-14T13:00:00-03:00");
  const rejeitada = page.waitForResponse(r => new URL(r.url()).pathname === "/rest/v1/session_sets"
    && r.request().method() === "POST" && r.status() === 400);
  const { conta, id, series } = await prepararFechamentoAntigo(page, true, 20.5);
  await page.reload();
  expect(await (await rejeitada).json()).toMatchObject({ code: "22P02" });
  const lerSeries = () => lerDoMock(conta, "session_sets", `session_id=eq.${id}`);
  const sessoes = await lerDoMock(conta, "sessions", `id=eq.${id}`);
  const parciais = series.map(s => ({
    id: s.id, session_id: id, user_id: conta.userId, exercise_id: FLEXAO_IMPORTADA, ordem_ex: 2,
    set_index: s.set_index, tipo: "trabalho", concluida: true, registrada_em: s.registrada_em,
  }));
  await page.goto("/mais/backup");
  // A importação passa pela interface. A conexão cai no envio do lote, deixando-o apenas no aparelho.
  await page.evaluate(() => {
    const buscar = window.fetch.bind(window);
    window.fetch = async (entrada, opcoes) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada), location.href);
      const metodo = opcoes?.method ?? (entrada instanceof Request ? entrada.method : "GET");
      if (metodo === "POST" && url.pathname === "/rest/v1/session_sets") {
        const corpo = opcoes?.body ?? (entrada instanceof Request ? await entrada.clone().text() : null);
        const lote = typeof corpo === "string" ? JSON.parse(corpo) : null;
        if (Array.isArray(lote)) {
          document.documentElement.dataset.envioDoBackupFalhou = "sim";
          throw new TypeError("Failed to fetch");
        }
      }
      return buscar(entrada, opcoes);
    };
  });
  await importarNaTelaDeBackup(page, conta.userId, sessoes, parciais);
  await expect(page.locator("html")).toHaveAttribute("data-envio-do-backup-falhou", "sim");
  const worker = await workerDoApp(context);
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  expect(await lerSeries()).toEqual([]);
  await page.goto("/mais");
  const dialogo = await corrigirAsDuasContagens(page);
  await comRedeNoWorker(worker);
  await context.setOffline(false);

  const grupo = (n: number) => dialogo.getByRole("group", { name: `${NOME} · Série ${n}`, exact: true });
  const criar = grupo(1);
  await expect(criar).toContainText("Série do backup");
  await expect(criar).toContainText("Flexão de braço");
  await expect(criar).toContainText("Sem registro");
  expect(await lerSeries()).toEqual([]);
  await criar.getByRole("button", { name: "Criar a série no histórico", exact: true }).click();
  await expect(criar).toHaveCount(0);
  await grupo(2).getByRole("button", { name: "Manter o histórico sem esta série", exact: true }).click();
  await expect(grupo(2)).toHaveCount(0);
  await expect.poll(() => naFila(page)).toBe(0);
  const salvas = await lerSeries();
  expect(salvas).toMatchObject([parciais[0]!]);
  expect(salvas[0]?.reps ?? null).toBeNull();
  expect(salvas[0]?.carga_kg ?? null).toBeNull();
  await page.keyboard.press("Escape");
  await semRedeNoWorker(worker);
  await context.setOffline(true);
  await page.reload();
  await irNaAba(page, "Relatório");
  await abrirSecaoDoRelatorio(page, "historico");
  await page.getByRole("button", { name: /^Ver séries de Treino da varanda/ }).click();
  const detalhe = page.getByRole("dialog", { name: "Séries do treino", exact: true });
  await expect(detalhe.getByRole("listitem")).toHaveCount(1);
  await expect(detalhe.getByRole("region", { name: "Flexão de braço", exact: true })).toContainText("Sem valores registrados");
});
