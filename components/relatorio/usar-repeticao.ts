"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { SessaoBruta } from "@/lib/progresso";
import type { LinhaPerfil } from "@/lib/types";

/** Uma única ação atende a lista inteira, inclusive dois toques no mesmo render. */
export function useRepetirTreinoLivre(perfil: LinhaPerfil, hoje: string) {
  const cliente = useQueryClient();
  const router = useRouter();
  const emCurso = useRef(false);
  const [repetindoId, setRepetindoId] = useState<string | null>(null);
  const [erro, setErro] = useState<{ id: string; mensagem: string } | null>(null);

  const repetir = useCallback(async (origem: SessaoBruta) => {
    if (emCurso.current) return;
    emCurso.current = true;
    setRepetindoId(origem.id);
    setErro(null);
    try {
      const { abrirRepeticaoDoTreino } = await import("@/lib/queries/repetir-treino");
      const destino = await abrirRepeticaoDoTreino(cliente, perfil, hoje, origem);
      if (destino.retomada) toast.info("Você já tem um treino em andamento. Retomando esse treino.");
      router.push(`/treinar/${destino.id}`);
    } catch (causa) {
      setErro({
        id: origem.id,
        mensagem: causa instanceof Error && causa.message.startsWith("Este treino")
          ? causa.message : "Não foi possível abrir o treino. Tente novamente.",
      });
      emCurso.current = false;
      setRepetindoId(null);
    }
  }, [cliente, perfil, hoje, router]);

  return { repetir, repetindoId, erro };
}
