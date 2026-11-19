import { createServerClient } from "@supabase/ssr";
import { cache } from "react";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigurado } from "@/lib/env";
import { impressaoDoLogin } from "@/lib/vinculo-do-player";

/** Cliente Supabase do servidor (Next 15: cookies() é assíncrono). */
export async function criarClienteServidor() {
  if (!supabaseConfigurado()) {
    throw new Error("Supabase não configurado (falta URL ou chave anon)");
  }
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(novos) {
        try {
          for (const { name, value, options } of novos) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // chamado de um Server Component: o middleware já renova a sessão
        }
      },
    },
  });
}

/** React compartilha a verificação somente durante a mesma requisição. */
export const identidadeDaRequisicao = cache(async () => {
  const supabase = await criarClienteServidor();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase.auth.getClaims(session.access_token);
  const claims = data?.claims;
  if (!claims || typeof claims.sub !== "string") return null;
  return {
    id: claims.sub, email: typeof claims.email === "string" ? claims.email : null,
    impressao: await impressaoDoLogin(claims.sub, SUPABASE_URL, SUPABASE_ANON_KEY, session.access_token),
  };
});

export async function idDoUsuario(): Promise<string | null> {
  return (await identidadeDaRequisicao())?.id ?? null;
}

export async function emailDoUsuario(): Promise<string | null> {
  return (await identidadeDaRequisicao())?.email ?? null;
}
