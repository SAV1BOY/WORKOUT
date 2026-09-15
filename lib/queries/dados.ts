/**
 * Leitura do Supabase com TanStack Query (SPEC §8): o cache é persistido
 * (lib/persistencia-query.ts), então a tela abre com os dados da última
 * sincronização e atualiza em segundo plano.
 *
 * Só leitura. Toda escrita passa pela fila de saída (lib/queries/acoes.ts).
 */
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
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

export const chaves = {
  perfil: () => ["perfil"] as const,
  overrides: (de: string, ate: string) => ["overrides", de, ate] as const,
  sessoes: () => ["sessoes"] as const,
  sessoesAbertas: () => ["sessoes-abertas"] as const,
  cardio: (de: string, ate: string) => ["cardio", de, ate] as const,
  peso: () => ["peso"] as const,
  soltas: (data: string) => ["soltas", data] as const,
  estados: (ids: readonly string[]) => ["estados", [...ids].sort().join(",")] as const,
  eventos: (ids: readonly string[]) => ["eventos", [...ids].sort().join(",")] as const,
  sessao: (id: string) => ["sessao", id] as const,
  series: (id: string) => ["series", id] as const,
  seriesAnteriores: (ids: readonly string[]) =>
    ["series-anteriores", [...ids].sort().join(",")] as const,
  recordes: (ids: readonly string[]) => ["recordes", [...ids].sort().join(",")] as const,
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
    queryFn: () =>
      ler<LinhaPerfil>(
        clienteNavegador().from("profiles").select("*").maybeSingle(),
        "o seu perfil",
      ),
  });
}

/* ------------------------------------------------------ agenda (§3.5) */

export function useOverrides(
  de: string | null,
  ate: string | null,
): UseQueryResult<LinhaExcecaoAgenda[]> {
  return useQuery({
    queryKey: chaves.overrides(de ?? "", ate ?? ""),
    enabled: de !== null && ate !== null,
    queryFn: () =>
      lerLista<LinhaExcecaoAgenda>(
        clienteNavegador()
          .from("schedule_overrides")
          .select("*")
          .gte("data", de ?? "")
          .lte("data", ate ?? ""),
        "as trocas do calendário",
      ),
  });
}

/* ---------------------------------------------------- sessões de força */

export type SessaoResumo = Pick<
  LinhaSessao,
  "id" | "data" | "status" | "workout_id" | "fase" | "concluida_em"
>;

const COLUNAS_SESSAO = "id,data,status,workout_id,fase,concluida_em";

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
export function useSessoesAbertas(): UseQueryResult<SessaoResumo[]> {
  return useQuery({
    queryKey: chaves.sessoesAbertas(),
    queryFn: () =>
      lerLista<SessaoResumo>(
        clienteNavegador()
          .from("sessions")
          .select(COLUNAS_SESSAO)
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

/* ------------------------------------------ estado e eventos por exercício */

export function useEstados(
  ids: readonly string[],
): UseQueryResult<LinhaEstadoExercicio[]> {
  return useQuery({
    queryKey: chaves.estados(ids),
    enabled: ids.length > 0,
    queryFn: () =>
      lerLista<LinhaEstadoExercicio>(
        clienteNavegador()
          .from("exercise_state")
          .select("*")
          .in("exercise_id", [...ids]),
        "as cargas dos exercícios",
      ),
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
  "exercise_id" | "session_id" | "set_index" | "reps" | "tipo" | "concluida" | "registrada_em"
>;

/** As séries recentes destes exercícios (o tipo `maximo` compara com elas). */
export function useSeriesAnteriores(
  ids: readonly string[],
): UseQueryResult<SerieAnterior[]> {
  return useQuery({
    queryKey: chaves.seriesAnteriores(ids),
    enabled: ids.length > 0,
    queryFn: () =>
      lerLista<SerieAnterior>(
        clienteNavegador()
          .from("session_sets")
          .select("exercise_id,session_id,set_index,reps,tipo,concluida,registrada_em")
          .in("exercise_id", [...ids])
          .eq("tipo", "trabalho")
          .order("registrada_em", { ascending: false })
          .limit(SERIES_ANTERIORES),
        "as séries anteriores",
      ),
  });
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
