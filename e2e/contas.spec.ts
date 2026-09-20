/**
 * Marco Contas (SPEC §21): cadastro com limite de contas.
 *
 * O que estes testes prendem (os critérios 1–4 e 6 da §21.5):
 *  - com vaga, qualquer e-mail cria conta pela tela de login, entra na hora e
 *    cai no guia da primeira entrada, com o nome vindo do e-mail;
 *  - o isolamento continua de pé: leituras cruzadas de `profiles` e `sessions`
 *    no mock não atravessam de uma conta para a outra;
 *  - com a cota cheia o botão some, o aviso aparece e um POST direto em
 *    `/auth/v1/signup` é recusado com a mensagem do trigger — sem 6ª conta e
 *    sem perfil órfão;
 *  - Mais → Contas é só do dono: ele vê "N de L" e a lista, sobe o limite e o
 *    login volta a oferecer "Criar conta"; um usuário comum não vê a linha e a
 *    rota não lhe mostra lista nenhuma;
 *  - sem sessão qualquer rota vai para `/login`, e `?erro=app-pessoal` não
 *    existe mais;
 *  - a 360 px, nos dois temas, nada rola de lado e todo alvo tem 44 px.
 */
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  EMAIL_DONO,
  atualizarNoMock,
  definirCota,
  encherACota,
  entrarNoApp,
  esperarAbaTreino,
  estadoDoMock,
  fixarData,
  irNaAba,
  lerDoMock,
  resetarMock,
  semear,
  semRolagemHorizontal,
  sessaoNoMock,
  URL_MOCK,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

/** Quarta, 16/09/2026 (SPEC §5). */
const QUARTA = "2026-09-16T08:00:00-03:00";

const CAPTURAS =
  process.env.CAPTURAS_DIR ?? "test-results/capturas/contas";
mkdirSync(CAPTURAS, { recursive: true });

const NOVA_PESSOA = "joana.ferreira@exemplo.com";
const SENHA_NOVA = "senha-da-joana";
const AVISO_FECHADO =
  "Cadastro fechado no momento: o limite de contas foi atingido.";

test.beforeEach(async () => {
  await resetarMock();
});

/** Cria a conta pela tela de login, sem esperar a aba Treino. */
async function criarContaPelaTela(
  page: Page,
  email: string,
  senha: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Criar conta" }).click();
}

/** Todo alvo clicável visível tem pelo menos 44 px de altura (SPEC §21.5.6). */
async function alvosGrandes(page: Page): Promise<void> {
  const alvos = page.locator("button:visible, a:visible, input:visible");
  const quantos = await alvos.count();
  expect(quantos).toBeGreaterThan(0);
  for (let i = 0; i < quantos; i += 1) {
    const alvo = alvos.nth(i);
    const caixa = await alvo.boundingBox();
    if (caixa === null || caixa.height === 0) continue;
    const texto = (await alvo.textContent())?.trim().slice(0, 40) ?? "";
    expect(caixa.height, `alvo pequeno: "${texto}"`).toBeGreaterThanOrEqual(44);
  }
}

/* ------------------------------------------------ critério 1: cabe alguém */

test.describe("com vaga, um e-mail novo cria conta (SPEC §21.5.1)", () => {
  test("entra na hora, cai no guia e o nome vem do e-mail", async ({ page }) => {
    // só a conta do dono existe; o limite semeado é 5
    await usuarioComPerfil();

    await fixarData(page, QUARTA);
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();
    await expect(page.getByText(AVISO_FECHADO)).toHaveCount(0);
    await page.screenshot({ path: `${CAPTURAS}/01-login-com-vaga.png` });

    await criarContaPelaTela(page, NOVA_PESSOA, SENHA_NOVA);

    // SPEC §20.1: conta nova (perfil sem `prefs.guia_visto`) cai no guia
    await page.waitForURL(/\/mais\/guia/, { timeout: 20_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: "Como usar o app" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pular por agora" }),
    ).toBeVisible();
    await semRolagemHorizontal(page);
    await page.screenshot({
      path: `${CAPTURAS}/04-primeira-entrada-conta-nova.png`,
      fullPage: true,
    });

    // o perfil nasceu com o nome vindo do e-mail e as prefs padrão
    const estado = await estadoDoMock();
    const emails = (estado.usuarios as { email: string }[]).map((u) => u.email);
    expect(emails).toEqual([EMAIL_DONO, NOVA_PESSOA]);

    await page.getByRole("button", { name: "Entendi, começar a treinar" }).click();
    await esperarAbaTreino(page);

    await irNaAba(page, "Mais");
    await page.getByRole("link", { name: "Perfil" }).click();
    await expect(page.getByLabel("Nome")).toHaveValue("joana.ferreira");
  });

  test("cada conta só vê os próprios dados (RLS, SPEC §21.4)", async ({
    page,
  }) => {
    const dono = await usuarioComPerfil();
    await semear({
      tabelas: {
        sessions: [
          {
            user_id: dono.userId,
            data: "2026-09-14",
            workout_id: "A1",
            fase: "fase1",
            status: "concluida",
          },
        ],
      },
    });

    await criarContaPelaTela(page, NOVA_PESSOA, SENHA_NOVA);
    await page.waitForURL(/\/mais\/guia/, { timeout: 20_000 });

    // a sessão da conta nova, falando com o mock como ela
    const nova = await entrarNoMockComoContaExistente(NOVA_PESSOA, SENHA_NOVA);

    // ela não vê nada do dono
    const perfisDela = await lerDoMock<{ user_id: string }>(nova, "profiles");
    expect(perfisDela.map((p) => p.user_id)).toEqual([nova.userId]);
    const sessoesDela = await lerDoMock(nova, "sessions");
    expect(sessoesDela).toEqual([]);
    // nem filtrando pelo user_id do dono na mão
    const tentativa = await lerDoMock(
      nova,
      "sessions",
      `select=*&user_id=eq.${dono.userId}`,
    );
    expect(tentativa).toEqual([]);

    // e o dono não vê nada dela
    const perfisDoDono = await lerDoMock<{ user_id: string }>(dono, "profiles");
    expect(perfisDoDono.map((p) => p.user_id)).toEqual([dono.userId]);
    const sessoesDoDono = await lerDoMock<{ user_id: string }>(dono, "sessions");
    expect(sessoesDoDono.map((s) => s.user_id)).toEqual([dono.userId]);
  });
});

/** Entra no mock com uma conta que já existe e devolve o token dela. */
async function entrarNoMockComoContaExistente(
  email: string,
  senha: string,
): Promise<SessaoMock> {
  const resposta = await fetch(`${URL_MOCK}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  const corpo = (await resposta.json()) as {
    access_token?: string;
    user?: { id?: string };
  };
  if (!resposta.ok || !corpo.access_token || !corpo.user?.id) {
    throw new Error(`mock: token falhou (${resposta.status})`);
  }
  return { token: corpo.access_token, userId: corpo.user.id };
}

/* -------------------------------------------- critério 2: a cota fechada */

test.describe("com a cota cheia ninguém mais entra (SPEC §21.5.2)", () => {
  test("o botão some, o aviso aparece e o signup direto é recusado", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await encherACota(4); // 1 (dono) + 4 = 5, o limite

    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar conta" })).toHaveCount(0);
    const aviso = page.getByText(AVISO_FECHADO);
    await expect(aviso).toBeVisible();
    await expect(aviso).toHaveAttribute("role", "status");
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `${CAPTURAS}/02-login-sem-vaga.png` });

    // a chave anon é pública: quem falar com o GoTrue direto esbarra no trigger
    const resposta = await fetch(`${URL_MOCK}/auth/v1/signup`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: "mock-anon" },
      body: JSON.stringify({ email: "sexta@exemplo.com", password: "senha123456" }),
    });
    expect(resposta.status).toBe(403);
    expect(((await resposta.json()) as { message: string }).message).toBe(
      "Cadastro fechado: o limite de contas foi atingido.",
    );

    // a 6ª conta não existe e não sobrou perfil órfão
    const estado = await estadoDoMock();
    const emails = (estado.usuarios as { email: string }[]).map((u) => u.email);
    expect(emails).toHaveLength(5);
    expect(emails).not.toContain("sexta@exemplo.com");
    expect((estado.tabelas as Record<string, number>).profiles).toBe(5);
  });
});

/* ------------------------------ critério 3: Mais → Contas, só para o dono */

test.describe("Mais → Contas (SPEC §21.5.3)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`o dono vê "5 de 5", sobe o limite e salva — tema ${tema}`, async ({
      page,
    }) => {
      await usuarioComPerfil();
      await encherACota(4);
      await page.emulateMedia({ colorScheme: tema });
      await fixarData(page, QUARTA);
      await entrarNoApp(page);

      await irNaAba(page, "Mais");
      const linha = page.getByRole("link", { name: "Contas" });
      await expect(linha).toBeVisible();
      await linha.click();

      await expect(
        page.getByRole("heading", { level: 1, name: "Contas" }),
      ).toBeVisible();
      await expect(page.getByText("5 de 5")).toBeVisible();
      await expect(page.getByText(EMAIL_DONO)).toBeVisible();
      await expect(page.getByText("pessoa1@exemplo.com")).toBeVisible();
      await expect(page.getByText(/criada em \d\d\/\d\d\/\d{4}/).first()).toBeVisible();

      await semRolagemHorizontal(page);
      await alvosGrandes(page);
      await page.screenshot({
        path: `${CAPTURAS}/03-mais-contas${tema === "light" ? "-claro" : ""}.png`,
        fullPage: true,
      });

      // sobe o limite para 6 e salva
      await page.getByRole("button", { name: "Aumentar Limite de contas" }).click();
      await expect(
        page.getByRole("textbox", { name: "Limite de contas" }),
      ).toHaveValue("6");
      await page.getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByText("Limite salvo.")).toBeVisible();
      await expect(page.getByText("5 de 6")).toBeVisible();

      await expect
        .poll(async () => (await estadoDoMock()).max_contas, { timeout: 10_000 })
        .toBe(6);
    });
  }

  test("depois de subir o limite o login volta a oferecer Criar conta", async ({
    page,
  }) => {
    await usuarioComPerfil();
    await encherACota(4);
    await fixarData(page, QUARTA);
    await entrarNoApp(page);

    await page.goto("/mais/contas");
    await expect(page.getByText("5 de 5")).toBeVisible();
    await page.getByRole("button", { name: "Aumentar Limite de contas" }).click();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Limite salvo.")).toBeVisible();

    await irNaAba(page, "Mais");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // a 6ª conta entra
    await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();
    await criarContaPelaTela(page, NOVA_PESSOA, SENHA_NOVA);
    await page.waitForURL(/\/mais\/guia/, { timeout: 20_000 });

    const estado = await estadoDoMock();
    expect((estado.usuarios as unknown[]).length).toBe(6);
  });

  test("um usuário comum não vê a linha Contas nem a lista", async ({ page }) => {
    await usuarioComPerfil();
    const nova = await sessaoNoMock(NOVA_PESSOA, SENHA_NOVA);
    await atualizarNoMock(nova, "profiles", `user_id=eq.${nova.userId}`, {
      altura_cm: 190,
      prefs: { guia_visto: true },
    });

    await fixarData(page, QUARTA);
    await entrarNoApp(page, NOVA_PESSOA, SENHA_NOVA);

    await irNaAba(page, "Mais");
    await expect(page.getByRole("heading", { name: "Mais" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Contas" })).toHaveCount(0);

    // a rota, na mão, não lhe mostra lista nenhuma
    await page.goto("/mais/contas");
    await expect(page.getByText("Só o dono vê esta tela.")).toBeVisible();
    await expect(page.getByText(EMAIL_DONO)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Salvar" })).toHaveCount(0);

    // e nem pelo PostgREST: a função do banco devolve zero linhas para ela
    const resposta = await fetch(`${URL_MOCK}/rest/v1/rpc/contas_cadastradas`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: "mock-anon",
        authorization: `Bearer ${nova.token}`,
      },
      body: "{}",
    });
    expect(await resposta.json()).toEqual([]);

    // e a cota não muda por ela (a policy app_config_dono recusa)
    await fetch(`${URL_MOCK}/rest/v1/app_config?id=eq.true`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        apikey: "mock-anon",
        authorization: `Bearer ${nova.token}`,
      },
      body: JSON.stringify({ max_contas: 99 }),
    });
    expect((await estadoDoMock()).max_contas).toBe(5);
  });
});

/* -------------------------- critério 4: o app inteiro para um usuário comum */

test.describe("um usuário comum usa o app inteiro (SPEC §21.5.4)", () => {
  test("navega pelas cinco abas e sem sessão tudo volta para o login", async ({
    page,
  }) => {
    await usuarioComPerfil();
    const nova = await sessaoNoMock(NOVA_PESSOA, SENHA_NOVA);
    await atualizarNoMock(nova, "profiles", `user_id=eq.${nova.userId}`, {
      altura_cm: 190,
      data_inicio: "2026-09-14",
      prefs: { guia_visto: true },
    });

    await fixarData(page, QUARTA);
    await entrarNoApp(page, NOVA_PESSOA, SENHA_NOVA);

    for (const [aba, titulo] of [
      ["Explorar", "Explorar"],
      ["Relatório", "Relatório"],
      ["Corpo", "Corpo"],
      ["Mais", "Mais"],
    ] as const) {
      await irNaAba(page, aba);
      await expect(
        page.getByRole("heading", { level: 1, name: titulo, exact: true }),
      ).toBeVisible({ timeout: 20_000 });
      await semRolagemHorizontal(page);
    }

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    for (const rota of ["/", "/relatorio", "/corpo", "/mais", "/mais/contas"]) {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/login$/);
      // SPEC §21.3: o aviso de "app pessoal" não existe mais
      expect(page.url()).not.toContain("app-pessoal");
      await expect(page.getByText(/app é pessoal/i)).toHaveCount(0);
    }
  });
});

/* ------------------------------------------- critério 6: 360 px, dois temas */

test.describe("celular a 360 px, nos dois temas (SPEC §21.5.6)", () => {
  for (const tema of ["dark", "light"] as const) {
    test(`o login cabe com e sem vaga — tema ${tema}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema });

      await page.goto("/login");
      await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();
      await semRolagemHorizontal(page);
      await alvosGrandes(page);

      await definirCota(1);
      await encherACota(1);
      await page.goto("/login");
      await expect(page.getByText(AVISO_FECHADO)).toBeVisible();
      await expect(page.getByRole("button", { name: "Criar conta" })).toHaveCount(0);
      await semRolagemHorizontal(page);
      await alvosGrandes(page);
    });
  }
});
