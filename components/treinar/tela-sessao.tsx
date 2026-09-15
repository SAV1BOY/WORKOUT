"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { BlocoExercicio } from "@/components/treinar/bloco";
import { ResumoDoFim } from "@/components/treinar/resumo";
import { TimerDescanso, type DescansoAtivo } from "@/components/treinar/timer-descanso";
import { Button } from "@/components/ui/button";
import {
  EXERCICIO_DA_SESSAO,
  WORKOUT_BARRA_FIXA,
  itemDaSessao,
  prescricaoDaSemana,
} from "@/lib/barra-fixa";
import { acharExercicio, acharTreino } from "@/lib/dados";
import { formatarDuracao } from "@/lib/formato";
import { textoDoEvento, ultimoEventoPorExercicio } from "@/lib/hoje";
import {
  useEstados,
  useEventos,
  usePerfil,
  useRecordes,
  useSeriesAnteriores,
  useSeriesDaSessao,
  useSessao,
} from "@/lib/queries/dados";
import {
  carregarSessaoLocal,
  descarregarSessao,
  finalizarSessao,
  salvarSessaoLocal,
  usePendentes,
  descartarSeriesDoBloco,
  enviarSerie,
} from "@/lib/queries/sessao";
import { useQueryClient } from "@tanstack/react-query";
import { estadosPorExercicio } from "@/lib/hoje";
import {
  atualizarSerie,
  avaliarSessao,
  ehTreinoDoPrograma,
  definirFirme,
  definirNota,
  idsComSubstitutos,
  idsQueComparamComAnterior,
  marcarSerie,
  progressoDaSessao,
  proximoExercicio,
  reconstruirSessao,
  seriesAnterioresPorExercicio,
  substituirExercicio,
  type RecordeAntes,
  type SerieLocal,
  type SessaoLocal,
} from "@/lib/sessao";
import { useTelaAcesa } from "@/lib/wake-lock";
import { opcoesDeMontagem } from "@/lib/preferencias";

type Fim = "concluida" | "abandonada";

export function TelaSessao({
  sessaoId,
  videos = [],
}: {
  sessaoId: string;
  /** Ids com `public/videos/<id>.mp4` — lidos no servidor (SPEC §13.1). */
  videos?: string[];
}) {
  const router = useRouter();
  const cliente = useQueryClient();
  const [sessao, setSessao] = useState<SessaoLocal | null | undefined>(undefined);
  const [descanso, setDescanso] = useState<DescansoAtivo | null>(null);
  const [fim, setFim] = useState<Fim | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const naFila = usePendentes();

  const perfilQ = usePerfil();
  const perfilPrefs = perfilQ.data?.prefs;
  // identidade estável: `prefs` entra nas dependências de efeitos (§3.9)
  const prefs = useMemo(() => perfilPrefs ?? {}, [perfilPrefs]);
  const sessaoQ = useSessao(sessao === null ? sessaoId : null);
  const seriesQ = useSeriesDaSessao(sessao === null ? sessaoId : null);
  /*
   * A sessão de barra fixa (SPEC §3.4) não é um treino do `programa.json`:
   * os exercícios dela vêm do plano da semana (`profiles.semana_fixa`), e é
   * essa lista que refaz a sessão quando ela não está neste aparelho.
   */
  const workoutId = sessaoQ.data?.workout_id ?? null;
  const ehFixa = workoutId === WORKOUT_BARRA_FIXA;
  /*
   * A semana do plano é a que a sessão guardou (`sessions.semana_plano`), não
   * a de hoje: uma sessão antiga refeita noutro aparelho tem de voltar com a
   * prescrição do dia em que foi criada, mesmo que o plano já tenha ido de
   * 4 × 5 para 4 × 6 (SPEC §3.4). Sem a coluna (sessão criada antes dela),
   * vale a semana do perfil.
   */
  const semanaFixa =
    sessao?.semanaPlano ?? sessaoQ.data?.semana_plano ?? perfilQ.data?.semana_fixa ?? 1;
  const itensDaFixa = useMemo(
    () => (ehFixa ? [itemDaSessao(semanaFixa)] : undefined),
    [ehFixa, semanaFixa],
  );
  const treinoId = workoutId && ehTreinoDoPrograma(workoutId) ? workoutId : null;
  const idsDoTreino = useMemo(
    () =>
      treinoId
        ? acharTreino(treinoId).exercicios.map((e) => e.exercicio_id)
        : ehFixa
          ? [EXERCICIO_DA_SESSAO]
          : [],
    [treinoId, ehFixa],
  );
  /*
   * SPEC §6.3: "o substituto usa o próprio estado". A troca pode acontecer a
   * qualquer momento (inclusive sem rede), então o estado, as séries
   * anteriores e os recordes de **todos os substitutos possíveis** são
   * carregados junto com os do treino — no máximo algumas dezenas de linhas.
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

  /** O que o motor precisa saber de um exercício — ou `null` se não deu para ler. */
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

  useTelaAcesa(prefs.manter_tela !== false && sessao != null && fim === null);

  /* ------------------------------------------------- carregar do aparelho */

  useEffect(() => {
    let vivo = true;
    void carregarSessaoLocal(sessaoId).then((s) => {
      if (vivo) setSessao(s);
    });
    return () => {
      vivo = false;
    };
  }, [sessaoId]);

  // a sessão não está neste aparelho: refaz do que o banco tem (SPEC §8)
  useEffect(() => {
    if (sessao !== null) return;
    const linha = sessaoQ.data;
    if (!linha || seriesQ.isPending || !dadosDoMotor) return;
    const refeita = reconstruirSessao(linha, seriesQ.data ?? [], {
      ...dadosDoMotor,
      itens: itensDaFixa,
      // as barras já pesadas na balança mudam a escala (SPEC §3.9)
      opcoesMontagem: opcoesDeMontagem(prefs),
    });
    if (refeita) {
      salvarSessaoLocal(refeita);
      setSessao(refeita);
    }
  }, [sessao, sessaoQ.data, seriesQ.data, seriesQ.isPending, dadosDoMotor, itensDaFixa, prefs]);

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
      if (!sessao) return null;
      const nova = fn(sessao);
      setSessao(nova);
      salvarSessaoLocal(nova);
      return nova;
    },
    [sessao],
  );

  const aoMarcarSerie = useCallback(
    (ordem: number, serieId: string, concluida: boolean) => {
      const nova = mexer((atual) => marcarSerie(atual, ordem, serieId, concluida));
      if (!nova) return;
      const bloco = nova.blocos.find((b) => b.ordem === ordem);
      const serie = bloco?.series.find((s) => s.id === serieId);
      if (!bloco || !serie) return;
      void enviarSerie(nova, bloco, serie);
      if (concluida && bloco.descansoS > 0) {
        setDescanso({
          chave: Date.now(),
          segundos: bloco.descansoS,
          exercicio: acharExercicio(bloco.exercicioId).nome,
        });
      }
    },
    [mexer],
  );

  /* ------------------------------------------------------------- fim */

  const preview = useMemo(() => {
    if (!sessao || !fim) return [];
    return avaliarSessao({ ...sessao, status: fim });
  }, [sessao, fim]);

  const salvar = async (dados: { sensacao: number | null; peso: number | null }) => {
    if (!sessao || !fim) return;
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
      router.push("/");
    } catch {
      toast.error("Não consegui salvar agora. Está tudo guardado no aparelho.");
      setSalvando(false);
    }
  };

  /* --------------------------------------------------------- renderizar */

  if (sessao === undefined || (sessao === null && (sessaoQ.isPending || seriesQ.isPending))) {
    return <EsqueletoCard linhas={6} />;
  }

  if (!sessao) {
    return (
      <Erro
        mensagem="Não achei este treino. Ele pode ter sido registrado em outro aparelho."
        aoTentarDeNovo={() => router.push("/treinar")}
      />
    );
  }

  const treino = ehTreinoDoPrograma(sessao.workoutId)
    ? acharTreino(sessao.workoutId)
    : null;
  const plano =
    sessao.workoutId === WORKOUT_BARRA_FIXA ? prescricaoDaSemana(semanaFixa) : null;
  const progresso = progressoDaSessao(sessao);
  const decorridoS = Math.max(
    0,
    Math.round((agora - new Date(sessao.iniciadaEm).getTime()) / 1000),
  );
  const eventos = ultimoEventoPorExercicio(eventosQ.data ?? []);

  return (
    <div className="flex flex-col gap-3">
      <TimerDescanso
        descanso={descanso}
        aoFechar={() => setDescanso(null)}
        som={prefs.descanso_som !== false}
        vibracao={prefs.descanso_vibra !== false}
      />

      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {treino?.nome ?? (plano ? "Barra fixa" : "Treino")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {treino?.foco ?? (plano ? `semana ${plano.faixa} · ${plano.texto}` : "")}
          {naFila > 0 ? ` · ${naFila} para sincronizar` : " · sincronizado"}
        </p>
      </header>

      {sessao.blocos.map((bloco) => {
        const evento = eventos[bloco.exercicioId];
        return (
          <BlocoExercicio
            key={bloco.ordem}
            bloco={bloco}
            temVideo={videos.includes(bloco.exercicioId)}
            historico={evento ? textoDoEvento(evento) : null}
            opcoes={sessao.opcoesMontagem}
            aoMudarSerie={(serieId, campos: Partial<SerieLocal>) =>
              mexer((atual) => atualizarSerie(atual, bloco.ordem, serieId, campos))
            }
            aoMarcarSerie={(serieId, concluida) =>
              aoMarcarSerie(bloco.ordem, serieId, concluida)
            }
            aoMudarFirme={(firme) =>
              mexer((atual) => definirFirme(atual, bloco.ordem, firme))
            }
            aoMudarNota={(nota) =>
              mexer((atual) => definirNota(atual, bloco.ordem, nota))
            }
            aoSubstituir={(novoExercicioId) => {
              /*
               * O que o original já gravou sai do banco: o registro do dia é
               * do substituto (SPEC §3.2) e a folha promete a troca das
               * séries já registradas.
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
            }}
          />
        );
      })}

      <Rodape
        decorridoS={decorridoS}
        seriesTexto={progresso.texto}
        proximo={proximoExercicio(sessao)}
        aoConcluir={() => setFim("concluida")}
        aoAbandonar={() => setFim("abandonada")}
      />

      <ResumoDoFim
        aberto={fim !== null}
        fim={fim ?? "concluida"}
        aoFechar={() => {
          if (!salvando) setFim(null);
        }}
        resultados={preview}
        duracaoS={decorridoS}
        seriesTexto={progresso.texto}
        salvando={salvando}
        aoSalvar={(dados) => void salvar(dados)}
      />
    </div>
  );
}

/** Rodapé fixo: tempo, séries e as duas saídas (SPEC §3.2). */
function Rodape({
  decorridoS,
  seriesTexto,
  proximo,
  aoConcluir,
  aoAbandonar,
}: {
  decorridoS: number;
  seriesTexto: string;
  /** "próximo: Remada curvada" (SPEC §13.3). */
  proximo: string | null;
  aoConcluir: () => void;
  aoAbandonar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (relogio.current) clearTimeout(relogio.current);
  }, []);

  return (
    <>
      {/* o rodapé é fixo: este espaço impede que ele cubra o último bloco */}
      <div aria-hidden="true" className="h-28" />
      <div className="bg-card/95 border-border pb-segura fixed inset-x-0 bottom-14 z-30 border-t backdrop-blur">
        {/* SPEC §13.3: o que vem depois, em linha inteira para caber o nome */}
        {proximo ? (
          <p className="text-muted-foreground mx-auto w-full max-w-lg truncate px-3 pt-1.5 text-xs">
            próximo: {proximo}
          </p>
        ) : null}
        <div className="mx-auto flex w-full max-w-lg items-center gap-2 px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="numero text-lg leading-none">
              {formatarDuracao(decorridoS)}
            </span>
            <span className="text-muted-foreground text-xs">{seriesTexto}</span>
          </div>
          {confirmando ? (
            <Button
              variant="destructive"
              className="alvo h-12 px-3"
              onClick={aoAbandonar}
            >
              Confirmar abandono
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="alvo h-12 px-3"
              onClick={() => {
                setConfirmando(true);
                relogio.current = setTimeout(() => setConfirmando(false), 5_000);
              }}
            >
              Abandonar
            </Button>
          )}
          <Button className="alvo h-12 px-4 font-semibold" onClick={aoConcluir}>
            Concluir
          </Button>
        </div>
      </div>
    </>
  );
}
