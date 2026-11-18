"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { COR_REFERENCIA, type SerieDoGrafico } from "@/components/graficos/apoio";
import { formatarNumero } from "@/lib/formato";
import { leituraDoGrafico, type ReferenciaParaLer } from "@/lib/grafico-leitura";

/**
 * Gráficos da SPEC §3.6/§3.7/§3.8 (Recharts).
 *
 * Celular primeiro: sem legenda quando há uma série só, poucos rótulos no eixo
 * x, números tabulares e as cores do tema (uma cor de destaque). Funciona com
 * 1 ponto (o ponto aparece sozinho) e com 30.
 *
 * Acessibilidade (SPEC §22.19 item 1): o desenho fica FORA da árvore — a
 * camada do Recharts (`role="application"`, `tabindex="0"` na `<svg>`, os
 * rótulos dos eixos lidos grudados) é desligada e a área do gráfico é
 * `aria-hidden` — e a `<figure role="img">` leva o título mais a leitura dos
 * dados (`leituraDoGrafico`, `lib/grafico-leitura.ts`).
 */

interface Comum {
  /** Uma linha por ponto; as chaves são as `chave` das séries e o `x`. */
  dados: readonly object[];
  x: string;
  series: readonly SerieDoGrafico[];
  altura?: number;
  sufixo?: string;
  /**
   * O começo do nome acessível da figura; a leitura dos dados vem depois
   * ("Peso por data. Peso: 84,2 kg em 12/08, …").
   */
  titulo: string;
  /**
   * Domínio do eixo y (o padrão do Recharts é `[0, "auto"]`).
   *
   * Nos gráficos de barra a base zero é informação e fica como está. Nas
   * linhas de faixa estreita — peso entre 81 e 83 kg, cintura em 88 cm — o
   * zero achata a série e a média de 7 dias da §3.8 vira um traço reto: lá
   * quem chama passa um domínio folgado (`lib/corpo.ts`, `dominioFolgado`).
   */
  dominioY?: [number | string, number | string];
  /** Os rótulos do eixo y, quando quem chama fixa a régua (o peso, §22.19). */
  ticksY?: readonly number[];
}

/** Só a linha desenha referência: nas barras ela não existe nem no tipo. */
interface DaLinha extends Comum {
  /**
   * Uma linha horizontal tracejada — a meta do peso (§22.19 item 4). Entra
   * também na leitura em texto.
   */
  referencia?: ReferenciaParaLer | null;
}

export const COR_PADRAO = "var(--chart-1)";
const EIXO = "var(--muted-foreground)";
const GRADE = "var(--border)";

function espacamento(quantos: number): number {
  // a 360 px cabem ~6 rótulos no eixo x
  return Math.max(0, Math.ceil(quantos / 6) - 1);
}

function conteudoDaDica(sufixo: string) {
  return function Dica({
    active,
    payload,
    label,
  }: TooltipContentProps<ValueType, NameType>) {
    if (!active || !payload?.length) return null;
    return (
      <div className="border-border bg-popover text-popover-foreground rounded-lg border px-2 py-1 text-xs shadow-md">
        <p className="font-medium">{String(label ?? "")}</p>
        {payload.map((p) => (
          <p key={String(p.name)} style={{ color: p.color }}>
            {String(p.name)}:{" "}
            <span className="numero">{formatarNumero(Number(p.value ?? 0))}</span>
            {sufixo}
          </p>
        ))}
      </div>
    );
  };
}

function eixos(
  dados: Comum["dados"],
  x: string,
  sufixo: string,
  dominioY?: Comum["dominioY"],
  folgaNoX = false,
  ticksY?: Comum["ticksY"],
) {
  return (
    <>
      <CartesianGrid stroke={GRADE} strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey={x}
        stroke={EIXO}
        tick={{ fontSize: 10 }}
        tickLine={false}
        axisLine={{ stroke: GRADE }}
        interval={espacamento(dados.length)}
        minTickGap={4}
        /*
         * Na linha o tick do último ponto é centrado nele e, a 360 px, escapava
         * da área de desenho ("09/0" no lugar de "09/09"). A folga à direita é
         * do eixo e vale com 1, 2 ou 30 pontos. Na barra a escala é de banda
         * (cada barra já tem a sua faixa) e o padding só desalinharia.
         */
        {...(folgaNoX ? { padding: { left: 4, right: 12 } } : {})}
      />
      <YAxis
        {...(dominioY ? { domain: dominioY } : {})}
        {...(ticksY ? { ticks: [...ticksY], interval: 0 } : {})}
        stroke={EIXO}
        tick={{ fontSize: 10 }}
        tickLine={false}
        axisLine={false}
        width={38}
        tickFormatter={(v: number) => formatarNumero(v, 1)}
      />
      <Tooltip content={conteudoDaDica(sufixo)} />
    </>
  );
}

function Moldura({
  leitura,
  altura,
  children,
}: {
  leitura: string;
  altura: number;
  children: React.ReactElement;
}) {
  return (
    <figure role="img" className="w-full" aria-label={leitura}>
      <div style={{ height: altura }} className="w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function GraficoLinha({
  dados,
  x,
  series,
  altura = 180,
  sufixo = "",
  titulo,
  dominioY,
  ticksY,
  referencia = null,
}: DaLinha) {
  const leitura = leituraDoGrafico({ titulo, dados, x, series, sufixo, referencia });
  return (
    <Moldura leitura={leitura} altura={altura}>
      <LineChart
        data={[...dados] as object[]}
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        {eixos(dados, x, sufixo, dominioY, true, ticksY)}
        {referencia ? (
          <ReferenceLine
            y={referencia.valor}
            stroke={COR_REFERENCIA}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            ifOverflow="extendDomain"
          />
        ) : null}
        {series.map((s) => (
          <Line
            key={s.chave}
            type="monotone"
            dataKey={s.chave}
            name={s.nome}
            stroke={s.cor ?? COR_PADRAO}
            strokeWidth={2}
            strokeDasharray={s.tracejada ? "4 3" : undefined}
            dot={{ r: 2.5 }}
            activeDot={{ r: 4 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </Moldura>
  );
}

export function GraficoBarras({
  dados,
  x,
  series,
  altura = 180,
  sufixo = "",
  titulo,
  dominioY,
  ticksY,
  empilhado = false,
}: Comum & { empilhado?: boolean }) {
  const leitura = leituraDoGrafico({ titulo, dados, x, series, sufixo });
  return (
    <Moldura leitura={leitura} altura={altura}>
      <BarChart
        data={[...dados] as object[]}
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        {eixos(dados, x, sufixo, dominioY, false, ticksY)}
        {series.map((s) => (
          <Bar
            key={s.chave}
            dataKey={s.chave}
            name={s.nome}
            fill={s.cor ?? COR_PADRAO}
            stackId={empilhado ? "pilha" : undefined}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </Moldura>
  );
}
