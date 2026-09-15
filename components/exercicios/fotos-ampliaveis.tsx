"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { urlFotos } from "@/lib/dados";
import type { Exercicio } from "@/lib/schemas";

const LEGENDA = ["início do movimento", "fim do movimento"];

/**
 * As duas fotos do exercício (SPEC §3.6 e §7): toque abre em tela cheia.
 */
export function FotosAmpliaveis({ exercicio }: { exercicio: Exercicio }) {
  const fotos = urlFotos(exercicio);
  const [aberta, setAberta] = useState<number | null>(null);
  if (fotos.length === 0) return null;

  const foto = aberta === null ? null : fotos[aberta];

  return (
    <>
      <ul className="grid grid-cols-2 gap-2">
        {fotos.map((url, i) => (
          <li key={url}>
            <button
              type="button"
              onClick={() => setAberta(i)}
              className="alvo block w-full"
              aria-label={`Ampliar a foto do ${LEGENDA[i] ?? "movimento"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- foto local em /public */}
              <img
                src={url}
                alt={`${exercicio.nome} — ${LEGENDA[i] ?? "movimento"}`}
                loading="lazy"
                className="bg-muted/40 aspect-square w-full rounded-lg object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={foto !== null} onOpenChange={(v) => !v && setAberta(null)}>
        <DialogContent className="max-w-[96vw] p-2 sm:max-w-lg">
          <DialogTitle className="sr-only">
            {exercicio.nome} — {LEGENDA[aberta ?? 0] ?? "movimento"}
          </DialogTitle>
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto local em /public
            <img
              src={foto}
              alt={`${exercicio.nome} — ${LEGENDA[aberta ?? 0] ?? "movimento"}`}
              className="max-h-[80dvh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
