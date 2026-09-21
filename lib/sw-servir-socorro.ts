/**
 * Servir os assets da `/~offline` a partir do cache `socorro` (SPEC §22.11).
 *
 * Por que existe: na rodada 9 a autocura passou a guardar, junto com o HTML da
 * `/~offline`, os 14 pedaços de JS que ela carrega — e a guarda do degrau (c)
 * passou a conferir se eles estão no aparelho. A auditoria de 21/09 mostrou
 * que isso **não bastava**: a guarda perguntava "o pedaço está em algum
 * cache?" com `caches.match()` e a resposta era sim (ele é chave do cache
 * `socorro`), mas quem atende um pedido de `/_next/static/chunks/*.js` é uma
 * regra do `defaultCache` do Serwist, e cada estratégia só olha o **próprio**
 * cache (`next-static-js-assets`, `static-js-assets`, …). Nenhuma rota do
 * worker servia do `socorro`. Guardar ali fazia a guarda passar sem tornar os
 * pedaços servíveis: o pedido caía em `fetch`, a rede não existia, e a
 * hidratação morria em "Loading chunk 9954 failed" — a tela "Application
 * error", sem ícone e sem botões.
 *
 * O conserto liga as duas pontas: este é o **último degrau de um asset**. Toda
 * estratégia genérica ganha um `handlerDidError` que, antes de desistir, olha
 * o cache `socorro`. Aí a pergunta que a guarda faz ("está em algum cache?")
 * volta a ser a pergunta certa ("vai ser respondido?"), porque agora o
 * `socorro` responde de verdade.
 *
 * Mora fora de `app/sw.ts` pela mesma lição de `lib/sw-cura.ts` e
 * `lib/sw-assets.ts`: o service worker roda num mundo onde o Vitest não entra,
 * então a decisão fica aqui, com as ferramentas injetadas.
 */
import { CACHE_DE_SOCORRO } from "@/lib/caches-do-worker";

/**
 * Monta o degrau. Recebe o `CacheStorage` de fora para caber no teste de
 * unidade; no worker é o `caches` global.
 */
export function criarServirDoSocorro(armazenamento: CacheStorage) {
  /**
   * A cópia guardada deste asset, se houver. Nunca lança: um degrau que falha
   * é um degrau que não existe, e quem chama está no meio de um erro.
   *
   * `keys()` antes de `open()` porque `caches.match(url, { cacheName })`
   * rejeita quando o cache não existe — e num aparelho recém-despejado ele
   * ainda não existe.
   */
  return async function servirDoSocorro(
    url: string,
  ): Promise<Response | undefined> {
    try {
      const nomes = await armazenamento.keys();
      if (!nomes.includes(CACHE_DE_SOCORRO)) return undefined;
      const cache = await armazenamento.open(CACHE_DE_SOCORRO);
      // `ignoreSearch`: a chave foi gravada pelo caminho, o pedido do Next pode
      // trazer o `?dpl=` do deploy pendurado
      return (await cache.match(url, { ignoreSearch: true })) ?? undefined;
    } catch {
      return undefined;
    }
  };
}
