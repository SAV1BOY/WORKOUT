"use client";

import { ChevronDown, LogOut, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BlocoExercicio } from "@/components/treinar/bloco";
import { ResumoDoFim } from "@/components/treinar/resumo";
import { TimerDescanso, type DescansoAtivo } from "@/components/treinar/timer-descanso";
import type { FimDaSessao, SessaoDeTreino } from "@/components/treinar/usar-sessao";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
 *
 * SPEC §22.5: ela é um **diálogo** de verdade (`role="dialog"` + `aria-modal`),
 * fecha no Esc e no voltar do celular e devolve o foco a quem a abriu; as
 * saídas têm três verbos distintos ("Continuar depois", "Descartar este
 * treino", "Concluir") e nenhuma delas descarta nada sem um diálogo.
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
  /**
   * Fecha a lista e volta ao player. Precisa ser **estável** (`useCallback`):
   * é dependência do efeito que empilha o estado do "voltar" do celular.
   */
  aoFechar?: () => void;
}) {
  const [descanso, setDescanso] = useState<DescansoAtivo | null>(null);
  const [fim, setFim] = useState<FimDaSessao | null>(null);

  const { prefs, naFila, treino, plano, progresso, decorridoS, salvando } = dados;

  const preview = useMemo(
    () => (fim ? dados.previa(fim) : []),
    [fim, dados],
  );

  /*
   * SPEC §22.5 item 3: a lista é uma página de ~5.700 px que cobre o player
   * inteiro. Sem contrato de diálogo, a única saída era um ícone no topo — e
   * o "voltar" do celular jogava para fora do treino. Agora o Escape e o
   * voltar fecham a lista, e só ela: `pushState` põe uma entrada de história
   * para o `popstate` consumir, e quem fecha pelo botão desfaz essa entrada.
   */
  useEffect(() => {
    if (!aoFechar) return;
    window.history.pushState({ visaoGeralDoTreino: true }, "");
    const aoVoltarDoCelular = () => aoFechar();
    /*
     * SPEC §22.14 item 6: o Esc fecha só a camada de cima. Com uma folha
     * aberta por cima da lista ("substituir hoje", o "Como fazer", a
     * montagem) o Radix trata o Esc antes, na captura do document, e marca
     * `defaultPrevented`; a foto ampliada faz o mesmo. Esse Esc já foi gasto:
     * fecha a folha e a lista fica.
     */
    const naTecla = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape" || evento.defaultPrevented) return;
      evento.preventDefault();
      aoFechar();
    };
    window.addEventListener("popstate", aoVoltarDoCelular);
    window.addEventListener("keydown", naTecla);
    return () => {
      window.removeEventListener("popstate", aoVoltarDoCelular);
      window.removeEventListener("keydown", naTecla);
      /*
       * Só desfaz a entrada se ela AINDA for a do topo: quem fechou pelo
       * próprio "voltar" já a consumiu, e quem saiu do treino ("Continuar
       * depois", "Concluir") empilhou outra por cima — um `back()` cego ali
       * levaria de volta para dentro do treino que acabou de terminar.
       */
      const estado = window.history.state as { visaoGeralDoTreino?: boolean } | null;
      if (estado?.visaoGeralDoTreino) window.history.back();
    };
  }, [aoFechar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visão geral do treino"
      className="flex flex-col gap-3"
    >
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
        {/*
          SPEC §22.5 item 9: um botão só no cabeçalho, e com texto. O par de
          ícones (sair do treino · fechar a lista) fazia duas coisas
          diferentes com o mesmo peso visual; sair preservando mudou-se para o
          rodapé, junto do "Concluir".
        */}
        {aoFechar ? (
          <Button
            variant="outline"
            className="alvo shrink-0"
            onClick={aoFechar}
          >
            <ChevronDown className="size-5" />
            Fechar
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
        seriesFeitas={progresso?.feitas ?? 0}
        proximo={proximoExercicio(sessao)}
        aoFechar={aoFechar}
        aoConcluir={() => setFim("concluida")}
        aoDescartar={() => setFim("abandonada")}
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

/**
 * Rodapé fixo: tempo, séries e as saídas (SPEC §3.2 e §22.5 itens 3 e 9).
 *
 * São quatro verbos, e só um deles termina a sessão sem gravá-la:
 * "Voltar ao treino" (volta ao player), "Continuar depois" (sai preservando),
 * "Concluir" e "Descartar este treino" — este último atrás de um
 * `AlertDialog`, nunca de um segundo toque no mesmo lugar.
 */
function Rodape({
  decorridoS,
  seriesTexto,
  seriesFeitas,
  proximo,
  aoFechar,
  aoConcluir,
  aoDescartar,
}: {
  decorridoS: number;
  seriesTexto: string;
  /** Quantas séries já foram registradas — o número que o diálogo promete. */
  seriesFeitas: number;
  /** "próximo: Remada curvada" (SPEC §13.3). */
  proximo: string | null;
  aoFechar?: () => void;
  aoConcluir: () => void;
  aoDescartar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      {/* o rodapé é fixo: este espaço impede que ele cubra o último bloco */}
      <div aria-hidden="true" className="h-44" />
      {/* colado no rodapé: dentro do player não há barra de abas (§22.1) */}
      <div className="bg-card/95 border-border pb-segura fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-1.5 px-3 py-2">
          {/* SPEC §13.3: o que vem depois, em linha inteira para caber o nome */}
          {proximo ? (
            <p className="text-muted-foreground w-full truncate text-xs">
              próximo: {proximo}
            </p>
          ) : null}
          <div className="flex items-baseline gap-2">
            <span className="numero text-lg leading-none">
              {formatarDuracao(decorridoS)}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {seriesTexto}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {aoFechar ? (
              <Button variant="outline" className="alvo flex-1" onClick={aoFechar}>
                Voltar ao treino
              </Button>
            ) : null}
            <Button className="alvo flex-1 font-semibold" onClick={aoConcluir}>
              Concluir
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" className="alvo flex-1 px-2">
              <Link href="/">
                <LogOut className="size-4" />
                Continuar depois
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="alvo text-destructive hover:text-destructive flex-1 px-2"
              onClick={() => setConfirmando(true)}
            >
              <Trash2 className="size-4" />
              Descartar este treino
            </Button>
          </div>
        </div>
      </div>

      {/*
        SPEC §22.5 item 1: era uma confirmação NO MESMO PONTO — "Abandonar"
        virava "Confirmar abandono" na mesma faixa de y, e dois toques seguidos
        jogavam o treino fora sem nenhuma pergunta.
      */}
      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar este treino?</AlertDialogTitle>
            <AlertDialogDescription>
              {seriesFeitas === 0
                ? "Nenhuma série foi registrada ainda."
                : seriesFeitas === 1
                  ? "A 1 série já registrada continua salva."
                  : `As ${seriesFeitas} séries já registradas continuam salvas.`}{" "}
              O treino fica guardado como abandonado e não conta para a
              progressão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={aoDescartar}>
              Descartar este treino
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
