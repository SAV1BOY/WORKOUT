import { chaveDoHistorico, chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";
import type { QueryClient } from "@tanstack/react-query";
import { bd, lerCache, temIndexedDB, type SessaoAtiva } from "@/lib/db";
import { guardarNaFila, processar } from "@/lib/outbox";
import { alvoDaEscrita, type EscritaTabela } from "@/lib/outbox-supabase";
import type { SessaoBruta } from "@/lib/progresso";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { FalhaDeRedeNaTabela, lerTabelaCompleta } from "@/lib/queries/ler";
import { MENSAGEM_NOTA_GERAL_ALTERADA, type Conclusao, type SessaoLocal } from "@/lib/sessao";
import { lerConsultaGuardada } from "@/lib/persistencia-query";
import { gravarDetalheDaSessao } from "@/lib/queries/cache-do-detalhe";
import type { LinhaSerie } from "@/lib/types";

export { chaveDoHistorico } from "@/lib/chaves-do-historico";

export const colunasDoHistorico = "id,user_id,data,status,workout_id,iniciada_em,duracao_s,plano,nota_geral";

function substituirSessao(lista: SessaoBruta[], sessao: SessaoBruta): SessaoBruta[] {
  return [sessao, ...lista.filter(s => s.id !== sessao.id)].sort((a, b) => b.data.localeCompare(a.data));
}

type Cobertura = { completa: boolean; ausentes: string[] };
const chaveDaCobertura = (conta: string) => "cobertura-do-historico-de-forca:" + conta;

export async function baseDoHistoricoNoDisco(cliente: QueryClient | undefined, conta: string): Promise<SessaoBruta[] | undefined> {
  const arquivo = await lerCache<SessaoBruta[]>(chaveDoHistoricoNoDisco(conta));
  const cobertura = await lerCache<Cobertura>(chaveDaCobertura(conta));
  const daConta = (linhas: SessaoBruta[]) => linhas.filter(s => s.user_id === conta);
  // No #54 uma conclusão local podia criar o arquivo antes de qualquer visita ao Relatório.
  // A resposta integral antiga, inclusive a vazia, é autoritativa. Linhas montadas pela
  // conclusão têm contagem local; um arquivo composto só por elas ainda pode ser parcial.
  if (arquivo && (cobertura?.completa || (!cobertura && (!arquivo.length ||
      arquivo.some(s => s.seriesDeTrabalhoLocais === undefined))))) return daConta(arquivo);
  const anteriores = ["progresso", "sessoes"] as const, recentes = ["sessoes"] as const;
  const legado = cliente?.getQueryData<SessaoBruta[]>(anteriores) ?? await lerConsultaGuardada<SessaoBruta[]>(anteriores);
  const resumo = cliente?.getQueryData<SessaoBruta[]>(recentes) ?? await lerConsultaGuardada<SessaoBruta[]>(recentes);
  const memoria = cliente?.getQueryData<SessaoBruta[]>(chaveDoHistorico(conta));
  if (!resumo && !legado && !memoria && !arquivo) return;
  const ausentes = new Set(cobertura?.ausentes);
  const porId = new Map<string, SessaoBruta>();
  for (const lista of [resumo, legado, memoria, arquivo]) {
    for (const s of lista ?? []) {
      if (s.user_id !== conta || ausentes.has(s.id)) continue;
      const anterior = porId.get(s.id);
      if (s.status === "em_andamento" && anterior && anterior.status !== "em_andamento") continue;
      porId.set(s.id, { ...anterior, ...s });
    }
  }
  return [...porId.values()].sort((a, b) => b.data.localeCompare(a.data));
}

async function guardarLista(conta: string, valor: SessaoBruta[]): Promise<void> {
  const banco = bd(), chave = chaveDaCobertura(conta), atualizadoEm = Date.now();
  if (!await lerCache<Cobertura>(chave)) {
    const arquivo = await lerCache<SessaoBruta[]>(chaveDoHistoricoNoDisco(conta));
    const completa = !!arquivo && (!arquivo.length || arquivo.some(s => s.seriesDeTrabalhoLocais === undefined));
    await banco.cache.put({ chave, valor: { completa, ausentes: [] }, atualizadoEm });
  }
  await banco.cache.put({ chave: chaveDoHistoricoNoDisco(conta), valor, atualizadoEm });
}

/** A fila ordena as escritas pelo id do treino. Só conclusão ou nota afetam esta leitura. */
type AlteracaoPendente = { fechamento?: boolean; descarteLegado?: boolean; nota?: string | null };

async function escritasPendentes(conta: string) {
  const porId = new Map<string, AlteracaoPendente>();
  for (const item of await bd().outbox.where("tipo").equals("sessao").toArray()) {
    const p = item.payload as EscritaTabela;
    const id = p.filtro?.id ?? p.linha?.id;
    if (p.tabela !== "sessions" || typeof id !== "string") continue;
    const dono = p.filtro?.user_id ?? p.linha?.user_id;
    // O descarte antigo tinha só o UUID. A leitura aplica esse sinal somente a uma sessão já identificada da conta.
    const descarteLegado = dono === undefined && p.op === "update" && p.filtro?.id === id && p.linha?.status === "abandonada";
    if (dono !== conta && !descarteLegado) continue;
    const alteracao = porId.get(id) ?? {};
    if (descarteLegado) alteracao.descarteLegado = true;
    if (p.linha?.status === "concluida" || p.linha?.status === "abandonada") alteracao.fechamento = true;
    if (p.linha?.nota_geral === null || typeof p.linha?.nota_geral === "string") alteracao.nota = p.linha.nota_geral;
    if (alteracao.fechamento || alteracao.nota !== undefined) porId.set(id, alteracao);
  }
  return porId;
}

export async function lerHistoricoDaConta(cliente: QueryClient, conta: string, sinal?: AbortSignal): Promise<SessaoBruta[]> {
  const consultar = () => lerTabelaCompleta<SessaoBruta>("sessions", colunasDoHistorico, "os seus treinos", conta, sinal);
  if (!temIndexedDB()) return consultar();
  const banco = bd();
  const antes = await banco.transaction("r", banco.cache, banco.outbox, async () => ({
    sessoes: await baseDoHistoricoNoDisco(cliente, conta), pendentes: await escritasPendentes(conta),
  }));
  if (antes.sessoes?.some(s => s.status === "em_andamento" && antes.pendentes.get(s.id)?.descarteLegado)) {
    // A versão anterior retirava o rascunho ao descartar, mas a cópia completa podia continuar em andamento.
    antes.sessoes = await banco.transaction("rw", banco.cache, async () => {
      const atuais = await baseDoHistoricoNoDisco(cliente, conta) ?? [];
      const migradas = atuais.map(s => s.status === "em_andamento" && antes.pendentes.get(s.id)?.descarteLegado
        ? { ...s, status: "abandonada" as const } : s);
      await guardarLista(conta, migradas);
      return migradas;
    });
  }
  if (navigator.onLine === false) return antes.sessoes ?? [];
  let remotas: SessaoBruta[];
  try {
    remotas = await consultar();
  } catch (erro) {
    sinal?.throwIfAborted();
    if (erro instanceof FalhaDeRedeNaTabela || erro instanceof TypeError) {
      const local = await baseDoHistoricoNoDisco(cliente, conta);
      if (local) return local;
    }
    throw erro;
  }
  sinal?.throwIfAborted();
  if (remotas.some(s => s.user_id !== conta || typeof s.id !== "string")) throw new Error("A resposta não corresponde à conta do treino.");
  return banco.transaction("rw", banco.cache, banco.outbox, async () => {
    const atuais = await baseDoHistoricoNoDisco(cliente, conta) ?? [];
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
      // O descarte só alcança um treino aberto. Uma conclusão já confirmada conserva também nota, plano e duração.
      const conclusaoRemota = remota?.status === "concluida" && (s.status === "abandonada" || fila.descarteLegado);
      if (!conclusaoRemota && (fila.fechamento || s.status !== anterior?.status)) porId.set(s.id, s);
      if (anterior && (s.nota_geral !== anterior.nota_geral || s.revisaoDaNotaLocal !== anterior.revisaoDaNotaLocal)) {
        // A edição em outra aba pode já ter chegado ao servidor durante a consulta.
        pendentes.set(s.id, { ...fila, nota: s.nota_geral ?? null });
      }
    }
    // Uma edição da nota não pode reabrir uma sessão encerrada em outro aparelho.
    for (const [id, alteracao] of [...antes.pendentes, ...pendentes]) {
      const sessao = porId.get(id);
      if (!sessao) continue;
      const status = alteracao.descarteLegado && sessao.status === "em_andamento" ? "abandonada" : sessao.status;
      if (status !== sessao.status || alteracao.nota !== undefined) {
        porId.set(id, { ...sessao, status, ...(alteracao.nota !== undefined && { nota_geral: alteracao.nota }) });
      }
    }
    // Um descarte conciliado pode ter confirmado a exclusão enquanto esta consulta estava em voo.
    const atuaisPorId = new Set(atuais.map(s => s.id));
    for (const s of anteriores.values()) {
      if (!atuaisPorId.has(s.id) && antes.pendentes.get(s.id)?.fechamento) porId.delete(s.id);
    }
    const resultado = [...porId.values()].sort((a, b) => b.data.localeCompare(a.data));
    await banco.cache.put({ chave: chaveDaCobertura(conta), valor: { completa: true, ausentes: [] }, atualizadoEm: Date.now() });
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
  const lista = await baseDoHistoricoNoDisco(cliente, conta) ?? [];
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

export function resumoDaSessaoAberta(item: SessaoAtiva, conta: string): SessaoBruta | undefined {
  const s = item.dados as Partial<SessaoLocal> | null;
  if (s?.userId !== conta || s.id !== item.id || s.status !== "em_andamento" || !s.data || !s.workoutId) return;
  return { id: item.id, user_id: conta, data: s.data, workout_id: s.workoutId,
    status: s.status, iniciada_em: s.iniciadaEm, plano: s.plano };
}

/** O descarte retira o rascunho, registra o fechamento e o envia na mesma transação. */
export async function guardarDescarteNoHistorico(cliente: QueryClient, conta: string, id: string, resumo?: SessaoBruta) {
  const banco = bd();
  const escrita: EscritaTabela = { tabela: "sessions", op: "update", linha: { status: "abandonada" },
    filtro: { id, user_id: conta, status: "em_andamento" } };
  return banco.transaction("rw", banco.cache, banco.outbox, banco.sessaoAtiva, async () => {
    const item = await banco.sessaoAtiva.get(id);
    if (item && (item.dados as Partial<SessaoLocal>)?.userId !== conta) throw new Error("A sessão pertence a outra conta.");
    const lista = await baseDoHistoricoNoDisco(cliente, conta) ?? [];
    const anterior = lista.find(s => s.id === id) ?? (item && resumoDaSessaoAberta(item, conta)) ??
      (resumo?.user_id === conta && resumo.id === id ? resumo : undefined);
    if (anterior?.status === "concluida") throw new Error("Este treino já foi concluído.");
    if (item) await banco.sessaoAtiva.delete(id);
    await guardarNaFila("sessao", escrita, alvoDaEscrita(escrita));
    if (!anterior) return lista;
    const historico = substituirSessao(lista, { ...anterior, status: "abandonada" });
    await guardarLista(conta, historico);
    return historico;
  });
}

/** A transação do envio também retira o item da fila. Um carregamento imediato lê o fechamento do servidor. */
export async function guardarRespostaDoDescarte(conta: string, id: string, sessao: SessaoBruta | null) {
  const lista = await baseDoHistoricoNoDisco(undefined, conta) ?? [];
  const anterior = lista.find(s => s.id === id);
  if (anterior?.status === "concluida" && sessao?.status === "abandonada") return;
  const nota = (await escritasPendentes(conta)).get(id)?.nota;
  const resultado = sessao ? substituirSessao(lista, { ...anterior, ...sessao, ...(nota !== undefined && { nota_geral: nota }) })
    : lista.filter(s => s.id !== id);
  await guardarLista(conta, resultado);
  const chave = chaveDaCobertura(conta), cobertura = await lerCache<Cobertura>(chave);
  if (cobertura && !cobertura.completa) {
    const ausentes = new Set(cobertura.ausentes);
    if (sessao) ausentes.delete(id);
    else ausentes.add(id);
    await bd().cache.put({ chave, valor: { completa: false, ausentes: [...ausentes] }, atualizadoEm: Date.now() });
  }
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
    const lista = await baseDoHistoricoNoDisco(cliente, conta) ?? [];
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
