import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Número grande com rótulo (SPEC §13.1: "números grandes"). Usado nos
 * contadores da aba Treino e do Relatório.
 *
 * O rótulo ocupa **uma linha só** (SPEC §22.2 item 1). A 360 px cada coluna de
 * uma faixa de três tem ~80 px de texto: "VOLUME (KG)" e "BARRA FIXA" quebravam
 * em duas linhas e desciam o número, deixando os três contadores com bases
 * diferentes. A linha do rótulo tem altura fixa e não quebra — quem não couber
 * é encurtado no fim, nunca empurra o número para baixo.
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
      data-contador={rotulo}
      className={cn(
        "cartao border-border bg-card flex flex-col gap-0.5 border px-2.5 py-2.5",
        className,
      )}
    >
      <span
        data-rotulo={rotulo}
        className="text-muted-foreground flex h-4 items-center gap-1 overflow-hidden text-micro tracking-wide whitespace-nowrap uppercase"
      >
        {icone ? <span className="flex shrink-0 items-center">{icone}</span> : null}
        <span className="min-w-0 truncate">{rotulo}</span>
      </span>
      <span className="numero-grande text-2xl leading-tight">{valor}</span>
      {detalhe ? (
        <span className="text-muted-foreground text-xs">{detalhe}</span>
      ) : null}
    </div>
  );
}
