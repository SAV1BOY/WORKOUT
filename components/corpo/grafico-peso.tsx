"use client";

import {
  COR_REFERENCIA,
  GraficoLinha,
  LegendaDoGrafico,
  type SerieDoGrafico,
} from "@/components/graficos";
import {
  pontosDoGraficoDoPeso,
  reguaDoPeso,
  seriesDoPeso,
  type ChaveDaSerieDePeso,
  type PesoBruto,
} from "@/lib/corpo";
import { formatarKg } from "@/lib/formato";

const SERIE_PESO: SerieDoGrafico = { chave: "peso", nome: "Peso" };
const SERIE_MEDIA: SerieDoGrafico = {
  chave: "media",
  nome: "Média de 7 dias",
  cor: "var(--chart-3)",
  tracejada: true,
};

/**
 * O gráfico do peso — o MESMO no Corpo (§3.8) e no card Peso do Relatório
 * (§13.5), SPEC §22.19 itens 3 e 4:
 *
 * - a régua do eixo y é `reguaDoPeso` (passo de 2 kg), com a meta dentro e
 *   fora do piso;
 * - a média de 7 dias vai com 1 casa, como o peso (`pontosDoGraficoDoPeso`);
 * - a média de 7 dias só entra quando tem pontos próprios (`seriesDoPeso`) —
 *   senão nem a linha nem a legenda a citam;
 * - a meta é uma linha tracejada, na legenda e na leitura em texto;
 * - a legenda só aparece com duas entradas ou mais.
 */
export function GraficoDoPeso({
  pesos,
  meta,
  altura,
  comMedia,
}: {
  pesos: readonly PesoBruto[];
  meta: number | null;
  altura?: number;
  /** O Corpo mostra a média de 7 dias; o card pequeno do Relatório, não. */
  comMedia: boolean;
}) {
  const pontos = pontosDoGraficoDoPeso(pesos);
  const chaves: readonly ChaveDaSerieDePeso[] = comMedia ? seriesDoPeso(pesos) : ["peso"];
  const series = chaves.map((c) => (c === "media" ? SERIE_MEDIA : SERIE_PESO));
  const regua = reguaDoPeso(pesos, meta);
  const legenda: SerieDoGrafico[] =
    meta === null
      ? series
      : [
          ...series,
          { chave: "meta", nome: `Meta ${formatarKg(meta)}`, cor: COR_REFERENCIA, tracejada: true },
        ];

  return (
    <>
      <GraficoLinha
        titulo={
          chaves.includes("media") ? "Peso por data, com a média de 7 dias" : "Peso por data"
        }
        dados={pontos}
        x="rotulo"
        sufixo=" kg"
        altura={altura}
        dominioY={regua?.dominio}
        ticksY={regua?.ticks}
        series={series}
        referencia={meta === null ? null : { nome: "Meta", valor: meta }}
      />
      {legenda.length > 1 ? <LegendaDoGrafico series={legenda} /> : null}
    </>
  );
}
