"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatarData, paraData } from "@/lib/formato";
import { diaCurto } from "@/lib/hoje";
import type { TipoDia } from "@/lib/schemas";
import {
  NOME_DA_MARCA,
  type DiaDaGrade,
  type DiaDoMes,
  type MarcaDoDia,
} from "@/lib/semana";
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
              <span className="text-muted-foreground text-rotulo uppercase">
                {diaCurto(d.data)}
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

/**
 * O desenho de uma casa do mês (SPEC §22.8 item 6). O estado vem primeiro e
 * muda a FORMA — disco cheio, anel, ✕ —, não só o tom; o tipo do dia separa
 * força (círculo) de cardio (losango). É o mesmo componente na grade e na
 * legenda: nenhuma das duas pode passar a mentir sobre a outra.
 */
function GlifoDoMes({ marca, tipo }: { marca: MarcaDoDia; tipo: TipoDia }) {
  const miolo =
    marca === "feito" ? (
      <span className="bg-primary size-2.5 rounded-full" />
    ) : marca === "parcial" ? (
      <span className="border-primary size-2.5 rounded-full border-2" />
    ) : marca === "faltou" ? (
      <span className="text-destructive text-micro leading-none font-semibold">✕</span>
    ) : marca === "descanso" ? null : tipo === "cardio" ? (
      <span className="border-foreground/60 size-2 rotate-45 border" />
    ) : (
      <span className="border-primary/70 size-2.5 rounded-full border" />
    );
  return (
    <span aria-hidden className="flex h-2.5 items-center justify-center">
      {miolo}
    </span>
  );
}

/** A legenda de uma linha sob a grade, desenhada com os mesmos glifos. */
const LEGENDA_DO_MES: { marca: MarcaDoDia; tipo: TipoDia; texto: string }[] = [
  { marca: "feito", tipo: "forca", texto: "feito" },
  { marca: "parcial", tipo: "forca", texto: "parcial" },
  { marca: "aberto", tipo: "forca", texto: "força a fazer" },
  { marca: "aberto", tipo: "cardio", texto: "cardio a fazer" },
  { marca: "faltou", tipo: "forca", texto: "perdido" },
];

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
                  aria-label={`${formatarData(d.data)}: ${NOME_DA_MARCA[d.marca]}${
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
                  <GlifoDoMes marca={d.marca} tipo={d.tipo} />
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <ul className="text-muted-foreground text-micro flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {LEGENDA_DO_MES.map((l) => (
          <li key={l.texto} className="flex items-center gap-1">
            <GlifoDoMes marca={l.marca} tipo={l.tipo} />
            {l.texto}
          </li>
        ))}
      </ul>
    </section>
  );
}
