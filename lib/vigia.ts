/**
 * O vigia da hidratação: a última saída de uma tela morta.
 *
 * O app inteiro depende de o React hidratar — é ele que lê o Dexie, dispara as
 * consultas e troca o esqueleto pelo conteúdo. Quando a hidratação NÃO
 * acontece (o caso clássico é o service worker assumir o controle no meio de
 * uma navegação e servir um pedaço do build anterior: os arquivos respondem
 * 200, o console fica vazio e a página simplesmente nunca vira interativa), o
 * usuário fica olhando o esqueleto para sempre, sem erro e sem botão nenhum.
 * Nenhum `useEffect` salva essa tela, porque nenhum efeito chega a rodar.
 *
 * Por isso este vigia é JavaScript puro, injetado inline no `layout` e
 * disparado no parse da página: se `VIGIA_MS` passarem sem o React ter dado
 * sinal de vida (`marcarAppVivo`), ele desenha à mão uma faixa com um botão de
 * 44 px — "Recarregar" — e devolve o controle ao dono. Se o React acordar
 * depois, `marcarAppVivo` tira a faixa.
 *
 * Não recarrega sozinho de propósito: o app não recarrega o que o dono não
 * pediu (o mesmo motivo de `reloadOnOnline: false` em `next.config.ts`).
 */

/** Quanto tempo sem hidratar até oferecer a saída. */
export const VIGIA_MS = 12_000;

/** O id da faixa, para o React tirá-la quando acordar. */
export const ID_DO_VIGIA = "vigia-hidratacao";

/** A marca que o React deixa no `window` quando hidrata. */
export const MARCA_DE_VIDA = "__appVivo";

/** O script inline do `layout` — sem React, sem import, sem módulo. */
export function scriptDoVigia(ms: number = VIGIA_MS): string {
  return `(function(){var m=${ms};setTimeout(function(){
if(window.${MARCA_DE_VIDA}===true||document.getElementById("${ID_DO_VIGIA}"))return;
var c=document.createElement("div");c.id="${ID_DO_VIGIA}";c.setAttribute("role","alert");
c.style.cssText="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;align-items:center;gap:12px;padding:12px 16px;background:#171717;color:#fafafa;font:14px/1.3 system-ui,sans-serif";
var t=document.createElement("span");t.style.cssText="flex:1";t.textContent="O app não terminou de abrir.";
var b=document.createElement("button");b.type="button";b.textContent="Recarregar";
b.style.cssText="min-height:44px;min-width:44px;padding:0 16px;border:0;border-radius:10px;background:#f97316;color:#0a0a0a;font:600 14px system-ui,sans-serif";
b.addEventListener("click",function(){location.reload()});
c.appendChild(t);c.appendChild(b);(document.body||document.documentElement).appendChild(c);
},m)})();`;
}

/** O React acordou: marca a vida e tira a faixa, se ela já estiver na tela. */
export function marcarAppVivo(): void {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>)[MARCA_DE_VIDA] = true;
  document.getElementById(ID_DO_VIGIA)?.remove();
}
