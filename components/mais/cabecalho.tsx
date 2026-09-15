import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Cabeçalho das telas de dentro de `/mais`: voltar, título e uma linha. */
export function CabecalhoMais({
  titulo,
  descricao,
}: {
  titulo: string;
  descricao?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1">
      <Link
        href="/mais"
        className="alvo text-muted-foreground hover:text-foreground -ml-1 flex w-fit items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" />
        Mais
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      {descricao ? (
        <p className="text-muted-foreground text-sm text-balance">{descricao}</p>
      ) : null}
    </header>
  );
}
