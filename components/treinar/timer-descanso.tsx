"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { apitar, vibrar } from "@/lib/apito";
import { formatarDuracao } from "@/lib/formato";

export interface DescansoAtivo {
  /** Muda a cada série concluída: reinicia o relógio mesmo com o mesmo tempo. */
  chave: number;
  segundos: number;
  exercicio: string;
}

/**
 * Timer de descanso (SPEC §3.2 e §7): barra fixa no topo, contagem regressiva,
 * vibração e bipe ao zerar, "pular" e "+30 s".
 *
 * O relógio é o do sistema (um alvo em milissegundos), não uma soma de ticks:
 * com a tela apagada o navegador atrasa o `setInterval`, e somar ticks daria
 * um descanso maior do que o pedido.
 */
export function TimerDescanso({
  descanso,
  aoFechar,
  som = true,
  vibracao = true,
}: {
  descanso: DescansoAtivo | null;
  aoFechar: () => void;
  som?: boolean;
  vibracao?: boolean;
}) {
  const [restante, setRestante] = useState(descanso?.segundos ?? 0);
  const [extra, setExtra] = useState(0);
  /** O instante em que o descanso acaba (ms). É ele que o "+30 s" empurra. */
  const [fim, setFim] = useState(0);
  const tocou = useRef(false);
  const chave = descanso?.chave ?? 0;
  const base = descanso?.segundos ?? 0;

  useEffect(() => {
    if (!descanso) return;
    setExtra(0);
    setFim(Date.now() + base * 1000);
    tocou.current = false;
  }, [chave, base, descanso]);

  /**
   * "+30 s" soma 30 segundos ao que FALTA (empurra o fim), em vez de recomeçar
   * a contagem: a 0:10 do fim de um descanso de 2:30 a resposta é 0:40, não
   * 3:00. Se o descanso já tinha zerado, o aviso volta a valer para o novo fim.
   */
  const somarTrinta = () => {
    setExtra((e) => e + 30);
    setFim((f) => Math.max(f, Date.now()) + 30_000);
    tocou.current = false;
  };

  useEffect(() => {
    if (!descanso || fim === 0) return;
    const tique = () => {
      const falta = Math.ceil((fim - Date.now()) / 1000);
      setRestante(falta);
      if (falta <= 0 && !tocou.current) {
        tocou.current = true;
        if (vibracao) vibrar();
        if (som) apitar();
      }
    };
    tique();
    const relogio = setInterval(tique, 250);
    return () => clearInterval(relogio);
  }, [fim, descanso, som, vibracao]);

  if (!descanso) return null;

  const acabou = restante <= 0;
  const total = base + extra;
  const fracao = total > 0 ? Math.max(0, Math.min(1, restante / total)) : 0;

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label="Descanso"
      className="bg-card/95 border-border pt-segura fixed inset-x-0 top-0 z-40 border-b backdrop-blur"
    >
      <div
        aria-hidden="true"
        className="bg-primary h-1 transition-[width] duration-200"
        style={{ width: `${fracao * 100}%` }}
      />
      <div className="mx-auto flex w-full max-w-lg items-center gap-2 px-3 py-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="numero text-2xl leading-none">
            {acabou ? "vai!" : formatarDuracao(restante)}
          </span>
          <span className="text-muted-foreground line-clamp-2 text-xs">
            {acabou ? "descanso acabou" : `descanso · ${descanso.exercicio}`}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="alvo h-11 gap-1 px-3"
          onClick={somarTrinta}
        >
          <Plus className="size-4" />
          30 s
        </Button>
        <Button
          variant={acabou ? "default" : "ghost"}
          size="sm"
          className="alvo h-11 px-3"
          onClick={aoFechar}
        >
          {acabou ? "Fechar" : "Pular"}
          {acabou ? null : <X className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
