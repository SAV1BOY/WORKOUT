/**
 * Capturas determinísticas do ultraloop (20/09/2026) — a régua visual.
 *
 * Gera a MESMA lista de telas, sempre no mesmo estado, a 360 × 740 (Pixel 5,
 * deviceScaleFactor 2, pt-BR, America/Sao_Paulo), nos dois temas. As pastas de
 * duas rodadas são comparadas por `scripts/comparar-capturas.ts`.
 *
 * Como usar (o app já de pé, servido de um build `npm run build:e2e` que assou
 * a URL do mock):
 *
 *   MOCK_SUPABASE_PORT=54341 npx tsx scripts/mock-supabase.ts &
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54341 \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon \
 *   ALLOWED_EMAIL=miguelgsaviotti29@gmail.com npx next start -p 3120 &
 *   CAPTURAS_APP=http://127.0.0.1:3120 CAPTURAS_MOCK=http://127.0.0.1:54341 \
 *   CAPTURAS_DIR=/tmp/.../base npx tsx scripts/capturas-ultraloop.ts
 *
 * Determinismo:
 *  - `page.clock.setFixedTime` (NUNCA `pauseAt`: ele trava o Dexie e o player);
 *  - `reducedMotion: "reduce"` — nada de transição a meio caminho;
 *  - máscaras em [data-ilustracao], <video>, [role=timer] e relógios;
 *  - semente própria, sem `/__mock/reset` (a base é compartilhada com outros
 *    agentes): as linhas do usuário das capturas são apagadas e reescritas.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices, type Browser, type Locator, type Page } from "@playwright/test";

const APP = process.env.CAPTURAS_APP ?? "http://127.0.0.1:3100";
const MOCK = process.env.CAPTURAS_MOCK ?? "http://127.0.0.1:54321";
const DESTINO =
  process.env.CAPTURAS_DIR ?? process.argv[2] ?? join(process.cwd(), "capturas-ultraloop");
const SENHA = "senha-de-teste";
/** Quarta, 16/09/2026 08:30 — dia de força, com a semana já andada (SPEC §5). */
const QUANDO = "2026-09-16T08:30:00-03:00";

/** Um usuário por tema: o estado de um não contamina o do outro. */
const EMAIL: Record<Tema, string> = {
  dark: "capturas@exemplo.com",
  light: "capturas-claro@exemplo.com",
};
/**
 * O id das linhas semeadas é fixo (determinismo), e no mock ele é único na
 * TABELA inteira, não por usuário — então cada tema precisa da sua marca.
 */
const MARCA: Record<Tema, string> = { dark: "cafe11aa", light: "cafe11bb" };

type Tema = "dark" | "light";

export interface Tela {
  /** nome estável, sem tema e sem extensão */
  nome: string;
  /** rota para chegar (quando é só navegar) */
  rota?: string;
  /** como chegar/preparar, quando não é só navegar */
  acao?: (page: Page) => Promise<void>;
  /** as telas do player rodam por último, numa sessão criada na hora */
  player?: boolean;
  /** as telas sem sessão rodam antes do login */
  semSessao?: boolean;
  fullPage?: boolean;
}

// =====================================================================
//  a lista FIXA de telas
// =====================================================================

/**
 * Rola até o alvo. SEM `catch`: se o alvo não existe, a tela vai para o
 * índice como `alcancada: false` e a régua avisa. Engolir a falha em silêncio
 * já deixou três capturas do Relatório idênticas entre si, fotografando o
 * topo da tela em vez da seção pedida — uma régua cega é pior do que régua
 * nenhuma.
 */
async function rolarAte(page: Page, alvo: Locator) {
  await alvo.scrollIntoViewIfNeeded({ timeout: 15_000 });
  await page.waitForTimeout(250);
}

/**
 * Encosta o alvo no TOPO da janela. `scrollIntoViewIfNeeded` não serve para
 * enquadrar: se o alvo já aparece — nem que seja na última linha da tela —
 * ele não rola nada, e foi assim que `12-relatorio-numeros` virou uma cópia
 * byte a byte de `11-relatorio-topo`. Aqui a tela fica sempre no mesmo lugar,
 * com a região pedida em cima.
 */
async function enquadrar(page: Page, alvo: Locator) {
  await alvo.waitFor({ state: "visible", timeout: 15_000 });
  await alvo.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await page.waitForTimeout(400);
}

/** As seções dobráveis de /relatorio (SPEC §22.6 item 1). */
type SecaoDoRelatorio = "resumo" | "conquistas" | "historico" | "corpo" | "graficos";

/**
 * Abre /relatorio com UMA seção aberta, sempre a partir do mesmo estado.
 *
 * O conteúdo de uma seção fechada nem é montado, então fotografar Conquistas
 * ou Histórico exige abrir a seção antes de rolar. E como o estado mora em
 * `localStorage`, o que uma captura abre vazaria para a seguinte: a chave é
 * limpa antes, e cada tela do Relatório fica independente da ordem.
 */
async function abrirRelatorioEm(page: Page, secao: SecaoDoRelatorio) {
  await page.goto(`${APP}/relatorio`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      window.localStorage.removeItem("relatorio:secoes");
    } catch {
      /* navegação privada */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Relatório" }).waitFor({ timeout: 20_000 });
  const alvo = page.locator(`details[data-secao="${secao}"]`);
  await alvo.waitFor({ timeout: 20_000 });
  if (!(await alvo.evaluate((d) => (d as HTMLDetailsElement).open))) {
    await alvo.locator("summary").click();
    await page.waitForFunction(
      (id) =>
        document.querySelector<HTMLDetailsElement>(`details[data-secao="${id}"]`)?.open ===
        true,
      secao,
      { timeout: 10_000 },
    );
  }
  await page.waitForTimeout(700);
}

export const TELAS: Tela[] = [
  // --- sem sessão
  { nome: "01-login", rota: "/login", semSessao: true },
  { nome: "02-offline", rota: "/~offline", semSessao: true },

  // --- treino
  { nome: "03-treino-topo", rota: "/" },
  {
    nome: "04-treino-lista",
    acao: async (page) => {
      await page.goto(`${APP}/`);
      await esperarTreino(page);
      await rolarAte(page, page.getByRole("list", { name: "Exercícios de hoje" }).first());
    },
  },
  { nome: "05-calendario", rota: "/calendario" },

  // --- explorar e catálogo
  { nome: "06-explorar", rota: "/explorar" },
  { nome: "07-colecao", rota: "/explorar/plano/corrida" },
  { nome: "08-catalogo", rota: "/exercicios" },
  { nome: "09-ficha-exercicio", rota: "/exercicios/supino-reto-com-barra" },
  {
    nome: "10-ficha-folha",
    acao: async (page) => {
      await page.goto(`${APP}/exercicios/supino-reto-com-barra`);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      const musculos = page.getByRole("tab", { name: "Músculos" });
      if (await musculos.isVisible().catch(() => false)) await musculos.click();
      await page.waitForTimeout(400);
    },
  },

  // --- relatório (cada tela abre a SUA seção: fechada, ela nem é montada)
  {
    nome: "11-relatorio-topo",
    acao: async (page) => {
      await abrirRelatorioEm(page, "resumo");
    },
  },
  {
    nome: "12-relatorio-numeros",
    acao: async (page) => {
      await abrirRelatorioEm(page, "resumo");
      await enquadrar(page, page.getByRole("region", { name: "Números" }).first());
    },
  },
  {
    nome: "13-relatorio-conquistas",
    acao: async (page) => {
      await abrirRelatorioEm(page, "conquistas");
      await enquadrar(page, page.getByRole("region", { name: "Conquistas" }).first());
    },
  },
  {
    nome: "14-relatorio-historico",
    acao: async (page) => {
      await abrirRelatorioEm(page, "historico");
      await enquadrar(page, page.getByRole("region", { name: "Histórico" }).first());
    },
  },

  // --- corpo
  { nome: "15-corpo-peso", rota: "/corpo" },
  {
    nome: "16-corpo-medidas",
    acao: async (page) => {
      await page.goto(`${APP}/corpo`);
      await page.getByRole("heading", { name: "Corpo", exact: true }).waitFor();
      await page.getByRole("tab", { name: "Medidas" }).click();
      await page.waitForTimeout(500);
    },
  },
  {
    nome: "17-corpo-fotos",
    acao: async (page) => {
      await page.goto(`${APP}/corpo`);
      await page.getByRole("heading", { name: "Corpo", exact: true }).waitFor();
      await page.getByRole("tab", { name: "Fotos" }).click();
      await page.waitForTimeout(500);
    },
  },

  // --- mais
  { nome: "18-mais", rota: "/mais" },
  { nome: "19-preferencias", rota: "/mais/preferencias" },
  { nome: "20-perfil", rota: "/mais/perfil" },
  { nome: "21-equipamento", rota: "/mais/equipamento" },
  { nome: "22-guia", rota: "/mais/guia" },
  { nome: "23-contas", rota: "/mais/contas" },
  { nome: "24-creditos", rota: "/mais/creditos" },

  // --- cardio e barra fixa
  { nome: "25-cardio", rota: "/cardio/corrida" },
  { nome: "26-barra-fixa", rota: "/barra-fixa" },

  // --- player (por último: criam a sessão do dia)
  { nome: "27-player-preparacao", player: true },
  { nome: "28-player-exercicio", player: true },
  { nome: "29-player-descanso", player: true },
  { nome: "30-player-conclusao", player: true },
];

// =====================================================================
//  semente (sem /__mock/reset)
// =====================================================================

interface Sessao {
  token: string;
  userId: string;
}

async function mock(
  caminho: string,
  metodo: string,
  corpo?: unknown,
  token?: string,
): Promise<string> {
  const r = await fetch(`${MOCK}${caminho}`, {
    method: metodo,
    headers: {
      "content-type": "application/json",
      apikey: "mock-anon",
      prefer: "return=representation",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`mock ${metodo} ${caminho}: ${r.status} ${texto}`);
  return texto;
}

/** Cria a conta das capturas ou entra nela (o mock devolve 422 se já existe). */
async function contaDasCapturas(email: string): Promise<Sessao> {
  const criar = await fetch(`${MOCK}/auth/v1/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: SENHA }),
  });
  if (criar.ok) {
    const c = (await criar.json()) as { access_token: string; user: { id: string } };
    return { token: c.access_token, userId: c.user.id };
  }
  const entrar = await fetch(`${MOCK}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: SENHA }),
  });
  if (!entrar.ok) {
    throw new Error(
      `mock: não deu para criar nem entrar com ${email} (${criar.status}/${entrar.status})`,
    );
  }
  const c = (await entrar.json()) as { access_token: string; user: { id: string } };
  return { token: c.access_token, userId: c.user.id };
}

const TABELAS_DO_USUARIO = [
  "session_sets",
  "sessions",
  "progression_events",
  "cardio_sessions",
  "pullup_singles",
  "body_weights",
  "body_measurements",
  "progress_photos",
  "schedule_overrides",
  "exercise_state",
];

/** Zera SÓ as linhas deste usuário — `/__mock/reset` derrubaria os outros. */
async function limpar(s: Sessao) {
  for (const tabela of TABELAS_DO_USUARIO) {
    await mock(`/rest/v1/${tabela}?user_id=eq.${s.userId}`, "DELETE", undefined, s.token).catch(
      () => {},
    );
  }
}

/** Datas de treino, de 01/06 a 15/09/2026: o bastante para as conquistas. */
function datasDeForca(): string[] {
  const datas: string[] = [];
  const fim = Date.parse("2026-09-15T12:00:00Z");
  for (let t = Date.parse("2026-06-01T12:00:00Z"); t <= fim; t += 86_400_000) {
    const d = new Date(t);
    const semana = d.getUTCDay();
    if (semana === 1 || semana === 3 || semana === 5) datas.push(d.toISOString().slice(0, 10));
  }
  return datas;
}

async function semear(s: Sessao, marca: string) {
  await limpar(s);
  await mock(
    `/rest/v1/profiles?user_id=eq.${s.userId}`,
    "PATCH",
    {
      nome: "Miguel",
      altura_cm: 190,
      data_inicio: "2026-06-01",
      fase_atual: "fase1",
      fase_desde: "2026-06-01",
      ultimo_treino: "A1",
      semana_corrida: 2,
      semana_corda: 1,
      semana_fixa: 1,
      prefs: { guia_visto: true },
    },
    s.token,
  );

  const datas = datasDeForca();
  await mock(
    "/rest/v1/sessions",
    "POST",
    datas.map((data, i) => ({
      id: `${marca}-0000-4000-8000-${String(i).padStart(12, "0")}`,
      data,
      workout_id: i % 2 === 0 ? "A1" : "B1",
      fase: "fase1",
      status: "concluida",
      concluida_em: `${data}T10:00:00.000Z`,
      duracao_s: 2600,
    })),
    s.token,
  );

  const cardio = ["2026-09-01", "2026-09-04", "2026-09-08", "2026-09-12", "2026-09-15"];
  await mock(
    "/rest/v1/cardio_sessions",
    "POST",
    cardio.map((data, i) => ({
      id: `${marca}-2222-4000-8000-${String(i).padStart(12, "0")}`,
      data,
      tipo: "corrida",
      semana_plano: 2,
      concluida: true,
      duracao_min: 34,
      distancia_km: 3.6,
      esforco: "moderado",
    })),
    s.token,
  );

  await mock(
    "/rest/v1/body_weights",
    "POST",
    [
      { data: "2026-08-12", peso_kg: 84.2 },
      { data: "2026-08-26", peso_kg: 83.1 },
      { data: "2026-09-12", peso_kg: 82.4 },
    ],
    s.token,
  );
  await mock(
    "/rest/v1/body_measurements",
    "POST",
    [{ data: "2026-09-12", cintura_cm: 91.5, peito_cm: 103, braco_cm: 35.5 }],
    s.token,
  ).catch(() => {});

  await mock(
    "/rest/v1/exercise_state",
    "POST",
    [
      { exercise_id: "levantamento-terra", carga_atual_kg: 15.5 },
      { exercise_id: "desenvolvimento-militar-em-pe", carga_atual_kg: 11.5 },
      { exercise_id: "agachamento-livre", carga_atual_kg: 13.5 },
    ],
    s.token,
  );
  await mock(
    "/rest/v1/progression_events",
    "POST",
    [
      {
        exercise_id: "levantamento-terra",
        data: "2026-09-11",
        motivo: "subiu",
        de: { carga_kg: 11.5 },
        para: { carga_kg: 15.5 },
      },
      {
        exercise_id: "agachamento-livre",
        data: "2026-09-04",
        motivo: "subiu",
        de: { carga_kg: 11.5 },
        para: { carga_kg: 13.5 },
      },
    ],
    s.token,
  );
}

// =====================================================================
//  navegador
// =====================================================================

async function esperarTreino(page: Page) {
  await page
    .getByRole("region", { name: "Treino", exact: true })
    .waitFor({ timeout: 20_000 });
  await page.waitForTimeout(900);
}

async function entrar(page: Page, email: string) {
  await page.goto(`${APP}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await esperarTreino(page);
}

/** Tudo o que anima ou conta o tempo sai da comparação. */
function mascaras(page: Page): Locator[] {
  return [
    page.locator("[data-ilustracao]"),
    page.locator("video"),
    page.locator("[role=timer]"),
    page.locator("[data-relogio]"),
  ];
}

interface Registro {
  tela: string;
  arquivo: string;
  tema: Tema;
  rota: string;
  largura: number;
  altura: number;
  scrollWidth: number;
  scrollHeight: number;
  alcancada: boolean;
  erro?: string;
}

async function tirar(page: Page, tela: Tela, tema: Tema): Promise<Registro> {
  const arquivo = `${tela.nome}-${tema === "dark" ? "escuro" : "claro"}.png`;
  await page.waitForTimeout(450);
  await page.screenshot({
    path: join(DESTINO, arquivo),
    fullPage: tela.fullPage ?? false,
    mask: mascaras(page),
    animations: "disabled",
    caret: "hide",
  });
  const medidas = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  console.log(`  ✓ ${arquivo}`);
  return {
    tela: tela.nome,
    arquivo,
    tema,
    rota: new URL(page.url()).pathname,
    largura: 360,
    altura: 740,
    ...medidas,
    alcancada: true,
  };
}

function falhou(tela: Tela, tema: Tema, erro: unknown): Registro {
  const arquivo = `${tela.nome}-${tema === "dark" ? "escuro" : "claro"}.png`;
  console.log(`  ✗ ${arquivo}: ${String(erro).slice(0, 160)}`);
  return {
    tela: tela.nome,
    arquivo,
    tema,
    rota: tela.rota ?? "",
    largura: 360,
    altura: 740,
    scrollWidth: 0,
    scrollHeight: 0,
    alcancada: false,
    erro: String(erro).slice(0, 300),
  };
}

/** Anda pelo player até `alvo` aparecer, pulando descansos. */
async function andar(page: Page, alvo: Locator, voltas = 60) {
  for (let i = 0; i < voltas; i++) {
    if (await alvo.isVisible().catch(() => false)) return;
    for (const nome of ["Pular", "Concluir a série", "Continuar", "Próximo passo"]) {
      const botao = page.getByRole("button", { name: nome });
      if (await botao.isVisible().catch(() => false)) {
        await botao.click().catch(() => {});
        break;
      }
    }
    await page.waitForTimeout(120);
  }
}

async function telasDoPlayer(page: Page, tema: Tema, indice: Registro[]) {
  const porNome = (n: string) => TELAS.find((t) => t.nome === n)!;

  try {
    await page.goto(`${APP}/`);
    await esperarTreino(page);
    await page.getByRole("button", { name: "Começar treino" }).click();
    await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const comecar = page.getByRole("button", { name: "Começar agora" });
    const concluir = page.getByRole("button", { name: "Concluir a série" });
    await comecar.or(concluir).first().waitFor({ timeout: 20_000 });
    if (await comecar.isVisible().catch(() => false)) {
      indice.push(await tirar(page, porNome("27-player-preparacao"), tema));
      await comecar.click();
    } else {
      indice.push(falhou(porNome("27-player-preparacao"), tema, "sem tela de preparação"));
    }
    await concluir.waitFor({ timeout: 20_000 });
    indice.push(await tirar(page, porNome("28-player-exercicio"), tema));
  } catch (e) {
    indice.push(falhou(porNome("28-player-exercicio"), tema, e));
    return;
  }

  try {
    await page.getByRole("button", { name: "Concluir a série" }).click();
    await page.getByRole("timer", { name: "Descanso" }).waitFor({ timeout: 15_000 });
    indice.push(await tirar(page, porNome("29-player-descanso"), tema));
  } catch (e) {
    indice.push(falhou(porNome("29-player-descanso"), tema, e));
  }

  try {
    await andar(page, page.getByText("O que você achou do treino de hoje?"), 80);
    const medida = page.getByRole("radio", { name: "Na medida certa" });
    if (await medida.isVisible().catch(() => false)) await medida.click();
    const concluido = page.getByRole("button", { name: "Concluído" });
    if (await concluido.isVisible().catch(() => false)) await concluido.click();
    await page
      .getByRole("region", { name: "Treino concluído" })
      .waitFor({ timeout: 20_000 });
    await page.waitForTimeout(800);
    /* `role="status"`, não `region` (SPEC §22.6 item 6) — com o papel errado
       o "Ok" nunca era clicado e a conclusão saía com o aviso por cima. */
    const aviso = page.getByRole("status", { name: "Conquista nova" });
    if (await aviso.isVisible().catch(() => false)) {
      await aviso.getByRole("button", { name: "Ok" }).click().catch(() => {});
      await page.waitForTimeout(400);
    }
    indice.push(await tirar(page, porNome("30-player-conclusao"), tema));
  } catch (e) {
    indice.push(falhou(porNome("30-player-conclusao"), tema, e));
  }
}

async function contextoDeCelular(navegador: Browser, tema: Tema) {
  return navegador.newContext({
    ...devices["Pixel 5"],
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: tema,
    reducedMotion: "reduce",
  });
}

async function main() {
  mkdirSync(DESTINO, { recursive: true });
  const indice: Registro[] = [];
  const navegador = await chromium.launch();

  for (const tema of ["dark", "light"] as const) {
    console.log(`— tema ${tema}`);
    const sessao = await contaDasCapturas(EMAIL[tema]);
    await semear(sessao, MARCA[tema]);

    const contexto = await contextoDeCelular(navegador, tema);
    const page = await contexto.newPage();
    await page.clock.setFixedTime(new Date(QUANDO));

    for (const tela of TELAS.filter((t) => t.semSessao)) {
      try {
        await page.goto(`${APP}${tela.rota}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(900);
        indice.push(await tirar(page, tela, tema));
      } catch (e) {
        indice.push(falhou(tela, tema, e));
      }
    }

    await entrar(page, EMAIL[tema]);

    for (const tela of TELAS.filter((t) => !t.semSessao && !t.player)) {
      try {
        if (tela.acao) {
          await tela.acao(page);
        } else {
          await page.goto(`${APP}${tela.rota}`, { waitUntil: "domcontentloaded" });
          await page.locator("main").first().waitFor({ timeout: 20_000 });
          await page.waitForTimeout(900);
        }
        indice.push(await tirar(page, tela, tema));
      } catch (e) {
        indice.push(falhou(tela, tema, e));
      }
    }

    await telasDoPlayer(page, tema, indice);
    await contexto.close();
  }

  await navegador.close();
  indice.sort((a, b) => a.arquivo.localeCompare(b.arquivo, "pt-BR"));
  writeFileSync(join(DESTINO, "indice.json"), `${JSON.stringify(indice, null, 2)}\n`);
  const faltam = indice.filter((r) => !r.alcancada);
  console.log(
    `capturas em ${DESTINO}: ${indice.length - faltam.length} de ${indice.length}` +
      (faltam.length ? ` (faltaram ${faltam.map((f) => f.arquivo).join(", ")})` : ""),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
