/**
 * Os caches que o app mantém no aparelho, e a regra de quais deles o "Sair"
 * poupa (SPEC §8 com §22.10).
 *
 * Mora sozinho e sem nenhuma importação porque os dois lados precisam dele: a
 * página (`lib/db.ts`, no logout) e o service worker (`app/sw.ts`), que é um
 * bundle à parte — puxar o `lib/db.ts` para dentro do worker levaria o Dexie
 * junto.
 */

/** A página que o aparelho mostra quando não há rede (SPEC §8). */
export const OFFLINE = "/~offline";

/**
 * As figuras, as fotos e as ilustrações dos exercícios: conteúdo público do
 * app, caro de baixar de novo num celular.
 */
export const CACHE_DE_MIDIA = "midia-do-treino";

/**
 * A cópia própria da `/~offline` que o worker mantém (SPEC §22.10, `lib/sw-cura.ts`).
 * É a rede de segurança do degrau (c) quando o precache não está mais inteiro.
 */
export const CACHE_DE_SOCORRO = "socorro";

/**
 * O precache do Serwist. O nome completo leva a versão e o escopo
 * (`serwist-precache-v2-https://treino-terraco.vercel.app/`), então a regra
 * tem de ser por prefixo.
 */
export const PREFIXO_DO_PRECACHE = "serwist-precache";

/**
 * Os caches que o "Sair" poupa: o que é do **app**, nunca o que é do usuário.
 *
 * Em 21/09/2026 o dono fotografou no celular o socorro embutido do worker — a
 * tela sem ícone e sem botões —, e a causa estava aqui: o "Sair" apagava
 * **todos** os caches, inclusive o precache. O precache é o app assado no
 * build (o shell, os pedaços de JS, a `/~offline`), sem um byte de ninguém;
 * apagá-lo deixava o aparelho sem PWA até o deploy seguinte, porque o Serwist
 * só repõe o precache numa instalação nova — e o `sw.js` só é reinstalado
 * quando muda de bytes. Quem saísse da conta não abria mais o app offline.
 *
 * O que é do usuário continua indo embora no logout, que é o ponto da §8: o
 * cache "paginas" (as telas autenticadas que ele visitou), o cache de leitura
 * do TanStack, as fotos e a sessão em andamento no IndexedDB.
 */
export function ehCachePublico(nome: string): boolean {
  return (
    nome === CACHE_DE_MIDIA ||
    nome === CACHE_DE_SOCORRO ||
    nome.startsWith(PREFIXO_DO_PRECACHE)
  );
}
