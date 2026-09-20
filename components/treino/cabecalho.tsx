"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FaixaSemana } from "@/components/ui/faixa-semana";
import { formatarData, formatarKg } from "@/lib/formato";
import type { StatusDoPeso } from "@/lib/hoje";
import type { ProgressoDaMeta } from "@/lib/metas";
import type { DiaDaFaixa } from "@/lib/semana";

/**
 * O cabeçalho da aba Treino (SPEC §13.3): a saudação com o dia, a sequência de
 * semanas com a meta cumprida, a faixa da semana e a meta semanal. A fase e o
 * peso (§3.1) continuam logo abaixo, em duas caixas.
 */
export function CabecalhoDoTreino({
  saudacao,
  sequenciaDeSemanas,
  dias,
  meta,
  fase,
  semanaDaFase,
  peso,
}: {
  /** "Terça, 15/09" */
  saudacao: string;
  sequenciaDeSemanas: number;
  dias: DiaDaFaixa[];
  meta: ProgressoDaMeta;
  fase: string;
  semanaDaFase: number;
  peso: StatusDoPeso;
}) {
  const largura = Math.min(100, Math.round((meta.feitos / Math.max(meta.meta, 1)) * 100));

  return (
    <section aria-label="Situação" className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">
          {saudacao}
        </h1>
        {sequenciaDeSemanas > 0 ? (
          <span
            className="border-primary/40 bg-primary/10 text-primary flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
            aria-label={`Sequência: ${sequenciaDeSemanas} ${
              sequenciaDeSemanas === 1 ? "semana" : "semanas"
            } com a meta cumprida`}
          >
            <Flame aria-hidden="true" className="size-4" />
            <span className="numero">{sequenciaDeSemanas}</span>
            {sequenciaDeSemanas === 1 ? "semana" : "semanas"}
          </span>
        ) : null}
      </header>

      <FaixaSemana dias={dias} href="/calendario" />

      <div className="cartao border-border bg-card flex flex-col gap-1.5 border px-3 py-2.5">
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">Meta semanal</span>
          <span className="numero text-lg">{meta.texto}</span>
        </p>
        <span
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={meta.meta}
          aria-valuenow={meta.feitos}
          aria-label="Meta semanal"
          className="bg-muted block h-2 w-full overflow-hidden rounded-full"
        >
          <span
            aria-hidden="true"
            className="bg-primary block h-full rounded-full transition-[width]"
            style={{ width: `${largura}%` }}
          />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Caixa rotulo="Fase">
          {fase} · semana {semanaDaFase}
        </Caixa>
        <Caixa rotulo="Peso">
          {peso.peso !== null ? formatarKg(peso.peso) : "—"}
          {peso.dias !== null ? (
            <span className="text-muted-foreground text-xs font-normal">
              {" "}
              {peso.dias === 0 ? "hoje" : `há ${peso.dias} ${peso.dias === 1 ? "dia" : "dias"}`}
            </span>
          ) : null}
        </Caixa>
      </div>

      {peso.pedirPesagem ? (
        <div className="border-border flex items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2">
          <p className="text-muted-foreground text-xs">
            {peso.data === null
              ? "Ainda não tem peso registrado."
              : `Último peso em ${formatarData(peso.data)}. Pese-se em jejum, 1× por semana.`}
          </p>
          <Button asChild variant="outline" className="alvo shrink-0 px-3">
            <Link href="/corpo">Pesar</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function Caixa({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="cartao border-border bg-card flex flex-col gap-0.5 border px-3 py-2">
      <span className="text-muted-foreground text-rotulo tracking-wide uppercase">
        {rotulo}
      </span>
      <span className="numero text-base">{children}</span>
    </div>
  );
}
