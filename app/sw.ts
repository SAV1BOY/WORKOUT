import { defaultCache } from "@serwist/next/worker";
import {
  CACHE_DE_MIDIA,
  CACHE_DE_SOCORRO,
  OFFLINE,
} from "@/lib/caches-do-worker";
import { copiaServe, urlsDeAssets } from "@/lib/sw-assets";
import { criarCura } from "@/lib/sw-cura";
import {
  ehNavegacao,
  ehRsc,
  type PedidoDeNavegacao,
} from "@/lib/sw-navegacao";
import { opcoesDaNotificacao, urlInterna } from "@/lib/lembretes";
import { criarServirDoSocorro } from "@/lib/sw-servir-socorro";
import { htmlDeSocorro } from "@/lib/sw-socorro";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  type RuntimeCaching,
  type SerwistPlugin,
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
  origem: self.location.origin,
});

/**
 * O último degrau de um **asset** (SPEC §22.11, `lib/sw-servir-socorro.ts`).
 * A cópia que a autocura guardou no cache `socorro` só vale se alguma rota a
 * servir: sem isto, os 14 pedaços de JS da `/~offline` estão no aparelho e
 * mesmo assim o pedido morre em `fetch`, que é o que a auditoria de 21/09
 * fotografou como "Application error".
 */
const servirDoSocorro = criarServirDoSocorro(caches);

/**
 * Pendurado em **todas** as estratégias genéricas do `defaultCache`: antes de
 * devolver o erro, o worker olha a sua cópia de socorro. Só responde quando a
 * URL é chave desse cache — o que só acontece com o HTML da `/~offline` e os
 * assets dela —, então nenhum outro pedido muda de comportamento.
 *
 * O `fallbacks` do Serwist pendura o dele nas regras que ainda não têm
 * `handlerDidError` (`Serwist.ts` l.241); pendurar o nosso primeiro o desloca,
 * e isso é de propósito: quem responde a navegação sem rede é a regra
 * "paginas", que vem antes do `defaultCache` e tem a escada inteira da §22.10.
 * Nenhuma navegação chega às regras genéricas.
 */
const socorroDeAssets: SerwistPlugin = {
  handlerDidError: ({ request }) => servirDoSocorro(request.url),
};

/**
 * Pendurar é por **forma**, não por `instanceof`: o `defaultCache` vem de
 * `@serwist/next`, que traz a sua própria cópia do `serwist`, e uma estratégia
 * construída lá não é `instanceof` a classe importada aqui. Foi exatamente
 * assim que o conserto nasceu sem efeito na primeira tentativa: o laço não
 * pendurava nada e o pedaço continuava morrendo em `fetch`. O que interessa é
 * a lista `plugins`, que é o contrato que o `Strategy.handle()` percorre.
 */
function aceitaPlugin(handler: unknown): handler is { plugins: SerwistPlugin[] } {
  return (
    typeof handler === "object" &&
    handler !== null &&
    Array.isArray((handler as { plugins?: unknown }).plugins)
  );
}

let comSocorro = 0;
for (const regra of defaultCache) {
  if (aceitaPlugin(regra.handler)) {
    regra.handler.plugins.push(socorroDeAssets);
    comSocorro += 1;
  }
}

/**
 * Quantas estratégias ganharam o degrau. Zero quer dizer que o conserto não
 * foi pendurado em lugar nenhum — o e2e do aparelho despejado confere isto
 * antes de olhar a tela, para que a próxima troca de versão do Serwist não
 * volte a tirar o socorro em silêncio.
 */
function anunciarOSocorro(quantas: number): void {
  (self as unknown as { __regrasComSocorro?: number }).__regrasComSocorro =
    quantas;
}

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
 * Degrau (c): qualquer cópia da `/~offline` em qualquer cache do aparelho, **se
 * ela estiver inteira**. A regra "paginas" guarda a página quando ela foi
 * visitada, e a autocura guarda a dela em `socorro`; `ignoreSearch` alcança a
 * chave do precache, que carrega o `__WB_REVISION__` pendurado.
 *
 * A guarda é a lição do aparelho despejado (SPEC §22.11): com o Cache Storage
 * apagado pelo navegador, o precache volta vazio e sobra um HTML cujos 14
 * pedaços de JS não estão em lugar nenhum. Servi-lo dava "Application error"
 * na hidratação — sem ícone e sem botões, pior do que o degrau (d). Então só
 * serve a cópia quando todos os assets que ela referencia estão em algum
 * cache; senão desce para o socorro embutido, que não depende de nada.
 */
async function copiaInteira(guardada: Response): Promise<boolean> {
  const urls = urlsDeAssets(await guardada.clone().text(), self.location.origin);
  const presentes = new Set<string>();
  await Promise.all(
    urls.map(async (url) => {
      if (await caches.match(url, { ignoreSearch: true })) presentes.add(url);
    }),
  );
  return copiaServe(urls, presentes);
}

async function emQualquerCache(): Promise<Response | undefined> {
  const nomes = await caches.keys();
  /*
   * A cópia da autocura primeiro. `caches.match()` devolveria a primeira na
   * ordem de criação dos caches — em geral a do precache, que num aparelho
   * despejado é justamente a que perdeu os pedaços. Perguntar cache a cache
   * deixa o worker servir a **melhor** cópia que tem, e não a primeira: a
   * cópia inteira do `socorro` deixa de ser desperdiçada por causa de uma
   * cópia quebrada guardada antes dela.
   */
  const ordem = [
    ...nomes.filter((nome) => nome === CACHE_DE_SOCORRO),
    ...nomes.filter((nome) => nome !== CACHE_DE_SOCORRO),
  ];
  for (const nome of ordem) {
    const cache = await caches.open(nome);
    const guardada = await cache.match(OFFLINE, {
      ignoreSearch: true,
      ignoreVary: true,
    });
    if (guardada && (await copiaInteira(guardada))) return guardada;
  }
  return undefined;
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

/*
 * E na rota do **precache**, que é a primeira de todas. Sem isto o conserto
 * não alcançava o pedaço que quebrava: `/_next/static/chunks/app/~offline/…`
 * está no manifesto do build, então quem atende o pedido é a `PrecacheStrategy`
 * — e nenhuma regra do `defaultCache` chega a ser consultada. Num aparelho
 * despejado o cache do precache voltou vazio, a estratégia ia à rede, a rede
 * não existia, e o erro subia direto para a hidratação. Agora ela também
 * desce para a cópia do `socorro` antes de desistir.
 */
serwist.precacheStrategy.plugins.push(socorroDeAssets);
anunciarOSocorro(comSocorro + 1);

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

/*
 * Lembretes (SPEC §23.3). A decisão — título, corpo, ícone, tag, url — mora em
 * `lib/lembretes.ts`, com teste de unidade; aqui só se liga o mundo.
 *
 * `esperar` e não `evento.waitUntil` direto: num evento sintético (o e2e
 * dispara `new PushEvent("push")` dentro do worker) o `waitUntil` lança
 * `InvalidStateError` porque `isTrusted` é falso — e o aviso tem de aparecer
 * do mesmo jeito. Num push de verdade o `waitUntil` segura o worker vivo até a
 * notificação estar na tela.
 */
function esperar(evento: ExtendableEvent, trabalho: Promise<unknown>): void {
  try {
    evento.waitUntil(trabalho);
  } catch {
    void trabalho;
  }
}

self.addEventListener("push", (evento) => {
  const { titulo, opcoes } = opcoesDaNotificacao(evento.data?.text() ?? "");
  esperar(evento, self.registration.showNotification(titulo, opcoes));
});

/**
 * O toque na notificação: uma aba do app já aberta vai para a `url` (e ganha
 * foco quando o navegador deixa); sem aba aberta, abre uma nova.
 */
async function abrirNoLugarCerto(url: string): Promise<void> {
  const destino = new URL(urlInterna(url), self.location.origin).href;
  const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const aba = abas.find((c) => new URL(c.url).origin === self.location.origin);
  if (aba) {
    try {
      await aba.focus();
    } catch {
      // foco sem gesto do usuário é recusado (evento sintético); navegar basta
    }
    if ("navigate" in aba) {
      try {
        await aba.navigate(destino);
        return;
      } catch {
        // aba que o worker não controla: cai para uma aba nova
      }
    }
  }
  await self.clients.openWindow(destino);
}

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const dados = evento.notification.data as { url?: unknown } | null;
  esperar(evento, abrirNoLugarCerto(urlInterna(dados?.url)));
});
