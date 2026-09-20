"use client";

import { useState } from "react";
import { IlustracaoAlternada } from "@/components/exercicio/ilustracao-alternada";
import { fonteComReserva, reservaDaImagem } from "@/components/ui/imagem";
import { midiaGrande, notaDaIlustracao, urlWebp, type TipoDeMidia } from "@/lib/midia";
import { cn } from "@/lib/utils";

/**
 * A demonstração grande do exercício (SPEC §13.1/§13.3 e marco Mídia). Quem
 * escolhe entre vídeo, ilustração, figura e foto é `lib/midia.ts`; aqui só se
 * desenha. Com `tipo` a escolha vem do segmento "Ilustração · Figura · Fotos"
 * da ficha.
 */
export function MediaGrande({
  exercicioId,
  temVideo = false,
  semFoto = false,
  tipo,
  semCredito = false,
  className,
}: {
  exercicioId: string;
  temVideo?: boolean;
  /**
   * Não cair na foto quando não há figura: na página inteira da ficha as duas
   * fotos já aparecem logo abaixo, e repetir a primeira aqui seria ruído.
   */
  semFoto?: boolean;
  /** Força uma opção (o segmento da ficha); sem ela vale a preferência. */
  tipo?: TipoDeMidia;
  /** No player o crédito fica na ficha (um toque no "?"), não na tela. */
  semCredito?: boolean;
  className?: string;
}) {
  const midia = midiaGrande(exercicioId, { temVideo, tipo, semFoto });
  const [figuraQuebrou, setFiguraQuebrou] = useState(false);

  const caixa = cn("bg-muted/40 h-40 w-full rounded-xl object-contain", className);

  if (!midia) return null;

  /*
   * Quem decide se há vídeo é o servidor, lendo `public/videos` (SPEC §13.1):
   * aqui não há fallback por erro — um arquivo estragado é para aparecer
   * estragado, não para sumir em silêncio.
   */
  if (midia.tipo === "video") {
    return (
      <video
        src={midia.urls[0]}
        muted
        loop
        playsInline
        autoPlay
        aria-label={midia.alt}
        data-video={exercicioId}
        className={caixa}
      />
    );
  }

  if (midia.tipo === "ilustracao") {
    /*
     * SPEC §15.2 e §22.2 item 6: sete exercícios têm ilustração só
     * **aproximada** (a coleção livre não tem aquele movimento exato). A nota
     * que explica a diferença está em `data/ilustracoes.json` — nada de texto
     * escrito aqui — e vira a segunda linha da legenda.
     */
    const nota = notaDaIlustracao(exercicioId);
    return (
      <figure className="flex flex-col gap-1">
        <IlustracaoAlternada
          urls={midia.urls}
          alt={midia.alt}
          largura={midia.largura}
          altura={midia.altura}
          className={cn("h-40", className)}
        />
        {!semCredito && (midia.credito || nota) ? (
          <figcaption className="text-muted-foreground flex flex-col px-1 text-[11px] leading-tight">
            {/* o texto continua em 11 px; a caixa de toque é de 44 px (§13.8.1) */}
            {midia.credito ? (
              <a
                href={midia.credito.url_fonte}
                target="_blank"
                rel="noreferrer noopener"
                className="alvo inline-flex items-center underline underline-offset-2"
              >
                {midia.credito.texto}
              </a>
            ) : null}
            {nota ? (
              <span data-nota-ilustracao={exercicioId} className="text-balance">
                {nota}
              </span>
            ) : null}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  if (midia.tipo === "figura" && !figuraQuebrou) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- SVG animado de /public: o next/image rasteriza e mata a animação
      <img
        src={midia.urls[0]}
        alt={midia.alt}
        loading="lazy"
        decoding="async"
        className={cn(caixa, "p-2")}
        onError={() => setFiguraQuebrou(true)}
      />
    );
  }

  // figura quebrada no navegador: cai na foto de início, se houver
  const foto =
    midia.tipo === "foto"
      ? midia
      : midiaGrande(exercicioId, { temVideo, tipo: "foto", semFoto });
  if (!foto || foto.tipo !== "foto") return null;

  // a derivada WebP (SPEC §22.4 item 1), com o JPEG do kit de reserva
  const fonte = fonteComReserva(foto.urls[0]!, urlWebp(foto.urls[0]));

  return (
    // eslint-disable-next-line @next/next/no-img-element -- foto local em /public
    <img
      src={fonte.src}
      data-reserva={fonte.reserva}
      onError={reservaDaImagem}
      alt={foto.alt}
      loading="lazy"
      decoding="async"
      className={cn(caixa, "object-cover")}
    />
  );
}
