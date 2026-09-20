/**
 * Capas dos cards (SPEC §13.1 e §13.3): toda imagem sai de `assets/` pelo
 * caminho que o JSON guarda — nenhuma imagem de terceiros, nenhum caminho
 * escrito à mão. Funções puras, sem React. Quem escolhe a imagem de um
 * exercício (ilustração · figura · foto) é `lib/midia.ts`.
 */
import { acharExercicio, caminhoPublico, exerciciosDoTreino } from "@/lib/dados";
import type { Exercicio, TreinoId } from "@/lib/schemas";

/**
 * A derivada 720×360 da capa (SPEC §22.4 item 1): a caixa do cartão tem
 * 326×160, então 720 px é 2,2× — nítido no retina e um quinto do peso da foto
 * inteira. Só as fotos `-1` viram capa; qualquer outro caminho devolve `null`
 * e o cartão desenha o arquivo original.
 */
const FOTO_DE_CAPA = /^\/fotos\/.+-1\.jpe?g$/i;

export function urlCapa(url: string | null | undefined): string | null {
  if (!url || !FOTO_DE_CAPA.test(url)) return null;
  return `${url.slice(0, url.lastIndexOf("."))}-capa.webp`;
}

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
