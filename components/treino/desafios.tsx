"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CapaPequena } from "@/components/colecoes/linha-colecao";
import { BotaoLargo } from "@/components/ui/botao-largo";
import {
  progressoDoDesafio,
  semanasConcluidasDoDesafio,
  type Desafio,
} from "@/lib/colecoes";

/**
 * Desafios (SPEC §14.3): carrossel **manual** (sem rotação automática) com os
 * planos reais — os dois de `cardio.json` e a fase do `programa.json` —, cada
 * um com a semana de hoje, a barra de progresso e o botão da sessão da semana.
 */
export function Desafios({ desafios }: { desafios: Desafio[] }) {
  const refLista = useRef<HTMLUListElement>(null);
  const [atual, setAtual] = useState(0);

  if (desafios.length === 0) return null;

  /*
   * SPEC §22.7 item 6: o carrossel não dizia que tinha três. A posição sai da
   * própria rolagem — cada card ocupa uma fatia igual da lista.
   */
  const aoRolar = () => {
    const lista = refLista.current;
    if (!lista) return;
    const fatia = lista.scrollWidth / desafios.length;
    const indice = Math.round(lista.scrollLeft / Math.max(fatia, 1));
    setAtual(Math.min(Math.max(indice, 0), desafios.length - 1));
  };

  return (
    <section aria-label="Desafios" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Desafios</h2>
        <p className="numero text-muted-foreground text-xs" data-desafios-posicao>
          {atual + 1} de {desafios.length}
        </p>
      </div>
      {/*
        Rolagem horizontal com parada em cada card (scroll-snap). A margem
        negativa deixa o card encostar na borda da tela a 360 px sem tirar o
        respiro do conteúdo ao redor.
      */}
      <ul
        ref={refLista}
        aria-label="Desafios"
        onScroll={aoRolar}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1"
      >
        {desafios.map((d) => (
          <li
            key={d.id}
            data-desafio={d.id}
            className="w-[min(19rem,86vw)] shrink-0 snap-start"
          >
            <CardDoDesafio desafio={d} />
          </li>
        ))}
      </ul>
      <div aria-hidden="true" className="flex items-center justify-center gap-1.5">
        {desafios.map((d, i) => (
          <span
            key={d.id}
            data-ponto={i === atual ? "ativo" : "inativo"}
            className={
              i === atual
                ? "bg-primary size-1.5 rounded-full"
                : "bg-muted-foreground/40 size-1.5 rounded-full"
            }
          />
        ))}
      </div>
    </section>
  );
}

/**
 * O CTA diz o destino (SPEC §22.7 item 6): três cards iguais dizendo "Fazer a
 * sessão da semana" não distinguem para onde cada um leva. O texto sai dos
 * dados do próprio desafio — nada escrito à mão sobre o conteúdo do treino.
 */
function acaoDoDesafio(desafio: Desafio): string {
  if (desafio.id === "barra_fixa") return "Fazer a sessão de barra fixa";
  if (desafio.id === "corrida") return `Fazer a corrida da semana ${desafio.semanaAtual}`;
  if (desafio.id === "fase") {
    const [curto] = desafio.titulo.split("—");
    return `Fazer o treino da ${(curto ?? desafio.titulo).trim().toLowerCase()}`;
  }
  return desafio.acao;
}

function CardDoDesafio({ desafio }: { desafio: Desafio }) {
  const fracao = progressoDoDesafio(desafio);
  const porcento = Math.round(fracao * 100);
  /*
   * SPEC §22.2 item 8: a barra mede as semanas CONCLUÍDAS, então o rótulo diz
   * as duas coisas — em que semana ele está e quantas já fechou. Antes o card
   * dizia "Semana 3 de 12" com a barra em 17 %, e as duas leituras brigavam.
   */
  const concluidas = semanasConcluidasDoDesafio(desafio);

  return (
    <article className="cartao border-border bg-card flex h-full flex-col gap-3 border p-3">
      <div className="flex items-start gap-3">
        <CapaPequena foto={desafio.capa} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-sm leading-tight font-semibold text-balance">
            {desafio.titulo}
          </h3>
          {desafio.subtitulo ? (
            <p
              className="text-muted-foreground line-clamp-2 text-xs text-balance"
              title={desafio.subtitulo}
            >
              {desafio.subtitulo}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="numero text-muted-foreground flex items-baseline justify-between text-xs">
          <span>
            Semana {desafio.semanaAtual} de {desafio.semanas} · {concluidas}{" "}
            {concluidas === 1 ? "concluída" : "concluídas"}
          </span>
          <span>{porcento}%</span>
        </p>
        <div
          role="progressbar"
          aria-valuenow={concluidas}
          aria-valuemin={0}
          aria-valuemax={desafio.semanas}
          aria-label={`Progresso: ${concluidas} de ${desafio.semanas} semanas concluídas`}
          className="bg-muted h-2 w-full overflow-hidden rounded-full"
        >
          <div className="bg-primary h-full" style={{ width: `${porcento}%` }} />
        </div>
      </div>

      {/* `mt-auto`: o subtítulo de duas linhas empurrava o CTA, que pulava de
          altura de um card para o outro ao deslizar (SPEC §22.7 item 6) */}
      <BotaoLargo asChild variant="outline" className="mt-auto h-12 text-sm">
        <Link href={desafio.href}>{acaoDoDesafio(desafio)}</Link>
      </BotaoLargo>
    </article>
  );
}
