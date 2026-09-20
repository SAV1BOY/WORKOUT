import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

/**
 * O que entra no precache da instalação (SPEC §8): o shell (o próprio Next
 * cuida), a página de fallback `/~offline` e as **figuras** dos exercícios
 * (700 kB no total, com os ícones). As fotos do catálogo (11 MB) e as do
 * equipamento (6 MB) ficam de fora — entram no cache sob demanda
 * (`runtimeCaching` em `app/sw.ts`) e o app aquece as do programa da fase
 * atual depois de instalar (`lib/precache-do-programa.ts`).
 *
 * A lista é montada aqui porque `additionalPrecacheEntries` **substitui** o
 * `globPublicPatterns` do plugin: passar só a `/~offline` deixaria o precache
 * sem nenhum arquivo de `public/`.
 */
const PASTAS_NO_PRECACHE = ["figuras", "icons"];

function arquivosDoPublic(): { url: string; revision: string }[] {
  const entradas: { url: string; revision: string }[] = [];
  for (const pasta of PASTAS_NO_PRECACHE) {
    const caminho = join(process.cwd(), "public", pasta);
    let nomes: string[];
    try {
      nomes = readdirSync(caminho);
    } catch {
      // `npm run assets` ainda não rodou: o precache fica sem esta pasta
      continue;
    }
    for (const nome of nomes) {
      const hash = createHash("md5")
        .update(readFileSync(join(caminho, nome)))
        .digest("hex");
      entradas.push({ url: `/${pasta}/${nome}`, revision: hash });
    }
  }
  return entradas;
}

/**
 * O commit que virou este build (SPEC §22.1). Na Vercel ele vem pronto na
 * `VERCEL_GIT_COMMIT_SHA`; aqui é o `git rev-parse` mesmo. Sem git e sem
 * variável (um `npm run build` dentro de um tarball) fica "dev" — a rota
 * `/versao` continua respondendo, dizendo a verdade.
 */
function commitDoBuild(): string {
  const daVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (daVercel) return daVercel;
  try {
    return (
      execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() || "dev"
    );
  } catch {
    return "dev";
  }
}

const COMMIT = commitDoBuild();
const CONSTRUIDO_EM = new Date().toISOString();

/** Muda a cada build: é o que faz o service worker rebaixar o HTML velho. */
const REVISAO = createHash("md5")
  .update(String(Date.now()))
  .digest("hex")
  .slice(0, 12);

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // em desenvolvimento o service worker atrapalha mais do que ajuda
  disable: process.env.NODE_ENV === "development",
  /*
   * `reloadOnOnline` liga um `location.reload()` a cada evento `online` do
   * navegador. No terraço, com o 4G indo e voltando, isso é o app se
   * recarregando NO MEIO do treino: o timer de descanso some, o cronômetro da
   * prancha para sem avisar e a recarga ainda atropela o flush da fila de
   * saída (o `tentarAgora`, que roda no mesmo evento, é cortado pela metade).
   * Não há o que ganhar: a leitura já vem do cache do TanStack Query (§8) e a
   * escrita já vive na fila; versão nova do app entra pelo service worker
   * (`skipWaiting` + `clientsClaim`) na próxima navegação.
   */
  reloadOnOnline: false,
  additionalPrecacheEntries: [
    ...arquivosDoPublic(),
    { url: "/~offline", revision: REVISAO },
  ],
});

/**
 * Cabeçalhos de segurança (um app pessoal atrás de login, mas na internet).
 *
 * `frame-ancestors 'none'` + `X-Frame-Options` fecham o clickjacking em cima
 * dos botões que gravam no banco; `nosniff` impede o navegador de adivinhar o
 * tipo de um arquivo servido de `public/`; a `Referrer-Policy` evita mandar o
 * caminho da tela para fora. A `Permissions-Policy` desliga o que o app não
 * usa e deixa a tela acesa (`screen-wake-lock`, §3.2) de pé.
 *
 * Uma CSP completa (script/style/connect/img/worker) ficou de fora de
 * propósito: ela precisa do domínio do projeto Supabase, que ainda não existe
 * — está anotada em PROGRESSO.md para ser medida em `Report-Only` depois do
 * deploy, antes de ser forçada.
 */
const CABECALHOS_DE_SEGURANCA = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), screen-wake-lock=(self)",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* o que a rota `/versao` e o rodapé dos Créditos mostram (SPEC §22.1) */
  env: {
    NEXT_PUBLIC_COMMIT: COMMIT,
    NEXT_PUBLIC_CONSTRUIDO_EM: CONSTRUIDO_EM,
  },
  async headers() {
    return [{ source: "/:caminho*", headers: CABECALHOS_DE_SEGURANCA }];
  },
  // o sprite do mapa muscular é lido do disco em runtime
  outputFileTracingIncludes: {
    "/**": ["./assets/mapa-muscular/**"],
  },
};

export default withSerwist(nextConfig);
