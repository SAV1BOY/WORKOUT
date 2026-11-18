"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatarData, formatarDiaCurto, formatarDiaLongo, paraData } from "@/lib/formato";
import { MarcaDoDiaVisual } from "@/components/ui/faixa-semana";
import {
  NOME_DA_MARCA,
  type DiaDaGrade,
  type DiaDoMes,
  type MarcaVisivel,
} from "@/lib/semana";
import { cn } from "@/lib/utils";

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
            aria-current={d.ehHoje ? "date" : undefined}
            aria-label={`${formatarDiaLongo(d.data)} ${formatarData(d.data)}: ${d.rotulo}, ${NOME_DA_MARCA[d.marca]}${d.ehHoje ? ", hoje" : ""}`}
            /*
              SPEC §22.3 item 11: o rótulo longo e o detalhe são cortados pelo
              `line-clamp`. O nome acessível segue curto — é o que o leitor de
              tela anuncia a cada seta —, e o texto INTEIRO fica no `title` do
              próprio botão, que é o elemento clicável.
            */
            title={[d.rotuloLongo, d.detalhe].filter(Boolean).join(" · ")}
            className={cn(
              "alvo border-border bg-card flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left",
              d.ehHoje && "border-primary",
              d.dia.tipo === "descanso" && "opacity-70",
            )}
          >
            <span className="flex w-11 shrink-0 flex-col items-center">
              <span className="text-muted-foreground text-rotulo">
                {formatarDiaCurto(d.data)}
              </span>
              <span className="numero text-base">{paraData(d.data).getDate()}</span>
            </span>

            {/*
              SPEC §22.8 item 10: uma linha para o rótulo, uma para o detalhe,
              e uma altura mínima que vale também para o dia de descanso (que
              não tem detalhe nenhum) — os sete cartões ficam do mesmo
              tamanho. O texto inteiro continua no `title` e no `DialogoDia`.
            */}
            <span className="flex min-h-9 min-w-0 flex-1 flex-col justify-center">
              {/* SPEC §16.4: "Treino A · semana 3", "Corrida · semana 3 do plano" */}
              <span className="line-clamp-1 text-sm font-medium">{d.rotuloLongo}</span>
              {d.detalhe ? (
                <span className="text-muted-foreground line-clamp-1 text-xs">
                  {d.detalhe}
                </span>
              ) : null}
            </span>

            <span aria-hidden className="shrink-0">
              <MarcaDoDiaVisual marca={d.marca} ehHoje={d.ehHoje} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Cada marca do dia tem uma legenda. Para a fazer, F e C identificam o treino. */
const LEGENDA_DO_MES = {
  feito: [NOME_DA_MARCA.feito],
  parcial: [NOME_DA_MARCA.parcial],
  aberto: ["força a fazer", "cardio a fazer"],
  faltou: [NOME_DA_MARCA.faltou],
  descanso: [NOME_DA_MARCA.descanso],
} satisfies Record<MarcaVisivel, string[]>;

const DIAS_DA_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

/**
 * O mês em miniatura (SPEC §3.5). Desde a §22.8 item 2 ele é navegável de
 * verdade: ‹ › ao lado do título e cada dia é um botão que abre o mesmo
 * `DialogoDia` do cartão da semana.
 */
export function MesEmMiniatura({
  semanas,
  titulo,
  aoTocarDia,
  aoVoltar,
  aoAvancar,
  focoEm,
}: {
  semanas: DiaDoMes[][];
  titulo: string;
  aoTocarDia: (dia: DiaDoMes) => void;
  aoVoltar: () => void;
  aoAvancar: () => void;
  /** A data da semana que a grade de cima mostra — a linha ganha realce. */
  focoEm?: string;
}) {
  return (
    <section aria-label={`Mês de ${titulo}`} className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {/* SPEC §22.8 item 10: o mês é um título de seção, não um rótulo */}
        <h2 className="min-w-0 flex-1 text-base font-semibold break-words first-letter:uppercase">
          {titulo}
        </h2>
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Mês anterior"
          className="alvo text-muted-foreground hover:text-foreground flex items-center justify-center rounded-lg"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={aoAvancar}
          aria-label="Próximo mês"
          className="alvo text-muted-foreground hover:text-foreground flex items-center justify-center rounded-lg"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="flex flex-col gap-px">
        <div className="grid grid-cols-7 gap-px text-center">
          {DIAS_DA_SEMANA.map((d) => (
            <span key={d} className="text-muted-foreground text-micro uppercase">
              {d}
            </span>
          ))}
        </div>

        {semanas.map((semana) => {
          const daSemanaMostrada =
            focoEm !== undefined && semana.some((d) => d.data === focoEm);
          return (
            <div
              key={semana[0]?.data ?? ""}
              className={cn(
                "grid grid-cols-7 gap-px rounded-md",
                daSemanaMostrada && "bg-primary/5 ring-primary/30 ring-1",
              )}
            >
              {semana.map((d) => (
                <button
                  key={d.data}
                  type="button"
                  onClick={() => aoTocarDia(d)}
                  /*
                    SPEC §22.8 item 5: "hoje" deixa de existir só como cor —
                    `aria-current` e a palavra no nome acessível (um `sr-only`
                    entraria no `getByText` da página como texto, §22.3
                    item 11).
                  */
                  aria-current={d.ehHoje ? "date" : undefined}
                  aria-label={`${formatarData(d.data)}: ${NOME_DA_MARCA[d.marca]}${d.marca === "aberto" ? `, ${d.tipo === "forca" ? "força" : "cardio"}` : ""}${
                    d.ehHoje ? ", hoje" : ""
                  }`}
                  className={cn(
                    "text-rotulo flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-md py-1",
                    !d.doMes && "opacity-40",
                    d.ehHoje && "bg-primary/15 font-semibold",
                  )}
                >
                  <span aria-hidden className="numero">
                    {d.numero}
                  </span>
                  <span aria-hidden className="flex h-4 items-center justify-center">
                    {d.marca !== "antes" && <MarcaDoDiaVisual marca={d.marca} ehHoje={d.ehHoje} />}
                    {d.marca === "aberto" && <small>{d.tipo === "forca" ? "F" : "C"}</small>}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <ul className="text-muted-foreground text-micro flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {(Object.keys(LEGENDA_DO_MES) as MarcaVisivel[]).flatMap((marca) =>
          LEGENDA_DO_MES[marca].map((texto) => (
            <li key={texto} className="flex items-center gap-1 whitespace-nowrap">
              <span aria-hidden className="flex items-center">
                <MarcaDoDiaVisual marca={marca} />
                {marca === "aberto" && <small>{texto.startsWith("força") ? "F" : "C"}</small>}
              </span>
              {texto}
            </li>
          )),
        )}
      </ul>
    </section>
  );
}
