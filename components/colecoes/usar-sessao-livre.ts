"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { itensDeIds } from "@/lib/livre";
import { estadosPorExercicio } from "@/lib/hoje";
import { opcoesDeMontagem } from "@/lib/preferencias";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import {
  useEstados,
  usePerfil,
  useRecordes,
  useSeriesAnteriores,
} from "@/lib/queries/dados";
import { lerMotorParaRepetir } from "@/lib/queries/motor-repetir-treino";
import { criarSessaoLivre, type EntradaCriacaoLivre } from "@/lib/queries/sessao";
import { useHoje } from "@/lib/relogio";
import { seriesAnterioresPorExercicio, type RecordeAntes } from "@/lib/sessao";

async function motorDoModelo(cliente: QueryClient, conta: string, escolhidos: readonly string[]) {
  const confirmar = () => confirmarContaDoTreino(conta, "Não foi possível confirmar a conta do treino.");
  await confirmar();
  const motor = await lerMotorParaRepetir(cliente, conta, escolhidos, confirmar);
  await confirmar();
  return motor;
}

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
      opcoes: Pick<EntradaCriacaoLivre, "titulo" | "colecao" | "equipamentosDisponiveis" | "descansosPorExercicio"> & {
        contaDoModelo?: string;
        seriesPorExercicio?: Readonly<Record<string, number>>;
      } = {},
    ) => {
      const perfil = perfilQ.data;
      if (!perfil || !hoje || escolhidos.length === 0) return;
      setOcupado(true);
      try {
        const recordes: Record<string, RecordeAntes> = {};
        for (const r of recordesQ.data ?? []) recordes[r.exercise_id] = r;

        if (opcoes.contaDoModelo && opcoes.contaDoModelo !== perfil.user_id) {
          throw new Error("O treino salvo pertence a outra conta.");
        }
        const motor = opcoes.contaDoModelo ? await motorDoModelo(cliente, opcoes.contaDoModelo, escolhidos) : {
          estados: estadosPorExercicio(estadosQ.data ?? []),
          anteriores: seriesAnterioresPorExercicio(anterioresQ.data ?? []),
          recordes,
          // Sem conseguir ler as cargas, uma sessão avulsa registra as séries sem avaliar a progressão.
          estadoConhecido: estadosQ.data !== undefined && recordesQ.data !== undefined,
        };
        const sessao = await criarSessaoLivre({
          ...motor,
          cliente,
          userId: perfil.user_id,
          data: hoje,
          fase: perfil.fase_atual,
          itens: itensDeIds(escolhidos, opcoes.seriesPorExercicio),
          titulo: opcoes.titulo ?? null,
          colecao: opcoes.colecao ?? null,
          equipamentosDisponiveis: opcoes.equipamentosDisponiveis,
          descansosPorExercicio: opcoes.descansosPorExercicio,
          // as barras já pesadas na balança mudam a escala (SPEC §3.9)
          opcoesMontagem: opcoesDeMontagem(perfil.prefs),
        });
        try {
          router.push(`/treinar/${sessao.id}`);
        } catch {
          setOcupado(false);
          toast.error("O treino foi criado, mas não foi possível abri-lo.");
        }
        return sessao.id;
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
