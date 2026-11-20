import { expect, test, type Locator } from "@playwright/test";
import { entrarNoApp, fixarData, resetarMock, semRolagemHorizontal, usuarioComPerfil } from "./fixtures";

async function conferirAlvo(alvo: Locator) {
  await alvo.scrollIntoViewIfNeeded();
  const caixa = await alvo.boundingBox();
  expect(caixa).not.toBeNull();
  expect(caixa!.height).toBeGreaterThanOrEqual(44);
  expect(caixa!.width).toBeGreaterThanOrEqual(44);
  expect(caixa!.x).toBeGreaterThanOrEqual(0);
  expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(320);
  await expect.poll(() => alvo.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}

test("salvar e cancelar a exclusão de um treino pelo teclado com fonte ampliada", async ({ page }) => {
  await resetarMock();
  await usuarioComPerfil();
  await fixarData(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await entrarNoApp(page);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  const personalizar = page.getByRole("button", { name: /Personalizar treino/ });
  await personalizar.press("Enter");
  const editor = page.getByRole("dialog", { name: "Crie o seu próprio" });
  await editor.getByRole("searchbox").fill("prancha");
  const exercicio = editor.getByRole("list", { name: "Catálogo" }).getByRole("button")
    .filter({ has: page.getByText("Prancha", { exact: true }) });
  await exercicio.press("Space");
  const salvar = editor.getByRole("button", { name: "Salvar treino", exact: true });
  await conferirAlvo(salvar);
  await salvar.press("Enter");

  const formulario = page.getByRole("dialog", { name: "Salvar treino", exact: true });
  await expect(formulario.getByRole("heading", { name: "Salvar treino" })).toBeFocused();
  await page.keyboard.press("Tab");
  const campo = formulario.getByRole("textbox", { name: "Nome do treino" });
  await expect(campo).toBeFocused();
  const nome = "Treino de força no terraço com tatame e elástico";
  await campo.fill(nome);
  const gravar = formulario.getByRole("button", { name: "Salvar", exact: true });
  await conferirAlvo(gravar);
  await gravar.press("Enter");
  await expect(formulario).toBeHidden();
  const biblioteca = editor.getByRole("button", { name: "Treinos salvos", exact: true });
  await biblioteca.press("Enter");
  const lista = page.getByRole("dialog", { name: "Treinos salvos", exact: true });
  await expect(lista.getByRole("heading", { name: "Treinos salvos" })).toBeFocused();
  await semRolagemHorizontal(page);
  const carregar = lista.getByRole("button", { name: "Carregar " + nome, exact: true });
  const excluir = lista.getByRole("button", { name: "Excluir " + nome, exact: true });
  await conferirAlvo(carregar);
  await conferirAlvo(excluir);
  await excluir.press("Space");
  const confirmacao = page.getByRole("dialog", { name: "Excluir treino?" });
  await expect(confirmacao.getByRole("heading", { name: "Excluir treino?" })).toBeFocused();
  await page.keyboard.press("Tab");
  const cancelar = confirmacao.getByRole("button", { name: "Cancelar" });
  await expect(cancelar).toBeFocused();
  await conferirAlvo(cancelar);
  await cancelar.press("Enter");
  await expect(excluir).toBeFocused();
  await expect(carregar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(biblioteca).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(personalizar).toBeFocused();
});
