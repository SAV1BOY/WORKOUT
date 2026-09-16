import {
  ChartLine,
  Compass,
  Dumbbell,
  Ellipsis,
  PersonStanding,
  type LucideIcon,
} from "lucide-react";
import type { IconeDaAba } from "@/lib/abas";

/**
 * O ícone lucide de cada aba, pelo nome guardado em `lib/abas.ts`. A barra de
 * baixo e a miniatura do guia (SPEC §20.4) resolvem por aqui — a lista das
 * abas continua sendo uma só, sem React.
 */
export const ICONE_DA_ABA: Readonly<Record<IconeDaAba, LucideIcon>> = {
  Dumbbell,
  Compass,
  ChartLine,
  PersonStanding,
  Ellipsis,
};
