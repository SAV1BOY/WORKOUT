"use client";

import { Plus, SkipForward, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Miniatura } from "@/components/ui/miniatura";
import { StepperNumerico } from "@/components/stepper-numerico";
import { Button } from "@/components/ui/button";
import { apitar, vibrar } from "@/lib/apito";
import { acharExercicio } from "@/lib/dados";
import { formatarDuracao } from "@/lib/formato";
import { textoDoAlvo } from "@/lib/hoje";
import {
  DESCANSO_MAX_S,
  DESCANSO_MIN_S,
  EXTRA_DESCANSO_S,
  restanteS,
  rotuloDoPasso,
  zerou,
  type EstadoPlayer,
  type PassoSerie,
} from "@/lib/player";
import type { BlocoLocal } from "@/lib/sessao";

/**
 * O descanso em tela cheia (SPEC §14.1.3): fundo laranja escurecido, a figura
 * do próximo passo, "PRÓXIMO n/N" ou "Série n de N", a contagem grande e os
 * três controles — editar tempo, +20 s e pular.
 *
 * Ao zerar: bipe (WebAudio, sempre), vibração onde existir e, com
 * `avancarSozinho`, a passagem automática depois de 1 s.
 */
export function TelaDescanso({
  estado,
  agora,
  proximo,
  blocoDoProximo,
  som,
  vibracao,
  avancarSozinho,
  aoSomar,
  aoDefinir,
  aoPular,
}: {
  estado: EstadoPlayer;
  agora: number;
  proximo: PassoSerie | null;
  blocoDoProximo: BlocoLocal | null;
  som: boolean;
  vibracao: boolean;
  avancarSozinho: boolean;
  aoSomar: (segundos: number) => void;
  aoDefinir: (segundos: number) => void;
  aoPular: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [novoTempo, setNovoTempo] = useState<number | null>(estado.totalS ?? 60);
  const tocou = useRef<string | null>(null);
  const acabou = zerou(estado, agora);
  const falta = restanteS(estado, agora);

  /*
   * O player redesenha a cada 250 ms enquanto conta, e `aoPular` nasce de novo
   * em cada renderização. Num efeito que dependesse dele, o `setTimeout` de
   * 1 s seria cancelado e recriado antes de disparar — o "avançar sozinho"
   * nunca avançava. A referência mantém a função fresca sem ser dependência.
   */
  const pular = useRef(aoPular);
  useEffect(() => {
    pular.current = aoPular;
  });

  // o aviso toca uma vez por descanso (a chave muda a cada passo novo)
  useEffect(() => {
    if (!acabou || tocou.current === estado.chave) return;
    tocou.current = estado.chave;
    if (vibracao) vibrar();
    if (som) apitar();
  }, [acabou, estado.chave, som, vibracao]);

  // "+20 s" depois de zerar faz o aviso valer de novo
  useEffect(() => {
    if (!acabou) tocou.current = null;
  }, [acabou]);

  useEffect(() => {
    if (!acabou || !avancarSozinho) return;
    const relogio = setTimeout(() => pular.current(), 1_000);
    return () => clearTimeout(relogio);
  }, [acabou, avancarSozinho]);

  const exercicio = blocoDoProximo
    ? acharExercicio(blocoDoProximo.exercicioId)
    : null;
  const trocaDeExercicio = proximo !== null && proximo.numero === 1 && !proximo.aquecimento;

  return (
    <section
      aria-label="Descanso"
      data-tela="descanso"
      className="bg-descanso text-descanso-foreground fixed inset-0 z-50 flex flex-col items-center justify-between gap-4 overflow-y-auto px-4 py-8"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-descanso-destaque text-xs font-semibold tracking-[0.2em] uppercase">
          {proximo
            ? trocaDeExercicio
              ? `Próximo ${proximo.posicao}/${proximo.totalExercicios}`
              : rotuloDoPasso(proximo)
            : "Descanso"}
        </p>
        {blocoDoProximo && exercicio ? (
          <>
            <Miniatura exercicioId={blocoDoProximo.exercicioId} className="size-24" />
            <h2 className="text-lg font-semibold text-balance">{exercicio.nome}</h2>
            <p className="text-descanso-destaque numero text-sm">
              {textoDoAlvo(blocoDoProximo.prescricao.series, blocoDoProximo.alvo)}
            </p>
          </>
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-descanso-destaque text-xs font-semibold tracking-[0.2em] uppercase">
          Descanso
        </p>
        <span
          role="timer"
          aria-label="Descanso"
          className="numero-grande text-7xl leading-none tabular-nums"
        >
          {formatarDuracao(falta)}
        </span>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        {editando ? (
          /*
           * `text-foreground` de volta: o stepper e os botões de contorno são
           * componentes do tema normal (fundo `--background`), mas herdavam a
           * cor do texto da tela de descanso — no tema claro isso dava branco
           * sobre quase-branco, e o número do tempo sumia.
           */
          <div className="text-foreground flex items-center gap-2">
            <StepperNumerico
              rotulo="tempo de descanso em segundos"
              valor={novoTempo}
              passo={10}
              minimo={DESCANSO_MIN_S}
              maximo={DESCANSO_MAX_S}
              aoMudar={setNovoTempo}
            />
            <Button
              variant="secondary"
              className="alvo h-11 shrink-0"
              onClick={() => {
                aoDefinir(novoTempo ?? DESCANSO_MIN_S);
                setEditando(false);
              }}
            >
              Salvar
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNovoTempo(estado.totalS ?? 60);
              setEditando(true);
            }}
            className="alvo text-descanso-destaque flex items-center justify-center gap-1.5 text-sm underline underline-offset-4"
          >
            <Timer aria-hidden="true" className="size-4" />
            Editar tempo de descanso
          </button>
        )}

        <Button
          variant="secondary"
          className="alvo h-14 rounded-2xl text-base font-semibold"
          onClick={() => aoSomar(EXTRA_DESCANSO_S)}
        >
          <Plus className="size-5" />
          {EXTRA_DESCANSO_S} s
        </Button>
        <Button
          className="alvo bg-descanso-foreground text-descanso hover:bg-descanso-foreground/90 h-14 rounded-2xl text-base font-semibold"
          onClick={aoPular}
        >
          <SkipForward className="size-5" />
          Pular
        </Button>
      </div>
    </section>
  );
}
