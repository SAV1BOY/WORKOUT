import { expect, test } from "@playwright/test";
import { entrarNoApp, fixarData, resetarMock, semRolagemHorizontal, usuarioComPerfil } from "./fixtures";

for (const tema of ["light", "dark"] as const) {
  test(`equipamento de hoje a 360 px, com teclado e texto a 125% no tema ${tema}`, async ({ page }, info) => {
    await resetarMock();
    await usuarioComPerfil();
    await fixarData(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
    await entrarNoApp(page);
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${tema}\\b`));
    await page.addStyleTag({ content: "html { font-size: 125% !important; }" });

    const ajustar = page.getByRole("button", { name: "Ajustar", exact: true });
    await ajustar.click();
    const folha = page.getByRole("dialog", { name: "Ajustar" });
    const titulo = folha.locator("summary").filter({ hasText: "Equipamento de hoje" });
    await titulo.focus();
    await titulo.press("Enter");
    const materiais = folha.getByRole("group", { name: "Equipamento de hoje" });
    await expect(materiais).toBeVisible();
    await page.keyboard.press("Tab");
    const corpo = materiais.getByRole("button", { name: "Só peso do corpo" });
    await expect(corpo).toBeFocused();
    await corpo.press("Enter");
    const elastico = materiais.getByRole("checkbox", { name: "Elástico (Super Band)" });
    await elastico.focus();
    await elastico.press("Space");
    await expect(elastico).toBeChecked();
    await expect(titulo).toContainText("Elástico");
    const alvos = materiais.locator("button, label");
    for (const alvo of await alvos.all()) {
      const caixa = await alvo.boundingBox();
      expect(caixa!.height).toBeGreaterThanOrEqual(44);
      expect(caixa!.width).toBeGreaterThanOrEqual(44);
      expect(caixa!.x).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(360);
      expect(await alvo.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    await titulo.scrollIntoViewIfNeeded();
    await info.attach(`equipamento-de-hoje-${tema}`, { body: await page.screenshot(), contentType: "image/png" });
    await semRolagemHorizontal(page);
    await page.keyboard.press("Escape");
    await expect(ajustar).toBeFocused();
  });
}
