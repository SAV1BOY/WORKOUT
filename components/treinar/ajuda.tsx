"use client";

import { CircleHelp } from "lucide-react";
import Link from "next/link";
import { FiguraExercicio, FotosExercicio } from "@/components/exercicio/midia";
import { MapaMuscular } from "@/components/mapa-muscular";
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

/**
 * A ficha do exercício durante o treino (SPEC §3.2 e §7): figura animada, as
 * duas fotos, a montagem, os passos, o erro comum e o mapa muscular.
 * Todo o texto vem de `data/exercicios.json`.
 */
export function AjudaExercicio({ exercicioId }: { exercicioId: string }) {
  const exercicio = acharExercicio(exercicioId);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="alvo size-11 shrink-0"
          aria-label={`Como fazer: ${exercicio.nome}`}
        >
          <CircleHelp className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto pb-8">
        <SheetHeader className="pb-0">
          <SheetTitle className="text-balance">{exercicio.nome}</SheetTitle>
          <SheetDescription>
            {exercicio.grupo} · {exercicio.equipamento_texto}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <FiguraExercicio exercicio={exercicio} />
          <FotosExercicio exercicio={exercicio} />

          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">Montagem</h3>
            <p className="text-muted-foreground text-sm">{exercicio.montagem}</p>
          </section>

          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">Passos</h3>
            <ol className="text-muted-foreground flex list-decimal flex-col gap-1 pl-5 text-sm">
              {exercicio.passos.map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
          </section>

          <section className="border-destructive/40 bg-destructive/5 flex flex-col gap-1 rounded-lg border p-3">
            <h3 className="text-sm font-semibold">Erro comum</h3>
            <p className="text-sm">{exercicio.erro_comum}</p>
          </section>

          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">Músculos</h3>
            <div className="flex items-center gap-3">
              <MapaMuscular
                primarios={exercicio.musculos_primarios}
                secundarios={exercicio.musculos_secundarios}
              />
              <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                <li>
                  <span className="text-foreground font-medium">Principais:</span>{" "}
                  {exercicio.musculos_primarios_nome.join(", ") || "—"}
                </li>
                <li>
                  <span className="text-foreground font-medium">Ajudam:</span>{" "}
                  {exercicio.musculos_secundarios_nome.join(", ") || "—"}
                </li>
              </ul>
            </div>
          </section>

          <section className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">Como progredir</h3>
            <p className="text-muted-foreground text-sm">{exercicio.progressao.regra}</p>
          </section>

          <Link
            href={`/exercicios/${exercicio.id}`}
            className="alvo border-border hover:bg-accent flex items-center justify-center rounded-lg border py-3 text-sm font-medium"
          >
            Abrir a ficha completa
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
