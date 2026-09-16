"use client";

import { useEffect, useState } from "react";

/** Quanto tempo no esqueleto até a tela oferecer uma saída. */
export const ESPERA_DEMAIS_MS = 10_000;

/**
 * `true` quando a condição continua ligada por `ms` seguidos — o esqueleto que
 * não vira conteúdo (SPEC §3.1: toda tela de erro tem saída).
 *
 * Uma leitura que falha já cai no componente `Erro`; o que este ganho cobre é
 * a leitura que nunca volta (o Dexie que não responde, a consulta presa), em
 * que a tela ficaria no esqueleto para sempre, sem erro e sem botão. Desliga
 * sozinho quando a condição sai, então a tela boa nunca vê o aviso.
 */
export function useDemorouDemais(ativo: boolean, ms = ESPERA_DEMAIS_MS): boolean {
  const [demorou, setDemorou] = useState(false);

  useEffect(() => {
    if (!ativo) {
      setDemorou(false);
      return;
    }
    const conta = setTimeout(() => setDemorou(true), ms);
    return () => clearTimeout(conta);
  }, [ativo, ms]);

  return demorou;
}
