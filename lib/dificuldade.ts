/**
 * Dificuldade em raios (SPEC §13.4): derivada da `categoria` de
 * `data/exercicios.json`, nunca escrita à mão. Função pura, sem React.
 */
import type { Categoria, Exercicio } from "@/lib/schemas";

/** 1, 2 ou 3 raios. */
export type Raios = 1 | 2 | 3;

/** O quadro da SPEC §13.4, categoria por categoria. */
const POR_CATEGORIA: Record<Categoria, Raios> = {
  composto_pesado: 3,
  composto_moderado: 2,
  isolamento: 1,
  core_peso_corporal: 1,
};

/** Os raios de um exercício (SPEC §13.4). */
export function dificuldadeDe(exercicio: Exercicio): Raios {
  return POR_CATEGORIA[exercicio.categoria];
}

/** A dificuldade de um conjunto é a maior dos seus exercícios (SPEC §13.4). */
export function dificuldadeDaColecao(exercicios: readonly Exercicio[]): Raios | null {
  let maior: Raios | null = null;
  for (const e of exercicios) {
    const r = dificuldadeDe(e);
    if (maior === null || r > maior) maior = r;
  }
  return maior;
}

/** "fácil · moderado · pesado" — o rótulo acessível dos raios. */
export const NOME_DA_DIFICULDADE: Record<Raios, string> = {
  1: "leve",
  2: "moderado",
  3: "pesado",
};
