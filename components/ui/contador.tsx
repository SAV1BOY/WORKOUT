import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Número grande com rótulo (SPEC §13.1: "números grandes"). Usado nos
 * contadores da aba Treino e do Relatório.
 */
export function Contador({
  valor,
  rotulo,
  detalhe,
  icone,
  className,
}: {
  valor: ReactNode;
  rotulo: string;
  detalhe?: ReactNode;
  icone?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "cartao border-border bg-card flex flex-col gap-0.5 border px-3 py-2.5",
        className,
      )}
    >
      <span className="text-muted-foreground flex items-center gap-1 text-[11px] tracking-wide uppercase">
        {icone}
        {rotulo}
      </span>
      <span className="numero-grande text-2xl">{valor}</span>
      {detalhe ? (
        <span className="text-muted-foreground text-xs">{detalhe}</span>
      ) : null}
    </div>
  );
}
