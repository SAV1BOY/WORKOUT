import { expect, test } from "@playwright/test";
import { entrarNoApp, fixarData, resetarMock, usuarioComPerfil } from "./fixtures";

test("trocar o material pelo teclado identifica o escolhido incompatível e conserva a busca e a ordem", async ({ page }) => {
  await resetarMock();
  await usuarioComPerfil();
  await fixarData(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await entrarNoApp(page);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.getByRole("button", { name: /Personalizar treino/ }).press("Enter");

  const folha = page.getByRole("dialog", { name: "Crie o seu próprio" });
  const busca = folha.getByRole("searchbox", { name: "Buscar exercício pelo nome" });
  const catalogo = folha.getByRole("list", { name: "Catálogo" });
  const corporal = "Flexão de braço";
  const supino = "Supino reto com barra";
  for (const nome of [corporal, supino]) {
    await busca.fill(nome);
    const resultado = catalogo.getByRole("button").filter({ has: page.getByText(nome, { exact: true }) });
    await resultado.press("Enter");
    await expect(resultado).toHaveAttribute("aria-pressed", "true");
  }

  const material = folha.locator("summary").filter({ hasText: "Equipamentos disponíveis" });
  await material.press("Enter");
  await page.keyboard.press("Tab");
  const grupo = folha.getByRole("group", { name: "Equipamento de hoje" });
  await expect(grupo.getByRole("button", { name: "Só peso do corpo" })).toBeFocused();
  const barra = grupo.getByRole("checkbox", { name: "Barra maciça", exact: true });
  const quantidade = await grupo.getByRole("checkbox").count();
  for (let i = 0; i < quantidade; i++) {
    await page.keyboard.press("Tab");
    if (await barra.evaluate(el => el === document.activeElement)) break;
  }
  await expect(barra).toBeFocused();
  await page.keyboard.press("Space");
  await expect(barra).not.toBeChecked();
  await expect(barra).toBeFocused();
  const alvoDaBarra = await barra.evaluate(input => {
    const rotulo = (input as HTMLInputElement).labels?.[0];
    if (!rotulo) throw new Error("A opção Barra maciça precisa de um rótulo associado.");
    const r = rotulo.getBoundingClientRect();
    return { altura: r.height, visivel: rotulo.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) };
  });
  expect(alvoDaBarra.altura).toBeGreaterThanOrEqual(44);
  expect(alvoDaBarra.visivel).toBe(true);
  await material.press("Enter");
  await expect(busca).toHaveValue(supino);
  await expect(catalogo.getByText(supino, { exact: true })).toHaveCount(0);
  await busca.press("Tab");
  const limpar = folha.getByRole("button", { name: "Limpar busca" });
  await expect(limpar).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(busca).toBeFocused();
  await expect(busca).toHaveValue("");
  await expect(catalogo.getByText(corporal, { exact: true })).toBeVisible();
  await expect(catalogo.getByText(supino, { exact: true })).toHaveCount(0);
  await busca.fill(supino);

  const escolhidos = folha.getByRole("list", { name: "Escolhidos" }).getByRole("listitem");
  const tirarSupino = folha.getByRole("button", { name: "Tirar " + supino });
  await expect(escolhidos).toHaveCount(2);
  await expect(escolhidos.first()).toContainText(corporal);
  await expect(escolhidos.first().getByRole("button")).not.toHaveAccessibleDescription(/Requer outro material/);
  const aviso = escolhidos.last().getByText("Requer outro material", { exact: true });
  await expect(aviso).toBeVisible();
  await expect(tirarSupino).toHaveAccessibleDescription(/Requer outro material/);
  await aviso.scrollIntoViewIfNeeded();
  const avisoLegivel = await aviso.evaluate(el => {
    const texto = document.createRange();
    texto.selectNodeContents(el);
    return [...texto.getClientRects()].every(r => r.left >= 0 && r.right <= document.documentElement.clientWidth &&
      el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)));
  });
  expect(avisoLegivel, "as linhas do aviso ficam visíveis com fonte ampliada").toBe(true);

  const reordenar = folha.getByRole("button", { name: "Reordenar escolhidos" });
  await reordenar.press("Enter");
  const ordem = page.getByRole("dialog", { name: "Reordenar escolhidos" });
  await ordem.getByRole("button", { name: "Subir " + supino }).press("Space");
  await expect(ordem.getByRole("button", { name: "Descer " + supino })).toBeFocused();
  await ordem.getByRole("button", { name: "Pronto" }).press("Enter");
  await expect(reordenar).toBeFocused();
  await expect(escolhidos.first()).toContainText(supino);
  await expect(escolhidos.first()).toContainText("Requer outro material");
  await expect(escolhidos.last()).toContainText(corporal);

  await material.press("Enter");
  await expect(barra).not.toBeChecked();
  await barra.press("Space");
  await expect(barra).toBeChecked();
  await expect(barra).toBeFocused();
  await expect(tirarSupino).not.toHaveAccessibleDescription(/Requer outro material/);
  await expect(folha.getByText("Requer outro material", { exact: true })).toHaveCount(0);
  await expect(busca).toHaveValue(supino);
  await expect(catalogo.getByRole("button").filter({ has: page.getByText(supino, { exact: true }) })).toHaveAttribute("aria-pressed", "true");
  await expect(escolhidos.first()).toContainText(supino);
  await expect(escolhidos.last()).toContainText(corporal);
});
