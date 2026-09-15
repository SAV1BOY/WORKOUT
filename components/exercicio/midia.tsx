"use client";

import { useState } from "react";
import { urlFigura, urlFotos } from "@/lib/dados";
import type { Exercicio } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * A figura animada do exercício (SPEC §7). O SVG já traz o próprio CSS e roda
 * a animação SMIL sozinho; quando o exercício não tem figura, ficam as fotos.
 */
export function FiguraExercicio({
  exercicio,
  className,
}: {
  exercicio: Exercicio;
  className?: string;
}) {
  const [quebrou, setQuebrou] = useState(false);
  const url = urlFigura(exercicio);
  if (!url || quebrou) return <FotosExercicio exercicio={exercicio} className={className} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG animado servido de /public; o next/image rasteriza e mata a animação
    <img
      src={url}
      alt={`Execução do ${exercicio.nome}`}
      className={cn("bg-muted/40 h-44 w-full rounded-lg object-contain p-2", className)}
      onError={() => setQuebrou(true)}
      loading="lazy"
    />
  );
}

/** As duas fotos: início (-1) e fim (-2) do movimento (SPEC §7). */
export function FotosExercicio({
  exercicio,
  className,
}: {
  exercicio: Exercicio;
  className?: string;
}) {
  const fotos = urlFotos(exercicio);
  if (fotos.length === 0) return null;

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {fotos.map((foto, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- fotos locais em /public, tamanho fixo
        <img
          key={foto}
          src={foto}
          alt={`${exercicio.nome} — ${i === 0 ? "início" : "fim"}`}
          className="bg-muted/40 aspect-square w-full rounded-lg object-cover"
          loading="lazy"
        />
      ))}
    </div>
  );
}
