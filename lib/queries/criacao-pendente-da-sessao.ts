import { bd, temIndexedDB, type SessaoAtiva } from "@/lib/db";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import type { SessaoResumo } from "@/lib/queries/dados";
import { lerComOrdemLocal } from "@/lib/queries/ordem-local-da-sessao";
import type { SessaoLocal } from "@/lib/sessao";

function copiaAbertaDaConta(item: SessaoAtiva, conta: string): boolean {
  const sessao = item.dados as SessaoLocal | null;
  return sessao?.userId === conta && sessao.id === item.id && sessao.status === "em_andamento";
}

/** Uma lista vazia do servidor ainda pode anteceder a confirmação da criação guardada na fila. */
export async function lerCriacaoPendenteNaTransacao(conta: string, encerradas?: ReadonlySet<string>): Promise<SessaoLocal | null> {
  const banco = bd();
  const criacoes = new Set<string>();
  const fechamentos = new Set(encerradas);
  await banco.outbox.where("tipo").equals("sessao").each(({ payload }) => {
    const escrita = payload as Partial<EscritaTabela> | null;
    if (escrita?.tabela !== "sessions" || escrita.linhas || !escrita.linha) return;
    const { linha, filtro, op } = escrita;
    const id = linha.id ?? filtro?.id;
    if (typeof id !== "string" || (linha.user_id ?? filtro?.user_id) !== conta) return;
    if (linha.status === "concluida" || linha.status === "abandonada") fechamentos.add(id);
    if ((op === "upsert" || op === "insert") && linha.status === "em_andamento") criacoes.add(id);
  });
  const ids = [...criacoes].filter(id => !fechamentos.has(id));
  if (!ids.length) return null;
  let recente: SessaoAtiva | undefined;
  for (const item of await banco.sessaoAtiva.bulkGet(ids)) {
    if (item && copiaAbertaDaConta(item, conta) && (!recente || item.atualizadoEm > recente.atualizadoEm)) recente = item;
  }
  return recente ? lerComOrdemLocal(recente.dados as SessaoLocal) : null;
}

export async function sessaoLocalComCriacaoPendente(conta: string, encerradas?: ReadonlySet<string>): Promise<SessaoLocal | null> {
  if (!temIndexedDB()) return null;
  const banco = bd();
  return banco.transaction("r", banco.outbox, banco.sessaoAtiva, banco.cache, () => lerCriacaoPendenteNaTransacao(conta, encerradas));
}

export function resumoDaCriacao(sessao: SessaoLocal): SessaoResumo {
  return {
    id: sessao.id, user_id: sessao.userId, data: sessao.data, status: "em_andamento",
    workout_id: sessao.workoutId, fase: sessao.fase, concluida_em: null,
  };
}

async function observarAbertasNoAparelho(conta: string) {
  const banco = bd();
  return banco.transaction("r", banco.outbox, banco.sessaoAtiva, banco.cache, async () => {
    const ids = await banco.sessaoAtiva.filter(item => copiaAbertaDaConta(item, conta)).primaryKeys();
    const pendente = await lerCriacaoPendenteNaTransacao(conta);
    return { ids: new Set(ids), pendente };
  });
}

/** Uma cópia pode nascer e seu POST terminar enquanto o GET anterior está em trânsito. */
export async function listarAbertasComCriacaoPendente(conta: string, ler: () => Promise<SessaoResumo[]>): Promise<SessaoResumo[]> {
  if (!temIndexedDB()) return ler();
  let antes = await observarAbertasNoAparelho(conta);
  for (;;) {
    const linhas = await ler();
    const depois = await observarAbertasNoAparelho(conta);
    const presentes = new Set(linhas.filter(s => s.user_id === conta).map(s => s.id));
    const pendente = depois.pendente;
    const saiuDaFila = antes.pendente && antes.pendente.id !== pendente?.id && !presentes.has(antes.pendente.id);
    const novaCopia = [...depois.ids].some(id => !antes.ids.has(id) && id !== pendente?.id && !presentes.has(id));
    // Uma cópia sem criação pendente só justifica reler o servidor. Ele pode já tê-la encerrado.
    if (!saiuDaFila && !novaCopia) {
      return pendente && !presentes.has(pendente.id) ? [resumoDaCriacao(pendente), ...linhas] : linhas;
    }
    antes = depois;
  }
}
