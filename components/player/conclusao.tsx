"use client";

import { Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CardImc } from "@/components/corpo/card-imc";
import { CardDaSemana } from "@/components/player/card-da-semana";
import { AvisoDeConquista } from "@/components/relatorio/aviso-conquista";
import { StepperNumerico } from "@/components/stepper-numerico";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { Button } from "@/components/ui/button";
import { CardCapa } from "@/components/ui/card-capa";
import { Contador } from "@/components/ui/contador";
import { capaDoExercicio } from "@/lib/capas";
import { acharExercicio } from "@/lib/dados";
import { formatarKg, formatarNumero } from "@/lib/formato";
import {
  recordesEmDestaque,
  type ContadoresDaSessao,
  type ResultadoExercicio,
} from "@/lib/sessao";
import { cn } from "@/lib/utils";

/**
 * A conclusão (SPEC §14.1.5): capa, os três contadores, **o resumo do motor**
 * (o nosso diferencial), o card da semana com a meta, o peso do dia com o IMC
 * e o "Próximo", que volta para a aba Treino.
 *
 * SPEC §22.5 item 2: a sessão é gravada ao **entrar** nesta tela, não no
 * "Próximo" — que ficava a 2.244 px do topo de uma página de 2.464 px,
 * enquanto o topo já dizia "Excelente! Você concluiu o treino." e a aba
 * Treino ainda mostrava "EM ANDAMENTO · Continuar · 17/17 séries". O resumo
 * aqui é exatamente a decisão que foi para o banco (`avaliarSessao`, o mesmo
 * que `concluirSessao` usa), e o "Próximo" mora numa barra fixa no rodapé,
 * com o mesmo padrão de `ControlesDoPlayer`.
 */
export function TelaConclusao({
  conta,
  sessaoId,
  titulo,
  subtitulo,
  primeiroExercicioId,
  contadores,
  duracaoS,
  resultados,
  hoje,
  dataDaSessao,
  pesoAtual,
  pesoDeHoje,
  alturaCm,
  peso,
  aoMudarPeso,
  aoMudarAltura,
  salvando,
  gravada,
  falhou,
  aoSeguir,
  aoVoltar,
}: {
  conta: string;
  /** A sessão que acabou — ela conta nas conquistas antes de subir (§19.5). */
  sessaoId: string;
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
  /** A pesagem de HOJE, se já existe (`body_weights`) — SPEC §22.1. */
  pesoDeHoje: number | null;
  alturaCm: number | null;
  peso: number | null;
  aoMudarPeso: (kg: number | null) => void;
  aoMudarAltura?: (cm: number) => void;
  salvando: boolean;
  /** A sessão já foi gravada (ao entrar nesta tela) — SPEC §22.5 item 2. */
  gravada: boolean;
  /** A gravação de entrada falhou; o rodapé vira "Tentar salvar de novo". */
  falhou: boolean;
  aoSeguir: () => void;
  /** Só existe enquanto a sessão NÃO foi gravada: depois não dá para voltar. */
  aoVoltar?: () => void;
}) {
  /*
   * SPEC §22.1: `useState(false)` fixo fazia o convite "Registrar o peso de
   * hoje" voltar a cada vez que a tela era fechada e reaberta — mesmo com a
   * pesagem do dia já gravada, e mesmo com o peso digitado dois passos atrás.
   * O campo nasce aberto quando há peso digitado nesta sessão; havendo só a
   * pesagem de hoje, a tela mostra o número em vez de pedir de novo.
   */
  const [editando, setEditando] = useState(peso !== null);
  const registrado = peso ?? pesoDeHoje;
  const capa = primeiroExercicioId
    ? capaDoExercicio(acharExercicio(primeiroExercicioId))
    : null;

  const comEvento = resultados.filter((r) => r.motivo !== null);
  const semCarga = resultados.filter((r) => r.motivoNaoAvaliado === "estado_desconhecido");
  const naoFeitos = resultados.filter((r) => r.motivoNaoAvaliado === "nao_feito");
  /* SPEC §22.18 item 3: os 5 de maior salto; o resto atrás de "Ver todos" */
  const destaque = recordesEmDestaque(resultados);
  const [todosOsRecordes, setTodosOsRecordes] = useState(false);
  const recordes = todosOsRecordes ? destaque.todos : destaque.visiveis;
  const escondidos = destaque.todos.length - destaque.visiveis.length;
  const primeiroRevelado = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (todosOsRecordes) primeiroRevelado.current?.focus();
  }, [todosOsRecordes]);

  return (
    <section aria-label="Treino concluído" className="flex flex-col gap-3 px-3 pb-28">
      <CardCapa
        foto={capa}
        titulo="Excelente! Você concluiu o treino."
        subtitulo={subtitulo}
      />

      {/* SPEC §22.5 item 2: o estado da gravação, em texto, no alto da tela */}
      <p
        role="status"
        className={cn(
          "text-sm",
          falhou ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {falhou
          ? "Não consegui salvar agora. Mantenha o treino aberto e tente salvar de novo."
          : gravada
            ? "Treino salvo. Já está no histórico, mesmo que você saia agora."
            : "Salvando o treino…"}
      </p>

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
        {semCarga.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Sem avaliar, porque não consegui ler a carga atual:{" "}
            {semCarga.map((r) => r.nome).join(" · ")}.{" "}
            {gravada && "As séries foram guardadas. "}A progressão fica como está.
          </p>
        ) : null}
        {/* SPEC §6.3: o que não foi tentado não conta como falha */}
        {naoFeitos.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Não foi feito nesta sessão, então não conta como falha:{" "}
            {naoFeitos.map((r) => r.nome).join(" · ")}. A progressão fica como está.
          </p>
        ) : null}
      </section>

      {recordes.length > 0 ? (
        <section className="border-primary/40 bg-primary/5 cartao flex flex-col gap-1 border p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Trophy className="text-primary size-4" />
            Recordes
          </h3>
          <ul id="lista-de-recordes" aria-label="Recordes" className="flex flex-col gap-0.5 text-xs">
            {recordes.map((r, i) => (
              <li
                key={`${r.nome}-${i}`}
                /* ao abrir "Ver todos", o foco vai ao primeiro que apareceu */
                ref={i === destaque.visiveis.length ? primeiroRevelado : undefined}
                tabIndex={i === destaque.visiveis.length ? -1 : undefined}
                className="focus-visible:ring-ring rounded-sm outline-none focus-visible:ring-2"
              >
                <span className="font-medium">{r.nome}:</span>{" "}
                <span className="numero">{r.texto}</span>
              </li>
            ))}
          </ul>
          {escondidos > 0 && !todosOsRecordes ? (
            <Button
              variant="ghost"
              className="alvo self-start px-2"
              aria-controls="lista-de-recordes"
              onClick={() => setTodosOsRecordes(true)}
            >
              Ver todos ({destaque.todos.length})
            </Button>
          ) : null}
        </section>
      ) : null}

      {/* SPEC §19.5: a conquista nova, sóbria, antes do "Próximo" */}
      <AvisoDeConquista conta={conta} sessaoConcluida={{ id: sessaoId, data: dataDaSessao }} />

      <CardDaSemana hoje={hoje} dataDaSessao={dataDaSessao} />

      <section className="cartao border-border bg-card flex flex-col gap-2 border p-3">
        <h3 className="text-sm font-semibold">Peso de hoje</h3>
        {/* SPEC §22.5 item 4: opcional, e dizendo o que o número faz */}
        <p className="text-muted-foreground text-xs">
          (opcional) Entra no gráfico de peso e no IMC da aba Corpo.
        </p>
        {editando ? (
          <StepperNumerico
            rotulo="peso de hoje em kg"
            valor={peso}
            passo={0.1}
            decimal
            sufixo="kg"
            aoMudar={aoMudarPeso}
          />
        ) : registrado !== null ? (
          <div className="flex items-center justify-between gap-2">
            <p className="numero text-base">Peso de hoje: {formatarKg(registrado)}</p>
            <Button
              variant="ghost"
              className="alvo"
              onClick={() => {
                aoMudarPeso(registrado);
                setEditando(true);
              }}
            >
              Corrigir
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="alvo"
            onClick={() => setEditando(true)}
          >
            Registrar o peso de hoje
          </Button>
        )}
      </section>

      {/*
        `min-h-48`: sem peso o card tem 98 px e com a barra 192 px. Reservar a
        altura mantém o "Próximo" parado enquanto se digita o peso — o toque
        que se perdia entre o apertar e o soltar (auditoria de 15/09).
      */}
      <CardImc
        pesoKg={peso ?? pesoAtual}
        alturaCm={alturaCm}
        aoMudarAltura={aoMudarAltura}
        className="min-h-48"
      />

      {aoVoltar ? (
        <Button variant="ghost" className="alvo" disabled={salvando} onClick={aoVoltar}>
          Voltar ao treino
        </Button>
      ) : null}
      <p className="sr-only">{titulo}</p>

      {/*
        SPEC §22.5 item 2: barra fixa, o mesmo padrão de `ControlesDoPlayer`
        (`components/player/exercicio.tsx`). O "Próximo" estava no fim de uma
        página de 2.464 px — para chegar até ele era preciso rolar 2.244 px.
      */}
      <div className="bg-card/95 border-border pb-segura fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur">
        <div className="mx-auto w-full max-w-lg px-3 py-2">
          <BotaoLargo disabled={salvando} onClick={aoSeguir}>
            {salvando
              ? "Salvando…"
              : falhou
                ? "Tentar salvar de novo"
                : "Próximo"}
          </BotaoLargo>
        </div>
      </div>
    </section>
  );
}
