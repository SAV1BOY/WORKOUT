/**
 * Ajudantes dos testes de ponta a ponta: falar com o mock do Supabase
 * (scripts/mock-supabase.ts), entrar no app e conferir o básico do celular.
 */
import { expect, type Page } from "@playwright/test";

export const URL_MOCK =
  process.env.MOCK_SUPABASE_URL ??
  `http://127.0.0.1:${process.env.MOCK_SUPABASE_PORT ?? 54321}`;

/** O único e-mail que o app aceita (ALLOWED_EMAIL do playwright.config.ts). */
export const EMAIL_PERMITIDO =
  process.env.ALLOWED_EMAIL ?? "miguelgsaviotti29@gmail.com";

export const SENHA = "senha-de-teste";

/** Segunda-feira, 14/09/2026 — o primeiro dia do programa (SPEC §5). */
export const HOJE_FIXO = "2026-09-14T08:00:00-03:00";

export interface Semente {
  usuarios?: { email: string; senha?: string }[];
  /** linhas por tabela de supabase/schema.sql; sem user_id usa o único usuário */
  tabelas?: Record<string, Record<string, unknown>[]>;
}

async function chamarMock(caminho: string, corpo?: unknown): Promise<unknown> {
  const resposta = await fetch(`${URL_MOCK}${caminho}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo ?? {}),
  });
  const texto = await resposta.text();
  if (!resposta.ok) {
    throw new Error(`mock ${caminho} respondeu ${resposta.status}: ${texto}`);
  }
  return texto ? (JSON.parse(texto) as unknown) : null;
}

/** Zera usuários, tabelas e arquivos do mock. Chame no beforeEach. */
export async function resetarMock(): Promise<void> {
  await chamarMock("/__mock/reset");
}

/** Semeia usuários e linhas no mock. */
export async function semear(dados: Semente): Promise<unknown> {
  return chamarMock("/__mock/seed", dados);
}

/** O que o mock guardou (útil para conferir gravações). */
export async function estadoDoMock(): Promise<Record<string, unknown>> {
  const resposta = await fetch(`${URL_MOCK}/__mock/estado`);
  return (await resposta.json()) as Record<string, unknown>;
}

/**
 * Cria a conta permitida (ou entra, se já existir) e espera cair na Hoje.
 * O mock já devolve sessão no signup — não há confirmação de e-mail.
 */
export async function login(
  page: Page,
  email: string = EMAIL_PERMITIDO,
  senha: string = SENHA,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Criar conta" }).click();

  // conta já criada num teste anterior: entra com a mesma senha
  const jaExiste = page.getByText("Essa conta já existe");
  await expect
    .poll(async () => (await jaExiste.count()) > 0 || page.url().endsWith("/"), {
      timeout: 15_000,
    })
    .toBe(true);
  if ((await jaExiste.count()) > 0) {
    await page.getByRole("button", { name: "Entrar" }).click();
  }

  await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
}

export interface SessaoMock {
  token: string;
  userId: string;
}

/** Cria a conta direto no mock (sem UI) e devolve o access token. */
export async function sessaoNoMock(
  email: string = EMAIL_PERMITIDO,
  senha: string = SENHA,
): Promise<SessaoMock> {
  const resposta = await fetch(`${URL_MOCK}/auth/v1/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: senha }),
  });
  const corpo = (await resposta.json()) as {
    access_token?: string;
    user?: { id?: string };
  };
  if (!resposta.ok || !corpo.access_token || !corpo.user?.id) {
    throw new Error(`mock: signup falhou (${resposta.status})`);
  }
  return { token: corpo.access_token, userId: corpo.user.id };
}

/** Congela o relógio do navegador (o servidor continua com a data real). */
export async function fixarRelogio(
  page: Page,
  quando: string = HOJE_FIXO,
): Promise<void> {
  await page.clock.install({ time: new Date(quando) });
}

/** A 360 px nada pode vazar para o lado. */
export async function semRolagemHorizontal(page: Page): Promise<void> {
  const vazou = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(vazou, "a página rolou para o lado a 360 px").toBeLessThanOrEqual(0);
}

/** As requisições que chegaram ao mock desde o último reset (sem /__mock). */
export async function requisicoesDoMock(): Promise<
  { metodo: string; caminho: string }[]
> {
  const estado = await estadoDoMock();
  return (estado.requisicoes ?? []) as { metodo: string; caminho: string }[];
}
