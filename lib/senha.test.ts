import { describe, expect, it } from "vitest";
import { MINIMO_DA_SENHA, conferirSenhaNova } from "@/lib/senha";

describe("a senha nova (SPEC §9)", () => {
  it("o mínimo do app é maior que o do GoTrue", () => {
    expect(MINIMO_DA_SENHA).toBeGreaterThan(6);
  });

  it("senha curta é recusada com o número na mensagem", () => {
    const curta = "a".repeat(MINIMO_DA_SENHA - 1);
    expect(conferirSenhaNova(curta, curta)).toBe(
      `A senha precisa de pelo menos ${MINIMO_DA_SENHA} caracteres.`,
    );
    expect(conferirSenhaNova("", "")).toMatch(/pelo menos/);
  });

  it("as duas precisam ser iguais", () => {
    expect(conferirSenhaNova("senha-nova-1", "senha-nova-2")).toBe(
      "As duas senhas precisam ser iguais.",
    );
    // a diferença pode ser só um espaço no fim: nada de trim aqui
    expect(conferirSenhaNova("senha-nova-1", "senha-nova-1 ")).toMatch(/iguais/);
  });

  it("o tamanho é conferido antes da igualdade", () => {
    expect(conferirSenhaNova("curta", "outra")).toMatch(/pelo menos/);
  });

  it("duas senhas iguais no tamanho certo passam", () => {
    const boa = "a".repeat(MINIMO_DA_SENHA);
    expect(conferirSenhaNova(boa, boa)).toBeNull();
    expect(conferirSenhaNova("senha-temporaria-trocada", "senha-temporaria-trocada")).toBeNull();
  });
});
