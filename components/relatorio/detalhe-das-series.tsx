"use client";

import { useId, useMemo, type ReactElement, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { detalharSeriesDoTreino, type GrupoDeSeriesDoTreino } from "@/lib/detalhe-do-treino";
import type { SerieBruta, SessaoBruta } from "@/lib/progresso";
import { useSeriesDoDetalhe } from "@/lib/queries/progresso";

export function FolhaDasSeries({ gatilho, descricao, children }: {
  gatilho: ReactElement;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{gatilho}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-3 overflow-hidden">
        <SheetHeader className="shrink-0 gap-1 pr-16 pb-0">
          <SheetTitle>Séries do treino</SheetTitle>
          <SheetDescription className="wrap-anywhere">{descricao}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function DetalheDasSeries({ sessao, conta, series, fonteCompleta, confirmadasEm }: {
  sessao: SessaoBruta;
  conta: string;
  series: readonly SerieBruta[];
  fonteCompleta: boolean;
  confirmadasEm?: number;
}) {
  const resultado = useSeriesDoDetalhe(conta, sessao.id, series, fonteCompleta, confirmadasEm);
  return <SeriesRegistradas sessao={sessao} conta={conta} {...resultado} />;
}

export function SeriesRegistradas({ sessao, conta, linhas, completa, carregando }: {
  sessao: SessaoBruta;
  conta: string;
  linhas: readonly SerieBruta[];
  completa: boolean;
  carregando: boolean;
}) {
  const grupos = useMemo(() => detalharSeriesDoTreino(sessao, linhas, conta), [sessao, linhas, conta]);
  const aviso = carregando ? "Consultando as séries guardadas neste aparelho…"
    : !completa ? "O histórico de séries deste treino está incompleto neste aparelho."
    : grupos.length === 0 ? "Nenhuma série registrada neste treino." : null;

  return (
    <div tabIndex={grupos.length ? 0 : undefined} role="region" aria-label="Séries registradas"
      className="foco flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-6">
      {aviso && <p role="status" className="text-muted-foreground text-sm">{aviso}</p>}
      {grupos.map(grupo => <SeriesDoExercicio key={grupo.chave} grupo={grupo} />)}
    </div>
  );
}

function SeriesDoExercicio({ grupo }: { grupo: GrupoDeSeriesDoTreino }) {
  const titulo = useId();
  const avisoPosicao = `${titulo}-posicao`;
  return (
    <section aria-labelledby={titulo} aria-describedby={grupo.posicaoAmbigua ? avisoPosicao : undefined} className="min-w-0">
      <h3 id={titulo} className="mb-1 text-sm font-semibold wrap-anywhere">{grupo.nome}</h3>
      {grupo.posicaoAmbigua && (
        <p id={avisoPosicao} className="text-muted-foreground text-sm">A posição dessas séries no treino não foi registrada nesta cópia.</p>
      )}
      <ol className="divide-y">
        {grupo.series.map(s => (
          <li key={s.chave} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
            <span className="text-muted-foreground text-sm">{s.rotulo}</span>
            <span className="numero max-w-full text-sm wrap-anywhere">{s.valores}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
