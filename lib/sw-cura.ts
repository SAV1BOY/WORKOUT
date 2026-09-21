/**
 * A cópia própria da `/~offline` — a autocura do service worker (SPEC §22.10).
 *
 * Por que existe: o degrau (b) da escada de `semRede()` é o precache do
 * Serwist, e o precache não é eterno. O navegador despeja Cache Storage
 * quando o disco aperta, uma instalação pode terminar pela metade, e até
 * 21/09/2026 o próprio "Sair" do app apagava o precache inteiro. Quando isso
 * acontece, `matchPrecache("/~offline")` devolve `undefined` e toda navegação
 * sem rede cai no HTML embutido — foi o que o dono fotografou.
 *
 * O remédio é o worker ter uma cópia **sua** da página, num cache com nome
 * próprio (`socorro`) que o logout poupa (`lib/caches-do-worker.ts`) e que o
 * degrau (c) encontra junto com as outras. A cópia nasce na ativação, tirada
 * do precache que o `install` acabou de encher — sem rede, em milissegundos —
 * e é reposta depois de qualquer navegação que tenha chegado ao servidor.
 *
 * Por que **aqui** e não dentro de `app/sw.ts`: a auditoria de 21/09 mostrou
 * que a primeira versão desta função era inalcançável (só rodava no
 * `activate`, onde o precache sempre está inteiro, e voltava sem fazer nada) e
 * que três portões verdes não pegaram, porque o service worker roda num mundo
 * onde o Vitest não entra. Com as ferramentas injetadas, a decisão inteira
 * cabe num teste de unidade (`lib/sw-cura.test.ts`).
 */
import { CACHE_DE_SOCORRO, OFFLINE } from "@/lib/caches-do-worker";

/** O que a tentativa fez — o teste prende cada um destes caminhos. */
export type ResultadoDaCura =
  /** a cópia própria já estava lá e continua valendo */
  | "ja-tinha"
  /** veio do precache, sem tocar na rede: o caminho normal da ativação */
  | "copiou-do-precache"
  /** o precache não tinha: veio da rede */
  | "baixou"
  /** não havia de onde tirar (sem precache e sem rede) */
  | "sem-fonte"
  /** a última ida à rede falhou há pouco: não insiste a cada navegação */
  | "esperando";

/** O mundo de fora, injetado para caber no Vitest. */
export type FerramentasDaCura = {
  /** `serwist.matchPrecache` */
  doPrecache: (url: string) => Promise<Response | undefined>;
  /** `caches` */
  armazenamento: CacheStorage;
  /** `fetch` */
  buscar: (url: string, init: RequestInit) => Promise<Response>;
  /** `Date.now` */
  agora: () => number;
};

export type OpcoesDaCura = {
  /** quanto tempo a ida à rede pode demorar */
  prazoMs?: number;
  /**
   * Refaz a cópia mesmo que já exista. É o que a ativação quer: o precache
   * acabou de ser trocado pelo deploy novo, e a cópia velha é de outro build.
   */
  renovar?: boolean;
};

/** Depois de uma ida à rede frustrada, espera isto antes de tentar de novo. */
export const ESPERA_ENTRE_IDAS = 60_000;

/** Prazo padrão da ida à rede: é um HTML pequeno, não um download. */
export const PRAZO_PADRAO = 5_000;

/**
 * Monta a autocura com as ferramentas de fora. Guarda dois estados entre as
 * chamadas: a ida em voo (duas navegações ao mesmo tempo não baixam a página
 * duas vezes) e a hora da próxima ida à rede.
 */
export function criarCura(ferramentas: FerramentasDaCura) {
  let proximaIda = 0;
  let emVoo: Promise<ResultadoDaCura> | null = null;

  /** Já existe uma cópia própria? Só olha caches, nunca a rede. */
  async function jaTem(): Promise<boolean> {
    const nomes = await ferramentas.armazenamento.keys();
    // `caches.match(url, { cacheName })` rejeita se o cache não existe: perguntar antes
    if (!nomes.includes(CACHE_DE_SOCORRO)) return false;
    const cache = await ferramentas.armazenamento.open(CACHE_DE_SOCORRO);
    return Boolean(await cache.match(OFFLINE));
  }

  async function guardar(resposta: Response): Promise<void> {
    const cache = await ferramentas.armazenamento.open(CACHE_DE_SOCORRO);
    await cache.put(OFFLINE, resposta);
  }

  async function umaTentativa(
    prazoMs: number,
    renovar: boolean,
  ): Promise<ResultadoDaCura> {
    try {
      if (!renovar && (await jaTem())) return "ja-tinha";

      const doPrecache = await ferramentas.doPrecache(OFFLINE);
      if (doPrecache) {
        await guardar(doPrecache);
        return "copiou-do-precache";
      }
      // renovar com o precache vazio: a cópia velha é melhor do que nenhuma
      if (renovar && (await jaTem())) return "ja-tinha";

      if (ferramentas.agora() < proximaIda) return "esperando";
      proximaIda = ferramentas.agora() + ESPERA_ENTRE_IDAS;

      const resposta = await ferramentas.buscar(OFFLINE, {
        cache: "no-store",
        credentials: "include",
        signal: AbortSignal.timeout(prazoMs),
      });
      /*
       * `redirected`: a `/~offline` é pública (`lib/supabase/middleware.ts`),
       * mas um proxy de WiFi de hotel devolve a sua própria tela com 200 —
       * guardar isso como "sem conexão" seria pior do que não guardar nada.
       */
      if (!resposta.ok || resposta.redirected) return "sem-fonte";
      await guardar(resposta);
      return "baixou";
    } catch {
      // sem rede, sem Cache Storage, resposta opaca: o socorro embutido cobre
      return "sem-fonte";
    }
  }

  return async function garantirOSocorro(
    opcoes: OpcoesDaCura = {},
  ): Promise<ResultadoDaCura> {
    if (emVoo) return emVoo;
    const corrida = umaTentativa(
      opcoes.prazoMs ?? PRAZO_PADRAO,
      opcoes.renovar ?? false,
    );
    emVoo = corrida;
    // `umaTentativa` nunca rejeita: o `finally` só solta a vaga
    void corrida.finally(() => {
      if (emVoo === corrida) emVoo = null;
    });
    return corrida;
  };
}
