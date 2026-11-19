"use client";

import { useId, useMemo } from "react";
import { detalharSeriesDoTreino, type GrupoDeSeriesDoTreino } from "@/lib/detalhe-do-treino";
import type { SerieBruta, SessaoBruta } from "@/lib/progresso";
import { useSeriesDoDetalhe } from "@/lib/queries/progresso";

export function DetalheDasSeries({ sessao, conta, series, fonteCompleta, confirmadasEm }: {
  sessao: SessaoBruta;
  conta: string;
  series: readonly SerieBruta[];
  fonteCompleta: boolean;
  confirmadasEm?: number;
}) {
  const { linhas, completa, carregando } = useSeriesDoDetalhe(conta, sessao.id, series, fonteCompleta, confirmadasEm);
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
