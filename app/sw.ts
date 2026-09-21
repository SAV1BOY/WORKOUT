import { defaultCache } from "@serwist/next/worker";
import { CACHE_DE_MIDIA, OFFLINE } from "@/lib/caches-do-worker";
import { criarCura } from "@/lib/sw-cura";
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

/**
 * Prazo da ida à rede numa navegação. Rede que aceita a conexão e não responde
 * (WiFi de elevador, portal de hotel) segurava a tela sem fim: passado isto, a
 * `NetworkFirst` serve a cópia guardada, e a escada de `semRede()` entra
 * quando não há cópia nenhuma.
 */
const PRAZO_DA_REDE_S = 8;

/** Prazo da retentativa do degrau (a): o usuário está olhando para a tela. */
const PRAZO_DA_RETENTATIVA_MS = 6_000;

/**
 * Prazo da cura na **ativação**: o `waitUntil` do `activate` segura os `fetch`
 * das páginas, então esta ida tem de ser curta. No caminho normal ela nem
 * acontece — a cópia sai do precache que o `install` acabou de encher.
 */
const PRAZO_DA_CURA_NA_ATIVACAO_MS = 3_000;

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
 * Preenchido logo depois de o Serwist existir. Os usos abaixo só acontecem
 * dentro de um `fetch` ou de um `activate`, muito depois da avaliação do
 * módulo, então nunca veem o valor inicial.
 */
let noPrecache: (url: string) => Promise<Response | undefined> = async () =>
  undefined;

/**
 * A autocura (SPEC §22.10), montada com as ferramentas de verdade. A decisão
 * mora em `lib/sw-cura.ts`, com teste de unidade; aqui só se liga o mundo.
 *
 * `fetch` é chamado pelo nome, e não guardado numa variável: assim o e2e, que
 * troca o `self.fetch` do worker por uma função que rejeita, alcança também
 * esta ida à rede.
 */
const garantirOSocorro = criarCura({
  doPrecache: (url) => noPrecache(url),
  armazenamento: caches,
  buscar: (url, init) => fetch(url, init),
  agora: () => Date.now(),
});

/**
 * Degrau (a) da escada: mais uma ida à rede antes de desistir (SPEC §22.10).
 * A queda de rede de um celular dura segundos — o elevador, o túnel, o WiFi
 * trocando de ponto — e a `NetworkFirst` desistiu na primeira recusa. O pedido
 * é novo porque o original já foi consumido pela estratégia: mesma URL, com os
 * cookies da sessão (`credentials`), sem o cache do navegador no meio
 * (`no-store`), sem seguir desvio por conta própria (`manual`) — o 307 do
 * middleware para `/login` tem de chegar ao navegador como desvio, e não
 * virar um documento de login servido na URL que o usuário pediu — e com hora
 * para acabar: quem está olhando para a tela prefere a `/~offline` que já está
 * no aparelho a uma espera sem fim.
 */
async function maisUmaTentativa(url: string): Promise<Response | undefined> {
  // chegou resposta, qualquer resposta: a rede voltou, e ela é mais verdadeira
  // do que qualquer cópia guardada
  return fetch(
    new Request(url, {
      credentials: "include",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(PRAZO_DA_RETENTATIVA_MS),
    }),
  );
}

/**
 * Degrau (c): qualquer cópia da `/~offline` em qualquer cache do aparelho. A
 * regra "paginas" guarda a página quando ela foi visitada, e a autocura guarda
 * a dela em `socorro`; `ignoreSearch` alcança a chave do precache, que carrega
 * o `__WB_REVISION__` pendurado.
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
      // sem rede, cache limpo pelo sistema, precache despejado pelo navegador:
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

const regras: RuntimeCaching[] = [
  {
    matcher: ({ url }) => SUPABASE.test(url.pathname),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && MIDIA.test(url.pathname),
    handler: new CacheFirst({
      // o "Sair" poupa este cache (`lib/caches-do-worker.ts`)
      cacheName: CACHE_DE_MIDIA,
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
      networkTimeoutSeconds: PRAZO_DA_REDE_S,
      plugins: [
        {
          handlerDidError: async ({ request }) => semRede(request),
          /*
           * Depois de responder — o `handlerDidComplete` roda fora do caminho
           * crítico, com a tela já entregue —, o worker confere se ainda tem a
           * sua cópia da `/~offline` e a repõe se faltar. É aqui que a autocura
           * alcança o aparelho de verdade: o `activate` só acontece quando o
           * `sw.js` muda de bytes, e o precache pode sumir (despejo do
           * navegador) muito antes do próximo deploy.
           */
          handlerDidComplete: async ({ response }) => {
            if (response) await garantirOSocorro();
          },
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
 *
 * `renovar`: o precache aqui é o do build que acabou de instalar, e a cópia
 * guardada é a do build anterior. Tirar a nova do precache não custa rede.
 */
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    garantirOSocorro({
      renovar: true,
      prazoMs: PRAZO_DA_CURA_NA_ATIVACAO_MS,
    }),
  );
});
