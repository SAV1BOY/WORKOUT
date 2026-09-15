/**
 * Auditoria do harness: o que os outros specs não provavam.
 *
 * - o e-mail de fora é recusado **sem nenhuma requisição** ao Supabase
 *   (provado pelo log do mock, não pelo efeito colateral);
 * - a sessão sobrevive ao recarregar;
 * - toda rota protegida (inclusive a raiz) volta para o login sem sessão;
 * - o mock recusa coluna inventada em filtro, select e order — ele nunca pode
 *   fingir sucesso, senão um erro de query passa batido nos marcos 3+.
 */
import { expect, test } from "@playwright/test";
import {
  EMAIL_PERMITIDO,
  SENHA,
  URL_MOCK,
  login,
  requisicoesDoMock,
  resetarMock,
  semRolagemHorizontal,
  sessaoNoMock,
} from "./fixtures";

test.beforeEach(async () => {
  await resetarMock();
});

test.describe("porta de entrada", () => {
  test("e-mail de fora: nenhuma requisição chega ao Supabase", async ({ page }) => {
    await page.goto("/login");
    // a tela de login é pública: o middleware nem monta o cliente do Supabase
    expect(await requisicoesDoMock()).toEqual([]);

    for (const botao of ["Criar conta", "Entrar"]) {
      await page.getByLabel("E-mail").fill("outra.pessoa@exemplo.com");
      await page.getByLabel("Senha").fill("senha123456");
      await page.getByRole("button", { name: botao }).click();
      await expect(page.getByText("Este app é pessoal.")).toBeVisible();

      const auth = (await requisicoesDoMock()).filter((r) =>
        r.caminho.startsWith("/auth/v1"),
      );
      expect(auth, `"${botao}" chamou o Supabase com e-mail de fora`).toEqual([]);
    }

    await expect(page).toHaveURL(/\/login$/);
    await semRolagemHorizontal(page);
  });

  test("com o e-mail permitido o signup acontece e cai na Hoje", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);

    const caminhos = (await requisicoesDoMock()).map((r) => r.caminho);
    expect(caminhos).toContain("/auth/v1/signup");
  });

  test("recarregar mantém a sessão", async ({ page }) => {
    await login(page);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);

    await page.goto("/progresso");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Progresso" })).toBeVisible();
    await expect(page).toHaveURL(/\/progresso$/);
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
    await page.getByRole("link", { name: "Mais" }).click();
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
    await page.getByRole("link", { name: "Mais" }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await page.getByLabel("E-mail").fill(EMAIL_PERMITIDO);
    await page.getByLabel("Senha").fill(SENHA);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();

    const caminhos = (await requisicoesDoMock()).map((r) => r.caminho);
    expect(caminhos).toContain("/auth/v1/token");
    expect(caminhos).toContain("/auth/v1/logout");
  });
});
