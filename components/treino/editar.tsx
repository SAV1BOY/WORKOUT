"use client";

import { GripVertical } from "lucide-react";
import { SetasDeOrdem } from "@/components/treino/setas-de-ordem";
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

      <ol className="@container flex flex-col divide-y">
        {itens.map((item, i) => (
          <li key={item.originalId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-2 @2xs:flex">
            <GripVertical
              aria-hidden="true"
              className="text-muted-foreground hidden size-5 shrink-0 @2xs:block"
            />
            <Miniatura exercicioId={item.exercicioId} className="col-start-1 row-start-2 aspect-square h-auto w-full max-w-11 @2xs:size-11" />
            <span className="col-span-full row-start-1 flex min-w-0 flex-1 flex-col gap-0.5 wrap-anywhere">
              <span className="text-sm font-medium text-balance">
                {i + 1}. {item.nome}
              </span>
              <span className="numero text-muted-foreground text-xs">
                {item.alvoTexto}
              </span>
            </span>
            <SetasDeOrdem nome={item.nome} indice={i} total={itens.length}
              aoMover={direcao => aoMover(i, i + direcao)} />
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="alvo h-auto min-h-12 max-w-full grow py-2 whitespace-normal"
          disabled={ehAOrdemDoPrograma}
          onClick={aoVoltarAoPrograma}
        >
          Voltar à ordem do programa
        </Button>
        <Button className="alvo h-auto min-h-12 grow" onClick={aoFechar}>
          Pronto
        </Button>
      </div>
    </section>
  );
}
