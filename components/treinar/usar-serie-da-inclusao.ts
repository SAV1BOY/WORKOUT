"use client";

import { useEffect, type RefObject } from "react";
import { guardarSeriesQueChegaram, haSeriesDaInclusaoRecebida, incorporarSeriesQueChegaram } from "@/lib/queries/serie-da-inclusao-remota";
import type { SessaoLocal } from "@/lib/sessao";
import type { LinhaSerie } from "@/lib/types";

interface Parametros {
  conta: string;
  id: string;
  sessao: SessaoLocal | null | undefined;
  ultima: RefObject<SessaoLocal | null | undefined>;
  series: readonly LinhaSerie[] | undefined;
  refazer(opcoes?: { cancelRefetch?: boolean }): Promise<unknown>;
  bloqueada: boolean;
  adotar(sessao: SessaoLocal): void;
}

export function useSerieDaInclusao({ conta, id, sessao, ultima, series, refazer, bloqueada, adotar }: Parametros) {
  const token = sessao?.plano?.ultima_inclusao?.id;
  useEffect(() => {
    if (!token || bloqueada) return;
    let ativa = true;
    const consultar = async () => {
      if (navigator.onLine && await haSeriesDaInclusaoRecebida(conta, id, token) && ativa) await refazer({ cancelRefetch: false });
    };
    const reler = () => { void consultar().catch(() => {}); };
    reler();
    window.addEventListener("online", reler);
    return () => { ativa = false; window.removeEventListener("online", reler); };
  }, [conta, id, token, bloqueada, refazer]);

  useEffect(() => {
    if (!token || bloqueada || !series?.length) return;
    let ativa = true;
    void guardarSeriesQueChegaram(conta, id, token, series, () => ativa ? ultima.current : null).then(mudanca => {
      const atual = ultima.current;
      if (!ativa || !mudanca || atual?.id !== id || atual.userId !== conta) return;
      const nova = incorporarSeriesQueChegaram(atual, token, mudanca.ordem, mudanca.exercicio, mudanca.registros);
      if (nova !== atual) adotar(nova);
    }).catch(() => {});
    return () => { ativa = false; };
  }, [conta, id, token, bloqueada, ultima, series, adotar]);
}
