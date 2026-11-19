import { expect, test } from "@playwright/test";
import { entrarNoApp, fixarData, HOJE_FIXO, resetarMock, semRolagemHorizontal, usuarioComPerfil } from "./fixtures";

const nome = "Supino inclinado com halteres";

for (const tema of ["light", "dark"] as const) {
  test(`buscar, limpar e aplicar pelo teclado em 320 px a 200%, tema ${tema}`, async ({ page }) => {
    await resetarMock();
    await usuarioComPerfil();
    await fixarData(page, HOJE_FIXO);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
    await entrarNoApp(page);
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${tema}\\b`));
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

    await page.getByRole("button", { name: "Substituir Supino reto com barra", exact: true }).press("Enter");
    const folha = page.getByRole("dialog", { name: "Substituir hoje" });
    const busca = folha.getByRole("searchbox", { name: "Buscar alternativa pelo nome" });
    const limpar = folha.getByRole("button", { name: "Limpar busca" });
    await busca.pressSequentially("inexistente");
    await expect(folha.getByRole("status")).toHaveText("Nenhuma alternativa com esse nome.");
    await busca.press("Tab");
    await expect(limpar).toBeFocused();
    for (const controle of [busca, limpar]) {
      const caixa = await controle.boundingBox();
      expect(caixa!.x).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(320);
      expect(caixa!.width).toBeGreaterThanOrEqual(44);
      expect(caixa!.height).toBeGreaterThanOrEqual(44);
    }
    const cabeSupino = await busca.evaluate(el => {
      const css = getComputedStyle(el);
      const medida = document.createElement("canvas").getContext("2d")!;
      medida.font = css.font;
      const larguraDoTexto = el.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
      return larguraDoTexto >= medida.measureText("Supino").width;
    });
    expect(cabeSupino, "A palavra Supino cabe no campo com Limpar busca visível").toBe(true);
    await expect(folha.getByText("Buscar alternativa pelo nome", { exact: true })).toBeVisible();
    await limpar.press("Enter");
    await expect(busca).toBeFocused();
    await expect(busca).toHaveValue("");
    await busca.pressSequentially(nome);

    const lista = folha.getByRole("list", { name: "Exercícios alternativos" });
    await expect(lista.getByRole("listitem")).toHaveCount(1);
    const aplicar = lista.getByRole("button", { name: new RegExp("^" + nome + " ") });
    await busca.press("Tab");
    await expect(limpar).toBeFocused();
    await limpar.press("Tab");
    await expect(aplicar).toBeFocused();
    const rotulo = aplicar.getByText(nome, { exact: true });
    expect(await rotulo.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
    expect(await folha.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await semRolagemHorizontal(page);

    await aplicar.press("Tab");
    const ver = lista.getByRole("button", { name: "Ver execução de " + nome });
    await expect(ver).toBeFocused();
    await ver.press("Enter");
    await expect(folha.getByRole("region", { name: "Execução de " + nome })
      .getByRole("heading", { name: "Instruções" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(ver).toBeFocused();
    await ver.press("Shift+Tab");
    await expect(aplicar).toBeFocused();
    await aplicar.press("Enter");
    await expect(folha).toBeHidden();
    await expect(page.getByRole("button", { name: "Substituir " + nome, exact: true })).toBeVisible();
  });
}
