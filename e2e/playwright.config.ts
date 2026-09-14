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

/** As três variáveis que o app precisa, apontando para o mock. */
const ambiente = {
  NEXT_PUBLIC_SUPABASE_URL: URL_MOCK,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon",
  ALLOWED_EMAIL: "miguelgsaviotti29@gmail.com",
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

  webServer: [
    {
      command: "npx tsx scripts/mock-supabase.ts",
      cwd: raiz,
      url: `${URL_MOCK}/__mock/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
      env: { MOCK_SUPABASE_PORT: String(PORTA_MOCK) },
    },
    {
      command: `npx next start -p ${PORTA_APP}`,
      cwd: raiz,
      url: `${URL_APP}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: ambiente,
    },
  ],
});
