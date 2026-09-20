import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Esqueletos por FORMA (SPEC §22.3 item 10). Havia um só — três barras dentro
 * de um retângulo — para telas que chegam muito diferentes: a aba Treino abre
 * com uma capa de 160 px, o Relatório com três contadores lado a lado e as
 * listas com miniatura + duas linhas. O esqueleto genérico anunciava a forma
 * errada e a tela pulava quando o dado chegava.
 */

/** Esqueleto de um card enquanto a leitura não chega (SPEC §3.1). */
export function EsqueletoCard({ linhas = 3 }: { linhas?: number }) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

/** A capa do dia: imagem alta, duas linhas de texto e o botão largo. */
export function EsqueletoCapa() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="border-border bg-card cartao flex flex-col gap-3 overflow-hidden border"
    >
      <Skeleton className="min-h-40 w-full rounded-none" />
      <div className="flex flex-col gap-2 px-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="px-4 pb-4">
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Os três contadores do Relatório (Semana · Mês · Tudo). */
export function EsqueletoGrade3() {
  return (
    <div role="status" aria-label="Carregando" className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="border-border bg-card cartao flex flex-col items-center gap-2 border px-2 py-4"
        >
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Uma lista de linhas com miniatura à esquerda. */
export function EsqueletoLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <ul role="status" aria-label="Carregando" className="flex flex-col gap-2">
      {Array.from({ length: linhas }).map((_, i) => (
        <li
          key={i}
          className="border-border bg-card cartao flex items-center gap-3 border p-3"
        >
          <Skeleton className="size-12 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Erro de leitura, sempre em pt-BR e com saída (SPEC §3.1). */
export function Erro({
  mensagem,
  aoTentarDeNovo,
}: {
  mensagem: string;
  aoTentarDeNovo?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-xl border p-4"
    >
      <p className="flex items-start gap-2 text-sm">
        <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
        <span>{mensagem}</span>
      </p>
      {aoTentarDeNovo ? (
        <Button variant="outline" className="alvo" onClick={aoTentarDeNovo}>
          Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}
