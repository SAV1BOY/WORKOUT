"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { aceitarDigitacao } from "@/lib/digitar-numero";
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
  /**
   * SPEC §22.11: enquanto o campo tem foco, o texto é do usuário.
   *
   * Numa `ref` e não num estado de propósito: o efeito abaixo precisa **ler**
   * o foco sem voltar a rodar quando ele muda — quem manda nele é o `valor`.
   */
  const temFoco = useRef(false);

  // o valor pode mudar por fora (série anterior preenchendo a seguinte)
  useEffect(() => {
    /*
     * Campo focado não se reescreve (SPEC §22.11). Digitando "12,5" depressa
     * em CARGA NA BARRA, ao chegar em "12" o app ajusta para a anilha possível
     * (11,5) e este efeito reescrevia o texto no meio da digitação: as teclas
     * "," e "5" caíam no texto novo e a tela mostrava "11,5,5". O ajuste
     * chega ao campo no `onBlur`, que é quando ele deixa de ser do dedo.
     */
    if (temFoco.current) return;
    setTexto((atual) => {
      // o que está escrito já é este valor ("82," enquanto se digita "82,4"):
      // reescrever aqui apagaria a vírgula recém-digitada
      if (lerNumero(atual) === valor) return atual;
      return valor === null ? "" : formatarNumero(valor);
    });
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

  /*
   * Confirmar só no `onBlur` perdia o toque seguinte: o blur muda a tela (o
   * card de IMC da conclusão cresce 94 px) entre o apertar e o soltar, e o
   * clique nunca chega ao botão. Enquanto o texto já é um número válido, o
   * valor sobe a cada tecla; o `onBlur` continua para normalizar e prender
   * nos limites.
   */
  const digitar = (novoTexto: string) => {
    // a tecla que não faz um número em construção simplesmente não entra —
    // a segunda vírgula, a letra, o menos onde não cabe (SPEC §22.11)
    const aceito = aceitarDigitacao(texto, novoTexto, { negativo: minimo < 0 });
    setTexto(aceito);
    const lido = lerNumero(aceito);
    if (lido === null) return;
    const preso = Math.min(maximo ?? Number.POSITIVE_INFINITY, Math.max(minimo, lido));
    if (preso === lido && lido !== valor) aoMudar(lido);
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
          onChange={(e) => digitar(e.target.value)}
          onFocus={() => {
            temFoco.current = true;
          }}
          onBlur={() => {
            temFoco.current = false;
            confirmar();
          }}
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
            "focus-visible:border-ring focus-visible:ring-ring outline-none focus-visible:ring-3",
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
