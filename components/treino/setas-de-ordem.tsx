import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SetasDeOrdem({ nome, indice, total, aoMover }: {
  nome: string;
  indice: number;
  total: number;
  aoMover: (direcao: -1 | 1, botao: HTMLButtonElement) => void;
}) {
  return (
    <>
      <Button type="button" variant="ghost" size="icon" className="alvo shrink-0"
        aria-label={`Subir ${nome}`} disabled={indice === 0} onClick={e => aoMover(-1, e.currentTarget)}>
        <ChevronUp className="size-5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="alvo shrink-0"
        aria-label={`Descer ${nome}`} disabled={indice === total - 1} onClick={e => aoMover(1, e.currentTarget)}>
        <ChevronDown className="size-5" />
      </Button>
    </>
  );
}
