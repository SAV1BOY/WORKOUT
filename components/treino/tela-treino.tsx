"use client";

import { useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCapa, EsqueletoLista } from "@/components/carregando";
import type { MaterialDoTreino } from "@/components/exercicio/equipamento-de-hoje";
import { useMaterialDaSessao } from "@/components/treinar/usar-material-da-sessao";
import { useMaterialDoDia } from "@/components/treino/usar-material-do-dia";
import { useOrdemDoDia } from "@/components/treino/usar-ordem-do-dia";
import {
  BannerSessaoAberta,
  CardCardio,
  CardDescanso,
  CardForca,
} from "@/components/treino/cards";
import { CabecalhoDoTreino, FaixaFixaDoDia } from "@/components/treino/cabecalho";
import { Desafios } from "@/components/treino/desafios";
import { ModoEditar } from "@/components/treino/editar";
import { BotaoAjustar } from "@/components/treino/fab-ajustar";
import { ListaDoDia } from "@/components/treino/lista";
import { ParteDoCorpo } from "@/components/treino/parte-do-corpo";
import { Personalizar } from "@/components/treino/personalizar";
import { CardRetomada, useAvisoDeVoltaDoPlayer } from "@/components/treino/retomada";
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
import { equipamentoDaSessao, tagsDoEquipamento } from "@/lib/equipamento-da-sessao";
import { planoDaSessao } from "@/lib/livre";
import { guardarConsultasAgora } from "@/lib/persistencia-query";
import { formatarDiaEData } from "@/lib/formato";
import {
  alternativaDeCorda,
  avisoCorridaEPerna,
  detalheDoTreino,
  estadosPorExercicio,
  houveCardioHoje,
  previaDoTreino,
  progressoDaAberta,
  resumoDoTreino,
  sessaoAberta,
  statusDoPeso,
  totalDeSoltas,
} from "@/lib/hoje";
import { desafios as montarDesafios, nomeCurtoDaFase } from "@/lib/colecoes";
import { metaSemanal, progressoDaMeta, sequenciaDeSemanas } from "@/lib/metas";
import {
  aplicarOrdem,
  ehAOrdemDoPrograma,
  mover,
} from "@/lib/ordem";
import { descartarSessao, registrarSolta } from "@/lib/queries/acoes";
import { aplicarRetomada } from "@/lib/queries/retomada";
import { salvarTrocaDoPrograma, useTrocasDoPrograma } from "@/lib/queries/trocas-do-programa";
import { useComecarTreino } from "@/lib/queries/comecar";
import {
  chaves,
  type SessaoResumo,
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
  useSessao,
  useSessoes,
  useSessoesAbertas,
  useSoltas,
  useSoltasDoDia,
  useUltimoPeso,
} from "@/lib/queries/dados";
import { carregarSessaoLocal, gravarPlanoDaSessao } from "@/lib/queries/sessao";
import { definirEquipamentoDaSessao, itensDoTreino, progressoDaSessao, type SessaoLocal } from "@/lib/sessao";
import type { EquipamentoTag } from "@/lib/schemas";
import type { LinhaSessao } from "@/lib/types";
import { useHoje } from "@/lib/relogio";
import { guiaVisto, guiaVistoNoAparelho, ligado, opcoesDeMontagem } from "@/lib/preferencias";
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
  resolverTrocasDoTreino,
} from "@/lib/trocas";
import { Pencil } from "lucide-react";

/** O que a tela diz depois de cada escolha da retomada (SPEC §18.2). */
const AVISO_DA_ESCOLHA: Record<EscolhaRetomada, string> = {
  continuar: "Seguindo de onde você parou.",
  semana: "Corrida, corda e barra fixa voltaram uma semana.",
  leve: "Semana leve: 60% da carga. O app devolve a carga depois.",
  zero: "Programa recomeçado. O histórico continua aí.",
};

/**
 * SPEC §20.1: a primeira entrada da conta vai para o guia — **uma vez por
 * carregamento**. A marca é de módulo: depois de mandar uma vez, esta carga do
 * app não manda de novo, nem que o perfil volte do banco sem `guia_visto`
 * enquanto a gravação ainda está na fila (§8). Recarregar zera a marca, que é
 * o comportamento desejado: quem fecha o app sem reconhecer vê o guia outra vez.
 */
const contasEnviadasAoGuia = new Set<string>();

/** Quantas semanas para trás a sequência de semanas precisa ler. */
const SEMANAS_LIDAS = 16;

/** A aba Treino (SPEC §13.3): o cabeçalho, os cards do dia e a lista do treino. */
export function TelaTreino({ userId }: { userId: string }) {
  const hoje = useHoje();
  const router = useRouter();
  const cliente = useQueryClient();
  const [somando, setSomando] = useState(false);
  const [rascunho, setRascunho] = useState<{ conta: string; data: string; treino: string; trocas: Record<string, string> } | null>(null);
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
  const cardioQ = useCardio(intervalo?.de ?? null, intervalo?.ate ?? null, userId);
  const cardioDesdeQ = useCardioDesde(desde, userId);
  const pesoQ = useUltimoPeso();
  const soltasQ = useSoltasDoDia(hoje);
  /* SPEC §18.1: a barra fixa solta também conta como atividade */
  const soltasDoPeriodoQ = useSoltas(desde, hoje);

  const perfil = perfilQ.data?.user_id === userId ? perfilQ.data : null;

  /* SPEC §20.1: conta sem `prefs.guia_visto` cai no guia antes de tudo. */
  const semGuiaVisto = perfil !== null && !guiaVisto(perfil.prefs, guiaVistoNoAparelho(userId));
  /*
   * Quem desvia é ESTA montagem: a marca de módulo só impede um segundo desvio.
   * Sem isto, voltar para a aba Treino sem ter reconhecido o guia (o "Ir" do
   * próprio guia leva a `/`) deixava a tela no esqueleto para sempre — não
   * desviava mais e também não desenhava nada.
   */
  const desviouAqui = useRef(false);
  const desviando = semGuiaVisto && (desviouAqui.current || !contasEnviadasAoGuia.has(userId));
  useEffect(() => {
    if (!semGuiaVisto || contasEnviadasAoGuia.has(userId)) return;
    contasEnviadasAoGuia.add(userId);
    desviouAqui.current = true;
    router.replace("/mais/guia?inicio=1");
  }, [semGuiaVisto, router, userId]);

  const dia = useMemo(() => {
    if (!hoje || !perfil) return null;
    return treinoDeHoje(hoje, perfil, overridesQ.data ?? []);
  }, [hoje, perfil, overridesQ.data]);

  const treinoId = dia?.tipo === "forca" ? dia.treinoId : null;
  const materialDoDia = useMaterialDoDia(userId, hoje, treinoId);
  const { ordem, ordemTemporaria, guardar: guardarOrdem } = useOrdemDoDia(userId, hoje, treinoId);
  const lembradas = useTrocasDoPrograma(userId, treinoId);
  const soHoje = rascunho?.conta === userId && rascunho.data === hoje && rascunho.treino === treinoId
    ? rascunho.trocas : undefined;
  const trocas = useMemo(() => treinoId ? resolverTrocasDoTreino(treinoId, lembradas.data, soHoje) : {},
    [treinoId, lembradas.data, soHoje]);

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
    if (!hoje || !treinoId) return;
    setRascunho({ conta: userId, data: hoje, treino: treinoId, trocas: lerTrocasDoAparelho(userId, hoje, treinoId) });
  }, [userId, hoje, treinoId]);

  const trocar = (originalId: string, novoId: string) => {
    if (!hoje || !treinoId) return;
    const novas = { ...(soHoje ?? lerTrocasDoAparelho(userId, hoje, treinoId)), [originalId]: novoId };
    guardarTrocasNoAparelho(userId, hoje, treinoId, novas);
    setRascunho({ conta: userId, data: hoje, treino: treinoId, trocas: novas });
  };

  /** Os ids do programa, na ordem do programa (a base de "Editar"). */
  const idsDoPrograma = useMemo(
    () =>
      treinoId
        ? exerciciosDoTreino(treinoId).map(({ exercicio }) => exercicio.id)
        : [],
    [treinoId],
  );

  const reordenar = (de: number, para: number) => {
    guardarOrdem(idsDoPrograma, mover(aplicarOrdem(idsDoPrograma, ordem), de, para));
  };

  const voltarAoPrograma = () => guardarOrdem(idsDoPrograma, []);

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
  const abertaId = aberta?.id;
  const [leituraLocal, setLeituraLocal] = useState<{ id: string; conta: string; sessao: SessaoLocal | null } | null>(null);
  const abertaLocal = leituraLocal?.id === abertaId && leituraLocal?.conta === userId ? leituraLocal.sessao : null;
  useEffect(() => {
    if (!abertaId) return;
    let ativa = true;
    void carregarSessaoLocal(abertaId).catch(() => null).then((sessao) => {
      if (ativa) setLeituraLocal({ id: abertaId, conta: userId, sessao: sessao?.userId === userId ? sessao : null });
    });
    return () => { ativa = false; };
  }, [abertaId, userId]);
  const idDoDia = aberta && aberta.data === hoje && aberta.workoutId === treinoId ? aberta.id : null;
  const confirmarMaterial = useCallback((id: string, tags: ReadonlySet<EquipamentoTag>, confirmada: SessaoLocal, anterior: SessaoLocal) => {
    setLeituraLocal((atual) => atual?.conta === userId && atual.sessao?.id === id
      ? { ...atual, sessao: atual.sessao === anterior ? confirmada : definirEquipamentoDaSessao(atual.sessao, tags) } : atual);
  }, [userId]);
  const materialLocal = useMaterialDaSessao(abertaLocal?.id === idDoDia ? abertaLocal : null, confirmarMaterial);
  const semCopia = idDoDia && leituraLocal?.id === idDoDia && leituraLocal.conta === userId && !abertaLocal;
  const linhaQ = useSessao(semCopia ? idDoDia : null);
  const remota = linhaQ.data?.id === idDoDia && linhaQ.data?.user_id === userId &&
    linhaQ.data.status === "em_andamento" ? linhaQ.data : null;
  const [edicaoRemota, setEdicaoRemota] = useState<{ id: string; conta: string; tags: ReadonlySet<EquipamentoTag> } | null>(null);
  const gravacaoRemota = useRef(Promise.resolve());
  const materialRemoto: MaterialDoTreino | undefined = remota && treinoId ? {
    disponiveis: edicaoRemota?.conta === userId && edicaoRemota.id === remota.id
      ? edicaoRemota.tags : equipamentoDaSessao(remota),
    aoMudar: (tags) => {
      const edicao = { id: remota.id, conta: userId, tags };
      setEdicaoRemota(edicao);
      const gravar = async () => {
        const chave = chaves.sessao(remota.id);
        const ultima = cliente.getQueryData<LinhaSessao | null>(chave);
        if (!ultima || ultima.user_id !== userId || ultima.status !== "em_andamento") return;
        const plano = { ...(ultima.plano ?? planoDaSessao(itensDoTreino(treinoId))), equipamento_disponivel: tagsDoEquipamento(tags) };
        await gravarPlanoDaSessao(remota.id, userId, plano);
        // Um GET iniciado antes do toque ainda pode ter o plano antigo.
        await Promise.all([chave, chaves.sessoesAbertas()].map((queryKey) => cliente.cancelQueries({ queryKey, exact: true })));
        cliente.setQueryData<LinhaSessao | null>(chave, (linha) => linha?.user_id === userId && linha.status === "em_andamento" ? { ...linha, plano } : linha);
        cliente.setQueryData<SessaoResumo[]>(chaves.sessoesAbertas(), (linhas) =>
          linhas?.map((linha) => linha.id === remota.id ? { ...linha, plano } : linha));
        await guardarConsultasAgora(cliente).catch(() => {
          toast.error("A mudança está na fila. Não foi possível atualizar a cópia para consulta sem rede.");
        });
      };
      gravacaoRemota.current = gravacaoRemota.current.then(gravar).catch(() => {
        toast.error("Não foi possível guardar o equipamento desta sessão. Tente novamente.");
      }).finally(() => setEdicaoRemota((atual) => atual === edicao ? null : atual));
    },
  } : undefined;
  const material = idDoDia ? materialLocal ?? materialRemoto : materialDoDia;
  const seriesDaAbertaQ = useSeriesDaSessao(aberta?.id ?? null);

  /*
   * SPEC §22.7 item 2: a aba tem 2.555 px e o caminho para o treino de hoje
   * ficava só no topo. A sentinela mora logo abaixo do card do dia; quando ela
   * passa para cima da tela, a faixa fixa assume o mesmo caminho.
   */
  const refSentinela = useRef<HTMLDivElement>(null);
  const [passouDoCard, setPassouDoCard] = useState(false);
  const desenhado = Boolean(hoje && perfil && dia && intervalo) && !desviando;
  useEffect(() => {
    const alvo = refSentinela.current;
    if (!alvo) return;
    const atualizar = () => setPassouDoCard(alvo.getBoundingClientRect().bottom <= 0);
    // Um salto até o fim pode levar a sentinela de baixo da tela para cima
    // sem jamais intersectá-la. O observador também cuida de mudanças de layout.
    const observador = typeof IntersectionObserver === "undefined"
      ? null : new IntersectionObserver(atualizar);
    observador?.observe(alvo);
    window.addEventListener("scroll", atualizar, { passive: true });
    atualizar();
    return () => {
      window.removeEventListener("scroll", atualizar);
      observador?.disconnect();
    };
  }, [desenhado]);

  /* SPEC §22.7 item 9: voltar do player avisa e destaca quem tem o "Continuar" */
  const destacarAberta = useAvisoDeVoltaDoPlayer(aberta !== null);

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
        <EsqueletoCapa />
        <EsqueletoLista linhas={3} />
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
          progresso: abertaLocal?.id === aberta.id
            ? progressoDaSessao(abertaLocal).texto
            : progressoDaAberta(aberta.workoutId, seriesDaAbertaQ.data ?? [], abertasQ.data?.find((s) => s.id === aberta.id)?.plano).texto,
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

  const comecarTreinoDeHoje = () => {
    if (!treinoId || pedirDecisao()) return;
    void comecar({
      userId, perfil, hoje, treinoId, lembradas, ordemTemporaria,
      equipamentosDisponiveis: materialDoDia?.disponiveis,
      trocas: soHoje ?? lerTrocasDoAparelho(userId, hoje, treinoId),
    });
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
      await descartarSessao({ id, userId, cliente });
      // Descartar um treino de ontem não consome a escolha feita para o de hoje.
      if (treinoId && aberta?.id === id && aberta.data === hoje && aberta.workoutId === treinoId) {
        limparTrocasDoAparelho(userId, treinoId);
        setRascunho(null);
      }
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
        /*
         * SPEC §18.3: com a pausa por decidir, ajustar não vem antes de
         * decidir — o "Ajustar" sai da tela, como saía quando era um FAB.
         */
        acoes={mostrarRetomada ? null : <BotaoAjustar perfil={perfil} material={material} />}
      />

      {aberta && !abertaDoDia ? (
        <BannerSessaoAberta
          texto={aberta.texto}
          href={`/treinar/${aberta.id}`}
          aoDescartar={() => void descartar(aberta.id)}
          /*
           * SPEC §22.7 item 9: o anel acompanha o "Continuar". Aqui dentro a
           * sessão aberta nunca é a do dia (`!abertaDoDia`), então o card do
           * dia não tem "Continuar" nenhum e o destaque é deste banner.
           */
          destacado={destacarAberta}
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
            /* só quando é ESTE card que tem o "Continuar" (§22.7 item 9) */
            destacado={destacarAberta && abertaDoDia !== null}
            criando={criando !== null}
            aoComecar={comecarTreinoDeHoje}
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
      <div ref={refSentinela} aria-hidden="true" className="h-px" />

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
              material={material}
              itens={itens}
              carregando={estadosQ.isPending && ids.length > 0}
              mostrarRaios={mostrarRaios}
              prefs={perfil?.prefs}
              aoSubstituir={trocar}
              recorrencia={{
                treinoId,
                lembradas: lembradas.data ?? {},
                aoLembrar: (original, destino) => salvarTrocaDoPrograma(cliente, userId, treinoId, original, destino),
              }}
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

      <Personalizar key={perfil.user_id} prefs={perfil.prefs} />

      {/*
        SPEC §22.7 item 2: a faixa fixa do dia. Só nos dias de força — nos dias
        de cardio e de descanso a aba cabe em pouco mais de uma tela e o card
        do dia continua à vista.
      */}
      {passouDoCard && dia.tipo === "forca" && treinoId ? (
        <FaixaFixaDoDia
          titulo={resumoDoTreino(treinoId).nome}
          detalhe={abertaDoDia ? abertaDoDia.progresso : detalheDoTreino(treinoId)}
          rotulo={abertaDoDia ? "Continuar" : "Começar"}
          href={abertaDoDia ? `/treinar/${abertaDoDia.id}` : undefined}
          aoTocar={comecarTreinoDeHoje}
        />
      ) : null}
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  /* o "Ajustar" subiu para o cabeçalho (§22.7 item 1): a folga do FAB saiu */
  return (
    <section aria-label="Treino" className="flex flex-col gap-4">
      {children}
    </section>
  );
}
