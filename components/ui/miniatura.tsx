"use client";

import { Dumbbell } from "lucide-react";
import { useState } from "react";
import { miniaturaDoExercicio } from "@/lib/capas";
import { cn } from "@/lib/utils";

/**
 * Miniatura de um exercício (SPEC §13.3): a figura animada quando existe, a
 * foto `-1.jpg` quando não, e o ícone quando nem uma nem outra carregam.
 * Todas as imagens saem de `assets/` pelo caminho do JSON (§13.1).
 */
export function Miniatura({
  exercicioId,
  className,
}: {
  exercicioId: string;
  className?: string;
}) {
  const { figura, foto, alt } = miniaturaDoExercicio(exercicioId);
  const [figuraQuebrou, setFiguraQuebrou] = useState(false);
  const [fotoQuebrou, setFotoQuebrou] = useState(false);

  const usarFigura = figura !== null && !figuraQuebrou;
  const usarFoto = !usarFigura && foto !== null && !fotoQuebrou;

  return (
    <span
      className={cn(
        "bg-muted/60 relative block size-14 shrink-0 overflow-hidden rounded-xl",
        className,
      )}
    >
      {usarFigura ? (
        // eslint-disable-next-line @next/next/no-img-element -- SVG animado de /public: o next/image rasteriza e mata a animação
        <img
          src={figura}
          alt={alt}
          loading="lazy"
          className="size-full object-contain p-1"
          onError={() => setFiguraQuebrou(true)}
        />
      ) : usarFoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto local em /public, tamanho fixo
        <img
          src={foto}
          alt={alt}
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFotoQuebrou(true)}
        />
      ) : (
        <span className="text-muted-foreground flex size-full items-center justify-center">
          <Dumbbell aria-hidden="true" className="size-5" />
        </span>
      )}
    </span>
  );
}
