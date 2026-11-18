/**
 * "Começar treino" num lugar só (SPEC §14.1 e §14.5.1).
 *
 * O botão largo do card do dia (aba Treino) e o "Começar Treino A" de
 * `/treinar` fazem exatamente a mesma coisa: criam a sessão e vão direto para
 * o player. A leitura que alimenta a montagem sai do **cache** do TanStack
 * Query, que é persistido — assim uma tela aproveita o que a outra já leu e o
 * treino começado sem rede continua sendo avaliado pelo motor (SPEC §6.3).
 */
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { exerciciosDoTreino } from "@/lib/dados";
import { estadosPorExercicio } from "@/lib/hoje";
import { opcoesDeMontagem } from "@/lib/preferencias";
import {
  estadosNoCache,
  recordesNoCache,
  seriesAnterioresNoCache,
} from "@/lib/queries/dados";
import { criarSessao } from "@/lib/queries/sessao";
import { lerTrocasLocaisDoPrograma } from "@/lib/queries/trocas-do-programa";
import { limparOrdemDoAparelho } from "@/lib/ordem";
import { limparTrocasDoAparelho, resolverTrocasDoTreino } from "@/lib/trocas";
import { seriesAnterioresPorExercicio, type RecordeAntes } from "@/lib/sessao";
import type { TreinoId } from "@/lib/schemas";
import type { LinhaPerfil } from "@/lib/types";

export interface EntradaComecar {
  userId: string;
  perfil: LinhaPerfil;
  hoje: string;
  treinoId: TreinoId;
  /** Lembranças deste tipo de treino, inclusive quando o usuário o escolheu fora do dia. */
  lembradas: {
    data: Record<string, string> | undefined;
    refetch(): Promise<{ data?: Record<string, string> }>;
  };
  /** O ⇄ da lista do dia (SPEC §13.3). */
  trocas?: Record<string, string>;
  /** O "Editar" da lista do dia (SPEC §14.3). */
  ordem?: readonly string[];
  /** As escolhas acima valem só para o treino de hoje. */
  doDia?: boolean;
}

/** Os ids que a montagem precisa ler: o treino mais os substitutos. */
export function idsParaComecar(
  treinoId: TreinoId,
  trocas: Record<string, string> = {},
): string[] {
  return Array.from(
    new Set([
      ...exerciciosDoTreino(treinoId).map(({ exercicio }) => exercicio.id),
      ...Object.values(trocas),
    ]),
  );
}

/** A preferência nasceu depois do modo offline; sua ausência não impede usar o programa. */
export async function trocasParaComecar(
  { treinoId, lembradas, trocas, doDia }: Pick<EntradaComecar, "treinoId" | "lembradas" | "trocas" | "doDia">,
  lerCopiaLocal: () => Promise<Record<string, string>>,
): Promise<Record<string, string>> {
  const mapa = lembradas.data ?? (await lembradas.refetch().catch(() => undefined))?.data
    ?? await lerCopiaLocal().catch(() => ({}));
  return resolverTrocasDoTreino(treinoId, mapa, doDia === false ? {} : trocas);
}

export function useComecarTreino(aquecerRota = false): {
  iniciando: RefObject<boolean>;
  criando: TreinoId | null;
  comecar: (entrada: EntradaComecar) => Promise<void>;
} {
  const cliente = useQueryClient();
  const router = useRouter();
  const [criando, setCriando] = useState<TreinoId | null>(null);

  const idReservado = useRef<string | null>(null);
  const iniciando = useRef(false);
  useEffect(() => {
    if (!aquecerRota) return;
    idReservado.current ??= crypto.randomUUID();
    router.prefetch(`/treinar/${idReservado.current}`);
  }, [aquecerRota, router]);

  const comecar = useCallback(
    async (e: EntradaComecar) => {
      if (iniciando.current) return;
      iniciando.current = true;
      const ordem = e.doDia === false ? [] : (e.ordem ?? []);
      setCriando(e.treinoId);
      try {
        // Um toque rápido na primeira abertura também usa as escolhas da
        // conta. Em uma retomada offline a consulta resolve pelo cache local.
        const trocas = await trocasParaComecar(e, () => lerTrocasLocaisDoPrograma(cliente, e.userId, e.treinoId));
        const ids = idsParaComecar(e.treinoId, trocas);
        const { estados, conhecidos } = estadosNoCache(cliente, ids);
        const recordes: Record<string, RecordeAntes> = {};
        for (const r of recordesNoCache(cliente, ids)) recordes[r.exercise_id] = r;

        const sessao = await criarSessao({
          id: idReservado.current ?? undefined,
          cliente,
          userId: e.userId,
          data: e.hoje,
          treinoId: e.treinoId,
          fase: e.perfil.fase_atual,
          estados: estadosPorExercicio(estados),
          anteriores: seriesAnterioresPorExercicio(seriesAnterioresNoCache(cliente, ids)),
          recordes,
          /*
           * Sem conseguir ler `exercise_state` de um exercício, ele registra as
           * séries mas não é avaliado — só ele, não a sessão inteira (§6.3).
           */
          conhecidos,
          // as barras já pesadas na balança mudam a escala (SPEC §3.9)
          opcoesMontagem: opcoesDeMontagem(e.perfil.prefs),
          substituicoes: trocas,
          ordem,
        });
        if (e.doDia !== false) {
          limparTrocasDoAparelho(e.userId, e.treinoId);
          limparOrdemDoAparelho();
        }
        idReservado.current = null;
        router.push(`/treinar/${sessao.id}`);
      } catch {
        iniciando.current = false;
        setCriando(null);
        toast.error("Não consegui começar o treino agora.");
      }
    },
    [cliente, router],
  );

  return { iniciando, criando, comecar };
}
