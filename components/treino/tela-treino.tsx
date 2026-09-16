"use client";

import { useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import {
  BannerSessaoAberta,
  CardCardio,
  CardDescanso,
  CardForca,
} from "@/components/treino/cards";
import { CabecalhoDoTreino } from "@/components/treino/cabecalho";
import { Desafios } from "@/components/treino/desafios";
import { ModoEditar } from "@/components/treino/editar";
import { FabAjustar } from "@/components/treino/fab-ajustar";
import { ListaDoDia } from "@/components/treino/lista";
import { ParteDoCorpo } from "@/components/treino/parte-do-corpo";
import { Personalizar } from "@/components/treino/personalizar";
import { Button } from "@/components/ui/button";
import {
  iso,
  inicioDaSemana,
  paraData,
  proximoTreinoDaFase,
  semanaDaFase,
  semanaDoPlano,
  treinoDeHoje,
} from "@/lib/calendario";
import { acharFase, acharTreino, exerciciosDoTreino } from "@/lib/dados";
import { formatarDiaEData } from "@/lib/formato";
import {
  alternativaDeCorda,
  avisoCorridaEPerna,
  estadosPorExercicio,
  houveCardioHoje,
  previaDoTreino,
  progressoDaAberta,
  resumoDoTreino,
  sessaoAberta,
  statusDoPeso,
  totalDeSoltas,
} from "@/lib/hoje";
import { desafios as montarDesafios } from "@/lib/colecoes";
import { metaSemanal, progressoDaMeta, sequenciaDeSemanas } from "@/lib/metas";
import {
  aplicarOrdem,
  ehAOrdemDoPrograma,
  guardarOrdemNoAparelho,
  lerOrdemDoAparelho,
  limparOrdemDoAparelho,
  mover,
} from "@/lib/ordem";
import { descartarSessao, registrarSolta } from "@/lib/queries/acoes";
import { useComecarTreino } from "@/lib/queries/comecar";
import {
  useCardio,
  useCardioDesde,
  useEstados,
  useEventos,
  useOverrides,
  usePerfil,
  useRecordes,
  useSeriesAnteriores,
  useSeriesDaSessao,
  useSessoes,
  useSessoesAbertas,
  useSoltasDoDia,
  useUltimoPeso,
} from "@/lib/queries/dados";
import { useHoje } from "@/lib/relogio";
import { ligado, opcoesDeMontagem } from "@/lib/preferencias";
import { faixaDaSemana, intervaloDaSemana, montarGrade } from "@/lib/semana";
import {
  guardarTrocasNoAparelho,
  lerTrocasDoAparelho,
  limparTrocasDoAparelho,
} from "@/lib/trocas";
import { Pencil } from "lucide-react";

/** Quantas semanas para trás a sequência de semanas precisa ler. */
const SEMANAS_LIDAS = 16;

/** Nome curto da fase ("Fase 1"), tirado do nome que está no programa.json. */
function nomeCurtoDaFase(nome: string): string {
  const [curto] = nome.split("—");
  return (curto ?? nome).trim();
}

/** A aba Treino (SPEC §13.3): o cabeçalho, os cards do dia e a lista do treino. */
export function TelaTreino({ userId }: { userId: string }) {
  const hoje = useHoje();
  const cliente = useQueryClient();
  const [somando, setSomando] = useState(false);
  const [trocas, setTrocas] = useState<Record<string, string>>({});
  /* "Editar" (SPEC §14.3): a ordem vale só para a sessão que vai começar */
  const [ordem, setOrdem] = useState<string[]>([]);
  const [editando, setEditando] = useState(false);

  const intervalo = hoje ? intervaloDaSemana(hoje) : null;
  const desde = hoje
    ? iso(addDays(inicioDaSemana(paraData(hoje)), -7 * (SEMANAS_LIDAS - 1)))
    : null;

  const perfilQ = usePerfil();
  const overridesQ = useOverrides(intervalo?.de ?? null, intervalo?.ate ?? null);
  const sessoesQ = useSessoes();
  const abertasQ = useSessoesAbertas();
  const cardioQ = useCardio(intervalo?.de ?? null, intervalo?.ate ?? null);
  const cardioDesdeQ = useCardioDesde(desde);
  const pesoQ = useUltimoPeso();
  const soltasQ = useSoltasDoDia(hoje);

  const perfil = perfilQ.data ?? null;

  const dia = useMemo(() => {
    if (!hoje || !perfil) return null;
    return treinoDeHoje(hoje, perfil, overridesQ.data ?? []);
  }, [hoje, perfil, overridesQ.data]);

  const treinoId = dia?.tipo === "forca" ? dia.treinoId : null;

  /* a escolha do ⇄ vale para o treino de hoje e some sozinha no dia seguinte */
  useEffect(() => {
    if (!hoje || !treinoId) {
      setTrocas({});
      return;
    }
    setTrocas(lerTrocasDoAparelho(hoje, treinoId));
    setOrdem(lerOrdemDoAparelho(hoje, treinoId));
  }, [hoje, treinoId]);

  const trocar = useCallback(
    (originalId: string, novoId: string) => {
      if (!hoje || !treinoId) return;
      setTrocas((atuais) => {
        const novas = { ...atuais };
        if (novoId === originalId) delete novas[originalId];
        else novas[originalId] = novoId;
        guardarTrocasNoAparelho(hoje, treinoId, novas);
        return novas;
      });
    },
    [hoje, treinoId],
  );

  /** Os ids do programa, na ordem do programa (a base de "Editar"). */
  const idsDoPrograma = useMemo(
    () =>
      treinoId
        ? exerciciosDoTreino(treinoId).map(({ exercicio }) => exercicio.id)
        : [],
    [treinoId],
  );

  const reordenar = useCallback(
    (de: number, para: number) => {
      if (!hoje || !treinoId) return;
      setOrdem((atual) => {
        const nova = mover(aplicarOrdem(idsDoPrograma, atual), de, para);
        guardarOrdemNoAparelho(hoje, treinoId, idsDoPrograma, nova);
        return nova;
      });
    },
    [hoje, treinoId, idsDoPrograma],
  );

  const voltarAoPrograma = useCallback(() => {
    setOrdem([]);
    limparOrdemDoAparelho();
  }, []);

  const ids = useMemo(() => {
    if (!treinoId) return [];
    const doPrograma = exerciciosDoTreino(treinoId).map(({ exercicio }) => exercicio.id);
    return Array.from(new Set([...doPrograma, ...Object.values(trocas)]));
  }, [treinoId, trocas]);

  const estadosQ = useEstados(ids);
  const eventosQ = useEventos(ids);
  /*
   * Recordes e séries anteriores não aparecem nesta tela: são lidos aqui para
   * o "Começar treino" do card montar a sessão sem passar por outra tela — e
   * para o cache persistido cobrir o treino começado sem rede (SPEC §6.3).
   */
  useRecordes(ids);
  useSeriesAnteriores(ids);

  const { criando, comecar } = useComecarTreino();

  const itens = useMemo(() => {
    if (!treinoId) return [];
    return previaDoTreino({
      treinoId,
      estados: estadosPorExercicio(estadosQ.data ?? []),
      eventos: eventosQ.data ?? [],
      // as barras já pesadas na balança mudam a escala (SPEC §3.9)
      montagem: opcoesDeMontagem(perfil?.prefs),
      trocas,
      ordem,
    });
  }, [treinoId, estadosQ.data, eventosQ.data, perfil?.prefs, trocas, ordem]);

  const aberta = sessaoAberta(abertasQ.data ?? []);
  const seriesDaAbertaQ = useSeriesDaSessao(aberta?.id ?? null);

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

  if (!hoje || !perfil || !dia || !intervalo) {
    return (
      <Tela>
        <EsqueletoCard linhas={4} />
      </Tela>
    );
  }

  const sessoes = sessoesQ.data ?? [];
  const cardiosDaSemana = cardioQ.data ?? [];
  const cardios = cardioDesdeQ.data ?? cardiosDaSemana;

  const grade = montarGrade(
    semanaDoPlano(hoje, perfil, overridesQ.data ?? []),
    sessoes,
    cardiosDaSemana,
    hoje,
  );
  const meta = metaSemanal(perfil.prefs, perfil.fase_atual);
  const progresso = progressoDaMeta({
    sessoes,
    cardios: cardiosDaSemana,
    de: intervalo.de,
    ate: intervalo.ate,
    meta,
  });
  const sequencia = sequenciaDeSemanas({ sessoes, cardios, hoje, meta });

  const peso = statusDoPeso(pesoQ.data ?? [], hoje);
  const proximoTreino = proximoTreinoDaFase(perfil.fase_atual, perfil.ultimo_treino);
  const correuHoje = houveCardioHoje(cardiosDaSemana, hoje, "corrida");
  const aviso = avisoCorridaEPerna(dia, treinoId ?? proximoTreino, correuHoje);
  const mostrarRaios = ligado(perfil.prefs, "mostrar_raios");

  /*
   * O card só vira "Continuar" quando a sessão aberta é a de hoje: uma sessão
   * de outro dia continua no banner, com Continuar **e** Descartar (§3.1).
   */
  const abertaDoDia =
    aberta && treinoId && aberta.data === hoje && aberta.workoutId === treinoId
      ? {
          id: aberta.id,
          progresso: progressoDaAberta(aberta.workoutId, seriesDaAbertaQ.data ?? []).texto,
        }
      : null;

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
      // a sessão descartada leva junto as trocas guardadas para ela
      limparTrocasDoAparelho();
      setTrocas({});
      toast.success("Treino guardado como abandonado.");
    } catch {
      toast.error("Não consegui descartar agora. Vou tentar de novo sozinho.");
    }
  };

  return (
    <Tela>
      <CabecalhoDoTreino
        saudacao={formatarDiaEData(hoje)}
        sequenciaDeSemanas={sequencia}
        dias={faixaDaSemana(grade)}
        meta={progresso}
        fase={nomeCurtoDaFase(acharFase(perfil.fase_atual).nome)}
        semanaDaFase={semanaDaFase(hoje, perfil.fase_desde)}
        peso={peso}
      />

      {aberta && !abertaDoDia ? (
        <BannerSessaoAberta
          texto={aberta.texto}
          href={`/treinar/${aberta.id}`}
          aoDescartar={() => void descartar(aberta.id)}
        />
      ) : null}

      <section aria-label="Hoje" className="flex flex-col gap-3">
        {dia.tipo === "forca" && treinoId ? (
          <CardForca
            resumo={resumoDoTreino(treinoId)}
            aviso={aviso}
            mostrarRaios={mostrarRaios}
            aberta={abertaDoDia}
            criando={criando !== null}
            aoComecar={() =>
              void comecar({ userId, perfil, hoje, treinoId, trocas, ordem })
            }
          />
        ) : null}

        {dia.tipo === "cardio" && dia.cardio ? (
          <CardCardio
            sessao={dia.cardio}
            alternativaCorda={
              dia.cardio.tipo === "corrida" ? alternativaDeCorda(perfil.semana_corda) : null
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
            comCaminhada={dia.dia === "dom"}
          />
        ) : null}
      </section>

      {treinoId ? (
        editando ? (
          <ModoEditar
            itens={itens}
            aoMover={reordenar}
            aoVoltarAoPrograma={voltarAoPrograma}
            aoFechar={() => setEditando(false)}
            ehAOrdemDoPrograma={ehAOrdemDoPrograma(idsDoPrograma, ordem)}
          />
        ) : (
          <>
            <ListaDoDia
              itens={itens}
              carregando={estadosQ.isPending && ids.length > 0}
              mostrarRaios={mostrarRaios}
              prefs={perfil?.prefs}
              aoSubstituir={trocar}
            />
            <Button
              variant="outline"
              className="alvo h-12 w-full rounded-xl"
              onClick={() => setEditando(true)}
            >
              <Pencil aria-hidden="true" className="size-4" />
              Editar
            </Button>
          </>
        )
      ) : null}

      <Desafios
        desafios={montarDesafios({
          fase: perfil.fase_atual,
          semanaDaFase: semanaDaFase(hoje, perfil.fase_desde),
          semanaFixa: perfil.semana_fixa,
          semanaCorrida: perfil.semana_corrida,
          proximoTreino,
        })}
      />

      <ParteDoCorpo prefs={perfil.prefs} mostrarRaios={mostrarRaios} />

      <Personalizar prefs={perfil.prefs} />

      <FabAjustar perfil={perfil} />
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  /* `pb-24`: o FAB "Ajustar" é fixo e cobria o fim da lista sem esta folga */
  return (
    <section aria-label="Treino" className="flex flex-col gap-4 pb-24">
      {children}
    </section>
  );
}
