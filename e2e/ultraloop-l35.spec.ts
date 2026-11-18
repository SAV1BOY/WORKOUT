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
import { ICS_VELHO, ICS_VELHO_DEPOIS_DE_SALVAR, PROXIMO_SEM_AVISO } from "../lib/lembretes";
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
import { subirSemVapid, type ServidorSemVapid } from "./servidor-sem-vapid";

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

/**
 * O recado dos Horários visível de verdade (§23.15, aceite 9): dentro da
 * tela, acima da barra de navegação fixa, e é ele que está no ponto do meio
 * (não a barra por cima). `toHaveText` sozinho passa com o texto coberto.
 */
async function recadoAVista(page: Page, tipo: "treino" | "corrida", texto: string): Promise<void> {
  const recado = page.locator(`[data-recado-horarios="${tipo}"]`);
  await expect(recado).toHaveText(texto);
  await expect
    .poll(
      () =>
        recado.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const barra = document.querySelector('nav[aria-label="Navegação principal"]')?.getBoundingClientRect();
          const topoDaBarra = barra ? barra.top : window.innerHeight;
          const noMeio = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return r.height > 0 && r.top >= 0 && r.bottom <= topoDaBarra && !!noMeio && el.contains(noMeio);
        }),
      { timeout: 5_000 },
    )
    .toBe(true);
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
    // as regiões vivas (uma por lembrete) já existem vazias antes do primeiro "salvo"
    await expect(page.locator('[data-recado-horarios="treino"][aria-live="polite"]')).toHaveText("");
    await expect(page.locator('[data-recado-horarios="corrida"][aria-live="polite"]')).toHaveText("");

    await treino.click();
    await expect(treino).toHaveAttribute("aria-checked", "true");
    await page.locator("#hora-treino").fill("18:30");
    await recadoAVista(page, "treino", "Horários salvos.");
    await expect(page.locator('[data-recado-horarios="corrida"]')).toHaveText("");
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
      "Este aparelho não está recebendo avisos. O alarme fica com o calendário abaixo — baixe de novo sempre que mudar a hora ou os dias.",
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
  const tudo = texto.replace(/\r\n /g, "").split("\r\n");
  // os eventos ativos (STATUS:CONFIRMED); os outros 11 UIDs vêm cancelados (§23.15)
  const blocos = texto.replace(/\r\n /g, "").split("BEGIN:VEVENT").slice(1);
  const ativos = blocos.filter((b) => b.includes("STATUS:CONFIRMED"));
  const cancelados = blocos.filter((b) => b.includes("STATUS:CANCELLED"));
  expect(ativos).toHaveLength(3);
  expect(cancelados).toHaveLength(11);
  const linhas = ativos.join("").split("\r\n");
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
  expect(tudo).toContain("TZID:America/Sao_Paulo");
  expect(tudo.filter((l) => l === "BEGIN:VALARM")).toHaveLength(3);
  // os cancelados: sem alarme, mesmo SEQUENCE dos ativos
  for (const b of cancelados) expect(b).not.toContain("BEGIN:VALARM");
  const seqs = new Set(blocos.map((b) => /SEQUENCE:(\d+)/.exec(b)?.[1]));
  expect(seqs.size).toBe(1);
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

/* ------------------------- §23.15: relógio vivo, volta, hora apagada (PR #30) */

const PREFS_DO_RELOGIO = {
  dias_de_treino: ["seg", "qua", "sex"],
  lembretes: { treino: { ligado: true, hora: "07:00" }, corrida: { ligado: true, hora: "07:00" } },
};

async function abrirComRelogio(page: Page, tema: Tema, inicio: Date): Promise<SessaoMock> {
  const sessao = await usuarioComPerfil({ prefs: { tema: "auto", manter_tela: false, ...PREFS_DO_RELOGIO } });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: tema });
  await entrarNoApp(page);
  // o relógio do Playwright: a tela abre às `inicio` e o teste empurra o tempo
  await page.clock.install({ time: inicio });
  await page.goto("/mais/lembretes");
  await expect(page.getByRole("heading", { name: "Horários", level: 2 })).toBeVisible();
  return sessao;
}

for (const tema of TEMAS) {
  test(`${tema}: a tela aberta passa da hora do lembrete e o "Próximo" pula para o próximo dia`, async ({ page }) => {
    // segunda 21/09, 06:50 em São Paulo (09:50Z): o de hoje ainda vem
    await abrirComRelogio(page, tema, new Date("2026-09-21T09:50:00Z"));
    const proximo = page.locator("[data-proximo]");
    await expect(proximo).toHaveText(/^Próximo: hoje às 07:00 — /);
    // 07:31, a tela nunca recarregou: o de hoje passou (+30 min), o próximo é quarta
    await page.clock.fastForward("41:00");
    await expect(proximo).toHaveText(/^Próximo: 23\/09 às 07:00 — /);
    await semRolagemHorizontal(page);
  });

  test(`${tema}: a tela aberta passa da meia-noite e "amanhã" vira "hoje"`, async ({ page }) => {
    // terça 22/09, 23:58 em São Paulo (02:58Z de quarta)
    await abrirComRelogio(page, tema, new Date("2026-09-23T02:58:00Z"));
    const proximo = page.locator("[data-proximo]");
    await expect(proximo).toHaveText(/^Próximo: amanhã às 07:00 — /);
    await page.clock.fastForward("03:00");
    await expect(proximo).toHaveText(/^Próximo: hoje às 07:00 — /);
    await semRolagemHorizontal(page);
  });

  // os eventos da volta (§23.4): cada um relê os envios
  for (const evento of ["focus", "pageshow", "visibilitychange"] as const) {
    test(`${tema}: um lembrete que saiu com a tela aberta aparece no "Último" na volta (${evento})`, async ({ page }) => {
      const sessao = await abrir(page, tema, {
        lembretes: { treino: { ligado: true, hora: "07:00" }, corrida: { ligado: true, hora: "07:00" } },
      });
      await expect(page.locator("[data-proximo]")).toBeVisible();
      await expect(page.locator("[data-ultimo]")).toHaveCount(0);
      // o tick marcou um envio enquanto a tela estava aberta
      const enviado = new Date(Date.now() - 60_000);
      await semear({
        tabelas: {
          lembretes_enviados: [
            { user_id: sessao.userId, tipo: "treino", dia: diaDeSaoPaulo(enviado), enviado_em: enviado.toISOString() },
          ],
        },
      });
      // a página volta a ficar visível (o headless já está "visible": o evento basta)
      await page.evaluate((nome) => {
        (nome === "visibilitychange" ? document : window).dispatchEvent(new Event(nome));
      }, evento);
      await expect(page.locator("[data-ultimo]")).toHaveText(`Último lembrete: hoje às ${horaDeSaoPaulo(enviado)}`);
    });
  }

  test(`${tema}: com a tela aberta e visível, sem volta nenhuma, os envios são relidos no 5º minuto`, async ({ page }) => {
    // a primeira leitura dos envios (na montagem) termina antes de o teste semear
    const primeiraLeitura = page.waitForResponse(
      (r) => r.url().includes("/rest/v1/lembretes_enviados") && r.request().method() === "GET",
    );
    // segunda 21/09, 07:02 em São Paulo (10:02Z)
    const sessao = await abrirComRelogio(page, tema, new Date("2026-09-21T10:02:00Z"));
    await primeiraLeitura;
    // e nenhuma outra leitura em voo quando o teste semeia
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-proximo]")).toBeVisible();
    await expect(page.locator("[data-ultimo]")).toHaveCount(0);
    // o tick marcou o das 07:03 com a tela aberta; nenhum evento de volta acontece
    await semear({
      tabelas: {
        lembretes_enviados: [
          { user_id: sessao.userId, tipo: "treino", dia: "2026-09-21", enviado_em: "2026-09-21T10:03:00Z" },
        ],
      },
    });
    // 4 minutos: o relógio da tela anda, mas os envios ainda não foram relidos
    await page.clock.runFor("04:00");
    await page.waitForTimeout(1_000);
    await expect(page.locator("[data-ultimo]")).toHaveCount(0);
    // o 5º minuto relê
    await page.clock.runFor("01:00");
    await expect(page.locator("[data-ultimo]")).toHaveText("Último lembrete: hoje às 07:03");
  });

  test(`${tema}: apagar a hora e sair do campo volta à gravada, avisa e não grava`, async ({ page }) => {
    const sessao = await abrir(page, tema, {
      lembretes: { treino: { ligado: true, hora: "06:45" }, corrida: { ligado: false, hora: "07:00" } },
    });
    const campo = page.locator("#hora-treino");
    await expect(campo).toHaveValue("06:45");
    await campo.fill("");
    await campo.blur();
    await expect(campo).toHaveValue("06:45");
    await recadoAVista(page, "treino", "Hora inválida: mantida a de antes (06:45).");
    // nada foi gravado: o mock segue com 06:45 (e segue depois do tempo de a fila mandar)
    const lembretes = (await prefsDoMock(sessao)).lembretes as { treino: { hora: string } };
    expect(lembretes.treino.hora).toBe("06:45");
    await page.waitForTimeout(1_500);
    expect(((await prefsDoMock(sessao)).lembretes as { treino: { hora: string } }).treino.hora).toBe("06:45");
    await alvosDe44(page);
    await semRolagemHorizontal(page);
  });
}

/* ----------------- §23.15 aceite 9: o recado dos Horários acima da barra */

/**
 * Os dois layouts de Mais → Lembretes. **Sem VAPID** (a produção de hoje): os
 * Horários vêm logo no alto e os dois campos cabem na primeira tela — o recado
 * da corrida nasce atrás da barra (top 689, barra em 682) se a tela não rolar.
 * **Com VAPID**: "Este aparelho" e "Aparelhos desta conta" vêm antes e o campo
 * da corrida abre fora da tela; a pessoa rola até ele aparecer logo acima da
 * barra — de novo o recado nasceria atrás dela.
 */
const LAYOUTS = ["sem VAPID", "com VAPID"] as const;
type Layout = (typeof LAYOUTS)[number];

test.describe("o recado dos Horários fica inteiro acima da barra, nos dois layouts (§23.15)", () => {
  let semVapid: ServidorSemVapid | null = null;

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    semVapid = await subirSemVapid();
  });

  test.afterAll(() => {
    semVapid?.parar();
  });

  /** Entra, abre /mais/lembretes no layout pedido e põe a página onde a pessoa mexe na corrida. */
  async function abrirNaCorrida(
    page: Page,
    layout: Layout,
    tema: Tema,
    prefs: Record<string, unknown>,
  ): Promise<SessaoMock> {
    const sessao = await usuarioComPerfil({ prefs: { tema: "auto", manter_tela: false, ...prefs } });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme: tema });
    await entrarNoApp(page);
    if (layout === "sem VAPID") {
      if (!semVapid) throw new Error("o servidor sem VAPID não subiu");
      await page.goto(`${semVapid.url}/mais/lembretes`);
      await expect(page.locator('[data-estado="sem-configuracao"]')).toHaveText(
        "Lembretes ainda não configurados neste servidor.",
      );
    } else {
      await page.goto("/mais/lembretes");
      await expect(page.getByRole("heading", { name: "Aparelhos desta conta", level: 2 })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Horários", level: 2 })).toBeVisible();
    await expect(page.locator("#hora-corrida")).toHaveValue("07:00");
    if (layout === "sem VAPID") {
      // o gesto natural: o campo da corrida cabe na primeira tela, a pessoa muda sem rolar
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    } else {
      // a pessoa rola até o campo da corrida aparecer inteiro, logo acima da barra
      await page.evaluate(() => {
        const campo = document.querySelector("#hora-corrida")?.getBoundingClientRect();
        const barra = document.querySelector('nav[aria-label="Navegação principal"]')?.getBoundingClientRect();
        if (campo && barra) window.scrollBy(0, campo.bottom - barra.top + 2);
      });
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    }
    // Sem VAPID a pessoa usa o campo na posição natural da primeira tela.
    // Com VAPID a rolagem acima cria o caso de borda junto à navegação fixa.
    const onde = await page.locator("#hora-corrida").evaluate((el) => {
      const r = el.getBoundingClientRect();
      const barra = document.querySelector('nav[aria-label="Navegação principal"]')?.getBoundingClientRect();
      return { topo: r.top, fundo: r.bottom, barra: barra?.top ?? 0 };
    });
    expect(onde.topo).toBeGreaterThanOrEqual(0);
    expect(onde.fundo).toBeLessThanOrEqual(onde.barra);
    if (layout === "com VAPID") expect(onde.barra - onde.fundo).toBeLessThan(28);
    return sessao;
  }

  /** O topo do campo na PÁGINA (não na tela): muda só se o layout acima dele mudar. */
  function topoNaPagina(page: Page, seletor: string): Promise<number> {
    return page.locator(seletor).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  }

  for (const layout of LAYOUTS) {
    for (const tema of TEMAS) {
      test(`${layout} · ${tema}: mudar e apagar a hora da corrida — o recado inteiro acima da barra, e o campo não salta`, async ({
        page,
      }) => {
        const sessao = await abrirNaCorrida(page, layout, tema, {
          lembretes: { treino: { ligado: true, hora: "06:45" }, corrida: { ligado: true, hora: "07:00" } },
        });
        const campo = page.locator("#hora-corrida");
        await campo.fill("18:30");
        await recadoAVista(page, "corrida", "Horários salvos.");
        await expect
          .poll(async () => ((await prefsDoMock(sessao)).lembretes as { corrida: { hora: string } }).corrida.hora, {
            timeout: 10_000,
          })
          .toBe("18:30");
        await campo.fill("");
        await campo.blur();
        await expect(campo).toHaveValue("18:30");
        await recadoAVista(page, "corrida", "Hora inválida: mantida a de antes (18:30).");
        await expect(page.locator('[data-recado-horarios="treino"]')).toHaveText("");

        // o recado do treino na tela; a corrida muda de novo: o campo dela (com o dedo) não se move na página
        await page.locator("#hora-treino").fill("06:30");
        await recadoAVista(page, "treino", "Horários salvos.");
        const antes = await topoNaPagina(page, "#hora-corrida");
        await campo.fill("19:00");
        await recadoAVista(page, "corrida", "Horários salvos.");
        expect(await topoNaPagina(page, "#hora-corrida")).toBeCloseTo(antes, 0);
        // cada lembrete guarda o seu recado
        await expect(page.locator('[data-recado-horarios="treino"]')).toHaveText("Horários salvos.");
        await expect
          .poll(async () => (await prefsDoMock(sessao)).lembretes, { timeout: 10_000 })
          .toEqual({ treino: { ligado: true, hora: "06:30" }, corrida: { ligado: true, hora: "19:00" } });
        await alvosDe44(page);
        await semRolagemHorizontal(page);
      });

      test(`${layout} · ${tema}: sem como pôr na fila, a hora volta e o "Não consegui salvar agora…" fica inteiro acima da barra`, async ({
        page,
      }) => {
        const sessao = await abrirNaCorrida(page, layout, tema, {
          lembretes: { treino: { ligado: false, hora: "06:45" }, corrida: { ligado: true, hora: "07:00" } },
        });
        const campo = page.locator("#hora-corrida");
        // o IndexedDB recusa gravar (cota cheia): a fila não aceita o envio
        await page.evaluate(() => {
          const cheio = () => {
            throw new DOMException("cota cheia", "QuotaExceededError");
          };
          IDBObjectStore.prototype.put = cheio;
          IDBObjectStore.prototype.add = cheio;
        });
        await campo.fill("09:00");
        await recadoAVista(page, "corrida", "Não consegui salvar agora. Tente de novo.");
        await expect(campo).toHaveValue("07:00");
        expect(((await prefsDoMock(sessao)).lembretes as { corrida: { hora: string } }).corrida.hora).toBe("07:00");
        // o interruptor também volta
        const treino = page.getByRole("switch", { name: "Lembrete do treino" });
        await treino.click();
        await recadoAVista(page, "treino", "Não consegui salvar agora. Tente de novo.");
        await expect(treino).toHaveAttribute("aria-checked", "false");
        await semRolagemHorizontal(page);
      });
    }
  }

  /* §23.16: o .ics baixado não fica velho em silêncio — no layout sem VAPID (a produção de hoje) */
  for (const tema of TEMAS) {
    test(`sem VAPID · ${tema}: baixou o .ics e mudou a hora — o recado e o bloco do calendário pedem para baixar de novo (§23.16)`, async ({
      page,
    }) => {
      const sessao = await usuarioComPerfil({
        prefs: {
          tema: "auto",
          manter_tela: false,
          lembretes: { treino: { ligado: true, hora: "07:00" }, corrida: { ligado: false, hora: "07:00" } },
        },
      });
      await page.setViewportSize({ width: 360, height: 740 });
      await page.emulateMedia({ colorScheme: tema });
      await entrarNoApp(page);
      if (!semVapid) throw new Error("o servidor sem VAPID não subiu");
      await page.goto(`${semVapid.url}/mais/lembretes`);
      await expect(page.locator('[data-estado="sem-configuracao"]')).toHaveText(
        "Lembretes ainda não configurados neste servidor.",
      );
      await expect(page.locator("#hora-treino")).toHaveValue("07:00");
      // sem push aqui: a frase não promete "na mesma hora" para um arquivo que pode estar velho
      const semAviso = page.locator("[data-proximo-sem-aviso]");
      await expect(semAviso).toHaveText(PROXIMO_SEM_AVISO);
      await expect(semAviso).not.toContainText("na mesma hora");
      await expect(page.getByText("Mudou a hora ou os dias? Baixe de novo")).toBeVisible();
      const velho = page.locator("[data-ics-velho]");
      await expect(velho).toHaveCount(0);

      const botao = page.getByRole("button", { name: "Adicionar ao meu calendário" });
      /** Baixa o .ics e devolve os blocos ativos de força (desdobrados). */
      async function baixarForca(): Promise<string[]> {
        const [baixado] = await Promise.all([page.waitForEvent("download"), botao.click()]);
        const texto = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(await baixado.path()));
        return texto
          .replace(/\r\n /g, "")
          .split("BEGIN:VEVENT")
          .slice(1)
          .filter((b) => b.includes("STATUS:CONFIRMED") && b.includes("SUMMARY:Treino de força"));
      }
      const primeiro = await baixarForca();
      expect(primeiro.length).toBeGreaterThan(0);
      for (const b of primeiro) expect(b).toMatch(/DTSTART;TZID=America\/Sao_Paulo:\d{8}T070000/);
      await expect(velho).toHaveCount(0);

      // muda a hora do treino: o arquivo baixado continua tocando às 07:00
      await page.locator("#hora-treino").fill("06:30");
      await recadoAVista(page, "treino", ICS_VELHO_DEPOIS_DE_SALVAR);
      await expect
        .poll(async () => ((await prefsDoMock(sessao)).lembretes as { treino: { hora: string } }).treino.hora, {
          timeout: 10_000,
        })
        .toBe("06:30");
      await expect(velho).toHaveText(ICS_VELHO);
      await velho.scrollIntoViewIfNeeded();
      await expect(velho).toBeInViewport();
      await alvosDe44(page);
      await semRolagemHorizontal(page);

      // baixa de novo: o aviso some e o arquivo novo toca às 06:30
      const segundo = await baixarForca();
      expect(segundo.length).toBe(primeiro.length);
      for (const b of segundo) expect(b).toMatch(/DTSTART;TZID=America\/Sao_Paulo:\d{8}T063000/);
      await expect(velho).toHaveCount(0);
      await expect(page.locator('[data-recado-horarios="treino"]')).toHaveText("Horários salvos.");

      // recarregar lembra o que foi baixado NESTE aparelho: nada de aviso; mudar de novo, o aviso volta
      await page.reload();
      await expect(page.locator("#hora-treino")).toHaveValue("06:30");
      await expect(velho).toHaveCount(0);
      await page.locator("#hora-treino").fill("06:00");
      await recadoAVista(page, "treino", ICS_VELHO_DEPOIS_DE_SALVAR);
      await expect(velho).toHaveText(ICS_VELHO);
    });
  }
});

/* ---------------------------- §23.16: a hora esperando os 600 ms não se perde */

test("a hora esperando os 600 ms é gravada já ao sair do campo e ao esconder a página (§23.16)", async ({ page }) => {
  const sessao = await abrir(page, "light", {
    lembretes: { treino: { ligado: true, hora: "07:00" }, corrida: { ligado: true, hora: "07:00" } },
  });
  // espera "Este aparelho" e a lista saírem do "Conferindo…": depois disso nada acima dos Horários
  // cresce e empurra o recado para baixo da barra (a cadeia de 505079b pegou isso)
  await expect(page.getByRole("heading", { name: "Aparelhos desta conta", level: 2 })).toBeVisible();
  await expect(page.getByText("Nenhum aparelho com lembretes ainda.")).toBeVisible();
  // os 600 ms nunca terminam: só sair do campo ou esconder a página podem gravar (o id devolvido
  // é verdadeiro, como o de um relógio de verdade: a tela sabe que há uma hora esperando)
  await page.evaluate(() => {
    const original = window.setTimeout.bind(window);
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...resto: unknown[]) =>
      ms === 600 ? -1 : original(fn, ms, ...resto)) as typeof window.setTimeout;
  });
  const hora = async (tipo: "treino" | "corrida") =>
    ((await prefsDoMock(sessao)).lembretes as Record<"treino" | "corrida", { hora: string }>)[tipo].hora;

  const treino = page.locator("#hora-treino");
  await treino.fill("05:30");
  await treino.blur();
  await recadoAVista(page, "treino", "Horários salvos.");
  await expect.poll(() => hora("treino"), { timeout: 10_000 }).toBe("05:30");

  await page.locator("#hora-corrida").fill("19:15");
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await expect.poll(() => hora("corrida"), { timeout: 10_000 }).toBe("19:15");
  await expect(page.locator("#hora-corrida")).toHaveValue("19:15");
});

test("corrida ligada num plano sem dia de corrida: a tela diz por que ela não entra", async ({ page }) => {
  await abrir(page, "light", {
    dias_de_treino: ["ter", "qui", "sab"],
    lembretes: { treino: { ligado: true, hora: "06:30" }, corrida: { ligado: true, hora: "18:00" } },
  });
  await expect(page.locator('[data-sem-dia="corrida"]')).toHaveText(
    "Seu plano desta fase não tem dia de corrida: este lembrete só toca quando tiver.",
  );
  await expect(page.locator('[data-sem-dia="treino"]')).toHaveCount(0);
  await semRolagemHorizontal(page);
});
