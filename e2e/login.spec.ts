import { expect, test } from "@playwright/test";
import {
  EMAIL_PERMITIDO,
  SENHA,
  estadoDoMock,
  login,
  resetarMock,
  semRolagemHorizontal,
} from "./fixtures";

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("login", () => {
  test("a tela de login cabe em 360 px e tem alvos grandes", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Treino do Terraço" }),
    ).toBeVisible();
    await semRolagemHorizontal(page);

    for (const nome of ["Entrar", "Criar conta"]) {
      const caixa = await page.getByRole("button", { name: nome }).boundingBox();
      expect(caixa?.height ?? 0, `botão ${nome} menor que 44 px`).toBeGreaterThanOrEqual(44);
    }
    const campo = await page.getByLabel("E-mail").boundingBox();
    expect(campo?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("e-mail diferente do permitido é recusado sem chamar o Supabase", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("outra.pessoa@exemplo.com");
    await page.getByLabel("Senha").fill("senha123456");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Este app é pessoal.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    // o mock não recebeu nada: nenhum usuário foi criado
    const estado = await estadoDoMock();
    expect(estado.usuarios).toEqual([]);
  });

  test("criar conta com o e-mail permitido entra e cai na Hoje", async ({ page }) => {
    await login(page);

    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();

    // o trigger handle_new_user criou o perfil e o app semeou os dados de data/perfil.json
    const estado = await estadoDoMock();
    expect((estado.usuarios as { email: string }[])[0]?.email).toBe(EMAIL_PERMITIDO);
    expect((estado.tabelas as Record<string, number>).profiles).toBe(1);
  });

  test("entrar com a senha errada mostra o erro traduzido", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Mais" }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("E-mail").fill(EMAIL_PERMITIDO);
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("sair volta ao login e a sessão não abre mais o app", async ({ page }) => {
    await login(page);

    await page.getByRole("link", { name: "Mais" }).click();
    await expect(page.getByRole("heading", { name: "Mais" })).toBeVisible();
    await page.getByRole("button", { name: "Sair" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();

    // rota protegida sem sessão volta para o login
    await page.goto("/progresso");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("entrar de novo com a conta que já existe", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Mais" }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("E-mail").fill(EMAIL_PERMITIDO);
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
  });
});
