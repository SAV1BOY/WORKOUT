/**
 * Leituras da tela de progresso e do histórico da ficha (SPEC §3.6 e §3.7).
 *
 * Só leitura, como `lib/queries/dados.ts`: as contas ficam em `lib/progresso.ts`
 * (puras, testadas) e a tela só desenha o que sai delas.
 */
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { clienteNavegador } from "@/lib/supabase/client";
import type { SerieBruta, SessaoBruta } from "@/lib/progresso";
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
  seriesDesde: (de: string) => ["progresso", "series", de] as const,
  seriesDoExercicio: (id: string) => ["progresso", "series-ex", id] as const,
  recordes: () => ["progresso", "recordes"] as const,
};

interface Resposta<T> {
  data: T | null;
  error: { message: string } | null;
}

async function lerLista<T>(
  promessa: PromiseLike<Resposta<T[]>>,
  oQue: string,
): Promise<T[]> {
  const { data, error } = await promessa;
  if (error) throw new Error(`Não consegui carregar ${oQue}. ${error.message}`);
  return data ?? [];
}

/** Todas as sessões de força (é um usuário só; 500 cobrem uns três anos). */
export function useSessoesTodas(): UseQueryResult<SessaoBruta[]> {
  return useQuery({
    queryKey: chavesProgresso.sessoesTodas(),
    queryFn: () =>
      lerLista<SessaoBruta>(
        clienteNavegador()
          .from("sessions")
          .select("id,data,status,workout_id")
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
