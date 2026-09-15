import {
  ID_MAPA_ANATOMICO,
  PROPORCAO_MAPA_ANATOMICO,
  VIEWBOX_MAPA_ANATOMICO,
} from "@/lib/mapa-anatomico";
import type { Musculo } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * O mapa muscular anatômico (marco Mídia): frente e costas lado a lado, com os
 * músculos principais no laranja forte (`--mprim`) e os auxiliares no tom
 * claro (`--msec`). O desenho vem de `assets/mapa-muscular/mapa-anatomico.svg`
 * (geometria MuscleMap, MIT), inline no layout por `SpriteMuscular`.
 *
 * O destaque é só CSS: as classes `p-<musculo>`/`s-<musculo>` de
 * `app/globals.css` definem `--m-<musculo>`, que o próprio SVG lê no `fill`.
 */
export function MapaAnatomico({
  primarios,
  secundarios,
  className,
}: {
  primarios: Musculo[];
  secundarios: Musculo[];
  className?: string;
}) {
  const classes = [
    ...primarios.map((m) => `p-${m}`),
    ...secundarios.map((m) => `s-${m}`),
  ].join(" ");

  return (
    <svg
      viewBox={VIEWBOX_MAPA_ANATOMICO}
      data-mapa="anatomico"
      role="img"
      aria-label="Mapa muscular: frente e costas"
      style={{ aspectRatio: PROPORCAO_MAPA_ANATOMICO }}
      className={cn("h-auto w-full", classes, className)}
    >
      <use href={`#${ID_MAPA_ANATOMICO}`} />
    </svg>
  );
}
