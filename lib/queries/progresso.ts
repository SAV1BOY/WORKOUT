/**
 * Leituras da tela de progresso e do histórico da ficha (SPEC §3.6 e §3.7).
 *
 * Só leitura, como `lib/queries/dados.ts`: as contas ficam em `lib/progresso.ts`
 * (puras, testadas) e a tela só desenha o que sai delas.
 */
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { lerLista } from "@/lib/queries/ler";
import { clienteNavegador } from "@/lib/supabase/client";
import type { SerieBruta, SessaoBruta } from "@/lib/progresso";
import type { EventoDeSessao } from "@/lib/relatorio";
import type { LinhaRecorde } from "@/lib/types";

/** Quantas sessões de força a tela de progresso lê (o total de §3.7). */
export const LIMITE_SESSOES = 500;
/** Quantas séries a janela de 12 semanas pode ter. */
export const LIMITE_SERIES = 3000;
/** Quantas séries a ficha de um exercício mostra. */
export const LIMITE_SERIES_DO_EXERCICIO = 300;

export const COLUNAS_SERIE =
  "exercise_id,session_id,set_index,tipo,reps,reps_lado2,carga_kg,tempo_s,tempo_s_lado2,passos,assistencia,concluida,registrada_em";

export const chavesProgresso = {
  sessoesTodas: () => ["progresso", "sessoes"] as const,
  eventosDesde: (de: string) => ["progresso", "eventos", de] as const,
  seriesDesde: (de: string) => ["progresso", "series", de] as const,
  seriesTodas: () => ["progresso", "series-todas"] as const,
  seriesDoExercicio: (id: string) => ["progresso", "series-ex", id] as const,
  recordes: () => ["progresso", "recordes"] as const,
};

/** Todas as sessões de força (é um usuário só; 500 cobrem uns três anos). */
export function useSessoesTodas(): UseQueryResult<SessaoBruta[]> {
  return useQuery({
    queryKey: chavesProgresso.sessoesTodas(),
    queryFn: () =>
      lerLista<SessaoBruta>(
        clienteNavegador()
          .from("sessions")
          .select("id,data,status,workout_id,duracao_s,plano")
          .order("data", { ascending: false })
          .limit(LIMITE_SESSOES),
        "os seus treinos",
      ),
  });
}

/** As séries registradas a partir de uma data (a janela dos gráficos). */
export function useSeriesDesde(de: string | null): UseQueryResult<SerieBruta[]> {
  return useQuery({
    queryKey: chavesProgresso.seriesDesde(de ?? ""),
    enabled: de !== null,
    queryFn: () =>
      lerLista<SerieBruta>(
        clienteNavegador()
          .from("session_sets")
          .select(COLUNAS_SERIE)
          .gte("registrada_em", de ?? "")
          .order("registrada_em", { ascending: true })
          .limit(LIMITE_SERIES),
        "as séries registradas",
      ),
  });
}

/**
 * Todas as séries registradas (SPEC §14.4): o volume acumulado do topo do
 * Relatório lê a mesma janela que os treinos e os minutos. O histórico e os
 * gráficos recortam 26 semanas desta mesma lista, sem uma segunda leitura.
 */
export function useSeriesTodas(): UseQueryResult<SerieBruta[]> {
  return useQuery({
    queryKey: chavesProgresso.seriesTodas(),
    queryFn: () =>
      lerLista<SerieBruta>(
        clienteNavegador()
          .from("session_sets")
          .select(COLUNAS_SERIE)
          .order("registrada_em", { ascending: true })
          .limit(LIMITE_SERIES),
        "as séries registradas",
      ),
  });
}

/** As séries de um exercício (o histórico da ficha, SPEC §3.6). */
export function useSeriesDoExercicio(
  exercicioId: string | null,
): UseQueryResult<SerieBruta[]> {
  return useQuery({
    queryKey: chavesProgresso.seriesDoExercicio(exercicioId ?? ""),
    enabled: exercicioId !== null,
    queryFn: () =>
      lerLista<SerieBruta>(
        clienteNavegador()
          .from("session_sets")
          .select(COLUNAS_SERIE)
          .eq("exercise_id", exercicioId ?? "")
          .order("registrada_em", { ascending: false })
          .limit(LIMITE_SERIES_DO_EXERCICIO),
        "o histórico deste exercício",
      ),
  });
}

/** Todos os recordes (view `v_records`, SPEC §3.7). */
export function useTodosOsRecordes(): UseQueryResult<LinhaRecorde[]> {
  return useQuery({
    queryKey: chavesProgresso.recordes(),
    queryFn: () =>
      lerLista<LinhaRecorde>(
        clienteNavegador().from("v_records").select("*"),
        "os seus recordes",
      ),
  });
}

/** Quantos eventos do motor a janela do histórico lê. */
export const LIMITE_EVENTOS = 1000;

/**
 * Os eventos do motor a partir de uma data: é deles que sai o ↑/=/↓ de cada
 * sessão em "Todos os registros" (SPEC §13.5).
 */
export function useEventosDesde(
  de: string | null,
): UseQueryResult<EventoDeSessao[]> {
  return useQuery({
    queryKey: chavesProgresso.eventosDesde(de ?? ""),
    enabled: de !== null,
    queryFn: () =>
      lerLista<EventoDeSessao>(
        clienteNavegador()
          .from("progression_events")
          .select("session_id,motivo")
          .gte("data", de ?? "")
          .limit(LIMITE_EVENTOS),
        "o histórico de progressão",
      ),
  });
}
