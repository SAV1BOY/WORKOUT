"use client";

import { CalendarClock, Footprints, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { Button } from "@/components/ui/button";
import { CardCapa } from "@/components/ui/card-capa";
import { EXERCICIO_DA_SESSAO } from "@/lib/barra-fixa";
import type { SessaoCardioDoDia } from "@/lib/calendario";
import { capaDoCardio, capaDoExercicio, capaDoTreino } from "@/lib/capas";
import { acharExercicio, cardio as dadosCardio, exerciciosDoTreino } from "@/lib/dados";
import { dificuldadeDaColecao } from "@/lib/dificuldade";
import { formatarKm, formatarMinutos, formatarNumero } from "@/lib/formato";
import { descricaoDoCardio, detalheDoTreino, type ResumoDoTreino } from "@/lib/hoje";

/* --------------------------------------------------------------- avisos */

export function Aviso({ texto }: { texto: string }) {
  return (
    <p
      role="note"
      className="border-primary/40 bg-primary/5 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
    >
      <TriangleAlert className="text-primary mt-0.5 size-4 shrink-0" />
      <span>{texto}</span>
    </p>
  );
}

/* ---------------------------------------------------- banner de sessão */

/** SPEC §3.1: "Você tem um treino aberto de <data>" com Continuar / Descartar. */
export function BannerSessaoAberta({
  texto,
  href,
  aoDescartar,
}: {
  texto: string;
  href: string;
  aoDescartar: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Treino aberto"
      className="border-primary/50 bg-primary/5 cartao flex flex-col gap-2 border p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <CalendarClock className="text-primary size-4 shrink-0" />
        {texto}
      </p>
      <div className="flex gap-2">
        <Button asChild className="alvo h-11 flex-1">
          <Link href={href}>Continuar</Link>
        </Button>
        <Button variant="outline" className="alvo h-11 flex-1" onClick={aoDescartar}>
          Descartar
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------- o portão da retomada */

/**
 * SPEC §18.3: enquanto a pausa não foi decidida, os botões que levam a começar
 * uma atividade chamam `aoBloquear` (que leva ao card) em vez de navegar. Sem
 * pausa pendente continuam sendo `<Link>` — o prefetch do Next não se perde.
 */
export interface Bloqueio {
  bloqueado?: boolean;
  aoBloquear?: () => void;
}

function BotaoQueLeva({
  href,
  bloqueado,
  aoBloquear,
  className,
  variant,
  children,
}: Bloqueio & {
  href: string;
  className: string;
  variant?: "outline";
  children: React.ReactNode;
}) {
  if (bloqueado) {
    return (
      <Button type="button" variant={variant} className={className} onClick={aoBloquear}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant={variant} className={className}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

/* --------------------------------------------------- treinar mesmo assim */

/** SPEC §5.3: treinar num dia de cardio ou descanso é permitido. */
export function TreinarMesmoAssim({
  nomeDoTreino,
  bloqueado,
  aoBloquear,
}: Bloqueio & { nomeDoTreino: string }) {
  return (
    <BotaoQueLeva
      href="/treinar"
      variant="outline"
      className="alvo h-12 w-full rounded-xl"
      bloqueado={bloqueado}
      aoBloquear={aoBloquear}
    >
      Treinar mesmo assim ({nomeDoTreino})
    </BotaoQueLeva>
  );
}

/* ------------------------------------------------------------ força */

/** O card do treino do dia (SPEC §13.3), com capa na foto do 1º exercício. */
export function CardForca({
  resumo,
  aviso,
  mostrarRaios,
  semanaDaFase,
  aberta,
  aoComecar,
  criando,
}: {
  resumo: ResumoDoTreino;
  aviso: string | null;
  mostrarRaios: boolean;
  /** Em que semana da fase este treino cai (SPEC §16.4). */
  semanaDaFase?: number;
  /** Sessão em andamento deste treino: o card vira "Continuar". */
  aberta: { id: string; progresso: string } | null;
  /** Cria a sessão e entra no player, sem tela intermediária (§14.5.1). */
  aoComecar: () => void;
  criando: boolean;
}) {
  const raios = dificuldadeDaColecao(
    exerciciosDoTreino(resumo.id).map(({ exercicio }) => exercicio),
  );

  // SPEC §16.4: "6 exercícios · 44 min · semana 3" — a semana da fase no card
  const detalhe =
    semanaDaFase !== undefined
      ? `${detalheDoTreino(resumo.id)} · semana ${semanaDaFase}`
      : detalheDoTreino(resumo.id);

  return (
    <CardCapa
      titulo={resumo.nome}
      subtitulo={resumo.foco}
      detalhe={detalhe}
      foto={capaDoTreino(resumo.id)}
      raios={mostrarRaios ? raios : null}
      etiqueta={aberta ? "em andamento" : "hoje"}
    >
      {aviso ? <Aviso texto={aviso} /> : null}
      {/*
        SPEC §14.5.1: "Começar → Preparação → Exercício", sem escala. O botão
        largo do card do dia cria a sessão e já entra no player; `/treinar`
        continua sendo a rota para escolher o outro treino da fase (§5.3).
      */}
      {aberta ? (
        <BotaoLargo asChild>
          <Link href={`/treinar/${aberta.id}`}>Continuar</Link>
        </BotaoLargo>
      ) : (
        <BotaoLargo disabled={criando} onClick={aoComecar}>
          {criando ? "Começando…" : "Começar treino"}
        </BotaoLargo>
      )}
      {aberta ? (
        <p className="numero text-muted-foreground text-center text-xs">
          {aberta.progresso}
        </p>
      ) : null}
    </CardCapa>
  );
}

/* ------------------------------------------------------------ cardio */

function DetalheDaCorrida({ sessao }: { sessao: SessaoCardioDoDia }) {
  const c = sessao.corrida;
  if (!c) return null;
  return (
    <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
      <li>
        Aquecimento {formatarMinutos(c.aquecimento_min)} · soltura{" "}
        {formatarMinutos(c.soltura_min)}
      </li>
      <li>
        {formatarKm(c.km_total)} no total · ritmo alvo {c.pace_alvo}
      </li>
    </ul>
  );
}

function DetalheDaCorda({ sessao }: { sessao: SessaoCardioDoDia }) {
  const c = sessao.corda;
  if (!c) return null;
  return (
    <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
      <li>
        {c.blocos} blocos de {c.bloco_s} s · {c.descanso_s} s de descanso
      </li>
      <li>≈ {formatarNumero(c.saltos_aprox)} saltos</li>
    </ul>
  );
}

/** "Corrida · semana 1" — o nome vem do tipo da sessão do dia. */
function tituloDoCardio(sessao: SessaoCardioDoDia): string {
  const nome =
    sessao.tipo === "corrida" ? "Corrida" : sessao.tipo === "corda" ? "Corda" : "Caminhada";
  return `${nome} · semana ${sessao.semana}`;
}

export function CardCardio({
  sessao,
  alternativaCorda,
  nomeDoProximoTreino,
  aviso,
  bloqueado,
  aoBloquear,
}: Bloqueio & {
  sessao: SessaoCardioDoDia;
  alternativaCorda: SessaoCardioDoDia | null;
  nomeDoProximoTreino: string;
  aviso: string | null;
}) {
  const [comCorda, setComCorda] = useState(false);
  const mostrada = comCorda && alternativaCorda ? alternativaCorda : sessao;
  /* SPEC §3.3: a rota é o tipo da sessão (corrida | corda | caminhada). */
  const href = `/cardio/${mostrada.tipo}?semana=${mostrada.semana}`;
  const detalhe = [
    descricaoDoCardio(mostrada),
    mostrada.min !== null ? formatarMinutos(mostrada.min) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <CardCapa
        titulo={tituloDoCardio(mostrada)}
        detalhe={detalhe}
        foto={capaDoCardio(mostrada.tipo)}
        icone={<Footprints aria-hidden="true" className="size-12" />}
        etiqueta="hoje"
      >
        {aviso ? <Aviso texto={aviso} /> : null}
        {mostrada.tipo === "corda" ? (
          <DetalheDaCorda sessao={mostrada} />
        ) : (
          <DetalheDaCorrida sessao={mostrada} />
        )}

        {/* SPEC §18.3: com a pausa por decidir, "Começar" leva ao card */}
        {bloqueado ? (
          <BotaoLargo type="button" onClick={aoBloquear}>
            Começar
          </BotaoLargo>
        ) : (
          <BotaoLargo asChild>
            <Link href={href}>Começar</Link>
          </BotaoLargo>
        )}

        {alternativaCorda ? (
          <Button
            variant="outline"
            className="alvo h-12 w-full rounded-xl"
            onClick={() => setComCorda((v) => !v)}
          >
            <Footprints className="size-4" />
            {comCorda ? "Voltar para a corrida" : "Fazer corda em vez de corrida"}
          </Button>
        ) : null}
      </CardCapa>

      <TreinarMesmoAssim
        nomeDoTreino={nomeDoProximoTreino}
        bloqueado={bloqueado}
        aoBloquear={aoBloquear}
      />
    </>
  );
}

/* ---------------------------------------------------------- descanso */

/** O card do dia de descanso: reps soltas (§3.1) e a caminhada de domingo. */
export function CardDescanso({
  nota,
  total,
  aoSomarUma,
  ocupado,
  nomeDoProximoTreino,
  comCaminhada = false,
  bloqueado,
  aoBloquear,
}: Bloqueio & {
  nota: string | null;
  total: number;
  aoSomarUma: () => void;
  ocupado: boolean;
  nomeDoProximoTreino: string;
  /** Domingo: o programa pede caminhada leve (data/programa.json). */
  comCaminhada?: boolean;
}) {
  return (
    <>
      <CardCapa
        titulo="Descanso"
        subtitulo={nota && nota.trim() !== "" ? nota : "Dia livre — o corpo cresce agora."}
        foto={capaDoExercicio(acharExercicio(EXERCICIO_DA_SESSAO))}
        altura="baixa"
        etiqueta="hoje"
      >
        <p className="text-muted-foreground text-xs text-balance">
          {dadosCardio.barra_fixa.grease_the_groove}
        </p>

        <div className="border-border cartao flex items-center justify-between gap-3 border p-3">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
              Soltas de hoje
            </span>
            <span className="numero-grande text-3xl">{total}</span>
          </div>
          <Button
            className="alvo h-14 rounded-xl px-6 text-base font-semibold"
            onClick={aoSomarUma}
            disabled={ocupado}
            aria-label="Somar uma repetição solta de barra fixa"
          >
            <Plus className="size-5" />
            1
          </Button>
        </div>

        {comCaminhada ? (
          <BotaoQueLeva
            href="/cardio/caminhada"
            variant="outline"
            className="alvo h-12 w-full rounded-xl"
            bloqueado={bloqueado}
            aoBloquear={aoBloquear}
          >
            <Footprints className="size-4" />
            Começar caminhada leve
          </BotaoQueLeva>
        ) : null}
      </CardCapa>

      <TreinarMesmoAssim
        nomeDoTreino={nomeDoProximoTreino}
        bloqueado={bloqueado}
        aoBloquear={aoBloquear}
      />
    </>
  );
}
