import { expect, test } from "@playwright/test";
import { MARCA_DE_VIDA } from "../lib/vigia";
import {
  EMAIL_DONO,
  encherACota,
  entrarNoApp,
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
  test("o e-mail digitado na abertura fria permanece ao preencher a senha e entrar", async ({ page }) => {
    await usuarioComPerfil();
    const email = page.getByLabel("E-mail", { exact: true });
    const senha = page.getByLabel("Senha", { exact: true });
    const scripts = /\/_next\/static\/chunks\/[^?]+\.js(?:\?.*)?$/;
    const liberar = Promise.withResolvers<void>();
    await page.route(scripts, async (rota) => {
      await liberar.promise;
      await rota.continue();
    });
    try {
      await Promise.all([page.waitForRequest(scripts), page.goto("/login", { waitUntil: "commit" })]);
      await email.pressSequentially(EMAIL_DONO);
      expect((await email.inputValue()) === EMAIL_DONO).toBe(true);
    } finally {
      liberar.resolve();
    }

    await page.waitForFunction(marca => Reflect.get(window, marca) === true, MARCA_DE_VIDA);
    await senha.pressSequentially(SENHA);
    expect((await email.inputValue()) === EMAIL_DONO, "o formulário conservou o e-mail").toBe(true);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await esperarAbaTreino(page);
  });

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
    await page.getByLabel("Senha", { exact: true }).fill("senha123456");
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
    await page.getByLabel("Senha", { exact: true }).fill("1234567");
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
    const senha = page.getByLabel("Senha", { exact: true });
    await senha.fill("senha-errada");
    await page.getByRole("button", { name: "Mostrar senha" }).click();
    await expect(senha).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Ocultar senha" }).click();
    await expect(senha).toHaveValue("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("E-mail ou senha incorretos.");
    await expect(page.getByLabel("E-mail")).toBeFocused();
    await expect(senha).toHaveAttribute("aria-describedby", "erro-login");
    await expect(senha).toHaveAttribute("aria-invalid", "true");
    expect((await page.getByLabel("E-mail").inputValue()) === EMAIL_DONO).toBe(true);
    expect((await senha.inputValue()) === "senha-errada").toBe(true);
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

  /*
   * A §22.11 exige que "Sair" seja deste aparelho. O escopo não aparece na
   * tela nem no corpo da resposta: quem sabe dizer o que o app pediu é o
   * mock, que guarda cada logout com o `?scope=` que veio na URL.
   */
  test("sair pede o escopo local ao Supabase (§22.11)", async ({ page }) => {
    await login(page);
    await irNaAba(page, "Mais");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    const estado = await estadoDoMock();
    const logouts = estado.logouts as { scope: string }[];
    expect(logouts.length, "o app não chamou /auth/v1/logout").toBeGreaterThan(0);
    expect((estado.ultimo_logout as { scope: string }).scope).toBe("local");
    // nenhum escopo além de "local" — um signOut() pelado mandaria "global"
    expect(logouts.map((l) => l.scope)).toEqual(logouts.map(() => "local"));
  });

  test("sair num aparelho mantém o outro conectado e capaz de renovar a sessão (§21.4)", async ({
    page, browser, baseURL,
  }) => {
    await usuarioComPerfil();
    await entrarNoApp(page);
    const outroContexto = await browser.newContext({ baseURL });
    try {
      const outro = await outroContexto.newPage();
      await entrarNoApp(outro);
      await irNaAba(page, "Mais");
      await page.getByRole("button", { name: "Sair" }).click();
      await expect(page).toHaveURL(/\/login$/);

      // Avança só o relógio do outro navegador, até o cliente precisar renovar.
      const renovou = outro.waitForResponse(r =>
        r.url().includes("grant_type=refresh_token") && r.ok(),
      );
      await outro.clock.setFixedTime(new Date(Date.now() + 61 * 60_000));
      await outro.reload();
      await renovou;
      await outro.clock.setFixedTime(new Date());
      await irNaAba(outro, "Corpo");
      await expect(outro.getByRole("heading", { name: "Corpo", exact: true })).toBeVisible();
      await page.goto("/corpo");
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await outroContexto.close();
    }
  });

  test("entrar de novo com a conta que já existe", async ({ page }) => {
    await login(page);
    await irNaAba(page, "Mais");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("E-mail").fill(EMAIL_DONO);
    await page.getByLabel("Senha", { exact: true }).fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await esperarAbaTreino(page);
  });

  test("depois de um 'Criar conta' recusado, 'Entrar' ainda funciona", async ({ page }) => {
    // A tentativa de cadastro termina com erro. A pessoa pode entrar com os
    // mesmos dados, mesmo se o React tentar resetar o formulário após a ação.
    await usuarioComPerfil();

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(EMAIL_DONO);
    await page.getByLabel("Senha", { exact: true }).fill(SENHA);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Essa conta já existe")).toBeVisible();

    // os campos continuam preenchidos
    await expect(page.getByLabel("E-mail")).toHaveValue(EMAIL_DONO);
    await expect(page.getByLabel("Senha", { exact: true })).toHaveValue(SENHA);

    await page.getByRole("button", { name: "Entrar" }).click();
    await esperarAbaTreino(page);
  });
});


test("entrar sem rede mantém os campos e o erro no formulário", async ({ page, context }) => {
  await usuarioComPerfil();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(EMAIL_DONO);
  await page.getByLabel("Senha", { exact: true }).fill(SENHA);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Sem rede");
  await expect(page.getByLabel("E-mail")).toBeFocused();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Entrar" }).click();
  await esperarAbaTreino(page);
});
