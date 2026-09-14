"use client";

import { ChartLine, Dumbbell, Ellipsis, House, PersonStanding } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

interface Item {
  href: string;
  rotulo: string;
  Icone: ComponentType<{ className?: string }>;
  /** rotas que acendem este item */
  prefixos: string[];
}

const ITENS: Item[] = [
  { href: "/", rotulo: "Hoje", Icone: House, prefixos: ["/", "/calendario"] },
  {
    href: "/treinar",
    rotulo: "Treinar",
    Icone: Dumbbell,
    prefixos: ["/treinar", "/cardio", "/barra-fixa"],
  },
  {
    href: "/progresso",
    rotulo: "Progresso",
    Icone: ChartLine,
    prefixos: ["/progresso", "/exercicios"],
  },
  {
    href: "/corpo",
    rotulo: "Corpo",
    Icone: PersonStanding,
    prefixos: ["/corpo"],
  },
  { href: "/mais", rotulo: "Mais", Icone: Ellipsis, prefixos: ["/mais"] },
];

function ativo(caminho: string, prefixos: string[]): boolean {
  return prefixos.some((p) =>
    p === "/" ? caminho === "/" : caminho === p || caminho.startsWith(`${p}/`),
  );
}

export function NavInferior() {
  const caminho = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-background/95 border-border pb-segura fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITENS.map(({ href, rotulo, Icone, prefixos }) => {
          const aceso = ativo(caminho, prefixos);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={aceso ? "page" : undefined}
                className={cn(
                  "alvo flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium",
                  aceso
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icone className="size-6" />
                {rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
