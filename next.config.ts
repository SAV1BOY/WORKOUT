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
  reloadOnOnline: true,
  additionalPrecacheEntries: [
    ...arquivosDoPublic(),
    { url: "/~offline", revision: REVISAO },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // o sprite do mapa muscular é lido do disco em runtime
  outputFileTracingIncludes: {
    "/**": ["./assets/mapa-muscular/**"],
  },
};

export default withSerwist(nextConfig);
