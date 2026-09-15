"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Erro, EsqueletoCard } from "@/components/carregando";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EXERCICIO_DA_SESSAO,
  WORKOUT_BARRA_FIXA,
  historicoDeSoltas,
  intervaloDoHistorico,
  itemDaSessao,
  linhasDoPlano,
  prescricaoDaSemana,
  sessoesDeFixaNoIntervalo,
  somarSoltas,
  soltasDaSemana,
} from "@/lib/barra-fixa";
import { avancoDeSemana } from "@/lib/cardio";
import { cardio } from "@/lib/dados";
import { formatarDiaCurto } from "@/lib/formato";
import { estadosPorExercicio } from "@/lib/hoje";
import { registrarSolta } from "@/lib/queries/acoes";
import {
  useEstados,
  usePerfil,
  useRecordes,
  useSeriesAnteriores,
  useSessoes,
  useSoltas,
  useSoltasDoDia,
} from "@/lib/queries/dados";
import { aplicarAvanco } from "@/lib/queries/perfil";
import { criarSessaoAvulsa } from "@/lib/queries/sessao";
import { useHoje } from "@/lib/relogio";
import { intervaloDaSemana } from "@/lib/semana";
import { seriesAnterioresPorExercicio, type RecordeAntes } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { opcoesDeMontagem } from "@/lib/preferencias";

const IDS = [EXERCICIO_DA_SESSAO];

/**
 * `/barra-fixa` (SPEC §3.4): a tabela das 12 semanas com a semana atual
 * destacada, a sessão da semana e as repetições soltas do grease the groove.
 */
export function TelaBarraFixa({ userId }: { userId: string }) {
  const router = useRouter();
  const cliente = useQueryClient();
  const hoje = useHoje();
  const [criando, setCriando] = useState(false);
  const [somando, setSomando] = useState(false);

  const perfilQ = usePerfil();
  const perfil = perfilQ.data ?? null;
  const semana = perfil?.semana_fixa ?? 1;

  const historico = hoje ? intervaloDoHistorico(hoje) : null;
  const soltasQ = useSoltas(historico?.de ?? null, historico?.ate ?? null);
  const soltasHojeQ = useSoltasDoDia(hoje);
  const sessoesQ = useSessoes();
  const estadosQ = useEstados(IDS);
  const anterioresQ = useSeriesAnteriores(IDS);
  const recordesQ = useRecordes(IDS);

  const plano = useMemo(() => prescricaoDaSemana(semana), [semana]);
  const linhas = useMemo(() => linhasDoPlano(semana), [semana]);
  const semanaCivil = hoje ? intervaloDaSemana(hoje) : null;

  const soltas = soltasQ.data ?? [];
  const totalHoje = somarSoltas(soltasHojeQ.data ?? []);
  const totalSemana = semanaCivil
    ? soltasDaSemana(soltas, semanaCivil.de, semanaCivil.ate)
    : 0;
  const dias = hoje ? historicoDeSoltas(soltas, hoje) : [];
  const maximoDoDia = Math.max(1, ...dias.map((d) => d.reps));

  /* ----------------------------- §5.5: 2 sessões na semana civil avançam */

  const avancando = useRef(false);
  useEffect(() => {
    if (!perfil || !hoje || !semanaCivil || !sessoesQ.data || avancando.current) return;
    const feitas = sessoesDeFixaNoIntervalo(
      sessoesQ.data,
      semanaCivil.de,
      semanaCivil.ate,
    );
    const avanco = avancoDeSemana({
      plano: "fixa",
      semanaAtual: perfil.semana_fixa,
      sessoesDaSemanaCivil: feitas,
      hoje,
      prefs: perfil.prefs,
    });
    if (!avanco) return;
    avancando.current = true;
    void aplicarAvanco({ userId, avanco, cliente }).catch(() => {
      avancando.current = false;
    });
  }, [perfil, hoje, semanaCivil, sessoesQ.data, userId, cliente]);

  /* -------------------------------------------------------- ações */

  const somarUma = async () => {
    if (!hoje || somando) return;
    setSomando(true);
    try {
      await registrarSolta({
        userId,
        data: hoje,
        intervalo: historico ?? undefined,
        cliente,
      });
    } catch {
      toast.error("Não consegui registrar agora.");
    } finally {
      setSomando(false);
    }
  };

  const comecarSessao = async () => {
    if (!perfil || !hoje || criando) return;
    setCriando(true);
    try {
      const recordes: Record<string, RecordeAntes> = {};
      for (const r of recordesQ.data ?? []) recordes[r.exercise_id] = r;

      const sessao = await criarSessaoAvulsa({
        cliente,
        userId,
        data: hoje,
        workoutId: WORKOUT_BARRA_FIXA,
        itens: [itemDaSessao(semana)],
        fase: perfil.fase_atual,
        estados: estadosPorExercicio(estadosQ.data ?? []),
        anteriores: seriesAnterioresPorExercicio(anterioresQ.data ?? []),
        recordes,
        // sem a leitura do estado o motor não avalia (SPEC §6.3)
        estadoConhecido: estadosQ.data !== undefined && recordesQ.data !== undefined,
        // as barras já pesadas na balança mudam a escala (SPEC §3.9)
        opcoesMontagem: opcoesDeMontagem(perfil.prefs),
      });
      router.push(`/treinar/${sessao.id}`);
    } catch {
      setCriando(false);
      toast.error("Não consegui começar a sessão agora.");
    }
  };

  /* --------------------------------------------------------- render */

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

  if (!perfil || !hoje) {
    return (
      <Tela>
        <EsqueletoCard linhas={5} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-balance">
            Semana {plano.faixa} · {plano.texto}
          </CardTitle>
          <CardDescription className="text-balance">{plano.assistencia}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs text-balance">{plano.treina}</p>
          <Button
            className="alvo h-14 w-full text-base font-semibold"
            disabled={criando}
            onClick={() => void comecarSessao()}
          >
            {criando ? "Começando…" : "Fazer sessão de barra fixa"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Repetições soltas</CardTitle>
          <CardDescription className="text-balance">
            {cardio.barra_fixa.grease_the_groove}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="border-border flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
                hoje
              </span>
              <span className="numero text-3xl">{totalHoje}</span>
              <span className="text-muted-foreground text-xs">
                {totalSemana} na semana
              </span>
            </div>
            <Button
              className="alvo h-14 px-6 text-base font-semibold"
              onClick={() => void somarUma()}
              disabled={somando}
              aria-label="Somar uma repetição solta de barra fixa"
            >
              <Plus className="size-5" />1
            </Button>
          </div>

          <div>
            <h3 className="text-muted-foreground mb-1 text-xs">Últimos 14 dias</h3>
            <ol
              aria-label="Histórico de repetições soltas"
              className="flex items-end justify-between gap-0.5"
            >
              {dias.map((d) => (
                <li key={d.data} className="flex flex-1 flex-col items-center gap-1">
                  <span className="numero text-[10px]">{d.reps > 0 ? d.reps : ""}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-full rounded-sm",
                      d.reps > 0 ? "bg-primary" : "bg-muted",
                      d.ehHoje && "ring-primary/40 ring-2",
                    )}
                    style={{
                      height: `${Math.max(4, (d.reps / maximoDoDia) * 40)}px`,
                    }}
                  />
                  <span className="text-muted-foreground text-[9px]">
                    {formatarDiaCurto(d.data)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">As 12 semanas</h2>
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Plano de 12 semanas da primeira barra fixa
            </caption>
            <thead className="text-muted-foreground border-border border-b text-xs">
              <tr>
                <th scope="col" className="px-2 py-2">
                  Semanas
                </th>
                <th scope="col" className="px-2 py-2">
                  Sessão
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Reps/semana
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {linhas.map((l) => (
                <tr
                  key={l.semanas}
                  aria-current={l.atual ? "true" : undefined}
                  className={l.atual ? "bg-primary/10 font-semibold" : undefined}
                >
                  <td className="px-2 py-2 align-top whitespace-nowrap">{l.semanas}</td>
                  <td className="px-2 py-2 align-top">
                    <span className="numero">{l.porSessao}</span>
                    <span className="text-muted-foreground block text-xs font-normal text-balance">
                      {l.assistencia}
                    </span>
                    <span className="text-muted-foreground block text-xs font-normal text-balance">
                      {l.treina}
                    </span>
                  </td>
                  <td className="numero px-2 py-2 text-right align-top whitespace-nowrap">
                    {l.repsSemana}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-xs text-balance">
          {cardio.barra_fixa.regra}
        </p>
      </section>
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">Barra fixa</h1>
        <p className="text-muted-foreground text-sm text-balance">
          {cardio.barra_fixa.objetivo}
        </p>
      </header>
      {children}
    </section>
  );
}
