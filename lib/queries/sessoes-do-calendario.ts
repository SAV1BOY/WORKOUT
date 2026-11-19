"use client";

import { liveQuery } from "dexie";
import { useEffect, useMemo, useState } from "react";
import { bd, temIndexedDB } from "@/lib/db";
import type { SessaoBruta } from "@/lib/progresso";
import { baseDoHistoricoNoDisco, resumoDaSessaoAberta } from "@/lib/queries/historico-da-sessao";
import { useSessoesTodas } from "@/lib/queries/progresso";

type RegistrosLocais = { conta: string; historico: SessaoBruta[] | null; abertas: SessaoBruta[] };

export function lerSessoesLocaisDoCalendario(conta: string): Promise<RegistrosLocais> {
  const banco = bd();
  return banco.transaction("r", banco.cache, banco.sessaoAtiva, async () => {
    const historico = await baseDoHistoricoNoDisco(undefined, conta) ?? null;
    const itens = await banco.sessaoAtiva.toArray();
    return { conta, historico, abertas: itens.flatMap(item => resumoDaSessaoAberta(item, conta) ?? []) };
  });
}

export function reunirSessoesDoCalendario(conta: string, consultadas?: SessaoBruta[], locais?: RegistrosLocais | null): SessaoBruta[] {
  const daConta = locais?.conta === conta ? locais : undefined;
  const porId = new Map((daConta?.historico ?? consultadas ?? []).filter(s => s.user_id === conta).map(s => [s.id, s]));
  for (const aberta of daConta?.abertas ?? []) {
    const existente = porId.get(aberta.id);
    if (!existente || existente.status === "em_andamento") porId.set(aberta.id, { ...existente, ...aberta });
  }
  return [...porId.values()];
}

/** O arquivo do Histórico e os treinos abertos mudam juntos ao encerrar em outra aba. */
export function useSessoesDoCalendario(conta: string): SessaoBruta[] {
  const { data, refetch } = useSessoesTodas(conta || null);
  const [locais, setLocais] = useState<RegistrosLocais | null>(null);
  useEffect(() => {
    if (!conta) return;
    const reconectar = () => { void refetch({ cancelRefetch: false }); };
    window.addEventListener("online", reconectar);
    const assinatura = temIndexedDB() && liveQuery(() => lerSessoesLocaisDoCalendario(conta)).subscribe({
      next: setLocais, error: () => setLocais(null),
    });
    return () => {
      window.removeEventListener("online", reconectar);
      if (assinatura) assinatura.unsubscribe();
    };
  }, [conta, refetch]);
  return useMemo(() => reunirSessoesDoCalendario(conta, data, locais), [conta, data, locais]);
}
