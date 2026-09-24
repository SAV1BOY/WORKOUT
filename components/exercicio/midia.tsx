"use client";

import { useState } from "react";
import { fonteComReserva, reservaDaImagem } from "@/components/ui/imagem";
import { urlFigura, urlFotos } from "@/lib/dados";
import {
  altDaExecucao,
  MEDIDA_DA_FIGURA,
  medidaDaFoto,
  proporcaoDaFoto,
  urlWebp,
} from "@/lib/midia";
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
      alt={altDaExecucao(exercicio.nome)}
      width={MEDIDA_DA_FIGURA.largura}
      height={MEDIDA_DA_FIGURA.altura}
      className={cn("bg-muted/40 h-44 w-full rounded-lg object-contain p-2", className)}
      onError={() => setQuebrou(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

/**
 * As duas fotos: início (-1) e fim (-2) do movimento (SPEC §7). A caixa tem a
 * proporção do próprio arquivo (3:2 ou, em 3 exercícios, 2:3) e a foto é
 * `object-contain` — o quadrado cortava justamente a barra, e nenhuma foto é
 * cortada — e cada foto leva a legenda visível (SPEC §22.13 item 2).
 */
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
    <ul className={cn("grid grid-cols-2 items-start gap-2", className)}>
      {fotos.map((foto, i) => {
        // a derivada WebP (SPEC §22.4 item 1) pesa 44 kB contra 70 do JPEG
        const fonte = fonteComReserva(foto, urlWebp(foto));
        // a medida é a do arquivo pedido (SPEC §22.4 item 3): a derivada,
        // quando ela existe; o JPEG do kit, no build sem `npm run assets`
        const medida = medidaDaFoto(fonte.src);
        return (
          <li key={foto} className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- fotos locais em /public, tamanho fixo */}
            <img
              src={fonte.src}
              data-reserva={fonte.reserva}
              data-foto-execucao
              onError={reservaDaImagem}
              alt={`${exercicio.nome} — ${i === 0 ? "início" : "fim"}`}
              width={medida?.largura}
              height={medida?.altura}
              style={{ aspectRatio: proporcaoDaFoto(fonte.src) }}
              className="bg-muted/40 h-auto w-full rounded-lg object-contain"
              loading="lazy"
              decoding="async"
            />
            <span className="text-muted-foreground text-xs" data-legenda-foto>
              {i === 0 ? "Início" : "Fim"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
