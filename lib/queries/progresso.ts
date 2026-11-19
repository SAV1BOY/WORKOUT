/**
 * Leituras da tela de progresso e do histórico da ficha (SPEC §3.6 e §3.7).
 *
 * Só leitura, como `lib/queries/dados.ts`: as contas ficam em `lib/progresso.ts`
 * (puras, testadas) e a tela só desenha o que sai delas.
 */
"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { chaveDoHistorico, lerHistoricoDaConta } from "@/lib/queries/historico-da-sessao";
import { lerFonteDoRelatorio, lerListaDoRelatorio, type ListaDoRelatorio } from "@/lib/queries/lista-do-relatorio";
import { lerLista, lerTabelaCompleta } from "@/lib/queries/ler";
import { clienteNavegador } from "@/lib/supabase/client";
import type { SerieBruta, SessaoBruta } from "@/lib/progresso";
import type { LinhaEventoProgressao, LinhaRecorde } from "@/lib/types";

/** Quantas séries a janela de 12 semanas pode ter. */
export const LIMITE_SERIES = 3000;
/** Quantas séries a ficha de um exercício mostra. */
export const LIMITE_SERIES_DO_EXERCICIO = 300;

export const COLUNAS_SERIE =
  "exercise_id,session_id,set_index,tipo,reps,reps_lado2,carga_kg,tempo_s,tempo_s_lado2,passos,assistencia,concluida,registrada_em";

export const chavesProgresso = {
  sessoesTodas: () => ["progresso", "sessoes"] as const,
  eventosTodos: (conta: string) => ["progresso", "eventos-todos", conta] as const,
  seriesDesde: (de: string) => ["progresso", "series", de] as const,
  seriesTodas: (conta: string) => ["progresso", "series-todas", conta] as const,
  seriesDoExercicio: (id: string) => ["progresso", "series-ex", id] as const,
  recordes: () => ["progresso", "recordes"] as const,
};

/** Todas as sessões de força da conta, da mais nova para a mais antiga. */
export function useSessoesTodas(conta?: string | null): UseQueryResult<SessaoBruta[]> {
  return useQuery({
    queryKey: conta ? chaveDoHistorico(conta) : chavesProgresso.sessoesTodas(),
    meta: { contaDoRelatorio: conta },
    networkMode: conta ? "always" : "online",
    enabled: conta !== null,
    refetchOnMount: conta ? "always" : true,
    queryFn: async (contexto) => {
      if (conta) return lerHistoricoDaConta(contexto.client, conta, contexto.signal);
      const sessoes = await lerTabelaCompleta<SessaoBruta>(
        "sessions", "id,user_id,data,status,workout_id,duracao_s,plano", "os seus treinos",
      );
      return sessoes.sort((a, b) => b.data.localeCompare(a.data));
    },
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
 * Relatório lê a mesma janela que os treinos e os minutos. O histórico usa a lista
 * completa, e os gráficos recortam dela o período exibido.
 */
export function useSeriesTodas(conta: string | null): UseQueryResult<ListaDoRelatorio<SerieBruta>> {
  return useQuery({
    queryKey: chavesProgresso.seriesTodas(conta ?? ""),
    meta: { contaDoRelatorio: conta },
    enabled: Boolean(conta),
    networkMode: "always",
    queryFn: ({ client, signal }) => lerFonteDoRelatorio(client, conta!, "series", ["progresso", "series-todas"], async () => {
      const series = await lerTabelaCompleta<SerieBruta>(
        "session_sets", `id,user_id,${COLUNAS_SERIE}`, "as séries registradas", conta!, signal,
      );
      return series.sort((a, b) => a.registrada_em.localeCompare(b.registrada_em));
    }, signal),
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

/** O ID distingue decisões iguais para dois exercícios na mesma sessão. */
export type EventoDoHistorico = Pick<LinhaEventoProgressao, "id" | "user_id" | "session_id" | "motivo">;

export function lerEventosDoHistorico(conta: string, sinal?: AbortSignal): Promise<EventoDoHistorico[]> {
  const consultar = () => lerTabelaCompleta<EventoDoHistorico>(
    "progression_events", "id,user_id,session_id,motivo", "o histórico de progressão", conta, sinal,
  );
  return lerListaDoRelatorio(conta, `eventos-do-historico:${conta}`, consultar, sinal);
}

/** As decisões do motor em todas as sessões, inclusive nas semanas anteriores aos gráficos. */
export function useEventosTodos(conta: string): UseQueryResult<EventoDoHistorico[]> {
  return useQuery({
    queryKey: chavesProgresso.eventosTodos(conta),
    meta: { contaDoRelatorio: conta },
    enabled: Boolean(conta),
    networkMode: "always",
    queryFn: ({ signal }) => lerEventosDoHistorico(conta, signal),
  });
}
