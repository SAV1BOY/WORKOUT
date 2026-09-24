import { generateKeyPairSync, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta contra o app real + o mock do Supabase
 * (scripts/mock-supabase.ts). Exige `npm run build` antes: o webServer sobe
 * `next start`, não o modo de desenvolvimento.
 *
 * Rodar:  npm run build && npm run e2e
 */
/** raiz do repositório (o config mora em e2e/) */
const raiz = resolve(__dirname, "..");

const PORTA_APP = Number(process.env.E2E_PORT ?? 3100);
const PORTA_MOCK = Number(process.env.MOCK_SUPABASE_PORT ?? 54321);
const URL_APP = `http://127.0.0.1:${PORTA_APP}`;
const URL_MOCK = `http://127.0.0.1:${PORTA_MOCK}`;

/**
 * Um par VAPID gerado AQUI, a cada execução (SPEC §23.5): nenhuma chave de
 * lembrete fica no repositório. O config é avaliado no processo principal e
 * de novo em cada worker do Playwright; o par vai para o `process.env` na
 * primeira vez e os workers (filhos) herdam o mesmo — é assim que o teste
 * confere a chave pública que o servidor usou.
 */
function garantirParVapid(): void {
  if (process.env.E2E_VAPID_PRIVADA && process.env.E2E_VAPID_PUBLICA) return;
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const privada = privateKey.export({ format: "jwk" });
  const publica = publicKey.export({ format: "jwk" });
  process.env.E2E_VAPID_PRIVADA = String(privada.d);
  process.env.E2E_VAPID_PUBLICA = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(String(publica.x), "base64url"),
    Buffer.from(String(publica.y), "base64url"),
  ]).toString("base64url");
}
garantirParVapid();

/**
 * O segredo do disparo (SPEC §23.11), também gerado aqui a cada execução: o
 * app o recebe como `LEMBRETES_SEGREDO` e o mock como o "Vault"
 * (`MOCK_LEMBRETES_SEGREDO`). Os workers herdam o mesmo pelo `process.env`.
 */
if (!process.env.E2E_LEMBRETES_SEGREDO) {
  process.env.E2E_LEMBRETES_SEGREDO = randomBytes(24).toString("base64url");
}

/** As variáveis que o app precisa, apontando para o mock. */
const ambiente = {
  NEXT_PUBLIC_SUPABASE_URL: URL_MOCK,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon",
  ALLOWED_EMAIL: "miguelgsaviotti29@gmail.com",
  // lembretes (SPEC §23): o par desta execução e o servidor de push falso do mock
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.E2E_VAPID_PUBLICA ?? "",
  VAPID_PRIVATE_KEY: process.env.E2E_VAPID_PRIVADA ?? "",
  VAPID_SUBJECT: "mailto:e2e@example.com",
  LEMBRETES_PUSH_DE_TESTE: URL_MOCK,
  LEMBRETES_SEGREDO: process.env.E2E_LEMBRETES_SEGREDO ?? "",
};

export default defineConfig({
  testDir: ".",
  outputDir: "../test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_500 },

  use: {
    baseURL: URL_APP,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "celular",
      use: {
        // Chromium emulando celular: o app é feito para 360 px, uma mão.
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        locale: "pt-BR",
        timezoneId: "America/Sao_Paulo",
      },
    },
  ],

  /*
   * `reuseExistingServer: false` de propósito nos dois: reaproveitar um
   * servidor que já estava de pé é reaproveitar um servidor DESCONHECIDO —
   * um `next start` órfão de antes do último build serve o HTML com o hash
   * antigo do CSS, a página abre sem estilo nenhum e os testes de 44 px
   * falham como se o app estivesse quebrado. Aqui a porta ocupada vira um
   * erro claro ("is already used") em vez de um resultado errado.
   */
  webServer: [
    {
      command: "npx tsx scripts/mock-supabase.ts",
      cwd: raiz,
      url: `${URL_MOCK}/__mock/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        MOCK_SUPABASE_PORT: String(PORTA_MOCK),
        MOCK_LEMBRETES_SEGREDO: process.env.E2E_LEMBRETES_SEGREDO ?? "",
      },
    },
    {
      command: `npx next start -p ${PORTA_APP}`,
      cwd: raiz,
      url: `${URL_APP}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: ambiente,
    },
  ],
});
