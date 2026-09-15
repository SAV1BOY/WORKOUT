"use client";

import Link from "next/link";
import { CapaPequena } from "@/components/colecoes/linha-colecao";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { progressoDoDesafio, type Desafio } from "@/lib/colecoes";

/**
 * Desafios (SPEC §14.3): carrossel **manual** (sem rotação automática) com os
 * planos reais — os dois de `cardio.json` e a fase do `programa.json` —, cada
 * um com a semana de hoje, a barra de progresso e o botão da sessão da semana.
 */
export function Desafios({ desafios }: { desafios: Desafio[] }) {
  if (desafios.length === 0) return null;

  return (
    <section aria-label="Desafios" className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">Desafios</h2>
      {/*
        Rolagem horizontal com parada em cada card (scroll-snap). A margem
        negativa deixa o card encostar na borda da tela a 360 px sem tirar o
        respiro do conteúdo ao redor.
      */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {desafios.map((d) => (
          <li
            key={d.id}
            data-desafio={d.id}
            className="w-[min(19rem,85vw)] shrink-0 snap-start"
          >
            <CardDoDesafio desafio={d} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CardDoDesafio({ desafio }: { desafio: Desafio }) {
  const fracao = progressoDoDesafio(desafio);
  const porcento = Math.round(fracao * 100);

  return (
    <article className="cartao border-border bg-card flex h-full flex-col gap-3 border p-3">
      <div className="flex items-start gap-3">
        <CapaPequena foto={desafio.capa} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-sm leading-tight font-semibold text-balance">
            {desafio.titulo}
          </h3>
          {desafio.subtitulo ? (
            <p className="text-muted-foreground line-clamp-2 text-xs text-balance">
              {desafio.subtitulo}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="numero text-muted-foreground flex items-baseline justify-between text-xs">
          <span>
            Semana {desafio.semanaAtual} de {desafio.semanas}
          </span>
          <span>{porcento}%</span>
        </p>
        <div
          role="progressbar"
          aria-valuenow={desafio.semanaAtual}
          aria-valuemin={1}
          aria-valuemax={desafio.semanas}
          aria-label={`Progresso: semana ${desafio.semanaAtual} de ${desafio.semanas}`}
          className="bg-muted h-2 w-full overflow-hidden rounded-full"
        >
          <div className="bg-primary h-full" style={{ width: `${porcento}%` }} />
        </div>
      </div>

      <BotaoLargo asChild variant="outline" className="h-12 text-sm">
        <Link href={desafio.href}>{desafio.acao}</Link>
      </BotaoLargo>
    </article>
  );
}
