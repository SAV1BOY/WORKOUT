"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { MaterialDoTreino } from "@/components/exercicio/equipamento-de-hoje";
import { equipamentoDaSessao } from "@/lib/equipamento-da-sessao";
import { guardarMaterialDaSessao } from "@/lib/queries/sessao";
import type { EquipamentoTag } from "@/lib/schemas";
import { definirEquipamentoDaSessao, type SessaoLocal } from "@/lib/sessao";

export function useMaterialDaSessao(sessao: SessaoLocal | null | undefined,
  aoConfirmar: (id: string, tags: ReadonlySet<EquipamentoTag>, confirmada: SessaoLocal, anterior: SessaoLocal) => void
): (MaterialDoTreino & { aguardar: () => Promise<void> }) | undefined {
  const [pendente, setPendente] = useState<{ id: string; tags: ReadonlySet<EquipamentoTag> } | null>(null);
  const gravacao = useRef(Promise.resolve());
  const aguardar = useCallback(() => gravacao.current, []);
  if (!sessao || sessao.status !== "em_andamento") return undefined;
  return {
    aguardar,
    disponiveis: pendente?.id === sessao.id ? pendente.tags : equipamentoDaSessao(sessao),
    aoMudar(tags) {
      const edicao = { id: sessao.id, tags };
      setPendente(edicao);
      gravacao.current = gravacao.current.then(() => guardarMaterialDaSessao(definirEquipamentoDaSessao(sessao, tags)))
        .then((confirmada) => aoConfirmar(sessao.id, tags, confirmada, sessao))
        .catch(() => { toast.error("Não foi possível guardar o equipamento desta sessão. Tente de novo."); })
        .finally(() => setPendente((atual) => atual === edicao ? null : atual));
    },
  };
}
