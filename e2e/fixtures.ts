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
 * A aba Treino (`/`) aberta. A camada visual v2 (SPEC §13.3) trocou o título
 * "Hoje" pela saudação com a data, então quem espera a tela espera a região.
 */
export async function esperarAbaTreino(page: Page): Promise<void> {
  // `exact`: o banner do treino aberto também é uma região ("Treino aberto")
  await expect(
    page.getByRole("region", { name: "Treino", exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Clica numa das cinco abas (SPEC §13.2) pela navegação inferior. Sempre pelo
 * `nav`: a lista do dia tem links cujo texto contém "peso do corpo", e um
 * `getByRole("link", { name: "Corpo" })` solto casaria com eles.
 */
export async function irNaAba(page: Page, rotulo: string): Promise<void> {
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: rotulo, exact: true })
    .click();
}

/**
 * Cria a conta permitida (ou entra, se já existir) e espera cair na aba Treino.
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

  await esperarAbaTreino(page);
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

/**
 * Fixa só a DATA, deixando os relógios do navegador correndo
 * (`page.clock.install` congela `setTimeout`/`setInterval` também, e a sessão
 * de força depende deles: debounce do IndexedDB, timer de descanso, fila).
 */
export async function fixarData(
  page: Page,
  quando: string = HOJE_FIXO,
): Promise<void> {
  await page.clock.setFixedTime(new Date(quando));
}

/**
 * Espera o service worker assumir o controle da página — é o que "o app
 * instalado" quer dizer (SPEC §8). Registrar não basta: enquanto o precache
 * não termina, `navigator.serviceWorker.controller` é `null` e uma navegação
 * offline morre em ERR_INTERNET_DISCONNECTED sem nem chegar ao SW.
 */
export async function esperarServiceWorker(page: Page, timeout = 60_000): Promise<void> {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
    timeout,
    polling: 200,
  });
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

/** Cabeçalhos de uma chamada PostgREST autenticada no mock. */
function cabecalhos(sessao: SessaoMock): Record<string, string> {
  return {
    "content-type": "application/json",
    apikey: "mock-anon",
    authorization: `Bearer ${sessao.token}`,
    prefer: "return=representation",
  };
}

/** Insere linhas direto no mock, como o usuário da sessão (RLS aplicada). */
export async function inserirNoMock(
  sessao: SessaoMock,
  tabela: string,
  linhas: Record<string, unknown>[],
): Promise<void> {
  const resposta = await fetch(`${URL_MOCK}/rest/v1/${tabela}`, {
    method: "POST",
    headers: cabecalhos(sessao),
    body: JSON.stringify(linhas),
  });
  if (!resposta.ok) {
    throw new Error(`mock: insert em ${tabela} falhou (${resposta.status}): ${await resposta.text()}`);
  }
}

/** Atualiza linhas no mock (ex.: `user_id=eq.<id>`). */
export async function atualizarNoMock(
  sessao: SessaoMock,
  tabela: string,
  filtro: string,
  campos: Record<string, unknown>,
): Promise<void> {
  const resposta = await fetch(`${URL_MOCK}/rest/v1/${tabela}?${filtro}`, {
    method: "PATCH",
    headers: cabecalhos(sessao),
    body: JSON.stringify(campos),
  });
  if (!resposta.ok) {
    throw new Error(`mock: update em ${tabela} falhou (${resposta.status}): ${await resposta.text()}`);
  }
}

/** Lê linhas do mock para conferir o que o app gravou. */
export async function lerDoMock<T = Record<string, unknown>>(
  sessao: SessaoMock,
  tabela: string,
  consulta = "select=*",
): Promise<T[]> {
  const resposta = await fetch(`${URL_MOCK}/rest/v1/${tabela}?${consulta}`, {
    headers: cabecalhos(sessao),
  });
  if (!resposta.ok) {
    throw new Error(`mock: select em ${tabela} falhou (${resposta.status})`);
  }
  return (await resposta.json()) as T[];
}

/**
 * Prepara o usuário do app já com o perfil semeado (como `garantirPerfil`
 * deixaria) e com os ajustes pedidos — `ultimo_treino`, semanas do plano etc.
 */
export async function usuarioComPerfil(
  ajustes: Record<string, unknown> = {},
): Promise<SessaoMock> {
  const sessao = await sessaoNoMock();
  await atualizarNoMock(sessao, "profiles", `user_id=eq.${sessao.userId}`, {
    nome: "Miguel",
    altura_cm: 190,
    data_inicio: "2026-09-14",
    fase_atual: "fase1",
    fase_desde: "2026-09-14",
    ...ajustes,
  });
  return sessao;
}

/** Entra com uma conta que já existe no mock (sem passar por "Criar conta"). */
export async function entrarNoApp(
  page: Page,
  email: string = EMAIL_PERMITIDO,
  senha: string = SENHA,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await esperarAbaTreino(page);
}

/**
 * O gesto da §14.5.1: o botão largo do card do dia **cria a sessão e entra no
 * player**, sem a tela `/treinar` no meio. `/treinar` continua existindo para
 * escolher o outro treino da fase (§5.3).
 */
export async function comecarOTreinoDoDia(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Começar treino" }).click();
  await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/);
}

/**
 * O player (SPEC §14.1) abre na tela de preparação: este ajudante passa dela
 * para o primeiro exercício quando ela está na frente. Com o relógio fixo
 * (`fixarData`) a contagem não anda sozinha, então o toque é obrigatório.
 */
export async function comecarNoPlayer(page: Page): Promise<void> {
  const comecar = page.getByRole("button", { name: "Começar agora" });
  const concluir = page.getByRole("button", { name: "Concluir a série" });
  // espera o player desenhar: a preparação ou já o primeiro exercício
  await comecar.or(concluir).first().waitFor();
  if (await comecar.isVisible().catch(() => false)) await comecar.click();
  await concluir.waitFor();
}

/**
 * A visão geral da sessão — a folha de rolagem com todas as séries, que o
 * player abre pelo ícone de lista (SPEC §14.1). É por ela que se corrige
 * qualquer série e se encerra o treino.
 */
export async function abrirVisaoGeral(page: Page): Promise<void> {
  const lista = page.getByRole("button", { name: "Visão geral do treino" });
  const comecar = page.getByRole("button", { name: "Começar agora" });
  // espera o player desenhar (preparação ou exercício) antes de decidir
  await lista.or(comecar).first().waitFor();
  if (await comecar.isVisible().catch(() => false)) {
    await comecar.click();
    // só o passo do exercício tem o ícone de lista: espera ele desenhar
    await page.getByRole("button", { name: "Concluir a série" }).waitFor();
  }
  await lista.click();
  await page.getByRole("heading", { level: 1 }).waitFor();
}
