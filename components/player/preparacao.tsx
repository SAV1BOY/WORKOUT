"use client";

import { CircleHelp, SkipForward } from "lucide-react";
import { AnelDeContagem } from "@/components/player/anel";
import { Button } from "@/components/ui/button";
import { acharExercicio } from "@/lib/dados";
import { nomeAcessivel } from "@/lib/midia";
import { fracaoRestante, restanteS, type EstadoPlayer } from "@/lib/player";

/**
 * "PREPARADO PARA COMEÇAR" (SPEC §14.1.1): o anel de contagem, o nome do
 * primeiro exercício com o "?" e o botão de pular.
 */
export function TelaPreparacao({
  exercicioId,
  estado,
  agora,
  aoAbrirFicha,
  aoPular,
}: {
  exercicioId: string;
  estado: EstadoPlayer;
  agora: number;
  aoAbrirFicha: () => void;
  aoPular: () => void;
}) {
  const exercicio = acharExercicio(exercicioId);
  const falta = restanteS(estado, agora);

  return (
    <section
      aria-label="Preparação"
      className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center"
    >
      <p className="text-muted-foreground text-sm font-semibold tracking-[0.2em] uppercase">
        Preparado para começar
      </p>

      <AnelDeContagem fracao={fracaoRestante(estado, agora)} tamanho={220}>
        <span
          role="timer"
          aria-label="Preparação"
          className="numero-grande text-6xl tabular-nums"
        >
          {falta}
        </span>
        <span className="text-muted-foreground text-xs">segundos</span>
      </AnelDeContagem>

      <div className="flex items-center justify-center gap-1">
        <h2 className="text-xl font-semibold text-balance">{exercicio.nome}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="alvo shrink-0"
          aria-label={nomeAcessivel("Como fazer", exercicio.nome)}
          onClick={aoAbrirFicha}
        >
          <CircleHelp className="size-5" />
        </Button>
      </div>

      <Button className="alvo h-14 w-full max-w-xs rounded-2xl text-base font-semibold" onClick={aoPular}>
        <SkipForward className="size-5" />
        Começar agora
      </Button>
    </section>
  );
}
