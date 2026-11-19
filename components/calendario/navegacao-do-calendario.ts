"use client";

import { isMatch } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { iso } from "@/lib/calendario";
import { entradaDoEstado } from "@/lib/camada-modal";

/** A data pertence à entrada desta aba. Abrir o calendário de novo começa em Hoje. */
export function useNavegacaoDoCalendario(conta: string) {
  const [referencia, setReferencia] = useState<string | null>(null);
  const [focoDeVolta, setFocoDeVolta] = useState<string | null>(null);

  useEffect(() => {
    function lerEntrada(evento?: Event) {
      if (location.pathname !== "/calendario") return;
      // O documento novo perdeu a folha do anterior, mas pode ter herdado sua entrada.
      // Depois da montagem, as travessias de camadas ficam com o próprio diálogo.
      if (evento && entradaDoEstado(history.state)) return;
      const salvo = history.state?.retornoDoCalendario;
      const destaConta = salvo?.conta === conta ? salvo : null;
      const dia = new URL(location.href).searchParams.get("dia");
      // O link abre um dia do histórico. As semanas futuras vêm dos controles de programação da própria aba.
      const diaDoHistorico = dia && dia <= iso(new Date()) && /^\d{4}-\d{2}-\d{2}$/.test(dia) && isMatch(dia, "yyyy-MM-dd");
      setReferencia(diaDoHistorico ? dia : destaConta?.referencia ?? null);
      setFocoDeVolta(destaConta?.alvo ?? null);
    }
    lerEntrada();
    window.addEventListener("popstate", lerEntrada);
    window.addEventListener("pageshow", lerEntrada);
    return () => {
      window.removeEventListener("popstate", lerEntrada);
      window.removeEventListener("pageshow", lerEntrada);
    };
  }, [conta]);

  function guardar(dia: string | null, alvo?: string) {
    const url = new URL(location.href);
    if (dia && dia <= iso(new Date())) url.searchParams.set("dia", dia);
    else url.searchParams.delete("dia");
    const retornoDoCalendario = { conta, referencia: dia, alvo };
    // replace conserva a entrada de página embaixo do diálogo. Voltar continua sendo um único gesto.
    if (url.href === location.href) history.replaceState({ ...history.state, retornoDoCalendario }, "");
    else history.replaceState({ retornoDoCalendario }, "", url);
    setFocoDeVolta(null);
    setReferencia(dia);
  }

  /** Ref do gatilho original: o perfil e a grade podem só chegar depois da restauração da rota. */
  const focarAoVoltar = useCallback((no: HTMLButtonElement | null) => {
    if (no && no.id === focoDeVolta && !no.closest("[inert]")) {
      no.focus();
      setFocoDeVolta(null);
    }
  }, [focoDeVolta]);

  return { referencia, guardar, focarAoVoltar };
}
