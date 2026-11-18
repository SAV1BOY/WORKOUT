import { expect, test } from "@playwright/test";
import { comecarNoPlayer, comecarOTreinoDoDia, entrarNoApp, fixarData, lerDoMock, resetarMock, usuarioComPerfil } from "./fixtures";

test("a nota da ficha reaparece na primeira série e a edição sem rede sincroniza ao voltar", async ({ page, context }) => {
  // Login, quatro navegações e uma reconexão no fluxo completo da mesma sessão.
  test.setTimeout(90_000);
  await resetarMock();
  const conta = await usuarioComPerfil();
  const id = "agachamento-livre";
  const lerNota = async () => (await lerDoMock(conta, "exercise_state", `select=nota_pessoal&exercise_id=eq.${id}`))[0]?.nota_pessoal;
  await fixarData(page);
  await entrarNoApp(page);
  await page.goto(`/exercicios/${id}`);
  await page.getByRole("button", { name: "Lembrar no próximo treino" }).click();
  await page.getByRole("textbox", { name: "Lembrar no próximo treino" }).fill("Barra no terceiro furo");
  await page.getByRole("button", { name: "Salvar nota" }).click();
  await expect.poll(lerNota).toBe("Barra no terceiro furo");

  await page.goto("/");
  await comecarOTreinoDoDia(page);
  await comecarNoPlayer(page);
  await page.getByRole("button", { name: /Nota pessoal.*Barra no terceiro furo/ }).click();
  const ficha = page.getByRole("dialog");
  await context.setOffline(true);
  await ficha.getByRole("button", { name: "Editar nota pessoal" }).click();
  await ficha.getByRole("textbox", { name: "Lembrar no próximo treino" }).fill("Quarto furo");
  await ficha.getByRole("button", { name: "Salvar nota" }).click();
  await expect(ficha.getByText("Quarto furo", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Nota pessoal.*Quarto furo/ })).toBeVisible();
  expect(await lerNota()).toBe("Barra no terceiro furo");
  await context.setOffline(false);
  await expect.poll(lerNota).toBe("Quarto furo");

  await page.getByRole("button", { name: /Nota pessoal.*Quarto furo/ }).click();
  await ficha.getByRole("button", { name: "Editar nota pessoal" }).click();
  await ficha.getByRole("button", { name: "Remover nota" }).click();
  await expect.poll(lerNota).toBeNull();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Nota pessoal.*Quarto furo/ })).toHaveCount(0);
});
