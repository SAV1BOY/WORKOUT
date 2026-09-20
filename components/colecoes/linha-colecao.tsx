"use client";

import { ChevronRight, Dumbbell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Raios } from "@/components/ui/raios";
import { hrefDaColecao, type Colecao } from "@/lib/colecoes";
import { cn } from "@/lib/utils";

/**
 * Uma coleção na vitrine (SPEC §14.4): capa de `assets/`, título, `N
 * exercícios · ~M min` e os raios. O toque abre a tela da coleção.
 */
export function LinhaColecao({
  colecao,
  mostrarRaios = true,
  className,
}: {
  colecao: Colecao;
  mostrarRaios?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={hrefDaColecao(colecao)}
      data-colecao={colecao.id}
      /*
        SPEC §22.3 item 11: o subtítulo é cortado numa linha só; o texto
        inteiro fica no `title` do link, sem `aria-label` — ele apagaria o
        selo "Circuito" e o detalhe do nome acessível.
      */
      title={[colecao.titulo, colecao.subtitulo].filter(Boolean).join(" · ")}
      className={cn(
        "hover:bg-muted/40 alvo flex items-center gap-3 rounded-xl py-2 text-left",
        className,
      )}
    >
      <CapaPequena foto={colecao.capa} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 text-sm font-medium text-balance">
            {colecao.titulo}
          </span>
          {mostrarRaios && colecao.raios ? (
            <Raios nivel={colecao.raios} tamanho="sm" className="text-primary shrink-0" />
          ) : null}
        </span>
        <span className="numero text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
          {colecao.detalhe}
          {/*
            SPEC §13.6 e §22.2 item 9: a coleção em que TODO exercício serve
            para circuito (`podeCircuito`) avisa aqui — o campo era calculado e
            só os testes liam. Selo sem cor forte: é informação, não promoção.
          */}
          {colecao.circuito ? (
            <span
              data-selo="circuito"
              className="border-border rounded-full border px-1.5 py-px text-micro tracking-wide uppercase"
            >
              Circuito
            </span>
          ) : null}
        </span>
        {colecao.subtitulo ? (
          <span className="text-muted-foreground line-clamp-1 text-xs">
            {colecao.subtitulo}
          </span>
        ) : null}
      </span>
      <ChevronRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
    </Link>
  );
}

/** A capa pequena da linha: foto de `assets/` ou o ícone, nunca outra coisa. */
export function CapaPequena({ foto }: { foto: string | null }) {
  const [quebrou, setQuebrou] = useState(false);
  const mostrar = foto !== null && !quebrou;
  return (
    <span className="bg-muted/60 relative block size-14 shrink-0 overflow-hidden rounded-xl">
      {mostrar ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto local em /public, miniatura de tamanho fixo
        <img
          src={foto}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="size-full object-cover"
          onError={() => setQuebrou(true)}
        />
      ) : (
        <span className="text-muted-foreground flex size-full items-center justify-center">
          <Dumbbell aria-hidden="true" className="size-5" />
        </span>
      )}
    </span>
  );
}
