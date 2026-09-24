"use client";

import { CircleHelp, List, SkipForward, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { AnelDeContagem } from "@/components/player/anel";
import { Button } from "@/components/ui/button";
import { acharExercicio } from "@/lib/dados";
import { nomeAcessivel } from "@/lib/midia";
import { fracaoRestante, restanteS, type EstadoPlayer } from "@/lib/player";

/**
 * "PREPARE-SE" (SPEC §14.1.1 e §22.16 itens 2–4): o anel de contagem, o nome
 * do primeiro exercício com o "?" e o botão de pular.
 *
 * §22.16: a tela tinha só dois controles — quem tocou "Começar treino" sem
 * querer só saía pelo voltar do sistema. O topo ganha "Sair do treino" (a
 * sessão fica aberta, como no "Continuar depois" da Visão geral) e a "Visão
 * geral do treino" da tela de série. A preparação ocupa a tela inteira e o
 * bloco fica no meio dela: o `justify-center` de antes não centralizava nada
 * (o `main` não é flex) e sobravam ~280 px vazios embaixo. O título antigo
 * concordava no masculino com qualquer conta (§21): agora "Prepare-se".
 */
export function TelaPreparacao({
  exercicioId,
  estado,
  agora,
  nomeDoTreino,
  pedidoDeFoco = 0,
  aoAbrirFicha,
  aoAbrirLista,
  aoPular,
}: {
  exercicioId: string;
  estado: EstadoPlayer;
  agora: number;
  /** "Treino A" — o `h1` só-leitor da rota, como na tela de série. */
  nomeDoTreino: string;
  /** Muda ao fechar a Visão geral: o foco volta ao botão que a abriu. */
  pedidoDeFoco?: number;
  aoAbrirFicha: () => void;
  aoAbrirLista: () => void;
  aoPular: () => void;
}) {
  const exercicio = acharExercicio(exercicioId);
  const falta = restanteS(estado, agora);

  const botaoDaLista = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (pedidoDeFoco > 0) botaoDaLista.current?.focus();
  }, [pedidoDeFoco]);

  return (
    <section
      aria-label="Preparação"
      /* tela cheia, como a Visão geral: no player não há barra de abas */
      className="bg-background fixed inset-0 z-10 overflow-y-auto"
    >
      <h1 className="sr-only">{nomeDoTreino} — preparação</h1>
      <div className="pt-segura absolute inset-x-0 top-0">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-3 pt-4">
          <Button asChild variant="ghost" className="alvo gap-1.5 px-3">
            <Link href="/">
              <X className="size-5" />
              Sair do treino
            </Link>
          </Button>
          <Button
            ref={botaoDaLista}
            variant="ghost"
            size="icon"
            className="alvo"
            aria-label="Visão geral do treino"
            onClick={aoAbrirLista}
          >
            <List className="size-5" />
          </Button>
        </div>
      </div>

      {/* py-20 dos dois lados: o bloco fica no meio da tela e nunca sob o topo */}
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
        <div data-bloco-preparacao className="flex w-full flex-col items-center gap-6">
          <p className="text-muted-foreground text-sm font-semibold tracking-[0.2em] uppercase">
            Prepare-se
          </p>

          <AnelDeContagem fracao={fracaoRestante(estado, agora)} tamanho={220}>
            <span
              role="timer"
              aria-label="Preparação"
              className="numero-grande text-6xl tabular-nums"
            >
              {falta}
            </span>
            <span className="text-muted-foreground text-xs">segundos</span>
          </AnelDeContagem>

          <div className="flex items-center justify-center gap-1">
            <h2 className="text-xl font-semibold text-balance">{exercicio.nome}</h2>
            <Button
              variant="ghost"
              size="icon"
              className="alvo shrink-0"
              aria-label={nomeAcessivel("Como fazer", exercicio.nome)}
              onClick={aoAbrirFicha}
            >
              <CircleHelp className="size-5" />
            </Button>
          </div>

          <Button
            className="alvo h-14 w-full max-w-xs rounded-2xl text-base font-semibold"
            onClick={aoPular}
          >
            <SkipForward className="size-5" />
            Começar agora
          </Button>
        </div>
      </div>
    </section>
  );
}
