import { AVISO_CATALOGO_DA_SESSAO, idsDaSessaoRemota, sessaoLocalComExercicioDesconhecido } from "@/lib/compatibilidade-da-sessao";
import { exercicioPorId } from "@/lib/dados";
import { bd, lerCache, temIndexedDB, type ItemCache } from "@/lib/db";

/** Um snapshot pode ter sido projetado por uma versão que ignorava esses IDs. */
function chaveDaEvidencia(conta: string, id: string) {
  return `compatibilidade-da-sessao:${encodeURIComponent(conta)}:${id}`;
}

export async function lerIdsDaSessaoProtegida(conta: string, id: string): Promise<string[]> {
  if (!temIndexedDB()) return [];
  const valor = await lerCache<unknown>(chaveDaEvidencia(conta, id));
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
}

/** A notificação entre abas pode chegar depois do toque. Confira dentro da transação que gravará a sessão. */
export async function conferirCatalogoParaEditar(conta: string, id: string, snapshot: unknown): Promise<void> {
  if (sessaoLocalComExercicioDesconhecido(snapshot) || (await lerIdsDaSessaoProtegida(conta, id)).length > 0) {
    throw new Error(AVISO_CATALOGO_DA_SESSAO);
  }
}

/** A geração lida antes da consulta identifica inclusive duas confirmações consecutivas do mesmo exercício. */
export async function lerRevisaoDaProtecao(conta: string, id: string): Promise<string | null> {
  const registro: (ItemCache & { revisao?: string }) | undefined = await bd().cache.get(chaveDaEvidencia(conta, id));
  return registro ? registro.revisao ?? `legada:${registro.atualizadoEm}` : null;
}

export async function confirmarIdsDaSessaoProtegida(conta: string, id: string, ids: string[]): Promise<string[]> {
  const banco = bd();
  return banco.transaction("rw", banco.cache, async () => {
    const anteriores = await lerIdsDaSessaoProtegida(conta, id);
    const todos = [...new Set([...anteriores, ...ids])];
    const prova = { chave: chaveDaEvidencia(conta, id), valor: todos, atualizadoEm: Date.now(), revisao: crypto.randomUUID() };
    await banco.cache.put(prova);
    return todos;
  });
}

/** Uma resposta nova do servidor renova a prova mesmo quando informa o mesmo ID já presente no cache. */
export async function confirmarCatalogoLido(conta: string, id: string, plano: unknown, series?: readonly unknown[]) {
  const desconhecidos = idsDaSessaoRemota(plano, series, conta, id).filter(exercicio => !exercicioPorId.has(exercicio));
  if (desconhecidos.length) await confirmarIdsDaSessaoProtegida(conta, id, desconhecidos);
}

export async function liberarSessaoProtegida(conta: string, id: string, revisao: string): Promise<void> {
  const banco = bd();
  return banco.transaction("rw", banco.cache, async () => {
    if (await lerRevisaoDaProtecao(conta, id) === revisao) await banco.cache.delete(chaveDaEvidencia(conta, id));
  });
}
