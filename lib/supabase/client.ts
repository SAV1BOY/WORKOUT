import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigurado } from "@/lib/env";

/** Cliente Supabase do navegador. Só chame com o app configurado. */
export function criarClienteNavegador() {
  if (!supabaseConfigurado()) {
    throw new Error("Supabase não configurado (falta URL ou chave anon)");
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
