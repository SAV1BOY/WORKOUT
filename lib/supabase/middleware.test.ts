/**
 * O middleware (SPEC §2 e §21.3): quem entra e quem não entra.
 *
 * Desde o marco Contas ele só pergunta uma coisa — **há sessão?**. Quem pode
 * ter conta é decidido pela cota, no banco (`on_auth_user_vaga`), e o que
 * separa os dados de cada pessoa é a RLS. Não existe mais `?erro=app-pessoal`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DONO = "miguelgsaviotti29@gmail.com";

/** O que o cliente do Supabase de mentira vai devolver em `getUser`. */
let emailDoUsuario: string | null = null;
/**
 * Cookies que o `getUser` manda escrever pelo `setAll` — é o que acontece de
 * verdade quando o `@supabase/ssr` renova o token no meio da navegação.
 */
let cookiesDaRenovacao: { name: string; value: string; options?: object }[] = [];

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _chave: string,
    opcoes: { cookies: { getAll: () => unknown; setAll: (n: unknown[]) => void } },
  ) => ({
    auth: {
      getUser: () => {
        if (cookiesDaRenovacao.length > 0) opcoes.cookies.setAll(cookiesDaRenovacao);
        return Promise.resolve({
          data: { user: emailDoUsuario === null ? null : { email: emailDoUsuario } },
        });
      },
      signOut: () => Promise.resolve({ error: null }),
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
  vi.stubEnv("ALLOWED_EMAIL", DONO);
  vi.resetModules();
  emailDoUsuario = null;
  cookiesDaRenovacao = [];
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

  /* SPEC §23.5: a rota de API é chamada por fetch — 401 em JSON, não o login. */
  it("sem sessão, /api/* responde 401 em JSON (e não o desvio para o login)", async () => {
    const resposta = await rodar("/api/lembretes/teste");
    expect(resposta.status).toBe(401);
    expect(resposta.headers.get("location")).toBeNull();
    expect(await resposta.json()).toEqual({ erro: "Entre de novo para continuar." });
    // o que não é /api continua indo para o login
    expect((await rodar("/apis")).status).toBe(307);
  });

  it("com sessão, /api/* passa", async () => {
    emailDoUsuario = "outra.pessoa@exemplo.com";
    const resposta = await rodar("/api/lembretes/teste");
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("location")).toBeNull();
  });

  it("o dono passa", async () => {
    emailDoUsuario = DONO;
    const resposta = await rodar("/corpo");
    expect(resposta.headers.get("location")).toBeNull();
  });

  /* SPEC §21.3: o app deixou de ser de um usuário só. */
  it("uma conta comum passa igual à do dono", async () => {
    emailDoUsuario = "outra.pessoa@exemplo.com";
    const resposta = await rodar("/corpo");
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("location")).toBeNull();
    // e nada de cookie apagado: a sessão dela continua de pé
    expect(resposta.cookies.get("sb-abc-auth-token")).toBeUndefined();
  });

  it("nenhuma rota leva ao antigo ?erro=app-pessoal", async () => {
    for (const email of [null, "outra.pessoa@exemplo.com", DONO]) {
      emailDoUsuario = email;
      const resposta = await rodar("/");
      expect(resposta.headers.get("location") ?? "").not.toContain("app-pessoal");
    }
  });

  it("rota pública passa sem sessão", async () => {
    const resposta = await rodar("/robots.txt");
    expect(resposta.headers.get("location")).toBeNull();
  });
});

/*
 * Auditoria final: o `setAll` do `createServerClient` RECRIA a `resposta`, e um
 * `NextResponse.redirect()` novo jogaria fora o que ele acabou de escrever. Com
 * a sessão vencida o token renovado ia para o lixo e o aparelho ficava rodando
 * com os `sb-*` velhos.
 */
describe("o redirect para o login leva os cookies renovados", () => {
  beforeEach(() => {
    emailDoUsuario = null;   // token vencido: renova e mesmo assim não há usuário
    cookiesDaRenovacao = [
      { name: "sb-abc-auth-token", value: "", options: { maxAge: 0, path: "/" } },
    ];
  });

  it("vai para o login", async () => {
    const resposta = await rodar("/");
    expect(resposta.headers.get("location")).toBe("https://treino.app/login");
  });

  it("o redirect não perde o que o setAll escreveu", async () => {
    const resposta = await rodar("/");
    const cookie = resposta.cookies.get("sb-abc-auth-token");
    expect(cookie, "o redirect perdeu o cookie que o Supabase escreveu").toBeDefined();
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });
});
