"use client";

import { Pause, Play, SkipForward } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { apitar, falar, vibrar } from "@/lib/apito";
import {
  decorridoNoBloco,
  restanteDoBlocoS,
  restanteTotalS,
  type BlocoCardio,
  type EstadoTimer,
  type TipoBloco,
} from "@/lib/cardio";
import { formatarDuracao, formatarMinutos } from "@/lib/formato";

/** Cor por tipo de bloco (SPEC §3.3). Um destaque só, o resto em contraste. */
const COR: Record<TipoBloco, string> = {
  aquecimento: "bg-secondary text-secondary-foreground",
  corrida: "bg-primary text-primary-foreground",
  caminhada: "bg-secondary text-secondary-foreground",
  corda: "bg-primary text-primary-foreground",
  descanso: "bg-secondary text-secondary-foreground",
  soltura: "bg-secondary text-secondary-foreground",
};

/**
 * Timer de intervalos (SPEC §3.3): o bloco atual grande, o próximo visível, o
 * tempo total restante, voz e vibração na troca de bloco.
 *
 * O relógio de verdade é o `EstadoTimer` (lib/cardio.ts), que vive no
 * IndexedDB: aqui só se lê o tempo do sistema e se desenha.
 */
export function TimerIntervalos({
  blocos,
  timer,
  agoraMs,
  voz,
  vibracao,
  aoPausar,
  aoRetomar,
  aoPular,
}: {
  blocos: readonly BlocoCardio[];
  timer: EstadoTimer;
  agoraMs: number;
  voz: boolean;
  vibracao: boolean;
  aoPausar: () => void;
  aoRetomar: () => void;
  aoPular: () => void;
}) {
  const atual = blocos[timer.indice];
  const proximo = blocos[timer.indice + 1];
  const ultimoFalado = useRef<number | null>(null);

  /* Voz e vibração na troca de bloco — nunca no primeiro desenho da tela. */
  useEffect(() => {
    if (!atual || timer.terminado) return;
    if (ultimoFalado.current === null) {
      ultimoFalado.current = timer.indice;
      return;
    }
    if (ultimoFalado.current === timer.indice) return;
    ultimoFalado.current = timer.indice;
    if (vibracao) vibrar([180, 90, 180]);
    if (voz) falar(atual.voz);
    else if (!vibracao) apitar();
  }, [timer.indice, timer.terminado, atual, voz, vibracao]);

  if (!atual) return null;

  const restante = restanteDoBlocoS(timer, blocos, agoraMs);
  const total = restanteTotalS(timer, blocos, agoraMs);
  const fracao =
    atual.segundos > 0
      ? Math.max(0, Math.min(1, decorridoNoBloco(timer, agoraMs) / atual.segundos))
      : 1;
  const pausado = timer.desdeMs === null;
  const naoComecou =
    pausado && timer.indice === 0 && timer.acumuladoS === 0 && timer.anterioresS === 0;
  const trabalho = blocos.filter((b) => b.trabalho).length;

  return (
    <section className="flex flex-col gap-3" aria-label="Timer de intervalos">
      <div className={`flex flex-col gap-2 rounded-xl p-4 ${COR[atual.tipo]}`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-semibold">{atual.rotulo}</span>
          {atual.serie !== null ? (
            <span className="text-sm opacity-80">
              bloco {atual.serie} de {trabalho}
            </span>
          ) : null}
        </div>

        <p role="timer" aria-live="off" className="numero text-6xl leading-none">
          {formatarDuracao(restante)}
        </p>

        <div
          aria-hidden="true"
          className="bg-background/30 h-1.5 w-full overflow-hidden rounded-full"
        >
          <div
            className="bg-background h-full transition-[width] duration-300"
            style={{ width: `${fracao * 100}%` }}
          />
        </div>

        <p className="text-sm opacity-90">
          {proximo ? `depois: ${proximo.rotulo} · ${formatarDuracao(proximo.segundos)}` : "último bloco"}
        </p>
      </div>

      <p className="text-muted-foreground text-center text-sm">
        faltam {formatarMinutos(total / 60)} de sessão
      </p>

      {/* No fim do plano os dois não fazem mais nada: o que resta é encerrar. */}
      {timer.terminado ? null : (
        <div className="flex gap-2">
          <Button
            className="alvo h-14 flex-1 text-base font-semibold"
            onClick={pausado ? aoRetomar : aoPausar}
          >
            {pausado ? <Play className="size-5" /> : <Pause className="size-5" />}
            {pausado ? (naoComecou ? "Começar" : "Retomar") : "Pausar"}
          </Button>
          <Button
            variant="outline"
            className="alvo h-14 flex-1 text-base"
            onClick={aoPular}
          >
            <SkipForward className="size-5" />
            Pular bloco
          </Button>
        </div>
      )}
    </section>
  );
}

/** A lista dos blocos do plano, com o atual marcado (SPEC §3.3). */
export function ListaDeBlocos({
  blocos,
  indice,
  cumpridos,
}: {
  blocos: readonly BlocoCardio[];
  indice: number;
  cumpridos: readonly number[];
}) {
  return (
    <ol
      aria-label="Blocos da sessão"
      className="border-border divide-border divide-y rounded-xl border text-sm"
    >
      {blocos.map((b) => {
        const feito = cumpridos.includes(b.indice);
        const agora = b.indice === indice;
        return (
          <li
            key={b.indice}
            aria-current={agora ? "step" : undefined}
            className={`flex items-center justify-between gap-2 px-3 py-2 ${
              agora ? "bg-secondary font-semibold" : ""
            }`}
          >
            <span className={feito && !agora ? "text-muted-foreground" : ""}>
              {feito ? "✓ " : ""}
              {b.rotulo}
              {b.serie !== null ? ` ${b.serie}` : ""}
            </span>
            <span className="numero text-muted-foreground">
              {formatarDuracao(b.segundos)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
