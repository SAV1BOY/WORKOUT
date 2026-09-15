"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { Previa } from "@/components/hoje/previa";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { treinoDeHoje } from "@/lib/calendario";
import { acharFase, exerciciosDoTreino } from "@/lib/dados";
import {
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

  const ids = useMemo(
    () =>
      Array.from(
        new Set(
          treinos.flatMap((t) => exerciciosDoTreino(t).map(({ exercicio }) => exercicio.id)),
        ),
      ),
    [treinos],
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
      });
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
        return (
          <Card key={treinoId} className={doDia ? "border-primary/50" : undefined}>
            <CardHeader>
              <CardTitle className="text-lg text-balance">{resumo.texto}</CardTitle>
              <CardDescription>
                {doDia ? "o treino de hoje · " : ""}
                {resumo.foco}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button
                className="alvo h-14 w-full text-base font-semibold"
                variant={doDia ? "default" : "outline"}
                disabled={criando !== null}
                onClick={() => void comecar(treinoId)}
              >
                {criando === treinoId ? "Começando…" : `Começar ${resumo.nome}`}
              </Button>
              {doDia ? (
                <Previa
                  itens={previaDoTreino({ treinoId, estados, eventos })}
                  carregando={estadosQ.isPending && ids.length > 0}
                />
              ) : null}
            </CardContent>
          </Card>
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
