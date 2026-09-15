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
  const tocou = useRef(false);
  const chave = descanso?.chave ?? 0;
  const base = descanso?.segundos ?? 0;

  useEffect(() => {
    if (!descanso) return;
    setExtra(0);
    tocou.current = false;
  }, [chave, descanso]);

  useEffect(() => {
    if (!descanso) return;
    const fim = Date.now() + (base + extra) * 1000;
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
  }, [chave, base, extra, descanso, som, vibracao]);

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
          <span className="text-muted-foreground truncate text-xs">
            {acabou ? "descanso acabou" : `descanso · ${descanso.exercicio}`}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="alvo h-11 gap-1 px-3"
          onClick={() => setExtra((e) => e + 30)}
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
