/**
 * Lote 35 — Lembretes II: horário, disparo automático e calendário
 * (SPEC §23.14). A 360×740, contra o mock, pelo caminho real.
 *
 * O disparo: o pg_cron não existe no mock, então o teste faz o papel do
 * `lembretes_tick()` — monta o JSON que ele mandaria (a conta, o perfil e as
 * inscrições) e chama `POST /api/lembretes/disparar` com o cabeçalho do
 * segredo que o `playwright.config.ts` gerou para esta execução. A rota envia
 * ao servidor de push falso do mock e grava pela RPC `lembretes_resultado`
 * (o mock confere o mesmo segredo, como o Vault).
 */
import { createECDH, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { decifrarNoAparelho } from "../lib/web-push";
import {
  URL_MOCK,
  entrarNoApp,
  estadoDoMock,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  semear,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

const TEMAS = ["light", "dark"] as const;
type Tema = (typeof TEMAS)[number];
const SEGREDO = process.env.E2E_LEMBRETES_SEGREDO ?? "";

test.beforeEach(async () => {
  await resetarMock();
});

async function abrir(page: Page, tema: Tema, prefs: Record<string, unknown> = {}): Promise<SessaoMock> {
  const sessao = await usuarioComPerfil({ prefs: { tema: "auto", manter_tela: false, ...prefs } });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: tema });
  await entrarNoApp(page);
  await page.goto("/mais/lembretes");
  await expect(page.getByRole("heading", { name: "Horários", level: 2 })).toBeVisible();
  return sessao;
}

/** Todo botão, link e campo visível do <main> com pelo menos 44 × 44 px. */
async function alvosDe44(page: Page): Promise<void> {
  const pequenos = await page.evaluate(() =>
    [...document.querySelectorAll("main a, main button, main input")]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ nome: el.textContent?.trim() || el.id, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44 || r.width < 44)
      .map(({ nome, r }) => `${nome} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  expect(pequenos).toEqual([]);
}

async function prefsDoMock(sessao: SessaoMock): Promise<Record<string, unknown>> {
  const [perfil] = await lerDoMock<{ prefs: Record<string, unknown> }>(sessao, "profiles");
  return perfil?.prefs ?? {};
}

/* ------------------------------------------------ §23.14 item 1: horários */

for (const tema of TEMAS) {
  test(`${tema}: liga o lembrete do treino, muda a hora e vê gravado no mock sem perder as outras prefs`, async ({ page }) => {
    const sessao = await abrir(page, tema);
    const treino = page.getByRole("switch", { name: "Lembrete do treino" });
    const corrida = page.getByRole("switch", { name: "Lembrete da corrida" });
    // sem a chave em prefs: os dois desligados às 07:00
    await expect(treino).toHaveAttribute("aria-checked", "false");
    await expect(corrida).toHaveAttribute("aria-checked", "false");
    // cada campo de hora diz de qual lembrete é (o rótulo visível "Hora" se repete)
    await expect(page.getByLabel("Hora do lembrete do treino", { exact: true })).toHaveValue("07:00");
    await expect(page.getByLabel("Hora do lembrete da corrida", { exact: true })).toHaveValue("07:00");
    await expect(page.locator("[data-proximo]")).toHaveCount(0);
    // a região viva já existe (vazia) antes do primeiro "salvo"
    await expect(page.locator('[data-recado-horarios][aria-live="polite"]')).toHaveText("");

    await treino.click();
    await expect(treino).toHaveAttribute("aria-checked", "true");
    await page.locator("#hora-treino").fill("18:30");
    await expect(page.locator("[data-recado-horarios]")).toHaveText("Horários salvos.");
    await expect
      .poll(async () => (await prefsDoMock(sessao)).lembretes, { timeout: 10_000 })
      .toEqual({ treino: { ligado: true, hora: "18:30" }, corrida: { ligado: false, hora: "07:00" } });
    const prefs = await prefsDoMock(sessao);
    expect(prefs.guia_visto).toBe(true);
    expect(prefs.manter_tela).toBe(false);
    // o próximo previsto sai da mesma regra do disparo
    await expect(page.locator("[data-proximo]")).toContainText(/^Próximo: .+ às 18:30 — /);
    // este aparelho não foi ativado: o "Próximo" não promete o aviso aqui (§23.13)
    await expect(page.locator("[data-proximo-sem-aviso]")).toHaveText(
      "Este aparelho não está recebendo avisos; o calendário abaixo tem alarme na mesma hora.",
    );

    // fora do passo de 5 min vira o múltiplo de baixo
    await page.locator("#hora-treino").fill("06:47");
    await expect
      .poll(async () => ((await prefsDoMock(sessao)).lembretes as { treino: { hora: string } }).treino.hora, {
        timeout: 10_000,
      })
      .toBe("06:45");
    await expect(page.locator("#hora-treino")).toHaveValue("06:45");

    // recarregar mostra o que está gravado
    await page.reload();
    await expect(page.getByRole("switch", { name: "Lembrete do treino" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("#hora-treino")).toHaveValue("06:45");

    await alvosDe44(page);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `test-results/l35-horarios-${tema}.png`, fullPage: true });
  });
}

/* ---------------------------------------------- §23.14 item 4: calendário */

test("Adicionar ao meu calendário baixa um .ics com os dias de treino do perfil", async ({ page }) => {
  await abrir(page, "light", {
    dias_de_treino: ["ter", "qui", "sab"],
    lembretes: { treino: { ligado: false, hora: "06:30" }, corrida: { ligado: false, hora: "07:00" } },
  });
  const [baixado] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Adicionar ao meu calendário" }).click(),
  ]);
  expect(baixado.suggestedFilename()).toBe("treino-do-terraco.ics");
  const caminho = await baixado.path();
  const bruto = readFileSync(caminho);
  const texto = new TextDecoder("utf-8", { fatal: true }).decode(bruto);
  expect(texto.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  expect(texto.endsWith("END:VCALENDAR\r\n")).toBe(true);
  for (const linha of texto.split("\r\n")) expect(Buffer.byteLength(linha)).toBeLessThanOrEqual(75);
  const linhas = texto.replace(/\r\n /g, "").split("\r\n");
  // ter, qui e sáb (Preferências → Dias de treino), na hora do lembrete do treino, mesmo desligado
  expect(linhas.filter((l) => l.startsWith("RRULE:")).map((l) => l.split("BYDAY=")[1]).sort()).toEqual([
    "SA",
    "TH",
    "TU",
  ]);
  const inicios = linhas.filter((x) => x.startsWith("DTSTART;"));
  expect(inicios).toHaveLength(3);
  for (const l of inicios) {
    expect(l).toMatch(/^DTSTART;TZID=America\/Sao_Paulo:\d{8}T063000$/);
  }
  expect(linhas).toContain("TZID:America/Sao_Paulo");
  expect(linhas.filter((l) => l === "BEGIN:VALARM")).toHaveLength(3);
});

/* ------------------------------------------ §23.14 item 5: último lembrete */

function horaDeSaoPaulo(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

function diaDeSaoPaulo(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

for (const tema of TEMAS) {
  test(`${tema}: o último lembrete semeado aparece como "hoje às HH:MM"`, async ({ page }) => {
    const sessao = await usuarioComPerfil({
      prefs: { lembretes: { treino: { ligado: true, hora: "07:00" }, corrida: { ligado: true, hora: "18:00" } } },
    });
    const enviado = new Date(Date.now() - 2 * 60_000);
    await semear({
      tabelas: {
        lembretes_enviados: [
          { user_id: sessao.userId, tipo: "treino", dia: diaDeSaoPaulo(enviado), enviado_em: enviado.toISOString() },
        ],
      },
    });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme: tema });
    await entrarNoApp(page);
    await page.goto("/mais/lembretes");
    await expect(page.locator("[data-ultimo]")).toHaveText(`Último lembrete: hoje às ${horaDeSaoPaulo(enviado)}`);
    await expect(page.locator("[data-proximo]")).toContainText(/^Próximo: /);
    await semRolagemHorizontal(page);
  });
}

test("a RLS de lembretes_enviados: o dono lê, ninguém grava pela API", async () => {
  const sessao = await usuarioComPerfil();
  const resposta = await fetch(`${URL_MOCK}/rest/v1/lembretes_enviados`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: "mock-anon",
      authorization: `Bearer ${sessao.token}`,
    },
    body: JSON.stringify({ user_id: sessao.userId, tipo: "treino", dia: "2026-09-21" }),
  });
  expect(resposta.status).toBe(403);
  expect(((await resposta.json()) as { code: string }).code).toBe("42501");
  expect(await lerDoMock(sessao, "lembretes_enviados")).toEqual([]);
});

/* ------------------------------------------------ §23.14 item 3: o disparo */

function aparelhoNovo() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey().toString("base64url"),
    privada: ecdh.getPrivateKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

test("o disparo: segredo errado 401; certo envia ao push falso, marca enviado e não reenvia no mesmo dia", async ({
  request,
}) => {
  expect(SEGREDO.length).toBeGreaterThan(20);
  const sessao = await usuarioComPerfil();
  const aparelho = aparelhoNovo();
  const endpoint = `${URL_MOCK}/__push/201/l35-${randomBytes(4).toString("hex")}`;
  // o que o tick mandaria: segunda 21/09 às 07:05 em São Paulo, o treino ligado às 07:00
  const tick = (enviados: { tipo: string; dia: string }[]) => ({
    agora: "2026-09-21T10:05:00.000000+00:00",
    usuarios: [
      {
        user_id: sessao.userId,
        perfil: {
          data_inicio: "2026-09-14",
          fase_atual: "fase1",
          fase_desde: "2026-09-14",
          ultimo_treino: null,
          semana_corrida: 1,
          semana_corda: 1,
          semana_fixa: 1,
          prefs: { lembretes: { treino: { ligado: true, hora: "07:00" }, corrida: { ligado: false, hora: "07:00" } } },
        },
        overrides: [],
        sessoes: [],
        cardios: [],
        enviados,
        inscricoes: [{ endpoint, p256dh: aparelho.p256dh, auth: aparelho.auth }],
      },
    ],
  });

  const errado = await request.post("/api/lembretes/disparar", {
    headers: { "x-lembretes-segredo": `${SEGREDO}-errado` },
    data: tick([]),
  });
  expect(errado.status()).toBe(401);
  const semCabecalho = await request.post("/api/lembretes/disparar", { data: tick([]) });
  expect(semCabecalho.status()).toBe(401);
  const pushesDe = async () =>
    ((await estadoDoMock()).pushes as { caminho: string; corpo_b64: string; authorization: string }[]).filter(
      (p) => endpoint.endsWith(p.caminho),
    );
  expect(await pushesDe()).toEqual([]);

  const certo = await request.post("/api/lembretes/disparar", {
    headers: { "x-lembretes-segredo": SEGREDO },
    data: tick([]),
  });
  expect(certo.status()).toBe(200);
  expect(await certo.json()).toMatchObject({ contas: 1, avisos: 1, entregas: 1, marcados: 1, gravado: true });
  const [push] = await pushesDe();
  expect(push?.authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
  const aviso = JSON.parse(
    decifrarNoAparelho(Buffer.from(push?.corpo_b64 ?? "", "base64"), aparelho.privada, aparelho.auth),
  ) as Record<string, string>;
  expect(aviso.titulo).toBe("Hora do treino");
  expect(aviso.corpo).toMatch(/^Treino [AB] · \d+ exercícios · \d+ min$/);

  // gravado pela RPC, visível ao dono pela RLS
  const enviados = await lerDoMock<{ tipo: string; dia: string }>(sessao, "lembretes_enviados");
  expect(enviados.map((e) => [e.tipo, e.dia])).toEqual([["treino", "2026-09-21"]]);

  // o próximo tick lê lembretes_enviados (como o SQL faz) e não reenvia
  const denovo = await request.post("/api/lembretes/disparar", {
    headers: { "x-lembretes-segredo": SEGREDO },
    data: tick(enviados.map((e) => ({ tipo: e.tipo, dia: e.dia }))),
  });
  expect(await denovo.json()).toMatchObject({ avisos: 0, entregas: 0 });
  expect(await pushesDe()).toHaveLength(1);
  expect(await lerDoMock(sessao, "lembretes_enviados")).toHaveLength(1);
});

test("a RPC lembretes_resultado chamada como anon com o segredo errado: 28000 e nada muda", async ({ request }) => {
  const sessao = await usuarioComPerfil();
  const aparelho = aparelhoNovo();
  // é a porta que a rota usa com a chave anon: sem o segredo do Vault, ninguém grava nem apaga
  const rpc = await request.post(`${URL_MOCK}/rest/v1/rpc/lembretes_resultado`, {
    headers: { apikey: "mock-anon", "content-type": "application/json" },
    data: {
      segredo: "nao-e-o-do-vault",
      enviados: [{ user_id: sessao.userId, tipo: "treino", dia: "2026-09-21" }],
      expirados: [`${URL_MOCK}/__push/410/${aparelho.auth}`],
    },
  });
  expect(rpc.status()).toBe(403);
  expect(((await rpc.json()) as { code: string }).code).toBe("28000");
  expect(await lerDoMock(sessao, "lembretes_enviados")).toEqual([]);
});
