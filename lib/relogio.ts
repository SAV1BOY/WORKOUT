"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";

/**
 * A data de hoje **do aparelho** (SPEC §5: o que é hoje se decide no celular).
 * Devolve `null` no servidor e no primeiro render para não brigar com a
 * hidratação — quem usa mostra o esqueleto até ela chegar.
 */
export function useHoje(): string | null {
  const [hoje, setHoje] = useState<string | null>(null);

  useEffect(() => {
    const atualizar = () => setHoje(format(new Date(), "yyyy-MM-dd"));
    atualizar();

    // o app fica aberto no terraço: a virada do dia e a volta para a aba
    const relogio = setInterval(atualizar, 60_000);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") atualizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, []);

  return hoje;
}
