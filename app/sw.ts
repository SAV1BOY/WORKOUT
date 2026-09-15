import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  type RuntimeCaching,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * O Supabase **nunca** é servido de cache (SPEC §8): uma resposta guardada
 * esconderia o que foi gravado em outro lugar — e a leitura offline já é
 * resolvida pelo cache persistido do TanStack Query, que o app sabe quando
 * atualizar. As rotas são as do PostgREST, do GoTrue e do Storage, em
 * qualquer host (o projeto de verdade e o mock dos testes).
 */
const SUPABASE = /\/(rest|auth|storage|realtime|functions)\/v1\//;

/**
 * As figuras e as fotos: arquivos imutáveis com o nome do exercício. As
 * figuras do programa já vêm no precache da instalação (globPublicPatterns em
 * next.config.ts); as fotos do catálogo entram aqui, sob demanda.
 */
const MIDIA = /\/(figuras|fotos|itens|mapa-muscular)\//;

const regras: RuntimeCaching[] = [
  {
    matcher: ({ url }) => SUPABASE.test(url.pathname),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && MIDIA.test(url.pathname),
    handler: new CacheFirst({
      // mesmo nome em `CACHE_DE_MIDIA` (lib/db.ts): é o cache que o "Sair" poupa
      cacheName: "midia-do-treino",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 300,
          maxAgeSeconds: 180 * 24 * 60 * 60,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: regras,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
