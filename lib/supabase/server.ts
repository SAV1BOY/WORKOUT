import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigurado } from "@/lib/env";

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

/** O id do usuário logado. O layout autenticado já garantiu que existe. */
export async function idDoUsuario(): Promise<string | null> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
