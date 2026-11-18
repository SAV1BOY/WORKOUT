/**
 * As peças dos gráficos que **não** dependem do Recharts: assim a página
 * carrega a legenda e o "sem dados" sem trazer a biblioteca junto
 * (`components/graficos/index.tsx` importa o gráfico sob demanda).
 */
import { ChartSpline, type LucideIcon } from "lucide-react";
import { Vazio, type AcaoDoVazio } from "@/components/ui/vazio";
export interface SerieDoGrafico {
  chave: string;
  nome: string;
  /** Uma cor do tema; o padrão é a cor de destaque. */
  cor?: string;
  tracejada?: boolean;
}

const COR_PADRAO = "var(--chart-1)";

/**
 * A cor da linha de referência (a meta do peso, SPEC §22.19 item 4): a cor
 * do texto do tema, tracejada. Mora aqui (e não em `grafico.tsx`) para a
 * legenda usar a mesma cor sem trazer o Recharts junto.
 */
export const COR_REFERENCIA = "var(--chart-2)";

/**
 * Uma legenda simples (a do Recharts é pequena demais a 360 px). A série
 * tracejada (a média de 7 dias, a meta) ganha um traço tracejado no lugar do
 * ponto — a mesma forma da linha no gráfico, não só a cor.
 */
export function LegendaDoGrafico({ series }: { series: readonly SerieDoGrafico[] }) {
  return (
    <ul className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {series.map((s) => (
        <li key={s.chave} className="flex items-center gap-1">
          {s.tracejada ? (
            <span
              aria-hidden="true"
              data-legenda="tracejada"
              className="inline-block w-3.5 border-t-2 border-dashed"
              style={{ borderColor: s.cor ?? COR_PADRAO }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: s.cor ?? COR_PADRAO }}
            />
          )}
          {s.nome}
        </li>
      ))}
    </ul>
  );
}

/**
 * O que aparece no lugar do gráfico enquanto não há dado nenhum (SPEC §22.3
 * item 9). `acao` é opcional: nem todo gráfico tem uma saída óbvia.
 *
 * `icone` e `titulo` têm padrão de GRÁFICO — e só por isso (SPEC §22.3
 * item 15): quem chama de um contexto que não é gráfico (a galeria de fotos,
 * a tabela de medidas) passa os seus, senão a tela vazia anuncia "Sem dados
 * por enquanto" debaixo de um gráfico de linha que ninguém pediu.
 */
export function SemDados({
  children,
  titulo = "Sem dados por enquanto",
  icone = ChartSpline,
  acao,
}: {
  children?: React.ReactNode;
  titulo?: string;
  icone?: LucideIcon;
  acao?: AcaoDoVazio;
}) {
  return <Vazio icone={icone} titulo={titulo} frase={children} acao={acao} />;
}
