import { expect, type Page } from "@playwright/test";

export const dialogo = (p: Page, name: string) => p.getByRole("dialog", { name, exact: true });
export const editor = (p: Page) => dialogo(p, "Crie o seu próprio");
export const ajustar = (p: Page) => editor(p).getByRole("button", { name: "Séries e descanso", exact: true });
export const ajustes = (p: Page) => dialogo(p, "Séries e descanso");
export const campo = (p: Page, nome: string) => ajustes(p).getByRole("combobox", { name: `Séries de trabalho de ${nome}`, exact: true });
export const descanso = (p: Page, nome: string) => ajustes(p).getByRole("textbox", { name: `Descanso de ${nome} em segundos`, exact: true });
export const personalizar = (p: Page) => p.getByRole("button", { name: /Personalizar treino/ });

export async function escolher(page: Page, nome: string) {
  await editor(page).getByRole("searchbox").fill(nome);
  const resultado = editor(page).getByRole("list", { name: "Catálogo" }).getByRole("button")
    .filter({ has: page.getByText(nome, { exact: true }) });
  await resultado.press("Space");
  await expect(resultado).toHaveAttribute("aria-pressed", "true");
}

export async function pronto(page: Page) {
  await ajustes(page).getByRole("button", { name: "Pronto", exact: true }).press("Enter");
  await expect(ajustar(page)).toBeFocused();
}

export async function iniciar(page: Page) {
  await editor(page).getByRole("button", { name: "Começar com 2 exercícios", exact: true }).click();
  await expect(page).toHaveURL(/\/treinar\/[a-f\d-]{36}$/);
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

export async function carregar(page: Page, nome: string) {
  await personalizar(page).press("Enter");
  await editor(page).getByRole("button", { name: "Treinos salvos", exact: true }).click();
  await dialogo(page, "Treinos salvos").getByRole("button", { name: `Carregar ${nome}`, exact: true }).click();
  await expect(ajustar(page)).toBeVisible();
}
