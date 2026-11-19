import { expect, test } from "@playwright/test";
import { entrarNoApp, fixarData, resetarMock, usuarioComPerfil } from "./fixtures";

// A resposta do documento fica a cargo da rota do teste, inclusive quando é uma recarga.
test.use({ serviceWorkers: "block" });

for (const sair of ["recarregar", "abrir Mais"] as const) {
  test(`fechar o diálogo deixa o navegador ${sair} mesmo com a resposta do documento pendente`, async ({ page }) => {
    await resetarMock();
    await usuarioComPerfil();
    await fixarData(page, "2026-09-14T08:00:00-03:00");
    await entrarNoApp(page);
    await page.goto("/calendario");
    const dia = page.getByRole("button", { name: /^quarta 16\/09/ });
    await dia.click();
    await expect(page.getByRole("dialog")).toContainText("16 de setembro de 2026");

    const caminho = sair === "recarregar" ? "/calendario" : "/mais";
    await page.route(url => url.pathname === caminho, async rota => {
      if (!rota.request().isNavigationRequest()) return rota.continue();
      // O documento antigo continua visível enquanto o novo chega. O Esc
      // fecha sua folha e devolve o foco à grade. Só então chega a resposta.
      await page.keyboard.press("Escape");
      await expect(dia).toBeFocused();
      await rota.continue();
    });
    const resposta = sair === "recarregar" ? await page.reload() : await page.goto(caminho);
    expect(resposta?.ok()).toBe(true);
    const titulo = sair === "recarregar" ? "Calendário" : "Mais";
    await expect(page.getByRole("heading", { name: titulo, exact: true, level: 1 })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}
