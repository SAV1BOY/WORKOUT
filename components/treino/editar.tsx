"use client";

import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Miniatura } from "@/components/ui/miniatura";
import type { ItemPrevia } from "@/lib/hoje";

/**
 * "Editar" (SPEC §14.3): o modo reordenar do treino do dia. Alça ⣿ e setas
 * ↑↓ — o alvo de toque é a seta, que funciona com uma mão e sem arrastar.
 *
 * A ordem vale **só para a sessão que vai começar**: o programa não muda, e
 * "Voltar à ordem do programa" desfaz tudo de uma vez.
 */
export function ModoEditar({
  itens,
  aoMover,
  aoVoltarAoPrograma,
  aoFechar,
  ehAOrdemDoPrograma,
}: {
  itens: ItemPrevia[];
  aoMover: (de: number, para: number) => void;
  aoVoltarAoPrograma: () => void;
  aoFechar: () => void;
  ehAOrdemDoPrograma: boolean;
}) {
  return (
    <section aria-label="Reordenar os exercícios" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Reordenar</h2>
        <p className="text-muted-foreground text-xs">Só para o treino de hoje</p>
      </div>

      <ol className="flex flex-col divide-y">
        {itens.map((item, i) => (
          <li key={item.originalId} className="flex items-center gap-2 py-2">
            <GripVertical
              aria-hidden="true"
              className="text-muted-foreground size-5 shrink-0"
            />
            <Miniatura exercicioId={item.exercicioId} decorativa className="size-11" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium text-balance">
                {i + 1}. {item.nome}
              </span>
              <span className="numero text-muted-foreground text-xs">
                {item.alvoTexto}
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Subir ${item.nome}`}
              disabled={i === 0}
              onClick={() => aoMover(i, i - 1)}
              className="alvo size-11 shrink-0"
            >
              <ChevronUp className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Descer ${item.nome}`}
              disabled={i === itens.length - 1}
              onClick={() => aoMover(i, i + 1)}
              className="alvo size-11 shrink-0"
            >
              <ChevronDown className="size-5" />
            </Button>
          </li>
        ))}
      </ol>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="alvo h-12 flex-1"
          disabled={ehAOrdemDoPrograma}
          onClick={aoVoltarAoPrograma}
        >
          Voltar à ordem do programa
        </Button>
        <Button className="alvo h-12 flex-1" onClick={aoFechar}>
          Pronto
        </Button>
      </div>
    </section>
  );
}
