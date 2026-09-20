import { defaultCache } from "@serwist/next/worker";
import {
  ehNavegacao,
  ehRsc,
  type PedidoDeNavegacao,
} from "@/lib/sw-navegacao";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
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
 * As ilustrações, as figuras e as fotos: arquivos imutáveis com o nome do
 * exercício. As figuras do programa já vêm no precache da instalação
 * (globPublicPatterns em next.config.ts); as ilustrações e as fotos entram
 * aqui, sob demanda — e as da fase inteira são puxadas por
 * `lib/precache-do-programa.ts`.
 */
const MIDIA = /\/(figuras|fotos|ilustracoes|itens|mapa-muscular)\//;

/** A página que o precache guarda para quando não há rede (SPEC §8). */
const OFFLINE = "/~offline";

/**
 * A regra de "isto é uma navegação" mora em `lib/sw-navegacao.ts`, com teste
 * de unidade: é ela que estava errada (SPEC §22.1), e o service worker roda
 * num mundo onde o Vitest não entra.
 */
function pedidoDe(request: Request): PedidoDeNavegacao {
  return {
    destino: request.destination,
    modo: request.mode,
    rsc: request.headers.get("RSC"),
    url: request.url,
  };
}

/**
 * O HTML mínimo de socorro: só entra se o precache da `/~offline` tiver
 * falhado (instalação interrompida, cache limpo pelo sistema). Mesmo aí a
 * navegação nunca morre num erro do navegador — o texto é o mesmo da página.
 */
const SOCORRO = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sem conexão — Treino do Terraço</title></head>
<body style="font-family:system-ui;margin:0;display:grid;place-items:center;min-height:100vh;background:#0a0a0a;color:#fafafa">
<main style="text-align:center;padding:1.5rem"><h1>Sem conexão</h1>
<p>O treino continua: o que você registrar fica salvo no celular e sobe sozinho quando a rede voltar.</p>
</main></body></html>`;

/**
 * Preenchido logo depois de o Serwist existir. O plugin abaixo só roda dentro
 * de um `fetch`, muito depois da instalação, então nunca vê o valor inicial.
 */
let noPrecache: (url: string) => Promise<Response | undefined> = async () =>
  undefined;

/** A resposta de "não há rede e não há cache" para uma navegação. */
async function semRede(request: Request): Promise<Response> {
  if (ehRsc(pedidoDe(request))) {
    /*
     * Uma resposta que **não** é payload de RSC faz o roteador do Next desistir
     * da navegação suave e recarregar a URL (`doMpaNavigation`). Essa segunda
     * ida é um documento — e documento cai no ramo de baixo, com a `/~offline`.
     * Devolver aqui o HTML da `/~offline` levaria o roteador para a URL do
     * precache (com o `__WB_REVISION__` pendurado); assim o endereço continua
     * sendo o que o usuário pediu, e recarregar com rede mostra a tela.
     */
    return new Response(null, { status: 503, statusText: "sem rede" });
  }
  const guardada = await noPrecache(OFFLINE);
  return (
    guardada ??
    new Response(SOCORRO, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  );
}

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
  /*
   * As navegações, antes do `defaultCache`: rede primeiro (a tela tem de ser a
   * de agora), o cache depois e, se nem isso, a `/~offline`. É esta regra que
   * garante o fallback nos dois caminhos — documento e RSC —, em vez de depender
   * de qual das regras genéricas do Next pegou a requisição primeiro.
   */
  {
    matcher: ({ request, url, sameOrigin }) =>
      sameOrigin &&
      !url.pathname.startsWith("/api/") &&
      ehNavegacao(pedidoDe(request)),
    handler: new NetworkFirst({
      cacheName: "paginas",
      plugins: [
        {
          handlerDidError: async ({ request }) => semRede(request),
        },
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 }),
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
        url: OFFLINE,
        matcher({ request }) {
          return ehNavegacao(pedidoDe(request));
        },
      },
    ],
  },
});

noPrecache = (url) => serwist.matchPrecache(url);

serwist.addEventListeners();
