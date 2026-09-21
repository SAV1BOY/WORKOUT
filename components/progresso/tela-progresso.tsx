"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Erro, EsqueletoCard } from "@/components/carregando";
import {
  GraficoBarras,
  GraficoLinha,
  LegendaDoGrafico,
  SemDados,
} from "@/components/graficos";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { acharExercicio, exercicioPorId, exercicios } from "@/lib/dados";
import {
  formatarData,
  formatarDuracao,
  formatarKg,
  formatarKm,
  formatarNumero,
  formatarPercentual,
} from "@/lib/formato";
import {
  aderencia,
  barraFixaPorSemana,
  cargaPorSessao,
  corridaPorSemana,
  datasDasSessoes,
  ordenarRecordes,
  recordesRecentes,
  semanasAte,
  treinosConcluidos,
  volumeDaSemana,
  volumePorSemana,
} from "@/lib/progresso";
import { useCardio, useOverrides, usePerfil, useSoltas } from "@/lib/queries/dados";
import {
  useSeriesDesde,
  useSessoesTodas,
  useTodosOsRecordes,
} from "@/lib/queries/progresso";
import { useHoje } from "@/lib/relogio";
import { cn } from "@/lib/utils";

/** Os três grandes + o desenvolvimento militar (SPEC §3.7). */
const GRANDES = [
  "agachamento-livre",
  "levantamento-terra",
  "supino-reto-com-barra",
  "desenvolvimento-militar-em-pe",
] as const;

const SEMANAS = 12;
const SEMANAS_DE_ADERENCIA = 4;

/**
 * `/relatorio` (SPEC §3.7 e §13.5): os cards, os gráficos e a lista de
 * recordes. O endereço antigo `/progresso` redireciona para cá.
 */
export function TelaProgresso({
  comCabecalho = true,
}: {
  /**
   * `false` quando a tela entra **dentro** do Relatório do marco V3, que já
   * tem o próprio cabeçalho (SPEC §13.5.3: "os gráficos e a lista de recordes
   * continuam abaixo").
   */
  comCabecalho?: boolean;
} = {}) {
  const hoje = useHoje();
  const janela = hoje ? semanasAte(hoje, SEMANAS)[0] ?? null : null;
  const janelaAderencia = hoje ? semanasAte(hoje, SEMANAS_DE_ADERENCIA)[0] ?? null : null;

  const perfilQ = usePerfil();
  const sessoesQ = useSessoesTodas();
  const seriesQ = useSeriesDesde(janela);
  const cardioQ = useCardio(janela, hoje);
  const soltasQ = useSoltas(janela, hoje);
  const overridesQ = useOverrides(janelaAderencia, hoje);
  const recordesQ = useTodosOsRecordes();

  const sessoes = useMemo(() => sessoesQ.data ?? [], [sessoesQ.data]);
  const series = useMemo(() => seriesQ.data ?? [], [seriesQ.data]);
  const porSessao = useMemo(() => datasDasSessoes(sessoes), [sessoes]);

  const erro =
    perfilQ.error ?? sessoesQ.error ?? seriesQ.error ?? cardioQ.error ?? recordesQ.error;

  if (erro) {
    return (
      <Tela comCabecalho={comCabecalho}>
        <Erro
          mensagem={(erro as Error).message}
          aoTentarDeNovo={() => {
            void sessoesQ.refetch();
            void seriesQ.refetch();
          }}
        />
      </Tela>
    );
  }

  if (!hoje || !perfilQ.data || sessoesQ.isPending || seriesQ.isPending) {
    return (
      <Tela comCabecalho={comCabecalho}>
        <EsqueletoCard linhas={3} />
        <EsqueletoCard linhas={5} />
      </Tela>
    );
  }

  const perfil = perfilQ.data;
  const treinos = treinosConcluidos(sessoes, hoje);
  const ade = aderencia({
    hoje,
    perfil: { ...perfil, data_inicio: perfil.data_inicio },
    overrides: overridesQ.data ?? [],
    sessoes,
    cardios: cardioQ.data ?? [],
    semanas: SEMANAS_DE_ADERENCIA,
  });
  const volumeSemana = volumeDaSemana(series, porSessao, hoje);
  const volume = volumePorSemana(series, porSessao, { hoje, semanas: SEMANAS });
  const fixa = barraFixaPorSemana(series, porSessao, soltasQ.data ?? [], {
    hoje,
    semanas: SEMANAS,
  });
  const corrida = corridaPorSemana(cardioQ.data ?? [], { hoje, semanas: SEMANAS });
  const recentes = recordesRecentes(series, porSessao, { hoje, dias: 30 });
  const nomes = new Map(exercicios.map((e) => [e.id, e.nome]));
  const recordes = ordenarRecordes(recordesQ.data ?? [], nomes);

  const semTreino = sessoes.length === 0;

  return (
    <Tela comCabecalho={comCabecalho}>
      <div className="grid grid-cols-2 gap-2">
        <Numero
          rotulo="Treinos na semana"
          valor={formatarNumero(treinos.semana)}
          /*
           * SPEC §22.6 item 4: o rótulo do total diz DE QUE é o total. Os
           * contadores acumulados do topo somam o cardio (§14.4), e os dois
           * "no total" — 51 lá em cima, 46 aqui — se contradiziam na mesma
           * rolagem.
           */
          detalhe={`só força · ${treinos.mes} no mês · ${treinos.total} de força no total`}
        />
        <Numero
          /* "aderência" é palavra de planilha; o que se mede é constância */
          rotulo="Constância (4 semanas)"
          valor={formatarPercentual(ade.percentual)}
          detalhe={`${ade.feitos} de ${ade.planejados} ${ade.planejados === 1 ? "dia" : "dias"}${
            // a janela para em `fase_desde` (a fase de hoje não vale para trás)
            ade.desde ? ` · desde ${formatarData(ade.desde)}` : ""
          }`}
        />
        <Numero
          rotulo="Volume da semana"
          valor={formatarKg(volumeSemana, 0)}
          detalhe="repetições × carga nas séries de trabalho"
        />
        <Numero
          rotulo="Recordes (30 dias)"
          valor={formatarNumero(recentes.length)}
          detalhe={
            recentes[0]
              ? `${nomes.get(recentes[0].exercise_id) ?? ""} em ${formatarData(recentes[0].data)}`
              : "nenhum ainda"
          }
        />
      </div>

      {recentes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recordes recentes</CardTitle>
            <CardDescription>Nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {recentes.slice(0, 6).map((r) => (
                <li
                  key={`${r.exercise_id}-${r.tipo}`}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <Link
                    href={`/exercicios/${r.exercise_id}`}
                    className="alvo flex min-w-0 flex-1 items-center truncate text-sm underline-offset-2 hover:underline"
                  >
                    {nomes.get(r.exercise_id) ?? r.exercise_id}
                  </Link>
                  <span className="numero text-sm whitespace-nowrap">
                    {r.tipo === "carga"
                      ? formatarKg(r.valor)
                      : r.tipo === "tempo"
                        ? formatarDuracao(r.valor)
                        : `${formatarNumero(r.valor)} reps`}
                  </span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatarData(r.data)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carga dos grandes</CardTitle>
          <CardDescription>A série mais pesada de cada sessão</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/*
            SPEC §22.6 item 9: o exercício ainda sem registro ocupava um
            cartão de altura cheia com um vazio de gráfico dentro — três
            deles enchiam a tela sem dizer nada. Agora é UMA linha.
          */}
          {GRANDES.map((id) => {
            const pontos = cargaPorSessao(series, porSessao, id);
            const exercicio = exercicioPorId.get(id);
            const nome = exercicio?.nome ?? acharExercicio(id).nome;
            const semRegistro = pontos.length === 0;
            return (
              <div key={id} data-grande={id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/exercicios/${id}`}
                    className="alvo flex items-center text-sm font-medium underline-offset-2 hover:underline"
                  >
                    {nome}
                  </Link>
                  <span
                    className={cn(
                      "shrink-0 text-sm",
                      semRegistro ? "text-muted-foreground text-xs" : "numero",
                    )}
                  >
                    {semRegistro
                      ? "sem registro"
                      : formatarKg(pontos[pontos.length - 1]?.carga ?? 0)}
                  </span>
                </div>
                {semRegistro ? null : (
                  <GraficoLinha
                    titulo={`Carga do ${exercicio?.nome ?? id} por sessão`}
                    dados={pontos}
                    x="rotulo"
                    sufixo=" kg"
                    altura={140}
                    series={[{ chave: "carga", nome: "Carga" }]}
                  />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Volume semanal</CardTitle>
          <CardDescription>
            Soma de repetições × carga, nas últimas {SEMANAS} semanas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {semTreino ? (
            <SemDados>O volume aparece depois do primeiro treino registrado.</SemDados>
          ) : (
            <GraficoBarras
              titulo="Volume por semana"
              dados={volume}
              x="rotulo"
              sufixo=" kg"
              series={[{ chave: "valor", nome: "Volume" }]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Barra fixa por semana</CardTitle>
          <CardDescription>Repetições das séries e as soltas do dia a dia</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <GraficoBarras
            titulo="Repetições de barra fixa por semana"
            dados={fixa}
            x="rotulo"
            empilhado
            series={[
              { chave: "series", nome: "Séries" },
              { chave: "soltas", nome: "Soltas", cor: "var(--chart-3)" },
            ]}
          />
          <LegendaDoGrafico
            series={[
              { chave: "series", nome: "Séries" },
              { chave: "soltas", nome: "Soltas", cor: "var(--chart-3)" },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corrida</CardTitle>
          <CardDescription>Minutos correndo e quilômetros por semana</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Minutos correndo</span>
            <GraficoBarras
              titulo="Minutos correndo por semana"
              dados={corrida}
              x="rotulo"
              sufixo=" min"
              altura={150}
              series={[{ chave: "minutos", nome: "Minutos" }]}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">
              Quilômetros ({formatarKm(corrida.reduce((t, s) => t + s.km, 0))} no período)
            </span>
            <GraficoLinha
              titulo="Quilômetros por semana"
              dados={corrida}
              x="rotulo"
              sufixo=" km"
              altura={150}
              series={[{ chave: "km", nome: "Km", cor: "var(--chart-3)" }]}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recordes por exercício</CardTitle>
          <CardDescription>
            Melhor carga, melhor série e carga máxima estimada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recordes.length === 0 ? (
            <SemDados>A lista nasce com a primeira série concluída.</SemDados>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Recordes por exercício</caption>
                <thead className="text-muted-foreground border-border border-b text-xs">
                  <tr>
                    <th scope="col" className="py-1 pr-2">
                      Exercício
                    </th>
                    <th scope="col" className="py-1 pr-2 text-right">
                      Carga
                    </th>
                    <th scope="col" className="py-1 pr-2 text-right">
                      Reps
                    </th>
                    <th scope="col" className="py-1 text-right">
                      Máx. estimada
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {recordes.map((r) => (
                    <tr key={r.exercise_id}>
                      <td className="py-1.5 pr-2">
                        <Link
                          href={`/exercicios/${r.exercise_id}`}
                          className="alvo flex items-center underline-offset-2 hover:underline"
                        >
                          {r.nome}
                        </Link>
                      </td>
                      <td className="numero py-1.5 pr-2 text-right whitespace-nowrap">
                        {r.carga_max_kg ? formatarKg(r.carga_max_kg) : "—"}
                      </td>
                      <td className="numero py-1.5 pr-2 text-right">
                        {r.reps_max ?? "—"}
                      </td>
                      <td className="numero py-1.5 text-right whitespace-nowrap">
                        {r.e1rm_epley
                          ? formatarKg(Math.round(r.e1rm_epley * 10) / 10)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </Tela>
  );
}

function Tela({
  children,
  comCabecalho = true,
}: {
  children: React.ReactNode;
  comCabecalho?: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      {comCabecalho ? (
      <header className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">Relatório</h1>
          <p className="text-muted-foreground text-sm text-balance">
            O que já foi feito e para onde a carga está indo.
          </p>
        </div>
        <Link
          href="/exercicios"
          className="alvo border-border bg-card hover:bg-accent flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium"
        >
          Catálogo de exercícios
          <span aria-hidden="true">→</span>
        </Link>
      </header>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Um card de número (SPEC §22.6 itens 7 e 8): grade de três linhas — rótulo,
 * número e legenda —, para os quatro cards da grade terminarem a legenda no
 * mesmo rodapé mesmo quando um rótulo quebra em duas linhas.
 */
function Numero({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <div className="border-border bg-card grid grid-rows-[auto_1fr_auto] gap-0.5 rounded-xl border p-3">
      <span className="text-muted-foreground text-rotulo tracking-wide uppercase">
        {rotulo}
      </span>
      <span className="numero text-2xl leading-tight">{valor}</span>
      <span className="text-muted-foreground text-rotulo text-balance">{detalhe}</span>
    </div>
  );
}
