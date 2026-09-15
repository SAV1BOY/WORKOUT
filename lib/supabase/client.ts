import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * As `NEXT_PUBLIC_*` são embutidas no bundle do navegador **no build**, e este
 * app é buildado sem elas (não existe projeto Supabase ainda; na Vercel o build
 * e o deploy também são separados). Então o servidor entrega a configuração em
 * tempo de execução e o navegador guarda aqui.
 *
 * São só a URL e a chave anon — as duas públicas. A service role nunca chega
 * ao cliente (SPEC §9).
 */
let configuracao: { url: string; chave: string } | null = null;

export function definirConfigSupabase(url: string, chave: string): void {
  if (url.length > 0 && chave.length > 0) configuracao = { url, chave };
}

function config(): { url: string; chave: string } {
  return configuracao ?? { url: SUPABASE_URL, chave: SUPABASE_ANON_KEY };
}

/** Dá para falar com o Supabase daqui? (no navegador, depois da configuração). */
export function supabaseConfiguradoNoNavegador(): boolean {
  const c = config();
  return c.url.length > 0 && c.chave.length > 0;
}

/** Cliente Supabase do navegador. Só chame com o app configurado. */
export function criarClienteNavegador() {
  const c = config();
  if (c.url.length === 0 || c.chave.length === 0) {
    throw new Error("Supabase não configurado (falta URL ou chave anon)");
  }
  return createBrowserClient(c.url, c.chave);
}

let memoria: ReturnType<typeof createBrowserClient> | null = null;

/**
 * O mesmo cliente do navegador para o app inteiro: cada `createBrowserClient`
 * novo abre outro listener de sessão e outra fila de refresh do token.
 */
export function clienteNavegador() {
  memoria ??= criarClienteNavegador();
  return memoria;
}
