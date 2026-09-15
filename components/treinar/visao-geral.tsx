"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BlocoExercicio } from "@/components/treinar/bloco";
import { ResumoDoFim } from "@/components/treinar/resumo";
import { TimerDescanso, type DescansoAtivo } from "@/components/treinar/timer-descanso";
import type { FimDaSessao, SessaoDeTreino } from "@/components/treinar/usar-sessao";
import { Button } from "@/components/ui/button";
import { acharExercicio } from "@/lib/dados";
import { formatarDuracao } from "@/lib/formato";
import { proximoExercicio, type SessaoLocal } from "@/lib/sessao";

/**
 * A visão geral da sessão (SPEC §14.1): a folha de rolagem com **todas** as
 * séries, que era a tela principal antes do player e agora é o lugar de
 * corrigir qualquer série, trocar um exercício e encerrar o treino.
 *
 * O player abre esta tela pelo ícone de lista. O estado é o mesmo — quem manda
 * nele é `useSessaoDeTreino`.
 */
export function VisaoGeralDaSessao({
  sessao,
  dados,
  videos = [],
  aoFechar,
}: {
  sessao: SessaoLocal;
  dados: SessaoDeTreino;
  /** Ids com `public/videos/<id>.mp4` (SPEC §13.1). */
  videos?: string[];
  aoFechar?: () => void;
}) {
  const [descanso, setDescanso] = useState<DescansoAtivo | null>(null);
  const [fim, setFim] = useState<FimDaSessao | null>(null);

  const { prefs, naFila, treino, plano, progresso, decorridoS, salvando } = dados;

  const preview = useMemo(
    () => (fim ? dados.previa(fim) : []),
    [fim, dados],
  );

  return (
    <div className="flex flex-col gap-3">
      <TimerDescanso
        descanso={descanso}
        aoFechar={() => setDescanso(null)}
        som={prefs.descanso_som !== false}
        vibracao={prefs.descanso_vibra !== false}
      />

      <header className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            {treino?.nome ?? (plano ? "Barra fixa" : "Treino")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {treino?.foco ?? (plano ? `semana ${plano.faixa} · ${plano.texto}` : "")}
            {naFila > 0 ? ` · ${naFila} para sincronizar` : " · sincronizado"}
          </p>
        </div>
        {aoFechar ? (
          <Button
            variant="outline"
            size="icon"
            className="alvo size-11 shrink-0"
            aria-label="Voltar ao treino"
            onClick={aoFechar}
          >
            <ChevronDown className="size-5" />
          </Button>
        ) : null}
      </header>

      {sessao.blocos.map((bloco) => (
        <BlocoExercicio
          key={bloco.ordem}
          bloco={bloco}
          temVideo={videos.includes(bloco.exercicioId)}
          historico={dados.historicoDe(bloco.exercicioId)}
          opcoes={sessao.opcoesMontagem}
          prefs={prefs}
          aoMudarSerie={(serieId, campos) =>
            dados.mudarSerie(bloco.ordem, serieId, campos)
          }
          aoMarcarSerie={(serieId, concluida) => {
            const feito = dados.marcar(bloco.ordem, serieId, concluida);
            if (feito && concluida && bloco.descansoS > 0) {
              setDescanso({
                chave: Date.now(),
                segundos: bloco.descansoS,
                exercicio: acharExercicio(bloco.exercicioId).nome,
              });
            }
          }}
          aoMudarFirme={(firme) => dados.mudarFirme(bloco.ordem, firme)}
          aoMudarNota={(nota) => dados.mudarNota(bloco.ordem, nota)}
          aoSubstituir={(novoExercicioId) => dados.substituir(bloco, novoExercicioId)}
        />
      ))}

      <Rodape
        decorridoS={decorridoS}
        seriesTexto={progresso?.texto ?? ""}
        proximo={proximoExercicio(sessao)}
        aoConcluir={() => setFim("concluida")}
        aoAbandonar={() => setFim("abandonada")}
      />

      <ResumoDoFim
        aberto={fim !== null}
        fim={fim ?? "concluida"}
        aoFechar={() => {
          if (!salvando) setFim(null);
        }}
        resultados={preview}
        duracaoS={decorridoS}
        seriesTexto={progresso?.texto ?? ""}
        salvando={salvando}
        aoSalvar={(valores) => {
          if (fim) void dados.salvar(fim, valores);
        }}
      />
    </div>
  );
}

/** Rodapé fixo: tempo, séries e as duas saídas (SPEC §3.2). */
function Rodape({
  decorridoS,
  seriesTexto,
  proximo,
  aoConcluir,
  aoAbandonar,
}: {
  decorridoS: number;
  seriesTexto: string;
  /** "próximo: Remada curvada" (SPEC §13.3). */
  proximo: string | null;
  aoConcluir: () => void;
  aoAbandonar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (relogio.current) clearTimeout(relogio.current);
  }, []);

  return (
    <>
      {/* o rodapé é fixo: este espaço impede que ele cubra o último bloco */}
      <div aria-hidden="true" className="h-28" />
      <div className="bg-card/95 border-border fixed inset-x-0 bottom-14 z-30 border-t backdrop-blur">
        {/* SPEC §13.3: o que vem depois, em linha inteira para caber o nome */}
        {proximo ? (
          <p className="text-muted-foreground mx-auto w-full max-w-lg truncate px-3 pt-1.5 text-xs">
            próximo: {proximo}
          </p>
        ) : null}
        <div className="mx-auto flex w-full max-w-lg items-center gap-2 px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="numero text-lg leading-none">
              {formatarDuracao(decorridoS)}
            </span>
            <span className="text-muted-foreground text-xs">{seriesTexto}</span>
          </div>
          {confirmando ? (
            <Button
              variant="destructive"
              className="alvo h-12 px-3"
              onClick={aoAbandonar}
            >
              Confirmar abandono
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="alvo h-12 px-3"
              onClick={() => {
                setConfirmando(true);
                relogio.current = setTimeout(() => setConfirmando(false), 5_000);
              }}
            >
              Abandonar
            </Button>
          )}
          <Button className="alvo h-12 px-4 font-semibold" onClick={aoConcluir}>
            Concluir
          </Button>
        </div>
      </div>
    </>
  );
}
