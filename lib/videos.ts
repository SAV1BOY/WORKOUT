/**
 * Vídeo opcional (SPEC §13.1): se existir `assets/videos/<id>.mp4` — copiado
 * para `public/videos/` pelo `npm run assets` — a ficha e o bloco da sessão
 * mostram o vídeo no lugar da figura. Nenhum vídeo é entregue no kit.
 *
 * A lista é lida do disco no servidor (build das 81 fichas, render da sessão)
 * e desce pronta para o cliente: assim nenhuma tela tenta buscar um arquivo
 * que não existe e nenhum 404 aparece no console.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { urlDoVideo } from "@/lib/videos.cliente";

/** A pasta pública onde o `npm run assets` deixa os vídeos. */
export const PASTA_DE_VIDEOS = join(process.cwd(), "public", "videos");

export { urlDoVideo } from "@/lib/videos.cliente";

/** Os ids que têm vídeo numa pasta. Pasta ausente = lista vazia (é o normal). */
export function idsComVideoEm(pasta: string): string[] {
  if (!existsSync(pasta)) return [];
  try {
    return readdirSync(pasta)
      .filter((arquivo) => arquivo.toLowerCase().endsWith(".mp4"))
      .map((arquivo) => arquivo.slice(0, -4))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Os ids com vídeo em `public/videos`. Sem cache de propósito: em
 * desenvolvimento (e nos e2e, que criam um mp4 temporário) a pasta muda com o
 * servidor de pé, e ler um diretório pequeno é barato.
 */
export function idsComVideo(): string[] {
  return idsComVideoEm(PASTA_DE_VIDEOS);
}

/** O vídeo de um exercício, se houver. */
export function videoDoExercicio(id: string): string | null {
  return idsComVideo().includes(id) ? urlDoVideo(id) : null;
}
