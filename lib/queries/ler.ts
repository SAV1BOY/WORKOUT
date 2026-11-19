import { CHAVE_DA_TABELA, type TabelaBackup } from "@/lib/tabelas-do-usuario";
import { clienteNavegador } from "@/lib/supabase/client";

/**
 * Leitura do Supabase com erro em português.
 *
 * Estava duplicada, igual, em `progresso.ts` e `corpo.ts`. Fica num arquivo só
 * porque toda leitura do app trata o erro do mesmo jeito: a mensagem vai para
 * a tela, e a lista vazia é resposta legítima (usuário novo, semana sem nada).
 */
export class FalhaDeRedeNaTabela extends Error {}

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
 * linha seguinte. A RLS limita a consulta a uma conta. Nas trocas do
 * programa, o mesmo exercício pode ser a chave de vários treinos.
 */
export async function lerTabelaCompleta<T>(
  tabela: TabelaBackup,
  colunas: string,
  oQue: string,
  userId?: string,
  sinal?: AbortSignal,
  filtro?: string | { de: string; ate: string },
): Promise<T[]> {
  const colunasChave = CHAVE_DA_TABELA[tabela];
  const chave = colunasChave.at(-1)!;
  const grupo = colunasChave.find((c) => c !== "user_id" && c !== chave);
  const linhas: T[] = [];
  let depoisDe: string | undefined;
  let ultimoGrupo: string | undefined;
  for (;;) {
    sinal?.throwIfAborted();
    let consulta = clienteNavegador()
      .from(tabela)
      .select(colunas, linhas.length === 0 ? { count: "exact" } : {})
      .limit(1000);
    if (userId !== undefined) consulta = consulta.eq("user_id", userId);
    if (typeof filtro === "string") consulta = consulta.eq("session_id", filtro);
    else if (filtro) consulta = consulta.gte("data", filtro.de).lte("data", filtro.ate);
    if (grupo) {
      consulta = consulta.order(grupo);
      if (ultimoGrupo !== undefined) {
        // Primeiro esgota os exercícios do treino onde a página terminou.
        consulta = depoisDe === undefined ? consulta.gt(grupo, ultimoGrupo) : consulta.eq(grupo, ultimoGrupo);
      }
    }
    consulta = consulta.order(chave);
    if (depoisDe !== undefined) consulta = consulta.gt(chave, depoisDe);
    if (sinal) consulta = consulta.abortSignal(sinal);

    const { data, error, count, status }: Resposta<(T & Record<string, unknown>)[]> & {
      status: number;
      count: number | null;
    } = await consulta;
    sinal?.throwIfAborted();
    if (error) {
      const mensagem = `Não consegui carregar ${oQue}. ${error.message}`;
      throw status === 0 ? new FalhaDeRedeNaTabela(mensagem) : new Error(mensagem);
    }
    if (!data?.length) {
      if (grupo && depoisDe !== undefined) {
        depoisDe = undefined;
        continue; // acabou este treino; busca os treinos seguintes
      }
      return linhas;
    }
    linhas.push(...data);

    // O servidor pode entregar menos que o limite pedido. A contagem da
    // primeira página evita uma ida extra no caso normal de histórico curto.
    if (count === linhas.length) return linhas;
    const ultimaLinha = data[data.length - 1]!;
    const ultimo = ultimaLinha[chave];
    const proximoGrupo = grupo ? ultimaLinha[grupo] : undefined;
    if (typeof ultimo !== "string" || (grupo && typeof proximoGrupo !== "string") ||
      (ultimo === depoisDe && proximoGrupo === ultimoGrupo)) {
      throw new Error(`Não consegui continuar a leitura de ${oQue}.`);
    }
    depoisDe = ultimo;
    if (typeof proximoGrupo === "string") ultimoGrupo = proximoGrupo;
  }
}
