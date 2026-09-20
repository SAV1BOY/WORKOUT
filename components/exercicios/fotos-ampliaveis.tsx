"use client";

import { useState } from "react";
import { FotoAmpliada } from "@/components/exercicios/foto-ampliada";
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
                decoding="async"
                className="bg-muted/40 aspect-square w-full rounded-lg object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {foto ? (
        <FotoAmpliada
          url={foto}
          titulo={`${exercicio.nome} — ${LEGENDA[aberta ?? 0] ?? "movimento"}`}
          aoFechar={() => setAberta(null)}
        />
      ) : null}
    </>
  );
}
