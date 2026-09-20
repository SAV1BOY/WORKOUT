"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTemVideo } from "@/components/videos-do-app";
import { Miniatura } from "@/components/ui/miniatura";
import { Raios } from "@/components/ui/raios";
import { acharExercicio } from "@/lib/dados";
import { dificuldadeDe } from "@/lib/dificuldade";
import { evitado } from "@/lib/preferencias";
import type { Prefs } from "@/lib/types";

/**
 * SPEC §22.4 item 10: a ficha em folha (mídia grande, mapa anatômico, tutorial
 * e o iframe do YouTube) só existe depois de um toque no "?" — carregá-la
 * junto com a tela era peso parado no caminho de quem só quer treinar. Entra
 * por `next/dynamic`, no primeiro toque.
 */
const FichaEmFolha = dynamic(
  () => import("@/components/exercicio/ficha-folha").then((m) => m.FichaEmFolha),
  { ssr: false },
);

/**
 * A lista de exercícios de uma coleção (SPEC §14.3): miniatura, nome,
 * prescrição do catálogo e raios. O toque abre a ficha em folha.
 */
export function ListaDaColecao({
  ids,
  titulo,
  mostrarRaios = true,
  prefs,
}: {
  ids: readonly string[];
  titulo: string;
  mostrarRaios?: boolean;
  prefs?: Prefs;
}) {
  const [ficha, setFicha] = useState<string | null>(null);
  // a ficha aberta daqui mostra vídeo igual à do player (SPEC §22.2 item 7)
  const temVideo = useTemVideo(ficha);

  return (
    <>
      <ul aria-label={titulo} className="flex flex-col divide-y">
        {ids.map((id) => {
          const e = acharExercicio(id);
          return (
            <li key={id}>
              <button
                type="button"
                aria-label={`Ficha: ${e.nome}`}
                onClick={() => setFicha(id)}
                className="hover:bg-muted/40 alvo -mx-1 flex w-[calc(100%+0.5rem)] items-center gap-3 rounded-xl px-1 py-2 text-left"
              >
                <Miniatura exercicioId={id} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 text-sm font-medium text-balance">
                      {e.nome}
                    </span>
                    {mostrarRaios ? (
                      <Raios
                        nivel={dificuldadeDe(e)}
                        tamanho="sm"
                        className="text-primary shrink-0"
                      />
                    ) : null}
                  </span>
                  <span className="numero text-muted-foreground text-xs">
                    {e.prescricao_padrao.texto} · {e.equipamento_texto}
                  </span>
                  {evitado(prefs, id) ? (
                    <span className="text-muted-foreground text-xs">
                      você marcou como evitar
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {ficha !== null ? (
        <FichaEmFolha
          exercicioId={ficha}
          aberto
          aoMudarAberto={(v) => setFicha(v ? ficha : null)}
          prefs={prefs}
          temVideo={temVideo}
        />
      ) : null}
    </>
  );
}
