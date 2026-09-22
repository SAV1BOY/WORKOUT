"use client";

import {
  CalendarRange,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  type LucideIcon,
  Timer,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Raios } from "@/components/ui/raios";
import { hrefDaColecao, type Colecao, type TipoColecao } from "@/lib/colecoes";
import { urlMiniatura } from "@/lib/midia";
import { cn } from "@/lib/utils";

/**
 * Sem foto, o que distingue a linha a 56 px é o ícone do tipo (SPEC §22.9
 * item 7). Um ícone por tipo, nenhum inventado fora do que a coleção é.
 */
const ICONE_DO_TIPO: Record<TipoColecao, LucideIcon> = {
  grupo: Dumbbell,
  aparelho: Wrench,
  circuito: Timer,
  plano: CalendarRange,
  treino: HeartPulse,
};

/**
 * O tom da capa sem foto: quatro superfícies do tema (nenhuma cor nova, o
 * app é sóbrio), escolhidas por um hash do id — então a mesma coleção tem
 * sempre o mesmo tom, nos dois temas.
 */
const TONS = [
  "bg-primary/10 text-primary",
  "bg-muted text-muted-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-accent text-accent-foreground",
] as const;

export function tomDaCapa(id: string): string {
  let soma = 0;
  for (let i = 0; i < id.length; i += 1) soma = (soma * 31 + id.charCodeAt(i)) % 997;
  return TONS[soma % TONS.length] ?? TONS[1];
}

/**
 * Uma coleção na vitrine (SPEC §14.4 e §22.12 item 2): capa de `assets/`,
 * título, subtítulo, motivo da busca, a meta e os raios. O toque abre a tela
 * da coleção.
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
      title={[colecao.titulo, colecao.subtitulo, colecao.motivoDaBusca]
        .filter(Boolean)
        .join(" · ")}
      className={cn(
        "hover:bg-muted/40 alvo flex items-center gap-3 rounded-xl py-2 text-left",
        className,
      )}
    >
      <CapaPequena
        foto={colecao.capa}
        icone={ICONE_DO_TIPO[colecao.tipo]}
        tom={tomDaCapa(colecao.id)}
      />
      {/*
        SPEC §22.12 item 2: a linha lê de cima para baixo — título, subtítulo
        descritivo, o motivo da busca (quando veio de um exercício) e a meta
        por último. Só o título tem peso; o resto é `muted` em peso normal
        (`tabular-nums` sem o `.numero`, que é negrito).
      */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 text-sm font-medium text-balance" data-linha="titulo">
            {colecao.titulo}
          </span>
          {mostrarRaios && colecao.raios ? (
            <Raios nivel={colecao.raios} tamanho="sm" className="text-primary shrink-0" />
          ) : null}
        </span>
        {colecao.subtitulo ? (
          <span className="text-muted-foreground line-clamp-1 text-xs" data-linha="subtitulo">
            {colecao.subtitulo}
          </span>
        ) : null}
        {colecao.motivoDaBusca ? (
          <span className="text-muted-foreground line-clamp-2 text-xs" data-linha="motivo">
            {colecao.motivoDaBusca}
          </span>
        ) : null}
        {/*
          SPEC §22.12 item 4: o plano sem perfil cujo objetivo já diz o prazo
          não tem meta — a linha acaba no subtítulo, sem um vão vazio.
        */}
        {colecao.detalhe || colecao.circuito ? (
          <span
            className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs font-normal tabular-nums"
            data-linha="meta"
          >
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
        ) : null}
      </span>
      <ChevronRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
    </Link>
  );
}

/**
 * A capa pequena da linha: foto de `assets/` ou o ícone, nunca outra coisa.
 * SPEC §22.4 item 1: a caixa tem 56 px, então quem vem é a derivada de 112 —
 * 2,4 kB no lugar dos 70 kB do JPEG inteiro; o original fica de reserva.
 */
export function CapaPequena({
  foto,
  icone: Icone = Dumbbell,
  tom,
}: {
  foto: string | null;
  /** O ícone da reserva, quando não há foto (SPEC §22.9 item 7). */
  icone?: LucideIcon;
  /** As classes de fundo e de traço da reserva. */
  tom?: string;
}) {
  const [quebrou, setQuebrou] = useState(false);
  const mostrar = foto !== null && !quebrou;
  const mini = urlMiniatura(foto);
  return (
    <span
      className={cn(
        "relative block size-14 shrink-0 overflow-hidden rounded-xl",
        mostrar ? "bg-muted/60" : (tom ?? "bg-muted/60"),
      )}
    >
      {mostrar ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto local em /public, miniatura de tamanho fixo
        <img
          src={mini ?? foto}
          data-reserva={mini ? foto : undefined}
          alt=""
          aria-hidden="true"
          width={112}
          height={112}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={(evento) => {
            // primeiro a derivada, depois o arquivo do kit, e só então o ícone
            const img = evento.currentTarget;
            const reserva = img.dataset.reserva;
            if (reserva) {
              delete img.dataset.reserva;
              img.src = reserva;
              return;
            }
            setQuebrou(true);
          }}
        />
      ) : (
        <span className="flex size-full items-center justify-center">
          <Icone aria-hidden="true" className="size-5" />
        </span>
      )}
    </span>
  );
}
