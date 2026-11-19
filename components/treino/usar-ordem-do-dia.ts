"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { chaveDaOrdemDoDia, guardarOrdemNoAparelho, lerOrdem, lerTextoDaOrdem, type OrdemTemporaria } from "@/lib/ordem";
import type { TreinoId } from "@/lib/schemas";

/** As duas telas que iniciam a sessão acompanham o mesmo rascunho da conta. */
export function useOrdemDoDia(conta: string, data: string | null, treino: TreinoId | null) {
  const chave = conta && data && treino ? chaveDaOrdemDoDia(conta, data, treino) : null;
  const [temporaria, setTemporaria] = useState<OrdemTemporaria | null>(null);

  const assinar = useCallback((avisar: () => void) => {
    if (!chave) return () => {};
    const atualizar = (evento: StorageEvent) => {
      if (evento.key !== null && evento.key !== chave) return;
      setTemporaria(null);
      avisar();
    };
    window.addEventListener("storage", atualizar);
    return () => window.removeEventListener("storage", atualizar);
  }, [chave]);
  const ler = useCallback(() => data && treino ? lerTextoDaOrdem(conta, data, treino) : null, [conta, data, treino]);
  const texto = useSyncExternalStore(assinar, ler, () => null);
  const salva = useMemo(() => data && treino ? lerOrdem(texto, data, treino) : [], [texto, data, treino]);
  const ordemTemporaria = temporaria && temporaria.chave === chave ? temporaria : undefined;

  const guardar = useCallback((ids: readonly string[], nova: string[]) => {
    if (!chave || !data || !treino) return;
    const textoAnterior = ler();
    if (guardarOrdemNoAparelho(conta, data, treino, ids, nova)) {
      setTemporaria(null);
    } else {
      setTemporaria({ chave, ordem: nova, textoAnterior });
      toast.error("O aparelho não conseguiu guardar a ordem. Ela vale enquanto esta tela estiver aberta.");
    }
  }, [chave, conta, data, treino, ler]);
  return { ordem: ordemTemporaria?.ordem ?? salva, ordemTemporaria, guardar };
}
