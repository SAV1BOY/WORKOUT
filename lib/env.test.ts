import { afterEach, describe, expect, it, vi } from "vitest";
import { chaveEhSecreta, ehDono } from "@/lib/env";

/** Um JWT de mentira com o papel pedido (só o payload importa aqui). */
function jwt(papel: string): string {
  const base64url = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url({
    iss: "supabase",
    role: papel,
  })}.assinatura`;
}

describe("chaveEhSecreta", () => {
  it("reconhece a service role (o que nunca pode ir para o navegador)", () => {
    expect(chaveEhSecreta(jwt("service_role"))).toBe(true);
    expect(chaveEhSecreta(`  ${jwt("service_role")}  `)).toBe(true);
    expect(chaveEhSecreta("sb_secret_abc123")).toBe(true);
    expect(chaveEhSecreta("SB_SECRET_ABC123")).toBe(true);
  });

  it("deixa passar as chaves públicas", () => {
    expect(chaveEhSecreta(jwt("anon"))).toBe(false);
    expect(chaveEhSecreta("sb_publishable_abc123")).toBe(false);
    expect(chaveEhSecreta("mock-anon")).toBe(false);
    expect(chaveEhSecreta("")).toBe(false);
  });

  it("não quebra com lixo", () => {
    expect(chaveEhSecreta("a.b.c")).toBe(false);
    expect(chaveEhSecreta("...")).toBe(false);
    expect(chaveEhSecreta("um.dois")).toBe(false);
  });
});

describe("ehDono", () => {
  it("sem ALLOWED_EMAIL ninguém é dono", () => {
    // ALLOWED_EMAIL não está definido no ambiente dos testes
    expect(ehDono("qualquer@exemplo.com")).toBe(false);
    expect(ehDono(null)).toBe(false);
  });
});

/* As constantes de `lib/env.ts` são lidas no import: para variar o ambiente é
   preciso recarregar o módulo. */
describe("com o ambiente configurado", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function carregar(vars: Record<string, string>) {
    vi.resetModules();
    for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
    return import("@/lib/env");
  }

  it("reconhece o dono com outra caixa e com espaços", async () => {
    const env = await carregar({
      NEXT_PUBLIC_SUPABASE_URL: "https://projeto.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
      ALLOWED_EMAIL: "  Miguel@Exemplo.COM ",
    });
    expect(env.ehDono("miguel@exemplo.com")).toBe(true);
    expect(env.ehDono("  MIGUEL@exemplo.com  ")).toBe(true);
    // SPEC §21.1: outro e-mail entra no app — só não é o dono
    expect(env.ehDono("outro@exemplo.com")).toBe(false);
    expect(env.supabaseConfigurado()).toBe(true);
    expect(env.avisoDeConfiguracao()).toBeUndefined();
  });

  it("com a service role no lugar da anon o app não se considera configurado", async () => {
    const env = await carregar({
      NEXT_PUBLIC_SUPABASE_URL: "https://projeto.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("service_role"),
      ALLOWED_EMAIL: "miguel@exemplo.com",
    });
    // fail-closed: o layout manda para /login e a chave nunca chega ao cliente
    expect(env.supabaseConfigurado()).toBe(false);
    expect(env.avisoDeConfiguracao()).toBe(env.AVISO_CHAVE_SECRETA);
  });

  it("sem ALLOWED_EMAIL não há dono — e isso é um aviso de configuração", async () => {
    const env = await carregar({
      NEXT_PUBLIC_SUPABASE_URL: "https://projeto.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
      ALLOWED_EMAIL: "",
    });
    // sem dono não há quem administre a cota de contas (SPEC §21.3)
    expect(env.ehDono("miguel@exemplo.com")).toBe(false);
    expect(env.donoConfigurado()).toBe(false);
    expect(env.avisoDeConfiguracao()).toBe(env.AVISO_CONFIG);
  });
});
