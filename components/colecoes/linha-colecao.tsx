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
 * item 7). Um ícone por tipo, nenhum inventado fora do que a coleção é. A
 * capa grande da tela da coleção usa o mesmo (SPEC §22.13 item 8).
 */
export const ICONE_DO_TIPO: Record<TipoColecao, LucideIcon> = {
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
  /*
    SPEC §22.12 item 4: a linha sem meta (o plano sem perfil cujo objetivo já
    diz o prazo) acaba no subtítulo, e ele aparece inteiro — cortado numa
    linha, escondia "8–12 semanas" e "12 semanas", o único prazo da linha.
  */
  const temMeta = Boolean(colecao.detalhe);
  const raios = mostrarRaios ? colecao.raios : null;
  /*
    SPEC §13.6 e §22.2 item 9: a coleção em que TODO exercício serve para
    circuito (`podeCircuito`) avisa com um selo discreto — informação, não
    promoção. 16 px de altura, a mesma da linha em que ele entra.
  */
  const selo = colecao.circuito ? (
    <span
      data-selo="circuito"
      className="border-border text-muted-foreground mr-1.5 inline-block rounded-full border px-1.5 align-top text-micro leading-[14px] tracking-wide uppercase"
    >
      Circuito
    </span>
  ) : null;
  return (
    <Link
      href={hrefDaColecao(colecao)}
      data-colecao={colecao.id}
      /*
        SPEC §22.3 item 11: o subtítulo é cortado numa linha só (menos na
        linha sem meta, §22.12 item 4); o texto inteiro fica no `title` do link, sem `aria-label` — ele apagaria o
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
        {/*
          SPEC §22.13 item 10: a linha do título tem só o título — os raios
          ficavam ao lado dele, no canto de cima, desalinhados do chevron, e
          agora moram na linha da meta.
        */}
        <span className="flex items-center">
          <span className="min-w-0 flex-1 text-sm font-medium text-balance" data-linha="titulo">
            {colecao.titulo}
          </span>
        </span>
        {/*
          SPEC §22.13 item 7: a linha do subtítulo é reservada em toda linha,
          com ou sem texto — as linhas da mesma seção mediam 72 ou 92 px
          conforme a coleção tinha subtítulo. O selo "Circuito" abre esta
          linha (§22.13 item 10): na meta, com os raios, ela quebrava a 360 px,
          e ao lado do título ele empurrava o nome do aparelho para 2 linhas.
        */}
        {colecao.subtitulo ? (
          <span
            className={cn("text-muted-foreground text-xs", temMeta && "line-clamp-1")}
            data-linha="subtitulo"
          >
            {selo}
            {colecao.subtitulo}
            {/* sem meta (§22.12 item 4), os raios fecham o subtítulo */}
            {!temMeta && raios ? (
              <>
                {" "}
                <Raios nivel={raios} tamanho="sm" className="text-primary inline-flex align-middle" />
              </>
            ) : null}
          </span>
        ) : (
          <span
            aria-hidden={selo ? undefined : true}
            className="block h-4 text-xs"
            data-linha="subtitulo-vazio"
          >
            {selo}
          </span>
        )}
        {/*
          SPEC §22.12 item 3: o motivo aparece inteiro — cita no máximo um nome
          por termo, e com 4 termos o corte em 2 linhas escondia o 3º nome.
        */}
        {colecao.motivoDaBusca ? (
          <span className="text-muted-foreground text-xs" data-linha="motivo">
            {colecao.motivoDaBusca}
          </span>
        ) : null}
        {/*
          SPEC §22.12 item 4: o plano sem perfil cujo objetivo já diz o prazo
          não tem meta — a linha acaba no subtítulo, sem um vão vazio.
          SPEC §22.13 item 10: os raios moram aqui, no fluxo do texto (não
          num flex que quebra), ABRINDO a meta, antes de "N exercícios": a
          meta de aparelho ("N exercícios que dão para fazer com ele") quebra
          em 2 linhas a 360 px, e no fim dela os raios caíam na 2ª linha.
        */}
        {temMeta ? (
          <span
            className="text-muted-foreground text-xs font-normal tabular-nums"
            data-linha="meta"
          >
            {/* o respiro é margem, não um nó de texto: a meta segue sendo um texto só */}
            {raios ? (
              <Raios
                nivel={raios}
                tamanho="sm"
                className="text-primary mr-1 inline-flex align-middle"
              />
            ) : null}
            {colecao.detalhe}
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
