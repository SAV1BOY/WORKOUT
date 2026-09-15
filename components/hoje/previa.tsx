"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { ItemPrevia } from "@/lib/hoje";

/**
 * Prévia dos exercícios do dia (SPEC §3.1): o que o motor vai pedir hoje em
 * cada um, com o rótulo certo do implemento (§4) e a explicação da carga (§6.6).
 */
export function Previa({
  itens,
  carregando = false,
}: {
  itens: ItemPrevia[];
  carregando?: boolean;
}) {
  if (carregando) {
    return (
      <ul className="flex flex-col gap-3" role="status" aria-label="Carregando a prévia">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul aria-label="Exercícios de hoje" className="flex flex-col divide-y">
      {itens.map((item) => (
        <li key={item.exercicioId} className="flex flex-col gap-0.5 py-2.5 first:pt-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-balance">
              {item.ordem}. {item.nome}
            </span>
            <span className="numero text-muted-foreground shrink-0 text-sm">
              {item.alvoTexto}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            <span className="text-foreground numero">Hoje: {item.cargaTexto}</span>
            {item.historico ? ` (${item.historico})` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
