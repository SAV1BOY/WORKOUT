import { describe, expect, it } from "vitest";
import { traduzirErroAuth } from "@/lib/erros-auth";

describe("erros do Supabase em pt-BR", () => {
  it("credenciais inválidas", () => {
    expect(traduzirErroAuth("Invalid login credentials")).toBe(
      "E-mail ou senha incorretos.",
    );
  });
  it("conta já existente", () => {
    expect(traduzirErroAuth("User already registered")).toMatch(/já existe/);
  });
  it("o bloqueio do trigger vira o recado do app pessoal", () => {
    // a mensagem crua do raise exception de supabase/schema.sql
    expect(
      traduzirErroAuth("Este app é pessoal: só o e-mail autorizado pode entrar."),
    ).toBe("Este app é pessoal.");
    // e o embrulho que o GoTrue põe em cima de um erro de trigger
    expect(traduzirErroAuth("Database error saving new user")).toBe(
      "Este app é pessoal.",
    );
  });
  it("mensagem desconhecida vira texto genérico", () => {
    expect(traduzirErroAuth("boom")).toMatch(/Tente de novo/);
  });
});
