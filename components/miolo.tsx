"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** `/treinar/<id>`: o player é tela cheia (SPEC §14.1). */
export function ehPlayer(caminho: string): boolean {
  return caminho.startsWith("/treinar/") && caminho.length > "/treinar/".length;
}

/**
 * O miolo do shell autenticado. A folga de baixo existe por causa da barra de
 * 5 abas — no player, que a esconde, ela só rouba o orçamento vertical do
 * passo do exercício (a 360 × 740 o passo não cabia de uma vez).
 */
export function Miolo({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  return (
    <main
      className={cn(
        "pt-segura mx-auto w-full max-w-lg px-4 pt-4",
        ehPlayer(caminho) ? "pb-0" : "pb-24",
      )}
    >
      {children}
    </main>
  );
}
