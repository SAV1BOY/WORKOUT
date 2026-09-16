"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Quanto tempo cada posição fica na tela antes de trocar. */
const MS_POR_POSICAO = 1200;

/**
 * As duas posições da ilustração em transição alternada (marco Mídia): em vez
 * de gerar um GIF, o navegador faz o crossfade entre as duas imagens que já
 * estão em `assets/ilustracoes/` — ~1,2 s por posição. Um toque pausa (ou
 * volta a alternar), para quem quiser olhar o início ou o fim com calma.
 *
 * Com uma posição só não há animação nem botão: é uma imagem parada.
 */
export function IlustracaoAlternada({
  urls,
  alt,
  className,
}: {
  urls: string[];
  alt: string;
  className?: string;
}) {
  const [posicao, setPosicao] = useState(0);
  const [pausado, setPausado] = useState(false);
  const alterna = urls.length > 1;

  useEffect(() => {
    if (!alterna || pausado) return;
    const id = setInterval(
      () => setPosicao((v) => (v + 1) % urls.length),
      MS_POR_POSICAO,
    );
    return () => clearInterval(id);
  }, [alterna, pausado, urls.length]);

  const imagens = urls.map((url, i) => (
    // eslint-disable-next-line @next/next/no-img-element -- imagem local em /public, caixa de tamanho fixo
    <img
      key={url}
      src={url}
      alt={i === 0 ? alt : ""}
      aria-hidden={i === 0 ? undefined : true}
      className={cn(
        "absolute inset-0 size-full object-contain p-2 transition-opacity duration-500 ease-in-out",
        i === posicao ? "opacity-100" : "opacity-0",
      )}
    />
  ));

  const caixa = cn(
    "bg-ilustracao relative block w-full overflow-hidden rounded-xl",
    className,
  );

  if (!alterna) {
    return (
      <span className={caixa} data-ilustracao="parada" data-posicao="1">
        {imagens}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-ilustracao={pausado ? "pausada" : "alternando"}
      data-posicao={posicao + 1}
      aria-label={
        pausado ? "Voltar a alternar as posições" : "Parar em uma posição"
      }
      onClick={() => {
        setPausado((v) => {
          // o toque sempre muda algo na tela: ao voltar a alternar, já troca
          if (v) setPosicao((p) => (p + 1) % urls.length);
          return !v;
        });
      }}
      className={caixa}
    >
      {imagens}
    </button>
  );
}
