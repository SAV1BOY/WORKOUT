import { bd, temIndexedDB, type ItemCache } from "@/lib/db";
import { VALIDADE_MS } from "@/lib/persistencia-query";
import type { LinhaEstadoExercicio } from "@/lib/types";

const chave = (conta: string, exercicio: string) => "carga-lida:" + JSON.stringify([conta, exercicio]);

/** A ficha pode ser fechada antes do intervalo da persistência geral do React Query. */
export async function guardarCargasLidas(
  linhas: readonly LinhaEstadoExercicio[], lidoEm: number,
  escopo?: { conta: string; ids: readonly string[] },
): Promise<void> {
  if (!temIndexedDB()) return;
  const entradas = new Map<string, ItemCache>();
  // Uma resposta vazia só vale como ausência quando a consulta verificou o dono.
  if (escopo) {
    for (const id of escopo.ids) {
      const k = chave(escopo.conta, id);
      entradas.set(k, { chave: k, valor: null, atualizadoEm: lidoEm });
    }
  }
  for (const linha of linhas) {
    if (!linha.user_id || !linha.exercise_id) continue;
    const k = chave(linha.user_id, linha.exercise_id);
    if (escopo && !entradas.has(k)) continue;
    entradas.set(k, { chave: k, valor: linha, atualizadoEm: lidoEm });
  }
  if (!entradas.size) return;

  const banco = bd();
  await banco.transaction("rw", banco.cache, async () => {
    const registros = [...entradas.values()];
    const antigos = await banco.cache.bulkGet(registros.map(r => r.chave));
    // Uma consulta que começou antes pode chegar depois, inclusive de outra aba.
    const recentes = registros.filter((r, i) => !antigos[i] || antigos[i]!.atualizadoEm <= r.atualizadoEm);
    await banco.cache.bulkPut(recentes);
  });
}

export async function lerCargasNoAparelho(conta: string, ids: readonly string[]) {
  const cargas = new Map<string, { linha: LinhaEstadoExercicio | null; lidoEm: number }>();
  if (!temIndexedDB()) return cargas;
  const registros = await bd().cache.bulkGet(ids.map(id => chave(conta, id)));
  registros.forEach((r, i) => {
    if (!r || Date.now() - r.atualizadoEm > VALIDADE_MS) return;
    const id = ids[i]!;
    const linha = r.valor as LinhaEstadoExercicio | null;
    if (linha === null || (linha?.user_id === conta && linha.exercise_id === id)) {
      cargas.set(id, { linha, lidoEm: r.atualizadoEm });
    }
  });
  return cargas;
}
