/**
 * Qual tela o player mostra enquanto a sessão não chegou (SPEC §22.11).
 *
 * Por que existe: em 21/09/2026, abrir a sessão em andamento logo depois do
 * login num aparelho sem nada no IndexedDB mostrou "Não achei este treino. Ele
 * pode ter sido registrado em outro aparelho." com a sessão existindo no
 * banco — 1 em 4 aberturas, e "Tentar de novo" resolvia. A tela decidia com um
 * único `carregando` que virava `false` antes de a linha do servidor chegar (ou
 * antes de o motor ter o que precisa para refazer a sessão), e afirmava um erro
 * definitivo onde ainda era carregamento. Afirmar "não achei" cedo demais é
 * pior do que esperar: quem lê isso acha que perdeu o treino.
 *
 * São duas buscas independentes — o aparelho (Dexie) e o servidor (Supabase) —
 * e a tela só pode dizer "não achei" quando as **duas** terminaram sem nada.
 * A decisão é pura para caber num teste (`lib/estado-do-player.test.ts`): a
 * corrida que gerou o defeito é de milissegundos e não se reproduz na mão.
 */

export type TelaDosDados = "carregando" | "nao-achei" | "erro" | "pronto";

export type EntradaDaTela = {
  /** A busca no aparelho terminou (achou ou não achou). */
  localTerminou: boolean;
  /**
   * O servidor terminou **e** não há nada para montar: ou a linha não existe,
   * ou ela existe e a remontagem já foi tentada e não deu sessão. Enquanto a
   * consulta corre, ou enquanto a remontagem ainda vai acontecer, é `false`.
   */
  servidorTerminou: boolean;
  /** A sessão que a tela tem em mãos — qualquer valor não nulo vale. */
  sessao: unknown;
  /** Erro de verdade de alguma das consultas. */
  erro: unknown;
};

export function decidirTela(entrada: EntradaDaTela): TelaDosDados {
  // ter a sessão manda em tudo: o servidor pode ter falhado depois de ela
  // chegar do aparelho, e o treino continua
  if (entrada.sessao) return "pronto";
  if (!entrada.localTerminou) return "carregando";
  // erro de rede é "tentar de novo", nunca "não achei"
  if (entrada.erro) return "erro";
  if (!entrada.servidorTerminou) return "carregando";
  return "nao-achei";
}

export type EntradaDoServidor = {
  /**
   * `isPending` da consulta da sessão: ela **nunca** respondeu desde que
   * montou. Repare que não é `isFetching`: um refetch de fundo (voltar para a
   * aba, reconectar, "Tentar de novo") deixa `isFetching` verdadeiro com o
   * dado antigo em mãos, e usá-lo aqui rebaixava um "não achei" já decidido
   * para esqueleto — a tela piscava sozinha.
   */
  sessaoPendente: boolean;
  /** `isPending` da consulta das séries. */
  seriesPendente: boolean;
  /** A linha que o servidor devolveu para esta sessão — `null` se não há. */
  linhaDoServidor: unknown;
  /** A remontagem a partir da linha já foi tentada e não deu sessão. */
  montagemFalhou: boolean;
};

/**
 * O servidor terminou **e** não há nada para montar. É o `servidorTerminou`
 * que `decidirTela` recebe: enquanto alguma das duas consultas nunca
 * respondeu, ou enquanto a linha existe e a remontagem ainda pode acontecer,
 * a resposta é `false` e a tela segue em esqueleto.
 */
export function servidorTerminouDeBuscar(entrada: EntradaDoServidor): boolean {
  if (entrada.sessaoPendente || entrada.seriesPendente) return false;
  return entrada.linhaDoServidor == null || entrada.montagemFalhou;
}
