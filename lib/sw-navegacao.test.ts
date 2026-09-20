import { describe, expect, it } from "vitest";
import { ehNavegacao, ehRsc, type PedidoDeNavegacao } from "@/lib/sw-navegacao";

function pedido(campos: Partial<PedidoDeNavegacao> = {}): PedidoDeNavegacao {
  return {
    destino: "",
    modo: "cors",
    rsc: null,
    url: "https://app.exemplo/mais/contas",
    ...campos,
  };
}

describe("o que ganha a /~offline sem rede (SPEC §22.1)", () => {
  it("o documento que o navegador pede ao abrir a URL", () => {
    expect(ehNavegacao(pedido({ destino: "document", modo: "navigate" }))).toBe(true);
  });

  /*
   * O defeito de 20/09: o fallback só cobria `destination === "document"`. Um
   * documento sem `destination` (o que alguns navegadores mandam) e, sobretudo,
   * o fetch de RSC ficavam de fora — e a tela ficava em branco.
   */
  it("a navegação sem `destination`, pelo `mode`", () => {
    expect(ehNavegacao(pedido({ destino: "", modo: "navigate" }))).toBe(true);
  });

  it("o fetch de RSC, pelo cabeçalho e pela busca", () => {
    expect(ehNavegacao(pedido({ rsc: "1" }))).toBe(true);
    expect(ehNavegacao(pedido({ url: "https://app.exemplo/mais/senha?_rsc=9ab" }))).toBe(
      true,
    );
    expect(ehRsc(pedido({ rsc: "1" }))).toBe(true);
    expect(ehRsc(pedido({ url: "https://app.exemplo/mais?_rsc=9ab" }))).toBe(true);
  });

  it("o que não é navegação continua de fora", () => {
    expect(ehNavegacao(pedido({ destino: "image", url: "/figuras/a.svg" }))).toBe(false);
    expect(ehNavegacao(pedido({ destino: "script", modo: "no-cors" }))).toBe(false);
    expect(ehNavegacao(pedido({ url: "https://app.exemplo/rest/v1/sessions" }))).toBe(
      false,
    );
    // uma busca qualquer não é RSC
    expect(ehRsc(pedido({ url: "https://app.exemplo/exercicios?busca=supino" }))).toBe(
      false,
    );
  });
});
