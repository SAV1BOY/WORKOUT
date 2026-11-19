/**
 * Leitura do Supabase com TanStack Query (SPEC §8): o cache é persistido
 * (lib/persistencia-query.ts), então a tela abre com os dados da última
 * sincronização e atualiza em segundo plano.
 *
 * Só leitura. Toda escrita passa pela fila de saída (lib/queries/acoes.ts).
 */
"use client";

import { useEffect } from "react";
import { useQuery, type QueryClient, type UseQueryResult } from "@tanstack/react-query";
import { lerSeriesDoTreinoPassado, type UltimaSerie } from "@/lib/queries/series-do-treino-passado";
import { lerExcecoesDoHistorico } from "@/lib/queries/excecoes-do-historico";
import { guardarCargasLidas } from "@/lib/queries/cargas-no-aparelho";
import { guardarPerfilLido } from "@/lib/queries/perfil-no-aparelho";
import { lerFonteDoRelatorio, type ListaDoRelatorio } from "@/lib/queries/lista-do-relatorio";
import { lerTabelaCompleta } from "@/lib/queries/ler";
import { clienteNavegador } from "@/lib/supabase/client";
import type {
  LinhaBarraFixaSolta,
  LinhaEstadoExercicio,
  LinhaEventoProgressao,
  LinhaExcecaoAgenda,
  LinhaPerfil,
  LinhaPeso,
  LinhaRecorde,
  LinhaSerie,
  LinhaSessao,
  LinhaSessaoCardio,
} from "@/lib/types";

/** Quantas sessões de força a tela Hoje e o calendário precisam ver. */
export const SESSOES_RECENTES = 60;

/** Quantas sessões de cardio as sequências da aba Treino precisam ver. */
export const CARDIOS_RECENTES = 120;

export const chaves = {
  perfil: () => ["perfil"] as const,
  overrides: (de: string, ate: string, conta?: string) => conta
    ? ["overrides", de, ate, conta] as const : ["overrides", de, ate] as const,
  sessoes: () => ["sessoes"] as const,
  sessoesAbertas: () => ["sessoes-abertas"] as const,
  cardio: (de: string, ate: string) => ["cardio", de, ate] as const,
  cardioDesde: (de: string) => ["cardio-desde", de] as const,
  cardioTodos: (conta: string) => ["cardio-todos", conta] as const,
  peso: () => ["peso"] as const,
  soltas: (data: string) => ["soltas", data] as const,
  soltasNoPeriodo: (de: string, ate: string) => ["soltas-periodo", de, ate] as const,
  /** Todas as repetições soltas — os Números e as conquistas (SPEC §19). */
  soltasTodas: (conta: string) => ["soltas-todas", conta] as const,
  cardioPorId: (id: string) => ["cardio-sessao", id] as const,
  estados: (ids: readonly string[]) => ["estados", [...ids].sort().join(",")] as const,
  /** Todas as linhas de `exercise_state` — a retomada (SPEC §18.2). */
  estadosTodos: () => ["estados-todos"] as const,
  eventos: (ids: readonly string[]) => ["eventos", [...ids].sort().join(",")] as const,
  sessao: (id: string) => ["sessao", id] as const,
  series: (id: string) => ["series", id] as const,
  seriesAnteriores: (ids: readonly string[]) =>
    ["series-anteriores", [...ids].sort().join(",")] as const,
  recordes: (ids: readonly string[]) => ["recordes", [...ids].sort().join(",")] as const,
  ultimasSeries: (conta: string, ids: readonly string[], atual?: string) =>
    ["ultimas-series", conta, [...new Set(ids)].sort().join(","), atual ?? ""] as const,
};

interface Resposta<T> {
  data: T | null;
  error: { message: string } | null;
}

async function ler<T>(promessa: PromiseLike<Resposta<T>>, oQue: string): Promise<T | null> {
  const { data, error } = await promessa;
  if (error) throw new Error(`Não consegui carregar ${oQue}. ${error.message}`);
  return data;
}

async function lerLista<T>(
  promessa: PromiseLike<Resposta<T[]>>,
  oQue: string,
): Promise<T[]> {
  return (await ler(promessa, oQue)) ?? [];
}

/* ------------------------------------------------------------- perfil */

export function usePerfil(): UseQueryResult<LinhaPerfil | null> {
  return useQuery({
    queryKey: chaves.perfil(),
    queryFn: ({ signal }) => lerPerfilAtual(signal),
  });
}

export async function lerPerfilAtual(sinal: AbortSignal): Promise<LinhaPerfil | null> {
  const lidoEm = Date.now();
  const cliente = clienteNavegador();
  const perfil = await ler<LinhaPerfil>(cliente.from("profiles").select("*").abortSignal(sinal).maybeSingle(), "o seu perfil");
  if (!perfil) return null;
  const { data } = await cliente.auth.getSession();
  sinal.throwIfAborted();
  if (data.session?.user.id !== perfil.user_id) throw new Error("O login mudou. Reabra a tela para carregar o perfil atual.");
  // A linha autenticada continua disponível online quando o navegador recusa a escrita (ex.: quota).
  await guardarPerfilLido(perfil, lidoEm, sinal).catch(() => {});
  sinal.throwIfAborted();
  return perfil;
}

/* ------------------------------------------------------ agenda (§3.5) */

export function useOverrides(
  de: string | null,
  ate: string | null,
  conta?: string,
): UseQueryResult<LinhaExcecaoAgenda[]> {
  return useQuery({
    queryKey: chaves.overrides(de ?? "", ate ?? "", conta),
    meta: { contaDoRelatorio: conta },
    enabled: de !== null && ate !== null,
    networkMode: conta ? "always" : "online",
    queryFn: ({ client, signal }) => {
      if (de === null || ate === null) return [];
      if (conta) return lerExcecoesDoHistorico(client, conta, de, ate, signal);
      return lerLista<LinhaExcecaoAgenda>(
        clienteNavegador()
          .from("schedule_overrides")
          .select("*")
          .gte("data", de ?? "")
          .lte("data", ate ?? ""),
        "as trocas do calendário",
      );
    },
  });
}

/* ---------------------------------------------------- sessões de força */

export type SessaoResumo = Pick<
  LinhaSessao,
  "id" | "data" | "status" | "workout_id" | "fase" | "concluida_em"
> & Partial<Pick<LinhaSessao, "user_id" | "plano">>;

const COLUNAS_SESSAO = "id,user_id,data,status,workout_id,fase,concluida_em";

export function useSessoes(): UseQueryResult<SessaoResumo[]> {
  return useQuery({
    queryKey: chaves.sessoes(),
    queryFn: () =>
      lerLista<SessaoResumo>(
        clienteNavegador()
          .from("sessions")
          .select(COLUNAS_SESSAO)
          .order("data", { ascending: false })
          .limit(SESSOES_RECENTES),
        "os seus treinos",
      ),
  });
}

/** As sessões ainda abertas, venham de quando vierem (banner da §3.1). */
export function useSessoesAbertas(confirmarAoAbrir = false): UseQueryResult<SessaoResumo[]> {
  return useQuery({
    queryKey: chaves.sessoesAbertas(),
    refetchOnMount: confirmarAoAbrir ? "always" : true,
    queryFn: () =>
      lerLista<SessaoResumo>(
        clienteNavegador()
          .from("sessions")
          .select(`${COLUNAS_SESSAO},plano`)
          .eq("status", "em_andamento")
          .order("data", { ascending: false })
          .limit(5),
        "os treinos em aberto",
      ),
  });
}

/* ---------------------------------------------------------- cardio */

export function useCardio(
  de: string | null,
  ate: string | null,
): UseQueryResult<LinhaSessaoCardio[]> {
  return useQuery({
    queryKey: chaves.cardio(de ?? "", ate ?? ""),
    enabled: de !== null && ate !== null,
    queryFn: () =>
      lerLista<LinhaSessaoCardio>(
        clienteNavegador()
          .from("cardio_sessions")
          .select("*")
          .gte("data", de ?? "")
          .lte("data", ate ?? "")
          .order("data", { ascending: false }),
        "as sessões de cardio",
      ),
  });
}

/**
 * As sessões de cardio desde uma data (SPEC §13.3): a sequência de semanas com
 * a meta cumprida precisa de mais do que a semana em curso.
 */
export function useCardioDesde(
  de: string | null,
): UseQueryResult<LinhaSessaoCardio[]> {
  return useQuery({
    queryKey: chaves.cardioDesde(de ?? ""),
    enabled: de !== null,
    queryFn: () =>
      lerLista<LinhaSessaoCardio>(
        clienteNavegador()
          .from("cardio_sessions")
          .select("*")
          .gte("data", de ?? "")
          .order("data", { ascending: false })
          .limit(CARDIOS_RECENTES),
        "as sessões de cardio",
      ),
  });
}

/**
 * Todo o cardio registrado (SPEC §14.4): os contadores do topo do Relatório
 * são **acumulados**, e as três fontes têm que ler a mesma janela — a janela
 * de 26 semanas dava "10 treinos" em cima e "6 no total" embaixo.
 */
export function useCardioTodos(conta: string | null): UseQueryResult<ListaDoRelatorio<LinhaSessaoCardio>> {
  return useQuery({
    queryKey: chaves.cardioTodos(conta ?? ""),
    meta: { contaDoRelatorio: conta },
    enabled: Boolean(conta),
    networkMode: "always",
    queryFn: ({ client, signal }) => lerFonteDoRelatorio(client, conta!, "cardio", ["cardio-todos"], async () => {
      const linhas = await lerTabelaCompleta<LinhaSessaoCardio>(
        "cardio_sessions", "*", "as sessões de cardio", conta!, signal,
      );
      return linhas.sort((a, b) => b.data.localeCompare(a.data));
    }, signal),
  });
}

/* ------------------------------------------------------------ corpo */

export type PesoResumo = Pick<LinhaPeso, "data" | "peso_kg">;

export function useUltimoPeso(): UseQueryResult<PesoResumo[]> {
  return useQuery({
    queryKey: chaves.peso(),
    queryFn: () =>
      lerLista<PesoResumo>(
        clienteNavegador()
          .from("body_weights")
          .select("data,peso_kg")
          .order("data", { ascending: false })
          .limit(1),
        "o seu peso",
      ),
  });
}

/* ------------------------------------------- barra fixa: reps soltas */

export type SoltaResumo = Pick<LinhaBarraFixaSolta, "id" | "data" | "reps">;

/** A solta com a assistência (a conquista "sem elástico", SPEC §19.3). */
export type SoltaComAssistencia = SoltaResumo &
  Pick<LinhaBarraFixaSolta, "assistencia">;

export function useSoltasDoDia(data: string | null): UseQueryResult<SoltaResumo[]> {
  return useQuery({
    queryKey: chaves.soltas(data ?? ""),
    enabled: data !== null,
    queryFn: () =>
      lerLista<SoltaResumo>(
        clienteNavegador()
          .from("pullup_singles")
          .select("id,data,reps")
          .eq("data", data ?? ""),
        "as repetições soltas de hoje",
      ),
  });
}

/** As soltas de um intervalo (o histórico de 14 dias da SPEC §3.4). */
export function useSoltas(
  de: string | null,
  ate: string | null,
): UseQueryResult<SoltaResumo[]> {
  return useQuery({
    queryKey: chaves.soltasNoPeriodo(de ?? "", ate ?? ""),
    enabled: de !== null && ate !== null,
    queryFn: () =>
      lerLista<SoltaResumo>(
        clienteNavegador()
          .from("pullup_singles")
          .select("id,data,reps")
          .gte("data", de ?? "")
          .lte("data", ate ?? "")
          .order("data", { ascending: false }),
        "as repetições soltas",
      ),
  });
}

/**
 * Todas as repetições soltas (SPEC §19.2): os Números por período e as
 * conquistas de barra fixa contam desde o começo, não só a janela do histórico.
 */
export function useSoltasTodas(conta: string | null): UseQueryResult<ListaDoRelatorio<SoltaComAssistencia>> {
  return useQuery({
    queryKey: chaves.soltasTodas(conta ?? ""),
    meta: { contaDoRelatorio: conta },
    enabled: Boolean(conta),
    networkMode: "always",
    queryFn: ({ client, signal }) => lerFonteDoRelatorio(client, conta!, "soltas", ["soltas-todas"], async () => {
      const linhas = await lerTabelaCompleta<SoltaComAssistencia>(
        "pullup_singles", "id,user_id,data,reps,assistencia", "as repetições soltas", conta!, signal,
      );
      return linhas.sort((a, b) => b.data.localeCompare(a.data));
    }, signal),
  });
}

/** Uma sessão de cardio pelo id (o calendário abre um dia já registrado). */
export function useCardioPorId(
  id: string | null,
): UseQueryResult<LinhaSessaoCardio | null> {
  return useQuery({
    queryKey: chaves.cardioPorId(id ?? ""),
    enabled: id !== null,
    queryFn: () =>
      ler<LinhaSessaoCardio>(
        clienteNavegador()
          .from("cardio_sessions")
          .select("*")
          .eq("id", id ?? "")
          .maybeSingle(),
        "esta sessão de cardio",
      ),
  });
}

/* ------------------------------------------ estado e eventos por exercício */

async function lerCargas(ids?: readonly string[]): Promise<LinhaEstadoExercicio[]> {
  const lidoEm = Date.now();
  const consulta = clienteNavegador().from("exercise_state").select("*");
  const linhas = await lerLista<LinhaEstadoExercicio>(
    ids ? consulta.in("exercise_id", [...ids]) : consulta, "as cargas dos exercícios",
  );
  // Uma falha de armazenamento no aparelho não impede a consulta online.
  await guardarCargasLidas(linhas, lidoEm).catch(() => {});
  return linhas;
}

export function useEstados(
  ids: readonly string[],
): UseQueryResult<LinhaEstadoExercicio[]> {
  return useQuery({
    queryKey: chaves.estados(ids),
    enabled: ids.length > 0,
    queryFn: () => lerCargas(ids),
  });
}

/**
 * Todas as cargas do usuário (SPEC §18.2): "Voltar mais leve" e "Recomeçar do
 * zero" mexem em TODOS os exercícios, não só nos do treino do dia. Só carrega
 * quando a retomada precisa dela — a aba Treino não paga por isso todo dia.
 */
export function useEstadosTodos(
  ativo: boolean,
): UseQueryResult<LinhaEstadoExercicio[]> {
  return useQuery({
    queryKey: chaves.estadosTodos(),
    enabled: ativo,
    queryFn: () => lerCargas(),
  });
}

export type EventoResumo = Pick<
  LinhaEventoProgressao,
  "exercise_id" | "data" | "motivo" | "de" | "para"
>;

export function useEventos(ids: readonly string[]): UseQueryResult<EventoResumo[]> {
  return useQuery({
    queryKey: chaves.eventos(ids),
    enabled: ids.length > 0,
    queryFn: () =>
      lerLista<EventoResumo>(
        clienteNavegador()
          .from("progression_events")
          .select("exercise_id,data,motivo,de,para")
          .in("exercise_id", [...ids])
          .order("data", { ascending: false })
          .limit(120),
        "o histórico de progressão",
      ),
  });
}

/* ------------------------------------------- sessão de força (marco 3) */

/** Uma sessão pelo id (para reabrir num aparelho que não a criou). */
export function useSessao(id: string | null): UseQueryResult<LinhaSessao | null> {
  return useQuery({
    queryKey: chaves.sessao(id ?? ""),
    // Ao reabrir, descobre se outro aparelho concluiu a cópia que ficou aqui.
    refetchOnMount: "always",
    enabled: id !== null,
    queryFn: () =>
      ler<LinhaSessao>(
        clienteNavegador()
          .from("sessions")
          .select("*")
          .eq("id", id ?? "")
          .maybeSingle(),
        "este treino",
      ),
  });
}

/** As séries já gravadas de uma sessão. */
export function useSeriesDaSessao(id: string | null): UseQueryResult<LinhaSerie[]> {
  return useQuery({
    queryKey: chaves.series(id ?? ""),
    enabled: id !== null,
    queryFn: () =>
      lerLista<LinhaSerie>(
        clienteNavegador()
          .from("session_sets")
          .select("*")
          .eq("session_id", id ?? "")
          .order("registrada_em", { ascending: true }),
        "as séries deste treino",
      ),
  });
}

/** Quantas séries a busca das sessões anteriores traz (tipo `maximo`, §6.3). */
export const SERIES_ANTERIORES = 200;

export type SerieAnterior = Pick<
  LinhaSerie,
  "exercise_id" | "session_id" | "ordem_ex" | "set_index" | "reps" | "tipo" | "concluida" | "registrada_em"
>;

/** As séries de um exercício interrompido continuam no histórico, mas não
 * servem de referência para avaliar um novo treino de tipo máximo. */
export function seriesComparaveis(
  series: SerieAnterior[],
  sessoes: Pick<LinhaSessao, "id" | "status" | "plano">[],
): SerieAnterior[] {
  const porId = new Map(sessoes.map((s) => [s.id, s]));
  return series.filter((s) => {
    const sessao = porId.get(s.session_id);
    if (!sessao || sessao.status === "em_andamento") return false;
    const atual = sessao.plano?.trocas?.[s.ordem_ex]?.[0];
    return !atual || atual.exercicio_id === s.exercise_id;
  });
}

/** As séries recentes destes exercícios (o tipo máximo compara com elas). */
export function useSeriesAnteriores(
  ids: readonly string[],
): UseQueryResult<SerieAnterior[]> {
  return useQuery({
    queryKey: chaves.seriesAnteriores(ids),
    enabled: ids.length > 0,
    queryFn: async () => {
      const cliente = clienteNavegador();
      const series = await lerLista<SerieAnterior>(
        cliente.from("session_sets")
          .select("exercise_id,session_id,ordem_ex,set_index,reps,tipo,concluida,registrada_em")
          .in("exercise_id", [...ids])
          .eq("tipo", "trabalho")
          .eq("concluida", true)
          .order("registrada_em", { ascending: false })
          .limit(SERIES_ANTERIORES),
        "as séries anteriores",
      );
      const sessoes = [...new Set(series.map((s) => s.session_id))];
      const consultas = [];
      for (let inicio = 0; inicio < sessoes.length; inicio += 50) {
        consultas.push(lerLista<Pick<LinhaSessao, "id" | "status" | "plano">>(
          cliente.from("sessions").select("id,status,plano").in("id", sessoes.slice(inicio, inicio + 50)),
          "as sessões das séries anteriores",
        ));
      }
      return seriesComparaveis(series, (await Promise.all(consultas)).flat());
    },
  });
}

/** Comparação visual do player, separada da referência do motor de progressão. */
export function useUltimasSeries(conta: string, ids: readonly string[], atual?: string): UseQueryResult<UltimaSerie[]> {
  const habilitada = Boolean(conta) && ids.length > 0;
  const consulta = useQuery({
    queryKey: chaves.ultimasSeries(conta, ids, atual),
    enabled: habilitada,
    networkMode: "always",
    refetchOnReconnect: false,
    queryFn: ({ client, signal }) => lerSeriesDoTreinoPassado(client, conta, ids, atual, signal),
  });
  const { refetch } = consulta;
  useEffect(() => {
    // Funciona também quando o documento foi aberto offline e a biblioteca
    // ainda não recebeu um evento de desconexão. A chave deduplica a leitura.
    if (!habilitada) return;
    const aoVoltar = () => { void refetch({ cancelRefetch: false }); };
    window.addEventListener("online", aoVoltar);
    return () => window.removeEventListener("online", aoVoltar);
  }, [habilitada, refetch]);
  return consulta;
}

/** Recordes por exercício (view `v_records`), para o resumo do fim (§6.6). */
export function useRecordes(ids: readonly string[]): UseQueryResult<LinhaRecorde[]> {
  return useQuery({
    queryKey: chaves.recordes(ids),
    enabled: ids.length > 0,
    queryFn: () =>
      lerLista<LinhaRecorde>(
        clienteNavegador()
          .from("v_records")
          .select("*")
          .in("exercise_id", [...ids]),
        "os seus recordes",
      ),
  });
}

/* ------------------------------------------ o que já foi lido (offline) */

/**
 * Junta o que uma família de consultas já leu neste aparelho. O cache do
 * TanStack Query é **persistido** (lib/persistencia-query), então sem rede
 * ele é a única fonte da carga atual — e cada consulta guarda na chave os ids
 * que pediu, o que permite saber, **por exercício**, se aquilo já foi lido.
 *
 * Isso é o que deixa a aba Treino e `/treinar` aproveitarem a leitura uma da
 * outra, mesmo pedindo listas de ids diferentes (SPEC §6.3 e §14.1).
 */
function doCache<T>(
  cliente: QueryClient,
  prefixo: string,
): { linhas: T[]; conhecidos: Set<string> } {
  const conhecidos = new Set<string>();
  const linhas: T[] = [];
  const consultas = cliente
    .getQueryCache()
    .findAll({ queryKey: [prefixo] })
    /*
     * `data !== undefined` e não `status === "success"`: sem rede a consulta
     * rehidratada falha ao revalidar e o status vira "error" **com os dados
     * ainda ali** — é justamente o caso que precisa do cache (SPEC §8).
     */
    .filter((q) => q.state.data !== undefined)
    .sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt);
  for (const q of consultas) {
    const chave = q.queryKey[1];
    if (typeof chave === "string") {
      for (const id of chave.split(",")) if (id) conhecidos.add(id);
    }
    for (const linha of (q.state.data as T[] | undefined) ?? []) linhas.push(linha);
  }
  return { linhas, conhecidos };
}

/** `exercise_state` já lido, por exercício (o mais recente ganha). */
export function estadosNoCache(
  cliente: QueryClient,
  ids: readonly string[],
): { estados: LinhaEstadoExercicio[]; conhecidos: Set<string> } {
  const { linhas, conhecidos } = doCache<LinhaEstadoExercicio>(cliente, "estados");
  const porId = new Map<string, LinhaEstadoExercicio>();
  for (const linha of linhas) porId.set(linha.exercise_id, linha);
  const pedidos = new Set(ids);
  return {
    estados: [...porId.values()].filter((e) => pedidos.has(e.exercise_id)),
    conhecidos: new Set([...conhecidos].filter((id) => pedidos.has(id))),
  };
}

/** `v_records` já lida, por exercício. */
export function recordesNoCache(
  cliente: QueryClient,
  ids: readonly string[],
): LinhaRecorde[] {
  const { linhas } = doCache<LinhaRecorde>(cliente, "recordes");
  const porId = new Map<string, LinhaRecorde>();
  for (const linha of linhas) porId.set(linha.exercise_id, linha);
  const pedidos = new Set(ids);
  return [...porId.values()].filter((r) => pedidos.has(r.exercise_id));
}

/** Séries de trabalho anteriores já lidas (tipo `maximo`, SPEC §6.3). */
export function seriesAnterioresNoCache(
  cliente: QueryClient,
  ids: readonly string[],
): SerieAnterior[] {
  const { linhas } = doCache<SerieAnterior>(cliente, "series-anteriores");
  const pedidos = new Set(ids);
  const vistas = new Map<string, SerieAnterior>();
  for (const s of linhas) {
    if (!pedidos.has(s.exercise_id)) continue;
    vistas.set(`${s.session_id}:${s.exercise_id}:${s.set_index}`, s);
  }
  return [...vistas.values()];
}
