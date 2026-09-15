"use client";

import { Dumbbell } from "lucide-react";
import { useState } from "react";
import { midiaDaMiniatura } from "@/lib/midia";
import { cn } from "@/lib/utils";

/**
 * Miniatura de um exercício (SPEC §13.3 e marco Mídia): a ilustração com
 * licença livre quando existe, senão a figura animada, senão a foto `-1.jpg`,
 * e o ícone quando nenhuma carrega. A escolha é de `lib/midia.ts`; todas as
 * imagens saem de `assets/` pelo caminho do JSON (§13.1).
 */
export function Miniatura({
  exercicioId,
  decorativa = false,
  className,
}: {
  exercicioId: string;
  /** Quando o nome do exercício já está escrito ao lado (catálogo). */
  decorativa?: boolean;
  className?: string;
}) {
  const { tipo, url, alt } = midiaDaMiniatura(exercicioId);
  const [quebrou, setQuebrou] = useState(false);
  const mostrar = url !== null && !quebrou;

  return (
    <span
      data-midia={mostrar ? tipo : "nenhuma"}
      className={cn(
        "relative block size-14 shrink-0 overflow-hidden rounded-xl",
        // a ilustração é traço preto sobre transparente: precisa de fundo claro
        tipo === "ilustracao" && mostrar ? "bg-ilustracao" : "bg-muted/60",
        className,
      )}
    >
      {mostrar ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagens locais de /public (SVG animado inclusive: o next/image rasteriza e mata a animação)
        <img
          src={url}
          alt={decorativa ? "" : alt}
          aria-hidden={decorativa ? true : undefined}
          loading="lazy"
          className={cn(
            "size-full",
            tipo === "foto" ? "object-cover" : "object-contain p-1",
          )}
          onError={() => setQuebrou(true)}
        />
      ) : (
        <span className="text-muted-foreground flex size-full items-center justify-center">
          <Dumbbell aria-hidden="true" className="size-5" />
        </span>
      )}
    </span>
  );
}
