import { chaveDoHistorico, chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";
import type { QueryClient } from "@tanstack/react-query";
import { bd, lerCache, temIndexedDB } from "@/lib/db";
import { guardarNaFila, processar } from "@/lib/outbox";
import { alvoDaEscrita, type EscritaTabela } from "@/lib/outbox-supabase";
import type { SessaoBruta } from "@/lib/progresso";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { FalhaDeRedeNaTabela, lerTabelaCompleta } from "@/lib/queries/ler";
import { MENSAGEM_NOTA_GERAL_ALTERADA, type Conclusao } from "@/lib/sessao";
import { lerConsultaGuardada } from "@/lib/persistencia-query";
import { gravarDetalheDaSessao } from "@/lib/queries/cache-do-detalhe";
import type { LinhaSerie } from "@/lib/types";

export { chaveDoHistorico } from "@/lib/chaves-do-historico";

const colunas = "id,user_id,data,status,workout_id,iniciada_em,duracao_s,plano,nota_geral";

function substituirSessao(lista: SessaoBruta[], sessao: SessaoBruta): SessaoBruta[] {
  return [sessao, ...lista.filter(s => s.id !== sessao.id)].sort((a, b) => b.data.localeCompare(a.data));
}

async function baseNoDisco(cliente: QueryClient, conta: string): Promise<SessaoBruta[] | undefined> {
  const anterior = ["progresso", "sessoes"] as const;
  const lista = await lerCache<SessaoBruta[]>(chaveDoHistoricoNoDisco(conta))
    ?? cliente.getQueryData<SessaoBruta[]>(chaveDoHistorico(conta))
    ?? cliente.getQueryData<SessaoBruta[]>(anterior)
    ?? await lerConsultaGuardada<SessaoBruta[]>(anterior);
  return lista?.filter(s => s.user_id === conta);
}

async function guardarLista(conta: string, valor: SessaoBruta[]): Promise<void> {
  await bd().cache.put({ chave: chaveDoHistoricoNoDisco(conta), valor, atualizadoEm: Date.now() });
}

/** A fila ordena as escritas pelo id do treino. Só conclusão ou nota afetam esta leitura. */
type AlteracaoPendente = { fechamento?: boolean; nota?: string | null };

async function escritasPendentes(conta: string) {
  const porId = new Map<string, AlteracaoPendente>();
  for (const item of await bd().outbox.where("tipo").equals("sessao").toArray()) {
    const p = item.payload as EscritaTabela;
    const id = p.filtro?.id ?? p.linha?.id;
    if (p.tabela !== "sessions" || (p.filtro?.user_id ?? p.linha?.user_id) !== conta || typeof id !== "string") continue;
    const alteracao = porId.get(id) ?? {};
    if (p.linha?.status === "concluida" || p.linha?.status === "abandonada") alteracao.fechamento = true;
    if (p.linha?.nota_geral === null || typeof p.linha?.nota_geral === "string") alteracao.nota = p.linha.nota_geral;
    if (alteracao.fechamento || alteracao.nota !== undefined) porId.set(id, alteracao);
  }
  return porId;
}

export async function lerHistoricoDaConta(cliente: QueryClient, conta: string, sinal?: AbortSignal): Promise<SessaoBruta[]> {
  const consultar = () => lerTabelaCompleta<SessaoBruta>("sessions", colunas, "os seus treinos", conta);
  if (!temIndexedDB()) return consultar();
  const banco = bd();
  const antes = await banco.transaction("r", banco.cache, banco.outbox, async () => ({
    sessoes: await baseNoDisco(cliente, conta), pendentes: await escritasPendentes(conta),
  }));
  if (navigator.onLine === false) return antes.sessoes ?? [];
  let remotas: SessaoBruta[];
  try {
    remotas = await consultar();
  } catch (erro) {
    sinal?.throwIfAborted();
    if (erro instanceof FalhaDeRedeNaTabela || erro instanceof TypeError) {
      const local = await baseNoDisco(cliente, conta);
      if (local) return local;
    }
    throw erro;
  }
  sinal?.throwIfAborted();
  return banco.transaction("rw", banco.cache, banco.outbox, async () => {
    const atuais = await baseNoDisco(cliente, conta) ?? [];
    const pendentes = await escritasPendentes(conta);
    sinal?.throwIfAborted();
    // Uma consulta iniciada antes da edição pode responder depois de a fila da outra aba esvaziar.
    const porId = new Map(remotas.map(s => [s.id, s]));
    const anteriores = new Map(antes.sessoes?.map(s => [s.id, s]));
    for (const s of atuais) {
      const anterior = anteriores.get(s.id);
      const remota = porId.get(s.id);
      if (remota && s.revisaoDaNotaLocal !== undefined) {
        porId.set(s.id, { ...remota, revisaoDaNotaLocal: s.revisaoDaNotaLocal });
      }
      const fila = { ...antes.pendentes.get(s.id), ...pendentes.get(s.id) };
      if (fila.fechamento || s.status !== anterior?.status) {
        porId.set(s.id, s);
      }
      if (anterior && (s.nota_geral !== anterior.nota_geral || s.revisaoDaNotaLocal !== anterior.revisaoDaNotaLocal)) {
        // A edição em outra aba pode já ter chegado ao servidor durante a consulta.
        pendentes.set(s.id, { ...fila, nota: s.nota_geral ?? null });
      }
    }
    // Uma edição da nota não pode reabrir uma sessão encerrada em outro aparelho.
    for (const [id, alteracao] of [...antes.pendentes, ...pendentes]) {
      const sessao = porId.get(id);
      if (sessao && alteracao.nota !== undefined) porId.set(id, { ...sessao, nota_geral: alteracao.nota });
    }
    const resultado = [...porId.values()].sort((a, b) => b.data.localeCompare(a.data));
    await guardarLista(conta, resultado);
    return resultado;
  });
}

/** Dentro da mesma transação que remove a sessão aberta e enfileira a sua conclusão. */
export async function guardarConclusaoNoHistorico(
  cliente: QueryClient, conclusao: Conclusao, nota: string | null | undefined, series: LinhaSerie[],
) {
  const linha = conclusao.escritas.find(e => e.tabela === "sessions")!.linha as SessaoBruta;
  const conta = linha.user_id!;
  const lista = await baseNoDisco(cliente, conta) ?? [];
  const anterior = lista.find(s => s.id === linha.id);
  const registro: SessaoBruta = {
    id: linha.id, data: linha.data, workout_id: linha.workout_id, user_id: conta,
    status: linha.status, duracao_s: linha.duracao_s, plano: linha.plano,
    iniciada_em: linha.iniciada_em ?? anterior?.iniciada_em,
    nota_geral: nota === undefined ? anterior?.nota_geral : nota,
    seriesDeTrabalhoLocais: series.filter(s => s.tipo === "trabalho").length,
    revisaoDaNotaLocal: anterior?.revisaoDaNotaLocal,
  };
  const historico = substituirSessao(lista, registro);
  await guardarLista(conta, historico);
  await gravarDetalheDaSessao(conta, linha.id, series);
  return historico;
}

export async function editarNotaNoHistorico(
  cliente: QueryClient, conta: string, sessao: SessaoBruta, texto: string, notaAoAbrir: string | null,
): Promise<void> {
  if (sessao.user_id !== conta || sessao.status !== "concluida") throw new Error("Esta anotação pertence a outro treino.");
  await confirmarContaDoTreino(conta, "Não foi possível confirmar a conta deste treino.");
  const chave = chaveDoHistorico(conta);
  await cliente.cancelQueries({ queryKey: chave, exact: true });
  const nota = texto.trim() || null;
  const banco = bd();
  const { lista, conflito } = await banco.transaction("rw", banco.cache, banco.outbox, async () => {
    const lista = await baseNoDisco(cliente, conta) ?? [];
    const atual = lista.find(s => s.id === sessao.id);
    if (!atual || atual.status !== "concluida") throw new Error("Reabra o histórico para atualizar o treino.");
    if ((atual.nota_geral ?? null) === nota) return { lista, conflito: false };
    if ((atual.nota_geral ?? null) !== notaAoAbrir) return { lista, conflito: true };
    const escrita: EscritaTabela = {
      tabela: "sessions", op: "update", linha: { nota_geral: nota },
      filtro: { id: sessao.id, user_id: conta, status: "concluida" },
    };
    await guardarNaFila("sessao", escrita, alvoDaEscrita(escrita));
    const salva = substituirSessao(lista, { ...atual, nota_geral: nota, revisaoDaNotaLocal: (atual.revisaoDaNotaLocal ?? 0) + 1 });
    await guardarLista(conta, salva);
    return { lista: salva, conflito: false };
  });
  cliente.setQueryData(chave, lista);
  if (conflito) throw new Error(MENSAGEM_NOTA_GERAL_ALTERADA);
  void processar();
}
