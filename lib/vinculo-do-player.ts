/** Associa a conta e a configuração pública do projeto ao token que o servidor já verificou. */
export async function impressaoDoLogin(conta: string, url: string, chave: string, token: string): Promise<string> {
  const entrada = new TextEncoder().encode(JSON.stringify([conta, url, chave, token]));
  const hash = await crypto.subtle.digest("SHA-256", entrada);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface VinculoDoPlayer {
  conta: string;
  url: string;
  chave: string;
  impressao: string;
}

export const EVENTO_DE_LOGIN_CONFIRMADO = "treino:login-confirmado";

export type CaminhoDeAbaLocal = "/" | "/relatorio" | "/calendario" | "/mais";

export function ehAbaLocal(caminho: string): caminho is CaminhoDeAbaLocal {
  return caminho === "/" || caminho === "/relatorio" || caminho === "/calendario" || caminho === "/mais";
}

export function idDoPlayerNoCaminho(caminho: string): string | null {
  return /^\/treinar\/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})\/?$/i.exec(caminho)?.[1] ?? null;
}
