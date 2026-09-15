"use client";

import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { acharExercicio } from "@/lib/dados";
import { formatarKg, formatarNumero, rotuloDaCarga } from "@/lib/formato";
import type { Montagem, OpcoesMontagem } from "@/lib/montagem";
import { montagemDaCarga } from "@/lib/sessao";

/** Onde as anilhas entram, com o nome que a §6.5 usa na tela. */
const ONDE: Record<string, string> = {
  porLado: "por lado",
  porPonta: "por ponta (cada halter)",
  noPino: "no pino",
  naMochila: "na mochila",
  naAnilha: "na mão",
  nenhum: "sem anilhas",
};

/** As anilhas como chips "10 · 5 · 2" (SPEC §6.5). */
export function Chips({ montagem }: { montagem: Montagem }) {
  if (montagem.anilhas.length === 0) {
    return <p className="text-muted-foreground text-sm">Sem anilhas: só o implemento.</p>;
  }
  return (
    <ul
      aria-label={`Anilhas ${ONDE[montagem.onde] ?? ""}`}
      className="flex flex-wrap items-center gap-1.5"
    >
      {montagem.anilhas.map((kg, i) => (
        <li
          key={`${kg}-${i}`}
          className="border-primary/40 bg-primary/10 numero rounded-md border px-2.5 py-1 text-sm"
        >
          {formatarNumero(kg)}
        </li>
      ))}
    </ul>
  );
}

/** O conteúdo da montagem, sem a folha — reaproveitado no resumo e na ficha. */
export function DetalheMontagem({
  exercicioId,
  carga,
  opcoes,
}: {
  exercicioId: string;
  carga: number | null;
  opcoes?: OpcoesMontagem;
}) {
  const exercicio = acharExercicio(exercicioId);
  const m = montagemDaCarga(exercicioId, carga, opcoes);
  if (!m) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="numero text-2xl">
          {formatarKg(m.total)} {rotuloDaCarga(exercicio.implemento)}
        </span>
        {m.pesoBarra > 0 ? (
          <span className="text-muted-foreground text-xs">
            barra {formatarKg(m.pesoBarra)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs uppercase">
          {ONDE[m.onde] ?? ""}
        </span>
        <Chips montagem={m} />
      </div>

      {!m.exato ? (
        <p role="note" className="border-border rounded-lg border border-dashed p-2 text-xs">
          {formatarKg(m.pedido)} não fecha com estas anilhas. A mais próxima para
          baixo é <span className="numero">{formatarKg(m.total)}</span> (
          {formatarNumero(m.diferenca ?? 0)} kg).
        </p>
      ) : null}

      {m.aviso ? (
        <p role="note" className="border-primary/40 bg-primary/5 rounded-lg border p-2 text-xs">
          {m.aviso}: é o teto do estoque de anilhas.
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs">{exercicio.montagem}</p>
    </div>
  );
}

/** O botão "montagem" do cabeçalho do bloco (SPEC §3.2 e §6.5). */
export function BotaoMontagem({
  exercicioId,
  carga,
  opcoes,
}: {
  exercicioId: string;
  carga: number | null;
  opcoes?: OpcoesMontagem;
}) {
  const m = montagemDaCarga(exercicioId, carga, opcoes);
  if (!m || m.onde === "nenhum" || carga === null || carga === 0) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="alvo h-11 gap-1.5 px-3">
          <Layers className="size-4" />
          montagem
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-8">
        <SheetHeader className="pb-0">
          <SheetTitle>Montagem</SheetTitle>
          <SheetDescription>{acharExercicio(exercicioId).nome}</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <DetalheMontagem exercicioId={exercicioId} carga={carga} opcoes={opcoes} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
