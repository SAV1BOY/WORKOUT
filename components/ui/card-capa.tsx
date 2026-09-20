"use client";

import { useState, type ReactNode } from "react";
import { Raios } from "@/components/ui/raios";
import { urlCapa } from "@/lib/capas";
import type { Raios as NivelDeRaios } from "@/lib/dificuldade";
import { cn } from "@/lib/utils";

/**
 * Card com capa em foto e gradiente escuro (SPEC §13.1 e §13.3): a foto vem de
 * `assets/` (foto de execução ou figura), o texto fica por cima do gradiente e
 * o conteúdo do card entra embaixo.
 *
 * Sem foto, a capa é um gradiente com o ícone da própria tela — nunca uma
 * imagem de terceiros.
 *
 * SPEC §22.4 itens 1 e 3: a imagem pedida é a derivada de 720×360 (2,2× a
 * caixa de 326×160), com o JPEG original de reserva; a capa da primeira dobra
 * carrega `eager` com prioridade alta e as outras ficam `lazy`.
 */

/** Tamanho da derivada da capa — 2× a caixa, arredondado para 2:1. */
const CAPA = { largura: 720, altura: 360 };
export function CardCapa({
  titulo,
  subtitulo,
  detalhe,
  foto,
  icone,
  raios,
  etiqueta,
  prioridade,
  altura = "media",
  children,
  className,
}: {
  titulo: string;
  subtitulo?: string | null;
  detalhe?: ReactNode;
  foto?: string | null;
  icone?: ReactNode;
  raios?: NivelDeRaios | null;
  /** Selo no alto da capa ("hoje", "em andamento"). */
  etiqueta?: string | null;
  /**
   * Primeira dobra: carrega na hora, com prioridade alta. O padrão é a
   * presença do selo — em todas as telas do app o cartão etiquetado ("hoje",
   * "em andamento") é justamente o primeiro, e só ele; os outros ficam `lazy`.
   */
  prioridade?: boolean;
  altura?: "baixa" | "media";
  children?: ReactNode;
  className?: string;
}) {
  /** 0 = derivada da capa · 1 = foto original · 2 = desisti, fica o gradiente. */
  const [queda, setQueda] = useState(0);
  const derivada = urlCapa(foto);
  const fonte = queda === 0 ? (derivada ?? foto) : queda === 1 ? foto : null;
  const comFoto = Boolean(fonte);
  const naPrimeiraDobra = prioridade ?? Boolean(etiqueta);

  return (
    <article
      data-capa={titulo}
      className={cn(
        "cartao border-border bg-card overflow-hidden border",
        className,
      )}
    >
      {/*
        A capa cresce com o texto (`min-h`, não `h`): um título ou um subtítulo
        de duas linhas empurrava a caixa de texto para fora da foto e ela subia
        por cima do selo "hoje" (auditoria do marco V1).
      */}
      <div
        className={cn(
          "relative flex w-full flex-col justify-end",
          altura === "baixa" ? "min-h-28" : "min-h-40",
          comFoto ? "bg-muted" : "from-primary/25 to-card bg-gradient-to-br",
        )}
      >
        {comFoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto local em /public, capa de tamanho fixo
          <img
            src={fonte ?? ""}
            alt=""
            aria-hidden="true"
            width={CAPA.largura}
            height={CAPA.altura}
            loading={naPrimeiraDobra ? "eager" : "lazy"}
            fetchPriority={naPrimeiraDobra ? "high" : "auto"}
            decoding={naPrimeiraDobra ? "sync" : "async"}
            className="absolute inset-0 size-full object-cover"
            onError={() => setQueda((q) => q + 1)}
          />
        ) : icone ? (
          <span className="text-primary/70 absolute inset-0 flex items-center justify-center">
            {icone}
          </span>
        ) : null}

        <div className="capa-gradiente absolute inset-0" />

        {/*
          `z-10`: o véu do bloco de texto vem depois no DOM e, sem camada, era
          pintado por cima do selo — o "hoje"/"em andamento" aparecia cortado ao
          meio por uma linha reta, com a metade de baixo 32 % mais escura
          (auditoria do lote 2).
        */}
        {etiqueta ? (
          <span className="bg-primary text-primary-foreground absolute top-3 left-3 z-10 rounded-full px-2.5 py-1 text-rotulo font-semibold tracking-wide uppercase">
            {etiqueta}
          </span>
        ) : null}

        {/*
          SPEC §22.2 item 10: o texto é branco, então ele carrega o próprio véu
          escuro. O gradiente da capa (`--capa-*`) é decorativo e some quando o
          cartão não tem foto — no tema claro o título ficava branco sobre o
          cartão claro, 1,13:1. Com o véu, os dois temas passam de 4,5:1.

          A cor é escrita à mão (`rgb(10 10 10 / 0.68)`, o mesmo preto dos
          tokens `--capa-*`) e não `bg-black/68`: o utilitário de opacidade do
          Tailwind 4 vira `color-mix(in oklab, …)`, que o navegador devolve
          como `color(srgb …)` — e as réguas de contraste (a auditoria e a
          varredura) leem `rgb()`/`rgba()`. Com o utilitário, o véu existia na
          tela mas era invisível para a medição, que continuava acusando 1,13:1.

          `.veu-capa` corta a borda de cima com uma máscara de 28 px: sem ela o
          véu entrava na capa com uma linha reta e dura, que atravessava o
          cartão por cima da foto. A máscara não mexe no `background-color`
          computado, então as réguas continuam medindo os mesmos 0,68 de preto.
        */}
        <div
          className={cn(
            "veu-capa relative flex flex-col gap-1 bg-[rgb(10_10_10_/_0.68)] p-4 text-white",
            // espaço para o selo, que fica no alto da capa
            etiqueta && "pt-12",
          )}
        >
          <h2 className="text-xl leading-tight font-semibold text-balance">
            {titulo}
          </h2>
          {subtitulo ? (
            <p className="text-sm text-white/80 text-balance">{subtitulo}</p>
          ) : null}
          {detalhe || raios ? (
            <p className="numero flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/90">
              {detalhe}
              {raios ? <Raios nivel={raios} tamanho="sm" /> : null}
            </p>
          ) : null}
        </div>
      </div>

      {children ? <div className="flex flex-col gap-3 p-4">{children}</div> : null}
    </article>
  );
}
