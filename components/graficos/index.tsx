"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * O Recharts entra sob demanda: ele sozinho é metade do JS da página e nenhum
 * gráfico aparece antes de a leitura do banco chegar. Quem desenha está em
 * `grafico.tsx`; o que não depende dele, em `apoio.tsx`.
 */
/** O mesmo padrão de `grafico.tsx` — o espaço reservado é o do gráfico. */
const ALTURA_PADRAO = 180;

/*
 * O componente de `loading` do next/dynamic não recebe as props do gráfico,
 * então o espaço reservado usava sempre 180 px e a página dava um pulinho
 * quando o Recharts chegava. Aqui o wrapper reserva a altura que ESTE gráfico
 * declarou (`altura`, com o mesmo padrão do gráfico de verdade).
 */
function comAltura<P extends { altura?: number }>(
  carregar: () => Promise<ComponentType<P>>,
) {
  const Carregado = dynamic(carregar, { ssr: false, loading: () => null });
  const Envolvido = (props: P) => (
    <div style={{ minHeight: props.altura ?? ALTURA_PADRAO }}>
      <Carregado {...props} />
    </div>
  );
  return Envolvido;
}

export const GraficoLinha = comAltura(() =>
  import("@/components/graficos/grafico").then((m) => m.GraficoLinha),
);

export const GraficoBarras = comAltura(() =>
  import("@/components/graficos/grafico").then((m) => m.GraficoBarras),
);

export { LegendaDoGrafico, SemDados, type SerieDoGrafico } from "@/components/graficos/apoio";
