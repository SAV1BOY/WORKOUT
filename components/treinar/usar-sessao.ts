"use client";

import { liveQuery } from "dexie";
import { useQueryClient } from "@tanstack/react-query";
import { salvarTrocaDoPrograma, useTrocasDoPrograma } from "@/lib/queries/trocas-do-programa";
import type { RecorrenciaDaTroca } from "@/components/exercicio/seletor-alternativa";
import { useMaterialDaSessao } from "@/components/treinar/usar-material-da-sessao";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  EXERCICIO_DA_SESSAO,
  WORKOUT_BARRA_FIXA,
  itemDaSessao,
  prescricaoDaSemana,
} from "@/lib/barra-fixa";
import { idsDaSessaoRemota, sessaoLocalComExercicioDesconhecido, sessaoLocalRepresentaServidor } from "@/lib/compatibilidade-da-sessao";
import { confirmarIdsDaSessaoProtegida, lerIdsDaSessaoProtegida, lerRevisaoDaProtecao, liberarSessaoProtegida } from "@/lib/queries/compatibilidade-da-sessao";
import { acharTreino, exercicioPorId } from "@/lib/dados";
import { equipamentoDaSessao } from "@/lib/equipamento-da-sessao";
import { decidirTela, servidorTerminouDeBuscar } from "@/lib/estado-do-player";
import { ehSessaoLivre, itensDoPlano, tituloDoPlano } from "@/lib/livre";
import {
  estadosPorExercicio,
  textoDoEvento,
  ultimoEventoPorExercicio,
} from "@/lib/hoje";
import { anterioresPorExercicio, type EstadoPlayer, type SerieDeOutroDia } from "@/lib/player";
import { descansoPadraoS, opcoesDeMontagem } from "@/lib/preferencias";
import {
  chaves,
  type SessaoResumo,
  useEstados,
  useEventos,
  usePerfil,
  useRecordes,
  useSeriesAnteriores,
  useSeriesDaSessao,
  useSessao,
  useUltimasSeries,
} from "@/lib/queries/dados";
import {
  acrescentarExercicioNaSessao,
  carregarSessaoLocal,
  comOrdemConfirmada,
  conciliarBlocosAcrescentados,
  conciliarMarcacaoConfirmada,
  confirmarMarcacaoDaSerie,
  confirmarToquesPendentes,
  descarregarSessao,
  desfazerUltimaInclusaoNaSessao,
  enviarPlanoDaTroca,
  finalizarSessao,
  guardarCronometroDaSessao,
  guardarDescansoDaSessao,
  guardarNotaGeralDaSessao,
  guardarProximoExercicio,
  mesmaVersaoDaOrdem,
  mesmoRelogio,
  MENSAGEM_CRONOMETRO_ALTERADO,
  MENSAGEM_EQUIPAMENTO_ALTERADO,
  MENSAGEM_INCLUSAO_ALTERADA,
  MENSAGEM_NOTA_GERAL_ALTERADA,
  salvarSessaoLocal,
  sincronizarNotaGeralDaSessao,
  usePendentes,
} from "@/lib/queries/sessao";
import {
  atualizarSerie,
  avaliarSessao,
  definirFirme,
  definirNota,
  definirDescansoDoExercicioNaSessao,
  definirEquipamentoDaSessao,
  ehTreinoDoPrograma,
  idsComSubstitutos,
  idsQueComparamComAnterior,
  progressoDaSessao,
  reconstruirSessao,
  seriesAnterioresPorExercicio,
  substituirExercicio,
  type BlocoLocal,
  type RecordeAntes,
  type ResultadoExercicio,
  type SerieLocal,
  type SessaoLocal,
} from "@/lib/sessao";
import type { LinhaSerie, LinhaSessao, Prefs } from "@/lib/types";
import { useTelaAcesa } from "@/lib/wake-lock";

export type FimDaSessao = "concluida" | "abandonada";

/**
 * Tudo que a sessão de força precisa para viver na tela (SPEC §3.2 e §8):
 * carregar do aparelho (ou refazer do banco), gravar cada toque no IndexedDB,
 * mandar para a fila de saída e, no fim, rodar o motor.
 *
 * O player (SPEC §14.1) e a visão geral são duas telas da **mesma** sessão:
 * quem chama este hook é o player, que passa o que a visão geral precisa.
 * Assim não há duas cópias do estado nem duas gravações concorrentes.
 */
export function useSessaoDeTreino(sessaoId: string, userId: string) {
  useEffect(() => () => {
    if (window.location.pathname !== "/") return;
    try {
      window.sessionStorage.setItem("treino:saiu-para", `/treinar/${sessaoId}`);
    } catch {
      // O aviso de volta é opcional em navegadores sem armazenamento.
    }
  }, [sessaoId]);
  const router = useRouter();
  const cliente = useQueryClient();
  const [sessaoLida, setSessaoLida] = useState<SessaoLocal | null | undefined>(undefined);
  /**
   * A última sessão, fora do ciclo de renderização.
   *
   * O player faz **duas** mudanças no mesmo toque (marcar a série e andar para
   * o próximo passo). Lendo `sessao` do fecho da renderização, a segunda
   * partia do estado de antes da primeira e apagava o registro que acabara de
   * entrar — exatamente o que a SPEC §8 proíbe. Com a referência, toda mudança
   * parte do valor mais novo, mesmo duas vezes no mesmo tique.
   */
  const ultima = useRef<SessaoLocal | null | undefined>(undefined);

  /** Guarda a sessão nos dois lugares (referência + estado da tela). */
  const bloqueada = useRef(false);
  const adotar = useCallback((nova: SessaoLocal | null) => {
    if (bloqueada.current) return;
    ultima.current = nova;
    setSessaoLida(nova);
  }, []);
  /**
   * SPEC §22.11: a remontagem a partir do banco já foi tentada e não deu
   * sessão. Sem isto a tela não tem como distinguir "ainda vem" de "não há" —
   * e era afirmando "não achei" cedo demais que ela assustava quem tinha o
   * treino gravado.
   */
  const [montagemFalhou, setMontagemFalhou] = useState(false);
  const [falhouLeituraDoAparelho, setFalhouLeituraDoAparelho] = useState(false);
  const [leituraDoAparelho, relerAparelho] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [encerradaAqui, setEncerradaAqui] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const naFila = usePendentes();

  const perfilQ = usePerfil();
  const perfil = perfilQ.data?.user_id === userId ? perfilQ.data : null;
  const perfilPrefs = perfil?.prefs;
  const descansoDaConta = perfil ? descansoPadraoS(perfilPrefs) : undefined;
  // identidade estável: `prefs` entra nas dependências de efeitos (§3.9)
  const prefs: Prefs = useMemo(() => perfilPrefs ?? {}, [perfilPrefs]);
  // Em um aparelho novo as leituras do banco podem começar junto com o Dexie.
  // A sessão local, quando existe, continua tendo precedência sobre o servidor.
  const sessaoQ = useSessao(sessaoId, userId);
  const linhaDaConta = sessaoQ.data?.id === sessaoId && sessaoQ.data.user_id === userId ? sessaoQ.data : null;
  const resumoSalvo = cliente.getQueryData<SessaoResumo[]>(chaves.sessoes())?.find(s => s.id === sessaoId && s.user_id === userId);
  const encerradaAntes = encerradaAqui !== sessaoId && [resumoSalvo, linhaDaConta].some(
    (linha) => linha && (linha.status !== "em_andamento" || linha.concluida_em != null),
  );
  const seriesQ = useSeriesDaSessao(sessaoId, userId);
  const seriesDaConta = useMemo(() => seriesQ.data?.filter(s => s.user_id === userId && s.session_id === sessaoId),
    [seriesQ.data, userId, sessaoId]);
  const planoParaConferir = linhaDaConta ? linhaDaConta.plano : resumoSalvo?.plano;
  const idsReferenciados = useMemo(() => idsDaSessaoRemota(planoParaConferir, seriesDaConta, userId, sessaoId),
    [planoParaConferir, seriesDaConta, userId, sessaoId]);
  const idsRemotos = useMemo(() => idsReferenciados.filter(id => !exercicioPorId.has(id)), [idsReferenciados]);
  const localIncompativel = useMemo(() => sessaoLocalComExercicioDesconhecido(sessaoLida), [sessaoLida]);
  const [idsGuardados, setIdsGuardados] = useState<string[]>([]);
  const protegida = localIncompativel || idsRemotos.length > 0 || idsGuardados.length > 0;
  const edicaoBloqueada = protegida || falhouLeituraDoAparelho;
  const sessao = edicaoBloqueada ? null : sessaoLida;
  // Uma resposta do servidor pode chegar depois de o player já ter aberto a cópia do aparelho.
  useLayoutEffect(() => {
    bloqueada.current = edicaoBloqueada;
    ultima.current = sessao;
  }, [edicaoBloqueada, sessao]);

  // A confirmação antecede o aviso para que uma recarga offline imediata volte a proteger o treino.
  useEffect(() => {
    if (encerradaAntes || !idsRemotos.some(id => !idsGuardados.includes(id))) return;
    let vivo = true;
    void confirmarIdsDaSessaoProtegida(userId, sessaoId, idsRemotos)
      .catch(() => idsRemotos)
      .then(ids => { if (vivo) setIdsGuardados(ids); });
    return () => { vivo = false; };
  }, [encerradaAntes, idsGuardados, idsRemotos, sessaoId, userId]);

  // Outra aba pode descobrir o exercício depois de esta já ter retomado o snapshot.
  useEffect(() => {
    const assinatura = liveQuery(() => lerIdsDaSessaoProtegida(userId, sessaoId)).subscribe({
      next: ids => setIdsGuardados(atuais => ids.length === atuais.length && ids.every(id => atuais.includes(id)) ? atuais : ids),
      error: () => setFalhouLeituraDoAparelho(true),
    });
    return () => assinatura.unsubscribe();
  }, [leituraDoAparelho, sessaoId, userId]);

  const refazerLinha = sessaoQ.refetch;
  const refazerSeries = seriesQ.refetch;
  const liberarSeConferido = useCallback(async (revisao: string, linha: LinhaSessao | null | undefined, series: LinhaSerie[] | undefined) => {
    if (!idsGuardados.length || localIncompativel || sessaoLida === undefined ||
        !linha || linha.id !== sessaoId || linha.user_id !== userId || !Object.hasOwn(linha, "plano") ||
        !Array.isArray(series) || series.some(s => s.user_id !== userId || s.session_id !== sessaoId)) return;
    if (idsDaSessaoRemota(linha.plano, series, userId, sessaoId).some(id => !exercicioPorId.has(id))) return;
    if (sessaoLida && !sessaoLocalRepresentaServidor(sessaoLida, linha, series)) return;
    await liberarSessaoProtegida(userId, sessaoId, revisao);
  }, [idsGuardados, localIncompativel, sessaoLida, sessaoId, userId]);

  useEffect(() => {
    if (!idsGuardados.length || !idsGuardados.every(id => idsReferenciados.includes(id) && exercicioPorId.has(id))) return;
    // A revisão é lida antes de consultar as duas cópias. Outra confirmação invalida a liberação.
    let vivo = true;
    void lerRevisaoDaProtecao(userId, sessaoId).then(revisao => {
      if (!vivo || !revisao) return;
      const linha = cliente.getQueryData<LinhaSessao>(chaves.sessao(sessaoId));
      const series = cliente.getQueryData<LinhaSerie[]>(chaves.series(sessaoId));
      const idsDaCopia = idsDaSessaoRemota(linha?.plano, series, userId, sessaoId);
      if (idsGuardados.every(id => idsDaCopia.includes(id))) return liberarSeConferido(revisao, linha, series);
    }).catch(() => {});
    return () => { vivo = false; };
  }, [cliente, idsGuardados, idsReferenciados, liberarSeConferido, sessaoId, userId]);

  const fontesDisponiveis = sessaoQ.data !== undefined && seriesQ.data !== undefined;
  useEffect(() => {
    if (!idsGuardados.length || !fontesDisponiveis || sessaoLida === undefined || localIncompativel) return;
    let vivo = true;
    async function reler() {
      if (!navigator.onLine) return;
      const revisao = await lerRevisaoDaProtecao(userId, sessaoId);
      if (!vivo || !revisao) return;
      // Inicia as duas leituras depois desta revisão. O cache pode ser anterior à última confirmação noutra aba.
      const [linha, series] = await Promise.all([refazerLinha(), refazerSeries()]);
      if (vivo && linha.isSuccess && series.isSuccess) await liberarSeConferido(revisao, linha.data, series.data);
    }
    const aoReconectar = () => { void reler().catch(() => {}); };
    aoReconectar();
    window.addEventListener("online", aoReconectar);
    return () => { vivo = false; window.removeEventListener("online", aoReconectar); };
  }, [fontesDisponiveis, idsGuardados, liberarSeConferido, localIncompativel, refazerLinha, refazerSeries, sessaoLida, sessaoId, userId]);

  /*
   * A sessão de barra fixa (SPEC §3.4) não é um treino do `programa.json`:
   * os exercícios dela vêm do plano da semana (`profiles.semana_fixa`), e é
   * essa lista que refaz a sessão quando ela não está neste aparelho.
   */
  const workoutId = linhaDaConta?.workout_id ?? null;
  const ehFixa = workoutId === WORKOUT_BARRA_FIXA;
  const semanaFixa =
    sessao?.semanaPlano ?? linhaDaConta?.semana_plano ?? perfil?.semana_fixa ?? 1;
  /*
   * A sessão livre (SPEC §13.4) e a sessão do programa que foi **reordenada**
   * (§14.3) não dão para refazer a partir do `programa.json`: a lista está em
   * `sessions.plano`, e é ela que manda quando existe.
   */
  const planoDaLinha = sessao?.plano ?? linhaDaConta?.plano ?? null;
  const itensDoPlanoDaLinha = useMemo(
    () => protegida ? undefined : itensDoPlano(planoDaLinha) ?? undefined,
    [protegida, planoDaLinha],
  );
  const itensDaFixa = useMemo(
    () => (ehFixa ? [itemDaSessao(semanaFixa)] : itensDoPlanoDaLinha),
    [ehFixa, semanaFixa, itensDoPlanoDaLinha],
  );
  const treinoId = workoutId && ehTreinoDoPrograma(workoutId) ? workoutId : null;
  const idsDoTreino = useMemo(
    () =>
      itensDoPlanoDaLinha
        ? itensDoPlanoDaLinha.map((i) => i.exercicioId)
        : treinoId
          ? acharTreino(treinoId).exercicios.map((e) => e.exercicio_id)
          : ehFixa
            ? [EXERCICIO_DA_SESSAO]
            : [],
    [treinoId, ehFixa, itensDoPlanoDaLinha],
  );

  /*
   * SPEC §6.3: "o substituto usa o próprio estado". A troca pode acontecer a
   * qualquer momento (inclusive sem rede), então o estado, as séries
   * anteriores e os recordes de **todos os substitutos possíveis** são
   * carregados junto com os do treino.
   */
  const idsDosBlocos = useMemo(
    () =>
      protegida ? "" : sessao
        ? Array.from(
            new Set(sessao.blocos.flatMap((b) => [b.originalId, b.exercicioId])),
          )
            .sort()
            .join(",")
        : [...new Set([
            ...idsDoTreino,
            ...(seriesDaConta ?? []).map((s) => s.exercise_id),
            ...Object.values(planoDaLinha?.trocas ?? {}).flatMap((grupo) =>
              Array.isArray(grupo) ? grupo.map((e) => e?.exercicio_id) : []
            ),
          ])].filter((id) => exercicioPorId.has(id)).sort().join(","),
    [protegida, sessao, idsDoTreino, seriesDaConta, planoDaLinha],
  );
  const ids = useMemo(
    () => (idsDosBlocos ? idsComSubstitutos(idsDosBlocos.split(",")) : []),
    [idsDosBlocos],
  );
  const idsComparados = useMemo(() => idsQueComparamComAnterior(ids), [ids]);

  const estadosQ = useEstados(ids);
  const anterioresQ = useSeriesAnteriores(idsComparados);
  const recordesQ = useRecordes(ids);

  const idsNaTela = useMemo(
    () => sessao?.blocos.map((b) => b.exercicioId) ?? [],
    [sessao],
  );
  const eventosQ = useEventos(idsNaTela);
  const ultimasQ = useUltimasSeries(userId, idsNaTela, sessaoId);

  /** "anterior: 9,5 kg × 5" por exercício (SPEC §14.1.2). */
  const anteriores: Record<string, SerieDeOutroDia[]> = useMemo(
    () => anterioresPorExercicio(ultimasQ.data ?? [], sessaoId),
    [ultimasQ.data, sessaoId],
  );

  /** O que o motor precisa saber — ou `null` se não deu para ler. */
  const dadosDoMotor = useMemo(() => {
    if (!estadosQ.data || !recordesQ.data) return null;
    if (idsComparados.length > 0 && !anterioresQ.data) return null;
    const recordes: Record<string, RecordeAntes> = {};
    for (const r of recordesQ.data) recordes[r.exercise_id] = r;
    return {
      estados: estadosPorExercicio(estadosQ.data),
      // as séries desta sessão não são "as anteriores" dela mesma (§6.3)
      anteriores: seriesAnterioresPorExercicio(anterioresQ.data ?? [], sessaoId),
      recordes,
    };
  }, [estadosQ.data, anterioresQ.data, recordesQ.data, idsComparados, sessaoId]);

  useTelaAcesa(prefs.manter_tela !== false && sessao != null);

  /* ------------------------------------------------- carregar do aparelho */

  useEffect(() => {
    let vivo = true;
    void Promise.all([carregarSessaoLocal(sessaoId), lerIdsDaSessaoProtegida(userId, sessaoId)]).then(([s, ids]) => {
      if (!vivo) return;
      setMontagemFalhou(false);
      if (ids.length) setIdsGuardados(atuais => [...new Set([...atuais, ...ids])]);
      setSessaoLida(s?.id === sessaoId && s.userId === userId ? s : null);
      setFalhouLeituraDoAparelho(false);
    }).catch(() => {
      if (vivo) setFalhouLeituraDoAparelho(true);
    });
    return () => {
      vivo = false;
      // Um Pular/Corrigir que aguardava o disco já não pode mover o player que foi fechado.
      ultima.current = undefined;
    };
  }, [leituraDoAparelho, sessaoId, userId]);

  // a sessão não está neste aparelho: refaz do que o banco tem (SPEC §8)
  useEffect(() => {
    if (encerradaAntes) {
      router.replace("/relatorio#historico");
      return;
    }
    if (edicaoBloqueada || sessao !== null) return;
    const linha = linhaDaConta;
    if (!linha) return;
    if (seriesQ.isPending) return;
    if (seriesQ.isError) {
      setMontagemFalhou(true);
      return;
    }
    if (!dadosDoMotor) {
      /*
       * Sem `ids` as consultas do motor nem são feitas, e `dadosDoMotor` fica
       * `null` para sempre: não há o que montar, e a tela pode dizer isso em
       * vez de ficar num esqueleto eterno (SPEC §22.11).
       */
      if (ids.length === 0) setMontagemFalhou(true);
      return;
    }
    const refeita = reconstruirSessao(linha, seriesDaConta ?? [], {
      ...dadosDoMotor,
      itens: itensDaFixa,
      // as barras já pesadas na balança mudam a escala (SPEC §3.9)
      opcoesMontagem: opcoesDeMontagem(prefs),
    });
    if (refeita) {
      salvarSessaoLocal(refeita);
      adotar(refeita);
    } else {
      // tentamos e não deu: agora "não achei este treino" é verdade
      setMontagemFalhou(true);
    }
  }, [edicaoBloqueada, sessao, linhaDaConta, seriesDaConta, seriesQ.isPending, seriesQ.isError, dadosDoMotor, ids, itensDaFixa, prefs, adotar, router, encerradaAntes]);

  /* --------------------------------------------- relógio e saída da aba */

  const idNoAparelho = sessao?.id;
  useEffect(() => {
    if (!idNoAparelho) return;
    const relogio = setInterval(() => setAgora(Date.now()), 1_000);
    const aoSair = () => void descarregarSessao();
    window.addEventListener("pagehide", aoSair);
    document.addEventListener("visibilitychange", aoSair);
    return () => {
      clearInterval(relogio);
      window.removeEventListener("pagehide", aoSair);
      document.removeEventListener("visibilitychange", aoSair);
      void descarregarSessao();
    };
  }, [idNoAparelho]);

  /**
   * Toda mudança grava no aparelho na hora (SPEC §8). O novo estado é
   * calculado FORA do `setState` de propósito: a fila de saída e o timer são
   * efeitos, e um updater do React pode ser chamado duas vezes.
   */
  const mexer = useCallback(
    (fn: (atual: SessaoLocal) => SessaoLocal): SessaoLocal | null => {
      const atual = ultima.current;
      if (!atual) return null;
      const nova = fn(atual);
      adotar(nova);
      salvarSessaoLocal(nova, atual);
      return nova;
    },
    [adotar],
  );

  // O cache de consultas pode estar pendente na recarga sem rede. O padrão que a
  // conta realmente usou acompanha a cópia local da sessão, inclusive o valor nulo.
  useEffect(() => {
    const atual = ultima.current;
    if (descansoDaConta === undefined || atual?.id !== sessaoId || atual.userId !== userId
      || atual.status !== "em_andamento" || atual.descansoPadraoConhecidoS === descansoDaConta) return;
    mexer(maisRecente => ({ ...maisRecente, descansoPadraoConhecidoS: descansoDaConta }));
    void descarregarSessao();
  }, [descansoDaConta, idNoAparelho, mexer, sessaoId, userId]);

  // A conta pode ter editado esta sessão em outro aparelho desde a última abertura.
  useEffect(() => {
    let consulta: AbortController | undefined;
    function atualizarNota() {
      const antes = ultima.current;
      if (!navigator.onLine || antes?.id !== sessaoId || antes.userId !== userId || antes.status !== "em_andamento") return;
      consulta?.abort();
      consulta = new AbortController();
      const { signal } = consulta;
      void sincronizarNotaGeralDaSessao(antes, signal).then(salva => {
        const atual = ultima.current;
        if (signal.aborted || !salva || atual?.id !== sessaoId || atual.userId !== userId ||
            atual.status !== "em_andamento") return;
        let nova = atual;
        if (mesmaVersaoDaOrdem(atual, antes)) nova = comOrdemConfirmada(atual, salva);
        if (atual.notaGeral === antes.notaGeral && atual.revisaoNotaGeral === antes.revisaoNotaGeral &&
            (atual.notaGeral !== salva.notaGeral || atual.revisaoNotaGeral !== salva.revisaoNotaGeral)) {
          nova = { ...nova, notaGeral: salva.notaGeral, revisaoNotaGeral: salva.revisaoNotaGeral };
        }
        if (nova !== atual) adotar(nova);
      }).catch(() => {
        // Uma consulta sem rede ou sem espaço mantém a nota já disponível neste aparelho.
      });
    }
    atualizarNota();
    window.addEventListener("online", atualizarNota);
    return () => {
      consulta?.abort();
      window.removeEventListener("online", atualizarNota);
    };
  }, [adotar, idNoAparelho, sessaoId, userId]);

  /**
   * Marcar uma série: grava no aparelho, manda para a fila e devolve o bloco e
   * a série que mudaram (quem chamou decide o que fazer com o descanso).
   */
  const marcacoesEmGravacao = useRef(new Map<string, ReturnType<typeof confirmarMarcacaoDaSerie>>());
  const marcar = useCallback(
    async (
      ordem: number,
      serieId: string,
      concluida: boolean,
    ): Promise<{ sessao: SessaoLocal; bloco: BlocoLocal; serie: SerieLocal; aplicada: boolean } | null> => {
      const antes = ultima.current;
      if (!antes || antes.id !== sessaoId || antes.userId !== userId || marcacoesEmGravacao.current.has(serieId)) return null;
      const gravacao = confirmarMarcacaoDaSerie(antes, ordem, serieId, concluida);
      marcacoesEmGravacao.current.set(serieId, gravacao);
      try {
        const confirmada = await gravacao;
        const salva = confirmada?.sessao ?? await carregarSessaoLocal(sessaoId);
        const atual = ultima.current;
        if (atual?.id !== sessaoId || atual.userId !== userId) return null;
        if (salva?.userId === userId && salva.status === "em_andamento") {
          const nova = conciliarMarcacaoConfirmada(antes, atual, salva, ordem);
          adotar(nova);
          if (confirmada) {
            const sessao = confirmada.aplicada ? nova : confirmada.sessao;
            const bloco = sessao.blocos.find(b => b.ordem === ordem);
            const serie = bloco?.series.find(s => s.id === serieId);
            return bloco && serie ? { sessao, bloco, serie, aplicada: confirmada.aplicada } : null;
          }
        } else {
          router.replace("/relatorio#historico");
        }
        toast.error("O treino mudou. A série não foi registrada.");
      } catch {
        const atual = ultima.current;
        if (atual?.id !== sessaoId || atual.userId !== userId) return null;
        toast.error("Não foi possível confirmar a série neste aparelho. Tente de novo.");
      } finally {
        marcacoesEmGravacao.current.delete(serieId);
      }
      return null;
    },
    [adotar, router, sessaoId, userId],
  );

  const mudarSerie = useCallback(
    (ordem: number, serieId: string, campos: Partial<SerieLocal>) => {
      const nova = mexer(atual => atualizarSerie(atual, ordem, serieId, campos));
      if (nova && campos.medicaoCronometro) return confirmarToquesPendentes(nova);
    },
    [mexer],
  );

  const mudarFirme = useCallback(
    (ordem: number, firme: boolean) =>
      mexer((atual) => definirFirme(atual, ordem, firme)),
    [mexer],
  );

  const mudarNota = useCallback(
    (ordem: number, nota: string) => mexer((atual) => definirNota(atual, ordem, nota)),
    [mexer],
  );

  const notaEmGravacao = useRef<Promise<void> | null>(null);
  const guardarNotaGeral = useCallback(async (texto: string, notaAoAbrir: string | null) => {
    const antes = ultima.current;
    if (antes?.id !== sessaoId || antes.userId !== userId || antes.status !== "em_andamento" ||
        notaEmGravacao.current || encerradaAntes || encerradaAqui === sessaoId) {
      throw new Error("Este treino já não está disponível para editar a nota.");
    }
    if ((antes.notaGeral ?? null) !== notaAoAbrir) throw new Error(MENSAGEM_NOTA_GERAL_ALTERADA);
    function adotarNota(salva: SessaoLocal) {
      const atual = ultima.current;
      if (atual?.id !== sessaoId || atual.userId !== userId || atual.status !== "em_andamento") return;
      adotar({ ...atual, notaGeral: salva.notaGeral, revisaoNotaGeral: salva.revisaoNotaGeral });
    }
    const gravacao = guardarNotaGeralDaSessao(antes, texto).then(adotarNota, async (falha: unknown) => {
      // O editor conserva o rascunho; ao cancelá-lo, passa a oferecer a nota que a outra aba gravou.
      if (falha instanceof Error && falha.message === MENSAGEM_NOTA_GERAL_ALTERADA) {
        const salva = await carregarSessaoLocal(sessaoId);
        if (salva?.userId === userId && salva.status === "em_andamento") adotarNota(salva);
      }
      throw falha;
    });
    notaEmGravacao.current = gravacao;
    try {
      await gravacao;
    } finally {
      notaEmGravacao.current = null;
    }
  }, [adotar, sessaoId, userId, encerradaAntes, encerradaAqui]);

  // Cada toque parte do prazo que o toque anterior conseguiu gravar neste aparelho.
  const filaDoCronometro = useRef<Promise<void> | null>(null);
  const [ajustandoCronometro, setAjustandoCronometro] = useState(false);
  const ajustarCronometro = useCallback((chave: string, aplicar: (base: EstadoPlayer) => EstadoPlayer) => {
    async function gravar() {
      const antes = ultima.current;
      const base = antes?.player;
      if (!antes || antes.id !== sessaoId || antes.userId !== userId || antes.status !== "em_andamento"
        || !base || base.chave !== chave) throw new Error(MENSAGEM_CRONOMETRO_ALTERADO);
      const novo = aplicar(base);
      const salva = await guardarCronometroDaSessao(antes, novo);
      const atual = ultima.current;
      if (atual?.id !== sessaoId || atual.userId !== userId || atual.status !== "em_andamento"
        || !mesmoRelogio(atual.player, base)) return null;
      adotar(atual === antes ? salva : { ...atual, player: novo });
      return { base, novo };
    }
    setAjustandoCronometro(true);
    const resultado = (filaDoCronometro.current ?? Promise.resolve()).then(gravar);
    // A falha é devolvida ao botão; um novo toque ainda pode tentar a partir da base confirmada.
    const fim = resultado.then(() => {}, () => {});
    filaDoCronometro.current = fim;
    void fim.then(() => {
      if (filaDoCronometro.current === fim) {
        filaDoCronometro.current = null;
        setAjustandoCronometro(false);
      }
    });
    return resultado;
  }, [adotar, sessaoId, userId]);

  const aposAjustarCronometro = useCallback((chave: string, acao: (confirmado: EstadoPlayer) => void) => {
    const seguir = () => {
      const atual = ultima.current;
      if (atual?.id === sessaoId && atual.userId === userId && atual.status === "em_andamento"
        && atual.player?.chave === chave) acao(atual.player);
    };
    if (filaDoCronometro.current) void filaDoCronometro.current.then(seguir);
    else seguir();
  }, [sessaoId, userId]);

  const descansoEmGravacao = useRef<Promise<SessaoLocal> | null>(null);
  const mudarDescanso = useCallback(async (exercicioId: string, segundos: number | null, player?: EstadoPlayer) => {
    if (filaDoCronometro.current) await filaDoCronometro.current;
    const antes = ultima.current;
    if (antes?.id !== sessaoId || antes.userId !== userId || antes.status !== "em_andamento" || descansoEmGravacao.current) {
      throw new Error("Não foi possível guardar o descanso nesta sessão.");
    }
    const gravacao = guardarDescansoDaSessao(antes, exercicioId, segundos, player);
    descansoEmGravacao.current = gravacao;
    try {
      const confirmada = await gravacao;
      const atual = ultima.current;
      if (atual?.id !== sessaoId || atual.userId !== userId || atual.status !== "em_andamento") return null;
      const relogioConfirmado = player && antes.player && mesmoRelogio(atual.player, antes.player)
        ? { base: antes.player, novo: player } : null;
      if (atual === antes) {
        adotar(confirmada);
      } else {
        // Uma série ou passo pode ter mudado enquanto o IndexedDB confirmava a edição.
        const comDescanso = definirDescansoDoExercicioNaSessao(atual, exercicioId, segundos);
        adotar(relogioConfirmado ? { ...comDescanso, player: relogioConfirmado.novo } : comDescanso);
      }
      return relogioConfirmado;
    } finally {
      descansoEmGravacao.current = null;
    }
  }, [adotar, sessaoId, userId]);

  const substituir = useCallback(
    async (bloco: BlocoLocal, novoExercicioId: string): Promise<boolean> => {
      const antes = ultima.current;
      if (antes?.id !== sessaoId || antes.userId !== userId || antes.status !== "em_andamento" ||
          antes.blocos.some((outro) => outro.ordem !== bloco.ordem && outro.exercicioId === novoExercicioId)) return false;
      const nova = mexer((atual) =>
        substituirExercicio(
          atual,
          bloco.ordem,
          novoExercicioId,
          dadosDoMotor?.estados[novoExercicioId] ?? null,
          {
            anteriores: dadosDoMotor?.anteriores[novoExercicioId] ?? null,
            recorde: dadosDoMotor?.recordes[novoExercicioId],
            // sem a leitura, o bloco fica sem avaliação (§6.3)
            estadoConhecido: dadosDoMotor !== null,
            novoId: () => crypto.randomUUID(),
          },
        ),
      );
      if (!nova || nova === antes) return false;
      const pretendido = nova.blocos.find(b => b.ordem === bloco.ordem);
      if (pretendido?.exercicioId !== novoExercicioId) return false;
      try {
        const salva = await enviarPlanoDaTroca(nova);
        const atual = ultima.current;
        if (atual?.id !== sessaoId || atual.userId !== userId || atual.status !== "em_andamento" ||
            atual.blocos.find(b => b.ordem === bloco.ordem) !== pretendido) return false;
        if (salva?.id !== sessaoId || salva.userId !== userId || salva.status !== "em_andamento") return false;
        const confirmado = salva.blocos.find(b => b.ordem === bloco.ordem);
        if (confirmado?.exercicioId === novoExercicioId) return true;
        if (atual === nova) {
          adotar(salva);
        } else if (confirmado) {
          // Uma edição posterior em outro bloco ou no relógio continua na tela.
          adotar({ ...atual, blocos: atual.blocos.map(b => b === pretendido ? confirmado : b) });
        } else {
          adotar(conciliarBlocosAcrescentados(atual, salva));
        }
        toast.error("Outra aba atualizou este exercício. Confira o que foi registrado antes de trocar.");
      } catch {
        const atual = ultima.current;
        if (atual?.id === sessaoId && atual.userId === userId &&
            atual.blocos.find(b => b.ordem === bloco.ordem) === pretendido) {
          toast.error("Não foi possível confirmar a troca neste aparelho. Confira o treino antes de continuar.");
        }
      }
      return false;
    },
    [adotar, mexer, dadosDoMotor, sessaoId, userId],
  );

  /* ------------------------------------------------------------- fim */

  const material = useMaterialDaSessao(sessao, (id, tags, confirmada, anterior) => {
    const atual = ultima.current;
    if (atual?.id === id) adotar(atual === anterior ? confirmada : definirEquipamentoDaSessao(atual, tags));
  });
  const aguardarMaterial = material?.aguardar;

  const inclusaoEmGravacao = useRef<Promise<void> | null>(null);
  const alterarInclusao = useCallback(async (alterar: (base: SessaoLocal) => Promise<SessaoLocal>) => {
    if (inclusaoEmGravacao.current) throw new Error("Aguarde a alteração do exercício.");
    async function gravar() {
      await aguardarMaterial?.();
      await notaEmGravacao.current?.catch(() => {});
      await filaDoCronometro.current;
      await descansoEmGravacao.current?.catch(() => {});
      const antes = ultima.current;
      if (antes?.id !== sessaoId || antes.userId !== userId || antes.status !== "em_andamento"
        || !ehSessaoLivre(antes.workoutId) || encerradaAntes || encerradaAqui === sessaoId) {
        throw new Error("Este treino já não está aberto para alterar os exercícios.");
      }
      function mostrarConfirmada(salva: SessaoLocal, atualizarMaterial = false) {
        const atual = ultima.current;
        if (atual?.id !== sessaoId || atual.userId !== userId || atual.status !== "em_andamento"
          || salva.id !== sessaoId || salva.userId !== userId || salva.status !== "em_andamento") return;
        // Outra série ou o relógio podem avançar enquanto o banco local confirma a inclusão.
        const conciliada = atual === antes ? salva : conciliarBlocosAcrescentados(atual, salva);
        adotar(atualizarMaterial && conciliada !== salva
          ? definirEquipamentoDaSessao(conciliada, equipamentoDaSessao(salva)) : conciliada);
      }
      try {
        mostrarConfirmada(await alterar(antes));
      } catch (falha) {
        const materialAlterado = falha instanceof Error && falha.message === MENSAGEM_EQUIPAMENTO_ALTERADO;
        if (materialAlterado || (falha instanceof Error && falha.message === MENSAGEM_INCLUSAO_ALTERADA)) {
          const salva = await carregarSessaoLocal(sessaoId);
          if (salva) mostrarConfirmada(salva, materialAlterado);
        }
        throw falha;
      }
    }
    inclusaoEmGravacao.current = gravar();
    try {
      await inclusaoEmGravacao.current;
    } finally {
      inclusaoEmGravacao.current = null;
    }
  }, [adotar, aguardarMaterial, encerradaAntes, encerradaAqui, sessaoId, userId]);
  const adicionarExercicio = useCallback((id: string) =>
    alterarInclusao(base => acrescentarExercicioNaSessao(cliente, base, id)), [alterarInclusao, cliente]);
  const desfazerInclusao = useCallback((id: string) =>
    alterarInclusao(base => desfazerUltimaInclusaoNaSessao(base, id)), [alterarInclusao]);

  const escolhaEmGravacao = useRef<Promise<unknown> | null>(null);
  const escolherProximo = useCallback(async (antes: SessaoLocal, origem: number, escolhido: number, avancarSozinho = false) => {
    const atualDoClique = ultima.current;
    if (antes.id !== sessaoId || antes.userId !== userId || atualDoClique?.id !== sessaoId ||
        atualDoClique.userId !== userId || encerradaAntes || encerradaAqui === sessaoId) return { aplicada: false, sessao: null };
    if (escolhaEmGravacao.current) return { aplicada: false, sessao: atualDoClique };
    const gravar = async () => {
      await aguardarMaterial?.();
      await filaDoCronometro.current;
      await inclusaoEmGravacao.current;
      if (!ultima.current) return { aplicada: false, sessao: null };
      const resultado = await guardarProximoExercicio(antes, origem, escolhido, avancarSozinho);
      let salva = resultado.sessao;
      if (salva && ultima.current !== atualDoClique) {
        // Um toque local posterior ao clique tem de sobreviver à adoção do retrato da outra aba.
        const antesDaLeitura = ultima.current;
        await confirmarToquesPendentes(antes);
        salva = await carregarSessaoLocal(sessaoId);
        if (salva && ultima.current && ultima.current !== antesDaLeitura) {
          salva = conciliarBlocosAcrescentados(ultima.current, salva);
        }
      }
      const atual = ultima.current;
      if (atual?.id !== sessaoId || atual.userId !== userId || salva?.userId !== userId ||
          salva.status !== "em_andamento") return { aplicada: false, sessao: null };
      adotar(salva);
      return { aplicada: resultado.aplicada, sessao: salva };
    };
    const confirmacao = gravar();
    escolhaEmGravacao.current = confirmacao;
    try {
      return await confirmacao;
    } finally {
      escolhaEmGravacao.current = null;
    }
  }, [adotar, aguardarMaterial, encerradaAntes, encerradaAqui, sessaoId, userId]);

  /** O que o motor vai decidir, sem gravar nada (o resumo da conclusão). */
  const previa = useCallback(
    (fim: FimDaSessao): ResultadoExercicio[] =>
      sessao ? avaliarSessao({ ...sessao, status: fim }) : [],
    [sessao],
  );

  /**
   * Grava a sessão (motor, fila e saída do aparelho) e volta para a aba
   * Treino.
   *
   * SPEC §22.5 item 2: com `navegar: false` ela grava **sem** sair da tela —
   * é o que a conclusão do player usa para registrar o treino ao ENTRAR, em
   * vez de ao chegar no botão do fim da página. Quem grava sem navegar fica
   * responsável por não mexer mais na sessão: `mexer` a devolveria ao Dexie
   * como sessão em andamento.
   */
  const salvar = useCallback(
    async (
      fim: FimDaSessao,
      dados: { sensacao: number | null; peso: number | null },
      opcoes?: { navegar?: boolean },
    ): Promise<boolean> => {
      if (!sessao) return false;
      setSalvando(true);
      setEncerradaAqui(sessao.id);
      try {
        // A conclusão reenvia o plano inteiro. Inclua a última escolha feita antes de fechar o treino.
        await aguardarMaterial?.();
        await notaEmGravacao.current;
        await filaDoCronometro.current;
        await descansoEmGravacao.current?.catch(() => {});
        await inclusaoEmGravacao.current?.catch(() => {});
        await escolhaEmGravacao.current?.catch(() => {});
        await Promise.all(marcacoesEmGravacao.current.values());
        const atual = ultima.current;
        if (!atual) {
          setSalvando(false);
          setEncerradaAqui(null);
          return false;
        }
        await finalizarSessao({
          sessao: { ...atual, sensacao: dados.sensacao, pesoCorporal: dados.peso },
          status: fim,
          cliente,
        });
        toast.success(
          fim === "concluida" ? "Treino salvo." : "Treino guardado como abandonado.",
        );
        if (opcoes?.navegar === false) {
          setSalvando(false);
          return true;
        }
        router.push("/");
        return true;
      } catch {
        setEncerradaAqui(null);
        toast.error("Não consegui salvar agora. Mantenha o treino aberto e tente salvar de novo.");
        setSalvando(false);
        return false;
      }
    },
    [sessao, cliente, router, aguardarMaterial],
  );

  /* -------------------------------------------------------- derivados */

  const treinoDaTroca = sessao && ehTreinoDoPrograma(sessao.workoutId) ? sessao.workoutId : null;
  const contaDaTroca = treinoDaTroca ? sessao?.userId : null;
  const trocasQ = useTrocasDoPrograma(contaDaTroca, treinoDaTroca);
  const recorrencia: RecorrenciaDaTroca | undefined = treinoDaTroca && contaDaTroca ? {
    treinoId: treinoDaTroca,
    lembradas: trocasQ.data ?? {},
    aoLembrar: (originalId, alternativaId) =>
      salvarTrocaDoPrograma(cliente, contaDaTroca, treinoDaTroca, originalId, alternativaId),
  } : undefined;

  const treino = sessao && ehTreinoDoPrograma(sessao.workoutId)
    ? acharTreino(sessao.workoutId)
    : null;
  const plano =
    sessao?.workoutId === WORKOUT_BARRA_FIXA ? prescricaoDaSemana(semanaFixa) : null;
  /** O rótulo da coleção que gerou a sessão livre ("Core no tatame"). */
  const tituloLivre = tituloDoPlano(sessao?.plano ?? null);
  const progresso = sessao ? progressoDaSessao(sessao) : null;
  const decorridoS = sessao
    ? Math.max(0, Math.round((agora - new Date(sessao.iniciadaEm).getTime()) / 1000))
    : 0;
  const eventos = useMemo(
    () => ultimoEventoPorExercicio(eventosQ.data ?? []),
    [eventosQ.data],
  );
  const historicoDe = useCallback(
    (exercicioId: string): string | null => {
      const evento = eventos[exercicioId];
      return evento ? textoDoEvento(evento) : null;
    },
    [eventos],
  );

  /* ---------------------------------------- que tela mostrar (SPEC §22.11) */

  /**
   * O servidor terminou **e** não há nada para montar: ou a linha não existe,
   * ou ela existe e a remontagem já foi tentada sem sucesso. Com a linha a
   * caminho — ou já em mãos e o motor ainda chegando — isto é `false`, e a
   * tela continua em esqueleto. A regra é pura (`lib/estado-do-player.ts`) e
   * olha só `isPending`: com `isFetching` no meio, um refetch de fundo
   * rebaixava um "não achei" já decidido de volta para esqueleto.
   */
  const servidorTerminou = servidorTerminouDeBuscar({
    sessaoPendente: sessaoQ.isPending,
    seriesPendente: seriesQ.isPending,
    linhaDoServidor: linhaDaConta,
    montagemFalhou,
  });
  const erroDaBusca =
    sessaoQ.error ??
    seriesQ.error ??
    estadosQ.error ??
    recordesQ.error ??
    anterioresQ.error ??
    null;
  const esperaConfirmacao = protegida && !localIncompativel && idsGuardados.length === 0;
  const tela = encerradaAntes || esperaConfirmacao ? "carregando" : protegida ? "atualizar" :
    falhouLeituraDoAparelho ? "erro-aparelho" : decidirTela({
    localTerminou: sessao !== undefined,
    servidorTerminou,
    sessao,
    erro: erroDaBusca,
  });

  /** O "Tentar de novo" da tela de erro: refaz as consultas, sem sair daqui. */
  const recarregar = useCallback(() => {
    setMontagemFalhou(false);
    relerAparelho(tentativa => tentativa + 1);
    void sessaoQ.refetch();
    void seriesQ.refetch();
    void estadosQ.refetch();
    void recordesQ.refetch();
    void anterioresQ.refetch();
  }, [sessaoQ, seriesQ, estadosQ, recordesQ, anterioresQ]);

  return {
    sessao,
    perfil,
    tela,
    recarregar,
    carregando: tela === "carregando",
    prefs,
    naFila,
    salvando,
    treino,
    plano,
    tituloLivre,
    progresso,
    decorridoS,
    anteriores,
    historicoDe,
    recorrencia,
    material,
    dadosDoMotor,
    mexer,
    marcar,
    mudarSerie,
    mudarFirme,
    mudarNota,
    guardarNotaGeral,
    mudarDescanso,
    ajustarCronometro,
    ajustandoCronometro,
    aposAjustarCronometro,
    escolherProximo,
    adicionarExercicio: sessao?.userId === userId && sessao.id === sessaoId && ehSessaoLivre(sessao.workoutId)
      && sessao.status === "em_andamento" && !salvando && !encerradaAntes && encerradaAqui !== sessaoId
      ? adicionarExercicio : undefined,
    desfazerInclusao,
    substituir,
    previa,
    salvar,
  };
}

export type SessaoDeTreino = ReturnType<typeof useSessaoDeTreino>;
