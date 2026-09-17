/**
 * Auditoria do harness: o que os outros specs não provavam.
 *
 * - a tela de login só pergunta a cota ao Supabase, e uma senha curta não
 *   chega ao GoTrue (provado pelo log do mock, não pelo efeito colateral);
 * - a sessão sobrevive ao recarregar;
 * - toda rota protegida (inclusive a raiz) volta para o login sem sessão;
 * - o mock recusa coluna inventada em filtro, select e order — ele nunca pode
 *   fingir sucesso, senão um erro de query passa batido nos marcos 3+.
 */
import { expect, test } from "@playwright/test";
import {
  EMAIL_DONO,
  encherACota,
  esperarAbaTreino,
  irNaAba,
  login,
  requisicoesDoMock,
  resetarMock,
  semRolagemHorizontal,
  SENHA,
  sessaoNoMock,
  URL_MOCK,
} from "./fixtures";

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("porta de entrada", () => {
  /*
   * SPEC §21.3: a tela de login é pública — o middleware nem monta o cliente do
   * Supabase — e a única coisa que ela pergunta ao banco é a cota, que devolve
   * dois números. Nenhuma chamada de auth antes de alguém tocar num botão.
   */
  test("a tela de login só pergunta a cota, e nada de auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

    const caminhos = (await requisicoesDoMock()).map((r) => r.caminho);
    expect([...new Set(caminhos)]).toEqual(["/rest/v1/rpc/vagas_para_conta"]);
  });

  test("a senha curta é barrada no servidor do app, sem chegar ao GoTrue", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("nova.pessoa@exemplo.com");
    await page.getByLabel("Senha").fill("1234567");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(
      page.getByText("A senha precisa ter pelo menos 8 caracteres."),
    ).toBeVisible();

    const auth = (await requisicoesDoMock()).filter((r) =>
      r.caminho.startsWith("/auth/v1"),
    );
    expect(auth, "a senha curta chamou o Supabase").toEqual([]);
    await expect(page).toHaveURL(/\/login$/);
    await semRolagemHorizontal(page);
  });

  test("com a cota cheia o cadastro não chega ao GoTrue", async ({ page }) => {
    await encherACota(5);
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Criar conta" })).toHaveCount(0);

    // e mesmo forçando a ação do servidor pelo teclado não há signup: só Entrar
    await page.getByLabel("E-mail").fill("mais.uma@exemplo.com");
    await page.getByLabel("Senha").fill("senha123456");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();

    const caminhos = (await requisicoesDoMock()).map((r) => r.caminho);
    expect(caminhos).not.toContain("/auth/v1/signup");
  });

  test("com o e-mail do dono o signup acontece e cai na Hoje", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);

    const caminhos = (await requisicoesDoMock()).map((r) => r.caminho);
    expect(caminhos).toContain("/auth/v1/signup");
  });

  test("recarregar mantém a sessão", async ({ page }) => {
    await login(page);

    await page.reload();
    await esperarAbaTreino(page);
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);

    await page.goto("/relatorio");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Relatório" })).toBeVisible();
    await expect(page).toHaveURL(/\/relatorio$/);
  });

  test("sem sessão toda rota protegida volta ao login (inclusive a raiz)", async ({
    page,
  }) => {
    for (const rota of ["/", "/treinar", "/corpo", "/mais", "/calendario"]) {
      await page.goto(rota);
      await expect(page, `${rota} abriu sem sessão`).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();
  });

  test("sair derruba a sessão e voltar não a ressuscita", async ({ page }) => {
    await login(page);
    await irNaAba(page, "Mais");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("o mock não finge sucesso", () => {
  test("coluna inventada em filtro, select e order dá 400", async ({ request }) => {
    const { token } = await sessaoNoMock();
    const headers = { apikey: "mock-anon", authorization: `Bearer ${token}` };

    const casos = [
      ["filtro", "/rest/v1/profiles?select=*&coluna_inventada=eq.1"],
      ["select", "/rest/v1/profiles?select=user_id,coluna_inventada"],
      ["order", "/rest/v1/profiles?select=user_id&order=coluna_inventada.desc"],
      ["view", "/rest/v1/v_records?select=nao_existe"],
    ] as const;

    for (const [onde, caminho] of casos) {
      const resposta = await request.get(`${URL_MOCK}${caminho}`, { headers });
      expect(resposta.status(), `${onde} deveria falhar com 400`).toBe(400);
      expect(JSON.stringify(await resposta.json())).toContain("não existe em supabase/schema.sql");
    }
  });

  test("filtro composto e operador desconhecido dão 400", async ({ request }) => {
    const { token } = await sessaoNoMock();
    const headers = { apikey: "mock-anon", authorization: `Bearer ${token}` };

    const composto = await request.get(
      `${URL_MOCK}/rest/v1/sessions?select=*&or=(status.eq.concluida,fase.eq.fase1)`,
      { headers },
    );
    expect(composto.status()).toBe(400);

    const operador = await request.get(
      `${URL_MOCK}/rest/v1/sessions?select=*&fase=xpto.fase1`,
      { headers },
    );
    expect(operador.status()).toBe(400);
    // a tabela está vazia: o operador inventado tem de falhar mesmo assim
    expect((await operador.json()).message).toContain('operador "xpto"');
  });

  test("single devolve 406 com 0 e com 2 linhas", async ({ request }) => {
    const { token } = await sessaoNoMock();
    const headers = {
      apikey: "mock-anon",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };
    const unico = { ...headers, Accept: "application/vnd.pgrst.object+json" };

    const zero = await request.get(
      `${URL_MOCK}/rest/v1/pullup_singles?select=*&data=eq.2026-01-01`,
      { headers: unico },
    );
    expect(zero.status()).toBe(406);
    expect((await zero.json()).details).toBe("Results contain 0 rows");

    await request.post(`${URL_MOCK}/rest/v1/pullup_singles`, {
      headers,
      data: [
        { data: "2026-09-14", reps: 3 },
        { data: "2026-09-15", reps: 2 },
      ],
    });
    const duas = await request.get(`${URL_MOCK}/rest/v1/pullup_singles?select=*`, {
      headers: unico,
    });
    expect(duas.status()).toBe(406);
    expect((await duas.json()).details).toBe("Results contain 2 rows");
  });

  test("entrar com a senha certa depois de criar a conta usa o token, não o signup", async ({
    page,
  }) => {
    await login(page);
    await irNaAba(page, "Mais");
    await page.getByRole("button", { name: "Sair" }).click();
    await page.getByLabel("E-mail").fill(EMAIL_DONO);
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await esperarAbaTreino(page);

    const caminhos = (await requisicoesDoMock()).map((r) => r.caminho);
    expect(caminhos).toContain("/auth/v1/token");
    expect(caminhos).toContain("/auth/v1/logout");
  });
});
