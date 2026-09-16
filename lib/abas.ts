/**
 * As cinco abas da barra de baixo (SPEC §13.2), numa lista só.
 *
 * `components/nav-inferior.tsx` desenha esta lista e `lib/guia.ts` (SPEC §20)
 * a lê para a miniatura da barra e para a seção de cada aba: o guia nunca
 * redigita um rótulo de aba. Sem React aqui — o ícone é o **nome** do ícone
 * lucide, resolvido por quem desenha.
 */

/** Os ícones lucide que a barra usa, por nome. */
export type IconeDaAba =
  | "Dumbbell"
  | "Compass"
  | "ChartLine"
  | "PersonStanding"
  | "Ellipsis";

export interface Aba {
  href: string;
  rotulo: string;
  icone: IconeDaAba;
  /** Rotas que acendem este item. */
  prefixos: readonly string[];
}

/** SPEC §13.2: Treino · Explorar · Relatório · Corpo · Mais. */
export const ABAS: readonly Aba[] = [
  {
    href: "/",
    rotulo: "Treino",
    icone: "Dumbbell",
    // a aba Treino absorveu Treinar: a sessão e o calendário acendem ela
    prefixos: ["/", "/treinar", "/cardio", "/barra-fixa", "/calendario"],
  },
  {
    href: "/explorar",
    rotulo: "Explorar",
    icone: "Compass",
    prefixos: ["/explorar", "/exercicios"],
  },
  {
    href: "/relatorio",
    rotulo: "Relatório",
    icone: "ChartLine",
    prefixos: ["/relatorio", "/progresso"],
  },
  {
    href: "/corpo",
    rotulo: "Corpo",
    icone: "PersonStanding",
    prefixos: ["/corpo"],
  },
  { href: "/mais", rotulo: "Mais", icone: "Ellipsis", prefixos: ["/mais"] },
];

/** A aba acesa para um caminho, ou `null` fora das cinco. */
export function abaDoCaminho(caminho: string): Aba | null {
  return (
    ABAS.find(({ prefixos }) =>
      prefixos.some((p) =>
        p === "/" ? caminho === "/" : caminho === p || caminho.startsWith(`${p}/`),
      ),
    ) ?? null
  );
}

/** O rótulo de uma aba pelo href ("/" → "Treino"). */
export function rotuloDaAba(href: string): string | null {
  return ABAS.find((a) => a.href === href)?.rotulo ?? null;
}
