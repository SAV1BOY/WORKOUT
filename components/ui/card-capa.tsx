"use client";

import { useState, type ReactNode } from "react";
import { Raios } from "@/components/ui/raios";
import type { Raios as NivelDeRaios } from "@/lib/dificuldade";
import { cn } from "@/lib/utils";

/**
 * Card com capa em foto e gradiente escuro (SPEC §13.1 e §13.3): a foto vem de
 * `assets/` (foto de execução ou figura), o texto fica por cima do gradiente e
 * o conteúdo do card entra embaixo.
 *
 * Sem foto, a capa é um gradiente com o ícone da própria tela — nunca uma
 * imagem de terceiros.
 */
export function CardCapa({
  titulo,
  subtitulo,
  detalhe,
  foto,
  icone,
  raios,
  etiqueta,
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
  altura?: "baixa" | "media";
  children?: ReactNode;
  className?: string;
}) {
  const [quebrou, setQuebrou] = useState(false);
  const comFoto = Boolean(foto) && !quebrou;

  return (
    <article
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
            src={foto ?? ""}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
            onError={() => setQuebrou(true)}
          />
        ) : icone ? (
          <span className="text-primary/70 absolute inset-0 flex items-center justify-center">
            {icone}
          </span>
        ) : null}

        <div className="capa-gradiente absolute inset-0" />

        {etiqueta ? (
          <span className="bg-primary text-primary-foreground absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase">
            {etiqueta}
          </span>
        ) : null}

        <div
          className={cn(
            "relative flex flex-col gap-1 p-4 text-white",
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
