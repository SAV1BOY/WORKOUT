"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { aceitarDigitacao, nomeDoPasso } from "@/lib/digitar-numero";
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
  alto = false,
  contexto,
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
  /**
   * Botões e campo com 48 px de altura: a série da Visão geral, onde o
   * stepper ocupa a largura toda do cartão (SPEC §22.18 item 4).
   */
  alto?: boolean;
  /**
   * Complemento do nome dos botões − e + ("da Série 1 de Levantamento
   * terra"): na Visão geral há um par por série, e sem isto eram 17
   * "Aumentar repetições" idênticos (SPEC §22.18 item 5). O campo fica só
   * com o `rotulo` — ele já está dentro do grupo da série.
   */
  contexto?: string;
  desabilitado?: boolean;
}) {
  const id = useId();
  // Durante a digitação, preserve inclusive a vírgula final. Fora dela,
  // mostre diretamente o valor aceito pelo pai (por exemplo, a carga montável).
  const [rascunho, setRascunho] = useState<string | null>(null);
  const texto = rascunho ?? (valor === null ? "" : formatarNumero(valor));

  const andar = (direcao: 1 | -1) => {
    if (desabilitado) return;
    /*
     * Apertar − ou + devolve o campo ao app: o texto deixa de ser do dedo e
     * volta a se reconciliar com o `valor`. No Chromium tocar num `<button>`
     * tira o foco do `<input>` e o `blur` já fazia isso — no Safari do iPhone
     * não tira, e sem esta linha o campo ficaria mostrando o número velho
     * enquanto o valor já andou. É o caminho de celular que o e2e exercita
     * com `dispatchEvent`, que também não mexe no foco.
     */
    setRascunho(null);
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
    // digitar é o que faz o texto ser do dedo — e não focar: no Safari o campo
    // continua focado depois de um toque no + , e o `onFocus` não volta a
    // disparar quando o usuário retoma a digitação
    setRascunho(aceito);
    const lido = lerNumero(aceito);
    if (lido === null) return;
    const preso = Math.min(maximo ?? Number.POSITIVE_INFINITY, Math.max(minimo, lido));
    if (preso === lido && lido !== valor) aoMudar(lido);
  };

  const confirmar = () => {
    setRascunho(null);
    const lido = lerNumero(texto);
    if (lido === null) {
      aoMudar(null);
      return;
    }
    const preso = Math.min(maximo ?? Number.POSITIVE_INFINITY, Math.max(minimo, lido));
    // O número válido já subiu a cada tecla. Só envie novamente se teve
    // de ser limitado ao sair do campo, evitando um segundo aviso de anilha.
    if (preso !== lido) aoMudar(preso);
  };

  return (
    <div className={cn("flex items-center", compacto ? "gap-0.5" : "gap-1", grande && "gap-2")}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("alvo shrink-0", grande ? "size-14 rounded-2xl" : alto ? "size-12" : "size-11")}
        onClick={() => andar(-1)}
        disabled={desabilitado}
        aria-label={nomeDoPasso("Diminuir", rotulo, contexto)}
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
          onFocus={() => setRascunho(texto)}
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
            grande ? "h-14 rounded-2xl" : alto ? "h-12" : "h-11",
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
        className={cn("alvo shrink-0", grande ? "size-14 rounded-2xl" : alto ? "size-12" : "size-11")}
        onClick={() => andar(1)}
        disabled={desabilitado}
        aria-label={nomeDoPasso("Aumentar", rotulo, contexto)}
      >
        <Plus className={grande ? "size-7" : "size-5"} />
      </Button>
    </div>
  );
}
