"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatarNumero, lerNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * − valor + com digitação direta (SPEC §7). Celular primeiro: os dois botões
 * têm 44 px, o campo abre o teclado numérico e aceita vírgula decimal.
 *
 * O componente não decide o próximo valor: quem chama passa `aoAndar` (a carga
 * anda pela escala do implemento, §6.4) ou deixa que ele some o `passo`.
 */
export function StepperNumerico({
  valor,
  aoMudar,
  aoAndar,
  passo = 1,
  minimo = 0,
  maximo,
  rotulo,
  sufixo,
  decimal = false,
  compacto = false,
  grande = false,
  desabilitado = false,
}: {
  valor: number | null;
  aoMudar: (novo: number | null) => void;
  /** Quando existe, manda no − e no +. */
  aoAndar?: (direcao: 1 | -1) => void;
  passo?: number;
  minimo?: number;
  maximo?: number;
  rotulo: string;
  sufixo?: string;
  decimal?: boolean;
  compacto?: boolean;
  /** Número grande e alvos de 56 px: é o passo do player (SPEC §14.1.2). */
  grande?: boolean;
  desabilitado?: boolean;
}) {
  const id = useId();
  const [texto, setTexto] = useState(() => (valor === null ? "" : formatarNumero(valor)));

  // o valor pode mudar por fora (série anterior preenchendo a seguinte)
  useEffect(() => {
    setTexto(valor === null ? "" : formatarNumero(valor));
  }, [valor]);

  const andar = (direcao: 1 | -1) => {
    if (desabilitado) return;
    if (aoAndar) {
      aoAndar(direcao);
      return;
    }
    const base = valor ?? minimo;
    const bruto = base + direcao * passo;
    const preso = Math.min(maximo ?? Number.POSITIVE_INFINITY, Math.max(minimo, bruto));
    aoMudar(Number(preso.toFixed(2)));
  };

  const confirmar = () => {
    const lido = lerNumero(texto);
    if (lido === null) {
      aoMudar(null);
      setTexto("");
      return;
    }
    const preso = Math.min(maximo ?? Number.POSITIVE_INFINITY, Math.max(minimo, lido));
    aoMudar(preso);
    setTexto(formatarNumero(preso));
  };

  return (
    <div className={cn("flex items-center", compacto ? "gap-0.5" : "gap-1", grande && "gap-2")}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("alvo shrink-0", grande ? "size-14 rounded-2xl" : "size-11")}
        onClick={() => andar(-1)}
        disabled={desabilitado}
        aria-label={`Diminuir ${rotulo}`}
      >
        <Minus className={grande ? "size-7" : "size-5"} />
      </Button>

      <div className="relative min-w-11 flex-1">
        <label className="sr-only" htmlFor={id}>
          {rotulo}
        </label>
        <input
          id={id}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          disabled={desabilitado}
          inputMode={decimal ? "decimal" : "numeric"}
          enterKeyHint="done"
          autoComplete="off"
          className={cn(
            // 44 px nas DUAS dimensões: quem digita em vez de usar o − e o +
            // tem o campo como alvo, e na grade de duas colunas da sessão ele
            // fechava em 37 px de largura.
            "numero border-input bg-background w-full min-w-11 rounded-lg border text-center tabular-nums",
            grande ? "h-14 rounded-2xl" : "h-11",
            // "107,5" ainda cabe na coluna estreita de 360 px
            grande ? "px-1 text-3xl font-semibold" : compacto ? "px-0.5 text-base" : "px-2 text-lg",
            "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
            "disabled:opacity-50",
          )}
          aria-label={rotulo}
        />
        {sufixo ? (
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs">
            {sufixo}
          </span>
        ) : null}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("alvo shrink-0", grande ? "size-14 rounded-2xl" : "size-11")}
        onClick={() => andar(1)}
        disabled={desabilitado}
        aria-label={`Aumentar ${rotulo}`}
      >
        <Plus className={grande ? "size-7" : "size-5"} />
      </Button>
    </div>
  );
}
