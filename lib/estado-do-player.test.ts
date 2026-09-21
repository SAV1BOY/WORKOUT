import { describe, expect, it } from "vitest";
import { decidirTela } from "@/lib/estado-do-player";

const nada = { localTerminou: false, servidorTerminou: false, sessao: null, erro: null };

describe("decidirTela", () => {
  it("com a sessão em mãos, é o player — mesmo que o servidor tenha falhado", () => {
    expect(decidirTela({ ...nada, sessao: { id: "s1" }, erro: new Error("rede") })).toBe(
      "pronto",
    );
  });

  it("enquanto o aparelho ainda é lido, esqueleto", () => {
    expect(decidirTela(nada)).toBe("carregando");
  });

  it("o aparelho terminou sem nada e o servidor ainda vem: esqueleto, nunca 'não achei'", () => {
    expect(decidirTela({ ...nada, localTerminou: true })).toBe("carregando");
  });

  it("as duas buscas terminaram sem sessão: aí sim 'não achei'", () => {
    expect(decidirTela({ ...nada, localTerminou: true, servidorTerminou: true })).toBe(
      "nao-achei",
    );
  });

  it("erro de rede é 'tentar de novo', não 'não achei'", () => {
    expect(
      decidirTela({
        ...nada,
        localTerminou: true,
        servidorTerminou: true,
        erro: new Error("Failed to fetch"),
      }),
    ).toBe("erro");
  });

  it("erro antes de o aparelho responder ainda é esqueleto", () => {
    expect(decidirTela({ ...nada, erro: new Error("Failed to fetch") })).toBe(
      "carregando",
    );
  });
});
