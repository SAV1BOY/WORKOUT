"use client";

import type { SyntheticEvent } from "react";

/**
 * A troca de dois degraus das imagens de `public/` (SPEC §22.4 item 1): a tela
 * pede a **derivada** que `npm run assets` gerou e, se ela faltar (um build
 * sem o prebuild), o `data-reserva` devolve o arquivo original do kit. A troca
 * acontece no DOM, sem estado por imagem — o que importa numa lista de dezenas
 * de fotos.
 */

export interface FonteDaImagem {
  /** O arquivo que a tela pede primeiro. */
  src: string;
  /**
   * O original, que o `onError` põe no lugar. Fica `undefined` quando não há
   * derivada para aquele caminho: sem isso o degrau se repetia, e a imagem
   * pedia de novo o mesmo arquivo que acabara de falhar (auditoria do lote 4).
   */
  reserva: string | undefined;
}

export function fonteComReserva(
  original: string,
  derivada: string | null,
): FonteDaImagem {
  return derivada && derivada !== original
    ? { src: derivada, reserva: original }
    : { src: original, reserva: undefined };
}

/** O `onError` das imagens montadas por `fonteComReserva`. */
export function reservaDaImagem(evento: SyntheticEvent<HTMLImageElement>) {
  const img = evento.currentTarget;
  const reserva = img.dataset.reserva;
  if (!reserva) return;
  // sem apagar a reserva, uma reserva também quebrada entraria em laço
  delete img.dataset.reserva;
  img.src = reserva;
}
