import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

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
      {/*
        SPEC §22.3 item 12: o "voltar" era um link de texto de 14 px sem área
        de botão. Agora é o mesmo botão do topo do player — ícone de 44 px,
        rótulo ao lado e o anel de foco do projeto.
      */}
      <Button
        asChild
        variant="ghost"
        className="alvo text-muted-foreground hover:text-foreground -ml-2 w-fit gap-1 px-2"
      >
        <Link href="/mais">
          <ChevronLeft aria-hidden="true" className="size-5" />
          Mais
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      {descricao ? (
        <p className="text-muted-foreground text-sm text-balance">{descricao}</p>
      ) : null}
    </header>
  );
}
