import { bd, temIndexedDB } from "@/lib/db";
import { lerConsultaGuardadaComData, VALIDADE_MS } from "@/lib/persistencia-query";
import type { LinhaPerfil } from "@/lib/types";

/** A primeira leitura do perfil pode anteceder a gravação geral das consultas. */
export async function guardarPerfilLido(perfil: LinhaPerfil, lidoEm: number, sinal?: AbortSignal): Promise<void> {
  if (!temIndexedDB() || !perfil.user_id || sinal?.aborted) return;
  const banco = bd();
  const chave = `perfil-lido:${perfil.user_id}`;
  await banco.transaction("rw", banco.cache, async () => {
    const anterior = await banco.cache.get(chave);
    if (sinal?.aborted || (anterior && anterior.atualizadoEm > lidoEm)) return;
    await banco.cache.put({ chave, valor: perfil, atualizadoEm: lidoEm });
  });
}

/** O gate já conferiu o login. Um snapshot de outra conta pode trazer outras consultas pessoais e impede abrir a aba. */
export async function lerPerfilDoAparelho(conta: string): Promise<{ valor: LinhaPerfil; atualizadoEm: number } | undefined> {
  const geral = await lerConsultaGuardadaComData<LinhaPerfil | null>(["perfil"]);
  if (geral?.valor && geral.valor.user_id !== conta) return undefined;
  const propria = await bd().cache.get(`perfil-lido:${conta}`);
  const perfil = propria?.valor as LinhaPerfil | undefined;
  if (propria && perfil?.user_id === conta && Date.now() - propria.atualizadoEm <= VALIDADE_MS &&
      (!geral || propria.atualizadoEm > geral.atualizadoEm)) return { valor: perfil, atualizadoEm: propria.atualizadoEm };
  if (geral?.valor?.user_id === conta && Date.now() - geral.atualizadoEm <= VALIDADE_MS) {
    return { valor: geral.valor, atualizadoEm: geral.atualizadoEm };
  }
  return undefined;
}
