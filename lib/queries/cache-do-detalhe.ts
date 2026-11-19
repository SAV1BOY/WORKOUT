import { chaveDoDetalheDaSessao, prefixoDosDetalhesDaConta } from "@/lib/chaves-do-historico";
import { bd } from "@/lib/db";
import { guardarNaFila, processar } from "@/lib/outbox";
import { alvoDaEscrita, type EscritaTabela } from "@/lib/outbox-supabase";
import type { Linha } from "@/lib/backup";
import type { LinhaSerie } from "@/lib/types";

/** Chamado na transação que fecha o treino, antes que outra aba possa enviar as séries da fila. */
export async function gravarDetalheDaSessao(conta: string, sessaoId: string, series: LinhaSerie[]) {
  if (!series.every(s => s.user_id === conta && s.session_id === sessaoId && s.concluida)) {
    throw new Error("As séries não correspondem ao treino encerrado.");
  }
  await bd().cache.put({ chave: chaveDoDetalheDaSessao(conta, sessaoId), valor: series, atualizadoEm: Date.now() });
}

/** As séries feitas são reenviadas antes da linha que encerra o treino, com o mesmo alvo na fila. */
export async function encerramentosPendentes(conta: string): Promise<Set<string>> {
  const fechamentos = new Set<string>();
  for (const item of await bd().outbox.where("tipo").equals("sessao").toArray()) {
    const escrita = item.payload as EscritaTabela;
    if (escrita.tabela !== "sessions") continue;
    for (const linha of escrita.linhas ?? (escrita.linha ? [escrita.linha] : [])) {
      const id = linha.id ?? escrita.filtro?.id;
      if ((linha.user_id ?? escrita.filtro?.user_id) === conta && typeof id === "string" &&
          (linha.status === "concluida" || linha.status === "abandonada")) {
        fechamentos.add(id);
      }
    }
  }
  return fechamentos;
}

/** A lista completa já foi gravada na mesma transação. Fechamentos posteriores ainda precisam de sua cópia. */
export async function retirarDetalhesCobertos(conta: string, inicioDaLeitura: number) {
  const banco = bd();
  const prefixo = prefixoDosDetalhesDaConta(conta);
  const anteriores = await banco.cache.where("chave").startsWith(prefixo)
    .filter(item => item.atualizadoEm < inicioDaLeitura).primaryKeys();
  if (!anteriores.length) return;
  const ids = await encerramentosPendentes(conta);
  const fechamentos = new Set([...ids].map(id => chaveDoDetalheDaSessao(conta, id)));
  // O servidor ainda não confirmou o fechamento. No detalhe, o empate com esse GET favorece a cópia do aparelho.
  for (const chave of anteriores) {
    if (fechamentos.has(chave)) await banco.cache.update(chave, { atualizadoEm: inicioDaLeitura });
  }
  await banco.cache.bulkDelete(anteriores.filter(chave => !fechamentos.has(chave)));
}

/** O backup faz upsert por id. Um arquivo parcial conserva as séries ausentes e não comprova um treino inteiro. */
export async function enfileirarSeriesDoBackup(conta: string, lote: Linha[], onConflict: string) {
  const banco = bd();
  const escrita: EscritaTabela = { tabela: "session_sets", op: "upsert", linhas: lote, onConflict };
  const porId = new Map<string, Linha>();
  const porSessao = new Map<string, Linha[]>();
  for (const linha of lote) {
    if (linha.user_id !== conta || typeof linha.id !== "string" || typeof linha.session_id !== "string") {
      throw new Error("As séries do backup precisam pertencer a um treino da conta.");
    }
    porId.set(linha.id, linha);
    const lista = porSessao.get(linha.session_id) ?? [];
    lista.push(linha);
    porSessao.set(linha.session_id, lista);
  }
  const prefixo = prefixoDosDetalhesDaConta(conta);
  await banco.transaction("rw", banco.cache, banco.outbox, async () => {
    await guardarNaFila("serie", escrita, alvoDaEscrita(escrita));
    for (const item of await banco.cache.where("chave").startsWith(prefixo).toArray()) {
      const id = item.chave.slice(prefixo.length);
      const linhas = item.valor;
      if (!Array.isArray(linhas) || !linhas.every(s => s?.user_id === conta && s.session_id === id && typeof s.id === "string")) continue;
      const importadas = porSessao.get(id) ?? [];
      if (!importadas.length && !linhas.some(s => porId.has(s.id))) continue;
      const salvas = new Map<string, Linha>(linhas.map(s => [s.id, s]));
      // Um arquivo pode corrigir também o treino a que pertence um UUID.
      for (const s of linhas) if (porId.has(s.id) && porId.get(s.id)?.session_id !== id) salvas.delete(s.id);
      for (const nova of importadas) {
        const serieId = nova.id as string;
        const linha = { ...salvas.get(serieId), ...nova };
        if (linha.concluida === false) salvas.delete(serieId);
        else salvas.set(serieId, linha);
      }
      const valor = [...salvas.values()];
      if (valor.every(s => s.concluida === true && typeof s.exercise_id === "string" &&
        (s.tipo === "trabalho" || s.tipo === "aquecimento") && typeof s.set_index === "number")) {
        await banco.cache.put({ chave: item.chave, valor, atualizadoEm: Date.now() });
      } else {
        // Uma linha nova sem prescrição identificável precisa dos padrões aplicados pelo banco.
        await banco.cache.delete(item.chave);
      }
    }
  });
  void processar();
}
