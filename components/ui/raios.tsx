import { Zap } from "lucide-react";
import { NOME_DA_DIFICULDADE, type Raios as NivelDeRaios } from "@/lib/dificuldade";
import { cn } from "@/lib/utils";

/**
 * Dificuldade em raios (SPEC §13.4). O nível vem sempre de
 * `dificuldadeDe(exercicio)` — a tela não escolhe nada.
 */
export function Raios({
  nivel,
  className,
  tamanho = "md",
}: {
  nivel: NivelDeRaios;
  className?: string;
  tamanho?: "sm" | "md";
}) {
  const lado = tamanho === "sm" ? "size-3" : "size-3.5";
  return (
    <span
      className={cn("inline-flex items-center gap-px", className)}
      /*
        SPEC §22.3 item 11: o `title` era tooltip — no celular ninguém passa o
        mouse. Quem precisa do nome do nível tem o `role="img"` com o nome
        acessível; quem enxerga conta os raios acesos.
      */
      role="img"
      aria-label={`Dificuldade: ${NOME_DA_DIFICULDADE[nivel]} (${nivel} de 3)`}
      data-raios={nivel}
    >
      {[1, 2, 3].map((i) => (
        <Zap
          key={i}
          aria-hidden="true"
          className={cn(
            lado,
            i <= nivel ? "fill-current opacity-100" : "opacity-25",
          )}
        />
      ))}
    </span>
  );
}
