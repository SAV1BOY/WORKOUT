import { replaceEqualDeep } from "@tanstack/react-query";
import { bd, temIndexedDB, type ItemSaida } from "@/lib/db";
import type { SessaoBruta } from "@/lib/progresso";
import { colunasDoHistorico, guardarRespostaDoDescarte } from "@/lib/queries/historico-da-sessao";
import { clienteNavegador } from "@/lib/supabase/client";

export async function enviarDescarteDaSessao(item: ItemSaida, id: string, dono: unknown) {
  const cliente = clienteNavegador();
  const contaAtual = async () => (await cliente.auth.getSession()).data.session?.user.id;
  const conta = await contaAtual();
  if (!conta || (dono !== undefined && dono !== conta)) throw new Error("Aguardando a conta que alterou o treino.");
  const lerSessao = async (): Promise<SessaoBruta | null> => {
    const { data, error } = await cliente.from("sessions").select(colunasDoHistorico)
      .eq("id", id).eq("user_id", conta).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  };
  // A fila antiga só identificava a sessão pelo UUID. A RLS e o próprio registro confirmam o dono antes do PATCH.
  let sessao = dono === undefined ? await lerSessao() : null;
  if (dono === undefined && (!sessao || sessao.id !== id || sessao.user_id !== conta)) {
    throw new Error("Aguardando a conta que alterou o treino.");
  }
  if (!sessao || sessao.status === "em_andamento") {
    const { data, error } = await cliente.from("sessions").update({ status: "abandonada" })
      .eq("id", id).eq("user_id", conta).eq("status", "em_andamento").select(colunasDoHistorico);
    if (error) throw new Error(error.message);
    // O outro aparelho pode ter concluído durante o descarte, ou a linha pode já ter sido removida.
    sessao = data?.[0] ?? await lerSessao();
  }
  if (await contaAtual() !== conta || (sessao && (sessao.user_id !== conta || sessao.id !== id || sessao.status === "em_andamento"))) {
    throw new Error("Reabra o treino para confirmar o descarte com a conta correta.");
  }
  if (!temIndexedDB()) return;
  const banco = bd();
  await banco.transaction("rw", banco.cache, banco.outbox, async () => {
    if (item.id !== undefined) {
      const atual = await banco.outbox.get(item.id);
      if (!atual || replaceEqualDeep(atual.payload, item.payload) !== atual.payload) return;
      await banco.outbox.delete(item.id);
    }
    await guardarRespostaDoDescarte(conta, id, sessao);
  });
  return "fila-reconciliada" as const;
}
