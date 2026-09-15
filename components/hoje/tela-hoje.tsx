"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import {
  BannerSessaoAberta,
  CardCardio,
  CardDescanso,
  CardForca,
} from "@/components/hoje/cards";
import { FaixaStatus } from "@/components/hoje/faixa-status";
import {
  proximoTreinoDaFase,
  semanaDaFase,
  treinoDeHoje,
} from "@/lib/calendario";
import { acharFase, acharTreino, exerciciosDoTreino } from "@/lib/dados";
import { formatarDataLonga } from "@/lib/formato";
import {
  alternativaDeCorda,
  avisoCorridaEPerna,
  estadosPorExercicio,
  houveCardioHoje,
  previaDoTreino,
  resumoDoTreino,
  sequenciaDeTreinos,
  sessaoAberta,
  statusDoPeso,
  totalDeSoltas,
} from "@/lib/hoje";
import { descartarSessao, registrarSolta } from "@/lib/queries/acoes";
import {
  useCardio,
  useEstados,
  useEventos,
  useOverrides,
  usePerfil,
  useSessoes,
  useSessoesAbertas,
  useSoltasDoDia,
  useUltimoPeso,
} from "@/lib/queries/dados";
import { useHoje } from "@/lib/relogio";
import { intervaloDaSemana } from "@/lib/semana";

/** Nome curto da fase ("Fase 1"), tirado do nome que está no programa.json. */
function nomeCurtoDaFase(nome: string): string {
  const [curto] = nome.split("—");
  return (curto ?? nome).trim();
}

export function TelaHoje({ userId }: { userId: string }) {
  const hoje = useHoje();
  const cliente = useQueryClient();
  const [somando, setSomando] = useState(false);

  const intervalo = hoje ? intervaloDaSemana(hoje) : null;

  const perfilQ = usePerfil();
  const overridesQ = useOverrides(intervalo?.de ?? null, intervalo?.ate ?? null);
  const sessoesQ = useSessoes();
  const abertasQ = useSessoesAbertas();
  const cardioQ = useCardio(intervalo?.de ?? null, intervalo?.ate ?? null);
  const pesoQ = useUltimoPeso();
  const soltasQ = useSoltasDoDia(hoje);

  const perfil = perfilQ.data ?? null;

  const dia = useMemo(() => {
    if (!hoje || !perfil) return null;
    return treinoDeHoje(hoje, perfil, overridesQ.data ?? []);
  }, [hoje, perfil, overridesQ.data]);

  const idsDoTreino = useMemo(
    () =>
      dia?.treinoId
        ? exerciciosDoTreino(dia.treinoId).map(({ exercicio }) => exercicio.id)
        : [],
    [dia?.treinoId],
  );

  const estadosQ = useEstados(idsDoTreino);
  const eventosQ = useEventos(idsDoTreino);

  const itens = useMemo(() => {
    if (!dia?.treinoId) return [];
    return previaDoTreino({
      treinoId: dia.treinoId,
      estados: estadosPorExercicio(estadosQ.data ?? []),
      eventos: eventosQ.data ?? [],
    });
  }, [dia?.treinoId, estadosQ.data, eventosQ.data]);

  if (perfilQ.isError) {
    return (
      <Tela hoje={hoje}>
        <Erro
          mensagem={(perfilQ.error as Error).message}
          aoTentarDeNovo={() => void perfilQ.refetch()}
        />
      </Tela>
    );
  }

  if (!hoje || !perfil || !dia) {
    return (
      <Tela hoje={hoje}>
        <EsqueletoCard linhas={4} />
      </Tela>
    );
  }

  const aberta = sessaoAberta(abertasQ.data ?? []);
  const peso = statusDoPeso(pesoQ.data ?? [], hoje);
  const sequencia = sequenciaDeTreinos(sessoesQ.data ?? []);
  const proximoTreino = proximoTreinoDaFase(perfil.fase_atual, perfil.ultimo_treino);
  const correuHoje = houveCardioHoje(cardioQ.data ?? [], hoje, "corrida");
  const aviso = avisoCorridaEPerna(
    dia,
    dia.tipo === "forca" ? dia.treinoId : proximoTreino,
    correuHoje,
  );

  const somarUma = async () => {
    setSomando(true);
    try {
      await registrarSolta({ userId, data: hoje, cliente });
    } catch {
      toast.error("Não consegui registrar a repetição. Ela fica salva no aparelho.");
    } finally {
      setSomando(false);
    }
  };

  const descartar = async (id: string) => {
    try {
      await descartarSessao({ id, cliente });
      toast.success("Treino guardado como abandonado.");
    } catch {
      toast.error("Não consegui descartar agora. Vou tentar de novo sozinho.");
    }
  };

  return (
    <Tela hoje={hoje}>
      <FaixaStatus
        fase={nomeCurtoDaFase(acharFase(perfil.fase_atual).nome)}
        semana={semanaDaFase(hoje, perfil.fase_desde)}
        sequencia={sequencia}
        peso={peso}
      />

      {aberta ? (
        <BannerSessaoAberta
          texto={aberta.texto}
          href={`/treinar/${aberta.id}`}
          aoDescartar={() => void descartar(aberta.id)}
        />
      ) : null}

      {dia.tipo === "forca" && dia.treinoId ? (
        <CardForca
          resumo={resumoDoTreino(dia.treinoId)}
          itens={itens}
          carregandoPrevia={estadosQ.isPending && idsDoTreino.length > 0}
          aviso={aviso}
        />
      ) : null}

      {dia.tipo === "cardio" && dia.cardio ? (
        <CardCardio
          sessao={dia.cardio}
          alternativaCorda={
            dia.cardio.tipo === "corrida"
              ? alternativaDeCorda(perfil.semana_corda)
              : null
          }
          nomeDoProximoTreino={acharTreino(proximoTreino).nome}
          aviso={aviso}
        />
      ) : null}

      {dia.tipo === "descanso" ? (
        <CardDescanso
          nota={dia.nota}
          total={totalDeSoltas(soltasQ.data ?? [], hoje)}
          aoSomarUma={() => void somarUma()}
          ocupado={somando}
          nomeDoProximoTreino={acharTreino(proximoTreino).nome}
        />
      ) : null}
    </Tela>
  );
}

function Tela({
  hoje,
  children,
}: {
  hoje: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Hoje</h1>
        <p className="text-muted-foreground text-sm first-letter:uppercase">
          {hoje ? formatarDataLonga(hoje) : " "}
        </p>
      </header>
      {children}
    </section>
  );
}
