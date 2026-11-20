"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  List,
  Pause,
  Play,
  Repeat2,
  Settings,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { MediaGrande } from "@/components/exercicio/media-grande";
import { StepperNumerico, validarContagens } from "@/components/stepper-numerico";
import { BotaoMontagem } from "@/components/treinar/montagem";
import { SeletorAssistencia } from "@/components/treinar/serie";
import { Button } from "@/components/ui/button";
import { acharExercicio } from "@/lib/dados";
import { valoresDaSerieAnterior } from "@/lib/detalhe-do-treino";
import { formatarDuracao, formatarKg, rotuloDaCarga, rotuloDoCampoDeCarga } from "@/lib/formato";
import {
  alcancavelParaBaixo,
  cargasPossiveis,
  type ImplementoMontagem,
  type OpcoesMontagem,
} from "@/lib/montagem";
import { nomeAcessivel } from "@/lib/midia";
import {
  avisoDoPolegar,
  pontosDoBloco,
  rotuloDoPasso,
  serieAnteriorDe,
  tempoMedidoNoExercicio,
  type EntradaDoPasso,
  type PassoSerie,
  type SerieDeOutroDia,
} from "@/lib/player";
import type { VotoDoExercicio } from "@/lib/preferencias";
import { camposDoCronometro, medicaoDaSerie, proximaCarga, type BlocoLocal, type SerieLocal } from "@/lib/sessao";
import { useNotaDoExercicio } from "@/lib/queries/nota-do-exercicio";
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
  conta,
  passo,
  bloco,
  serie,
  gravando,
  entrada,
  opcoes,
  temVideo,
  anteriores,
  voto,
  feitas,
  total,
  nomeDoTreino,
  aviso,
  avisoSerieRecebida,
  pedidoDeFoco = 0,
  aoMudar,
  aoConcluir,
  aoAnterior,
  aoProximo,
  aoAbrirFicha,
  aoTrocar,
  aoAbrirLista,
  aoAjustar,
  aoAvaliar,
}: {
  conta: string;
  passo: PassoSerie;
  bloco: BlocoLocal;
  serie: SerieLocal;
  gravando: boolean;
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
  avisoSerieRecebida?: string | null;
  /**
   * Muda quando a Visão geral fecha: o foco volta ao botão que a abriu
   * (SPEC §22.5 item 3). Zero = ninguém pediu nada ainda.
   */
  pedidoDeFoco?: number;
  aoMudar: (campos: Partial<SerieLocal>) => void | Promise<void>;
  aoConcluir: () => void;
  aoAnterior: () => void;
  aoProximo: () => void;
  aoAbrirFicha: () => void;
  aoTrocar?: () => void;
  aoAbrirLista: () => void;
  aoAjustar: () => void;
  /**
   * Grava o voto; devolve o voto que havia antes do toque, ou `undefined`
   * quando não gravou (sem perfil não há onde gravar).
   */
  aoAvaliar: (voto: VotoDoExercicio) => Promise<VotoDoExercicio | undefined>;
}) {
  const exercicio = acharExercicio(bloco.exercicioId);
  const primeiraSerie = bloco.series.find((s) => s.tipo === "aquecimento") ?? bloco.series[0];
  const nota = useNotaDoExercicio(conta, primeiraSerie?.id === serie.id ? bloco.exercicioId : "");
  const implemento = exercicio.implemento as ImplementoMontagem;
  const incremento = bloco.alvo.incremento_kg;
  const anterior = passo.aquecimento ? null : serieAnteriorDe(anteriores, serie.setIndex, bloco.ordem);
  /** "Aquecimento 2 de 2 · exercício 1 de 6" — a mesma grafia do descanso. */
  const ondeEstou = `${rotuloDoPasso(passo)} · exercício ${passo.posicao} de ${passo.totalExercicios}`;

  const tela = useRef<HTMLElement>(null);
  const botaoDaLista = useRef<HTMLButtonElement>(null);
  const confirmarTempo = useRef<(() => Promise<boolean> | undefined) | null>(null);
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
  const ultimaEscolha = useRef(0);
  const votar = async (novo: VotoDoExercicio) => {
    const tentativa = ++ultimaEscolha.current;
    const id = `voto-${exercicio.id}`;
    const local = {
      id,
      position: "bottom-center" as const,
      style: { bottom: "calc(5rem + env(safe-area-inset-bottom))" },
    };
    let antes: VotoDoExercicio | undefined;
    // o voto de antes vem da gravação, lido na hora do toque (§22.18 item 8)
    try {
      antes = await aoAvaliar(novo);
    } catch {
      if (tentativa === ultimaEscolha.current) {
        toast.error("Voto não anotado. Tente novamente.", local);
      }
      return;
    }
    if (tentativa !== ultimaEscolha.current) return;
    const aviso = avisoDoPolegar(exercicio.nome, novo, antes !== undefined);
    /*
     * Um aviso por exercício (§22.18 item 8): o id fixo faz o segundo voto
     * substituir o aviso do primeiro, em vez de empilhar dois "Desfazer".
     */
    if (antes === undefined) {
      toast(aviso.texto, local);
      return;
    }
    toast(aviso.texto, {
      ...local,
      action: {
        label: "Desfazer",
        onClick: () => void aoAvaliar(antes).catch(() => {
          toast.error("Não consegui desfazer o voto. Tente novamente.", local);
        }),
      },
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
      ref={tela}
      aria-label={exercicio.nome}
      className="flex flex-1 flex-col gap-3 pb-[calc(var(--altura-dos-controles,3.5rem)+24px)]"
    >
      {/* SPEC §22.5 item 10: era a única rota do app sem `h1` */}
      <h1 className="sr-only">
        {nomeDoTreino} — exercício {passo.posicao} de {passo.totalExercicios}
      </h1>
      {/* o que acabou de ser gravado, para quem não vê a tela mudar */}
      <p role="status" className={avisoSerieRecebida ? "text-muted-foreground text-sm wrap-anywhere" : "sr-only"}>
        <span className="sr-only">{aviso}</span>
        {avisoSerieRecebida}
      </p>

      {/*
        ícones do topo (SPEC §14.1.2 e §22.16 item 6): só dois, um em cada
        canto — os polegares desceram para a linha do nome, onde dizem de
        quem é o voto, e deixaram de ficar a 2 px um do outro.
      */}
      {/*
        SPEC §22.18 item 7: a "Visão geral" fica à direita, no mesmo canto
        da preparação (onde a esquerda é o "Sair do treino"). `-mx-1` sem
        padding: o `main` tem 16 px de lado e a fileira da preparação, 12 —
        assim os ícones caem no mesmo x nas duas telas.
      */}
      <div className="@container/acoes -mx-1 flex items-center justify-between gap-2 pt-1">
        <Button
          variant="ghost"
          size="icon"
          className="alvo size-[44px] @2xs/acoes:size-11"
          aria-label="Ajustar"
          onClick={aoAjustar}
        >
          <Settings className="size-5" />
        </Button>
        {aoTrocar && (
          <Button variant="outline" className="alvo h-auto min-h-11 min-w-0 shrink gap-2 px-2 py-1 whitespace-normal @2xs/acoes:px-4" onClick={aoTrocar}>
            <Repeat2 className="hidden size-4 @2xs/acoes:block" aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">Trocar exercício</span>
          </Button>
        )}
        <Button
          ref={botaoDaLista}
          variant="ghost"
          size="icon"
          className="alvo size-[44px] @2xs/acoes:size-11"
          aria-label="Visão geral do treino"
          onClick={async () => {
            const gravacao = confirmarTempo.current?.();
            if (!gravacao || await gravacao) aoAbrirLista();
          }}
        >
          <List className="size-5" />
        </Button>
      </div>

      {/* barra fina de progresso do treino */}
      <div
        role="progressbar"
        aria-label="Progresso do treino"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={feitas}
        aria-valuetext={`${feitas} de ${total} séries feitas · exercício ${passo.posicao} de ${passo.totalExercicios}`}
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
        className={entrada.unilateral ? "h-28" : "h-36"}
      />

      <div className="@container/player">
        <div className="flex flex-col items-center justify-center gap-2 px-3 @2xs/player:flex-row">
          <h2 className="min-w-0 max-w-full text-center text-lg leading-tight font-semibold text-balance wrap-anywhere @2xs/player:text-left">
            {exercicio.nome}
          </h2>
          <div className="grid max-w-full shrink-0 grid-cols-3 items-center gap-2 [&>button]:max-w-full">
            <Button
              variant="ghost"
              size="icon"
              className="alvo shrink-0"
              aria-label={nomeAcessivel("Como fazer", exercicio.nome)}
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
      </div>

      {nota.data && primeiraSerie?.id === serie.id ? (
        <button type="button" onClick={aoAbrirFicha} className="alvo bg-muted mx-3 rounded-md px-3 py-1.5 text-left text-sm">
          <span className="font-semibold">Nota pessoal</span>
          <span className="line-clamp-2 break-words">{nota.data}</span>
        </button>
      ) : null}

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

      {/* Acima de 125% os recuos do miolo não devem tirar espaço dos dígitos. */}
      <div className="mx-[min(0px,calc(20px-1rem))] flex flex-col gap-3 px-[min(0.75rem,15px)]">
        <MioloDoPasso
          key={serie.id}
          confirmarTempo={confirmarTempo}
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
          {anterior ? (
            <p className="text-muted-foreground numero text-center text-sm">
              {anterior.set_index === serie.setIndex && anterior.set_index === passo.numero
                ? "anterior" : `anterior · série ${anterior.set_index}`}: {valoresDaSerieAnterior(anterior)}
            </p>
          ) : null}
          <BotaoMontagem
            noPlayer
            exercicioId={bloco.exercicioId}
            carga={serie.cargaKg}
            opcoes={opcoes}
          />
        </div>
      </div>

      <ControlesDoPlayer
        serieId={serie.id}
        concluida={serie.concluida}
        gravando={gravando}
        aoAnterior={aoAnterior}
        aoProximo={aoProximo}
        aoConcluir={() => {
          if (!validarContagens(tela.current)) return;
          confirmarTempo.current?.();
          aoConcluir();
        }}
      />
    </section>
  );
}

/** O bloco central, conforme o tipo do passo (SPEC §14.1.2). */
function MioloDoPasso({
  confirmarTempo,
  entrada,
  bloco,
  serie,
  incremento,
  implemento,
  opcoes,
  aoMudar,
  aoMudarCarga,
}: {
  confirmarTempo: RefObject<(() => Promise<boolean> | undefined) | null>;
  entrada: EntradaDoPasso;
  bloco: BlocoLocal;
  serie: SerieLocal;
  incremento: number;
  implemento: ImplementoMontagem;
  opcoes: OpcoesMontagem;
  aoMudar: (campos: Partial<SerieLocal>) => void | Promise<void>;
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
          serie={serie}
          unilateral={entrada.unilateral}
          confirmarTempo={confirmarTempo}
          aoMudar={aoMudar}
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
        <LinhaGrande rotulo={rotuloDoCampoDeCarga(exercicio.implemento)}>
          <StepperNumerico
            grande
            decimal
            rotulo={rotuloDoCampoDeCarga(exercicio.implemento)}
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
  serie, unilateral, confirmarTempo, aoMudar,
}: {
  serie: SerieLocal;
  unilateral: boolean;
  confirmarTempo: RefObject<(() => Promise<boolean> | undefined) | null>;
  aoMudar: (campos: Partial<SerieLocal>) => void | Promise<void>;
}) {
  const { id, tempoS: valor, concluida } = serie;
  const medicao = medicaoDaSerie(serie);
  const alvoDaMedicao = medicao?.alvoS;
  const alvo = Math.max(0, Math.round(alvoDaMedicao ?? valor ?? 0));
  const feitos = medicao?.medidoS ?? 0;
  // Enquanto o IndexedDB grava, a tela conserva o último segundo que uma recarga recuperaria.
  const [checkpoint, setCheckpoint] = useState<{ feitos: number; valor: typeof valor } | null>(null);
  const falta = Math.max(0, alvo - (checkpoint?.feitos ?? feitos));
  const terminou = alvoDaMedicao !== undefined && falta === 0;
  const [rodando, setRodando] = useState(false);
  const trecho = useRef<{
    alvoS: number;
    acumuladoMs: number;
    inicioEm: number;
    ultimoS: number;
  } | null>(null);
  const fracaoPausada = useRef(0);
  const gravacoes = useRef<{ pedidos: number; confirmado: number; emCurso?: Promise<boolean> }>({ pedidos: 0, confirmado: 0 });
  const gravar = useRef<(alvoS: number, medidoS: number) => void>(() => {});
  useLayoutEffect(() => {
    gravar.current = (alvoS, medidoS) => {
      const lote = gravacoes.current;
      const pedido = ++lote.pedidos;
      setCheckpoint(anterior => anterior ?? { feitos, valor });
      // Concluir usa a medida imediatamente. Só apresentamos o segundo que o aparelho já guardou.
      lote.emCurso = Promise.resolve(aoMudar(camposDoCronometro(id, alvoS, medidoS))).then(() => {
        if (lote !== gravacoes.current) return false;
        if (pedido <= lote.confirmado) return true;
        lote.confirmado = pedido;
        setCheckpoint(pedido === lote.pedidos ? null : { feitos: medidoS, valor: medidoS });
        return true;
      }, () => {
        if (lote === gravacoes.current && pedido === lote.pedidos) {
          trecho.current = null;
          setRodando(false);
          toast.error("Não foi possível guardar o tempo neste aparelho. Toque em Continuar para tentar de novo.");
        }
        return false;
      });
    };
  }, [aoMudar, feitos, id, valor]);
  useLayoutEffect(() => () => { gravacoes.current = { pedidos: 0, confirmado: 0 }; }, []);

  const medir = useCallback((pausar: boolean) => {
    const atual = trecho.current;
    if (!atual) return;
    const { segundos, totalMs } = tempoMedidoNoExercicio(
      atual.alvoS, atual.acumuladoMs, atual.inicioEm, Date.now(),
    );
    if (pausar || segundos === atual.alvoS) {
      trecho.current = null;
      fracaoPausada.current = totalMs % 1_000;
      setRodando(false);
    }
    if (segundos !== atual.ultimoS) {
      atual.ultimoS = segundos;
      gravar.current(atual.alvoS, segundos);
    }
  }, []);

  useLayoutEffect(() => {
    confirmarTempo.current = () => {
      medir(true);
      return gravacoes.current.emCurso;
    };
    return () => { confirmarTempo.current = null; };
  }, [confirmarTempo, medir]);

  useEffect(() => {
    if (!rodando) return;
    const relogio = setInterval(() => medir(false), 200);
    return () => clearInterval(relogio);
  }, [rodando, medir]);

  // Outra superfície pode concluir a série ou alterar sua prescrição.
  useLayoutEffect(() => {
    if (trecho.current && (concluida || trecho.current.alvoS !== alvoDaMedicao)) {
      trecho.current = null;
      fracaoPausada.current = 0;
      setRodando(false);
    }
  }, [concluida, alvoDaMedicao]);

  const alternar = () => {
    if (trecho.current) {
      medir(true);
      return;
    }
    if (!alvo || terminou || concluida) return;
    const fracao = alvoDaMedicao === undefined ? 0 : fracaoPausada.current;
    trecho.current = {
      alvoS: alvo,
      acumuladoMs: feitos * 1_000 + fracao,
      inicioEm: Date.now(),
      ultimoS: feitos,
    };
    // Até o primeiro segundo completo, concluir uma medição deve registrar zero.
    if (alvoDaMedicao === undefined || checkpoint !== null) gravar.current(alvo, feitos);
    setRodando(true);
  };

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
        {formatarDuracao(falta)}
      </span>
      {/* SPEC §22.5 item 7: `role="timer"` tem `aria-live` desligado — sem
          isto o fim da contagem só existia para quem ouve o bipe */}
      <p role="status" className="sr-only">
        {terminou ? "Tempo terminado." : avisoDaContagem(rodando, falta, alvo)}
      </p>
      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        <Button
          variant={rodando ? "default" : "outline"}
          className="alvo h-auto min-h-[max(56px,3.5rem)] max-w-full rounded-2xl px-[min(1.25rem,20px)] py-1 text-base whitespace-normal"
          onClick={evento => {
            if (rodando || validarContagens(evento.currentTarget.closest("section"))) alternar();
          }}
          disabled={concluida || terminou || alvo === 0}
        >
          {rodando ? <Pause className="size-5" /> : <Play className="size-5" />}
          {terminou ? "Tempo terminado"
            : rodando ? "Pausar"
            : alvoDaMedicao !== undefined ? "Continuar" : "Começar"}
        </Button>
        <div className="min-w-0 flex-[1_1_calc(8rem+9ch+10px)]">
          <StepperNumerico
            grande
            rotulo={unilateral ? "segundos do lado direito" : "segundos"}
            valor={checkpoint ? checkpoint.valor : valor}
            passo={5}
            aoMudar={(v) => {
              gravacoes.current = { pedidos: 0, confirmado: 0 };
              setCheckpoint(null);
              trecho.current = null;
              fracaoPausada.current = 0;
              setRodando(false);
              aoMudar({ tempoS: v });
            }}
          />
        </div>
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
  serieId,
  concluida,
  gravando,
  aoAnterior,
  aoProximo,
  aoConcluir,
}: {
  serieId: string;
  concluida: boolean;
  gravando: boolean;
  aoAnterior: () => void;
  aoProximo: () => void;
  aoConcluir: () => void;
}) {
  const rodape = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const barra = rodape.current;
    const tela = barra?.parentElement;
    if (!barra || !tela) return;

    const pagina = document.documentElement;
    let alturaReservada: number | undefined;
    let ultimaRolagemNoFim: number | undefined;
    let posicaoAntesDaReserva: number | undefined;
    const noFim = () => pagina.scrollTop > 0 &&
      Math.abs(pagina.scrollHeight - pagina.clientHeight - pagina.scrollTop) <= 1;
    const lembrarRolagem = () => {
      ultimaRolagemNoFim = noFim() ? pagina.scrollTop : undefined;
    };
    const reservarAltura = () => {
      const altura = barra.getBoundingClientRect().height;
      const posicao = pagina.scrollTop;
      if (altura !== alturaReservada) {
        // Ampliar a fonte pode ter alongado o conteúdo antes de medirmos o rodapé.
        const estavaNoFim = noFim() ||
          (ultimaRolagemNoFim !== undefined && Math.abs(ultimaRolagemNoFim - posicao) <= 1);
        posicaoAntesDaReserva = alturaReservada !== undefined && estavaNoFim ? posicao : undefined;
        tela.style.setProperty("--altura-dos-controles", `${altura}px`);
        alturaReservada = altura;
      } else if (posicaoAntesDaReserva !== undefined) {
        // A seção já recebeu o novo padding. Quem rolou nesse intervalo fica onde escolheu.
        if (Math.abs(posicaoAntesDaReserva - posicao) <= 1) {
          window.scrollTo({ top: pagina.scrollHeight, left: window.scrollX, behavior: "instant" });
        }
        posicaoAntesDaReserva = undefined;
      }
    };
    reservarAltura();
    window.addEventListener("scroll", lembrarRolagem, { passive: true });
    const observador = new ResizeObserver(reservarAltura);
    observador.observe(barra, { box: "border-box" });
    observador.observe(tela, { box: "border-box" });
    return () => {
      observador.disconnect();
      window.removeEventListener("scroll", lembrarRolagem);
      tela.style.removeProperty("--altura-dos-controles");
    };
  }, [serieId]);

  return (
    <div ref={rodape} className="bg-card/95 border-border pb-segura fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur">
      {/*
        SPEC §22.5 item 6: eram 8 px (`gap-2`) entre gravar a série e pulá-la
        sem gravar. Agora são 24 px de cada lado do primário, e as
        setas descem para os 44 px padrão do projeto — o ✓ continua com 56 px
        e é o único alvo grande da barra.
      */}
      <div className="mx-auto flex w-full max-w-lg items-center gap-[24px] px-[12px] py-2">
        <Button
          variant="outline"
          size="icon"
          className="alvo size-[44px] shrink-0 rounded-2xl"
          aria-label="Passo anterior"
          onClick={aoAnterior}
        >
          <ChevronLeft className="size-[24px]" />
        </Button>
        <Button
          size="xl"
          /* SPEC §22.5 item 10: o nome acessível é o texto que está escrito */
          className="alvo h-auto min-h-[max(56px,3.5rem)] min-w-0 flex-1 rounded-2xl px-[4px] py-1 font-semibold whitespace-normal"
          aria-busy={gravando}
          aria-disabled={gravando}
          onClick={gravando ? undefined : aoConcluir}
        >
          <span className="min-w-0 wrap-anywhere">
            <Check aria-hidden="true" className="mr-2 inline-block size-6 align-middle" strokeWidth={3} />
            {gravando ? "Gravando série…" : concluida ? "Série feita" : "Concluir série"}
          </span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="alvo size-[44px] shrink-0 rounded-2xl"
          aria-label="Próximo passo"
          onClick={aoProximo}
        >
          <ChevronRight className="size-[24px]" />
        </Button>
      </div>
    </div>
  );
}

/** O que o leitor de tela ouve na contagem de um exercício de tempo. */
function avisoDaContagem(rodando: boolean, falta: number, alvo: number): string {
  if (!rodando) return "";
  if (falta <= 10 && alvo > 10) return "Faltam 10 segundos.";
  return "";
}
