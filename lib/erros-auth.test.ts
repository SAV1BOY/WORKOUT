import { describe, expect, it } from "vitest";
import { CADASTRO_FECHADO, traduzirErroAuth } from "@/lib/erros-auth";

describe("erros do Supabase em pt-BR", () => {
  it("credenciais inválidas", () => {
    expect(traduzirErroAuth("Invalid login credentials")).toBe(
      "E-mail ou senha incorretos.",
    );
  });
  it("conta já existente", () => {
    expect(traduzirErroAuth("User already registered")).toMatch(/já existe/);
  });
  it("o bloqueio da cota vira o recado de cadastro fechado (SPEC §21)", () => {
    // a mensagem crua do raise exception de supabase/schema.sql
    expect(
      traduzirErroAuth("Cadastro fechado: o limite de contas foi atingido."),
    ).toBe(CADASTRO_FECHADO);
    // e o embrulho que o GoTrue põe em cima de um erro de trigger
    expect(traduzirErroAuth("Database error saving new user")).toBe(
      CADASTRO_FECHADO,
    );
    expect(CADASTRO_FECHADO).toBe(
      "Cadastro fechado no momento: o limite de contas foi atingido.",
    );
  });

  it("o app deixou de ser de um usuário só: nada de “app pessoal”", () => {
    for (const mensagem of [
      "Invalid login credentials",
      "Database error saving new user",
      "User already registered",
      "boom",
    ]) {
      expect(traduzirErroAuth(mensagem).toLowerCase()).not.toContain("pessoal");
    }
  });
  it("as recusas da troca de senha (SPEC §9)", () => {
    expect(traduzirErroAuth("Password should be at least 6 characters")).toBe(
      "A senha precisa ter pelo menos 6 caracteres.",
    );
    expect(
      traduzirErroAuth("New password should be different from the old password."),
    ).toBe("A senha nova precisa ser diferente da atual.");
  });
  it("mensagem desconhecida vira texto genérico", () => {
    expect(traduzirErroAuth("boom")).toMatch(/Tente de novo/);
  });
  it("quem chama de fora do login escolhe o texto genérico", () => {
    expect(traduzirErroAuth("boom", "Não deu para trocar a senha agora.")).toBe(
      "Não deu para trocar a senha agora.",
    );
    // o que o app sabe traduzir não depende do padrão de quem chamou
    expect(
      traduzirErroAuth("Invalid login credentials", "Não deu para trocar a senha agora."),
    ).toBe("E-mail ou senha incorretos.");
  });
});
