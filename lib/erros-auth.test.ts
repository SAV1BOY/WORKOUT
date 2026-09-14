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
  it("mensagem desconhecida vira texto genérico", () => {
    expect(traduzirErroAuth("boom")).toMatch(/Tente de novo/);
  });
});
