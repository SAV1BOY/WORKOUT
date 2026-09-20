"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Quais exercícios têm vídeo local (SPEC §13.1 e §22.2 item 7).
 *
 * Quem lê a pasta `public/videos` é o servidor (`lib/videos.ts`), no layout do
 * app; o navegador recebe a lista pronta. Com ela aqui, qualquer tela do shell
 * abre a ficha já sabendo se há vídeo — antes só o player passava `temVideo`,
 * e a mesma ficha aberta pela lista do dia ou pela lista de uma coleção
 * mostrava a ilustração mesmo com o vídeo no lugar.
 */
const ComVideo = createContext<readonly string[]>([]);

export function VideosDoApp({
  ids,
  children,
}: {
  ids: readonly string[];
  children: ReactNode;
}) {
  return <ComVideo.Provider value={ids}>{children}</ComVideo.Provider>;
}

/** `true` quando este exercício tem `public/videos/<id>.mp4`. */
export function useTemVideo(id: string | null | undefined): boolean {
  const ids = useContext(ComVideo);
  return typeof id === "string" && ids.includes(id);
}
