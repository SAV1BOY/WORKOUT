import { clienteNavegador } from "@/lib/supabase/client";

type Linha = Record<string, unknown>;
export type DecisaoSobreRegistro = { usar: "aparelho" | "historico"; observada: Linha };
export type PropostaNaAusencia = { insercao: Linha; confirmada: boolean; manterAusencia?: boolean };
export type ResultadoDaRecuperacao = { estado: "confirmada" | "conflito" | "confirmar-insercao" | "ausencia-mantida"; linha: Linha };

/** Leitura por UUID, inserção sem sobrescrita e atualização condicional para registros recuperados da fila antiga. */
export async function registroRemotoEmRecuperacao(
  nome: "session_sets" | "cardio_sessions", conta: string, id: string, validar: (linha: Linha) => boolean,
) {
  const descricao = nome === "session_sets" ? "a série" : "a sessão de cardio";
  const cliente = clienteNavegador();
  const { data, error } = await cliente.auth.getSession();
  if (error || data.session?.user.id !== conta) throw new Error(`Aguardando a conta que corrigiu ${descricao}.`);
  const tabela = () => cliente.from(nome);

  function unica(resposta: { data: unknown; error: { message: string } | null }): Linha | null {
    if (resposta.error) throw new Error(resposta.error.message);
    if (Array.isArray(resposta.data) && !resposta.data.length) return null;
    const linha = Array.isArray(resposta.data) && resposta.data.length === 1 ? resposta.data[0] : null;
    if (!linha || linha.user_id !== conta || linha.id !== id || !validar(linha)) {
      throw new Error(`A resposta não confirmou ${descricao} desta conta.`);
    }
    return linha;
  }

  const buscar = async () => unica(await tabela().select("*").eq("user_id", conta).eq("id", id));
  return {
    buscar,
    async inserirSeAusente(linha: Linha) {
      const insercao = await tabela().upsert(linha, { onConflict: "id", ignoreDuplicates: true });
      if (insercao.error) throw new Error(insercao.error.message);
      // ON CONFLICT DO NOTHING também tem sucesso. Só a releitura comprova o que ficou salvo.
      return buscar();
    },
    async atualizarSeIgual(alteracoes: Linha, observada: Linha, conferir: readonly string[]) {
      let atualizacao = tabela().update(alteracoes).eq("user_id", conta).eq("id", id);
      for (const coluna of conferir) {
        const valor = observada[coluna];
        atualizacao = valor === null ? atualizacao.is(coluna, null) : atualizacao.eq(coluna, valor);
      }
      return unica(await atualizacao.select("*")) ?? await buscar();
    },
  };
}
