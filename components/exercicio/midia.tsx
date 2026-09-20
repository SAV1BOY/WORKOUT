"use client";

import { useState } from "react";
import { fonteComReserva, reservaDaImagem } from "@/components/ui/imagem";
import { urlFigura, urlFotos } from "@/lib/dados";
import { MEDIDA_DA_FIGURA, medidaDaFoto, urlWebp } from "@/lib/midia";
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
      width={MEDIDA_DA_FIGURA.largura}
      height={MEDIDA_DA_FIGURA.altura}
      className={cn("bg-muted/40 h-44 w-full rounded-lg object-contain p-2", className)}
      onError={() => setQuebrou(true)}
      loading="lazy"
      decoding="async"
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
      {fotos.map((foto, i) => {
        // a derivada WebP (SPEC §22.4 item 1) pesa 44 kB contra 70 do JPEG
        const fonte = fonteComReserva(foto, urlWebp(foto));
        // a medida é a do arquivo pedido (SPEC §22.4 item 3): a derivada,
        // quando ela existe; o JPEG do kit, no build sem `npm run assets`
        const medida = medidaDaFoto(fonte.src);
        return (
          // eslint-disable-next-line @next/next/no-img-element -- fotos locais em /public, tamanho fixo
          <img
            key={foto}
            src={fonte.src}
            data-reserva={fonte.reserva}
            onError={reservaDaImagem}
            alt={`${exercicio.nome} — ${i === 0 ? "início" : "fim"}`}
            width={medida?.largura}
            height={medida?.altura}
            className="bg-muted/40 aspect-square w-full rounded-lg object-cover"
            loading="lazy"
            decoding="async"
          />
        );
      })}
    </div>
  );
}
