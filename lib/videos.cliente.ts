/**
 * O pedaço de `lib/videos.ts` que o navegador pode importar: só o caminho.
 * A leitura do disco (`node:fs`) fica no servidor.
 */

/** "/videos/<id>.mp4" — o arquivo que `npm run assets` copiou, se existir. */
export function urlDoVideo(id: string): string {
  return `/videos/${id}.mp4`;
}
