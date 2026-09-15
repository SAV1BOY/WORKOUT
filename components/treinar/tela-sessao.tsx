"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { BlocoExercicio } from "@/components/treinar/bloco";
import { ResumoDoFim } from "@/components/treinar/resumo";
import { TimerDescanso, type DescansoAtivo } from "@/components/treinar/timer-descanso";
import { Button } from "@/components/ui/button";
import { acharExercicio, acharTreino } from "@/lib/dados";
import { formatarDuracao } from "@/lib/formato";
import { textoDoEvento, ultimoEventoPorExercicio } from "@/lib/hoje";
import {
  useEstados,
  useEventos,
  usePerfil,
  useSeriesDaSessao,
  useSessao,
} from "@/lib/queries/dados";
import {
  carregarSessaoLocal,
  descarregarSessao,
  finalizarSessao,
  salvarSessaoLocal,
  usePendentes,
  enviarSerie,
} from "@/lib/queries/sessao";
import { useQueryClient } from "@tanstack/react-query";
import { estadosPorExercicio } from "@/lib/hoje";
import {
  atualizarSerie,
  avaliarSessao,
  definirFirme,
  definirNota,
  marcarSerie,
  progressoDaSessao,
  reconstruirSessao,
  substituirExercicio,
  type SerieLocal,
  type SessaoLocal,
} from "@/lib/sessao";
import { useTelaAcesa } from "@/lib/wake-lock";

type Fim = "concluida" | "abandonada";

export function TelaSessao({ sessaoId }: { sessaoId: string }) {
  const router = useRouter();
  const cliente = useQueryClient();
  const [sessao, setSessao] = useState<SessaoLocal | null | undefined>(undefined);
  const [descanso, setDescanso] = useState<DescansoAtivo | null>(null);
  const [fim, setFim] = useState<Fim | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const naFila = usePendentes();

  const perfilQ = usePerfil();
  const prefs = perfilQ.data?.prefs ?? {};
  const sessaoQ = useSessao(sessao === null ? sessaoId : null);
  const seriesQ = useSeriesDaSessao(sessao === null ? sessaoId : null);
  const treinoId =
    sessaoQ.data && sessaoQ.data.workout_id !== "livre" ? sessaoQ.data.workout_id : null;
  const idsDoTreino = useMemo(
    () => (treinoId ? acharTreino(treinoId).exercicios.map((e) => e.exercicio_id) : []),
    [treinoId],
  );
  const estadosQ = useEstados(idsDoTreino);
  const idsNaTela = useMemo(
    () => sessao?.blocos.map((b) => b.exercicioId) ?? [],
    [sessao],
  );
  const eventosQ = useEventos(idsNaTela);

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
    if (!linha || seriesQ.isPending || estadosQ.isPending) return;
    const refeita = reconstruirSessao(linha, seriesQ.data ?? [], {
      estados: estadosPorExercicio(estadosQ.data ?? []),
    });
    if (refeita) {
      salvarSessaoLocal(refeita);
      setSessao(refeita);
    }
  }, [sessao, sessaoQ.data, seriesQ.data, seriesQ.isPending, estadosQ.data, estadosQ.isPending]);

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

  const treino = sessao.workoutId === "livre" ? null : acharTreino(sessao.workoutId);
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
          {treino?.nome ?? "Treino"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {treino?.foco ?? ""}
          {naFila > 0 ? ` · ${naFila} para sincronizar` : " · sincronizado"}
        </p>
      </header>

      {sessao.blocos.map((bloco) => {
        const evento = eventos[bloco.exercicioId];
        return (
          <BlocoExercicio
            key={bloco.ordem}
            bloco={bloco}
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
            aoSubstituir={(novoId) =>
              mexer((atual) =>
                substituirExercicio(atual, bloco.ordem, novoId, null, {
                  novoId: () => crypto.randomUUID(),
                }),
              )
            }
          />
        );
      })}

      <Rodape
        decorridoS={decorridoS}
        seriesTexto={progresso.texto}
        aoConcluir={() => setFim("concluida")}
        aoAbandonar={() => setFim("abandonada")}
      />

      <ResumoDoFim
        aberto={fim !== null}
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
  aoConcluir,
  aoAbandonar,
}: {
  decorridoS: number;
  seriesTexto: string;
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
