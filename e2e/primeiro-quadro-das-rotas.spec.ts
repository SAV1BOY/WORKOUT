import { expect, test } from "@playwright/test";
import { entrarNoApp, resetarMock, usuarioComPerfil } from "./fixtures";

test("o HTML inicial reserva quatro linhas em Explorar e três totais no Relatório", async ({ browser, page }) => {
  await resetarMock();
  await usuarioComPerfil();
  await entrarNoApp(page);

  // Sem executar o script que revela o restante da resposta em streaming,
  // o navegador mantém em tela o primeiro conteúdo enviado pelo servidor.
  const antesDaHidratacao = await browser.newContext({
    storageState: await page.context().storageState(),
    javaScriptEnabled: false,
    serviceWorkers: "block",
    viewport: { width: 360, height: 740 },
  });
  try {
    const inicial = await antesDaHidratacao.newPage();
    const origem = new URL(page.url()).origin;
    await inicial.goto(origem + "/explorar");
    const linhas = inicial.locator('main ul[role="status"] > li');
    await expect(linhas).toHaveCount(4);
    const formas = await linhas.evaluateAll((itens) => itens.map((el) => el.getBoundingClientRect().toJSON()));
    for (const [i, forma] of formas.entries()) {
      expect(forma.width).toBeGreaterThan(200);
      expect(forma.height).toBeGreaterThan(40);
      if (i > 0) expect(forma.top).toBeGreaterThanOrEqual(formas[i - 1]!.bottom);
    }

    await inicial.goto(origem + "/relatorio");
    const estado = inicial.getByRole("status", { name: "Carregando o relatório" });
    await expect(estado).toBeVisible();
    const totais = estado.locator("[data-grade-de-totais] > div");
    await expect(totais).toHaveCount(3);
    const caixas = await totais.evaluateAll((itens) => itens.map((el) => el.getBoundingClientRect().toJSON()));
    for (const [i, caixa] of caixas.entries()) {
      expect(caixa.width).toBeGreaterThan(40);
      expect(caixa.height).toBeGreaterThan(40);
      expect(caixa.top).toBe(caixas[0]!.top);
      if (i > 0) expect(caixa.left).toBeGreaterThanOrEqual(caixas[i - 1]!.right);
    }

    // O mesmo conteúdo inicial dá lugar à interface interativa em cada rota.
    await page.goto("/explorar");
    await expect(page.getByRole("searchbox", { name: "Buscar exercício ou coleção" })).toBeEditable();
    await expect(page.locator('main ul[role="status"]')).toHaveCount(0);
    await page.goto("/relatorio");
    await expect(page.getByRole("status", { name: "Carregando o relatório" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Relatório", exact: true })).toBeVisible();
  } finally {
    await antesDaHidratacao.close();
  }
});
