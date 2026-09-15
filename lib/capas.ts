/**
 * Capas e miniaturas (SPEC §13.1 e §13.3): toda imagem sai de `assets/` pelo
 * caminho que o JSON guarda — nenhuma imagem de terceiros, nenhum caminho
 * escrito à mão. Funções puras, sem React.
 */
import { acharExercicio, caminhoPublico, exerciciosDoTreino, urlFigura } from "@/lib/dados";
import type { Exercicio, TreinoId } from "@/lib/schemas";

/** A foto de início (`-1.jpg`) do exercício, que é a capa (SPEC §13.3). */
export function capaDoExercicio(exercicio: Exercicio): string | null {
  const primeira = exercicio.fotos[0];
  return primeira ? caminhoPublico(primeira) : null;
}

/** A capa de um treino do programa: a foto `-1` do primeiro exercício dele. */
export function capaDoTreino(id: TreinoId): string | null {
  const primeiro = exerciciosDoTreino(id)[0];
  return primeiro ? capaDoExercicio(primeiro.exercicio) : null;
}

export interface Miniatura {
  /** A figura animada, quando o exercício tem uma. */
  figura: string | null;
  /** A foto `-1.jpg`, que é o que aparece se a figura faltar. */
  foto: string | null;
  alt: string;
}

/** A miniatura da lista do dia (SPEC §13.3): figura animada ou foto `-1`. */
export function miniaturaDoExercicio(id: string): Miniatura {
  const exercicio = acharExercicio(id);
  return {
    figura: urlFigura(exercicio),
    foto: capaDoExercicio(exercicio),
    alt: exercicio.nome,
  };
}

/**
 * A capa do card de cardio (SPEC §13.3). A corda tem foto de execução no kit;
 * corrida e caminhada não têm — e inventar uma seria imagem de terceiros, então
 * esses ficam com o gradiente e o ícone da própria tela.
 */
export const EXERCICIO_DA_CORDA = "corrida-no-lugar-com-a-corda";

export function capaDoCardio(tipo: "corrida" | "corda" | "caminhada"): string | null {
  if (tipo !== "corda") return null;
  return capaDoExercicio(acharExercicio(EXERCICIO_DA_CORDA));
}
