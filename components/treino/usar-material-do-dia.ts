"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { MaterialDoTreino } from "@/components/exercicio/equipamento-de-hoje";
import { chaveDoEquipamentoDoDia, guardarEquipamentoDoDia, lerEquipamentoDoDia } from "@/lib/equipamento-da-sessao";
import type { EquipamentoTag, TreinoId } from "@/lib/schemas";

/** Rascunho do próximo treino. A sessão recebe a seleção quando começa. */
export function useMaterialDoDia(conta: string, data: string | null, treino: TreinoId | null): MaterialDoTreino | undefined {
  const [escolha, setEscolha] = useState<{ chave: string; tags: ReadonlySet<EquipamentoTag> } | null>(null);
  const chave = data && treino ? chaveDoEquipamentoDoDia(conta, data, treino) : null;
  const inicial = useMemo(() => conta && data && treino ? lerEquipamentoDoDia(conta, data, treino) : null,
    [conta, data, treino]);

  useEffect(() => {
    if (!data || !treino || !chave) return;
    const atualizar = (evento: StorageEvent) => {
      if (evento.key !== null && evento.key !== chave) return;
      setEscolha({ chave, tags: lerEquipamentoDoDia(conta, data, treino) });
    };
    window.addEventListener("storage", atualizar);
    return () => window.removeEventListener("storage", atualizar);
  }, [conta, data, treino, chave]);

  if (!inicial || !data || !treino || !chave) return undefined;
  return {
    disponiveis: escolha?.chave === chave ? escolha.tags : inicial,
    aoMudar(tags) {
      setEscolha({ chave, tags });
      try {
        guardarEquipamentoDoDia(conta, data, treino, tags);
      } catch {
        toast.error("O aparelho não conseguiu guardar a escolha. Ela vale enquanto esta tela estiver aberta.");
      }
    },
  };
}
