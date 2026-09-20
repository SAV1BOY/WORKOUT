/**
 * Quais requisições ganham a página `/~offline` quando não há rede (SPEC §8 e
 * §22.1). Mora aqui, fora de `app/sw.ts`, por um motivo só: é a regra que
 * estava errada, e regra errada se prende com teste — o service worker roda
 * num mundo sem DOM e sem Vitest.
 *
 * Uma navegação do App Router tem DUAS formas:
 *
 * - o **documento**, que é o que o navegador pede ao abrir a URL na mão;
 * - o **fetch de RSC** (`RSC: 1`, `?_rsc=…`), que é como o roteador troca de
 *   tela depois que o app já está aberto.
 *
 * O fallback antigo só olhava `destination === "document"`: sem rede, a troca
 * de tela morria no fetch de RSC antes de virar navegação, e `/mais/contas`,
 * `/mais/senha` e `/mais/creditos` terminavam na página de erro do navegador.
 */
export interface PedidoDeNavegacao {
  /** `request.destination` ("document", "image", "script", …). */
  destino: string;
  /** `request.mode` ("navigate", "cors", "same-origin", …). */
  modo: string;
  /** O cabeçalho `RSC` da requisição, se houver. */
  rsc: string | null;
  /** O caminho com a busca, como em `/mais/contas?_rsc=abc`. */
  url: string;
}

/** O fetch que o roteador do Next faz para trocar de tela sem recarregar. */
export function ehRsc(pedido: PedidoDeNavegacao): boolean {
  if (pedido.rsc === "1") return true;
  const busca = pedido.url.split("?")[1];
  if (busca === undefined) return false;
  return new URLSearchParams(busca).has("_rsc");
}

/** Documento **ou** RSC: as duas formas de navegar (SPEC §22.1). */
export function ehNavegacao(pedido: PedidoDeNavegacao): boolean {
  return (
    pedido.destino === "document" || pedido.modo === "navigate" || ehRsc(pedido)
  );
}
