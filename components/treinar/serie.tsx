"use client";

import { Check, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StepperNumerico } from "@/components/stepper-numerico";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { acharExercicio } from "@/lib/dados";
import { formatarKg, rotuloDaCarga } from "@/lib/formato";
import {
  alcancavelParaBaixo,
  cargasPossiveis,
  type ImplementoMontagem,
  type OpcoesMontagem,
} from "@/lib/montagem";
import { DEGRAUS_ASSISTENCIA } from "@/lib/progressao";
import {
  nomeDaAssistencia,
  proximaCarga,
  type BlocoLocal,
  type SerieLocal,
} from "@/lib/sessao";
import type { Assistencia } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** A linha de uma série (SPEC §3.2): concluída, repetições e carga. */
export function LinhaSerieForm({
  bloco,
  serie,
  indice,
  opcoes,
  aoMudar,
  aoMarcar,
}: {
  bloco: BlocoLocal;
  serie: SerieLocal;
  /** Número mostrado na tela (as de aquecimento têm a própria contagem). */
  indice: number;
  opcoes: OpcoesMontagem;
  aoMudar: (campos: Partial<SerieLocal>) => void;
  aoMarcar: (concluida: boolean) => void;
}) {
  const exercicio = acharExercicio(bloco.exercicioId);
  const tipo = serie.tipo === "aquecimento" ? "reps" : bloco.prescricao.tipo;
  const unilateral = serie.tipo === "trabalho" && bloco.prescricao.unilateral;
  const implemento = exercicio.implemento as ImplementoMontagem;
  const incremento = bloco.alvo.incremento_kg;
  const temCarga =
    serie.cargaKg !== null &&
    (serie.cargaKg > 0 || exercicio.progressao.tipo === "carga");
  const mostraAssistencia =
    serie.tipo === "trabalho" && exercicio.progressao.tipo === "assistencia";

  const nome =
    serie.tipo === "aquecimento" ? `Aquecimento ${indice}` : `Série ${indice}`;

  /**
   * Carga digitada à mão (SPEC §6.4 e §10.5): o ± já anda pela escala, mas o
   * teclado aceita qualquer número. Uma carga que o kit não monta não pode
   * ficar registrada em silêncio — cai na alcançável para baixo e avisa.
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
    <li>
      {/* group + aria-label: cada série é um alvo com nome próprio na tela */}
      <div
        role="group"
        aria-label={`${nome} — ${exercicio.nome}`}
        className={cn(
          "flex flex-col gap-2 rounded-lg border p-2.5",
          serie.concluida ? "border-primary/50 bg-primary/5" : "border-border",
          serie.tipo === "aquecimento" && "border-dashed",
        )}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={serie.concluida}
            aria-label={`${nome} concluída`}
            onClick={() => aoMarcar(!serie.concluida)}
            className={cn(
              "alvo flex size-11 shrink-0 items-center justify-center rounded-lg border transition-colors",
              serie.concluida
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background",
            )}
          >
            <Check
              className={cn("size-6", serie.concluida ? "" : "opacity-25")}
            />
          </button>

          <span className="flex-1 text-sm font-medium">{nome}</span>

          {temCarga && serie.tipo === "aquecimento" ? (
            <span className="numero text-muted-foreground text-sm">
              {formatarKg(serie.cargaKg ?? 0)}
            </span>
          ) : null}
        </div>

        {serie.tipo === "aquecimento" ? null : mostraAssistencia ? (
          <SeletorAssistencia
            valor={serie.assistencia}
            aoMudar={(a) => aoMudar({ assistencia: a })}
          />
        ) : null}

        <div
          className={cn(
            "grid gap-2",
            // o cronômetro rouba 44 px da coluna: em tempo cada campo é uma linha
            tipo === "tempo_s" ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {tipo === "tempo_s" ? (
            <CampoTempo
              rotulo={unilateral ? "segundos (D)" : "segundos"}
              valor={serie.tempoS}
              concluida={serie.concluida}
              aoMudar={(v) => aoMudar({ tempoS: v })}
            />
          ) : tipo === "passos" ? (
            <Campo rotulo="passos">
              <StepperNumerico
                rotulo="passos"
                valor={serie.passos}
                passo={1}
                compacto
                aoMudar={(v) => aoMudar({ passos: v })}
              />
            </Campo>
          ) : (
            <Campo rotulo={unilateral ? "reps (D)" : "repetições"}>
              <StepperNumerico
                rotulo={
                  unilateral ? "repetições do lado direito" : "repetições"
                }
                valor={serie.reps}
                passo={1}
                compacto
                aoMudar={(v) => aoMudar({ reps: v })}
              />
            </Campo>
          )}

          {unilateral && tipo === "tempo_s" ? (
            <CampoTempo
              rotulo="segundos (E)"
              valor={serie.tempoSLado2}
              concluida={serie.concluida}
              aoMudar={(v) => aoMudar({ tempoSLado2: v })}
            />
          ) : unilateral ? (
            <Campo rotulo="reps (E)">
              <StepperNumerico
                rotulo="repetições do lado esquerdo"
                valor={serie.repsLado2}
                passo={1}
                compacto
                aoMudar={(v) => aoMudar({ repsLado2: v })}
              />
            </Campo>
          ) : null}

          {temCarga ? (
            <Campo rotulo={rotuloDaCarga(exercicio.implemento)}>
              <StepperNumerico
                rotulo={`carga ${rotuloDaCarga(exercicio.implemento)}`}
                valor={serie.cargaKg}
                decimal
                compacto
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
                aoMudar={mudarCarga}
              />
            </Campo>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Campo({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-muted-foreground text-rotulo uppercase">
        {rotulo}
      </span>
      {children}
    </div>
  );
}

/** Segundos com cronômetro (SPEC §3.2): prancha e companhia. */
function CampoTempo({
  rotulo,
  valor,
  concluida,
  aoMudar,
}: {
  rotulo: string;
  valor: number | null;
  /** A série já foi marcada: o cronômetro para (o valor gravado é este). */
  concluida: boolean;
  aoMudar: (v: number | null) => void;
}) {
  const [rodando, setRodando] = useState(false);
  const comeco = useRef<number>(0);

  /*
   * O tique tem de chamar SEMPRE o `aoMudar` da última renderização. Ele fecha
   * sobre a sessão inteira (cada toque devolve uma sessão nova), então um tique
   * com a versão velha desfaz o que foi registrado enquanto o cronômetro corria
   * — um visto marcado noutro bloco voltava a "não feito" 250 ms depois.
   */
  const ultimoAoMudar = useRef(aoMudar);
  useEffect(() => {
    ultimoAoMudar.current = aoMudar;
  });

  // marcar a série encerra a contagem: o número que subiu é o que fica
  useEffect(() => {
    if (concluida) setRodando(false);
  }, [concluida]);

  /*
   * O tique olha o relógio 4× por segundo (a parada fica responsiva), mas só
   * avisa quando o SEGUNDO muda: cada aviso regrava a sessão inteira no
   * IndexedDB (SPEC §8), e numa prancha de 2 minutos eram ~480 gravações para
   * 120 valores diferentes. Agora é no máximo uma por segundo — e o valor de
   * cada segundo continua salvo, então recarregar no meio não perde nada.
   */
  const ultimoSegundo = useRef<number | null>(null);
  useEffect(() => {
    if (!rodando) return;
    comeco.current = Date.now();
    ultimoSegundo.current = null;
    const relogio = setInterval(() => {
      const segundos = Math.round((Date.now() - comeco.current) / 1000);
      if (segundos === ultimoSegundo.current) return;
      ultimoSegundo.current = segundos;
      ultimoAoMudar.current(segundos);
    }, 250);
    return () => clearInterval(relogio);
  }, [rodando]);

  return (
    <Campo rotulo={rotulo}>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant={rodando ? "default" : "outline"}
          size="icon"
          className="alvo size-11 shrink-0"
          aria-label={
            rodando
              ? `Parar o cronômetro (${rotulo})`
              : `Cronômetro (${rotulo})`
          }
          onClick={() => setRodando((r) => !r)}
        >
          {rodando ? <Pause className="size-5" /> : <Play className="size-5" />}
        </Button>
        <StepperNumerico
          rotulo={rotulo}
          valor={valor}
          passo={5}
          compacto
          aoMudar={(v) => {
            setRodando(false);
            aoMudar(v);
          }}
        />
      </div>
    </Campo>
  );
}

/** Degraus do elástico da barra fixa assistida (SPEC §6.3). */
export function SeletorAssistencia({
  valor,
  aoMudar,
}: {
  valor: Assistencia | null;
  aoMudar: (a: Assistencia) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-rotulo uppercase">
        elástico
      </span>
      <div
        role="radiogroup"
        aria-label="Ajuda do elástico"
        className="grid grid-cols-2 gap-1"
      >
        {DEGRAUS_ASSISTENCIA.map((degrau) => (
          <button
            key={degrau}
            type="button"
            role="radio"
            aria-checked={valor === degrau}
            onClick={() => aoMudar(degrau)}
            className={cn(
              "alvo rounded-lg border px-2 text-xs",
              valor === degrau
                ? "border-primary bg-primary/10 font-medium"
                : "border-input bg-background",
            )}
          >
            {nomeDaAssistencia(degrau)}
          </button>
        ))}
      </div>
    </div>
  );
}
