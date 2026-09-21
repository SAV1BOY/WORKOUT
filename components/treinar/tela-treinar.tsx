"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { lerOrdemDoAparelho } from "@/lib/ordem";
import { lerTrocasDoAparelho } from "@/lib/trocas";
import { useComecarTreino } from "@/lib/queries/comecar";
import { useDemorouDemais } from "@/lib/espera";
import { sessaoLocalMaisRecente } from "@/lib/queries/sessao";
import { useHoje } from "@/lib/relogio";
import { intervaloDaSemana } from "@/lib/semana";
import type { TreinoId } from "@/lib/schemas";

/**
 * `/treinar` (SPEC §3.2): com um treino aberto, vai direto para ele; senão,
 * mostra os treinos da fase com o de hoje em destaque e o botão de começar.
 */
export function TelaTreinar({ userId }: { userId: string }) {
  const router = useRouter();
  const hoje = useHoje();
  const { criando, comecar } = useComecarTreino();

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
  /* lidos para o cache: quem monta a sessão é useComecarTreino (§6.3) */
  useSeriesAnteriores(ids);
  useRecordes(ids);

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
              onClick={() =>
                void comecar({
                  userId,
                  perfil,
                  hoje,
                  treinoId,
                  trocas,
                  ordem,
                  doDia: treinoId === treinoDoDia,
                })
              }
            >
              {/* SPEC §22.7 item 8: "Começar o Treino B", com artigo */}
              {criando === treinoId ? "Começando…" : `Começar o ${resumo.nome}`}
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
