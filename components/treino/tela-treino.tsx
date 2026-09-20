"use client";

import { useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import {
  BannerSessaoAberta,
  CardCardio,
  CardDescanso,
  CardForca,
} from "@/components/treino/cards";
import { CabecalhoDoTreino } from "@/components/treino/cabecalho";
import { ModoEditar } from "@/components/treino/editar";
import { FabAjustar } from "@/components/treino/fab-ajustar";
import { ListaDoDia } from "@/components/treino/lista";
import { CardRetomada } from "@/components/treino/retomada";
import { Button } from "@/components/ui/button";
import {
  iso,
  inicioDaSemana,
  paraData,
  proximoTreinoDaFase,
  semanaDaFase,
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
import { aplicarRetomada } from "@/lib/queries/retomada";
import { useComecarTreino } from "@/lib/queries/comecar";
import {
  useCardio,
  useCardioDesde,
  useEstados,
  useEstadosTodos,
  useEventos,
  useOverrides,
  usePerfil,
  useRecordes,
  useSeriesAnteriores,
  useSeriesDaSessao,
  useSessoes,
  useSessoesAbertas,
  useSoltas,
  useSoltasDoDia,
  useUltimoPeso,
} from "@/lib/queries/dados";
import { useHoje } from "@/lib/relogio";
import { guiaVisto, ligado, opcoesDeMontagem } from "@/lib/preferencias";
import {
  faixaDaRetomada,
  pausaCorrente,
  type EscolhaRetomada,
} from "@/lib/retomada";
import { faixaDaSemana, intervaloDaSemana, montarGrade } from "@/lib/semana";
import {
  guardarTrocasNoAparelho,
  lerTrocasDoAparelho,
  limparTrocasDoAparelho,
} from "@/lib/trocas";
import { Pencil } from "lucide-react";


/*
 * SPEC §22.4 item 10: os três blocos do fim da aba Treino — os desafios, o
 * atalho por parte do corpo e o "Personalizar" — ficam abaixo da dobra e
 * ninguém decide nada por eles antes de rolar. Entrando por `next/dynamic`,
 * eles saem do JavaScript da primeira carga da rota `/` (a mais visitada do
 * app) e chegam logo depois, cada um com a própria altura reservada para a
 * rolagem não pular no meio do caminho.
 */
const Desafios = dynamic(
  () => import("@/components/treino/desafios").then((m) => m.Desafios),
  { ssr: false, loading: () => <EsqueletoCard linhas={2} /> },
);

const ParteDoCorpo = dynamic(
  () => import("@/components/treino/parte-do-corpo").then((m) => m.ParteDoCorpo),
  { ssr: false, loading: () => <EsqueletoCard linhas={2} /> },
);

const Personalizar = dynamic(
  () => import("@/components/treino/personalizar").then((m) => m.Personalizar),
  { ssr: false, loading: () => <EsqueletoCard linhas={1} /> },
);
/** O que a tela diz depois de cada escolha da retomada (SPEC §18.2). */
const AVISO_DA_ESCOLHA: Record<EscolhaRetomada, string> = {
  continuar: "Seguindo de onde você parou.",
  semana: "Corrida, corda e barra fixa voltaram uma semana.",
  leve: "Semana leve: 60 % da carga. O app devolve a carga depois.",
  zero: "Programa recomeçado. O histórico continua aí.",
};

/**
 * SPEC §20.1: a primeira entrada da conta vai para o guia — **uma vez por
 * carregamento**. A marca é de módulo: depois de mandar uma vez, esta carga do
 * app não manda de novo, nem que o perfil volte do banco sem `guia_visto`
 * enquanto a gravação ainda está na fila (§8). Recarregar zera a marca, que é
 * o comportamento desejado: quem fecha o app sem reconhecer vê o guia outra vez.
 */
let jaMandouParaOGuia = false;

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
  const router = useRouter();
  const cliente = useQueryClient();
  const [somando, setSomando] = useState(false);
  const [trocas, setTrocas] = useState<Record<string, string>>({});
  /* "Editar" (SPEC §14.3): a ordem vale só para a sessão que vai começar */
  const [ordem, setOrdem] = useState<string[]>([]);
  const [editando, setEditando] = useState(false);
  /* SPEC §18: a retomada decidida antes de treinar */
  const [decidindo, setDecidindo] = useState(false);
  const [destacarRetomada, setDestacarRetomada] = useState(false);
  const refRetomada = useRef<HTMLElement>(null);

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
  /* SPEC §18.1: a barra fixa solta também conta como atividade */
  const soltasDoPeriodoQ = useSoltas(desde, hoje);

  const perfil = perfilQ.data ?? null;

  /* SPEC §20.1: conta sem `prefs.guia_visto` cai no guia antes de tudo. */
  const semGuiaVisto = perfil !== null && !guiaVisto(perfil.prefs);
  /*
   * Quem desvia é ESTA montagem: a marca de módulo só impede um segundo desvio.
   * Sem isto, voltar para a aba Treino sem ter reconhecido o guia (o "Ir" do
   * próprio guia leva a `/`) deixava a tela no esqueleto para sempre — não
   * desviava mais e também não desenhava nada.
   */
  const desviouAqui = useRef(false);
  const desviando = semGuiaVisto && (desviouAqui.current || !jaMandouParaOGuia);
  useEffect(() => {
    if (!semGuiaVisto || jaMandouParaOGuia) return;
    jaMandouParaOGuia = true;
    desviouAqui.current = true;
    router.replace("/mais/guia?inicio=1");
  }, [semGuiaVisto, router]);

  const dia = useMemo(() => {
    if (!hoje || !perfil) return null;
    return treinoDeHoje(hoje, perfil, overridesQ.data ?? []);
  }, [hoje, perfil, overridesQ.data]);

  const treinoId = dia?.tipo === "forca" ? dia.treinoId : null;

  /*
   * SPEC §18.1: há quantos dias inteiros ele não registra nada — força, cardio
   * ou barra fixa. A conta corre a cada desenho da tela, então vale tanto ao
   * abrir a aba quanto ao tocar em "Começar treino"; e a atividade registrada
   * hoje não derruba uma pausa que ainda não foi decidida.
   */
  const pausa = useMemo(
    () =>
      hoje
        ? pausaCorrente({
            hoje,
            sessoes: sessoesQ.data ?? [],
            cardios: cardioDesdeQ.data ?? [],
            fixas: soltasDoPeriodoQ.data ?? [],
            prefs: perfil?.prefs,
          })
        : { dias: null, ultima: null, mostrar: false },
    [hoje, sessoesQ.data, cardioDesdeQ.data, soltasDoPeriodoQ.data, perfil?.prefs],
  );

  const mostrarRetomada = pausa.mostrar;
  const opcoesDaRetomada = mostrarRetomada
    ? faixaDaRetomada(pausa.dias).opcoes
    : [];
  /* "Voltar mais leve" e "Recomeçar do zero" mexem em TODAS as cargas (§18.2) */
  const precisaDasCargas = opcoesDaRetomada.some(
    (o) => o.escolha === "leve" || o.escolha === "zero",
  );
  const estadosTodosQ = useEstadosTodos(precisaDasCargas);

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

  /*
   * O esqueleto cobre o vão do redirecionamento (§20.1): sem isto a aba Treino
   * pisca inteira antes de o guia abrir.
   */
  if (!hoje || !perfil || !dia || !intervalo || desviando) {
    return (
      <Tela>
        <EsqueletoCard linhas={4} />
      </Tela>
    );
  }

  const sessoes = sessoesQ.data ?? [];
  const cardiosDaSemana = cardioQ.data ?? [];
  const cardios = cardioDesdeQ.data ?? cardiosDaSemana;

  // SPEC §16.2: a mesma fonte do /calendario — passado pela sessão real,
  // hoje e futuro pela projeção a partir de hoje.
  const grade = montarGrade({
    data: hoje,
    perfil,
    overrides: overridesQ.data ?? [],
    sessoes,
    cardios: cardiosDaSemana,
    hoje,
  });
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

  /*
   * SPEC §18.3: o portão da retomada. Todo gesto da aba Treino que começa um
   * treino ou registra atividade — "Começar treino", o "Começar" do cardio, o
   * "+1" da barra fixa, "Treinar mesmo assim" e a caminhada leve — passa por
   * aqui: com a pausa por decidir, o toque leva ao card (foco, destaque e um
   * aviso) e não faz mais nada. Devolve `true` quando barrou.
   */
  const pedirDecisao = (): boolean => {
    if (!mostrarRetomada) return false;
    setDestacarRetomada(true);
    refRetomada.current?.scrollIntoView({ block: "start" });
    refRetomada.current?.focus({ preventScroll: true });
    toast.info("Antes: escolha como você quer voltar.");
    return true;
  };

  /* SPEC §18.2: a escolha vai para a fila e o card some. */
  const escolherRetomada = async (escolha: EscolhaRetomada) => {
    if (pausa.dias === null) return;
    setDecidindo(true);
    try {
      await aplicarRetomada({
        userId,
        perfil,
        estados: estadosTodosQ.data ?? [],
        escolha,
        dias: pausa.dias,
        hoje,
        cliente,
      });
      setDestacarRetomada(false);
      toast.success(AVISO_DA_ESCOLHA[escolha]);
    } catch {
      toast.error("Não consegui salvar agora. Fica na fila.");
    } finally {
      setDecidindo(false);
    }
  };

  const somarUma = async () => {
    /* SPEC §18.3: a repetição solta grava na hora — decidir vem antes dela */
    if (pedirDecisao()) return;
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

      {mostrarRetomada && pausa.dias !== null ? (
        <CardRetomada
          ref={refRetomada}
          dias={pausa.dias}
          opcoes={opcoesDaRetomada}
          ocupado={decidindo}
          /* sem as cargas lidas, "mais leve" e "do zero" escreveriam vazio */
          semCargas={precisaDasCargas && !estadosTodosQ.isSuccess}
          destacado={destacarRetomada}
          aoEscolher={(escolha) => void escolherRetomada(escolha)}
        />
      ) : null}

      <section aria-label="Hoje" className="flex flex-col gap-3">
        {dia.tipo === "forca" && treinoId ? (
          <CardForca
            resumo={resumoDoTreino(treinoId)}
            aviso={aviso}
            mostrarRaios={mostrarRaios}
            semanaDaFase={semanaDaFase(hoje, perfil.fase_desde)}
            aberta={abertaDoDia}
            criando={criando !== null}
            aoComecar={() => {
              /* SPEC §18.3: com a retomada pendente, decidir vem antes */
              if (pedirDecisao()) return;
              void comecar({ userId, perfil, hoje, treinoId, trocas, ordem });
            }}
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
            /* SPEC §18.3: sem a decisão, o "Começar" leva ao card */
            bloqueado={mostrarRetomada}
            aoBloquear={pedirDecisao}
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
            /* SPEC §18.3: idem para a caminhada e o "Treinar mesmo assim" */
            bloqueado={mostrarRetomada}
            aoBloquear={pedirDecisao}
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

      {/*
        SPEC §18.3: o FAB é `fixed` e passa por cima do card da retomada, comendo
        o fim da frase de uma das opções e o toque naquele canto. Com a pausa por
        decidir ele sai da tela — decidir vem antes de ajustar.
      */}
      {mostrarRetomada ? null : <FabAjustar perfil={perfil} />}
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
