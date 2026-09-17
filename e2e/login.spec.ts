import { expect, test } from "@playwright/test";
import {
  EMAIL_DONO,
  encherACota,
  esperarAbaTreino,
  estadoDoMock,
  irNaAba,
  login,
  resetarMock,
  semRolagemHorizontal,
  SENHA,
  usuarioComPerfil,
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

    // com as chaves no lugar, nada de recado de instalação na tela de quem treina
    await expect(page.getByText(".env.local")).toHaveCount(0);
    await expect(page.getByText(/Configure NEXT_PUBLIC/)).toHaveCount(0);
  });

  /*
   * SPEC §21: o app deixou de ser de um usuário só. Quem não tem conta e tenta
   * ENTRAR continua recusado — mas pelo motivo certo, e sem virar "app pessoal".
   */
  test("quem não tem conta não entra: credenciais inválidas", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("outra.pessoa@exemplo.com");
    await page.getByLabel("Senha").fill("senha123456");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    await expect(page.getByText(/pessoal/i)).toHaveCount(0);
    await expect(page).toHaveURL(/\/login$/);

    // ninguém foi criado por uma tentativa de entrar
    const estado = await estadoDoMock();
    expect(estado.usuarios).toEqual([]);
  });

  test("com a cota cheia o botão Criar conta some e o aviso aparece", async ({
    page,
  }) => {
    await encherACota(5);   // o limite semeado do mock é 5

    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar conta" })).toHaveCount(0);
    await expect(
      page.getByText("Cadastro fechado no momento: o limite de contas foi atingido."),
    ).toBeVisible();
    await semRolagemHorizontal(page);
  });

  test("a senha curta é recusada antes de criar a conta", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("nova.pessoa@exemplo.com");
    await page.getByLabel("Senha").fill("1234567");
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(
      page.getByText("A senha precisa ter pelo menos 8 caracteres."),
    ).toBeVisible();
    const estado = await estadoDoMock();
    expect(estado.usuarios).toEqual([]);
  });

  test("criar conta com o e-mail do dono entra e cai na Hoje", async ({ page }) => {
    await login(page);

    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();

    // o trigger handle_new_user criou o perfil e o app semeou os dados de data/perfil.json
    const estado = await estadoDoMock();
    expect((estado.usuarios as { email: string }[])[0]?.email).toBe(EMAIL_DONO);
    expect((estado.tabelas as Record<string, number>).profiles).toBe(1);
  });

  test("entrar com a senha errada mostra o erro traduzido", async ({ page }) => {
    await login(page);
    await irNaAba(page, "Mais");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("E-mail").fill(EMAIL_DONO);
    await page.getByLabel("Senha").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("sair volta ao login e a sessão não abre mais o app", async ({ page }) => {
    await login(page);

    await irNaAba(page, "Mais");
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
    await irNaAba(page, "Mais");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("E-mail").fill(EMAIL_DONO);
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await esperarAbaTreino(page);
  });

  test("depois de um 'Criar conta' recusado, 'Entrar' ainda funciona", async ({ page }) => {
    // O React 19 reseta o formulário quando uma ação termina: com campos não
    // controlados, o e-mail e a senha sumiam e o toque seguinte não fazia nada.
    await usuarioComPerfil();

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(EMAIL_DONO);
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Essa conta já existe")).toBeVisible();

    // os campos continuam preenchidos
    await expect(page.getByLabel("E-mail")).toHaveValue(EMAIL_DONO);
    await expect(page.getByLabel("Senha")).toHaveValue(SENHA);

    await page.getByRole("button", { name: "Entrar" }).click();
    await esperarAbaTreino(page);
  });
});
