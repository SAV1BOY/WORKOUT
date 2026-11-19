"use client";

import { liveQuery } from "dexie";
import { useEffect, useMemo, useState } from "react";
import { chaveDoDetalheDaSessao } from "@/lib/chaves-do-historico";
import { bd, temIndexedDB } from "@/lib/db";
import type { SerieBruta } from "@/lib/progresso";

type Fechamento = { linhas: SerieBruta[]; atualizadoEm: number };

export async function lerFechamentoDoDetalhe(conta: string, sessaoId: string): Promise<Fechamento | null> {
  const item = await bd().cache.get(chaveDoDetalheDaSessao(conta, sessaoId));
  if (!item || !Number.isFinite(item.atualizadoEm) || !Array.isArray(item.valor)) return null;
  if (!item.valor.every(s => s?.user_id === conta && s.session_id === sessaoId && typeof s.id === "string")) return null;
  return { linhas: item.valor, atualizadoEm: item.atualizadoEm };
}

/** O encerramento é uma lista completa apenas daquele treino. Um GET iniciado antes ainda pode chegar depois. */
export function selecionarSeriesDoDetalhe(
  conta: string, sessaoId: string, seriesDaConta: readonly SerieBruta[],
  fonteCompleta: boolean, confirmadasEm: number | undefined, fechamento: Fechamento | null,
) {
  if (fechamento && (!fonteCompleta || confirmadasEm === undefined || fechamento.atualizadoEm >= confirmadasEm)) {
    return { linhas: fechamento.linhas, completa: true };
  }
  // O cache legado sem user_id passou pela verificação do dono da sessão na leitura do Relatório.
  const linhas = seriesDaConta.filter(s => s.session_id === sessaoId && (s.user_id === undefined || s.user_id === conta));
  return { linhas, completa: fonteCompleta };
}

/** Só a ficha aberta observa esse registro no aparelho. A leitura paginada pertence ao Relatório. */
export function useSeriesDoDetalhe(
  conta: string, sessaoId: string, seriesDaConta: readonly SerieBruta[], fonteCompleta: boolean, confirmadasEm?: number,
) {
  const [lido, setLido] = useState<{ conta: string; sessaoId: string; fechamento: Fechamento | null } | null>(null);
  useEffect(() => {
    if (!temIndexedDB()) return;
    const assinatura = liveQuery(() => lerFechamentoDoDetalhe(conta, sessaoId)).subscribe({
      next: fechamento => setLido({ conta, sessaoId, fechamento }),
      error: () => setLido({ conta, sessaoId, fechamento: null }),
    });
    return () => assinatura.unsubscribe();
  }, [conta, sessaoId]);
  const atual = lido?.conta === conta && lido.sessaoId === sessaoId ? lido : null;
  const resultado = useMemo(() => selecionarSeriesDoDetalhe(
    conta, sessaoId, seriesDaConta, fonteCompleta, confirmadasEm, atual?.fechamento ?? null,
  ), [conta, sessaoId, seriesDaConta, fonteCompleta, confirmadasEm, atual]);
  return { ...resultado, carregando: temIndexedDB() && !atual };
}
