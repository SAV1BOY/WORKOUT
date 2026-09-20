"use client";

import { ExternalLink, Play, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { tutorialPorExercicio } from "@/lib/dados";

/** A miniatura oficial do YouTube (nenhuma imagem de terceiros é copiada). */
export function urlDaMiniatura(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

export function urlDoEmbed(youtubeId: string): string {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`;
}

/**
 * A aba **Tutorial** da ficha (SPEC §14.2): o vídeo curado em
 * `data/tutoriais.json`, mostrado como miniatura + play e só carregado no
 * YouTube **ao tocar** — antes disso não sai nenhuma requisição para lá.
 *
 * Sem rede (ou com a miniatura falhando) a aba diz "Precisa de internet" e
 * oferece o link para abrir no YouTube, que o navegador resolve quando puder.
 */
export function TutorialDoExercicio({ exercicioId }: { exercicioId: string }) {
  const tutorial = tutorialPorExercicio(exercicioId);
  const [tocado, setTocado] = useState(false);
  const [semRede, setSemRede] = useState(false);

  // o id muda quando a ficha navega entre os exercícios do treino
  useEffect(() => {
    setTocado(false);
    setSemRede(false);
  }, [exercicioId]);

  useEffect(() => {
    const olhar = () => setSemRede(navigator.onLine === false);
    olhar();
    window.addEventListener("online", olhar);
    window.addEventListener("offline", olhar);
    return () => {
      window.removeEventListener("online", olhar);
      window.removeEventListener("offline", olhar);
    };
  }, []);

  if (!tutorial) {
    return (
      <p className="text-muted-foreground text-sm">
        Sem tutorial para este exercício.
      </p>
    );
  }

  if (semRede) {
    return (
      <div
        data-tutorial="sem-rede"
        className="border-border flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center"
      >
        <WifiOff aria-hidden="true" className="text-muted-foreground size-6" />
        <p className="text-sm font-medium">Precisa de internet</p>
        <p className="text-muted-foreground text-xs text-balance">
          O tutorial fica no YouTube. A figura animada e as fotos continuam aqui
          sem rede.
        </p>
        <Button asChild variant="outline" className="alvo h-11">
          <a href={tutorial.url} target="_blank" rel="noreferrer noopener">
            <ExternalLink className="size-4" />
            Abrir no YouTube
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-muted/40 relative aspect-video w-full overflow-hidden rounded-xl">
        {tocado ? (
          <iframe
            data-tutorial="embed"
            src={urlDoEmbed(tutorial.youtube_id)}
            title={tutorial.titulo}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <button
            type="button"
            data-tutorial="miniatura"
            aria-label={`Ver o tutorial: ${tutorial.titulo}`}
            onClick={() => setTocado(true)}
            className="group absolute inset-0 size-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do YouTube, sem otimização do Next */}
            <img
              src={urlDaMiniatura(tutorial.youtube_id)}
              alt=""
              width={480}
              height={360}
              loading="lazy"
              decoding="async"
              onError={() => setSemRede(true)}
              className="size-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-full shadow-lg">
                <Play aria-hidden="true" className="size-7 translate-x-0.5" fill="currentColor" />
              </span>
            </span>
          </button>
        )}
      </div>
      <p className="text-sm font-medium text-balance">{tutorial.titulo}</p>
      <p className="text-muted-foreground text-xs">
        {tutorial.canal} · {tutorial.idioma === "pt-BR" ? "português" : tutorial.idioma}
      </p>
      {tutorial.nota ? (
        <p className="text-muted-foreground text-xs">{tutorial.nota}</p>
      ) : null}
    </div>
  );
}
