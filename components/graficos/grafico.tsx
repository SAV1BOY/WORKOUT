"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
import type { SerieDoGrafico } from "@/components/graficos/apoio";
import { formatarNumero } from "@/lib/formato";

/**
 * Gráficos da SPEC §3.6/§3.7/§3.8 (Recharts).
 *
 * Celular primeiro: sem legenda quando há uma série só, poucos rótulos no eixo
 * x, números tabulares e as cores do tema (uma cor de destaque). Funciona com
 * 1 ponto (o ponto aparece sozinho) e com 30.
 */

interface Comum {
  /** Uma linha por ponto; as chaves são as `chave` das séries e o `x`. */
  dados: readonly object[];
  x: string;
  series: readonly SerieDoGrafico[];
  altura?: number;
  sufixo?: string;
  /** Rótulo de acessibilidade — o gráfico é uma figura. */
  titulo: string;
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

function eixos(dados: Comum["dados"], x: string, sufixo: string) {
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
      />
      <YAxis
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
  titulo,
  altura,
  children,
}: {
  titulo: string;
  altura: number;
  children: React.ReactElement;
}) {
  return (
    <figure className="w-full" aria-label={titulo}>
      <div style={{ height: altura }} className="w-full">
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
}: Comum) {
  return (
    <Moldura titulo={titulo} altura={altura}>
      <LineChart data={[...dados] as object[]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {eixos(dados, x, sufixo)}
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
  empilhado = false,
}: Comum & { empilhado?: boolean }) {
  return (
    <Moldura titulo={titulo} altura={altura}>
      <BarChart data={[...dados] as object[]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {eixos(dados, x, sufixo)}
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
