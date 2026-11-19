"use client";

import { List, Pencil, SkipForward, Timer } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { AnelDeContagem } from "@/components/player/anel";
import { Miniatura } from "@/components/ui/miniatura";
import { StepperNumerico } from "@/components/stepper-numerico";
import { Button } from "@/components/ui/button";
import { acharExercicio } from "@/lib/dados";
import { nomeAcessivel } from "@/lib/midia";
import { formatarDuracao } from "@/lib/formato";
import { textoDaCarga, textoDoAlvo } from "@/lib/hoje";
import {
  avisoDoDescanso,
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
import { MENSAGEM_CRONOMETRO_ALTERADO } from "@/lib/queries/sessao";
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
  avancarSozinho,
  ajustando,
  aviso = "",
  registrado,
  aoAbrirFicha,
  aoAbrirLista,
  botaoDaLista,
  aoCorrigir,
  aoSomar,
  aoDefinir,
  proximasSeries,
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
  avancarSozinho: boolean;
  ajustando: boolean;
  /**
   * "Série 2 de 3 registrada: …" (SPEC §22.5 item 10). Ele chega aqui porque
   * a tela de exercício **sai do ar** no mesmo toque que grava: o `status`
   * dela nunca chegaria a ser lido. Some assim que um marco do descanso tem
   * algo a dizer.
   */
  aviso?: string;
  registrado: string | null;
  aoAbrirFicha: () => void;
  aoAbrirLista?: () => void;
  botaoDaLista: (botao: HTMLButtonElement | null) => void;
  aoCorrigir: () => void;
  aoSomar: (segundos: number) => Promise<void>;
  aoDefinir: (segundos: number) => Promise<void>;
  proximasSeries?: {
    exercicio: string;
    segundos: number | null;
    aoGuardar: (segundos: number | null) => Promise<void>;
  };
  aoPular: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [novoTempo, setNovoTempo] = useState<number | null>(estado.totalS ?? 60);
  const [usarNasProximas, setUsarNasProximas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [erro, setErro] = useState("");
  const emGravacao = useRef(false);
  const botaoEditar = useRef<HTMLButtonElement>(null);
  const editorId = useId();
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

  useEffect(() => {
    // O relógio pode zerar durante a edição. Aguarda a pessoa concluir antes de trocar a tela.
    if (!acabou || !avancarSozinho || editando) return;
    const relogio = setTimeout(() => pular.current(), 1_000);
    return () => clearTimeout(relogio);
  }, [acabou, avancarSozinho, editando]);

  function fecharEditor() {
    setEditando(false);
    botaoEditar.current?.focus();
  }

  async function guardarEdicao(gravar: () => Promise<void>, origem: HTMLButtonElement) {
    if (emGravacao.current) return;
    emGravacao.current = true;
    setGuardando(true);
    setErro("");
    try {
      await gravar();
      fecharEditor();
    } catch (falha) {
      setErro(recadoDaGravacao(falha));
      requestAnimationFrame(() => origem.focus());
    } finally {
      emGravacao.current = false;
      setGuardando(false);
    }
  }

  async function somar(segundos: number) {
    setErro("");
    try {
      await aoSomar(segundos);
      setErro("");
    } catch (falha) {
      setErro(recadoDaGravacao(falha));
    }
  }

  const exercicio = blocoDoProximo
    ? acharExercicio(blocoDoProximo.exercicioId)
    : null;
  const anelCompacto = editando && Boolean(proximasSeries);

  return (
    <section
      aria-label="Descanso"
      data-tela="descanso"
      className="bg-descanso text-descanso-foreground fixed inset-0 z-50 flex flex-col items-center justify-between gap-2 overflow-y-auto px-4 pt-3"
      /* a área segura entra somada aos 2rem de respiro: o "Pular" é o botão
         mais baixo da tela e não pode ficar sob o indicador de home (§22.1) */
      style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        {registrado && (
          <button type="button" className="alvo flex flex-wrap items-center justify-center gap-x-1.5 text-sm"
            onClick={aoCorrigir} disabled={guardando} aria-label={`Corrigir a série. ${registrado}`}>
            <Pencil className="size-4" aria-hidden="true" />
            <span className="underline underline-offset-2">Corrigir a série</span>
            <span>{registrado}</span>
          </button>
        )}
        {proximo && <p className="text-rotulo tracking-wide uppercase">A seguir</p>}
        {/*
          SPEC §22.5 item 10: uma grafia só. O exercício escreve "Aquecimento
          2 de 2 · exercício 1 de 6"; aqui era "Próximo 2/6" ou só "Aquecimento
          2 de 2", duas formas diferentes para a mesma informação. O caixa-alta
          é do CSS, não do texto.
        */}
        <p className="text-descanso-destaque text-xs font-semibold tracking-wide text-balance uppercase">
          {proximo
            ? `${rotuloDoPasso(proximo)} · exercício ${proximo.posicao} de ${proximo.totalExercicios}`
            : "Descanso"}
        </p>
        {blocoDoProximo && exercicio ? (
          <>
            <h2 aria-label={exercicio.nome}>
              <button type="button" className="alvo flex items-center justify-center gap-2 text-lg font-semibold text-balance"
                aria-label={nomeAcessivel("Como fazer", exercicio.nome)} onClick={aoAbrirFicha} disabled={guardando}>
                <Miniatura exercicioId={blocoDoProximo.exercicioId} className="size-14" />
                {exercicio.nome}
              </button>
            </h2>
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
        tamanho={anelCompacto ? 156 : 220}
        classeTrilho="stroke-descanso-foreground/25"
        classeArco="stroke-descanso-destaque"
      >
        <p className="text-descanso-destaque text-xs font-semibold tracking-[0.2em] uppercase">
          Descanso
        </p>
        <span
          role="timer"
          aria-label="Descanso"
          aria-busy={ajustando}
          className={`numero-grande leading-none tabular-nums ${anelCompacto ? "text-5xl" : "text-6xl"}`}
        >
          {formatarDuracao(falta)}
        </span>
      </AnelDeContagem>
      <p role="status" className="sr-only">
        {avisoDoDescanso(falta, estado.totalS ?? 0, acabou) || aviso}
      </p>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <div className="flex items-center justify-center gap-3">
          <button
            ref={botaoEditar}
            type="button"
            aria-expanded={editando}
            aria-controls={editando ? editorId : undefined}
            aria-disabled={guardando}
            onClick={() => {
              if (emGravacao.current) return;
              if (editando) {
                fecharEditor();
                return;
              }
              setNovoTempo(estado.totalS ?? 60);
              setUsarNasProximas(false);
              setErro("");
              setEditando(true);
            }}
            className="alvo text-descanso-destaque flex items-center justify-center gap-1.5 text-sm underline underline-offset-4"
          >
            <Timer aria-hidden="true" className="size-4" />
            Editar tempo de descanso
          </button>
          {aoAbrirLista && !editando && (
            <button type="button" ref={botaoDaLista} aria-label="Visão geral do treino"
              onClick={aoAbrirLista} className="alvo text-descanso-destaque flex items-center justify-center gap-1.5 text-sm underline underline-offset-4">
              <List className="size-4 shrink-0" aria-hidden="true" />
              Visão geral
            </button>
          )}
        </div>
        {proximasSeries?.segundos != null && (
          <p className="text-descanso-destaque text-center text-sm" role="status">
            {editando ? "Tempo salvo" : `Próximas séries de ${proximasSeries.exercicio}`} · {formatarDuracao(proximasSeries.segundos)}
          </p>
        )}
        {editando && (
          <fieldset id={editorId} disabled={guardando} className="flex min-w-0 flex-col gap-1">
            <legend className="sr-only">Editar tempo de descanso</legend>
            {proximasSeries && (
              <label className="alvo flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={usarNasProximas}
                  className="size-5 shrink-0 accent-current"
                  onChange={evento => setUsarNasProximas(evento.target.checked)} />
                Usar nas próximas séries de {proximasSeries.exercicio}
              </label>
            )}
            {/* O campo usa as cores do tema normal para manter o contraste nos dois temas. */}
            <div className="text-foreground flex items-center gap-2">
              <StepperNumerico
                rotulo="tempo de descanso em segundos"
                valor={novoTempo}
                passo={10}
                minimo={DESCANSO_MIN_S}
                maximo={DESCANSO_MAX_S}
                aoMudar={setNovoTempo}
              />
              <Button variant="secondary" className="alvo h-11 shrink-0"
                onClick={evento => {
                  const segundos = novoTempo ?? DESCANSO_MIN_S;
                  void guardarEdicao(
                    () => usarNasProximas && proximasSeries ? proximasSeries.aoGuardar(segundos) : aoDefinir(segundos),
                    evento.currentTarget,
                  );
                }}>
                Salvar
              </Button>
            </div>
            {proximasSeries?.segundos != null && (
              <button type="button" className="alvo text-descanso-destaque text-sm underline underline-offset-4"
                onClick={evento => void guardarEdicao(() => proximasSeries.aoGuardar(null), evento.currentTarget)}>
                Restaurar padrão para as próximas séries
              </button>
            )}
          </fieldset>
        )}
        {erro && <p role="alert" className="text-sm">{erro}</p>}

        {/*
          SPEC §22.5 item 7: dois alvos de 56 px, o sinal em TEXTO ("+20 s" e
          "−20 s", não só um ícone) e o nome acessível dizendo o que cada um
          faz. Antes havia um botão só, "+20 s", e nenhum jeito de desfazer.
        */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            aria-label={`Tirar ${EXTRA_DESCANSO_S} segundos do descanso`}
            disabled={(!ajustando && falta <= 0) || guardando}
            className="alvo border-descanso-destaque/50 text-descanso-destaque hover:bg-descanso-destaque/15 hover:text-descanso-destaque h-14 flex-1 rounded-2xl border text-base font-semibold"
            onClick={() => void somar(-EXTRA_DESCANSO_S)}
          >
            −{EXTRA_DESCANSO_S} s
          </Button>
          <Button
            variant="ghost"
            aria-label={`Somar ${EXTRA_DESCANSO_S} segundos ao descanso`}
            disabled={guardando}
            className="alvo border-descanso-destaque/50 text-descanso-destaque hover:bg-descanso-destaque/15 hover:text-descanso-destaque h-14 flex-1 rounded-2xl border text-base font-semibold"
            onClick={() => void somar(EXTRA_DESCANSO_S)}
          >
            +{EXTRA_DESCANSO_S} s
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
          disabled={guardando}
        >
          <SkipForward className="size-5" />
          Pular descanso
        </Button>
      </div>
    </section>
  );
}

function recadoDaGravacao(falha: unknown): string {
  return falha instanceof Error && falha.message === MENSAGEM_CRONOMETRO_ALTERADO
    ? MENSAGEM_CRONOMETRO_ALTERADO : "Não foi possível guardar o descanso. Tente novamente.";
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
