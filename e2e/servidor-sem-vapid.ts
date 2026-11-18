/**
 * Um segundo `next start` do MESMO build, sem as variáveis VAPID — o layout
 * de Mais → Lembretes que a produção mostra enquanto elas não existem na
 * Vercel (SPEC §23.9 e §23.15): "Lembretes ainda não configurados neste
 * servidor.", sem "Este aparelho" nem "Aparelhos desta conta", e os Horários
 * logo no alto. O cookie da sessão é do host (127.0.0.1), não da porta: quem
 * entrou pelo servidor do config vale nos dois.
 *
 * O processo sobe `detached` (grupo próprio) e `parar()` derruba o grupo
 * inteiro — nada fica órfão na porta.
 */
import { spawn } from "node:child_process";
import { createServer, type AddressInfo } from "node:net";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import { URL_MOCK } from "./fixtures";

export type ServidorSemVapid = { url: string; parar: () => void };

/** Uma porta livre na própria máquina. */
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

/** Sobe o servidor e espera o `/login` responder 200 (até 90 s). */
export async function subirSemVapid(): Promise<ServidorSemVapid> {
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
  const servidor = spawn(
    process.execPath,
    [resolve(raiz, "node_modules/next/dist/bin/next"), "start", "-p", String(porta), "-H", "127.0.0.1"],
    { cwd: raiz, env, stdio: "ignore", detached: true },
  );
  const url = `http://127.0.0.1:${porta}`;
  const parar = () => {
    // o grupo inteiro do processo (detached)
    if (!servidor.pid) return;
    try {
      process.kill(-servidor.pid, "SIGTERM");
    } catch {
      /* já saiu */
    }
  };
  try {
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(`${url}/login`)).status;
          } catch {
            return 0;
          }
        },
        { timeout: 90_000, intervals: [250] },
      )
      .toBe(200);
  } catch (erro) {
    parar();
    throw erro;
  }
  return { url, parar };
}
