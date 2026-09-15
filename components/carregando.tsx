import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
