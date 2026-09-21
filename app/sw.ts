import { defaultCache } from "@serwist/next/worker";
import {
  ehNavegacao,
  ehRsc,
  type PedidoDeNavegacao,
} from "@/lib/sw-navegacao";
import { htmlDeSocorro } from "@/lib/sw-socorro";
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
 * O cache próprio da autocura (SPEC §22.10): uma cópia da `/~offline` que o
 * worker guarda quando descobre que o precache já não a tem. Fica fora dos
 * caches do Serwist de propósito — quem o preenche é o `activate` daqui, e o
 * degrau (c) da escada o consulta junto com todos os outros.
 */
const CACHE_DE_SOCORRO = "socorro";

/**
 * Preenchido logo depois de o Serwist existir. O plugin abaixo só roda dentro
 * de um `fetch`, muito depois da instalação, então nunca vê o valor inicial.
 */
let noPrecache: (url: string) => Promise<Response | undefined> = async () =>
  undefined;

/**
 * Degrau (a) da escada: mais uma ida à rede antes de desistir (SPEC §22.10).
 * A queda de rede de um celular dura segundos — o elevador, o túnel, o WiFi
 * trocando de ponto — e a `NetworkFirst` desistiu na primeira recusa. O pedido
 * é novo porque o original já foi consumido pela estratégia: mesma URL, com os
 * cookies da sessão (`credentials`), sem o cache do navegador no meio
 * (`no-store`) e sem seguir desvio por conta própria (`manual`) — o 307 do
 * middleware para `/login` tem de chegar ao navegador como desvio, e não
 * virar um documento de login servido na URL que o usuário pediu.
 */
async function maisUmaTentativa(url: string): Promise<Response | undefined> {
  // chegou resposta, qualquer resposta: a rede voltou, e ela é mais verdadeira
  // do que qualquer cópia guardada
  return fetch(
    new Request(url, {
      credentials: "include",
      redirect: "manual",
      cache: "no-store",
    }),
  );
}

/**
 * Degrau (c): qualquer cópia da `/~offline` em qualquer cache do aparelho. A
 * regra "paginas" guarda a página quando ela foi visitada, e a autocura abaixo
 * guarda a dela em `socorro`; `ignoreSearch` alcança a chave do precache, que
 * carrega o `__WB_REVISION__` pendurado.
 */
async function emQualquerCache(): Promise<Response | undefined> {
  return caches.match(OFFLINE, { ignoreSearch: true, ignoreVary: true });
}

/**
 * A resposta de "não há rede e não há cache" para uma navegação: a escada da
 * SPEC §22.10, do mais verdadeiro ao mais garantido. Nenhum degrau derruba a
 * navegação — degrau que falha é degrau que não existe, e o último sempre
 * responde.
 */
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

  const escada = [
    () => maisUmaTentativa(request.url),
    () => noPrecache(OFFLINE),
    () => emQualquerCache(),
  ];
  for (const degrau of escada) {
    try {
      const resposta = await degrau();
      if (resposta) return resposta;
    } catch {
      // sem rede, cache limpo pelo sistema, precache que o "Sair" apagou:
      // desce para o próximo degrau
    }
  }

  /*
   * Degrau (d): o socorro embutido (`lib/sw-socorro.ts`). Não é mais um beco —
   * tem os dois mesmos atos da `/~offline` e não busca nada de fora, que é o
   * que se exige de uma tela para o aparelho vazio.
   */
  return new Response(htmlDeSocorro(), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Autocura do precache (SPEC §22.10). O "Sair" apaga todos os caches menos os
 * públicos (`lib/db.ts`), e o Serwist só repõe o precache na instalação
 * seguinte: dali até a próxima atualização do app, `matchPrecache("/~offline")`
 * devolve `undefined` e toda navegação sem rede cairia no socorro embutido.
 * Então, a cada ativação, o worker confere — e, se faltar, busca a página e
 * guarda uma cópia sua. Idempotente (mesma chave, mesmo cache) e silencioso
 * quando falha: sem rede no `activate` não há o que fazer, e a ativação
 * seguinte tenta de novo.
 */
async function curarOSocorro(): Promise<void> {
  try {
    if (await noPrecache(OFFLINE)) return;
    const resposta = await fetch(OFFLINE, {
      cache: "no-store",
      credentials: "include",
      // o `activate` segura os `fetch` da página enquanto não termina: esta
      // ida tem hora para acabar
      signal: AbortSignal.timeout(8_000),
    });
    // `redirected`: sem sessão o middleware manda para `/login`, e guardar a
    // tela de login como "sem conexão" seria pior do que não guardar nada
    if (!resposta.ok || resposta.redirected) return;
    const cache = await caches.open(CACHE_DE_SOCORRO);
    await cache.put(OFFLINE, resposta);
  } catch {
    // sem rede, sem Cache Storage, resposta opaca: o socorro embutido cobre
  }
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

/*
 * Depois do `addEventListeners`: são dois ouvintes de `activate` no mesmo
 * worker (o do Serwist e este), e cada um estende a ativação com o seu
 * `waitUntil` — um não atrapalha o outro.
 */
self.addEventListener("activate", (evento) => {
  evento.waitUntil(curarOSocorro());
});
