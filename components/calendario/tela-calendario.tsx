"use client";

import { useQueryClient } from "@tanstack/react-query";
import { addDays, addMonths, addWeeks, startOfMonth } from "date-fns";
import { CalendarCog, CalendarOff, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DialogoDia, DialogoSemanaCurta, type TrocaDoDia } from "@/components/calendario/dialogos";
import { GradeDaSemana, MesEmMiniatura } from "@/components/calendario/grade";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { Button } from "@/components/ui/button";
import {
  diasDaSemana,
  inicioDaSemana,
  iso,
  oQueFaltaNaSemana,
  semanaDaFase,
  semanaCoerente,
  semanaCurta,
  type Realizado,
} from "@/lib/calendario";
import { acharTreino } from "@/lib/dados";
import { formatarData, formatarMesAno } from "@/lib/formato";
import { apagarOverride, gravarOverrides } from "@/lib/queries/acoes";
import { useCardio, useOverrides, usePerfil, useSessoes } from "@/lib/queries/dados";
import { useHoje } from "@/lib/relogio";
import {
  faseCumprida,
  montarGrade,
  montarMes,
  overridesDaSemanaCurta,
  rotuloDaFase,
  type DiaDaGrade,
  type DiaDoMes,
} from "@/lib/semana";

/** A grade do mês cobre no máximo seis semanas — é o intervalo que se lê. */
function intervaloDoMes(referencia: string): { de: string; ate: string } {
  const primeiro = inicioDaSemana(startOfMonth(new Date(`${referencia}T00:00:00`)));
  return { de: iso(primeiro), ate: iso(addDays(primeiro, 41)) };
}

export function TelaCalendario({ userId }: { userId: string }) {
  const hoje = useHoje();
  const cliente = useQueryClient();
  const [referencia, setReferencia] = useState<string | null>(null);
  const [diaTocado, setDiaTocado] = useState<DiaDaGrade | null>(null);
  const [semanaCurtaAberta, setSemanaCurtaAberta] = useState(false);

  const ref = referencia ?? hoje;
  const intervalo = ref ? intervaloDoMes(ref) : null;

  const perfilQ = usePerfil();
  const overridesQ = useOverrides(intervalo?.de ?? null, intervalo?.ate ?? null);
  const sessoesQ = useSessoes();
  const cardioQ = useCardio(intervalo?.de ?? null, intervalo?.ate ?? null);

  const perfil = perfilQ.data ?? null;
  const overrides = useMemo(() => overridesQ.data ?? [], [overridesQ.data]);
  const sessoes = useMemo(() => sessoesQ.data ?? [], [sessoesQ.data]);
  const cardios = useMemo(() => cardioQ.data ?? [], [cardioQ.data]);

  /*
   * SPEC §16.2: a semana sai de `montarGrade`, que já sabe separar o passado
   * (a sessão que existe no dia) da projeção (a partir de HOJE) — e é a mesma
   * fonte da faixa da aba Treino, para as duas telas nunca discordarem.
   */
  const grade = useMemo(
    () =>
      ref && perfil && hoje
        ? montarGrade({ data: ref, perfil, overrides, sessoes, cardios, hoje })
        : [],
    [ref, perfil, overrides, sessoes, cardios, hoje],
  );

  /*
   * SPEC §22.8 item 11: a contagem da semana lê a MESMA grade, já sem os dias
   * anteriores a `data_inicio` — senão a barra diria "5 perdidos" numa semana
   * em que a grade não desenha perdido nenhum.
   */
  const semanaContada = useMemo(
    () => grade.filter((d) => d.marca !== "antes").map((d) => d.dia),
    [grade],
  );

  const mes = useMemo(
    () =>
      ref && perfil && hoje
        ? montarMes(ref, perfil, overrides, sessoes, cardios, hoje)
        : [],
    [ref, perfil, overrides, sessoes, cardios, hoje],
  );

  const realizados: Realizado[] = useMemo(
    () => [
      ...sessoes.map((s) => ({
        data: s.data,
        tipo: "forca" as const,
        concluida: s.status === "concluida",
      })),
      ...cardios.map((c) => ({
        data: c.data,
        tipo: "cardio" as const,
        concluida: c.concluida,
      })),
    ],
    [sessoes, cardios],
  );

  const falta = useMemo(
    () => (hoje ? oQueFaltaNaSemana(semanaContada, realizados, hoje) : null),
    [semanaContada, realizados, hoje],
  );

  /* ------------------------------------------------ semana curta (§5.4) */

  const previaSemanaCurta = useMemo(() => {
    if (!hoje || !perfil) return null;
    const planejada = semanaCoerente(hoje, perfil, {
      overrides,
      sessoes,
      hoje,
    });
    const resultado = semanaCurta(hoje, planejada);
    return {
      mudancas: overridesDaSemanaCurta(planejada, resultado.dias, hoje),
      cortados: resultado.cortados.map((c) =>
        c.treinoId ? acharTreino(c.treinoId).nome : (c.sessao ?? "cardio"),
      ),
    };
  }, [hoje, perfil, overrides, sessoes]);

  if (perfilQ.isError) {
    return (
      <Tela>
        <Erro
          mensagem={(perfilQ.error as Error).message}
          aoTentarDeNovo={() => void perfilQ.refetch()}
        />
      </Tela>
    );
  }

  if (!hoje || !ref || !perfil || !intervalo) {
    return (
      <Tela>
        <EsqueletoCard linhas={7} />
      </Tela>
    );
  }

  const dias = diasDaSemana(ref);
  const primeiro = dias[0] ?? ref;
  const ultimo = dias[dias.length - 1] ?? ref;
  const temHoje = grade.some((d) => d.ehHoje);

  const irPara = (semanas: number) =>
    setReferencia(iso(addWeeks(new Date(`${ref}T00:00:00`), semanas)));

  const irParaMes = (meses: number) =>
    setReferencia(iso(addMonths(new Date(`${ref}T00:00:00`), meses)));

  /*
   * SPEC §22.8 item 2: tocar num dia do mês abre o MESMO diálogo do cartão da
   * semana. A `DiaDaGrade` daquele dia sai de `montarGrade()` na hora — a
   * mesma fonte da grade de cima, sem uma segunda montagem para discordar
   * dela —, e a semana mostrada acompanha o dia tocado.
   */
  const abrirDiaDoMes = (d: DiaDoMes) => {
    const doDia = montarGrade({
      data: d.data,
      perfil,
      overrides,
      sessoes,
      cardios,
      hoje,
    }).find((g) => g.data === d.data);
    setReferencia(d.data);
    if (doDia) setDiaTocado(doDia);
  };

  const trocarDia = async (dia: DiaDaGrade, troca: TrocaDoDia) => {
    setDiaTocado(null);
    try {
      await gravarOverrides({
        userId,
        intervalo,
        cliente,
        novos: [
          {
            data: dia.data,
            tipo: troca.tipo,
            workout_id: troca.workout_id,
            sessao: troca.sessao,
            motivo: troca.motivo,
            descricao: "",
          },
        ],
      });
      toast.success(`${formatarData(dia.data)} atualizado.`);
    } catch {
      toast.error("Não consegui salvar a troca agora. Ela fica na fila.");
    }
  };

  const desfazerDia = async (dia: DiaDaGrade) => {
    setDiaTocado(null);
    try {
      await apagarOverride({ data: dia.data, intervalo, cliente });
      toast.success(`${formatarData(dia.data)} voltou ao programa.`);
    } catch {
      toast.error("Não consegui desfazer agora. Fica na fila.");
    }
  };

  const aplicarSemanaCurta = async (motivo: string | null) => {
    setSemanaCurtaAberta(false);
    const mudancas = previaSemanaCurta?.mudancas ?? [];
    if (mudancas.length === 0) return;
    try {
      await gravarOverrides({
        userId,
        intervalo,
        cliente,
        novos: mudancas.map((m) => ({ ...m, motivo })),
      });
      toast.success("Semana reorganizada.");
    } catch {
      toast.error("Não consegui reorganizar agora. Fica na fila.");
    }
  };

  const semanaDaFaseMostrada = semanaDaFase(ref, perfil.fase_desde);
  const ofereceFase2 = faseCumprida(perfil.fase_atual, semanaDaFaseMostrada);

  /*
   * SPEC §22.8 item 7: "0 perdidos" não é notícia — a semana perfeita lê
   * "3 feitos · 2 a fazer" —, e os três números viram também uma barra.
   */
  const contagem = falta
    ? {
        feitos: falta.feitos.length,
        aFazer: falta.faltando.length,
        perdidos: falta.perdidos.length,
      }
    : null;
  const total = contagem
    ? contagem.feitos + contagem.aFazer + contagem.perdidos
    : 0;
  const resumoDaSemana = contagem
    ? [
        `${contagem.feitos} ${contagem.feitos === 1 ? "feito" : "feitos"}`,
        `${contagem.aFazer} a fazer`,
        contagem.perdidos > 0
          ? `${contagem.perdidos} ${contagem.perdidos === 1 ? "perdido" : "perdidos"}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const segmentos = contagem
    ? ([
        { chave: "feitos", cor: "bg-primary", quantos: contagem.feitos },
        { chave: "aFazer", cor: "bg-muted-foreground/30", quantos: contagem.aFazer },
        { chave: "perdidos", cor: "bg-destructive/50", quantos: contagem.perdidos },
      ].filter((s) => s.quantos > 0))
    : [];

  return (
    <Tela
      fase={rotuloDaFase(perfil.fase_atual, semanaDaFaseMostrada)}
      ofereceFase2={ofereceFase2}
    >
      {/*
        SPEC §22.8 item 8: o intervalo da semana fica ENTRE as setas — era o
        subtítulo da tela, longe dos controles que o mudam — e o "Hoje", que
        ocupava a largura inteira, só aparece quando a semana mostrada não é a
        atual. `flex-wrap` porque a 200 % de zoom a linha não cabe (§22.8
        item 3).
      */}
      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button
          variant="outline"
          className="alvo p-0"
          aria-label="Semana anterior"
          onClick={() => irPara(-1)}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <p className="numero min-w-0 flex-1 text-center text-sm font-medium">
          {formatarData(primeiro)} – {formatarData(ultimo)}
        </p>
        <Button
          variant="outline"
          className="alvo p-0"
          aria-label="Próxima semana"
          onClick={() => irPara(1)}
        >
          <ChevronRight className="size-5" />
        </Button>
        {temHoje ? null : (
          <Button
            variant="secondary"
            className="alvo px-3 text-sm"
            onClick={() => setReferencia(hoje)}
          >
            Hoje
          </Button>
        )}
      </div>

      {contagem && resumoDaSemana && total > 0 ? (
        <div className="flex flex-col gap-1">
          {total > 0 ? (
            <span
              aria-hidden
              className="bg-muted flex h-2 w-full overflow-hidden rounded-full"
            >
              {segmentos.map((s) => (
                <span
                  key={s.chave}
                  className={s.cor}
                  style={{ width: `${Math.round((s.quantos / total) * 100)}%` }}
                />
              ))}
            </span>
          ) : null}
          <p className="text-muted-foreground text-xs">{resumoDaSemana}</p>
        </div>
      ) : null}

      <GradeDaSemana dias={grade} aoTocar={setDiaTocado} />

      {/*
        SPEC §22.8 item 9: a ação flutuava no fim da tela, longe do dia que
        ela altera. Agora vem logo abaixo da grade, separada por um divisor e
        com a data de hoje no rótulo.
      */}
      {temHoje ? (
        <div className="border-border flex flex-col gap-2 border-t pt-3">
          <p className="text-muted-foreground text-xs">
            Se hoje ({formatarData(hoje)}) não rolar
          </p>
          <Button
            variant="outline"
            className="alvo h-12 w-full"
            onClick={() => setSemanaCurtaAberta(true)}
          >
            <CalendarOff className="size-4" />
            Não vou treinar hoje
          </Button>
        </div>
      ) : null}

      <MesEmMiniatura
        semanas={mes}
        titulo={formatarMesAno(ref)}
        aoTocarDia={abrirDiaDoMes}
        aoVoltar={() => irParaMes(-1)}
        aoAvancar={() => irParaMes(1)}
        focoEm={ref}
      />

      <DialogoDia
        dia={diaTocado}
        fase={perfil.fase_atual}
        aoFechar={() => setDiaTocado(null)}
        aoTrocar={(troca) => diaTocado && void trocarDia(diaTocado, troca)}
        aoDesfazer={() => diaTocado && void desfazerDia(diaTocado)}
      />

      <DialogoSemanaCurta
        aberto={semanaCurtaAberta}
        mudancas={previaSemanaCurta?.mudancas ?? []}
        cortados={previaSemanaCurta?.cortados ?? []}
        aoFechar={() => setSemanaCurtaAberta(false)}
        aoConfirmar={(motivo) => void aplicarSemanaCurta(motivo)}
      />
    </Tela>
  );
}

function Tela({
  fase,
  ofereceFase2,
  children,
}: {
  /** "Fase 1 · semana 3 de 12" (SPEC §16.4). */
  fase?: string;
  /** A Fase 1 cobriu as 12 semanas: a tela oferece a troca (SPEC §22.8). */
  ofereceFase2?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      {/* `flex-wrap`: a 200 % de zoom o título e "Meus dias" não cabem na
          mesma linha, e a página inteira rolava para o lado (§22.8 item 3) */}
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col items-start gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Calendário</h1>
          {fase ? <p className="text-primary text-xs font-medium">{fase}</p> : null}
          {ofereceFase2 ? (
            <Button asChild variant="outline" className="alvo px-3 text-xs">
              <Link href="/mais/perfil">Passar para a Fase 2</Link>
            </Button>
          ) : null}
        </div>
        {/* SPEC §17.1: o atalho para o card "Dias de treino" das Preferências */}
        <Button asChild variant="outline" className="alvo shrink-0 px-3">
          <Link href="/mais/preferencias#dias-de-treino">
            <CalendarCog className="size-4" />
            Meus dias
          </Link>
        </Button>
      </header>
      {children}
    </section>
  );
}
