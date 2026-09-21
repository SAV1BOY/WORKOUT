/**
 * O HTML de socorro do service worker (SPEC §22.10).
 *
 * É o último degrau da escada de `semRede()` em `app/sw.ts`: a tela que o
 * worker desenha sozinho quando não há rede **e** não há nenhuma cópia da
 * `/~offline` no aparelho. Até 21/09/2026 ele era um beco — título, frase e
 * mais nada —, e foi exatamente isso que o dono fotografou no celular: o
 * "Sair" apaga todos os caches menos o de mídia (`lib/db.ts`), inclusive o
 * precache, e o Serwist só o repõe na instalação seguinte. Quem cai aqui cai
 * de verdade, então a tela precisa ter os **mesmos dois atos** da página:
 * tentar de novo e ir para o Treino.
 *
 * Mora fora de `app/sw.ts` para ter teste de unidade (`lib/sw-socorro.test.ts`):
 * o service worker roda num mundo onde o Vitest não entra.
 *
 * Regras que o teste prende:
 *  - nada vem de fora (nem script, nem fonte, nem folha de estilo): é o único
 *    HTML que tem de funcionar com o aparelho vazio;
 *  - os dois alvos têm 48 px de altura (SPEC §11: mínimo 44) e largura cheia,
 *    e cada um leva a sua classe: `:first-of-type`/`:last-of-type` NÃO servem
 *    aqui, porque um é `<button>` e o outro é `<a>` — cada um é o primeiro e o
 *    último do seu próprio tipo, e as duas regras casavam com os dois;
 *  - os dois temas saem dos tokens de `app/globals.css` — claro
 *    `rgb(224,224,221)` sobre `rgb(10,10,10)`, escuro o inverso;
 *  - `viewport-fit=cover` + `env(safe-area-inset-*)`: no celular com entalhe o
 *    texto não fica debaixo da barra do sistema.
 */

/** O título da aba e o `h1` — o mesmo da `app/~offline/page.tsx`. */
export const TITULO = "Sem conexão";

/** A frase que explica que nada se perde — a mesma da `/~offline`. */
export const FRASE =
  "O treino continua: o que você registrar fica salvo no celular e sobe sozinho quando a rede voltar.";

/** Recarregar a mesma URL: a rede pode ter voltado no meio do caminho. */
export const TENTAR = "Tentar de novo";

/** A aba Treino funciona offline com o que está no aparelho (SPEC §8). */
export const IR_PARA_O_TREINO = "Ir para o Treino";

const ESTILO = `:root{color-scheme:light dark;--fundo:rgb(224,224,221);--texto:rgb(10,10,10);--fraco:#5c5c5a;--destaque:#a03608;--sobre:#fff;--linha:#c8c8c4}
@media(prefers-color-scheme:dark){:root{--fundo:rgb(10,10,10);--texto:rgb(245,245,244);--fraco:#a1a1a0;--destaque:#fb923c;--sobre:rgb(10,10,10);--linha:#424242}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:var(--fundo);color:var(--texto);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.5;padding:calc(24px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))}
main{width:100%;max-width:26rem;text-align:center}
.marca{display:flex;align-items:center;justify-content:center;width:64px;height:64px;margin:0 auto 16px;border-radius:50%;background:color-mix(in srgb,var(--texto) 10%,transparent);color:var(--fraco)}
h1{margin:0 0 8px;font-size:1.5rem;font-weight:600}
p{margin:0 0 24px;color:var(--fraco);text-wrap:balance}
.ato{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin-top:8px;padding:0 16px;border-radius:16px;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.primeiro{border:0;background:var(--destaque);color:var(--sobre)}
.segundo{border:1px solid var(--linha);background:transparent;color:var(--texto);font-weight:400}`;

const MARCA = `<svg class="marca" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 20h.01"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.7"/><path d="M19 12.9a10 10 0 0 0-2-1.5"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M22 8.8a15 15 0 0 0-11.3-3.8"/><path d="m2 2 20 20"/></svg>`;

/**
 * O documento inteiro, numa string. Função pura: sem `self`, sem `caches`,
 * sem rede — dá para conferir no Vitest e dá para servir com o aparelho vazio.
 */
export function htmlDeSocorro(): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITULO} — Treino do Terraço</title>
<style>${ESTILO}</style></head>
<body><main>${MARCA}
<h1>${TITULO}</h1>
<p>${FRASE}</p>
<button type="button" class="ato primeiro" onclick="location.reload()">${TENTAR}</button>
<a class="ato segundo" href="/">${IR_PARA_O_TREINO}</a>
</main></body></html>`;
}
