/**
 * Sair é **deste** aparelho (SPEC §9, §21.4 e §22.11).
 *
 * Por que isto existe fora de `app/(auth)/login/acoes.ts`: aquele arquivo é
 * `"use server"` e o Vitest do projeto só carrega `lib/**` e `scripts/**`
 * (veja `vitest.config.ts`), então a regra ficava sem prova. A decisão — qual
 * escopo vai para o GoTrue — é uma linha de lógica e mora aqui, pura, com o
 * cliente entrando por parâmetro; a ação do servidor virou três linhas.
 *
 * O escopo padrão do `signOut` do GoTrue é `global` e revoga **todas** as
 * sessões da conta: o dono, com o celular e o navegador abertos, apertava
 * "Sair" num e o outro caía em 403 na primeira leitura. Quem quiser derrubar
 * todo mundo troca a senha. Os dados locais deste aparelho continuam sendo
 * apagados (§8).
 */

/** O único escopo que o app manda. Não há chamador que escolha outro. */
export const ESCOPO_DO_SAIR = "local" as const;

/** O pedaço do cliente do Supabase que sair() usa — nada além disto. */
export interface ClienteQueSai {
  auth: {
    signOut: (opcoes: { scope: "global" | "local" | "others" }) => Promise<unknown>;
  };
}

/**
 * Encerra a sessão **deste** aparelho. Devolve o que o cliente devolver, para
 * quem chamar poder olhar o erro se um dia quiser; hoje ninguém olha, porque
 * a tela de login é o destino mesmo quando o servidor recusa.
 */
export async function sairDesteAparelho(supabase: ClienteQueSai): Promise<unknown> {
  return supabase.auth.signOut({ scope: ESCOPO_DO_SAIR });
}
