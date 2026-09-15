/**
 * O middleware (SPEC §2): quem entra, quem não entra e o que sobra no
 * aparelho de quem foi recusado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PERMITIDO = "miguelgsaviotti29@gmail.com";

/** O que o cliente do Supabase de mentira vai devolver em `getUser`. */
let emailDoUsuario: string | null = null;
/** Cookies que o `signOut` manda escrever (apagados, `maxAge: 0`). */
let cookiesDoSignOut: { name: string; value: string; options?: object }[] = [];

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _chave: string,
    opcoes: { cookies: { getAll: () => unknown; setAll: (n: unknown[]) => void } },
  ) => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: emailDoUsuario === null ? null : { email: emailDoUsuario } },
        }),
      signOut: () => {
        opcoes.cookies.setAll(cookiesDoSignOut);
        return Promise.resolve({ error: null });
      },
    },
  }),
}));

async function rodar(caminho: string) {
  const { NextRequest } = await import("next/server");
  const { updateSession } = await import("@/lib/supabase/middleware");
  const pedido = new NextRequest(new URL(`https://treino.app${caminho}`));
  pedido.cookies.set("sb-abc-auth-token", "token-de-quem-nao-pode");
  return updateSession(pedido);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemplo.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "chave-anon-de-teste");
  vi.stubEnv("ALLOWED_EMAIL", PERMITIDO);
  vi.resetModules();
  emailDoUsuario = null;
  cookiesDoSignOut = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("controle de acesso", () => {
  it("sem sessão vai para o login", async () => {
    const resposta = await rodar("/corpo");
    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toBe("https://treino.app/login");
  });

  it("o e-mail permitido passa", async () => {
    emailDoUsuario = PERMITIDO;
    const resposta = await rodar("/corpo");
    expect(resposta.headers.get("location")).toBeNull();
  });

  it("rota pública passa sem sessão", async () => {
    const resposta = await rodar("/robots.txt");
    expect(resposta.headers.get("location")).toBeNull();
  });
});

/*
 * Auditoria final: o `signOut` escrevia os cookies apagados na `resposta` que
 * o `setAll` recria, e a função devolvia um `NextResponse.redirect()` novo —
 * as deleções iam para o lixo e o aparelho ficava com os `sb-*` mortos.
 */
describe("e-mail de fora (SPEC §2)", () => {
  beforeEach(() => {
    emailDoUsuario = "outra.pessoa@exemplo.com";
    cookiesDoSignOut = [
      { name: "sb-abc-auth-token", value: "", options: { maxAge: 0, path: "/" } },
    ];
  });

  it("é mandado para o login com o aviso", async () => {
    const resposta = await rodar("/");
    expect(resposta.headers.get("location")).toBe(
      "https://treino.app/login?erro=app-pessoal",
    );
  });

  it("o redirect leva junto os cookies apagados pelo signOut", async () => {
    const resposta = await rodar("/");
    const apagado = resposta.cookies.get("sb-abc-auth-token");
    expect(apagado, "o redirect perdeu a deleção do cookie de sessão").toBeDefined();
    expect(apagado?.value).toBe("");
    expect(apagado?.maxAge).toBe(0);
  });
});
