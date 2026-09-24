"use client";

import { useState } from "react";
import { IlustracaoAlternada } from "@/components/exercicio/ilustracao-alternada";
import { fonteComReserva, reservaDaImagem } from "@/components/ui/imagem";
import {
  caixaDaIlustracao,
  MEDIDA_DA_FIGURA,
  medidaDaFoto,
  midiaGrande,
  notaDaIlustracao,
  urlDaLicenca,
  urlWebp,
  type TipoDeMidia,
} from "@/lib/midia";
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
  proporcional = false,
  aoAbrir,
  rotuloDoAbrir,
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
  /**
   * SPEC §22.13 item 1: na ficha, a caixa da ilustração tem a proporção da
   * ilustração (teto de altura em `lib/midia.ts`), não a altura do
   * `className`. O player e a capa do bloco têm espaço vertical fixo e não
   * usam.
   */
  proporcional?: boolean;
  /** Tocar na ilustração abre o "Como fazer" (SPEC §22.13 item 5). */
  aoAbrir?: () => void;
  rotuloDoAbrir?: string;
  className?: string;
}) {
  const midia = midiaGrande(exercicioId, { temVideo, tipo, semFoto });
  /*
   * SPEC §22.15 item 2: guarda QUAL figura falhou, não "uma figura falhou".
   * A ficha no player troca de exercício no lugar (‹ ›, "Substituir") sem
   * remontar esta mídia; com um booleano, a figura de A quebrada fazia a de B
   * nem ser tentada, e a tela caía direto na foto de B.
   */
  const [figuraQuebrada, setFiguraQuebrada] = useState<string | null>(null);
  const figuraQuebrou =
    midia?.tipo === "figura" && figuraQuebrada !== null && figuraQuebrada === midia.urls[0];

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
    const medida =
      proporcional && midia.largura && midia.altura
        ? caixaDaIlustracao({ largura: midia.largura, altura: midia.altura })
        : null;
    const licenca = midia.credito ? urlDaLicenca(midia.credito.licenca) : null;
    return (
      <figure className="flex flex-col gap-1">
        <IlustracaoAlternada
          /*
            Correção da auditoria 3 (SPEC §22.13 item 4): a ficha no player
            troca de exercício no lugar (‹ ›, "Substituir"). Com a chave nos
            quadros, a ilustração nova nasce de novo — posição 1, o quadro 2
            esperando o 1 — em vez de herdar o estado da anterior.
          */
          key={midia.urls.join("|")}
          urls={midia.urls}
          alt={midia.alt}
          largura={midia.largura}
          altura={midia.altura}
          proporcao={medida?.proporcao}
          larguraMaxima={medida?.larguraMaxima}
          aoAbrir={aoAbrir}
          rotuloDoAbrir={rotuloDoAbrir}
          className={medida ? undefined : cn("h-40", className)}
        />
        {!semCredito && (midia.credito || nota) ? (
          <figcaption className="text-muted-foreground flex flex-col px-1 text-rotulo leading-tight">
            {/*
              SPEC §22.13 item 3: "Ilustração: <autor> · <licença>" — só os
              dois links são sublinhados; o texto continua em 11 px e cada
              link tem caixa de toque de 44 px (§13.8.1).
            */}
            {midia.credito ? (
              <span className="flex flex-wrap items-center gap-x-1" data-credito>
                <span>Ilustração:</span>
                <a
                  href={midia.credito.url_fonte}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="alvo text-foreground inline-flex items-center underline underline-offset-2"
                >
                  {midia.credito.autor}
                </a>
                <span aria-hidden="true">·</span>
                {licenca ? (
                  <a
                    href={licenca}
                    target="_blank"
                    rel="noreferrer noopener license"
                    className="alvo text-foreground inline-flex items-center underline underline-offset-2"
                  >
                    {midia.credito.licenca}
                  </a>
                ) : (
                  <span>{midia.credito.licenca}</span>
                )}
              </span>
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
        width={MEDIDA_DA_FIGURA.largura}
        height={MEDIDA_DA_FIGURA.altura}
        loading="lazy"
        decoding="async"
        className={cn(caixa, "p-2")}
        onError={() => setFiguraQuebrada(midia.urls[0] ?? null)}
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
  // a medida do arquivo pedido, foto a foto (SPEC §22.4 item 3)
  const medida = medidaDaFoto(fonte.src);
  /*
   * SPEC §22.13 item 2 (correção da auditoria 2): três exercícios só têm foto
   * (escalador, salto básico e corrida no lugar com a corda) e ela vem na
   * faixa do player e da Visão geral (328 × 160, 2:1). `object-cover` cortava
   * a foto de 3:2; `object-contain` mostra a foto inteira na faixa.
   */

  return (
    // eslint-disable-next-line @next/next/no-img-element -- foto local em /public
    <img
      src={fonte.src}
      data-reserva={fonte.reserva}
      onError={reservaDaImagem}
      alt={foto.alt}
      width={medida?.largura}
      height={medida?.altura}
      loading="lazy"
      decoding="async"
      className={caixa}
    />
  );
}
