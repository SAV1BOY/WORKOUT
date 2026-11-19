import { combineChunks, parseCookieHeader, stringFromBase64URL } from "@supabase/ssr";
import { bd, guardarCache, lerCache } from "@/lib/db";
import type { SessaoLocal } from "@/lib/sessao";
import { EVENTO_DE_LOGIN_CONFIRMADO, impressaoDoLogin, type VinculoDoPlayer } from "@/lib/vinculo-do-player";

const CHAVE = "player:login-confirmado";

/** A leitura passiva usa os mesmos cookies fragmentados do SDK. getSession renovaria um token vencido pela rede. */
async function tokenDoCookie(url: string, cookies: string): Promise<string | null> {
  const nome = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  const partes = new Map(parseCookieHeader(cookies).map(({ name, value }) => [name, value]));
  const bruto = await combineChunks(nome, (chave) => partes.get(chave));
  if (!bruto) return null;
  const sessao: unknown = JSON.parse(bruto.startsWith("base64-") ? stringFromBase64URL(bruto.slice(7)) : bruto);
  return typeof sessao === "object" && sessao !== null && "access_token" in sessao && typeof sessao.access_token === "string"
    ? sessao.access_token : null;
}

export async function correspondeAoCookie(vinculo: VinculoDoPlayer, cookies: string): Promise<boolean> {
  try {
    const token = await tokenDoCookie(vinculo.url, cookies);
    return Boolean(token && await impressaoDoLogin(vinculo.conta, vinculo.url, vinculo.chave, token) === vinculo.impressao);
  } catch {
    return false;
  }
}

/** Só um token autenticado no servidor ou renovado pelo SDK pode estabelecer este vínculo. */
export async function guardarVinculoDoPlayer(vinculo: VinculoDoPlayer): Promise<void> {
  if (!await correspondeAoCookie(vinculo, document.cookie)) return;
  await guardarCache(CHAVE, vinculo);
  window.dispatchEvent(new Event(EVENTO_DE_LOGIN_CONFIRMADO));
}

/** A linha da sessão indica o dono. A identidade é comprovada separadamente, antes de mostrar o player. */
export async function vinculoDoLoginAtual(): Promise<VinculoDoPlayer | null> {
  const vinculo = await lerCache<VinculoDoPlayer>(CHAVE);
  return vinculo && await correspondeAoCookie(vinculo, document.cookie) ? vinculo : null;
}

export async function vinculoParaPlayerLocal(id: string): Promise<VinculoDoPlayer | null> {
  const vinculo = await vinculoDoLoginAtual();
  if (!vinculo) return null;
  const item = await bd().sessaoAtiva.get(id);
  const sessao = item?.dados as Partial<SessaoLocal> | undefined;
  return sessao?.id === id && sessao.userId === vinculo.conta && sessao.status === "em_andamento" ? vinculo : null;
}
