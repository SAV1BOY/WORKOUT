"use client";

import { useQueryClient } from "@tanstack/react-query";
import { addDays, addWeeks, startOfMonth } from "date-fns";
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
  montarGrade,
  montarMes,
  overridesDaSemanaCurta,
  rotuloDaFase,
  type DiaDaGrade,
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

  const semana = useMemo(() => grade.map((d) => d.dia), [grade]);

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
    () => (hoje ? oQueFaltaNaSemana(semana, realizados, hoje) : null),
    [semana, realizados, hoje],
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
      <Tela titulo={null}>
        <Erro
          mensagem={(perfilQ.error as Error).message}
          aoTentarDeNovo={() => void perfilQ.refetch()}
        />
      </Tela>
    );
  }

  if (!hoje || !ref || !perfil || !intervalo) {
    return (
      <Tela titulo={null}>
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

  return (
    <Tela
      titulo={`${formatarData(primeiro)} – ${formatarData(ultimo)}`}
      fase={rotuloDaFase(perfil.fase_atual, semanaDaFase(ref, perfil.fase_desde))}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="alvo p-0"
          aria-label="Semana anterior"
          onClick={() => irPara(-1)}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <Button
          variant={temHoje ? "outline" : "default"}
          className="alvo h-11 flex-1"
          onClick={() => setReferencia(hoje)}
        >
          Hoje
        </Button>
        <Button
          variant="outline"
          className="alvo p-0"
          aria-label="Próxima semana"
          onClick={() => irPara(1)}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {falta ? (
        <p className="text-muted-foreground text-xs">
          {falta.feitos.length} {falta.feitos.length === 1 ? "feito" : "feitos"} ·{" "}
          {falta.faltando.length} a fazer · {falta.perdidos.length}{" "}
          {falta.perdidos.length === 1 ? "perdido" : "perdidos"}
        </p>
      ) : null}

      <GradeDaSemana dias={grade} aoTocar={setDiaTocado} />

      {temHoje ? (
        <Button
          variant="outline"
          className="alvo h-12 w-full"
          onClick={() => setSemanaCurtaAberta(true)}
        >
          <CalendarOff className="size-4" />
          Não vou treinar hoje
        </Button>
      ) : null}

      <MesEmMiniatura semanas={mes} titulo={formatarMesAno(ref)} />

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
  titulo,
  fase,
  children,
}: {
  titulo: string | null;
  /** "Fase 1 · semana 3 de 12" (SPEC §16.4). */
  fase?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">Calendário</h1>
          <p className="text-muted-foreground numero text-sm">{titulo ?? " "}</p>
          {fase ? <p className="text-primary text-xs font-medium">{fase}</p> : null}
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
