"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  EXERCICIO_DA_SESSAO,
  WORKOUT_BARRA_FIXA,
  itemDaSessao,
  prescricaoDaSemana,
} from "@/lib/barra-fixa";
import { acharTreino } from "@/lib/dados";
import { decidirTela } from "@/lib/estado-do-player";
import { itensDoPlano, tituloDoPlano } from "@/lib/livre";
import {
  estadosPorExercicio,
  textoDoEvento,
  ultimoEventoPorExercicio,
} from "@/lib/hoje";
import { anterioresPorExercicio, type SerieDeOutroDia } from "@/lib/player";
import { opcoesDeMontagem } from "@/lib/preferencias";
import {
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
  carregarSessaoLocal,
  descarregarSessao,
  descartarSeriesDoBloco,
  enviarSerie,
  finalizarSessao,
  salvarSessaoLocal,
  usePendentes,
} from "@/lib/queries/sessao";
import {
  atualizarSerie,
  avaliarSessao,
  definirFirme,
  definirNota,
  ehTreinoDoPrograma,
  idsComSubstitutos,
  idsQueComparamComAnterior,
  marcarSerie,
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
import type { Prefs } from "@/lib/types";
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
export function useSessaoDeTreino(sessaoId: string) {
  const router = useRouter();
  const cliente = useQueryClient();
  const [sessao, setSessao] = useState<SessaoLocal | null | undefined>(undefined);
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
  const adotar = useCallback((nova: SessaoLocal | null) => {
    ultima.current = nova;
    setSessao(nova);
  }, []);
  /**
   * SPEC §22.11: a remontagem a partir do banco já foi tentada e não deu
   * sessão. Sem isto a tela não tem como distinguir "ainda vem" de "não há" —
   * e era afirmando "não achei" cedo demais que ela assustava quem tinha o
   * treino gravado.
   */
  const [montagemFalhou, setMontagemFalhou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const naFila = usePendentes();

  const perfilQ = usePerfil();
  const perfilPrefs = perfilQ.data?.prefs;
  // identidade estável: `prefs` entra nas dependências de efeitos (§3.9)
  const prefs: Prefs = useMemo(() => perfilPrefs ?? {}, [perfilPrefs]);
  const sessaoQ = useSessao(sessao === null ? sessaoId : null);
  const seriesQ = useSeriesDaSessao(sessao === null ? sessaoId : null);

  /*
   * A sessão de barra fixa (SPEC §3.4) não é um treino do `programa.json`:
   * os exercícios dela vêm do plano da semana (`profiles.semana_fixa`), e é
   * essa lista que refaz a sessão quando ela não está neste aparelho.
   */
  const workoutId = sessaoQ.data?.workout_id ?? null;
  const ehFixa = workoutId === WORKOUT_BARRA_FIXA;
  const semanaFixa =
    sessao?.semanaPlano ?? sessaoQ.data?.semana_plano ?? perfilQ.data?.semana_fixa ?? 1;
  /*
   * A sessão livre (SPEC §13.4) e a sessão do programa que foi **reordenada**
   * (§14.3) não dão para refazer a partir do `programa.json`: a lista está em
   * `sessions.plano`, e é ela que manda quando existe.
   */
  const planoDaLinha = sessao?.plano ?? sessaoQ.data?.plano ?? null;
  const itensDoPlanoDaLinha = useMemo(
    () => itensDoPlano(planoDaLinha) ?? undefined,
    [planoDaLinha],
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
      sessao
        ? Array.from(
            new Set(sessao.blocos.flatMap((b) => [b.originalId, b.exercicioId])),
          )
            .sort()
            .join(",")
        : idsDoTreino.join(","),
    [sessao, idsDoTreino],
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
  const ultimasQ = useUltimasSeries(idsNaTela);

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
    void carregarSessaoLocal(sessaoId).then((s) => {
      if (!vivo) return;
      setMontagemFalhou(false);
      adotar(s);
    });
    return () => {
      vivo = false;
    };
  }, [sessaoId, adotar]);

  // a sessão não está neste aparelho: refaz do que o banco tem (SPEC §8)
  useEffect(() => {
    if (sessao !== null) return;
    const linha = sessaoQ.data;
    if (!linha || seriesQ.isPending) return;
    if (!dadosDoMotor) {
      /*
       * Sem `ids` as consultas do motor nem são feitas, e `dadosDoMotor` fica
       * `null` para sempre: não há o que montar, e a tela pode dizer isso em
       * vez de ficar num esqueleto eterno (SPEC §22.11).
       */
      if (ids.length === 0) setMontagemFalhou(true);
      return;
    }
    const refeita = reconstruirSessao(linha, seriesQ.data ?? [], {
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
  }, [sessao, sessaoQ.data, seriesQ.data, seriesQ.isPending, dadosDoMotor, ids, itensDaFixa, prefs, adotar]);

  /* --------------------------------------------- relógio e saída da aba */

  useEffect(() => {
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
  }, []);

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
      salvarSessaoLocal(nova);
      return nova;
    },
    [adotar],
  );

  /**
   * Marcar uma série: grava no aparelho, manda para a fila e devolve o bloco e
   * a série que mudaram (quem chamou decide o que fazer com o descanso).
   */
  const marcar = useCallback(
    (
      ordem: number,
      serieId: string,
      concluida: boolean,
    ): { sessao: SessaoLocal; bloco: BlocoLocal; serie: SerieLocal } | null => {
      const nova = mexer((atual) => marcarSerie(atual, ordem, serieId, concluida));
      if (!nova) return null;
      const bloco = nova.blocos.find((b) => b.ordem === ordem);
      const serie = bloco?.series.find((s) => s.id === serieId);
      if (!bloco || !serie) return null;
      // o registro sai do aparelho para a fila antes de qualquer animação (§8)
      void descarregarSessao();
      void enviarSerie(nova, bloco, serie);
      return { sessao: nova, bloco, serie };
    },
    [mexer],
  );

  const mudarSerie = useCallback(
    (ordem: number, serieId: string, campos: Partial<SerieLocal>) =>
      mexer((atual) => atualizarSerie(atual, ordem, serieId, campos)),
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

  const substituir = useCallback(
    (bloco: BlocoLocal, novoExercicioId: string) => {
      const sessao = ultima.current;
      if (!sessao) return;
      /*
       * O que o original já gravou sai do banco: o registro do dia é do
       * substituto (SPEC §3.2) e a folha promete a troca das séries já
       * registradas.
       */
      void descartarSeriesDoBloco(sessao, bloco);
      mexer((atual) =>
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
    },
    [mexer, dadosDoMotor],
  );

  /* ------------------------------------------------------------- fim */

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
      try {
        await descarregarSessao();
        await finalizarSessao({
          sessao: { ...sessao, sensacao: dados.sensacao, pesoCorporal: dados.peso },
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
        toast.error("Não consegui salvar agora. Está tudo guardado no aparelho.");
        setSalvando(false);
        return false;
      }
    },
    [sessao, cliente, router],
  );

  /* -------------------------------------------------------- derivados */

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

  /** As consultas que precisam terminar antes de se poder dizer "não achei". */
  const servidorRespondeu =
    !sessaoQ.isPending &&
    !sessaoQ.isFetching &&
    !seriesQ.isPending &&
    !seriesQ.isFetching;
  /**
   * O servidor terminou **e** não há nada para montar: ou a linha não existe,
   * ou ela existe e a remontagem já foi tentada sem sucesso. Com a linha a
   * caminho — ou já em mãos e o motor ainda chegando — isto é `false`, e a
   * tela continua em esqueleto.
   */
  const servidorTerminou =
    servidorRespondeu && (sessaoQ.data == null || montagemFalhou);
  const erroDaBusca =
    sessaoQ.error ??
    seriesQ.error ??
    estadosQ.error ??
    recordesQ.error ??
    anterioresQ.error ??
    null;
  const tela = decidirTela({
    localTerminou: sessao !== undefined,
    servidorTerminou,
    sessao,
    erro: erroDaBusca,
  });

  /** O "Tentar de novo" da tela de erro: refaz as consultas, sem sair daqui. */
  const recarregar = useCallback(() => {
    setMontagemFalhou(false);
    void sessaoQ.refetch();
    void seriesQ.refetch();
    void estadosQ.refetch();
    void recordesQ.refetch();
    void anterioresQ.refetch();
  }, [sessaoQ, seriesQ, estadosQ, recordesQ, anterioresQ]);

  return {
    sessao,
    perfil: perfilQ.data ?? null,
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
    dadosDoMotor,
    mexer,
    marcar,
    mudarSerie,
    mudarFirme,
    mudarNota,
    substituir,
    previa,
    salvar,
  };
}

export type SessaoDeTreino = ReturnType<typeof useSessaoDeTreino>;
