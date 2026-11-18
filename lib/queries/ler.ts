import { CHAVE_DA_TABELA, type TabelaBackup } from "@/lib/tabelas-do-usuario";
import { clienteNavegador } from "@/lib/supabase/client";

/**
 * Leitura do Supabase com erro em português.
 *
 * Estava duplicada, igual, em `progresso.ts` e `corpo.ts`. Fica num arquivo só
 * porque toda leitura do app trata o erro do mesmo jeito: a mensagem vai para
 * a tela, e a lista vazia é resposta legítima (usuário novo, semana sem nada).
 */
export interface Resposta<T> {
  data: T | null;
  error: { message: string } | null;
}

export async function lerLista<T>(
  promessa: PromiseLike<Resposta<T[]>>,
  oQue: string,
): Promise<T[]> {
  const { data, error } = await promessa;
  if (error) throw new Error(`Não consegui carregar ${oQue}. ${error.message}`);
  return data ?? [];
}

/**
 * Pagina por chave, sem deslocamento: exclusões entre páginas não pulam a
 * linha seguinte. A RLS limita as leituras a uma conta, então exercise_id
 * identifica cada exercise_state dela, mesmo com a chave composta.
 */
export async function lerTabelaCompleta<T>(
  tabela: TabelaBackup,
  colunas: string,
  oQue: string,
  userId?: string,
): Promise<T[]> {
  const chave = CHAVE_DA_TABELA[tabela].at(-1)!;
  const linhas: T[] = [];
  let depoisDe: string | undefined;
  for (;;) {
    let consulta = clienteNavegador()
      .from(tabela)
      .select(colunas, depoisDe === undefined ? { count: "exact" } : {})
      .order(chave)
      .limit(1000);
    if (userId !== undefined) consulta = consulta.eq("user_id", userId);
    if (depoisDe !== undefined) consulta = consulta.gt(chave, depoisDe);

    const { data, error, count }: Resposta<(T & Record<string, unknown>)[]> & {
      count: number | null;
    } = await consulta;
    if (error) throw new Error(`Não consegui carregar ${oQue}. ${error.message}`);
    if (!data?.length) return linhas;
    linhas.push(...data);

    // O servidor pode entregar menos que o limite pedido. A contagem da
    // primeira página evita uma ida extra no caso normal de histórico curto.
    if (depoisDe === undefined && count === linhas.length) return linhas;
    const ultimo = data[data.length - 1]?.[chave];
    if (typeof ultimo !== "string" || ultimo === depoisDe) {
      throw new Error(`Não consegui continuar a leitura de ${oQue}.`);
    }
    depoisDe = ultimo;
  }
}
