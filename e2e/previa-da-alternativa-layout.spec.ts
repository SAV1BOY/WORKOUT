import { expect, test } from "@playwright/test";
import { acharExercicio } from "../lib/dados";
import { contrasteDe } from "./contraste";
import { entrarNoApp, fixarData, HOJE_FIXO, resetarMock, semRolagemHorizontal, usuarioComPerfil } from "./fixtures";

const exercicio = acharExercicio("supino-inclinado-com-halteres");

for (const tema of ["light", "dark"] as const) {
  test(`ler a execução pelo teclado com fonte a 200% em 320 px, tema ${tema}`, async ({ page }) => {
    await resetarMock();
    await usuarioComPerfil();
    await fixarData(page, HOJE_FIXO);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.emulateMedia({ colorScheme: tema, reducedMotion: "reduce" });
    await entrarNoApp(page);
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${tema}\\b`));
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

    const substituir = page.getByRole("button", { name: "Substituir Supino reto com barra", exact: true });
    await substituir.focus();
    await substituir.press("Enter");
    const folha = page.getByRole("dialog", { name: "Substituir hoje" });
    const lista = folha.getByRole("list", { name: "Exercícios alternativos" });
    const aplicar = lista.getByRole("button", { name: new RegExp("^" + exercicio.nome + " ") });
    const ver = lista.getByRole("button", { name: "Ver execução de " + exercicio.nome, exact: true });

    await aplicar.focus();
    await aplicar.press("Tab");
    await expect(ver).toBeFocused();
    await expect(ver).toHaveAttribute("aria-expanded", "false");
    await expect(ver).toBeInViewport({ ratio: 0.95 });
    const equipamento = folha.getByRole("button", { name: "Outro equipamento", exact: true });
    const escopo = folha.getByRole("group", { name: "Aplicar a troca" }).locator("label");
    for (const controle of [aplicar, ver, equipamento, ...await escopo.all()]) {
      const caixa = await controle.boundingBox();
      expect(caixa!.width).toBeGreaterThanOrEqual(44);
      expect(caixa!.height).toBeGreaterThanOrEqual(44);
      expect(caixa!.x).toBeGreaterThanOrEqual(0);
      expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(320);
      expect(await controle.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    }

    await ver.press("Space");
    await expect(ver).toHaveAttribute("aria-expanded", "true");
    const regiao = folha.getByRole("region", { name: "Execução de " + exercicio.nome, exact: true });
    const id = await ver.getAttribute("aria-controls");
    expect(id).toBeTruthy();
    await expect(regiao).toHaveAttribute("id", id!);
    await expect(regiao.getByText(exercicio.montagem, { exact: true })).toBeVisible();
    await expect(regiao.getByRole("listitem")).toHaveText(exercicio.passos);
    const ultimo = regiao.getByRole("listitem").last();
    await ultimo.scrollIntoViewIfNeeded();
    await expect(ultimo).toBeInViewport({ ratio: 0.95 });
    expect(await folha.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await semRolagemHorizontal(page);
    expect(await contrasteDe(page, `[aria-controls=${JSON.stringify(id)}]`)).toBeGreaterThanOrEqual(4.5);
    expect(await contrasteDe(page, `[id=${JSON.stringify(id)}] li`)).toBeGreaterThanOrEqual(4.5);

    await page.keyboard.press("Escape");
    await expect(regiao).toBeHidden();
    await expect(ver).toBeFocused();
    await expect(ver).toHaveAttribute("aria-expanded", "false");
    await ver.press("Shift+Tab");
    await expect(aplicar).toBeFocused();
    await aplicar.press("Escape");
    await expect(folha).toBeHidden();
    await expect(substituir).toBeFocused();
  });
}
