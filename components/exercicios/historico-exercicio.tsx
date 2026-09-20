"use client";

import { useMemo } from "react";
import { GraficoLinha, SemDados } from "@/components/graficos";
import { EsqueletoLista, Erro } from "@/components/carregando";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { acharExercicio } from "@/lib/dados";
import {
  formatarData,
  formatarDuracao,
  formatarKg,
  formatarNumero,
  rotuloDaCarga,
} from "@/lib/formato";
import { estadoDaLinha, textoDaCarga, textoDoAlvo, textoDoEvento } from "@/lib/hoje";
import { cargaDeHoje, prescricaoPadrao } from "@/lib/progressao";
import {
  cargaPorSessao,
  datasDasSessoes,
  sessoesDoExercicio,
  type SerieBruta,
} from "@/lib/progresso";
import { opcoesDeMontagem } from "@/lib/preferencias";
import { useEstados, useEventos, usePerfil, useRecordes } from "@/lib/queries/dados";
import { useSeriesDoExercicio, useSessoesTodas } from "@/lib/queries/progresso";

/**
 * O histórico do exercício na ficha (SPEC §3.6): carga atual, recorde,
 * gráfico carga × data, as últimas 10 sessões e a linha do tempo do motor —
 * "por que hoje é 26,5 kg".
 */
export function HistoricoExercicio({ exercicioId }: { exercicioId: string }) {
  const ids = useMemo(() => [exercicioId], [exercicioId]);
  const exercicio = acharExercicio(exercicioId);

  const perfilQ = usePerfil();
  const estadosQ = useEstados(ids);
  const recordesQ = useRecordes(ids);
  const eventosQ = useEventos(ids);
  const seriesQ = useSeriesDoExercicio(exercicioId);
  const sessoesQ = useSessoesTodas();

  const porSessao = useMemo(
    () => datasDasSessoes(sessoesQ.data ?? []),
    [sessoesQ.data],
  );
  const series = useMemo(() => seriesQ.data ?? [], [seriesQ.data]);
  const pontos = useMemo(
    () => cargaPorSessao(series, porSessao, exercicioId),
    [series, porSessao, exercicioId],
  );
  const ultimas = useMemo(
    () => sessoesDoExercicio(series, porSessao, exercicioId, 10),
    [series, porSessao, exercicioId],
  );

  const carregando =
    estadosQ.isPending || seriesQ.isPending || recordesQ.isPending || sessoesQ.isPending;
  const erro = estadosQ.error ?? seriesQ.error ?? recordesQ.error ?? sessoesQ.error;

  if (erro) {
    return (
      <Erro
        mensagem={(erro as Error).message}
        aoTentarDeNovo={() => {
          void estadosQ.refetch();
          void seriesQ.refetch();
        }}
      />
    );
  }
  if (carregando) return <EsqueletoLista linhas={3} />;

  const estado = estadoDaLinha(estadosQ.data?.[0]);
  const prescricao = prescricaoPadrao(exercicio);
  // as barras já pesadas na balança mudam a escala (SPEC §3.9)
  const alvo = cargaDeHoje(
    exercicio,
    estado,
    prescricao,
    opcoesDeMontagem(perfilQ.data?.prefs),
  );
  const recorde = recordesQ.data?.[0] ?? null;
  const eventos = eventosQ.data ?? [];
  const temCarga = pontos.some((p) => p.carga > 0);
  const series_ = prescricao.series ?? exercicio.prescricao_padrao.series ?? 3;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Onde você está</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="numero text-2xl">{textoDaCarga(exercicio.implemento, alvo.carga_kg)}</p>
          <p className="text-muted-foreground text-sm">
            Próxima sessão: {textoDoAlvo(series_, alvo)}
            {alvo.assistencia ? ` · elástico ${alvo.assistencia.replace("_", " ")}` : ""}
            {alvo.semana_leve ? " · semana leve (60 %)" : ""}
          </p>
          {alvo.primeira_vez ? (
            <p className="text-muted-foreground text-xs text-balance">
              Ainda sem registro: {exercicio.carga_inicial.nota}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recorde</CardTitle>
        </CardHeader>
        <CardContent>
          {recorde ? (
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Recorde
                rotulo={`Carga (${rotuloDaCarga(exercicio.implemento)})`}
                valor={recorde.carga_max_kg ? formatarKg(recorde.carga_max_kg) : "—"}
              />
              <Recorde
                rotulo="Repetições"
                valor={recorde.reps_max ? formatarNumero(recorde.reps_max) : "—"}
              />
              <Recorde
                rotulo="e1RM (Epley)"
                valor={
                  recorde.e1rm_epley
                    ? `${formatarKg(Math.round(recorde.e1rm_epley * 10) / 10)}`
                    : "—"
                }
              />
              {recorde.tempo_max_s ? (
                <Recorde rotulo="Tempo" valor={formatarDuracao(recorde.tempo_max_s)} />
              ) : null}
            </dl>
          ) : (
            <SemDados>Sem recorde ainda — ele nasce na primeira série registrada.</SemDados>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {temCarga ? "Carga por sessão" : "Repetições por sessão"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pontos.length === 0 ? (
            <SemDados>O gráfico aparece depois do primeiro treino com este exercício.</SemDados>
          ) : (
            <GraficoLinha
              titulo={temCarga ? "Carga por sessão" : "Repetições por sessão"}
              dados={pontos}
              x="rotulo"
              sufixo={temCarga ? " kg" : ""}
              series={[
                temCarga
                  ? { chave: "carga", nome: "Carga" }
                  : { chave: "reps", nome: "Repetições" },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas sessões</CardTitle>
        </CardHeader>
        <CardContent>
          {ultimas.length === 0 ? (
            <SemDados>Nenhuma série registrada até agora.</SemDados>
          ) : (
            <ul className="divide-border divide-y">
              {ultimas.map((dia) => (
                <li key={`${dia.data}-${dia.sessionId}`} className="flex flex-col gap-0.5 py-2">
                  <span className="text-xs font-medium">{formatarData(dia.data)}</span>
                  <span className="numero text-sm">{textoDasSeries(dia.series)}</span>
                  <span className="text-muted-foreground text-xs">
                    {textoDaCarga(exercicio.implemento, dia.series[0]?.carga_kg ?? null)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que o motor decidiu</CardTitle>
        </CardHeader>
        <CardContent>
          {eventos.length === 0 ? (
            <SemDados>
              Cada subida, repetição ou volta de carga aparece aqui depois do treino.
            </SemDados>
          ) : (
            <ol className="flex flex-col gap-2">
              {eventos.map((e, i) => (
                <li key={`${e.data}-${e.motivo}-${i}`} className="flex gap-2 text-sm">
                  <span aria-hidden="true" className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
                  <span className="text-balance">
                    {textoDoEvento(e) ?? `${e.motivo.replace(/_/g, " ")} em ${formatarData(e.data)}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Recorde({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="border-border rounded-lg border p-2">
      <dt className="text-muted-foreground text-micro tracking-wide uppercase">{rotulo}</dt>
      <dd className="numero text-lg">{valor}</dd>
    </div>
  );
}

/** "8 · 8 · 7", "30 s · 30 s", "40 passos" — o que foi feito naquele dia. */
function textoDasSeries(series: readonly SerieBruta[]): string {
  return series
    .map((s) => {
      if (s.tempo_s !== null) {
        const lados = s.tempo_s_lado2 !== null ? `${s.tempo_s}/${s.tempo_s_lado2}` : `${s.tempo_s}`;
        return `${lados} s`;
      }
      if (s.passos !== null) return `${s.passos} passos`;
      if (s.reps_lado2 !== null) return `${s.reps ?? 0}/${s.reps_lado2}`;
      return formatarNumero(s.reps ?? 0);
    })
    .join(" · ");
}
