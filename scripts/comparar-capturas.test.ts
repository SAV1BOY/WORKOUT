import { describe, expect, it } from "vitest";
import { casaEsperada } from "./comparar-capturas";

/* SPEC §22.12 item 8: `--esperadas` casa com e sem o prefixo numérico. */
describe("casaEsperada", () => {
  it("mantém o casamento antigo, por prefixo com número", () => {
    expect(casaEsperada(["11-relatorio-topo"], "11-relatorio-topo-claro.png")).toBe(true);
    expect(casaEsperada(["11-relatorio-topo"], "11-relatorio-topo-escuro.png")).toBe(true);
    expect(casaEsperada(["06-explorar"], "06-explorar-claro.png")).toBe(true);
    expect(casaEsperada(["06-explorar"], "07-colecao-claro.png")).toBe(false);
  });

  it("aceita o nome sem o número, nos dois temas", () => {
    for (const tema of ["claro", "escuro"]) {
      expect(casaEsperada(["explorar"], `06-explorar-${tema}.png`)).toBe(true);
      expect(casaEsperada(["colecao"], `07-colecao-${tema}.png`)).toBe(true);
      expect(casaEsperada(["catalogo"], `08-catalogo-${tema}.png`)).toBe(true);
    }
    expect(casaEsperada(["treino-topo"], "03-treino-topo-claro.png")).toBe(true);
  });

  it("a lista de três casa só as três telas", () => {
    const esperadas = ["explorar", "colecao", "catalogo"];
    const nomes = [
      "03-treino-topo-claro.png",
      "06-explorar-claro.png",
      "07-colecao-escuro.png",
      "08-catalogo-claro.png",
      "09-ficha-exercicio-claro.png",
      "18-mais-claro.png",
    ];
    expect(nomes.filter((n) => casaEsperada(esperadas, n))).toEqual([
      "06-explorar-claro.png",
      "07-colecao-escuro.png",
      "08-catalogo-claro.png",
    ]);
  });

  it("não casa pedaço de nome nem meio de palavra", () => {
    expect(casaEsperada(["explo"], "06-explorar-claro.png")).toBe(false);
    expect(casaEsperada(["cao"], "07-colecao-claro.png")).toBe(false);
    expect(casaEsperada(["ficha"], "09-ficha-exercicio-claro.png")).toBe(true);
    expect(casaEsperada(["exercicio"], "09-ficha-exercicio-claro.png")).toBe(false);
    expect(casaEsperada([""], "06-explorar-claro.png")).toBe(false);
    expect(casaEsperada([], "06-explorar-claro.png")).toBe(false);
  });
});
