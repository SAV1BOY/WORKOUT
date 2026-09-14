import type { ReactNode } from "react";

/** Página ainda não implementada: título, uma linha e o marco que a traz. */
export function EmConstrucao({
  titulo,
  descricao,
  marco,
  children,
}: {
  titulo: string;
  descricao: string;
  marco: number;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground text-sm text-balance">{descricao}</p>
      </header>
      <p className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-sm">
        em construção — marco {marco}
      </p>
      {children}
    </section>
  );
}
