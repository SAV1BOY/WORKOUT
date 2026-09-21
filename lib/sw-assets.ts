/**
 * Os assets que a `/~offline` carrega, e a regra de "esta cópia serve?"
 * (SPEC §22.11).
 *
 * Por que existe: em 21/09/2026, com o Cache Storage inteiro apagado pelo
 * navegador (despejo por pressão de disco) e uma única navegação com rede, o
 * aparelho ficou assim — precache do Serwist de volta com **zero** entradas
 * (ele só enche no `install`, e o `sw.js` não muda de bytes fora de um
 * deploy), cache `socorro` com o HTML da `/~offline` reposto pela autocura, e
 * os 14 pedaços de JS dessa página em cache nenhum. O degrau (c) de `semRede()`
 * servia o HTML, a hidratação morria em "Loading chunk 9954 failed" e a tela
 * virava "Application error: a client-side exception has occurred": sem ícone,
 * sem botões, pior do que o socorro embutido — e assim até o deploy seguinte.
 *
 * Meia cópia é a tela quebrada. Então a mesma regra vale dos dois lados: a
 * autocura só guarda a `/~offline` se conseguir guardar junto todos os assets
 * que ela referencia, e o degrau (c) só serve a cópia se todos eles estiverem
 * em algum cache. Quando não dá, quem responde é o socorro embutido
 * (`lib/sw-socorro.ts`), que não depende de nada.
 *
 * Mora fora de `app/sw.ts` porque o service worker roda num mundo onde o
 * Vitest não entra (a mesma lição de `lib/sw-navegacao.ts` e `lib/sw-cura.ts`).
 */

/**
 * Teto de assets de uma cópia. Uma página do Next carrega ~14 pedaços; 30 dá
 * folga para o app crescer sem transformar a autocura num download. Acima
 * disso a cópia não vale — nem para guardar, nem para servir: é a mesma regra
 * nos dois lados, para nunca existir cópia pela metade.
 */
export const MAXIMO_DE_ASSETS = 30;

/** `<script src=…>` e `<link rel=stylesheet href=…>`, com os atributos em qualquer ordem. */
const TAGS = /<(script|link)\b([^>]*)>/gi;

function atributo(atributos: string, nome: string): string | null {
  const achado = new RegExp(
    `\\b${nome}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i",
  ).exec(atributos);
  if (!achado) return null;
  return achado[1] ?? achado[2] ?? achado[3] ?? null;
}

/**
 * O caminho same-origin de um `src`/`href`, ou `null` se for de fora.
 *
 * Devolve caminho (`/_next/…`), e não URL inteira, porque é assim que
 * `caches.match()` e `cache.put()` guardam a chave quando o worker pede pelo
 * caminho — e é o que o degrau (c) vai procurar.
 */
function caminhoLocal(valor: string, origem: string): string | null {
  const bruto = valor.trim();
  if (bruto === "" || bruto.startsWith("data:") || bruto.startsWith("#")) return null;
  try {
    const url = new URL(bruto, origem);
    if (url.origin !== new URL(origem).origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/**
 * Os assets same-origin que um HTML carrega, na ordem em que aparecem e sem
 * repetição. Script sem `src` (o `self.__next_f` que o Next embute) e folha de
 * outro domínio ficam de fora: o primeiro já vem no HTML, a segunda não é
 * nossa para guardar.
 */
export function urlsDeAssets(html: string, origem: string): string[] {
  const urls: string[] = [];
  for (const achado of html.matchAll(TAGS)) {
    const tag = (achado[1] ?? "").toLowerCase();
    const atributos = achado[2] ?? "";
    let valor: string | null = null;
    if (tag === "script") {
      valor = atributo(atributos, "src");
    } else {
      const rel = atributo(atributos, "rel");
      if (rel && rel.toLowerCase().split(/\s+/).includes("stylesheet")) {
        valor = atributo(atributos, "href");
      }
    }
    if (!valor) continue;
    const caminho = caminhoLocal(valor, origem);
    if (caminho && !urls.includes(caminho)) urls.push(caminho);
  }
  return urls;
}

/**
 * A cópia guardada da `/~offline` serve? Só quando **todos** os assets que ela
 * referencia estão em algum cache do aparelho — e quando não são assets demais
 * (`MAXIMO_DE_ASSETS`), que é o mesmo limite que a autocura respeita ao
 * guardar. Página sem asset nenhum serve: é o caso do HTML de socorro e o de
 * uma `/~offline` totalmente estática.
 */
export function copiaServe(
  urls: readonly string[],
  emCache: ReadonlySet<string>,
): boolean {
  if (urls.length > MAXIMO_DE_ASSETS) return false;
  return urls.every((url) => emCache.has(url));
}
