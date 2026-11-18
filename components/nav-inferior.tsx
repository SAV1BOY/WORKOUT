"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ICONE_DA_ABA } from "@/components/icones-das-abas";
import { ehPlayer } from "@/components/miolo";
import { useFilaPendente } from "@/lib/usar-fila";
import { ABAS } from "@/lib/abas";
import { cn } from "@/lib/utils";

function ativo(caminho: string, prefixos: readonly string[]): boolean {
  return prefixos.some((p) =>
    p === "/" ? caminho === "/" : caminho === p || caminho.startsWith(`${p}/`),
  );
}

/** A barra de baixo (SPEC §13.2). A lista das abas vive em `lib/abas.ts`. */
export function NavInferior() {
  const caminho = usePathname();
  const aguardando = useFilaPendente();

  /*
   * SPEC §14.1: o player é tela cheia — a saída é pelo ícone de lista/voltar
   * dele. O Descanso já escondia a barra; agora todos os passos escondem.
   */
  if (ehPlayer(caminho)) return null;

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-background/95 border-border pb-segura fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg overflow-x-auto">
        {ABAS.map(({ href, rotulo, icone, prefixos }) => {
          const aceso = ativo(caminho, prefixos);
          const Icone = ICONE_DA_ABA[icone];
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={href === "/mais" && aguardando ? `Mais, ${aguardando} esperando a rede` : rotulo}
                aria-current={aceso ? "page" : undefined}
                className={cn(
                  "alvo foco text-rotulo relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 -outline-offset-2",
                  aceso
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground font-medium",
                )}
              >
                {/*
                  SPEC §22.3 item 8: a aba acesa não pode ser só "o laranja".
                  Quem não distingue a cor enxerga a barra de 2 px no topo do
                  item e o rótulo em semibold; quem enxerga a cor vê os três.
                */}
                {aceso ? (
                  <span
                    aria-hidden="true"
                    data-aba-ativa="barra"
                    className="bg-primary absolute inset-x-3 top-0 h-0.5 rounded-b-full"
                  />
                ) : null}
                {href === "/mais" && aguardando > 0 && <span aria-hidden="true" data-fila-pendente className="bg-primary absolute left-[58%] top-1 size-2 rounded-full" />}
                <Icone className="size-6" />
                <span className="max-[280px]:sr-only">{rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
