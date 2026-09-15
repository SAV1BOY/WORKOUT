"use client";

import { CalendarClock, Footprints, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Previa } from "@/components/hoje/previa";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SessaoCardioDoDia } from "@/lib/calendario";
import { cardio as dadosCardio } from "@/lib/dados";
import { formatarMinutos } from "@/lib/formato";
import { textoDoCardio, type ItemPrevia, type ResumoDoTreino } from "@/lib/hoje";

/** Botão grande, uma mão, alvo bem acima de 44 px. */
const GRANDE = "alvo h-14 w-full text-base font-semibold";

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
      className="border-primary/50 bg-primary/5 flex flex-col gap-2 rounded-xl border p-3"
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

/* --------------------------------------------------- treinar mesmo assim */

/** SPEC §5.3: treinar num dia de cardio ou descanso é permitido. */
export function TreinarMesmoAssim({ nomeDoTreino }: { nomeDoTreino: string }) {
  return (
    <Button asChild variant="outline" className="alvo h-12 w-full">
      <Link href="/treinar">Treinar mesmo assim ({nomeDoTreino})</Link>
    </Button>
  );
}

/* ------------------------------------------------------------ força */

export function CardForca({
  resumo,
  itens,
  carregandoPrevia,
  aviso,
}: {
  resumo: ResumoDoTreino;
  itens: ItemPrevia[];
  carregandoPrevia: boolean;
  aviso: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl text-balance">{resumo.texto}</CardTitle>
        <CardDescription>{resumo.foco}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {aviso ? <Aviso texto={aviso} /> : null}
        <Button asChild className={GRANDE}>
          <Link href="/treinar">Começar treino</Link>
        </Button>
        <Previa itens={itens} carregando={carregandoPrevia} />
      </CardContent>
    </Card>
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
        {c.km_total} km no total · ritmo alvo {c.pace_alvo}
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
      <li>≈ {c.saltos_aprox} saltos</li>
    </ul>
  );
}

export function CardCardio({
  sessao,
  alternativaCorda,
  href,
  nomeDoProximoTreino,
  aviso,
}: {
  sessao: SessaoCardioDoDia;
  alternativaCorda: SessaoCardioDoDia | null;
  href: string;
  nomeDoProximoTreino: string;
  aviso: string | null;
}) {
  const [comCorda, setComCorda] = useState(false);
  const mostrada = comCorda && alternativaCorda ? alternativaCorda : sessao;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl text-balance">{textoDoCardio(mostrada)}</CardTitle>
        <CardDescription>{dadosCardio.ordem[0]}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {aviso ? <Aviso texto={aviso} /> : null}
        {mostrada.tipo === "corda" ? (
          <DetalheDaCorda sessao={mostrada} />
        ) : (
          <DetalheDaCorrida sessao={mostrada} />
        )}

        <Button asChild className={GRANDE}>
          <Link href={comCorda ? `${href}?tipo=corda` : href}>Começar</Link>
        </Button>

        {alternativaCorda ? (
          <Button
            variant="outline"
            className="alvo h-12 w-full"
            onClick={() => setComCorda((v) => !v)}
          >
            <Footprints className="size-4" />
            {comCorda ? "Voltar para a corrida" : "Fazer corda em vez de corrida"}
          </Button>
        ) : null}

        <TreinarMesmoAssim nomeDoTreino={nomeDoProximoTreino} />
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------- descanso */

export function CardDescanso({
  nota,
  total,
  aoSomarUma,
  ocupado,
  nomeDoProximoTreino,
}: {
  nota: string | null;
  total: number;
  aoSomarUma: () => void;
  ocupado: boolean;
  nomeDoProximoTreino: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Descanso</CardTitle>
        <CardDescription className="text-balance">
          {nota && nota.trim() !== "" ? nota : "Dia livre — o corpo cresce agora."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-xs text-balance">
          {dadosCardio.barra_fixa.grease_the_groove}
        </p>

        <div className="border-border flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
              Soltas de hoje
            </span>
            <span className="numero text-3xl">{total}</span>
          </div>
          <Button
            className="alvo h-14 px-6 text-base font-semibold"
            onClick={aoSomarUma}
            disabled={ocupado}
            aria-label="Somar uma repetição solta de barra fixa"
          >
            <Plus className="size-5" />
            1
          </Button>
        </div>

        <TreinarMesmoAssim nomeDoTreino={nomeDoProximoTreino} />
      </CardContent>
    </Card>
  );
}
