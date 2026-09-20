"use client";

import { Minus, Plus, SkipForward, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnelDeContagem } from "@/components/player/anel";
import { Miniatura } from "@/components/ui/miniatura";
import { StepperNumerico } from "@/components/stepper-numerico";
import { Button } from "@/components/ui/button";
import { apitar, vibrar } from "@/lib/apito";
import { acharExercicio } from "@/lib/dados";
import { formatarDuracao } from "@/lib/formato";
import { textoDaCarga, textoDoAlvo } from "@/lib/hoje";
import {
  DESCANSO_MAX_S,
  DESCANSO_MIN_S,
  EXTRA_DESCANSO_S,
  fracaoRestante,
  restanteS,
  rotuloDoPasso,
  zerou,
  type EstadoPlayer,
  type PassoSerie,
} from "@/lib/player";
import type { Implemento } from "@/lib/schemas";
import type { BlocoLocal, SerieLocal } from "@/lib/sessao";

/**
 * O descanso em tela cheia (SPEC §14.1.3): fundo laranja escurecido, a figura
 * do próximo passo, o rótulo do próximo passo com a posição do exercício, a
 * contagem grande **dentro do anel** e os controles — editar tempo, −20 s,
 * +20 s e pular.
 *
 * Ao zerar: bipe (WebAudio, sempre), vibração onde existir e, com
 * `avancarSozinho`, a passagem automática depois de 1 s. SPEC §22.5 item 7: o
 * bipe deixou de ser o ÚNICO aviso — um `role="status"` só-leitor anuncia os
 * marcos de 30 s, 10 s e o fim, para quem desligou o som ou não o ouve.
 */
export function TelaDescanso({
  estado,
  agora,
  proximo,
  blocoDoProximo,
  serieDoProximo,
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
  /**
   * A série do próximo passo. Num passo de **aquecimento** o alvo é o dela
   * (5 reps com a barra vazia), não as séries de trabalho do bloco — mostrar
   * "3 × 5" sob "AQUECIMENTO 2 DE 2" era o defeito da auditoria do marco V2.
   */
  serieDoProximo: SerieLocal | null;
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

  return (
    <section
      aria-label="Descanso"
      data-tela="descanso"
      className="bg-descanso text-descanso-foreground fixed inset-0 z-50 flex flex-col items-center justify-between gap-4 overflow-y-auto px-4 pt-8"
      /* a área segura entra somada aos 2rem de respiro: o "Pular" é o botão
         mais baixo da tela e não pode ficar sob o indicador de home (§22.1) */
      style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        {/*
          SPEC §22.5 item 10: uma grafia só. O exercício escreve "Aquecimento
          2 de 2 · exercício 1 de 6"; aqui era "Próximo 2/6" ou só "Aquecimento
          2 de 2", duas formas diferentes para a mesma informação. O caixa-alta
          é do CSS, não do texto.
        */}
        <p className="text-descanso-destaque text-xs font-semibold tracking-[0.2em] uppercase">
          {proximo
            ? `${rotuloDoPasso(proximo)} · exercício ${proximo.posicao} de ${proximo.totalExercicios}`
            : "Descanso"}
        </p>
        {blocoDoProximo && exercicio ? (
          <>
            <Miniatura exercicioId={blocoDoProximo.exercicioId} className="size-24" />
            <h2 className="text-lg font-semibold text-balance">{exercicio.nome}</h2>
            <p className="text-descanso-destaque numero text-sm">
              {proximo?.aquecimento
                ? textoDoAquecimento(exercicio.implemento, serieDoProximo)
                : textoDoAlvo(blocoDoProximo.prescricao.series, blocoDoProximo.alvo)}
            </p>
          </>
        ) : null}
      </div>

      {/*
        SPEC §22.5 item 8: o anel que a preparação já tinha. A leitura
        periférica do tempo passa a existir também aqui — e é ela que carrega
        o peso visual da tela, no lugar do "Pular".
      */}
      <AnelDeContagem
        fracao={fracaoRestante(estado, agora)}
        tamanho={220}
        classeTrilho="stroke-descanso-foreground/25"
        classeArco="stroke-descanso-destaque"
      >
        <p className="text-descanso-destaque text-xs font-semibold tracking-[0.2em] uppercase">
          Descanso
        </p>
        <span
          role="timer"
          aria-label="Descanso"
          className="numero-grande text-6xl leading-none tabular-nums"
        >
          {formatarDuracao(falta)}
        </span>
      </AnelDeContagem>
      <p role="status" className="sr-only">
        {avisoDoDescanso(falta, estado.totalS ?? 0, acabou)}
      </p>

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

        {/*
          SPEC §22.5 item 7: dois alvos de 56 px, o sinal em TEXTO ("+20 s" e
          "−20 s", não só um ícone) e o nome acessível dizendo o que cada um
          faz. Antes havia um botão só, "+20 s", e nenhum jeito de desfazer.
        */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            aria-label={`Tirar ${EXTRA_DESCANSO_S} segundos do descanso`}
            disabled={falta <= 0}
            className="alvo border-descanso-destaque/50 text-descanso-destaque hover:bg-descanso-destaque/15 hover:text-descanso-destaque h-14 flex-1 rounded-2xl border text-base font-semibold"
            onClick={() => aoSomar(-Math.min(EXTRA_DESCANSO_S, falta))}
          >
            <Minus className="size-5" />
            {EXTRA_DESCANSO_S} s
          </Button>
          <Button
            variant="ghost"
            aria-label={`Somar ${EXTRA_DESCANSO_S} segundos ao descanso`}
            className="alvo border-descanso-destaque/50 text-descanso-destaque hover:bg-descanso-destaque/15 hover:text-descanso-destaque h-14 flex-1 rounded-2xl border text-base font-semibold"
            onClick={() => aoSomar(EXTRA_DESCANSO_S)}
          >
            <Plus className="size-5" />
            {EXTRA_DESCANSO_S} s
          </Button>
        </div>
        {/*
          SPEC §22.5 item 8: "Pular descanso" era o botão mais forte da tela —
          branco cheio sobre o marrom. Um app de treino não empurra ninguém a
          cortar o descanso: vira contorno, e o peso fica no anel.
        */}
        <Button
          variant="ghost"
          className="alvo border-descanso-foreground/40 text-descanso-foreground hover:bg-descanso-foreground/10 hover:text-descanso-foreground h-14 rounded-2xl border text-base font-medium"
          onClick={aoPular}
        >
          <SkipForward className="size-5" />
          Pular descanso
        </Button>
      </div>
    </section>
  );
}

/**
 * O que o leitor de tela ouve durante o descanso (SPEC §22.5 item 7).
 *
 * O texto só muda em MARCOS — 30 s, 10 s e o fim. Um `role="status"` que
 * mudasse a cada segundo faria o leitor falar por cima de si mesmo; um
 * `role="timer"` sozinho (o que havia) tem `aria-live` desligado por padrão e
 * nunca anuncia nada.
 */
export function avisoDoDescanso(
  falta: number,
  totalS: number,
  acabou: boolean,
): string {
  if (acabou) return "Descanso terminado, próxima série.";
  if (falta <= 10 && totalS > 10) return "Faltam 10 segundos de descanso.";
  if (falta <= 30 && totalS > 30) return "Faltam 30 segundos de descanso.";
  return "";
}

/** "5 × 7,5 kg na barra" — o alvo da própria série de aquecimento (§14.1.2). */
function textoDoAquecimento(
  implemento: Implemento,
  serie: SerieLocal | null,
): string {
  if (!serie) return "aquecimento";
  const reps = serie.repsAlvoMax ?? serie.repsAlvoMin ?? serie.reps;
  const carga = textoDaCarga(implemento, serie.cargaKg);
  return reps === null ? carga : `${reps} × ${carga}`;
}
