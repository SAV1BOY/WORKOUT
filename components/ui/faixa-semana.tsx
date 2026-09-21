"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { DiaDaFaixa } from "@/lib/semana";
import { cn } from "@/lib/utils";

/**
 * A faixa da semana (SPEC §13.3): seg–dom, hoje em destaque, ✓ nos dias
 * feitos, anel nos que faltam fazer, cinza no que faltou. Os dias entram de
 * `faixaDaSemana()` — este componente só desenha.
 *
 * Com `href` a faixa inteira leva ao calendário; com `aoVoltar`/`aoAvancar`
 * ela ganha as setas de navegação por semana (Relatório, §13.5).
 */
export function FaixaSemana({
  dias,
  href,
  rotulo,
  aoVoltar,
  aoAvancar,
  className,
}: {
  dias: DiaDaFaixa[];
  href?: string;
  /** "15 a 21/09" — só aparece quando a faixa é navegável. */
  rotulo?: string;
  aoVoltar?: () => void;
  aoAvancar?: () => void;
  className?: string;
}) {
  const navegavel = Boolean(aoVoltar || aoAvancar);

  /*
   * SPEC §22.8 item 3: eram sete colunas `flex-1` cuja largura mínima era a
   * do texto ("Corr.", "Longa"), e a 200 % de zoom — 180 px efetivos — a
   * faixa media 264 px e empurrava a PÁGINA para o lado. Agora ela é um
   * carrossel, o mesmo padrão dos desafios: a 360 px as sete casas ainda
   * preenchem a largura (7 × `min-w-9` = 252 px cabem de sobra) e nada rola;
   * abaixo disso quem rola é a faixa.
   */
  const grade = (
    <ol className="flex snap-x snap-mandatory items-stretch gap-1 overflow-x-auto">
      {dias.map((dia) => (
        <li key={dia.data} className="min-w-9 flex-1 snap-start">
          {/*
            SPEC §22.3 item 11: sem `title` — tooltip não existe no celular, e
            o dia inteiro ("Quarta 16/09: Treino A, feito") já é o nome
            acessível do próprio item. Texto `sr-only` foi tentado e
            descartado: ele entra no `getByText` como texto da página.
          */}
          <span
            role="img"
            aria-label={dia.titulo}
            data-dia={dia.data}
            data-marca={dia.ehHoje ? "hoje" : dia.marca}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl px-0.5 py-1.5",
              dia.ehHoje && "bg-primary/15 ring-primary/50 ring-1",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "text-rotulo leading-none",
                dia.ehHoje ? "text-primary font-semibold" : "text-muted-foreground",
              )}
            >
              {dia.rotulo}
            </span>
            <Marca marca={dia.marca} ehHoje={dia.ehHoje} />
            <span
              aria-hidden="true"
              className={cn(
                "numero text-rotulo leading-none",
                dia.ehHoje ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {dia.numero}
            </span>
            {/*
              SPEC §16.3: sob o número, o treino daquele dia — a sigla da força
              ("A", "B", "SA"…), o cardio ("Corr.", "Corda", "Longa") ou
              "Desc.". O nome completo vai no title/aria-label do dia.
            */}
            <span
              aria-hidden="true"
              className={cn(
                "text-rotulo leading-none font-medium",
                dia.ehHoje ? "text-primary" : "text-muted-foreground/80",
              )}
            >
              {dia.treino}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );

  const miolo = href ? (
    <Link
      href={href}
      aria-label="Abrir o calendário da semana"
      className="hover:bg-muted/40 alvo block rounded-2xl px-1 py-1"
    >
      {grade}
    </Link>
  ) : (
    <div className="px-1 py-1">{grade}</div>
  );

  return (
    <section
      aria-label="Semana"
      className={cn("cartao border-border bg-card border p-1.5", className)}
    >
      {navegavel ? (
        <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-0.5">
          <button
            type="button"
            onClick={aoVoltar}
            aria-label="Semana anterior"
            disabled={!aoVoltar}
            className="alvo text-muted-foreground hover:text-foreground flex items-center justify-center rounded-lg disabled:opacity-40"
          >
            <ChevronLeft className="size-5" />
          </button>
          <span className="numero text-sm">{rotulo}</span>
          <button
            type="button"
            onClick={aoAvancar}
            aria-label="Próxima semana"
            disabled={!aoAvancar}
            className="alvo text-muted-foreground hover:text-foreground flex items-center justify-center rounded-lg disabled:opacity-40"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      ) : null}
      {miolo}
    </section>
  );
}

/**
 * Um desenho por marca, e cada desenho com um SÓ significado — é isso que a
 * legenda de `LEGENDA_DA_FAIXA` promete (SPEC §22.6 item 9):
 *
 *   ✓ feito · ◉ parcial · ○ a fazer · ● faltou · — descanso
 *
 * O dia de HOJE ainda por fazer era a exceção que estragava a promessa: ele
 * vinha como ponto CHEIO na cor primária, o mesmo desenho de "faltou" (só que
 * colorido), e é o estado mais comum da tela — todo dia, até o treino sair.
 * Hoje por fazer é agora o mesmo ANEL dos outros dias por fazer, na cor
 * primária; quem diz que o dia é hoje é o realce do ladrilho inteiro
 * (`bg-primary/15` + `ring`), não a forma da marca.
 *
 * `data-glifo` leva a marca de verdade: no `<li>` o `data-marca` de hoje vira
 * "hoje" e esconde qual era o estado.
 *
 * SPEC §22.8 item 4: a CAIXA é a mesma para os cinco — 20 × 20 —, e só o que
 * há dentro muda (disco cheio com ✓ de 12 px, anel de 20 px com miolo de
 * 8 px, anel de 10 px, disco de 10 px, traço de 10 × 2). Antes "feito" e
 * "parcial" pintavam 24 px e o resto 8–10 px: sete marcadores, sete pesos
 * diferentes, sem uma linha de base comum.
 */
function Marca({ marca, ehHoje }: { marca: DiaDaFaixa["marca"]; ehHoje: boolean }) {
  if (marca === "feito") {
    return (
      <span
        data-glifo="feito"
        className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full"
      >
        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (marca === "parcial") {
    return (
      <span
        data-glifo="parcial"
        className="border-primary flex size-5 items-center justify-center rounded-full border-2"
      >
        <span aria-hidden="true" className="bg-primary size-2 rounded-full" />
      </span>
    );
  }
  if (marca === "descanso") {
    return (
      <span data-glifo="descanso" className="flex size-5 items-center justify-center">
        <span aria-hidden="true" className="bg-border h-0.5 w-2.5 rounded-full" />
      </span>
    );
  }
  if (marca === "faltou") {
    return (
      <span data-glifo="faltou" className="flex size-5 items-center justify-center">
        <span aria-hidden="true" className="bg-muted-foreground/40 size-2.5 rounded-full" />
      </span>
    );
  }
  // aberto: anel, hoje ou não
  return (
    <span data-glifo="aberto" className="flex size-5 items-center justify-center">
      <span
        aria-hidden="true"
        className={cn(
          "size-2.5 rounded-full border-2",
          ehHoje ? "border-primary" : "border-muted-foreground/60",
        )}
      />
    </span>
  );
}
