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
  URL_MOCK,
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

  /*
   * E o que o escopo faz: o dono tem o celular e o navegador abertos com a
   * mesma conta. Sair num deles derrubava o outro (403 na primeira leitura).
   * Aqui as duas sessões nascem no mock, uma sai com `scope=local`, e a outra
   * continua de pé — o refresh dela ainda troca por um par novo.
   */
  test("sair num aparelho não derruba o outro (§21.4)", async () => {
    await usuarioComPerfil();
    const entrar = async () => {
      const r = await fetch(`${URL_MOCK}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: "mock-anon" },
        body: JSON.stringify({ email: EMAIL_DONO, password: SENHA }),
      });
      expect(r.status, "o mock recusou a senha do dono").toBe(200);
      return (await r.json()) as { access_token: string; refresh_token: string };
    };
    const celular = await entrar();
    const navegador = await entrar();

    const saida = await fetch(`${URL_MOCK}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: "mock-anon", authorization: `Bearer ${celular.access_token}` },
    });
    expect(saida.status).toBe(204);
    expect((await estadoDoMock()).ultimo_logout).toMatchObject({ scope: "local" });

    const renovar = async (refresh_token: string) =>
      (
        await fetch(`${URL_MOCK}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { "content-type": "application/json", apikey: "mock-anon" },
          body: JSON.stringify({ refresh_token }),
        })
      ).status;

    // o aparelho que ficou continua dentro
    expect(await renovar(navegador.refresh_token), "o outro aparelho caiu junto").toBe(200);
    // e o que saiu, saiu mesmo
    expect(await renovar(celular.refresh_token)).toBe(400);
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
