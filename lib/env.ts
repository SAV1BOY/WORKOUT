/**
 * Variáveis de ambiente. O app precisa buildar e renderizar sem elas:
 * quando faltam, a tela de login mostra o aviso de configuração.
 */

/** URL do projeto Supabase (pública). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Chave anon/publishable do Supabase (pública). Nunca a service role. */
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

/** Único e-mail que pode entrar no app (só no servidor). */
export const ALLOWED_EMAIL = (process.env.ALLOWED_EMAIL ?? "")
  .trim()
  .toLowerCase();

export function supabaseConfigurado(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

export function emailPermitidoConfigurado(): boolean {
  return ALLOWED_EMAIL.length > 0;
}

/** App de um usuário só: qualquer outro e-mail é recusado. */
export function emailPermitido(email: string | null | undefined): boolean {
  if (!email || !emailPermitidoConfigurado()) return false;
  return email.trim().toLowerCase() === ALLOWED_EMAIL;
}

export const AVISO_CONFIG =
  "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY";
