"use client";

import { formatarData, paraData } from "@/lib/formato";
import { diaCurto } from "@/lib/hoje";
import { NOME_DA_MARCA, type DiaDaGrade, type DiaDoMes } from "@/lib/semana";
import { cn } from "@/lib/utils";

const CORES_DA_MARCA: Record<string, string> = {
  feito: "text-primary",
  parcial: "text-muted-foreground",
  faltou: "text-destructive",
  aberto: "text-muted-foreground",
  descanso: "text-muted-foreground",
};

/** A semana de segunda a domingo, um dia por linha (SPEC §3.5). */
export function GradeDaSemana({
  dias,
  aoTocar,
}: {
  dias: DiaDaGrade[];
  aoTocar: (dia: DiaDaGrade) => void;
}) {
  return (
    <ul aria-label="Semana" className="flex flex-col gap-1.5">
      {dias.map((d) => (
        <li key={d.data}>
          <button
            type="button"
            onClick={() => aoTocar(d)}
            aria-label={`${diaCurto(d.data)} ${formatarData(d.data)}: ${d.rotulo}, ${NOME_DA_MARCA[d.marca]}`}
            className={cn(
              "alvo border-border bg-card flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left",
              d.ehHoje && "border-primary",
              d.dia.tipo === "descanso" && "opacity-70",
            )}
          >
            <span className="flex w-11 shrink-0 flex-col items-center">
              <span className="text-muted-foreground text-[11px] uppercase">
                {diaCurto(d.data)}
              </span>
              <span className="numero text-base">{paraData(d.data).getDate()}</span>
            </span>

            <span className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-2 text-sm font-medium">{d.rotulo}</span>
              {d.detalhe ? (
                <span className="text-muted-foreground line-clamp-2 text-xs">
                  {d.detalhe}
                </span>
              ) : null}
            </span>

            <span
              aria-hidden
              className={cn(
                "numero w-5 shrink-0 text-center text-lg",
                CORES_DA_MARCA[d.marca],
              )}
            >
              {d.simbolo}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const CORES_DO_TIPO: Record<string, string> = {
  forca: "bg-primary/80",
  cardio: "bg-foreground/40",
  descanso: "bg-transparent",
};

/** O mês em miniatura, com marcação nos dias que têm algo (SPEC §3.5). */
export function MesEmMiniatura({
  semanas,
  titulo,
}: {
  semanas: DiaDoMes[][];
  titulo: string;
}) {
  return (
    <section aria-label={`Mês de ${titulo}`} className="flex flex-col gap-2">
      <h2 className="text-muted-foreground text-xs tracking-wide uppercase">
        {titulo}
      </h2>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => (
          <span key={d} className="text-muted-foreground text-[10px] uppercase">
            {d}
          </span>
        ))}
        {semanas.flat().map((d) => (
          <span
            key={d.data}
            title={d.data}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded py-1 text-[11px]",
              d.doMes ? "" : "opacity-30",
              d.ehHoje && "bg-primary/15 font-semibold",
            )}
          >
            <span className="numero">{d.numero}</span>
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                d.marca === "feito"
                  ? "bg-primary"
                  : d.marca === "faltou"
                    ? "bg-destructive/60"
                    : CORES_DO_TIPO[d.tipo],
              )}
            />
          </span>
        ))}
      </div>
    </section>
  );
}
