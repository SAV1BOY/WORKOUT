/**
 * As peças dos gráficos que **não** dependem do Recharts: assim a página
 * carrega a legenda e o "sem dados" sem trazer a biblioteca junto
 * (`components/graficos/index.tsx` importa o gráfico sob demanda).
 */
export interface SerieDoGrafico {
  chave: string;
  nome: string;
  /** Uma cor do tema; o padrão é a cor de destaque. */
  cor?: string;
  tracejada?: boolean;
}

const COR_PADRAO = "var(--chart-1)";

/** Uma legenda simples (a do Recharts é pequena demais a 360 px). */
export function LegendaDoGrafico({ series }: { series: readonly SerieDoGrafico[] }) {
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {series.map((s) => (
        <li key={s.chave} className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: s.cor ?? COR_PADRAO }}
          />
          {s.nome}
        </li>
      ))}
    </ul>
  );
}

/** O que aparece no lugar do gráfico enquanto não há dado nenhum. */
export function SemDados({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-sm text-balance">
      {children}
    </p>
  );
}
