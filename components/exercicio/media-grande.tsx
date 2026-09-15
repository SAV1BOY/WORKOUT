"use client";

import { useState } from "react";
import { capaDoExercicio, miniaturaDoExercicio } from "@/lib/capas";
import { acharExercicio } from "@/lib/dados";
import { urlDoVideo } from "@/lib/videos.cliente";
import { cn } from "@/lib/utils";

/**
 * A demonstração grande do exercício (SPEC §13.1 e §13.3): o vídeo opcional
 * quando `public/videos/<id>.mp4` existe, senão a figura animada, senão a foto
 * de início. A lista de vídeos é decidida no servidor — o cliente nunca sai
 * atrás de um arquivo que não existe.
 */
export function MediaGrande({
  exercicioId,
  temVideo = false,
  className,
}: {
  exercicioId: string;
  temVideo?: boolean;
  className?: string;
}) {
  const exercicio = acharExercicio(exercicioId);
  const { figura } = miniaturaDoExercicio(exercicioId);
  const foto = capaDoExercicio(exercicio);
  const [figuraQuebrou, setFiguraQuebrou] = useState(false);

  const caixa = cn(
    "bg-muted/40 h-40 w-full rounded-xl object-contain",
    className,
  );

  /*
   * Quem decide se há vídeo é o servidor, lendo `public/videos` (SPEC §13.1):
   * aqui não há fallback por erro — um arquivo estragado é para aparecer
   * estragado, não para sumir em silêncio.
   */
  if (temVideo) {
    return (
      <video
        src={urlDoVideo(exercicioId)}
        muted
        loop
        playsInline
        autoPlay
        aria-label={`Execução do ${exercicio.nome}`}
        data-video={exercicioId}
        className={caixa}
      />
    );
  }

  if (figura && !figuraQuebrou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- SVG animado de /public: o next/image rasteriza e mata a animação
      <img
        src={figura}
        alt={`Execução do ${exercicio.nome}`}
        loading="lazy"
        className={cn(caixa, "p-2")}
        onError={() => setFiguraQuebrou(true)}
      />
    );
  }

  if (foto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto local em /public
      <img
        src={foto}
        alt={`${exercicio.nome} — início`}
        loading="lazy"
        className={cn(caixa, "object-cover")}
      />
    );
  }

  return null;
}
