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
