"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  avaliarConquistas,
  comConquistasVistas,
  conquistasNovas,
  conquistasVistasDasPrefs,
  type ConquistaAvaliada,
} from "@/lib/conquistas";
import { metaSemanal, metaSemanalPadrao } from "@/lib/metas";
import { useCardioTodos, usePerfil, useSoltasTodas } from "@/lib/queries/dados";
import { salvarPrefs } from "@/lib/queries/mais";
import { useSeriesTodas, useSessoesTodas } from "@/lib/queries/progresso";
import type { SessaoBruta } from "@/lib/progresso";

/**
 * Os ids já reconhecidos nesta carga do app. A gravação em
 * `prefs.conquistas_vistas` passa pela fila (§8) e o perfil pode ser relido
 * antes de ela subir — sem esta memória, o card voltaria sozinho depois do
 * "Ok". Quem guarda de verdade continua sendo as prefs; isto só cobre o vão.
 */
const avisadosAgora = new Map<string, Set<string>>();

/**
 * As conquistas avaliadas (SPEC §19.3) a partir do que já está em cache: as
 * mesmas leituras do Relatório, então abrir a Conclusão não custa uma consulta
 * nova (TanStack Query junta as duas telas na mesma chave).
 *
 * `sessaoConcluida` é a sessão que acabou de terminar e ainda está subindo pela
 * fila: ela entra na conta antes de chegar ao banco, como o card da semana da
 * §14.1.5 já faz.
 */
export function useConquistas(opcoes: {
  conta: string;
  sessaoConcluida?: { id: string; data: string } | null;
}): {
  lista: ConquistaAvaliada[];
  novas: ConquistaAvaliada[];
  pronto: boolean;
  marcarComoVistas: (ids: readonly string[]) => Promise<void>;
} {
  const cliente = useQueryClient();
  const perfilQ = usePerfil();
  const conta = opcoes.conta;
  const sessoesQ = useSessoesTodas(conta);
  const seriesQ = useSeriesTodas(conta);
  const cardiosQ = useCardioTodos(conta);
  const soltasQ = useSoltasTodas(conta);

  const perfil = perfilQ.data?.user_id === conta ? perfilQ.data : null;
  const recem = opcoes.sessaoConcluida ?? null;

  const sessoes = useMemo<SessaoBruta[]>(() => {
    const lista = sessoesQ.data ?? [];
    if (!recem) return lista;
    const jaTem = lista.some((s) => s.id === recem.id);
    if (jaTem) {
      return lista.map((s) =>
        s.id === recem.id ? { ...s, status: "concluida" as const } : s,
      );
    }
    return [
      ...lista,
      {
        id: recem.id,
        data: recem.data,
        status: "concluida" as const,
        workout_id: "livre" as const,
      },
    ];
  }, [sessoesQ.data, recem]);

  const lista = useMemo(() => {
    if (!perfil) return [];
    return avaliarConquistas({
      sessoes,
      series: seriesQ.data?.linhas ?? [],
      cardios: cardiosQ.data?.linhas ?? [],
      soltas: soltasQ.data?.linhas ?? [],
      meta: metaSemanal(perfil.prefs, perfil.fase_atual),
      planejadasNaSemana: metaSemanalPadrao(perfil.fase_atual, perfil.prefs),
      fase: { atual: perfil.fase_atual, desde: perfil.fase_desde },
    });
  }, [perfil, sessoes, seriesQ.data, cardiosQ.data, soltasQ.data]);

  const novas = useMemo(
    () =>
      conquistasNovas(lista, [
        ...conquistasVistasDasPrefs(perfil?.prefs),
        ...(avisadosAgora.get(perfil?.user_id ?? "") ?? []),
      ]),
    [lista, perfil?.prefs, perfil?.user_id],
  );

  const marcarComoVistas = useCallback(
    async (ids: readonly string[]) => {
      if (ids.length === 0) return;
      if (!perfil) return;
      const vistos = avisadosAgora.get(perfil.user_id) ?? new Set<string>();
      for (const id of ids) vistos.add(id);
      avisadosAgora.set(perfil.user_id, vistos);
      await salvarPrefs({
        userId: perfil.user_id,
        prefs: comConquistasVistas(perfil.prefs, ids),
        cliente,
      });
    },
    [perfil, cliente],
  );

  /*
   * As conquistas só valem quando as quatro listas chegaram: avisar "Primeiro
   * treino" com as séries ainda carregando daria um aviso errado.
   */
  const pronto =
    perfil !== null &&
    sessoesQ.isSuccess &&
    seriesQ.data?.completa === true &&
    cardiosQ.data?.completa === true &&
    soltasQ.data?.completa === true;

  return { lista, novas, pronto, marcarComoVistas };
}
