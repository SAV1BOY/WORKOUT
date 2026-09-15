"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { estadosPorExercicio } from "@/lib/hoje";
import { opcoesDeMontagem } from "@/lib/preferencias";
import {
  useEstados,
  usePerfil,
  useRecordes,
  useSeriesAnteriores,
} from "@/lib/queries/dados";
import { criarSessaoLivre } from "@/lib/queries/sessao";
import { useHoje } from "@/lib/relogio";
import { seriesAnterioresPorExercicio, type RecordeAntes } from "@/lib/sessao";

/**
 * "Começar" numa coleção, na Parte do corpo em foco ou no Personalizar
 * (SPEC §13.4 e §14.3): monta a sessão livre com o mesmo estado do motor que
 * uma sessão do programa usaria e leva para o player.
 *
 * `ids` são os **candidatos** (o grupo inteiro, a coleção inteira): é por eles
 * que `exercise_state`, as séries anteriores e os recordes são lidos antes do
 * toque, para o botão não esperar a rede.
 */
export function useSessaoLivre(ids: readonly string[]) {
  const router = useRouter();
  const cliente = useQueryClient();
  const hoje = useHoje();
  const [ocupado, setOcupado] = useState(false);

  const perfilQ = usePerfil();
  const chaveDosIds = useMemo(() => [...ids].sort().join(","), [ids]);
  const lista = useMemo(
    () => (chaveDosIds === "" ? [] : chaveDosIds.split(",")),
    [chaveDosIds],
  );
  const estadosQ = useEstados(lista);
  const anterioresQ = useSeriesAnteriores(lista);
  const recordesQ = useRecordes(lista);

  const comecar = useCallback(
    async (
      escolhidos: readonly string[],
      rotulos: { titulo?: string | null; colecao?: string | null } = {},
    ) => {
      const perfil = perfilQ.data;
      if (!perfil || !hoje || escolhidos.length === 0) return;
      setOcupado(true);
      try {
        const recordes: Record<string, RecordeAntes> = {};
        for (const r of recordesQ.data ?? []) recordes[r.exercise_id] = r;

        const sessao = await criarSessaoLivre({
          cliente,
          userId: perfil.user_id,
          data: hoje,
          fase: perfil.fase_atual,
          exercicios: escolhidos,
          titulo: rotulos.titulo ?? null,
          colecao: rotulos.colecao ?? null,
          estados: estadosPorExercicio(estadosQ.data ?? []),
          anteriores: seriesAnterioresPorExercicio(anterioresQ.data ?? []),
          recordes,
          /*
           * Sem conseguir ler `exercise_state` a sessão registra tudo mas não
           * avalia: uma carga inventada apagaria a progressão real (§6.3).
           */
          estadoConhecido:
            estadosQ.data !== undefined && recordesQ.data !== undefined,
          // as barras já pesadas na balança mudam a escala (SPEC §3.9)
          opcoesMontagem: opcoesDeMontagem(perfil.prefs),
        });
        router.push(`/treinar/${sessao.id}`);
      } catch {
        setOcupado(false);
        toast.error("Não consegui começar o treino agora.");
      }
    },
    [
      perfilQ.data,
      hoje,
      cliente,
      estadosQ.data,
      anterioresQ.data,
      recordesQ.data,
      router,
    ],
  );

  return { comecar, ocupado, pronto: perfilQ.data !== undefined && hoje !== null };
}
