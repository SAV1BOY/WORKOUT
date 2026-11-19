import type { QueryClient } from "@tanstack/react-query";
import { exercicioPorId } from "@/lib/dados";
import { bd, temIndexedDB } from "@/lib/db";
import { estadosPorExercicio } from "@/lib/hoje";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { guardarConsultasAgora } from "@/lib/persistencia-query";
import { guardarCargasLidas, lerCargasNoAparelho } from "@/lib/queries/cargas-no-aparelho";
import { SERIES_ANTERIORES, seriesComparaveis, type SerieAnterior } from "@/lib/queries/dados";
import { seriesAnterioresPorExercicio, type EntradaMontagem } from "@/lib/sessao";
import { clienteNavegador } from "@/lib/supabase/client";
import type { LinhaEstadoExercicio, LinhaRecorde, LinhaSessao } from "@/lib/types";

type Motor = Pick<EntradaMontagem, "estados" | "anteriores" | "recordes" | "conhecidos">;
type Fonte = "estados" | "recordes" | "anteriores";
type LinhaDaConta = { user_id: string; exercise_id: string };
const chave = (conta: string, fonte: Fonte, id: string) => ["motor-repetir", conta, fonte, id] as const;

/** Uma leitura vazia só confirma ausência quando a chave também identifica a conta. */
function linhasSalvas<T extends LinhaDaConta>(
  cliente: QueryClient, conta: string, ids: readonly string[], fonte: "estados" | "recordes",
  doAparelho?: ReadonlyMap<string, { linha: T | null; lidoEm: number }>,
): Map<string, T | null> {
  const linhas = new Map<string, T | null>();
  const quando = new Map<string, number>();
  for (const [id, carga] of doAparelho ?? []) {
    linhas.set(id, carga.linha);
    quando.set(id, carga.lidoEm);
  }
  for (const id of ids) {
    const estado = cliente.getQueryState<T | null>(chave(conta, fonte, id));
    if ((estado?.data === null || estado?.data?.user_id === conta) && estado.dataUpdatedAt >= (quando.get(id) ?? -1)) {
      linhas.set(id, estado.data);
      quando.set(id, estado.dataUpdatedAt);
    }
  }
  const antigas = fonte === "estados" ? [["estados"], ["estados-todos"]] : [["recordes"], ["progresso", "recordes"]];
  for (const queryKey of antigas) {
    for (const consulta of cliente.getQueryCache().findAll({ queryKey })) {
      const { data, dataUpdatedAt } = consulta.state;
      if (!Array.isArray(data)) continue;
      for (const linha of data as T[]) {
        if (linha.user_id === conta && ids.includes(linha.exercise_id) && dataUpdatedAt > (quando.get(linha.exercise_id) ?? -1)) {
          linhas.set(linha.exercise_id, linha);
          quando.set(linha.exercise_id, dataUpdatedAt);
        }
      }
    }
  }
  return linhas;
}

/** O Histórico antigo não trazia o dono da sessão nem a posição da série.
 * Só reaproveita séries cujo dono e eventual substituição possam ser confirmados. */
function repeticoesSalvas(cliente: QueryClient, conta: string, ids: string[]) {
  const anteriores: Record<string, (number | null)[]> = {};
  if (!ids.length) return anteriores;
  type SessaoDoHistorico = Pick<LinhaSessao, "id" | "user_id" | "status" | "plano">;
  const historico = cliente.getQueryData<SessaoDoHistorico[]>(["progresso", "sessoes", conta])
    ?? cliente.getQueryData<SessaoDoHistorico[]>(["progresso", "sessoes"]) ?? [];
  const minhas = new Map(historico.filter((s) => s.user_id === conta && s.status !== "em_andamento")
    .map((s) => [s.id, s]));
  const escopada = cliente.getQueryState<{ linhas: SerieAnterior[] }>(["progresso", "series-todas", conta]);
  const antiga = cliente.getQueryState<SerieAnterior[]>(["progresso", "series-todas"]);
  const linhas = escopada?.data?.linhas ?? antiga?.data;
  const dataDaCopia = escopada?.data ? escopada.dataUpdatedAt : antiga?.dataUpdatedAt;
  if (minhas.size && linhas) {
    const identificadas = linhas.filter((serie) => {
      const sessao = minhas.get(serie.session_id);
      if (!sessao || !ids.includes(serie.exercise_id) || sessao.plano === undefined) return false;
      if (!sessao.plano?.trocas || !Object.keys(sessao.plano.trocas).length) return true;
      if (serie.ordem_ex == null) return false;
      const atual = sessao.plano.trocas[serie.ordem_ex]?.[0];
      return !atual || atual.exercicio_id === serie.exercise_id;
    });
    Object.assign(anteriores, seriesAnterioresPorExercicio(identificadas));
  }
  for (const id of ids) {
    const escopada = cliente.getQueryState<(number | null)[]>(chave(conta, "anteriores", id));
    if (escopada?.data && (!anteriores[id] || escopada.dataUpdatedAt >= (dataDaCopia ?? 0))) {
      if (escopada.data.length) anteriores[id] = escopada.data;
      else delete anteriores[id];
    }
  }
  return anteriores;
}

async function lista<T>(consulta: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function repeticoes(conta: string, ids: string[], sinal: AbortSignal) {
  if (!ids.length) return {};
  const remoto = clienteNavegador();
  const series = (await lista<SerieAnterior & { user_id: string }>(remoto.from("session_sets")
    .select("user_id,exercise_id,session_id,ordem_ex,set_index,reps,tipo,concluida,registrada_em")
    .eq("user_id", conta).in("exercise_id", ids).eq("tipo", "trabalho").eq("concluida", true)
    .order("registrada_em", { ascending: false }).limit(SERIES_ANTERIORES).abortSignal(sinal).retry(false)))
    .filter((s) => s.user_id === conta && ids.includes(s.exercise_id));
  const sessoes = [...new Set(series.map((s) => s.session_id))];
  const consultas = [];
  for (let i = 0; i < sessoes.length; i += 50) {
    consultas.push(lista<Pick<LinhaSessao, "user_id" | "id" | "status" | "plano">>(remoto.from("sessions")
      .select("user_id,id,status,plano").eq("user_id", conta).in("id", sessoes.slice(i, i + 50))
      .abortSignal(sinal).retry(false)));
  }
  const daConta = (await Promise.all(consultas)).flat().filter((s) => s.user_id === conta);
  return seriesAnterioresPorExercicio(seriesComparaveis(series, daConta));
}

const camposDoMotor = {
  carga_atual_kg: null, reps_alvo: null, tempo_alvo_s: null, assistencia: null,
  falhas_seguidas: 0, incremento_reduzido: false, exigir_rep_extra: false,
  semana_leve: false, carga_antes_leve: null, sessoes_graca: 0,
};

async function estadosPendentes() {
  if (!temIndexedDB()) return [];
  return bd().outbox.where("tipo").equals("estado_exercicio").toArray();
}

/** A fila é aplicada em ordem, inclusive lotes de backup e updates parciais. */
function sobreporEscritas(
  estados: Map<string, LinhaEstadoExercicio | null>, conta: string, ids: string[], pendentes: EscritaTabela[],
) {
  const alterados = new Set<string>();
  for (const { tabela, op, linha, linhas, filtro } of pendentes) {
    if (tabela !== "exercise_state" || !["upsert", "update", "insert"].includes(op)) continue;
    for (const campos of linhas ?? (linha ? [linha] : [])) {
      const dono = campos.user_id ?? filtro?.user_id;
      const id = campos.exercise_id ?? filtro?.exercise_id;
      if (dono !== conta || typeof id !== "string" || !ids.includes(id)) continue;
      const chavesMotor = Object.keys(camposDoMotor);
      if (![...chavesMotor, "incremento_kg", "desativado"].some((campo) => Object.hasOwn(campos, campo))) continue;
      const temProgressao = chavesMotor.every((campo) => Object.hasOwn(campos, campo));
      // Um incremento sozinho nunca comprova a carga anterior.
      if (!estados.has(id) && !temProgressao) continue;
      const base = estados.get(id) ?? { ...camposDoMotor, user_id: conta, exercise_id: id,
        incremento_kg: null, desativado: false, notas: null };
      estados.set(id, { ...base, ...campos } as LinhaEstadoExercicio);
      alterados.add(id);
    }
  }
  return alterados;
}

/** Revalida no clique. Sem resposta, usa apenas dados comprovadamente desta conta. */
export async function lerMotorParaRepetir(
  cliente: QueryClient, userId: string, exercicios: readonly string[], confirmarConta?: () => Promise<void>,
): Promise<Motor> {
  const ids = [...new Set(exercicios)].filter((id) => exercicioPorId.has(id));
  if (!userId || !ids.length) return { estados: {}, conhecidos: new Set(), anteriores: {}, recordes: {} };
  const maximos = ids.filter((id) => exercicioPorId.get(id)?.prescricao_padrao.tipo === "maximo");
  const doAparelho = await lerCargasNoAparelho(userId, ids).catch(() => undefined);
  const estados = linhasSalvas<LinhaEstadoExercicio>(cliente, userId, ids, "estados", doAparelho);
  const recordes = linhasSalvas<LinhaRecorde>(cliente, userId, ids, "recordes");
  let anteriores = repeticoesSalvas(cliente, userId, maximos);

  // Captura a fila antes do GET: ela pode ser drenada enquanto o servidor responde.
  const pendentes = await estadosPendentes().catch(() => []);
  const inicioDaLeitura = Date.now();
  let leuEstados = false;
  let leuRecordes = false;
  let leuAnteriores = false;
  if (typeof navigator === "undefined" || navigator.onLine !== false) {
    const controle = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const limite = new Promise<null>((resolve) => {
      timer = setTimeout(() => { controle.abort(); resolve(null); }, 1_500);
    });
    const aTempo = <T,>(buscar: () => Promise<T>) =>
      Promise.race([Promise.resolve().then(buscar).catch(() => null), limite]);
    try {
      const [novos, marcas, reps] = await Promise.all([
        aTempo(() => lista<LinhaEstadoExercicio>(clienteNavegador().from("exercise_state").select("*")
          .eq("user_id", userId).in("exercise_id", ids).abortSignal(controle.signal).retry(false))),
        aTempo(() => lista<LinhaRecorde>(clienteNavegador().from("v_records").select("*")
          .eq("user_id", userId).in("exercise_id", ids).abortSignal(controle.signal).retry(false))),
        aTempo(() => repeticoes(userId, maximos, controle.signal)),
      ]);
      if (novos) {
        for (const id of ids) estados.set(id, novos.find((e) => e.user_id === userId && e.exercise_id === id) ?? null);
        leuEstados = true;
      }
      if (marcas) {
        for (const id of ids) {
          const marca = marcas.find((m) => m.user_id === userId && m.exercise_id === id) ?? null;
          recordes.set(id, marca);
        }
        leuRecordes = true;
      }
      if (reps && maximos.length) {
        anteriores = reps;
        leuAnteriores = true;
      }
    } finally {
      clearTimeout(timer!);
    }
  }
  const porOrdem = new Map(pendentes.map((p) => [p.id, p]));
  if (leuEstados) {
    for (const p of await estadosPendentes().catch(() => [])) porOrdem.set(p.id, p);
  }
  const alterados = sobreporEscritas(estados, userId, ids, Array.from(porOrdem.values(), (p) => p.payload as EscritaTabela));
  // A troca de login durante um GET pode dar [] sob RLS. Confirma a identidade
  // antes de substituir a cópia anterior por uma ausência aparente.
  await confirmarConta?.();
  if (leuEstados) {
    const confirmadas = [...estados.values()].filter((e): e is LinhaEstadoExercicio => e !== null);
    await guardarCargasLidas(confirmadas, inicioDaLeitura, confirmarConta ? { conta: userId, ids } : undefined).catch(() => {});
  }
  for (const id of leuEstados ? ids : alterados) cliente.setQueryData(chave(userId, "estados", id), estados.get(id));
  if (leuRecordes) for (const id of ids) cliente.setQueryData(chave(userId, "recordes", id), recordes.get(id));
  if (leuAnteriores) for (const id of maximos) cliente.setQueryData(chave(userId, "anteriores", id), anteriores[id] ?? []);
  if (leuEstados || leuRecordes || leuAnteriores || alterados.size) await guardarConsultasAgora(cliente).catch(() => {});
  return {
    conhecidos: new Set(estados.keys()),
    estados: estadosPorExercicio([...estados.values()].filter((e) => e !== null)),
    anteriores,
    recordes: Object.fromEntries([...recordes].filter((par): par is [string, LinhaRecorde] => par[1] !== null)),
  };
}
