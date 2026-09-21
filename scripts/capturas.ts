/**
 * Capturas de tela do app a 360 × 740 (celular), contra o mock do Supabase.
 * Não faz parte dos portões: é a ferramenta que gera as imagens de revisão de
 * cada marco visual (SPEC §13).
 *
 * Como usar (três terminais, ou o mesmo com `&`):
 *
 *   npm run build
 *   npx tsx scripts/mock-supabase.ts &
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon \
 *   ALLOWED_EMAIL=miguelgsaviotti29@gmail.com npx next start -p 3100 &
 *   npx tsx scripts/capturas.ts <pasta-de-destino>
 *
 * O mock é semeado com o que a revisão precisa ver: perfil, duas semanas de
 * treinos concluídos, cardio e uma pesagem.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices, type Page } from "@playwright/test";

const APP = process.env.CAPTURAS_APP ?? "http://127.0.0.1:3100";
const MOCK = process.env.CAPTURAS_MOCK ?? "http://127.0.0.1:54321";
const EMAIL = process.env.ALLOWED_EMAIL ?? "miguelgsaviotti29@gmail.com";
const SENHA = "senha-de-teste";
/** Quarta, 16/09/2026: dia de força (Treino B), com a semana já andada. */
const QUANDO = "2026-09-16T08:30:00-03:00";

const destino = process.argv[2] ?? join(process.cwd(), "capturas");
mkdirSync(destino, { recursive: true });

async function json(caminho: string, corpo: unknown, token?: string) {
  const r = await fetch(`${MOCK}${caminho}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: "mock-anon",
      prefer: "return=representation",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`mock ${caminho}: ${r.status} ${await r.text()}`);
  return r.text();
}

async function patch(tabela: string, filtro: string, campos: unknown, token: string) {
  const r = await fetch(`${MOCK}/rest/v1/${tabela}?${filtro}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      apikey: "mock-anon",
      authorization: `Bearer ${token}`,
      prefer: "return=representation",
    },
    body: JSON.stringify(campos),
  });
  if (!r.ok) throw new Error(`mock patch ${tabela}: ${r.status} ${await r.text()}`);
}

/** O usuário e o token da última semeadura (o mock não devolve as linhas). */
let usuarioId = "";
let tokenAtual = "";

async function semear() {
  await fetch(`${MOCK}/__mock/reset`, { method: "POST" });
  const resposta = await fetch(`${MOCK}/auth/v1/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  });
  const corpo = (await resposta.json()) as {
    access_token: string;
    user: { id: string };
  };
  const token = corpo.access_token;
  usuarioId = corpo.user.id;
  tokenAtual = token;

  await patch("profiles", `user_id=eq.${corpo.user.id}`, {
    nome: "Miguel",
    altura_cm: 190,
    data_inicio: "2026-09-07",
    fase_atual: "fase1",
    fase_desde: "2026-09-07",
    ultimo_treino: "A1",
    semana_corrida: 2,
    semana_corda: 1,
    semana_fixa: 1,
  }, token);

  // semana passada inteira (3 de força + 2 de cardio = a meta da Fase 1)
  const sessao = (data: string, workout: string) => ({
    data,
    workout_id: workout,
    fase: "fase1",
    status: "concluida",
    concluida_em: `${data}T10:00:00.000Z`,
    duracao_s: 2600,
  });
  await json(
    "/rest/v1/sessions",
    [
      sessao("2026-09-07", "A1"),
      sessao("2026-09-09", "B1"),
      sessao("2026-09-11", "A1"),
      sessao("2026-09-14", "A1"),
    ],
    token,
  );
  const cardio = (data: string) => ({
    data,
    tipo: "corrida",
    semana_plano: 1,
    concluida: true,
    duracao_min: 34,
    distancia_km: 3.6,
    esforco: "moderado",
  });
  await json(
    "/rest/v1/cardio_sessions",
    [cardio("2026-09-08"), cardio("2026-09-12"), cardio("2026-09-15")],
    token,
  );
  await json(
    "/rest/v1/body_weights",
    [{ data: "2026-09-12", peso_kg: 82.4 }],
    token,
  );
  await json(
    "/rest/v1/exercise_state",
    [
      { exercise_id: "levantamento-terra", carga_atual_kg: 15.5 },
      { exercise_id: "desenvolvimento-militar-em-pe", carga_atual_kg: 11.5 },
    ],
    token,
  );
  await json(
    "/rest/v1/progression_events",
    [
      {
        exercise_id: "levantamento-terra",
        data: "2026-09-11",
        motivo: "subiu",
        de: { carga_kg: 11.5 },
        para: { carga_kg: 15.5 },
      },
    ],
    token,
  );
}

/** Põe o perfil na Fase 2 (o Inferior A tem a prancha, um passo por tempo). */
async function mudarParaFase2() {
  await patch(
    "profiles",
    `user_id=eq.${usuarioId}`,
    { fase_atual: "fase2", fase_desde: "2026-06-01" },
    tokenAtual,
  );
}

async function entrar(page: Page) {
  await page.clock.setFixedTime(new Date(QUANDO));
  await page.goto(`${APP}/login`);
  await page.getByLabel("E-mail").fill(EMAIL);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByRole("region", { name: "Treino", exact: true }).waitFor();
  await page.waitForTimeout(1_500);
}

async function tirar(page: Page, nome: string, fullPage = false) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(destino, nome), fullPage });
  console.log(`  ✓ ${nome}`);
}

/** Um contexto de celular a 360 × 740 no tema pedido. */
async function celular(
  navegador: Awaited<ReturnType<typeof chromium.launch>>,
  tema: "dark" | "light",
) {
  return navegador.newContext({
    ...devices["Pixel 5"],
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: tema,
  });
}

/** Anda pelo player até `alvo` aparecer (pulando descansos). */
async function andar(page: Page, alvo: ReturnType<Page["getByText"]>) {
  for (let i = 0; i < 40; i++) {
    if (await alvo.isVisible().catch(() => false)) return;
    for (const nome of ["Pular", "Continuar", "Próximo passo"]) {
      const botao = page.getByRole("button", { name: nome });
      if (await botao.isVisible().catch(() => false)) {
        await botao.click();
        break;
      }
    }
    await page.waitForTimeout(150);
  }
}

/**
 * As telas do player (SPEC §14.1) e a ficha em folha (§14.2), marco V2.
 * Roda com `npx tsx scripts/capturas.ts <pasta> v2`.
 */
async function capturasDoPlayer(navegador: Awaited<ReturnType<typeof chromium.launch>>) {
  for (const tema of ["dark", "light"] as const) {
    // cada tema parte do mesmo estado: a rodada anterior concluiu um treino
    await semear();
    const contexto = await celular(navegador, tema);
    const page = await contexto.newPage();
    await entrar(page);
    const escuro = tema === "dark";
    const sufixo = escuro ? "" : "-claro";

    await page.goto(`${APP}/treinar`);
    await page.getByRole("button", { name: /^Começar Treino/ }).first().click();
    await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/);
    await page.getByRole("timer", { name: "Preparação" }).waitFor();
    if (escuro) await tirar(page, "01-preparacao.png");

    await page.getByRole("button", { name: "Começar agora" }).click();
    await page.getByRole("button", { name: "Concluir a série" }).waitFor();
    await tirar(page, `02-exercicio-carga${sufixo}.png`);

    if (escuro) {
      // a ficha em folha, com as três abas
      await page.getByRole("button", { name: /^Como fazer:/ }).click();
      await page.getByRole("tab", { name: "Vídeo" }).waitFor();
      await tirar(page, "08-ficha-video.png");
      await page.getByRole("tab", { name: "Músculos" }).click();
      await tirar(page, "09-ficha-musculos.png");
      await page.getByRole("tab", { name: "Tutorial" }).click();
      await page.waitForTimeout(800);
      await tirar(page, "10-ficha-tutorial.png");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);

      // a visão geral (a folha de rolagem, atrás do ícone de lista)
      await page.getByRole("button", { name: "Visão geral do treino" }).click();
      await page.getByRole("heading", { level: 1 }).waitFor();
      await tirar(page, "11-visao-geral.png");
      await page.getByRole("button", { name: "Voltar ao treino" }).click();
      await page.waitForTimeout(400);

      // ✓ → descanso em tela cheia
      await page.getByRole("button", { name: "Concluir a série" }).click();
      await page.getByRole("timer", { name: "Descanso" }).waitFor();
      await tirar(page, "03-descanso.png");

      // o resto do 1º exercício, registrando de verdade: a pergunta "firme?"
      const firme = page.getByText("Última repetição saiu firme?");
      for (let i = 0; i < 8; i++) {
        if (await firme.isVisible().catch(() => false)) break;
        const pular = page.getByRole("button", { name: "Pular" });
        if (await pular.isVisible().catch(() => false)) {
          await pular.click();
          continue;
        }
        await page.getByRole("button", { name: "Concluir a série" }).click();
        await page.waitForTimeout(150);
      }
      await firme.waitFor();
      await tirar(page, "04-firme.png");
      await page.getByRole("radio", { name: "Firme" }).click();
    }

    // feedback e conclusão
    await andar(page, page.getByText("O que você achou do treino de hoje?"));
    if (escuro) await tirar(page, "06-feedback.png");
    await page.getByRole("radio", { name: "Na medida certa" }).click();
    await page.getByRole("button", { name: "Concluir", exact: true }).click();
    await page.getByRole("region", { name: "Treino concluído" }).waitFor();
    await page.waitForTimeout(600);
    await tirar(page, `07-conclusao${sufixo}.png`);
    if (escuro) await tirar(page, "07-conclusao-completa.png", true);

    await contexto.close();
  }

  /* o passo por tempo: a prancha do Inferior A (Fase 2) */
  await semear();
  await mudarParaFase2();
  const contexto = await celular(navegador, "dark");
  const page = await contexto.newPage();
  await entrar(page);
  await page.goto(`${APP}/treinar`);
  await page.getByRole("button", { name: "Começar Inferior A" }).click();
  await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Começar agora" }).click();
  await andar(page, page.getByText("· exercício 6 de 6"));
  await page.waitForTimeout(400);
  await tirar(page, "05-exercicio-tempo.png");
  await contexto.close();
}

async function main() {
  await semear();
  const navegador = await chromium.launch();

  if (process.argv[3] === "v2") {
    await capturasDoPlayer(navegador);
    await navegador.close();
    console.log(`capturas em ${destino}`);
    return;
  }

  /*
   * O claro vem primeiro: a sessão só é criada no passo escuro, e assim as
   * duas capturas da aba Treino mostram o mesmo estado.
   */
  for (const tema of ["light", "dark"] as const) {
    const contexto = await navegador.newContext({
      ...devices["Pixel 5"],
      viewport: { width: 360, height: 740 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      colorScheme: tema,
    });
    const page = await contexto.newPage();
    await entrar(page);

    if (tema === "dark") {
      await tirar(page, "01-treino-escuro.png");
      await tirar(page, "01-treino-escuro-completo.png", true);

      // a lista do treino do dia, já rolada
      await page.getByRole("list", { name: "Exercícios de hoje" }).scrollIntoViewIfNeeded();
      await tirar(page, "03-treino-lista.png");

      // a lista de treinos disponíveis, antes de abrir a sessão
      await page.goto(`${APP}/treinar`);
      await page.getByRole("heading", { name: "Treinar" }).waitFor();
      await tirar(page, "05-treinar.png");

      // a sessão de força restilizada
      await page.getByRole("button", { name: /^Começar Treino/ }).first().click();
      await page.waitForURL(/\/treinar\/[0-9a-f-]{36}$/);
      await page.waitForTimeout(1_200);
      await tirar(page, "04-sessao.png");

      await page.goto(`${APP}/mais/preferencias`);
      await page.getByRole("heading", { name: "Preferências" }).waitFor();
      await tirar(page, "06-mais-preferencias.png");
    } else {
      await tirar(page, "02-treino-claro.png");
    }

    await contexto.close();
  }

  await navegador.close();
  console.log(`capturas em ${destino}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
