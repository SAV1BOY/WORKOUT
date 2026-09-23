/**
 * Lote 34 — Lembretes I: inscrição no aparelho e notificação de teste
 * (SPEC §23.7). Tudo a 360×740, contra o mock, pelo caminho real.
 *
 * O aparelho de mentira: o Chromium dos testes não fala com o FCM, então o
 * `PushManager` da página é trocado (init script) por um que devolve uma
 * inscrição cujo `endpoint` é o servidor de push falso do mock
 * (`/__push/<status>/<id>`) e cujas chaves (`p256dh`, `auth`) são de um par
 * que o TESTE gerou — por isso o teste consegue decifrar o que a rota mandou.
 * O service worker é o de verdade (build de produção).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createECDH, createPublicKey, randomBytes, verify } from "node:crypto";
import { createServer, type AddressInfo } from "node:net";
import { resolve } from "node:path";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker,
} from "@playwright/test";
import sharp from "sharp";
import { decifrarNoAparelho } from "../lib/web-push";
import {
  URL_MOCK,
  entrarNoApp,
  esperarServiceWorker,
  estadoDoMock,
  inserirNoMock,
  lerDoMock,
  resetarMock,
  semRolagemHorizontal,
  sessaoNoMock,
  usuarioComPerfil,
  type SessaoMock,
} from "./fixtures";

const TEMAS = ["light", "dark"] as const;
type Tema = (typeof TEMAS)[number];
const TABELA = "lembretes_inscricoes";
const PUBLICA = process.env.E2E_VAPID_PUBLICA ?? "";

/*
 * O Chromium "de verdade" em modo headless novo, e não o headless shell
 * padrão: no shell a permissão de notificação fica `denied` mesmo concedida
 * pelo contexto, e `showNotification` recusa (medido em 23/09 com um worker
 * mínimo: shell → denied/0 notificações; chromium → granted/1). O binário é o
 * mesmo `chromium-1194` que já está em PLAYWRIGHT_BROWSERS_PATH.
 */
test.use({ channel: "chromium" });

test.beforeEach(async () => {
  await resetarMock();
});

/** O recado da tela (o `role="alert"` do Next, o anunciador de rota, fica fora do <main>). */
function aviso(page: Page) {
  return page.locator('main [role="alert"]');
}
function recado(page: Page) {
  return page.locator('main [role="status"]');
}

interface Aparelho {
  p256dh: string;
  auth: string;
  privada: string;
}

/** As chaves do "navegador": geradas aqui, no teste. */
function aparelhoNovo(): Aparelho {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey().toString("base64url"),
    privada: ecdh.getPrivateKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

interface Simulacao {
  /** endpoint base; cada `subscribe` ganha `-<n>` */
  base?: string;
  aparelho?: Aparelho;
  brave?: boolean;
  /** `subscribe` falha como no Brave sem os serviços do Google */
  subscribeFalha?: boolean;
  /** a permissão começa assim e `requestPermission` devolve `negar ? "denied"` */
  negar?: boolean;
  semPush?: boolean;
  /** `navigator.permissions.query` recusa: sobra só a volta pela visibilidade */
  semPermissionsApi?: boolean;
}

/** Troca o PushManager, o `navigator.brave` e a permissão, antes do app. */
async function simular(context: BrowserContext, sim: Simulacao): Promise<void> {
  await context.addInitScript((cfg) => {
    const w = window as unknown as Record<string, unknown>;
    if (cfg.brave) {
      Object.defineProperty(Navigator.prototype, "brave", {
        value: { isBrave: async () => true },
        configurable: true,
      });
    }
    if (cfg.semPermissionsApi) {
      Permissions.prototype.query = () => Promise.reject(new TypeError("desligada neste teste"));
    }
    if (cfg.semPush) {
      delete w.PushManager;
      return;
    }
    if (cfg.negar) {
      let permissao = "default";
      Object.defineProperty(Notification, "permission", { get: () => permissao, configurable: true });
      Notification.requestPermission = async () => {
        permissao = "denied";
        return "denied";
      };
    }
    const CHAVE = "__push_falso";
    const ler = (): { endpoint: string; chave: string } | null => {
      try {
        return JSON.parse(localStorage.getItem(CHAVE) ?? "null");
      } catch {
        return null;
      }
    };
    const comoInscricao = (d: { endpoint: string } | null) =>
      d && {
        endpoint: d.endpoint,
        expirationTime: null,
        options: { userVisibleOnly: true },
        getKey: () => null,
        toJSON: () => ({
          endpoint: d.endpoint,
          expirationTime: null,
          keys: { p256dh: cfg.p256dh, auth: cfg.auth },
        }),
        unsubscribe: async () => {
          localStorage.setItem(CHAVE, "null");
          return true;
        },
      };
    PushManager.prototype.getSubscription = async function () {
      return comoInscricao(ler()) as unknown as PushSubscription | null;
    };
    PushManager.prototype.subscribe = async function (opcoes?: PushSubscriptionOptionsInit) {
      if (cfg.subscribeFalha) {
        throw new DOMException("Registration failed - push service error", "AbortError");
      }
      const bytes = new Uint8Array(opcoes?.applicationServerKey as ArrayBuffer);
      const chave = btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const n = Number(localStorage.getItem("__push_seq") ?? "0") + 1;
      localStorage.setItem("__push_seq", String(n));
      const d = { endpoint: `${cfg.base}-${n}`, chave, visivel: opcoes?.userVisibleOnly === true };
      localStorage.setItem(CHAVE, JSON.stringify(d));
      return comoInscricao(d) as unknown as PushSubscription;
    };
  }, {
    base: sim.base ?? `${URL_MOCK}/__push/201/aparelho`,
    p256dh: sim.aparelho?.p256dh ?? "",
    auth: sim.aparelho?.auth ?? "",
    brave: sim.brave ?? false,
    subscribeFalha: sim.subscribeFalha ?? false,
    negar: sim.negar ?? false,
    semPush: sim.semPush ?? false,
    semPermissionsApi: sim.semPermissionsApi ?? false,
  });
}

async function preparar(
  page: Page,
  tema: Tema,
  sim: Simulacao,
  conceder = true,
): Promise<SessaoMock> {
  const sessao = await usuarioComPerfil();
  if (conceder) await page.context().grantPermissions(["notifications"]);
  await simular(page.context(), sim);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: tema });
  await entrarNoApp(page);
  return sessao;
}

async function abrirLembretesPeloMais(page: Page): Promise<void> {
  await page.goto("/mais");
  const linha = page.getByRole("link", { name: /Lembretes/ });
  await expect(linha).toContainText("Receber avisos no celular; ative em cada aparelho.");
  expect((await linha.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await linha.click();
  await expect(page).toHaveURL(/\/mais\/lembretes$/);
  await expect(page.getByRole("heading", { name: "Lembretes", level: 1 })).toBeVisible();
}

/** Todo botão e link visível do <main> com pelo menos 44 × 44 px. */
async function alvosDe44(page: Page): Promise<void> {
  const pequenos = await page.evaluate(() =>
    [...document.querySelectorAll("main a, main button")]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ nome: el.textContent?.trim() ?? "", r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44 || r.width < 44)
      .map(({ nome, r }) => `${nome} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
  expect(pequenos).toEqual([]);
}

function estado(page: Page) {
  return page.locator("[data-estado]");
}

/* -------------------------------------------- §23.7 item 3: ativar e desativar */

for (const tema of TEMAS) {
  test(`${tema}: ativar grava a inscrição com a chave do servidor; desativar apaga`, async ({ page }) => {
    const aparelho = aparelhoNovo();
    const sessao = await preparar(page, tema, { aparelho });
    await esperarServiceWorker(page);
    await abrirLembretesPeloMais(page);

    await expect(estado(page)).toHaveText("Desativado neste aparelho.");
    await expect(page.getByText("Nenhum aparelho com lembretes ainda.")).toBeVisible();
    await alvosDe44(page);
    await semRolagemHorizontal(page);

    // o insert que a TELA manda (não o que o mock guardou) traz o user_id da
    // sessão: no banco real a coluna não tem default (§23.2)
    const insert = page.waitForRequest(
      (r) => r.method() === "POST" && new URL(r.url()).pathname === `/rest/v1/${TABELA}`,
    );
    await page.getByRole("button", { name: "Ativar lembretes neste aparelho" }).click();
    const corpoDoInsert = JSON.parse((await insert).postData() ?? "null") as unknown;
    const enviada = (Array.isArray(corpoDoInsert) ? corpoDoInsert[0] : corpoDoInsert) as Record<string, unknown>;
    expect(enviada).toMatchObject({
      user_id: sessao.userId,
      endpoint: `${URL_MOCK}/__push/201/aparelho-1`,
      p256dh: aparelho.p256dh,
      auth: aparelho.auth,
    });
    await expect(recado(page)).toHaveText("Lembretes ativados neste aparelho.");
    await expect(estado(page)).toHaveText("Ativado neste aparelho.");

    const linhas = await lerDoMock<Record<string, unknown>>(sessao, TABELA);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      user_id: sessao.userId,
      endpoint: `${URL_MOCK}/__push/201/aparelho-1`,
      p256dh: aparelho.p256dh,
      auth: aparelho.auth,
      aparelho: "Chrome · Android",
    });
    // o subscribe recebeu a chave pública do servidor e userVisibleOnly
    const feita = await page.evaluate(() => JSON.parse(localStorage.getItem("__push_falso") ?? "null"));
    expect(PUBLICA).toHaveLength(87);
    expect(feita).toMatchObject({ chave: PUBLICA, visivel: true });

    const item = page.locator("[data-aparelho]");
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("Chrome · Android (este)");
    await expect(item).toContainText(/desde \d{2}\/\d{2}/);
    await alvosDe44(page);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `test-results/l34-lembretes-ativado-${tema}.png` });

    // recarregar mantém o estado (a inscrição do navegador + a linha)
    await page.reload();
    await expect(estado(page)).toHaveText("Ativado neste aparelho.");

    await page.getByRole("button", { name: "Desativar neste aparelho" }).click();
    await expect(recado(page)).toHaveText("Lembretes desativados neste aparelho.");
    await expect(estado(page)).toHaveText("Desativado neste aparelho.");
    expect(await lerDoMock(sessao, TABELA)).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.getItem("__push_falso"))).toBe("null");
  });
}

/* ---------------------------------------- §23.7 item 4: a rota de teste */

test("o lembrete de teste chega assinado e cifrado; a inscrição vencida (410) sai", async ({ page }) => {
  const aparelho = aparelhoNovo();
  const sessao = await preparar(page, "dark", { aparelho });
  await esperarServiceWorker(page);
  await page.goto("/mais/lembretes");
  await page.getByRole("button", { name: "Ativar lembretes neste aparelho" }).click();
  await expect(estado(page)).toHaveText("Ativado neste aparelho.");

  // um segundo aparelho da conta, cujo serviço de push diz 410 (vencida)
  await inserirNoMock(sessao, TABELA, [
    {
      user_id: sessao.userId,
      endpoint: `${URL_MOCK}/__push/410/vencida`,
      p256dh: aparelho.p256dh,
      auth: aparelho.auth,
      aparelho: "Firefox · Linux",
    },
  ]);
  await page.reload();
  await expect(page.locator("[data-aparelho]")).toHaveCount(2);

  const botao = page.getByRole("button", { name: "Enviar um lembrete de teste" });
  expect((await botao.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await botao.click();
  await expect(recado(page)).toHaveText(
    "Enviado para 1 aparelho. 1 aparelho tinha a inscrição vencida e saiu da lista.",
  );

  const { pushes } = (await estadoDoMock()) as {
    pushes: { caminho: string; authorization: string; encoding: string; ttl: string; topic: string; corpo_b64: string }[];
  };
  expect(pushes.map((p) => p.caminho).sort()).toEqual(["/__push/201/aparelho-1", "/__push/410/vencida"]);
  const entregue = pushes.find((p) => p.caminho === "/__push/201/aparelho-1");
  if (!entregue) throw new Error("o push não chegou");
  expect(entregue.encoding).toBe("aes128gcm");
  expect(Number(entregue.ttl)).toBeGreaterThan(0);
  expect(entregue.topic).toBe("lembrete-teste");

  // Authorization: vapid t=<JWT ES256>, k=<a chave pública desta execução>
  const m = /^vapid t=([^,]+), k=(\S+)$/.exec(entregue.authorization);
  expect(m?.[2]).toBe(PUBLICA);
  const [cab, carga, assinatura] = (m?.[1] ?? "").split(".") as [string, string, string];
  const pub = Buffer.from(PUBLICA, "base64url");
  const chave = createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: pub.subarray(1, 33).toString("base64url"),
      y: pub.subarray(33).toString("base64url"),
    },
    format: "jwk",
  });
  expect(
    verify("sha256", Buffer.from(`${cab}.${carga}`), { key: chave, dsaEncoding: "ieee-p1363" }, Buffer.from(assinatura, "base64url")),
  ).toBe(true);
  const claims = JSON.parse(Buffer.from(carga, "base64url").toString()) as { aud: string; sub: string; exp: number };
  expect(claims.aud).toBe(URL_MOCK);
  expect(claims.sub).toBe("mailto:e2e@example.com");
  expect(claims.exp * 1000).toBeGreaterThan(Date.now());

  // o corpo cifrado não é vazio e o "aparelho" decifra o payload
  const corpo = Buffer.from(entregue.corpo_b64, "base64");
  expect(corpo.length).toBeGreaterThan(86);
  const payload = JSON.parse(decifrarNoAparelho(corpo, aparelho.privada, aparelho.auth)) as Record<string, string>;
  expect(payload).toMatchObject({ titulo: "Lembrete de teste", url: "/mais/lembretes", tag: "lembrete-teste" });

  // a vencida saiu da tabela e da tela
  const linhas = await lerDoMock<{ endpoint: string }>(sessao, TABELA);
  expect(linhas.map((l) => l.endpoint)).toEqual([`${URL_MOCK}/__push/201/aparelho-1`]);
  await expect(page.locator("[data-aparelho]")).toHaveCount(1);
});

test("sem sessão, POST /api/lembretes/teste responde 401", async ({ playwright, baseURL }) => {
  const anonimo = await playwright.request.newContext({ baseURL });
  const resposta = await anonimo.post("/api/lembretes/teste", { maxRedirects: 0 });
  expect(resposta.status()).toBe(401);
  expect(await resposta.json()).toEqual({ erro: "Entre de novo para continuar." });
  await anonimo.dispose();
});

/* ---------------------------------------------- §23.7 item 1: RLS no mock */

test("a conta B não vê, não apaga e não reaproveita a inscrição da conta A", async () => {
  const a = await sessaoNoMock();
  const b = await sessaoNoMock("outra.pessoa@example.com");
  const aparelho = aparelhoNovo();
  const endpoint = `${URL_MOCK}/__push/201/de-a`;
  await inserirNoMock(a, TABELA, [{ user_id: a.userId, endpoint, p256dh: aparelho.p256dh, auth: aparelho.auth, aparelho: "A" }]);
  const [daA] = await lerDoMock<{ id: string }>(a, TABELA);

  expect(await lerDoMock(b, TABELA)).toEqual([]);
  expect(await lerDoMock(b, TABELA, `select=*&id=eq.${daA?.id}`)).toEqual([]);
  const apagar = await fetch(`${URL_MOCK}/rest/v1/${TABELA}?id=eq.${daA?.id}`, {
    method: "DELETE",
    headers: { apikey: "mock-anon", authorization: `Bearer ${b.token}` },
  });
  expect(apagar.ok).toBe(true);
  expect(await lerDoMock(a, TABELA)).toHaveLength(1);
  // o mesmo endpoint não entra para outra conta (endpoint único, §23.2)
  await expect(
    inserirNoMock(b, TABELA, [{ user_id: b.userId, endpoint, p256dh: aparelho.p256dh, auth: aparelho.auth, aparelho: "B" }]),
  ).rejects.toThrow(/409/);
});

test("como no banco: insert sem user_id é recusado (42501), sem chave dá 23502, PATCH não altera", async () => {
  const a = await sessaoNoMock();
  const aparelho = aparelhoNovo();
  const inserir = (linha: Record<string, unknown>) =>
    fetch(`${URL_MOCK}/rest/v1/${TABELA}`, {
      method: "POST",
      headers: { apikey: "mock-anon", authorization: `Bearer ${a.token}`, "content-type": "application/json" },
      body: JSON.stringify(linha),
    });
  const semDono = await inserir({ endpoint: `${URL_MOCK}/__push/201/x`, p256dh: aparelho.p256dh, auth: aparelho.auth });
  expect(semDono.status).toBe(403);
  expect(await semDono.json()).toMatchObject({ code: "42501" });
  const semChave = await inserir({ user_id: a.userId, endpoint: `${URL_MOCK}/__push/201/x`, auth: aparelho.auth });
  expect(semChave.status).toBe(400);
  expect(await semChave.json()).toMatchObject({ code: "23502" });
  expect(await lerDoMock(a, TABELA)).toEqual([]);

  await inserirNoMock(a, TABELA, [
    { user_id: a.userId, endpoint: `${URL_MOCK}/__push/201/x`, p256dh: aparelho.p256dh, auth: aparelho.auth, aparelho: "A" },
  ]);
  const mudar = await fetch(`${URL_MOCK}/rest/v1/${TABELA}?aparelho=eq.A`, {
    method: "PATCH",
    headers: { apikey: "mock-anon", authorization: `Bearer ${a.token}`, "content-type": "application/json" },
    body: JSON.stringify({ aparelho: "trocado" }),
  });
  expect(mudar.ok).toBe(true);
  expect((await lerDoMock<{ aparelho: string }>(a, TABELA)).map((l) => l.aparelho)).toEqual(["A"]);
});

test("o aparelho que era de outra conta ganha uma inscrição nova ao ativar", async ({ page }) => {
  const outra = await sessaoNoMock("outra.pessoa@example.com");
  const aparelho = aparelhoNovo();
  // a outra conta já tinha este aparelho (o primeiro endpoint que ele vai gerar)
  await inserirNoMock(outra, TABELA, [
    { user_id: outra.userId, endpoint: `${URL_MOCK}/__push/201/compartilhado-1`, p256dh: aparelho.p256dh, auth: aparelho.auth, aparelho: "outra" },
  ]);
  const sessao = await preparar(page, "light", { aparelho, base: `${URL_MOCK}/__push/201/compartilhado` });
  await esperarServiceWorker(page);
  await page.goto("/mais/lembretes");
  await page.getByRole("button", { name: "Ativar lembretes neste aparelho" }).click();
  await expect(estado(page)).toHaveText("Ativado neste aparelho.");
  const minhas = await lerDoMock<{ endpoint: string }>(sessao, TABELA);
  expect(minhas.map((l) => l.endpoint)).toEqual([`${URL_MOCK}/__push/201/compartilhado-2`]);
});

/* ------------------------------------------- §23.7 item 2: service worker */

async function workerDoApp(context: BrowserContext): Promise<Worker> {
  const [jaRegistrado] = context.serviceWorkers();
  if (jaRegistrado) return jaRegistrado;
  return context.waitForEvent("serviceworker", { timeout: 30_000 });
}

test("o worker real mostra o push como notificação e o toque leva à url", async ({ page, context }) => {
  await preparar(page, "light", {});
  await esperarServiceWorker(page);
  const worker = await workerDoApp(context);

  await worker.evaluate(async (payload) => {
    const escopo = globalThis as unknown as {
      dispatchEvent: (e: Event) => boolean;
      PushEvent: new (tipo: string, init: { data: string }) => Event;
    };
    escopo.dispatchEvent(new escopo.PushEvent("push", { data: JSON.stringify(payload) }));
  }, { titulo: "Hora do treino", corpo: "Treino A hoje, 3 exercícios.", url: "/relatorio", tag: "e2e-push" });

  const lerNotificacoes = () =>
    worker.evaluate(async () => {
      const escopo = globalThis as unknown as { registration: ServiceWorkerRegistration };
      const lista = await escopo.registration.getNotifications();
      return lista.map((n) => ({ title: n.title, body: n.body, tag: n.tag, icon: n.icon, lang: n.lang, data: n.data as unknown }));
    });
  await expect.poll(async () => (await lerNotificacoes()).length).toBe(1);
  expect((await lerNotificacoes())[0]).toEqual({
    title: "Hora do treino",
    body: "Treino A hoje, 3 exercícios.",
    tag: "e2e-push",
    icon: expect.stringMatching(/\/icons\/icone-192\.png$/) as unknown as string,
    lang: "pt-BR",
    data: { url: "/relatorio" },
  });

  await worker.evaluate(async () => {
    const escopo = globalThis as unknown as {
      registration: ServiceWorkerRegistration;
      dispatchEvent: (e: Event) => boolean;
      NotificationEvent: new (tipo: string, init: { notification: Notification }) => Event;
    };
    const [n] = await escopo.registration.getNotifications({ tag: "e2e-push" });
    if (!n) throw new Error("sem notificação");
    escopo.dispatchEvent(new escopo.NotificationEvent("notificationclick", { notification: n }));
  });
  await expect(page).toHaveURL(/\/relatorio$/);
  await expect.poll(async () => (await lerNotificacoes()).length).toBe(0);
});

/* ------------------------------ §23.7 itens 3 e 5: bloqueado, Brave, sem suporte */

for (const tema of TEMAS) {
  test(`${tema}: permissão negada: bloqueado, com o caminho para liberar nas configurações`, async ({ page }) => {
    await preparar(page, tema, { aparelho: aparelhoNovo(), negar: true }, false);
    await esperarServiceWorker(page);
    await page.goto("/mais/lembretes");
    await expect(estado(page)).toHaveText("Desativado neste aparelho.");
    await page.getByRole("button", { name: "Ativar lembretes neste aparelho" }).click();

    await expect(aviso(page)).toHaveText("O navegador recusou as notificações deste app.");
    await expect(estado(page)).toHaveText("Bloqueado pelo navegador.");
    const instrucao = page.locator('[data-instrucao="permissao"]');
    await expect(instrucao.getByRole("heading", { level: 3 })).toHaveText(
      "O navegador está bloqueando as notificações deste app",
    );
    await expect(instrucao).toContainText("Permissões → Notificações → Permitir");
    await expect(page.getByRole("button", { name: /Ativar/ })).toHaveCount(0);
    await alvosDe44(page);
    await semRolagemHorizontal(page);
  });

  test(`${tema}: Brave com o push desligado: ligar os serviços do Google`, async ({ page }) => {
    const sessao = await preparar(page, tema, { aparelho: aparelhoNovo(), brave: true, subscribeFalha: true });
    await esperarServiceWorker(page);
    await page.goto("/mais/lembretes");
    // sem falha ainda, nada a explicar
    await expect(page.locator("[data-instrucao]")).toHaveCount(0);
    await page.getByRole("button", { name: "Ativar lembretes neste aparelho" }).click();

    await expect(aviso(page)).toHaveText("O navegador não conseguiu ativar os avisos neste aparelho.");
    const instrucao = page.locator('[data-instrucao="brave"]');
    await expect(instrucao.getByRole("heading", { level: 3 })).toHaveText(
      "No Brave, os avisos só chegam com os serviços do Google ligados",
    );
    await expect(instrucao).toContainText("Configurações do Brave → Privacidade e segurança");
    await expect(instrucao).toContainText("“Usar os serviços do Google para mensagens push”");
    // o caso especial basta: a instrução genérica não se empilha
    await expect(page.locator("[data-instrucao]")).toHaveCount(1);
    expect(await lerDoMock(sessao, TABELA)).toHaveLength(0);
    await alvosDe44(page);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `test-results/l34-lembretes-brave-${tema}.png` });
  });

  test(`${tema}: Chrome com o subscribe falhando: a frase e o que fazer (nunca só a frase)`, async ({ page }) => {
    const sessao = await preparar(page, tema, { aparelho: aparelhoNovo(), subscribeFalha: true });
    await esperarServiceWorker(page);
    await page.goto("/mais/lembretes");
    await expect(page.locator("[data-instrucao]")).toHaveCount(0);
    await page.getByRole("button", { name: "Ativar lembretes neste aparelho" }).click();

    await expect(aviso(page)).toHaveText("O navegador não conseguiu ativar os avisos neste aparelho.");
    const instrucao = page.locator('[data-instrucao="tentar"]');
    await expect(instrucao.getByRole("heading", { level: 3 })).toHaveText("Para tentar de novo");
    await expect(instrucao).toContainText("Quando o navegador perguntar, escolha Permitir.");
    await expect(instrucao).toContainText("notificações do navegador (ou do app instalado) estão ligadas");
    await expect(estado(page)).toHaveText("Desativado neste aparelho.");
    expect(await lerDoMock(sessao, TABELA)).toHaveLength(0);
    await alvosDe44(page);
    await semRolagemHorizontal(page);
  });

  test(`${tema}: navegador sem PushManager: não suportado, com o que fazer`, async ({ page }) => {
    await preparar(page, tema, { semPush: true });
    await page.goto("/mais/lembretes");
    await expect(estado(page)).toHaveText("Este navegador não recebe notificações.");
    const instrucao = page.locator('[data-instrucao="suporte"]');
    await expect(instrucao).toContainText("No Android, abra o app no Chrome ou no Brave.");
    await expect(page.getByRole("button", { name: /Ativar/ })).toHaveCount(0);
    await alvosDe44(page);
    await semRolagemHorizontal(page);
  });

  test(`${tema}: nenhum aparelho recebe (500): status com a cor de erro; sem nome, "Aparelho sem nome"`, async ({ page }) => {
    const aparelho = aparelhoNovo();
    const sessao = await preparar(page, tema, { aparelho });
    await inserirNoMock(sessao, TABELA, [
      { user_id: sessao.userId, endpoint: `${URL_MOCK}/__push/500/quebrado`, p256dh: aparelho.p256dh, auth: aparelho.auth, aparelho: "" },
    ]);
    await esperarServiceWorker(page);
    await page.goto("/mais/lembretes");
    const item = page.locator("[data-aparelho]");
    await expect(item).toContainText("Aparelho sem nome");

    await page.getByRole("button", { name: "Enviar um lembrete de teste" }).click();
    await expect(recado(page)).toHaveText("Não deu para enviar agora.");
    await expect(recado(page)).toHaveAttribute("data-falha", "");
    await expect(recado(page)).toHaveClass(/text-destructive/);
    await expect(recado(page)).not.toHaveClass(/bg-primary/);

    // o leitor de tela ouve o mesmo nome que a lista mostra
    const remover = item.getByRole("button", { name: /^Remover Aparelho sem nome \(desde \d{2}\/\d{2}\)$/ });
    await expect(remover).toHaveCount(1);
    await remover.click();
    await expect(recado(page)).toHaveText("Aparelho sem nome saiu da lista.");
    await expect(recado(page)).not.toHaveAttribute("data-falha", "");
    expect(await lerDoMock(sessao, TABELA)).toHaveLength(0);
    await alvosDe44(page);
    await semRolagemHorizontal(page);
  });
}

/* ------------------------------ §23.7 item 7: a volta das configurações */

/**
 * Nega a notificação de verdade no Chromium (o Playwright só sabe conceder).
 * A sessão CDP fica aberta até o fim do teste: ao se desligar, o Chromium
 * desfaz as permissões que ela mudou.
 */
async function negarDeVerdade(page: Page, origem: string): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const { targetInfo } = (await cdp.send("Target.getTargetInfo")) as {
    targetInfo: { browserContextId?: string };
  };
  await cdp.send("Browser.setPermission", {
    origin: origem,
    permission: { name: "notifications" },
    setting: "denied",
    browserContextId: targetInfo.browserContextId,
  });
}

/** A pessoa sai para as configurações e volta: hidden → visible. */
async function voltarDasConfiguracoes(page: Page): Promise<void> {
  await page.evaluate(() => {
    const doc = document as unknown as Record<string, unknown>;
    const ficar = (v: DocumentVisibilityState) =>
      Object.defineProperty(document, "visibilityState", { value: v, configurable: true });
    ficar("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    ficar("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    delete doc.visibilityState;
  });
}

for (const tema of TEMAS) {
  test(`${tema}: liberada nas configurações, a volta mostra o Ativar e tira a instrução (visibilitychange)`, async ({ page, baseURL }) => {
    const sessao = await preparar(page, tema, { aparelho: aparelhoNovo(), semPermissionsApi: true }, false);
    const origem = new URL(baseURL ?? "").origin;
    await negarDeVerdade(page, origem);
    await esperarServiceWorker(page);
    await page.goto("/mais/lembretes");
    expect(await page.evaluate(() => Notification.permission)).toBe("denied");
    await expect(estado(page)).toHaveText("Bloqueado pelo navegador.");
    await expect(page.locator('[data-instrucao="permissao"]')).toContainText("Volte aqui: a tela confere de novo");
    await expect(page.getByRole("button", { name: /Ativar/ })).toHaveCount(0);

    // a pessoa libera fora do app (o contexto do Playwright concede)
    await page.context().grantPermissions(["notifications"], { origin: origem });
    expect(await page.evaluate(() => Notification.permission)).toBe("granted");
    // sem a volta, nada muda sozinho (não há leitura periódica)
    await page.waitForTimeout(400);
    await expect(estado(page)).toHaveText("Bloqueado pelo navegador.");

    await voltarDasConfiguracoes(page);
    await expect(estado(page)).toHaveText("Desativado neste aparelho.");
    const ativar = page.getByRole("button", { name: "Ativar lembretes neste aparelho" });
    await expect(ativar).toBeVisible();
    await expect(page.locator("[data-instrucao]")).toHaveCount(0);
    await alvosDe44(page);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `test-results/l34-lembretes-volta-${tema}.png` });

    // e o Ativar funciona dali mesmo
    await ativar.click();
    await expect(estado(page)).toHaveText("Ativado neste aparelho.");
    expect(await lerDoMock(sessao, TABELA)).toHaveLength(1);
  });

  test(`${tema}: a recusa ao pedir some na volta, quando a permissão foi liberada`, async ({ page, baseURL }) => {
    // começa em "perguntar"; o pedido é recusado pelo Chromium de verdade
    await preparar(page, tema, { aparelho: aparelhoNovo(), semPermissionsApi: true }, false);
    const origem = new URL(baseURL ?? "").origin;
    await esperarServiceWorker(page);
    await page.goto("/mais/lembretes");
    await expect(estado(page)).toHaveText("Desativado neste aparelho.");
    await negarDeVerdade(page, origem);
    await page.getByRole("button", { name: "Ativar lembretes neste aparelho" }).click();
    await expect(aviso(page)).toHaveText("O navegador recusou as notificações deste app.");
    await expect(estado(page)).toHaveText("Bloqueado pelo navegador.");

    await page.context().grantPermissions(["notifications"], { origin: origem });
    await voltarDasConfiguracoes(page);
    await expect(estado(page)).toHaveText("Desativado neste aparelho.");
    await expect(aviso(page)).toHaveCount(0);
    await expect(page.locator("[data-instrucao]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ativar lembretes neste aparelho" })).toBeVisible();
  });
}

test("a troca da permissão avisada pelo navegador (permissions change) também relê", async ({ page, baseURL }) => {
  await preparar(page, "light", { aparelho: aparelhoNovo() }, false);
  const origem = new URL(baseURL ?? "").origin;
  await negarDeVerdade(page, origem);
  await esperarServiceWorker(page);
  await page.goto("/mais/lembretes");
  await expect(estado(page)).toHaveText("Bloqueado pelo navegador.");
  await page.context().grantPermissions(["notifications"], { origin: origem });
  // nenhuma volta disparada: só o `change` do PermissionStatus
  await expect(estado(page)).toHaveText("Desativado neste aparelho.");
  await expect(page.getByRole("button", { name: "Ativar lembretes neste aparelho" })).toBeVisible();
  await expect(page.locator("[data-instrucao]")).toHaveCount(0);
});

/* ------------------------------ §23.7 item 5: a frase na primeira dobra */

for (const tema of TEMAS) {
  test(`${tema}: Brave com a permissão negada ao pedir: a frase acima das duas instruções, na primeira dobra`, async ({ page }) => {
    await preparar(page, tema, { aparelho: aparelhoNovo(), brave: true, negar: true }, false);
    await esperarServiceWorker(page);
    await page.goto("/mais/lembretes");
    await page.getByRole("button", { name: "Ativar lembretes neste aparelho" }).click();
    await expect(aviso(page)).toHaveText("O navegador recusou as notificações deste app.");
    const instrucoes = page.locator("[data-instrucao]");
    await expect(instrucoes).toHaveCount(2);
    await expect(instrucoes.nth(0)).toHaveAttribute("data-instrucao", "brave");
    await expect(instrucoes.nth(1)).toHaveAttribute("data-instrucao", "permissao");

    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const caixaAviso = await aviso(page).boundingBox();
    const caixaInstrucao = await instrucoes.nth(0).boundingBox();
    const caixaNav = await page.getByRole("navigation", { name: "Navegação principal" }).boundingBox();
    if (!caixaAviso || !caixaInstrucao || !caixaNav) throw new Error("sem caixa");
    // acima das instruções e inteira acima da barra de abas, sem rolar
    expect(caixaAviso.y + caixaAviso.height).toBeLessThanOrEqual(caixaInstrucao.y);
    expect(caixaAviso.y).toBeGreaterThanOrEqual(0);
    expect(caixaAviso.y + caixaAviso.height).toBeLessThanOrEqual(caixaNav.y);
    await semRolagemHorizontal(page);
    await page.screenshot({ path: `test-results/l34-lembretes-brave-negado-${tema}.png` });
  });
}

/* ------------------------------ §23.7 item 8: sem tabela e sem configuração */

for (const tema of TEMAS) {
  test(`${tema}: sem a tabela no banco (PGRST205), a tela diz que falta atualizar o banco`, async ({ page }) => {
    await preparar(page, tema, { aparelho: aparelhoNovo() });
    // o PostgREST de um projeto sem a migração
    await page.route(/\/rest\/v1\/lembretes_inscricoes/, (rota) =>
      rota.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          code: "PGRST205",
          details: null,
          hint: null,
          message: "Could not find the table 'public.lembretes_inscricoes' in the schema cache",
        }),
      }),
    );
    await page.goto("/mais/lembretes");
    await expect(page.locator('[data-estado="sem-configuracao"]')).toHaveText(
      "Os lembretes ainda não estão disponíveis neste servidor (falta atualizar o banco).",
    );
    await expect(page.getByRole("button", { name: /Ativar|Enviar/ })).toHaveCount(0);
    await expect(page.locator("[data-instrucao]")).toHaveCount(0);
    await expect(aviso(page)).toHaveCount(0);
    await alvosDe44(page);
    await semRolagemHorizontal(page);
  });
}

/** Uma porta livre na própria máquina, para o segundo `next start`. */
function portaLivre(): Promise<number> {
  return new Promise((ok, falha) => {
    const s = createServer();
    s.once("error", falha);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => ok(port));
    });
  });
}

test.describe("sem as variáveis VAPID (um segundo next start, do mesmo build)", () => {
  let servidor: ChildProcess | null = null;
  let urlSemVapid = "";

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    const porta = await portaLivre();
    const raiz = resolve(__dirname, "..");
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: URL_MOCK,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon",
      ALLOWED_EMAIL: "miguelgsaviotti29@gmail.com",
    };
    delete env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete env.VAPID_PRIVATE_KEY;
    delete env.VAPID_SUBJECT;
    delete env.LEMBRETES_PUSH_DE_TESTE;
    servidor = spawn(
      process.execPath,
      [resolve(raiz, "node_modules/next/dist/bin/next"), "start", "-p", String(porta), "-H", "127.0.0.1"],
      { cwd: raiz, env, stdio: "ignore", detached: true },
    );
    urlSemVapid = `http://127.0.0.1:${porta}`;
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(`${urlSemVapid}/login`)).status;
          } catch {
            return 0;
          }
        },
        { timeout: 90_000, intervals: [250] },
      )
      .toBe(200);
  });

  test.afterAll(() => {
    // o grupo inteiro do processo que este teste subiu (detached)
    if (servidor?.pid) {
      try {
        process.kill(-servidor.pid, "SIGTERM");
      } catch {
        /* já saiu */
      }
    }
  });

  for (const tema of TEMAS) {
    test(`${tema}: a tela diz que não está configurado, sem botão, e a rota responde 503`, async ({ page }) => {
      await preparar(page, tema, {});
      // o cookie da sessão é do host (127.0.0.1), não da porta: vale nos dois servidores
      await page.goto(`${urlSemVapid}/mais/lembretes`);
      await expect(page.getByRole("heading", { name: "Lembretes", level: 1 })).toBeVisible();
      await expect(page.locator('[data-estado="sem-configuracao"]')).toHaveText(
        "Lembretes ainda não configurados neste servidor.",
      );
      await expect(page.getByRole("button", { name: /Ativar|Enviar/ })).toHaveCount(0);
      await expect(page.locator("[data-instrucao]")).toHaveCount(0);
      await alvosDe44(page);
      await semRolagemHorizontal(page);

      const resposta = await page.request.post(`${urlSemVapid}/api/lembretes/teste`);
      expect(resposta.status()).toBe(503);
      expect(await resposta.json()).toEqual({ erro: "Lembretes ainda não configurados neste servidor." });
    });
  }
});

/* ------------------------------ a linha nova de Mais: anel de foco inteiro */

/** A cor de um ponto da tela (a captura é 2×; o 1×1 CSS vira 2×2). */
async function corEm(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0];
}

function luminancia([r, g, b]: [number, number, number]): number {
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: [number, number, number], b: [number, number, number]): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

for (const tema of TEMAS) {
  test(`${tema}: o anel de foco da linha Lembretes fica dentro da lista (não é cortado)`, async ({ page }) => {
    await preparar(page, tema, {});
    await page.goto("/mais");
    const linha = page.getByRole("link", { name: /Lembretes/ });
    const caixa = await linha.boundingBox();
    if (!caixa) throw new Error("sem caixa");
    // 3 px para dentro da borda esquerda, no meio da altura: onde o anel interno passa
    const x = caixa.x + 3;
    const y = caixa.y + caixa.height / 2;
    const antes = await corEm(page, x, y);

    await linha.focus();
    expect(await linha.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
    const estilo = await linha.evaluate((el) => {
      const s = getComputedStyle(el);
      return { estilo: s.outlineStyle, largura: parseFloat(s.outlineWidth), deslocamento: parseFloat(s.outlineOffset) };
    });
    expect(estilo.estilo).toBe("solid");
    expect(estilo.largura).toBeGreaterThanOrEqual(2);
    // o anel inteiro cabe dentro da caixa da linha (e a lista corta o que sai dela)
    expect(estilo.deslocamento + estilo.largura).toBeLessThanOrEqual(0);

    const depois = await corEm(page, x, y);
    expect(contraste(antes, depois)).toBeGreaterThanOrEqual(3);
  });
}
