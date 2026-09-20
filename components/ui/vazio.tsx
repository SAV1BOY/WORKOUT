import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A saída oferecida pelo estado vazio: um link ou um botão. */
export type AcaoDoVazio =
  | { rotulo: string; href: string; aoTocar?: never }
  | { rotulo: string; href?: never; aoTocar: () => void };

/**
 * O estado vazio do projeto (SPEC §22.3 item 9). Dez telas chegam a não ter
 * nada para mostrar e oito delas resolviam com um `<p>` tracejado de uma linha
 * — "Nenhum exercício com esses filtros." — sem dizer o que fazer em seguida.
 *
 * Aqui o vazio tem ícone, título curto, uma frase e, quando existe saída
 * óbvia, a ação ("Limpar filtros", "Ver o catálogo"). Os textos são de
 * INTERFACE: nada de conteúdo de treino, que só sai dos JSON.
 */
export function Vazio({
  icone: Icone,
  titulo,
  frase,
  acao,
  className,
}: {
  icone: LucideIcon;
  titulo: string;
  frase?: React.ReactNode;
  acao?: AcaoDoVazio;
  className?: string;
}) {
  return (
    <div
      data-slot="vazio"
      className={cn(
        "border-border flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center",
        className,
      )}
    >
      <span className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full">
        <Icone aria-hidden="true" className="size-5" />
      </span>
      <p className="text-sm font-medium text-balance">{titulo}</p>
      {frase ? (
        <p className="text-muted-foreground text-xs text-balance">{frase}</p>
      ) : null}
      {acao ? (
        acao.href ? (
          <Button asChild variant="outline" className="alvo mt-1">
            <Link href={acao.href}>{acao.rotulo}</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="alvo mt-1"
            onClick={acao.aoTocar}
          >
            {acao.rotulo}
          </Button>
        )
      ) : null}
    </div>
  );
}
