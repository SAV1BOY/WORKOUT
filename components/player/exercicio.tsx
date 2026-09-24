"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  List,
  Pause,
  Play,
  Settings,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MediaGrande } from "@/components/exercicio/media-grande";
import { StepperNumerico } from "@/components/stepper-numerico";
import { BotaoMontagem } from "@/components/treinar/montagem";
import { SeletorAssistencia } from "@/components/treinar/serie";
import { Button } from "@/components/ui/button";
import { acharExercicio } from "@/lib/dados";
import { formatarDuracao, formatarKg, rotuloDaCarga } from "@/lib/formato";
import {
  alcancavelParaBaixo,
  cargasPossiveis,
  type ImplementoMontagem,
  type OpcoesMontagem,
} from "@/lib/montagem";
import {
  avisoDoPolegar,
  pontosDoBloco,
  rotuloDoPasso,
  serieAnteriorDe,
  type EntradaDoPasso,
  type PassoSerie,
  type SerieDeOutroDia,
} from "@/lib/player";
import type { VotoDoExercicio } from "@/lib/preferencias";
import { proximaCarga, type BlocoLocal, type SerieLocal } from "@/lib/sessao";
import { cn } from "@/lib/utils";

/**
 * A tela de exercício do player (SPEC §14.1.2): figura grande, barra fina de
 * progresso, nome com "?", o bloco central conforme o tipo, os controles
 * fixos (anterior · ✓ · próximo) e os ícones do topo.
 *
 * SPEC §22.5 item 10: gravar uma série era **completamente silencioso** para
 * quem usa leitor de tela. Agora a rota tem `h1`, a barra de progresso diz
 * onde se está em palavras e um `role="status"` só-leitor anuncia a série
 * registrada e o descanso que começa.
 */
export function TelaExercicio({
  passo,
  bloco,
  serie,
  entrada,
  opcoes,
  temVideo,
  anteriores,
  voto,
  feitas,
  total,
  nomeDoTreino,
  aviso,
  pedidoDeFoco = 0,
  aoMudar,
  aoConcluir,
  aoAnterior,
  aoProximo,
  aoAbrirFicha,
  aoAbrirLista,
  aoAjustar,
  aoAvaliar,
}: {
  passo: PassoSerie;
  bloco: BlocoLocal;
  serie: SerieLocal;
  entrada: EntradaDoPasso;
  opcoes: OpcoesMontagem;
  temVideo: boolean;
  /** As séries do mesmo exercício na última sessão (SPEC §14.1.2). */
  anteriores?: SerieDeOutroDia[];
  /** "preferido", "evitado" ou `null` — ninguém votou ainda (SPEC §22.1). */
  voto: VotoDoExercicio;
  feitas: number;
  total: number;
  /** "Treino B" — entra no `h1` só-leitor da rota (SPEC §22.5 item 10). */
  nomeDoTreino: string;
  /** "Série 2 de 3 registrada: …" — o que o leitor de tela ouve ao gravar. */
  aviso: string;
  /**
   * Muda quando a Visão geral fecha: o foco volta ao botão que a abriu
   * (SPEC §22.5 item 3). Zero = ninguém pediu nada ainda.
   */
  pedidoDeFoco?: number;
  aoMudar: (campos: Partial<SerieLocal>) => void;
  aoConcluir: () => void;
  aoAnterior: () => void;
  aoProximo: () => void;
  aoAbrirFicha: () => void;
  aoAbrirLista: () => void;
  aoAjustar: () => void;
  /** Grava o voto; devolve se gravou (sem perfil não há onde gravar). */
  aoAvaliar: (voto: VotoDoExercicio) => boolean;
}) {
  const exercicio = acharExercicio(bloco.exercicioId);
  const implemento = exercicio.implemento as ImplementoMontagem;
  const incremento = bloco.alvo.incremento_kg;
  const anterior = serieAnteriorDe(anteriores, passo.numero);
  /** "Aquecimento 2 de 2 · exercício 1 de 6" — a mesma grafia do descanso. */
  const ondeEstou = `${rotuloDoPasso(passo)} · exercício ${passo.posicao} de ${passo.totalExercicios}`;

  const botaoDaLista = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (pedidoDeFoco > 0) botaoDaLista.current?.focus();
  }, [pedidoDeFoco]);

  const pontos = pontosDoBloco(bloco, passo);

  /**
   * O voto, com o aviso do que ele faz e o "Desfazer" (SPEC §22.16 item 6).
   * O aviso só confirma o que foi gravado: sem perfil, ele diz que o voto
   * não foi anotado, e não há "Desfazer". O "Desfazer" grava o voto de antes
   * sobre as preferências de agora (`aoAvaliar` lê o cache na hora).
   */
  const votar = (novo: VotoDoExercicio) => {
    const antes = voto;
    const aviso = avisoDoPolegar(exercicio.nome, novo, aoAvaliar(novo));
    if (!aviso.desfazer) {
      toast(aviso.texto);
      return;
    }
    toast(aviso.texto, {
      action: { label: "Desfazer", onClick: () => aoAvaliar(antes) },
      // ≥ 44 px e anel de destaque no foco (app/globals.css, §22.16 item 6)
      classNames: { actionButton: "aviso-desfazer" },
    });
  };

  /**
   * Carga digitada à mão (SPEC §6.4 e §10.5): o ± anda pela escala, mas o
   * teclado aceita qualquer número — o que o kit não monta cai na alcançável
   * para baixo, com aviso.
   */
  const mudarCarga = (kg: number | null) => {
    if (kg === null) {
      aoMudar({ cargaKg: null });
      return;
    }
    const escala = cargasPossiveis(implemento, opcoes);
    if (escala.length < 2) {
      aoMudar({ cargaKg: kg });
      return;
    }
    const possivel = alcancavelParaBaixo(kg, implemento, opcoes);
    if (Math.abs(possivel - kg) > 1e-9) {
      toast.info(
        `${formatarKg(kg)} não fecha com estas anilhas: ficou ${formatarKg(possivel)} ${rotuloDaCarga(exercicio.implemento)}.`,
      );
    }
    aoMudar({ cargaKg: possivel });
  };

  return (
    <section
      aria-label={`${rotuloDoPasso(passo)} — ${exercicio.nome}`}
      /* pb-24: os controles são 72 px colados no rodapé (§22.1) — os 160 px
         de antes reservavam também a barra de abas, que o player não tem */
      className="flex flex-1 flex-col gap-3 pb-24"
    >
      {/* SPEC §22.5 item 10: era a única rota do app sem `h1` */}
      <h1 className="sr-only">
        {nomeDoTreino} — exercício {passo.posicao} de {passo.totalExercicios}
      </h1>
      {/* o que acabou de ser gravado, para quem não vê a tela mudar */}
      <p role="status" className="sr-only">
        {aviso}
      </p>

      {/*
        ícones do topo (SPEC §14.1.2 e §22.16 item 6): só dois, um em cada
        canto — os polegares desceram para a linha do nome, onde dizem de
        quem é o voto, e deixaram de ficar a 2 px um do outro.
      */}
      <div className="flex items-center justify-between gap-2 px-3 pt-1">
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
        <Button
          variant="ghost"
          size="icon"
          className="alvo"
          aria-label="Ajustar"
          onClick={aoAjustar}
        >
          <Settings className="size-5" />
        </Button>
      </div>

      {/* barra fina de progresso do treino */}
      <div
        role="progressbar"
        aria-label="Progresso do treino"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={feitas}
        aria-valuetext={`exercício ${passo.posicao} de ${passo.totalExercicios}`}
        className="bg-muted mx-3 h-1 overflow-hidden rounded-full"
      >
        <span
          aria-hidden="true"
          className="bg-primary block h-full rounded-full transition-[width]"
          style={{ width: `${total > 0 ? (feitas / total) * 100 : 0}%` }}
        />
      </div>

      <MediaGrande
        exercicioId={bloco.exercicioId}
        temVideo={temVideo}
        semCredito
        /* SPEC §22.13 item 5: tocar na figura abre o "Como fazer", como o
           "?" ao lado do nome; a pausa é o botão do canto */
        aoAbrir={aoAbrirFicha}
        rotuloDoAbrir="abre o Como fazer"
        /* h-36: com h-44 o chip "montagem" ficava 1,6 px sob a barra de
           controles numa série com histórico, a 360 × 740 (§13.8.1); h-40
           virou h-36 para caber a fileira de pontos (§22.16 item 5) */
        className="h-36"
      />

      <div className="flex items-center justify-center gap-2 px-3">
        <h2 className="min-w-0 text-lg leading-tight font-semibold text-balance">
          {exercicio.nome}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="alvo shrink-0"
            aria-label={`Como fazer: ${exercicio.nome}`}
            onClick={aoAbrirFicha}
          >
            <CircleHelp className="size-5" />
          </Button>
          {/*
            SPEC §22.1: sem voto os dois polegares ficam neutros e nenhum
            `aria-pressed` afirma uma escolha que o usuário não fez. Tocar de
            novo no polegar aceso desfaz o voto — os três estados, no mesmo
            par. §22.16 item 6: cada toque diz o que aconteceu, com
            "Desfazer" (o voto de antes volta).
          */}
          <Button
            variant="ghost"
            size="icon"
            className={cn("alvo size-11", voto === "preferido" && "text-primary")}
            aria-label="Gostei deste exercício"
            aria-pressed={voto === null ? undefined : voto === "preferido"}
            onClick={() => votar(voto === "preferido" ? null : "preferido")}
          >
            <ThumbsUp className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("alvo size-11", voto === "evitado" && "text-destructive")}
            aria-label="Não gosto deste exercício"
            aria-pressed={voto === null ? undefined : voto === "evitado"}
            onClick={() => votar(voto === "evitado" ? null : "evitado")}
          >
            <ThumbsDown className="size-5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 px-3">
        {/* um ponto por série deste exercício (SPEC §22.16 item 5) */}
        <div
          role="img"
          aria-label={pontos.rotulo}
          data-pontos-do-bloco
          className="flex items-center justify-center gap-1.5"
        >
          {pontos.pontos.map((ponto, i) => (
            <span
              key={i}
              aria-hidden="true"
              data-ponto={ponto.feita ? "feita" : "a-fazer"}
              className={cn(
                "block rounded-full border-2",
                ponto.aquecimento ? "size-2.5" : "size-3.5",
                ponto.feita
                  ? "bg-primary border-primary"
                  : ponto.atual
                    ? "border-primary"
                    : "border-muted-foreground",
              )}
            />
          ))}
        </div>
        <p className="text-muted-foreground text-center text-sm">
          {ondeEstou}
          {bloco.substituido
            ? ` · no lugar de ${acharExercicio(bloco.originalId).nome}`
            : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3 px-3">
        <MioloDoPasso
          entrada={entrada}
          bloco={bloco}
          serie={serie}
          incremento={incremento}
          implemento={implemento}
          opcoes={opcoes}
          aoMudar={aoMudar}
          aoMudarCarga={mudarCarga}
        />

        {/*
          "anterior: …" e o chip "montagem" na MESMA linha: em pilha, com as
          duas, a tela de 740 px deixava o chip ~11 px por baixo da barra de
          controles (auditoria do marco V2). Juntos cabem de uma vez.
        */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {anterior && !passo.aquecimento ? (
            <p className="text-muted-foreground numero text-center text-sm">
              anterior: {textoDoAnterior(anterior, exercicio.implemento)}
            </p>
          ) : null}
          <BotaoMontagem
            exercicioId={bloco.exercicioId}
            carga={serie.cargaKg}
            opcoes={opcoes}
          />
        </div>
      </div>

      <ControlesDoPlayer
        concluida={serie.concluida}
        aoAnterior={aoAnterior}
        aoProximo={aoProximo}
        aoConcluir={aoConcluir}
      />
    </section>
  );
}

/** "9,5 kg × 5" · "45 s" · "12 reps" — o que ficou registrado da última vez. */
function textoDoAnterior(
  serie: SerieDeOutroDia,
  implemento: Parameters<typeof rotuloDaCarga>[0],
): string {
  const partes: string[] = [];
  if (serie.carga_kg !== null && serie.carga_kg > 0) {
    partes.push(`${formatarKg(serie.carga_kg)} ${rotuloDaCarga(implemento)}`);
  }
  if (serie.reps !== null) partes.push(`× ${serie.reps}`);
  else if (serie.tempo_s !== null) partes.push(`${serie.tempo_s} s`);
  return partes.join(" ") || "—";
}

/** O bloco central, conforme o tipo do passo (SPEC §14.1.2). */
function MioloDoPasso({
  entrada,
  bloco,
  serie,
  incremento,
  implemento,
  opcoes,
  aoMudar,
  aoMudarCarga,
}: {
  entrada: EntradaDoPasso;
  bloco: BlocoLocal;
  serie: SerieLocal;
  incremento: number;
  implemento: ImplementoMontagem;
  opcoes: OpcoesMontagem;
  aoMudar: (campos: Partial<SerieLocal>) => void;
  aoMudarCarga: (kg: number | null) => void;
}) {
  const exercicio = acharExercicio(bloco.exercicioId);
  const rotuloReps =
    entrada.tipo === "maximo" ? "repetições feitas" : "repetições";

  return (
    <div className="flex flex-col gap-3">
      {entrada.tipo === "assistida" ? (
        <SeletorAssistencia
          valor={serie.assistencia}
          aoMudar={(a) => aoMudar({ assistencia: a })}
        />
      ) : null}

      {entrada.tipo === "tempo" ? (
        <Cronometro
          alvoS={serie.tempoS}
          unilateral={entrada.unilateral}
          concluida={serie.concluida}
          aoMudar={(segundos) =>
            aoMudar({
              tempoS: segundos,
              ...(entrada.unilateral ? { tempoSLado2: segundos } : {}),
            })
          }
        />
      ) : entrada.tipo === "passos" ? (
        <LinhaGrande rotulo="passos">
          <StepperNumerico
            grande
            rotulo="passos"
            valor={serie.passos}
            passo={1}
            aoMudar={(v) => aoMudar({ passos: v })}
          />
        </LinhaGrande>
      ) : (
        <LinhaGrande rotulo={entrada.unilateral ? "reps (D)" : rotuloReps}>
          <StepperNumerico
            grande
            rotulo={entrada.unilateral ? "repetições do lado direito" : rotuloReps}
            valor={serie.reps}
            passo={1}
            aoMudar={(v) => aoMudar({ reps: v })}
          />
        </LinhaGrande>
      )}

      {entrada.unilateral ? (
        <LinhaGrande rotulo={entrada.tipo === "tempo" ? "segundos (E)" : "reps (E)"}>
          <StepperNumerico
            grande
            rotulo={
              entrada.tipo === "tempo"
                ? "segundos do lado esquerdo"
                : "repetições do lado esquerdo"
            }
            valor={entrada.tipo === "tempo" ? serie.tempoSLado2 : serie.repsLado2}
            passo={entrada.tipo === "tempo" ? 5 : 1}
            aoMudar={(v) =>
              aoMudar(entrada.tipo === "tempo" ? { tempoSLado2: v } : { repsLado2: v })
            }
          />
        </LinhaGrande>
      ) : null}

      {entrada.comCarga ? (
        /* SPEC §22.5 item 10: "NA BARRA" sozinho não diz o que é o número */
        <LinhaGrande rotulo={`carga ${rotuloDaCarga(exercicio.implemento)}`}>
          <StepperNumerico
            grande
            decimal
            rotulo={`carga ${rotuloDaCarga(exercicio.implemento)}`}
            valor={serie.cargaKg}
            passo={incremento > 0 ? incremento : 1}
            aoAndar={(direcao) =>
              aoMudar({
                cargaKg: proximaCarga(
                  serie.cargaKg ?? 0,
                  implemento,
                  incremento,
                  direcao,
                  opcoes,
                ),
              })
            }
            aoMudar={aoMudarCarga}
          />
        </LinhaGrande>
      ) : null}
    </div>
  );
}

function LinhaGrande({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-center text-rotulo tracking-wide uppercase">
        {rotulo}
      </span>
      {children}
    </div>
  );
}

/**
 * Contagem regressiva dos exercícios de tempo (SPEC §14.1.2). O relógio é o do
 * sistema: o número que fica registrado é o tempo que passou de verdade.
 */
function Cronometro({
  alvoS,
  unilateral,
  concluida,
  aoMudar,
}: {
  alvoS: number | null;
  unilateral: boolean;
  concluida: boolean;
  aoMudar: (segundos: number) => void;
}) {
  const alvo = alvoS ?? 0;
  const [rodando, setRodando] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const comeco = useRef(0);
  const ultimo = useRef<number | null>(null);
  const aviso = useRef(aoMudar);

  useEffect(() => {
    aviso.current = aoMudar;
  });

  useEffect(() => {
    if (concluida) setRodando(false);
  }, [concluida]);

  useEffect(() => {
    if (!rodando) return;
    comeco.current = Date.now() - feitos * 1000;
    ultimo.current = null;
    const relogio = setInterval(() => {
      const segundos = Math.round((Date.now() - comeco.current) / 1000);
      if (segundos === ultimo.current) return;
      ultimo.current = segundos;
      setFeitos(segundos);
      // uma gravação por segundo: recarregar no meio não perde o que passou
      aviso.current(segundos);
    }, 250);
    return () => clearInterval(relogio);
    // `feitos` entra só na retomada: o efeito não pode reiniciar a cada tique
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando]);

  const falta = Math.max(0, alvo - feitos);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-muted-foreground text-rotulo tracking-wide uppercase">
        {unilateral ? "segundos (D)" : "segundos"}
      </span>
      <span
        role="timer"
        aria-label="Contagem do exercício"
        className="numero-grande text-5xl tabular-nums"
      >
        {formatarDuracao(rodando || feitos > 0 ? falta : alvo)}
      </span>
      {/* SPEC §22.5 item 7: `role="timer"` tem `aria-live` desligado — sem
          isto o fim da contagem só existia para quem ouve o bipe */}
      <p role="status" className="sr-only">
        {avisoDaContagem(rodando, falta, alvo)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant={rodando ? "default" : "outline"}
          className="alvo h-14 rounded-2xl px-5 text-base"
          onClick={() => setRodando((r) => !r)}
        >
          {rodando ? <Pause className="size-5" /> : <Play className="size-5" />}
          {rodando ? "Pausar" : feitos > 0 ? "Continuar" : "Começar"}
        </Button>
        <StepperNumerico
          rotulo={unilateral ? "segundos do lado direito" : "segundos"}
          valor={alvoS}
          passo={5}
          aoMudar={(v) => {
            setRodando(false);
            setFeitos(0);
            aoMudar(v ?? 0);
          }}
        />
      </div>
    </div>
  );
}

/**
 * anterior · ✓ · próximo, fixos no rodapé (SPEC §14.1.2).
 *
 * Colados em `bottom-0`: a barra de abas devolve `null` no player (SPEC
 * §14.1), e os 56 px que a barra ocuparia eram faixa morta — 56 px a menos
 * para a figura e para os números, no aparelho onde isso mais custa. O
 * `pb-segura` põe por baixo dos botões a área do indicador de home, para o
 * ✓ não ficar sob ele.
 */
export function ControlesDoPlayer({
  concluida,
  aoAnterior,
  aoProximo,
  aoConcluir,
}: {
  concluida: boolean;
  aoAnterior: () => void;
  aoProximo: () => void;
  aoConcluir: () => void;
}) {
  return (
    <div className="bg-card/95 border-border pb-segura fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur">
      {/*
        SPEC §22.5 item 6: eram 8 px (`gap-2`) entre gravar a série e pulá-la
        sem gravar. Agora são 24 px (`gap-6`) de cada lado do primário, e as
        setas descem para os 44 px padrão do projeto — o ✓ continua com 56 px
        e é o único alvo grande da barra.
      */}
      <div className="mx-auto flex w-full max-w-lg items-center gap-6 px-3 py-2">
        <Button
          variant="outline"
          size="icon"
          className="alvo shrink-0 rounded-2xl"
          aria-label="Passo anterior"
          onClick={aoAnterior}
        >
          <ChevronLeft className="size-6" />
        </Button>
        <Button
          size="xl"
          /* SPEC §22.5 item 10: o nome acessível é o texto que está escrito */
          className="alvo min-w-0 flex-1 rounded-2xl px-3 font-semibold"
          onClick={aoConcluir}
        >
          <Check className="size-6" strokeWidth={3} />
          {concluida ? "Série feita" : "Concluir série"}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="alvo shrink-0 rounded-2xl"
          aria-label="Próximo passo"
          onClick={aoProximo}
        >
          <ChevronRight className="size-6" />
        </Button>
      </div>
    </div>
  );
}

/** O que o leitor de tela ouve na contagem de um exercício de tempo. */
function avisoDaContagem(rodando: boolean, falta: number, alvo: number): string {
  if (!rodando) return "";
  if (falta <= 0) return "Tempo terminado.";
  if (falta <= 10 && alvo > 10) return "Faltam 10 segundos.";
  return "";
}
