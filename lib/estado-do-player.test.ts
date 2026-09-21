import { describe, expect, it } from "vitest";
import { decidirTela, servidorTerminouDeBuscar } from "@/lib/estado-do-player";

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

/**
 * A outra metade da decisão: quando o servidor pode ser dado por encerrado.
 * O defeito da auditoria 2 estava aqui — a composição olhava `isFetching`
 * junto de `isPending`, e qualquer refetch de fundo derrubava um "não achei"
 * já decidido de volta para esqueleto (a tela piscava sem ninguém tocar).
 */
describe("servidorTerminouDeBuscar", () => {
  const respondeuSemNada = {
    sessaoPendente: false,
    seriesPendente: false,
    linhaDoServidor: null,
    montagemFalhou: false,
  };

  it("com as duas consultas pendentes, não terminou", () => {
    expect(
      servidorTerminouDeBuscar({
        ...respondeuSemNada,
        sessaoPendente: true,
        seriesPendente: true,
      }),
    ).toBe(false);
  });

  it("basta uma das duas pendente para não ter terminado", () => {
    expect(
      servidorTerminouDeBuscar({ ...respondeuSemNada, sessaoPendente: true }),
    ).toBe(false);
    expect(
      servidorTerminouDeBuscar({ ...respondeuSemNada, seriesPendente: true }),
    ).toBe(false);
  });

  it("respondeu e não há linha: terminou", () => {
    expect(servidorTerminouDeBuscar(respondeuSemNada)).toBe(true);
  });

  it("linha em mãos e remontagem ainda possível: não terminou", () => {
    expect(
      servidorTerminouDeBuscar({
        ...respondeuSemNada,
        linhaDoServidor: { id: "s1" },
      }),
    ).toBe(false);
  });

  it("linha em mãos e remontagem já falhada: terminou", () => {
    expect(
      servidorTerminouDeBuscar({
        ...respondeuSemNada,
        linhaDoServidor: { id: "s1" },
        montagemFalhou: true,
      }),
    ).toBe(true);
  });

  it("refetch de fundo não rebaixa um 'não achei' já decidido", () => {
    /*
     * O refetch de fundo do TanStack Query deixa `isFetching` verdadeiro e
     * `isPending` falso — o dado antigo continua em mãos. A entrada desta
     * função nem tem `isFetching`: seja qual for o refetch em curso, a
     * resposta segue a mesma, e `decidirTela` não volta para "carregando".
     */
    const antes = servidorTerminouDeBuscar(respondeuSemNada);
    expect(antes).toBe(true);
    expect(
      decidirTela({
        localTerminou: true,
        servidorTerminou: antes,
        sessao: null,
        erro: null,
      }),
    ).toBe("nao-achei");
    // e a tela continua dizendo "não achei" durante o refetch inteiro
    expect(servidorTerminouDeBuscar({ ...respondeuSemNada })).toBe(true);
  });

  it("o 'undefined' de uma consulta que respondeu vazia conta como sem linha", () => {
    expect(
      servidorTerminouDeBuscar({ ...respondeuSemNada, linhaDoServidor: undefined }),
    ).toBe(true);
  });
});
