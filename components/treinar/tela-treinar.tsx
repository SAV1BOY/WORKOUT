"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { ListaDoDia } from "@/components/treino/lista";
import { useMaterialDoDia } from "@/components/treino/usar-material-do-dia";
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
  chaves,
  type SessaoResumo,
  useEstados,
  useEventos,
  useOverrides,
  usePerfil,
  useRecordes,
  useSeriesAnteriores,
  useSessoesAbertas,
  useUltimasSeries,
} from "@/lib/queries/dados";
import { ligado, opcoesDeMontagem } from "@/lib/preferencias";
import { useOrdemDoDia } from "@/components/treino/usar-ordem-do-dia";
import { salvarTrocaDoPrograma, useTrocasDoPrograma } from "@/lib/queries/trocas-do-programa";
import { guardarTrocasNoAparelho, lerTrocasDoAparelho, resolverTrocasDoTreino } from "@/lib/trocas";
import { idsParaComecar, useComecarTreino, type EntradaComecar } from "@/lib/queries/comecar";
import { useDemorouDemais } from "@/lib/espera";
import { sessaoLocalMaisRecente } from "@/lib/queries/sessao";
import { useHoje } from "@/lib/relogio";
import { intervaloDaSemana } from "@/lib/semana";
import { idsComSubstitutos, idsQueComparamComAnterior } from "@/lib/sessao";
import type { TreinoId } from "@/lib/schemas";

/**
 * `/treinar` (SPEC §3.2): com um treino aberto, vai direto para ele; senão,
 * mostra os treinos da fase com o de hoje em destaque e o botão de começar.
 */
export function TelaTreinar({ userId }: { userId: string }) {
  const router = useRouter();
  const hoje = useHoje();
  const { criando, comecar, iniciando } = useComecarTreino(true);
  const cliente = useQueryClient();

  const perfilQ = usePerfil();
  const perfil = perfilQ.data?.user_id === userId ? perfilQ.data : null;
  const intervalo = hoje ? intervaloDaSemana(hoje) : null;
  const overridesQ = useOverrides(intervalo?.de ?? null, intervalo?.ate ?? null);
  const abertasQ = useSessoesAbertas(true, userId);

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

  useEffect(() => {
    // A rota tem um UUID criado no clique. Aqueça o módulo que ela renderiza.
    void import("@/components/player/tela-player").catch(() => undefined);
  }, []);

  /* ---------------------------------- já tem treino aberto? vai para ele */

  const retomar = useCallback((id: string) => {
    if (iniciando.current) return false;
    const historico = cliente.getQueryData<SessaoResumo[]>(chaves.sessoes());
    if (historico?.some((s) => s.id === id && s.status !== "em_andamento")) return false;
    router.replace(`/treinar/${id}`);
    return true;
  }, [cliente, iniciando, router]);

  const aberta = abertasQ.data?.[0];
  // Uma lista hidratada pode ainda conter a sessão que acabou de ser encerrada.
  // Com rede, a retomada automática espera a confirmação. Sem rede, usa a cópia.
  const abertasConfirmadas = abertasQ.fetchStatus === "paused" ||
    (abertasQ.isSuccess && abertasQ.isFetchedAfterMount && !abertasQ.isFetching);
  useEffect(() => {
    let vivo = true;
    void sessaoLocalMaisRecente().catch(() => null).then((s) => {
      if (!vivo) return;
      if (s?.userId === userId && s.status === "em_andamento" && retomar(s.id)) return;
      if (abertasConfirmadas && aberta) retomar(aberta.id);
    });
    return () => {
      vivo = false;
    };
  }, [aberta, abertasConfirmadas, retomar, userId]);

  /* --------------------------------------------------------- renderizar */

  const semConteudo = !perfil || !hoje || treinos.length === 0;
  const demorou = useDemorouDemais(semConteudo);

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

  if (semConteudo) {
    /*
     * O esqueleto tem hora para acabar: se o perfil não chegou em dez segundos
     * e nem deu erro (a leitura presa, o Dexie sem responder), a tela vira um
     * `Erro` com saída em vez de ficar morta (SPEC §3.1). A tela boa aparece
     * em menos de um segundo, então este aviso nunca aparece por lentidão.
     */
    if (demorou) {
      return (
        <Tela>
          <Erro
            mensagem="Não consegui carregar os treinos."
            aoTentarDeNovo={() => window.location.reload()}
          />
        </Tela>
      );
    }
    return (
      <Tela>
        <EsqueletoCard linhas={4} />
      </Tela>
    );
  }

  return (
    <Tela>
      {treinos.map((treinoId) => (
        <TreinoParaComecar
          key={treinoId}
          entrada={{ userId, perfil, hoje, treinoId, doDia: treinoId === treinoDoDia }}
          criando={criando}
          comecar={comecar}
        />
      ))}
    </Tela>
  );
}

/** Cada card aquece as mesmas consultas que sua sessão usará no player. */
function TreinoParaComecar({ entrada, criando, comecar }: {
  entrada: Omit<EntradaComecar, "lembradas">;
  criando: TreinoId | null;
  comecar: (entrada: EntradaComecar) => Promise<void>;
}) {
  const { treinoId, perfil, doDia, hoje, userId } = entrada;
  const cliente = useQueryClient();
  const lembradas = useTrocasDoPrograma(userId, treinoId);
  const material = useMaterialDoDia(userId, hoje, treinoId);
  const { ordem } = useOrdemDoDia(userId, hoje, doDia ? treinoId : null);
  const [escolha, setEscolha] = useState<{ conta: string; data: string; treino: TreinoId; trocas: Record<string, string> } | null>(null);
  const rascunho = useMemo(() => doDia ? lerTrocasDoAparelho(userId, hoje, treinoId) : undefined,
    [doDia, userId, hoje, treinoId]);
  const soHoje = escolha?.conta === userId && escolha.data === hoje && escolha.treino === treinoId ? escolha.trocas : rascunho;
  const trocar = (original: string, destino: string) => {
    const novas = { ...soHoje, [original]: destino };
    guardarTrocasNoAparelho(userId, hoje, treinoId, novas);
    setEscolha({ conta: userId, data: hoje, treino: treinoId, trocas: novas });
  };
  const trocas = useMemo(() => resolverTrocasDoTreino(treinoId, lembradas.data, soHoje),
    [treinoId, lembradas.data, soHoje]);
  const exercicios = useMemo(() => exerciciosDoTreino(treinoId), [treinoId]);
  const idsAtivos = useMemo(() => exercicios.map(({ exercicio }) => trocas?.[exercicio.id] ?? exercicio.id), [exercicios, trocas]);
  const ids = useMemo(() => idsComSubstitutos(idsParaComecar(treinoId, trocas)), [treinoId, trocas]);
  const estadosQ = useEstados(ids);
  const eventosQ = useEventos(idsAtivos);
  useUltimasSeries(userId, idsAtivos);
  useRecordes(ids);
  useSeriesAnteriores(idsQueComparamComAnterior(ids));

  const resumo = resumoDoTreino(treinoId);
  const raios = dificuldadeDaColecao(exercicios.map(({ exercicio }) => exercicio));
  return (
    <CardCapa
      titulo={resumo.nome}
      subtitulo={resumo.foco}
      detalhe={detalheDoTreino(treinoId)}
      foto={capaDoTreino(treinoId)}
      raios={ligado(perfil.prefs, "mostrar_raios") ? raios : null}
      etiqueta={doDia ? "hoje" : null}
      altura={doDia ? "media" : "baixa"}
      className={doDia ? "border-primary/50" : undefined}
    >
      <BotaoLargo variant={doDia ? "default" : "outline"} disabled={criando !== null}
        onClick={() => void comecar({ ...entrada, lembradas, trocas: soHoje, equipamentosDisponiveis: material?.disponiveis })}>
        {criando === treinoId ? "Começando…" : `Começar o ${resumo.nome}`}
      </BotaoLargo>
      {doDia && (
        <ListaDoDia
          material={material}
          prefs={perfil.prefs}
          aoSubstituir={trocar}
          itens={previaDoTreino({
            treinoId, estados: estadosPorExercicio(estadosQ.data ?? []),
            eventos: eventosQ.data ?? [], montagem: opcoesDeMontagem(perfil.prefs), trocas, ordem,
          })}
          recorrencia={{
            treinoId,
            lembradas: lembradas.data ?? {},
            aoLembrar: (original, destino) => salvarTrocaDoPrograma(cliente, userId, treinoId, original, destino),
          }}
          carregando={estadosQ.isPending}
          mostrarRaios={ligado(perfil.prefs, "mostrar_raios")}
        />
      )}
    </CardCapa>
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
