"use client";

import {
  CalendarCheck,
  ChevronsUp,
  Dumbbell,
  Flame,
  Footprints,
  Layers,
  Route,
  Timer,
  Trophy,
  Weight,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  TOTAL_DE_CONQUISTAS,
  totalConquistado,
  type ConquistaAvaliada,
  type IconeDaConquista,
} from "@/lib/conquistas";
import { formatarData, formatarDataCompleta, formatarNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";

/** O ícone lucide de cada conquista (a lib guarda só o nome, SPEC §19.3). */
const ICONE: Record<IconeDaConquista, LucideIcon> = {
  CalendarCheck,
  ChevronsUp,
  Dumbbell,
  Flame,
  Footprints,
  Layers,
  Route,
  Timer,
  Trophy,
  Weight,
  Zap,
};

export function IconeDaCelula({
  nome,
  className,
}: {
  nome: IconeDaConquista;
  className?: string;
}) {
  const Icone = ICONE[nome];
  return <Icone aria-hidden="true" className={className} />;
}

/**
 * "Conquistas" (SPEC §19.4): grade de 3 colunas a 360 px, desbloqueadas com a
 * data e bloqueadas com o que falta; o toque abre a folha com a regra.
 */
export function Conquistas({ lista }: { lista: ConquistaAvaliada[] }) {
  const [aberta, setAberta] = useState<ConquistaAvaliada | null>(null);
  const feitas = totalConquistado(lista);

  return (
    <section aria-label="Conquistas" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Conquistas</h2>
        <p className="numero text-muted-foreground text-xs">
          {formatarNumero(feitas)} de {formatarNumero(TOTAL_DE_CONQUISTAS)}
        </p>
      </div>

      <ul aria-label="Lista de conquistas" className="grid grid-cols-3 gap-2">
        {lista.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              data-conquista={c.id}
              data-atingida={c.atingida ? "sim" : "nao"}
              aria-pressed={c.atingida}
              onClick={() => setAberta(c)}
              className={cn(
                "cartao alvo flex h-full w-full flex-col items-center gap-1 border px-1.5 py-2 text-center",
                c.atingida
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  c.atingida
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <IconeDaCelula nome={c.icone} className="size-4" />
              </span>
              <span
                className={cn(
                  "text-[11px] leading-tight font-medium text-balance",
                  c.atingida ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {c.nome}
              </span>
              <span
                className={cn(
                  "text-[10px] leading-tight text-balance",
                  c.atingida ? "numero text-primary" : "text-muted-foreground",
                )}
              >
                {c.atingida && c.em ? formatarData(c.em) : c.falta}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={aberta !== null} onOpenChange={(v) => !v && setAberta(null)}>
        <SheetContent side="bottom" className="max-h-[80svh] overflow-y-auto pb-6">
          {aberta ? <Detalhe conquista={aberta} /> : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Detalhe({ conquista: c }: { conquista: ConquistaAvaliada }) {
  return (
    <>
      <SheetHeader className="pb-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              c.atingida
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            <IconeDaCelula nome={c.icone} className="size-5" />
          </span>
          <SheetTitle>{c.nome}</SheetTitle>
        </div>
        <SheetDescription className="pt-1">{c.descricao}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-2 px-4">
        <p className="border-border text-muted-foreground rounded-xl border border-dashed px-3 py-2 text-xs">
          <span className="text-foreground font-medium">Como fecha:</span> {c.regra}
        </p>
        {c.atingida && c.em ? (
          <p className="numero text-primary text-sm">
            Conquistada em {formatarDataCompleta(c.em)}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            <span className="numero text-foreground">
              {formatarNumero(c.atual)} de {formatarNumero(c.alvo)}
            </span>
            {c.falta ? ` · ${c.falta}` : ""}
          </p>
        )}
      </div>
    </>
  );
}
