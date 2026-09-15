"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { ListaDoDia } from "@/components/treino/lista";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { CardCapa } from "@/components/ui/card-capa";
import { treinoDeHoje } from "@/lib/calendario";
import { capaDoTreino } from "@/lib/capas";
import { acharFase, exerciciosDoTreino } from "@/lib/dados";
import { dificuldadeDaColecao } from "@/lib/dificuldade";
import {
  detalheDoTreino,
  estadosPorExercicio,
  previaDoTreino,
  resumoDoTreino,
} from "@/lib/hoje";
import {
  useEstados,
  useEventos,
  useOverrides,
  usePerfil,
  useRecordes,
  useSeriesAnteriores,
  useSessoesAbertas,
} from "@/lib/queries/dados";
import { ligado, opcoesDeMontagem } from "@/lib/preferencias";
import { lerOrdemDoAparelho, limparOrdemDoAparelho } from "@/lib/ordem";
import { lerTrocasDoAparelho, limparTrocasDoAparelho } from "@/lib/trocas";
import { criarSessao, sessaoLocalMaisRecente } from "@/lib/queries/sessao";
import { useHoje } from "@/lib/relogio";
import { intervaloDaSemana } from "@/lib/semana";
import { seriesAnterioresPorExercicio } from "@/lib/sessao";
import type { RecordeAntes } from "@/lib/sessao";
import type { TreinoId } from "@/lib/schemas";

/**
 * `/treinar` (SPEC §3.2): com um treino aberto, vai direto para ele; senão,
 * mostra os treinos da fase com o de hoje em destaque e o botão de começar.
 */
export function TelaTreinar({ userId }: { userId: string }) {
  const router = useRouter();
  const cliente = useQueryClient();
  const hoje = useHoje();
  const [criando, setCriando] = useState<TreinoId | null>(null);

  const perfilQ = usePerfil();
  const perfil = perfilQ.data ?? null;
  const intervalo = hoje ? intervaloDaSemana(hoje) : null;
  const overridesQ = useOverrides(intervalo?.de ?? null, intervalo?.ate ?? null);
  const abertasQ = useSessoesAbertas();

  const dia = useMemo(() => {
    if (!hoje || !perfil) return null;
    return treinoDeHoje(hoje, perfil, overridesQ.data ?? []);
  }, [hoje, perfil, overridesQ.data]);

  const treinos: TreinoId[] = useMemo(() => {
    if (!perfil) return [];
    const daFase = acharFase(perfil.fase_atual).treinos;
    const doDia = dia?.tipo === "forca" ? dia.treinoId : null;
    if (!doDia) return [...daFase];
    return [doDia, ...daFase.filter((t) => t !== doDia)];
  }, [perfil, dia]);

  /*
   * As trocas escolhidas na aba Treino (SPEC §13.3) valem para o treino de
   * hoje: entram na sessão que este botão cria, e os ids dos substitutos
   * entram nas leituras (estado, séries anteriores, recordes).
   */
  const treinoDoDia = dia?.tipo === "forca" ? dia.treinoId : null;
  const [trocas, setTrocas] = useState<Record<string, string>>({});
  /* a ordem escolhida em "Editar" (SPEC §14.3) vale para a sessão que começa */
  const [ordem, setOrdem] = useState<string[]>([]);
  useEffect(() => {
    if (!hoje || !treinoDoDia) {
      setTrocas({});
      setOrdem([]);
      return;
    }
    setTrocas(lerTrocasDoAparelho(hoje, treinoDoDia));
    setOrdem(lerOrdemDoAparelho(hoje, treinoDoDia));
  }, [hoje, treinoDoDia]);

  const ids = useMemo(
    () =>
      Array.from(
        new Set([
          ...treinos.flatMap((t) =>
            exerciciosDoTreino(t).map(({ exercicio }) => exercicio.id),
          ),
          ...Object.values(trocas),
        ]),
      ),
    [treinos, trocas],
  );

  const estadosQ = useEstados(ids);
  const eventosQ = useEventos(ids);
  const anterioresQ = useSeriesAnteriores(ids);
  const recordesQ = useRecordes(ids);

  /* ---------------------------------- já tem treino aberto? vai para ele */

  useEffect(() => {
    let vivo = true;
    void sessaoLocalMaisRecente().then((s) => {
      if (vivo && s && s.status === "em_andamento") router.replace(`/treinar/${s.id}`);
    });
    return () => {
      vivo = false;
    };
  }, [router]);

  const aberta = abertasQ.data?.[0];
  useEffect(() => {
    if (aberta) router.replace(`/treinar/${aberta.id}`);
  }, [aberta, router]);

  /* ------------------------------------------------------------ começar */

  const comecar = async (treinoId: TreinoId) => {
    if (!perfil || !hoje) return;
    setCriando(treinoId);
    try {
      const recordes: Record<string, RecordeAntes> = {};
      for (const r of recordesQ.data ?? []) recordes[r.exercise_id] = r;

      const sessao = await criarSessao({
        cliente,
        userId,
        data: hoje,
        treinoId,
        fase: perfil.fase_atual,
        estados: estadosPorExercicio(estadosQ.data ?? []),
        anteriores: seriesAnterioresPorExercicio(anterioresQ.data ?? []),
        recordes,
        /*
         * Sem conseguir ler `exercise_state`, a sessão registra tudo mas não
         * avalia: uma carga inventada apagaria a progressão real (SPEC §6.3).
         */
        estadoConhecido: estadosQ.data !== undefined && recordesQ.data !== undefined,
        // as barras já pesadas na balança mudam a escala (SPEC §3.9)
        opcoesMontagem: opcoesDeMontagem(perfil.prefs),
        // o ⇄ da aba Treino escolheu antes de começar (SPEC §13.3)
        substituicoes: treinoId === treinoDoDia ? trocas : {},
        // o "Editar" da aba Treino reordenou antes de começar (SPEC §14.3)
        ordem: treinoId === treinoDoDia ? ordem : [],
      });
      if (treinoId === treinoDoDia) {
        limparTrocasDoAparelho();
        limparOrdemDoAparelho();
      }
      router.push(`/treinar/${sessao.id}`);
    } catch {
      setCriando(null);
      toast.error("Não consegui começar o treino agora.");
    }
  };

  /* --------------------------------------------------------- renderizar */

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

  if (!perfil || !hoje || treinos.length === 0) {
    return (
      <Tela>
        <EsqueletoCard linhas={4} />
      </Tela>
    );
  }

  const estados = estadosPorExercicio(estadosQ.data ?? []);
  const eventos = eventosQ.data ?? [];

  return (
    <Tela>
      {treinos.map((treinoId, i) => {
        const resumo = resumoDoTreino(treinoId);
        const doDia = i === 0 && dia?.tipo === "forca" && dia.treinoId === treinoId;
        const raios = dificuldadeDaColecao(
          exerciciosDoTreino(treinoId).map(({ exercicio }) => exercicio),
        );
        return (
          <CardCapa
            key={treinoId}
            titulo={resumo.nome}
            subtitulo={resumo.foco}
            detalhe={detalheDoTreino(treinoId)}
            foto={capaDoTreino(treinoId)}
            raios={ligado(perfil.prefs, "mostrar_raios") ? raios : null}
            etiqueta={doDia ? "hoje" : null}
            altura={doDia ? "media" : "baixa"}
            className={doDia ? "border-primary/50" : undefined}
          >
            <BotaoLargo
              variant={doDia ? "default" : "outline"}
              disabled={criando !== null}
              onClick={() => void comecar(treinoId)}
            >
              {criando === treinoId ? "Começando…" : `Começar ${resumo.nome}`}
            </BotaoLargo>
            {doDia ? (
              <ListaDoDia
                itens={previaDoTreino({
                  treinoId,
                  estados,
                  eventos,
                  montagem: opcoesDeMontagem(perfil.prefs),
                  trocas,
                })}
                carregando={estadosQ.isPending && ids.length > 0}
                mostrarRaios={ligado(perfil.prefs, "mostrar_raios")}
              />
            ) : null}
          </CardCapa>
        );
      })}
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Treinar</h1>
        <p className="text-muted-foreground text-sm">
          Escolha o treino e registre série a série.
        </p>
      </header>
      {children}
    </section>
  );
}
