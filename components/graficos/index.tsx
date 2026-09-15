"use client";

import dynamic from "next/dynamic";

/**
 * O Recharts entra sob demanda: ele sozinho é metade do JS da página e nenhum
 * gráfico aparece antes de a leitura do banco chegar. Quem desenha está em
 * `grafico.tsx`; o que não depende dele, em `apoio.tsx`.
 */
const Espaco = ({ altura = 180 }: { altura?: number }) => (
  <div style={{ height: altura }} aria-hidden="true" />
);

export const GraficoLinha = dynamic(
  () => import("@/components/graficos/grafico").then((m) => m.GraficoLinha),
  { ssr: false, loading: () => <Espaco /> },
);

export const GraficoBarras = dynamic(
  () => import("@/components/graficos/grafico").then((m) => m.GraficoBarras),
  { ssr: false, loading: () => <Espaco /> },
);

export { LegendaDoGrafico, SemDados, type SerieDoGrafico } from "@/components/graficos/apoio";
