"use client";

import { Trophy } from "lucide-react";
import { useState } from "react";
import { CardImc } from "@/components/corpo/card-imc";
import { CardDaSemana } from "@/components/player/card-da-semana";
import { StepperNumerico } from "@/components/stepper-numerico";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { Button } from "@/components/ui/button";
import { CardCapa } from "@/components/ui/card-capa";
import { Contador } from "@/components/ui/contador";
import { capaDoExercicio } from "@/lib/capas";
import { acharExercicio } from "@/lib/dados";
import { formatarNumero } from "@/lib/formato";
import type { ContadoresDaSessao, ResultadoExercicio } from "@/lib/sessao";
import { cn } from "@/lib/utils";

/**
 * A conclusão (SPEC §14.1.5): capa, os três contadores, **o resumo do motor**
 * (o nosso diferencial), o card da semana com a meta, o peso do dia com o IMC
 * e o "Próximo", que é quem grava a sessão e volta para a aba Treino.
 *
 * Nada é gravado antes do "Próximo": o resumo aqui é exatamente a decisão que
 * vai para o banco (`avaliarSessao`, o mesmo que `concluirSessao` usa).
 */
export function TelaConclusao({
  titulo,
  subtitulo,
  primeiroExercicioId,
  contadores,
  duracaoS,
  resultados,
  hoje,
  dataDaSessao,
  pesoAtual,
  alturaCm,
  peso,
  aoMudarPeso,
  aoMudarAltura,
  salvando,
  aoSeguir,
  aoVoltar,
}: {
  titulo: string;
  subtitulo: string;
  primeiroExercicioId: string | null;
  contadores: ContadoresDaSessao;
  duracaoS: number;
  resultados: ResultadoExercicio[];
  hoje: string;
  dataDaSessao: string;
  /** Último peso registrado (para o IMC, enquanto não há o de hoje). */
  pesoAtual: number | null;
  alturaCm: number | null;
  peso: number | null;
  aoMudarPeso: (kg: number | null) => void;
  aoMudarAltura?: (cm: number) => void;
  salvando: boolean;
  aoSeguir: () => void;
  aoVoltar: () => void;
}) {
  const [mostraPeso, setMostraPeso] = useState(false);
  const capa = primeiroExercicioId
    ? capaDoExercicio(acharExercicio(primeiroExercicioId))
    : null;

  const comEvento = resultados.filter((r) => r.motivo !== null);
  const naoAvaliados = resultados.filter((r) => r.naoAvaliado);
  const recordes = resultados.flatMap((r) =>
    r.recordes.map((rec) => ({ nome: r.nome, texto: rec.texto })),
  );

  return (
    <section aria-label="Treino concluído" className="flex flex-col gap-3 px-3 pb-28">
      <CardCapa
        foto={capa}
        titulo="Excelente! Você concluiu o treino."
        subtitulo={subtitulo}
      />

      <div className="grid grid-cols-3 gap-2">
        <Contador valor={contadores.exercicios} rotulo="Exercícios" />
        <Contador valor={Math.round(duracaoS / 60)} rotulo="Minutos" />
        <Contador valor={formatarNumero(contadores.volumeKg)} rotulo="Volume (kg)" />
      </div>

      <section className="cartao border-border bg-card flex flex-col gap-2 border p-3">
        <h3 className="text-sm font-semibold">O que muda no próximo treino</h3>
        {comEvento.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nenhum exercício com séries suficientes para o motor avaliar.
          </p>
        ) : (
          <ul aria-label="Resumo por exercício" className="flex flex-col divide-y">
            {comEvento.map((r) => (
              <li key={r.exercicioId} className="flex flex-col gap-0.5 py-2 first:pt-0">
                <div className="flex items-baseline gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "numero w-4 shrink-0 text-center text-base",
                      r.simbolo === "↑" && "text-primary",
                      r.simbolo === "↓" && "text-destructive",
                    )}
                  >
                    {r.simbolo}
                  </span>
                  <span className="text-sm font-medium text-balance">{r.nome}</span>
                </div>
                <p className="numero pl-6 text-sm">
                  {r.texto}
                  {r.falha ? (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · conta como falha
                    </span>
                  ) : null}
                </p>
                {r.aviso ? (
                  <p className="text-muted-foreground pl-6 text-xs">{r.aviso}</p>
                ) : null}
                {r.sugestao ? (
                  <p className="text-primary pl-6 text-xs">{r.sugestao}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {/* SPEC §6.3: sem a carga atual do exercício não dá para avaliar */}
        {naoAvaliados.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Sem avaliar, porque não consegui ler a carga atual:{" "}
            {naoAvaliados.map((r) => r.nome).join(" · ")}. As séries foram guardadas;
            a progressão fica como está.
          </p>
        ) : null}
      </section>

      {recordes.length > 0 ? (
        <section className="border-primary/40 bg-primary/5 cartao flex flex-col gap-1 border p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Trophy className="text-primary size-4" />
            Recordes
          </h3>
          <ul aria-label="Recordes" className="flex flex-col gap-0.5 text-xs">
            {recordes.map((r, i) => (
              <li key={`${r.nome}-${i}`}>
                <span className="font-medium">{r.nome}:</span>{" "}
                <span className="numero">{r.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <CardDaSemana hoje={hoje} dataDaSessao={dataDaSessao} />

      <section className="cartao border-border bg-card flex flex-col gap-2 border p-3">
        <h3 className="text-sm font-semibold">Peso de hoje</h3>
        {mostraPeso ? (
          <StepperNumerico
            rotulo="peso de hoje em kg"
            valor={peso}
            passo={0.1}
            decimal
            sufixo="kg"
            aoMudar={aoMudarPeso}
          />
        ) : (
          <Button
            variant="outline"
            className="alvo h-11"
            onClick={() => setMostraPeso(true)}
          >
            Registrar o peso de hoje
          </Button>
        )}
      </section>

      <CardImc
        pesoKg={peso ?? pesoAtual}
        alturaCm={alturaCm}
        aoMudarAltura={aoMudarAltura}
      />

      <div className="flex flex-col gap-2 pt-1">
        <BotaoLargo disabled={salvando} onClick={aoSeguir}>
          {salvando ? "Salvando…" : "Próximo"}
        </BotaoLargo>
        <Button
          variant="ghost"
          className="alvo h-11"
          disabled={salvando}
          onClick={aoVoltar}
        >
          Voltar ao treino
        </Button>
      </div>
      <p className="sr-only">{titulo}</p>
    </section>
  );
}
