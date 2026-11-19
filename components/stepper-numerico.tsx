"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { aceitarDigitacao, erroDaContagem, MAXIMO_DA_CONTAGEM, nomeDoPasso } from "@/lib/digitar-numero";
import { formatarNumero, lerNumero } from "@/lib/formato";
import { cn } from "@/lib/utils";
import estilos from "./stepper-numerico.module.css";

/** Antes de usar as contagens deste grupo, leve a pessoa ao campo que precisa de correção. */
export function validarContagens(grupo: ParentNode | null): boolean {
  const invalido = grupo?.querySelector<HTMLInputElement>('input[inputmode="numeric"][aria-invalid="true"]');
  if (!invalido) return true;
  invalido.focus();
  return false;
}

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
  confirmarAoSair = false,
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
  /** Na prescrição, um prefixo como "1" não pode remover séries enquanto se digita. */
  confirmarAoSair?: boolean;
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
  const campo = useRef<HTMLInputElement>(null);
  // Durante a digitação, preserve inclusive a vírgula final. Fora dela,
  // mostre diretamente o valor aceito pelo pai (por exemplo, a carga montável).
  const [rascunho, setRascunho] = useState<string | null>(null);
  // No campo editável "1000" são mil saltos. O ponto é reservado à entrada decimal.
  const textoDoValor = valor === null ? "" : decimal ? formatarNumero(valor) : String(valor).replace(".", ",");
  const texto = rascunho ?? textoDoValor;
  const erro = decimal ? null : erroDaContagem(texto, maximo);
  const teto = maximo ?? (decimal ? Number.POSITIVE_INFINITY : MAXIMO_DA_CONTAGEM);

  const andar = (direcao: 1 | -1) => {
    if (desabilitado) return;
    if (erro) {
      campo.current?.focus();
      return;
    }
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
    const base = (confirmarAoSair ? lerNumero(texto) : valor) ?? minimo;
    const bruto = base + direcao * passo;
    const preso = Math.min(teto, Math.max(minimo, bruto));
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
    if (confirmarAoSair || (!decimal && erroDaContagem(aceito, maximo))) return;
    // No iPhone um toque em Concluir pode não desfocar a entrada que a pessoa acabou de limpar.
    if (!decimal && aceito === "") {
      if (valor !== null) aoMudar(null);
      return;
    }
    const lido = lerNumero(aceito);
    if (lido === null) return;
    const preso = Math.min(teto, Math.max(minimo, lido));
    if (preso === lido && lido !== valor) aoMudar(lido);
  };

  const confirmar = () => {
    if (erro) return;
    setRascunho(null);
    const lido = lerNumero(texto);
    if (lido === null) {
      aoMudar(null);
      return;
    }
    const preso = Math.min(teto, Math.max(minimo, lido));
    // A prescrição aguarda a quantidade completa. Nos demais campos o valor
    // válido já subiu a cada tecla; só falta aplicar eventuais limites.
    if (confirmarAoSair ? preso !== valor : preso !== lido) aoMudar(preso);
  };

  const tamanhoDoBotao = grande ? "size-14 min-h-[56px] min-w-[56px] rounded-2xl" : alto ? "size-12" : "size-11";
  const diminuir = (classe?: string) => (
    <Button type="button" variant="outline" size="icon" className={cn("alvo shrink-0", tamanhoDoBotao, classe)}
      onClick={() => andar(-1)} disabled={desabilitado} aria-label={nomeDoPasso("Diminuir", rotulo, contexto)}>
      <Minus className={grande ? "size-7" : "size-5"} />
    </Button>
  );

  const aviso = erro && (
    <p id={`${id}-erro`} role="alert" className="mt-1 basis-full text-sm font-medium wrap-anywhere">
      {erro}
    </p>
  );
  const controle = (
    <div className={grande ? estilos.grande : cn("flex items-center", compacto ? "gap-0.5" : "gap-1", erro && "flex-wrap")}>
      {diminuir(grande ? estilos.emLinha : undefined)}

      <div className={cn("relative min-w-11 flex-1", grande && estilos.campo)}>
        <label className="sr-only" htmlFor={id}>
          {rotulo}
        </label>
        <input
          ref={campo}
          id={id}
          value={texto}
          size={grande ? 5 : undefined}
          onChange={(e) => digitar(e.target.value)}
          onFocus={() => setRascunho(texto)}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (erro) e.preventDefault();
            else e.currentTarget.blur();
          }}
          disabled={desabilitado}
          inputMode={decimal ? "decimal" : "numeric"}
          pattern={decimal ? undefined : "-?[0-9]+"}
          data-confirmar-ao-sair={confirmarAoSair || undefined}
          aria-invalid={Boolean(erro) || undefined}
          aria-describedby={erro ? `${id}-erro` : undefined}
          enterKeyHint="done"
          autoComplete="off"
          className={cn(
            // 44 px nas DUAS dimensões: quem digita em vez de usar o − e o +
            // tem o campo como alvo, e na grade de duas colunas da sessão ele
            // fechava em 37 px de largura.
            "numero border-input bg-background w-full min-w-11 rounded-lg border text-center tabular-nums",
            grande ? "h-14 min-h-[56px] min-w-[56px] rounded-2xl" : alto ? "h-12" : "h-11",
            grande ? "px-[4px] text-3xl font-semibold" : compacto ? "px-0.5 text-base" : "px-2 text-lg",
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

      {/* Na disposição estreita o campo vem primeiro, inclusive no Tab. */}
      {grande && diminuir(estilos.emDuasLinhas)}
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn("alvo shrink-0", tamanhoDoBotao)}
        onClick={() => andar(1)}
        disabled={desabilitado}
        aria-label={nomeDoPasso("Aumentar", rotulo, contexto)}
      >
        <Plus className={grande ? "size-7" : "size-5"} />
      </Button>
      {!grande && aviso}
    </div>
  );
  return grande ? <div className={estilos.espaco}>{controle}{aviso}</div> : controle;
}
