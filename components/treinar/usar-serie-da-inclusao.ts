"use client";

import { useEffect, useState, type RefObject } from "react";
import { avisoGuardadoDaInclusao, avisoSemVaga, guardarSeriesQueChegaram, haSeriesDaInclusaoRecebida, incorporarSeriesQueChegaram, rascunhoDoRegistro } from "@/lib/queries/serie-da-inclusao-remota";
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
  const [aviso, setAviso] = useState<{ conta: string; id: string; token: string; texto: string } | null>(null);
  useEffect(() => {
    if (!token || bloqueada) return;
    let ativa = true;
    void avisoGuardadoDaInclusao(conta, id, token).then(texto => {
      if (ativa && texto) setAviso({ conta, id, token, texto });
    }).catch(() => {});
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
      const bloco = nova.blocos.find(b => b.ordem === mudanca.ordem);
      const mensagens = mudanca.registros.flatMap(r => {
        const movida = bloco?.series.find(s => s.id === r.anterior.id);
        if (movida && movida.setIndex !== r.anterior.setIndex) {
          return [`A série ${r.anterior.setIndex} foi registrada em outro aparelho. Seu ajuste ficou na série ${movida.setIndex}.`];
        }
        const digitada = atual.blocos.find(b => b.ordem === mudanca.ordem)?.series.find(s => s.id === r.anterior.id);
        const rascunho = rascunhoDoRegistro(digitada, r) ?? r.rascunho;
        return rascunho && !movida ? [avisoSemVaga(rascunho)] : [];
      });
      if (mensagens.length) setAviso({ conta, id, token, texto: mensagens.join(" ") });
      if (nova !== atual) adotar(nova);
    }).catch(() => {});
    return () => { ativa = false; };
  }, [conta, id, token, bloqueada, ultima, series, adotar]);
  return aviso?.conta === conta && aviso.id === id && aviso.token === token ? aviso.texto : null;
}
