import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigurado } from "@/lib/env";

/** Rotas que abrem sem sessão. */
const PUBLICAS = [
  "/login",
  "/auth/callback",
  "/~offline",
  // o teste de fumaça do deploy pergunta qual build está no ar (SPEC §22.1)
  "/versao",
  "/manifest.webmanifest",
  "/sw.js",
  "/robots.txt",
];

export function ehPublica(caminho: string): boolean {
  if (PUBLICAS.some((p) => caminho === p || caminho.startsWith(`${p}/`))) {
    return true;
  }
  return /^\/(figuras|fotos|ilustracoes|itens|mapa-muscular|icons)\//.test(caminho);
}

/**
 * Redireciona para o login **levando junto** os cookies que o cliente do
 * Supabase escreveu.
 *
 * O `setAll` do `createServerClient` recria a `resposta` e grava nela: um
 * `NextResponse.redirect()` novo jogaria fora tanto o token renovado quanto os
 * cookies apagados pelo `signOut` — e o aparelho ficaria com os `sb-*` mortos
 * até expirarem. É o padrão recomendado pelo `@supabase/ssr`.
 */
function irParaOLogin(
  request: NextRequest,
  resposta: NextResponse,
  busca = "",
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = busca;
  const saida = NextResponse.redirect(url);
  for (const cookie of resposta.cookies.getAll()) saida.cookies.set(cookie);
  return saida;
}

/**
 * Renova a sessão nos cookies e faz o controle de acesso: sem sessão → /login.
 *
 * É só isso desde o marco Contas (SPEC §21): o app deixou de ser de um usuário
 * só, então **qualquer conta que existe** entra. Quem decide se uma conta pode
 * nascer é a cota, no banco (`on_auth_user_vaga`), e o que separa os dados de
 * cada pessoa é a RLS por `auth.uid()` — não este arquivo.
 */
export async function updateSession(request: NextRequest) {
  const caminho = request.nextUrl.pathname;
  let resposta = NextResponse.next({ request });

  if (ehPublica(caminho)) return resposta;

  if (!supabaseConfigurado()) {
    // sem variáveis não há como checar sessão: a tela de login explica o que falta
    return irParaOLogin(request, resposta);
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(novos) {
        for (const { name, value } of novos) {
          request.cookies.set(name, value);
        }
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of novos) {
          resposta.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return irParaOLogin(request, resposta);

  return resposta;
}
