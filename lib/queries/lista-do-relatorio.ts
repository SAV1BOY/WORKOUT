import type { QueryClient } from "@tanstack/react-query";
import { CAMPOS_DE_CONTAGEM, chaveIntencao } from "@/lib/campos-de-contagem";
import { bd, temIndexedDB, type ItemCache } from "@/lib/db";
import { lerConsultaGuardada, VALIDADE_MS } from "@/lib/persistencia-query";
import { FalhaDeRedeNaTabela } from "@/lib/queries/ler";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { revisaoDasSeries } from "@/lib/espelhos-da-contagem";
import { conferirContagensObservadas, LeituraAnteriorACorrecao } from "@/lib/queries/contagens-observadas";
import { retirarDetalhesCobertos } from "@/lib/queries/cache-do-detalhe";
import { chaveDoHistorico, chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";

export interface ListaDoRelatorio<T> {
  linhas: T[];
  completa: boolean;
  /** Início da leitura paginada das séries, ou data dessa mesma confirmação no disco. */
  confirmadasEm?: number;
}
type Fonte = "series" | "cardio" | "soltas";

/** O app anterior ainda pode escrever a projeção sem ordem_ex em outra aba. */
export const chaveDaLista = (fonte: Fonte, conta: string) => fonte === "series"
  ? `series-do-historico-v2:${conta}` : `${fonte}-do-historico:${conta}`;

function daConta<T>(item: ItemCache | undefined, conta: string): T[] | undefined {
  if (!item || Date.now() - item.atualizadoEm > VALIDADE_MS || !Array.isArray(item.valor)) return undefined;
  return item.valor.every(linha => linha?.user_id === conta && typeof linha.id === "string") ? item.valor : undefined;
}

/** Durante uma consulta de uma sessão, outro aparelho/aba pode confirmar uma correção pelo Relatório. */
export async function arquivoDeSeriesPosterior<T>(conta: string, desde: number): Promise<ListaDoRelatorio<T> | undefined> {
  const cache = bd().cache;
  const chave = chaveDaLista("series", conta);
  // Evita desserializar todo o histórico a cada toque numa sessão já coberta pela rede.
  if (!(await cache.where("atualizadoEm").above(desde).primaryKeys()).includes(chave)) return;
  const item = await cache.get(chave);
  const linhas = daConta<T>(item, conta);
  if (linhas && item) return { linhas, completa: true, confirmadasEm: item.atualizadoEm };
}

/** Confirma a última página antes de atualizar a cópia da conta. Uma leitura iniciada antes não apaga outra mais nova. */
async function lerListaConfirmada<T>(
  conta: string, chave: string, consultar: (() => Promise<T[]>) | null, sinal?: AbortSignal,
  gravacao?: { inicio: number; podeGuardar: () => boolean; depoisDeGuardar?: (inicio: number) => Promise<void> },
): Promise<{ linhas: T[]; confirmadasEm?: number }> {
  sinal?.throwIfAborted();
  if (!conta) throw new Error("Não foi possível identificar a conta do relatório.");
  const inicio = gravacao?.inicio ?? Date.now();
  let linhas: T[];
  try {
    if (!consultar || (typeof navigator !== "undefined" && navigator.onLine === false)) {
      throw new FalhaDeRedeNaTabela("Esta parte do histórico ainda não está guardada neste aparelho.");
    }
    linhas = await consultar();
    sinal?.throwIfAborted();
    if (!linhas.every(linha => {
      const registro = linha as { id?: string; user_id?: string };
      return registro?.user_id === conta && typeof registro.id === "string";
    })) throw new Error("A resposta do histórico não corresponde à conta do treino.");
  } catch (erro) {
    sinal?.throwIfAborted();
    if (erro instanceof FalhaDeRedeNaTabela && temIndexedDB()) {
      const item = await bd().cache.get(chave).catch(() => undefined);
      const salvas = daConta<T>(item, conta);
      sinal?.throwIfAborted();
      if (salvas && item) return { linhas: salvas, confirmadasEm: item.atualizadoEm };
    }
    throw erro;
  }
  const confirmada = { linhas, confirmadasEm: inicio };
  if (!temIndexedDB() || (gravacao && !gravacao.podeGuardar())) return confirmada;
  const banco = bd();
  try {
    const tabelas = gravacao?.depoisDeGuardar ? [banco.cache, banco.outbox] : [banco.cache];
    return await banco.transaction("rw", tabelas, async () => {
      const item = await banco.cache.get(chave);
      sinal?.throwIfAborted();
      if (item && item.atualizadoEm > inicio) {
        const recentes = daConta<T>(item, conta);
        if (recentes) return { linhas: recentes, confirmadasEm: item.atualizadoEm };
      }
      await banco.cache.put({ chave, valor: linhas, atualizadoEm: inicio });
      await gravacao?.depoisDeGuardar?.(inicio);
      return confirmada;
    });
  } catch (erro) {
    sinal?.throwIfAborted();
    if (erro instanceof LeituraAnteriorACorrecao) throw erro;
    // A resposta continua visível, mas uma transação revertida não confirmou o fechamento no aparelho.
    return { linhas };
  }
}

export async function lerListaDoRelatorio<T>(conta: string, chave: string, consultar: () => Promise<T[]>, sinal?: AbortSignal): Promise<T[]> {
  return (await lerListaConfirmada(conta, chave, consultar, sinal)).linhas;
}

const saidasPorFonte = {
  series: { tipo: "serie", tabela: "session_sets" },
  cardio: { tipo: "cardio", tabela: "cardio_sessions" },
  soltas: { tipo: "barra_fixa_solta", tabela: "pullup_singles" },
} as const;

/** Somente para leitura. Uma operação em conciliação permanece sem op no transporte dos clientes antigos. */
interface EscritaParaLeitura extends EscritaTabela { proposta?: boolean }

export async function escritasPendentes(fonte: Fonte, conta: string): Promise<EscritaParaLeitura[]> {
  if (!temIndexedDB()) return [];
  const { tipo, tabela } = saidasPorFonte[fonte];
  const itens = await bd().outbox.where("tipo").equals(tipo).toArray();
  return itens.flatMap<EscritaParaLeitura>(item => {
    const p = item.payload as EscritaTabela & { operacaoGuardada?: "insert" | "upsert"; seriesEmConciliacao?: string[] };
    if (p.tabela !== tabela) return [];
    const op = p.op ?? p.operacaoGuardada;
    if (op === "upsert" || op === "insert") {
      return (p.linhas ?? (p.linha ? [p.linha] : [])).filter(linha => linha.user_id === conta).map(linha => ({
        tabela, op, linha, ...(p.seriesEmConciliacao?.includes(chaveIntencao(conta, String(linha.id))) && { proposta: true }),
      }));
    }
    return (p.filtro?.user_id ?? p.linha?.user_id) === conta ? [p] : [];
  });
}

export function aplicarPendentes<T>(linhas: T[], pendentes: EscritaParaLeitura[], fonteParcial = false): T[] {
  if (!pendentes.length) return linhas;
  const porId = new Map<string, T>();
  const semId: T[] = [];
  for (const linha of linhas) {
    const id = (linha as { id?: string }).id;
    if (id) porId.set(id, linha);
    else semId.push(linha);
  }
  for (const p of pendentes) {
    const id = p.filtro?.id ?? p.linha?.id;
    if (typeof id !== "string") continue;
    if (p.proposta && p.linha) {
      // Um backup pode ter trocado a série inteira desde a recusa. A proposta só
      // substitui frações de uma linha compatível; não move de volta um UUID confirmado.
      const anterior = porId.get(id) as Record<string, unknown> | undefined;
      if (!anterior) {
        if (fonteParcial) porId.set(id, p.linha as T);
      } else if (["session_id", "exercise_id", "ordem_ex", "set_index", "tipo"].every(k =>
        anterior[k] === undefined || p.linha![k] === undefined || anterior[k] === p.linha![k])) {
        const valores: Record<string, unknown> = {};
        for (const campo of CAMPOS_DE_CONTAGEM) {
          if (typeof anterior[campo] === "number" && !Number.isInteger(anterior[campo]) && Number.isInteger(p.linha[campo])) {
            valores[campo] = p.linha[campo];
          }
        }
        porId.set(id, { ...anterior, ...valores } as T);
      }
    } else if (p.op === "delete") porId.delete(id);
    else if (p.linha && (p.op !== "update" || porId.has(id))) porId.set(id, { ...porId.get(id), ...p.linha } as T);
  }
  return [...porId.values(), ...semId];
}

export async function lerFonteDoRelatorio<T>(
  cliente: QueryClient, conta: string, fonte: Fonte, antiga: readonly string[], consultar: (() => Promise<T[]>) | null, sinal?: AbortSignal,
): Promise<ListaDoRelatorio<T>> {
  // A observação começa na fila. Um treino pode fechar antes de a consulta de rede chegar a iniciar.
  const inicio = Date.now();
  let filaLegivel = true;
  const lerFila = async () => {
    sinal?.throwIfAborted();
    let pendentes: EscritaTabela[] = [];
    try {
      pendentes = await escritasPendentes(fonte, conta);
    } catch {
      // A rede ainda pode responder. Preserve a cópia que pode conter alterações locais desconhecidas.
      filaLegivel = false;
    }
    sinal?.throwIfAborted();
    return pendentes;
  };
  const lerRevisao = () => revisaoDasSeries(conta).catch(() => { filaLegivel = false; return undefined; });
  const revisaoInicial = fonte === "series" && temIndexedDB() ? await lerRevisao() : undefined;
  const conferirRevisao = async () => {
    if (revisaoInicial === undefined) return;
    const atual = await lerRevisao();
    if (atual !== undefined && atual !== revisaoInicial) throw new LeituraAnteriorACorrecao();
  };
  const antes = await lerFila();
  let conferir: ReturnType<typeof conferirContagensObservadas>;
  try {
    const confirmada = await lerListaConfirmada(conta, chaveDaLista(fonte, conta), consultar && (async () => {
      const remotas = await consultar();
      // A fila pode esvaziar enquanto o servidor responde com a foto anterior aos envios.
      const observadas = [...antes, ...await lerFila()];
      if (fonte === "series") conferir = conferirContagensObservadas(observadas);
      return aplicarPendentes(remotas, observadas);
    }), sinal, {
      inicio, podeGuardar: () => filaLegivel,
      depoisDeGuardar: fonte === "series" ? async horario => {
        // A gravação do histórico e esta conferência da fila estão na mesma transação.
        await conferirRevisao();
        if (conferir) conferir(await escritasPendentes(fonte, conta));
        await retirarDetalhesCobertos(conta, horario);
      } : undefined,
    });
    const finais = await lerFila();
    await conferirRevisao();
    if (filaLegivel) conferir?.(finais);
    const linhas = aplicarPendentes(confirmada.linhas, finais);
    return fonte === "series" && filaLegivel && confirmada.confirmadasEm !== undefined
      ? { linhas, completa: true, confirmadasEm: confirmada.confirmadasEm }
      : { linhas, completa: true };
  } catch (erro) {
    if (erro instanceof LeituraAnteriorACorrecao) return lerFonteDoRelatorio(cliente, conta, fonte, antiga, consultar, sinal);
    if (!(erro instanceof FalhaDeRedeNaTabela)) throw erro;
  }

  if (fonte === "series" && temIndexedDB()) {
    const arquivoAnterior = await bd().cache.get(`series-do-historico:${conta}`).catch(() => undefined);
    sinal?.throwIfAborted();
    const salvas = daConta<T>(arquivoAnterior, conta);
    if (salvas) return { linhas: aplicarPendentes(salvas, await lerFila()), completa: true };
  }

  const pegar = async <R>(chave: readonly string[]): Promise<R | undefined> =>
    cliente.getQueryData<R>(chave) ?? (temIndexedDB() ? await lerConsultaGuardada<R>(chave) : undefined);
  type Antiga = T & { id?: string; user_id?: string; session_id?: string };
  const antigas = await pegar<Antiga[]>(antiga);
  if (!antigas?.length) return { linhas: aplicarPendentes([], antes, true), completa: false };

  const sessoes = new Set<string>();
  if (fonte === "series") {
    type Dono = { id: string; user_id?: string };
    const locais = temIndexedDB() ? await bd().cache.get(chaveDoHistoricoNoDisco(conta)) : undefined;
    const listas = [locais?.valor, await pegar<Dono[]>(chaveDoHistorico(conta)), await pegar<Dono[]>(["progresso", "sessoes"])];
    for (const lista of listas) if (Array.isArray(lista)) {
      for (const s of lista) if (s?.user_id === conta) sessoes.add(s.id);
    }
  }
  const linhas = antigas.filter(l => l.user_id !== undefined ? l.user_id === conta :
    fonte === "series" && l.session_id !== undefined && sessoes.has(l.session_id));
  // Antes da paginação por chave, as séries vinham sem id; cardio e soltas usavam a mesma projeção com limite.
  const completa = fonte === "series" && linhas.length === antigas.length && linhas.every(l => typeof l.id === "string");
  return { linhas: aplicarPendentes(linhas, antes, !completa), completa };
}

/** Uma edição de cardio ou de repetições soltas também atualiza a cópia completa já confirmada no aparelho. */
export async function atualizarFonteDoRelatorio<T>(
  cliente: QueryClient, conta: string, fonte: Fonte, chave: readonly string[], atualizar: (linhas: T[]) => T[],
): Promise<void> {
  if (temIndexedDB()) {
    const banco = bd();
    const disco = chaveDaLista(fonte, conta);
    await banco.transaction("rw", banco.cache, async () => {
      const item = await banco.cache.get(disco);
      const salvas = daConta<T>(item, conta);
      if (salvas) await banco.cache.put({ chave: disco, valor: atualizar(salvas), atualizadoEm: Date.now() });
    }).catch(() => {}); // a alteração já está na fila, mesmo quando não há espaço para atualizar o cache
  }
  cliente.setQueryData<ListaDoRelatorio<T>>(chave, atual => atual && { ...atual, linhas: atualizar(atual.linhas) });
}
