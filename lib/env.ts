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

/**
 * Uma chave que **nunca** pode ir para o navegador: a service role (JWT com
 * `role: "service_role"`) ou uma chave secreta nova (`sb_secret_…`).
 *
 * O layout autenticado entrega a chave pública ao cliente em tempo de execução
 * (`ConfigurarSupabase`), então uma chave secreta colada por engano em
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` iria junto — e ela passa por cima de toda a
 * RLS. Quando isso acontece o app se comporta como se não estivesse
 * configurado: fica na tela de login explicando (SPEC §9).
 */
export function chaveEhSecreta(chave: string): boolean {
  const c = chave.trim();
  if (c === "") return false;
  if (c.toLowerCase().startsWith("sb_secret_")) return true;

  // JWT: o papel está no payload (a parte do meio), em base64url
  const partes = c.split(".");
  const payload = partes.length === 3 ? partes[1] : undefined;
  if (payload === undefined) return false;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const completo = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const dados: unknown = JSON.parse(atob(completo));
    if (typeof dados !== "object" || dados === null) return false;
    return (dados as { role?: unknown }).role === "service_role";
  } catch {
    // não é um JWT legível: quem decide se serve é o Supabase
    return false;
  }
}

export function supabaseConfigurado(): boolean {
  if (SUPABASE_URL.length === 0 || SUPABASE_ANON_KEY.length === 0) return false;
  return !chaveEhSecreta(SUPABASE_ANON_KEY);
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

export const AVISO_CHAVE_SECRETA =
  "A chave em NEXT_PUBLIC_SUPABASE_ANON_KEY é secreta (service role). Use a chave anon/publishable.";

/** O que a tela de login precisa avisar sobre a configuração, ou nada. */
export function avisoDeConfiguracao(): string | undefined {
  if (chaveEhSecreta(SUPABASE_ANON_KEY)) return AVISO_CHAVE_SECRETA;
  if (!supabaseConfigurado() || !emailPermitidoConfigurado()) return AVISO_CONFIG;
  return undefined;
}
