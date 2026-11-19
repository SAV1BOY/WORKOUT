"use client";

import { useId, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { GraficoLinha, SemDados } from "@/components/graficos";
import { EsqueletoLista, Erro } from "@/components/carregando";
import { FolhaDasSeries, SeriesRegistradas } from "@/components/relatorio/detalhe-das-series";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { acharExercicio } from "@/lib/dados";
import { valoresDaSerieRegistrada } from "@/lib/detalhe-do-treino";
import {
  formatarData,
  formatarDataCompleta,
  formatarDuracao,
  formatarKg,
  formatarNumero,
  rotuloDaCarga,
} from "@/lib/formato";
import {
  SEM_HISTORICO,
  historicoCarregando,
  historicoErro,
  historicoVazio,
  leiturasQueFalharam,
  ondeVoceEsta,
} from "@/lib/ficha";
import { estadoDaLinha, textoDaCarga, textoDoAlvo, textoDoEvento } from "@/lib/hoje";
import { nomeDaAssistencia } from "@/lib/sessao";
import { tituloDaSessao } from "@/lib/relatorio";
import { cargaDeHoje, prescricaoPadrao } from "@/lib/progressao";
import {
  cargaPorSessao,
  datasDasSessoes,
  sessoesDoExercicio,
  type SerieBruta,
  type SessaoBruta,
  type SessaoDoExercicio,
} from "@/lib/progresso";
import { opcoesDeMontagem } from "@/lib/preferencias";
import { useEstados, useEventos, usePerfil, useRecordes } from "@/lib/queries/dados";
import { useSeriesDoExercicio, useSessoesTodas } from "@/lib/queries/progresso";
import { useSeriesDaSessaoNaFicha } from "@/lib/queries/series-do-detalhe";

/**
 * O histórico do exercício na ficha (SPEC §3.6): carga atual, recorde,
 * gráfico carga × data, as últimas 10 sessões e a linha do tempo do motor —
 * "por que hoje é 26,5 kg".
 */
export function HistoricoExercicio({
  exercicioId,
  comoPagina = false,
}: {
  exercicioId: string;
  /**
   * Na página as seções "Prescrição padrão" e "Carga inicial" já dizem onde a
   * primeira sessão começa; "Onde você está" só diz o que elas não dizem
   * (SPEC §22.14 item 2, `ondeVoceEsta`).
   */
  comoPagina?: boolean;
}) {
  const ids = useMemo(() => [exercicioId], [exercicioId]);
  const exercicio = acharExercicio(exercicioId);

  const perfilQ = usePerfil();
  const estadosQ = useEstados(ids);
  const recordesQ = useRecordes(ids);
  const eventosQ = useEventos(ids);
  const seriesQ = useSeriesDoExercicio(exercicioId);
  const sessoesQ = useSessoesTodas(perfilQ.data?.user_id ?? null);

  const conta = perfilQ.data?.user_id;
  const sessoesDaConta = useMemo(() => (sessoesQ.data ?? []).filter(s => conta && s.user_id === conta),
    [conta, sessoesQ.data]);
  const porSessao = useMemo(() => datasDasSessoes(sessoesDaConta), [sessoesDaConta]);
  const series = useMemo(() => (seriesQ.data ?? []).filter(s =>
    conta && (s.user_id === undefined ? porSessao.has(s.session_id) : s.user_id === conta)
  ), [conta, porSessao, seriesQ.data]);
  const pontos = useMemo(
    () => cargaPorSessao(series, porSessao, exercicioId),
    [series, porSessao, exercicioId],
  );
  const ultimas = useMemo(() => identificarOrigens(
    sessoesDoExercicio(series, porSessao, exercicioId, 10), sessoesDaConta,
  ), [series, porSessao, exercicioId, sessoesDaConta]);

  // SPEC §22.17 item 4: o perfil também — as barras pesadas mudam a carga
  const carregando = historicoCarregando({
    perfil: perfilQ.isPending,
    estados: estadosQ.isPending,
    series: seriesQ.isPending,
    recordes: recordesQ.isPending,
    sessoes: sessoesQ.isPending,
    eventos: eventosQ.isPending,
  });
  /*
   * SPEC §22.17 item 4 (revisão do Codex no PR #33): qualquer uma das seis
   * leituras que falhe vira o Erro — o perfil que falha não pode dar a carga
   * sem as barras pesadas, nem os eventos que falham o cartão único — e o
   * "Tentar de novo" refaz as que falharam.
   */
  const leituras = {
    perfil: perfilQ,
    estados: estadosQ,
    series: seriesQ,
    recordes: recordesQ,
    sessoes: sessoesQ,
    eventos: eventosQ,
  };
  const erros = {
    perfil: perfilQ.error,
    estados: estadosQ.error,
    series: seriesQ.error,
    recordes: recordesQ.error,
    sessoes: sessoesQ.error,
    eventos: eventosQ.error,
  };
  const erro = historicoErro(erros);

  if (erro) {
    return (
      <Erro
        mensagem={erro.message}
        aoTentarDeNovo={() => {
          for (const chave of leiturasQueFalharam(erros)) void leituras[chave].refetch();
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
  /*
   * SPEC §22.14 item 2: sem recorde, sem gráfico, sem sessão e sem evento do
   * motor, os quatro cartões vazios viram um só.
   */
  const vazio = historicoVazio({
    temRecorde: recorde !== null,
    pontos: pontos.length,
    sessoes: ultimas.length,
    eventos: eventos.length,
  });
  /*
   * SPEC §22.14 item 2: na página, sem avaliação do motor, "Onde você está"
   * só diz o que as seções logo acima não dizem — a carga real quando as
   * barras pesadas a mudam (§3.9), o elástico e a semana leve.
   */
  const onde = ondeVoceEsta({
    comoPagina,
    primeiraVez: alvo.primeira_vez === true,
    assistencia: Boolean(alvo.assistencia),
    semanaLeve: Boolean(alvo.semana_leve),
    cargaDoMotor: alvo.carga_kg,
    cargaInicial: exercicio.carga_inicial.kg,
  });

  return (
    <div className="flex flex-col gap-4">
      {onde.mostrar ? (
      <Card data-onde-voce-esta>
        <CardHeader>
          <CardTitle className="text-base">Onde você está</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {onde.carga ? (
            <p className="numero text-2xl">{textoDaCarga(exercicio.implemento, alvo.carga_kg)}</p>
          ) : null}
          {onde.proxima ? (
            <p className="text-muted-foreground text-sm">
              Próxima sessão: {textoDoAlvo(series_, alvo)}
              {alvo.assistencia ? ` · elástico ${nomeDaAssistencia(alvo.assistencia)}` : ""}
              {alvo.semana_leve ? " · semana leve (60%)" : ""}
            </p>
          ) : null}
          {onde.ajustePelasBarras ? (
            <p className="text-muted-foreground text-xs text-balance">
              Montada com o peso das suas barras (Mais → Equipamento).
            </p>
          ) : null}
          {onde.nota ? (
            <p className="text-muted-foreground text-xs text-balance">
              Ainda sem registro: {exercicio.carga_inicial.nota}.
            </p>
          ) : null}
        </CardContent>
      </Card>
      ) : null}

      {vazio ? (
        <Card data-historico-vazio>
          <CardContent>
            <SemDados titulo={SEM_HISTORICO.titulo}>{SEM_HISTORICO.frase}</SemDados>
          </CardContent>
        </Card>
      ) : (
      <>
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
                rotulo="Máx. estimada"
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
              {ultimas.map(({ dia, origem }) => (
                <li key={`${conta}:${dia.sessionId}:${dia.data}`} className="relative flex flex-col gap-0.5 py-2">
                  {origem && conta ? (
                    <OrigemDoTreino dia={dia} origem={origem} conta={conta} />
                  ) : (
                    <>
                      <span className="text-xs font-medium">{formatarData(dia.data)}</span>
                      <SeriesDoDia data={dia.data} series={dia.series} />
                    </>
                  )}
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
              Cada subida, manutenção ou volta de carga aparece aqui depois do treino.
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
      </>
      )}
    </div>
  );
}

function horaDeInicio(inicio?: string | null) {
  if (!inicio || !/T\d{2}:\d{2}/i.test(inicio)) return;
  const data = new Date(inicio);
  if (Number.isFinite(data.getTime())) return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

type Origem = { sessao: SessaoBruta; titulo: string; hora?: string; registro?: string };

function identificarOrigens(dias: readonly SessaoDoExercicio[], sessoes: readonly SessaoBruta[]):
  { dia: SessaoDoExercicio; origem?: Origem }[] {
  const concluidas = new Map(sessoes.filter(s => s.status === "concluida").map(s => [s.id, s]));
  const linhas = dias.map(dia => {
    const sessao = concluidas.get(dia.sessionId);
    return { dia, origem: sessao && { sessao, titulo: tituloDaSessao(sessao), hora: horaDeInicio(sessao.iniciada_em) } };
  });
  return linhas.map(linha => {
    const { dia, origem } = linha;
    if (!origem) return linha;
    const mesmoTitulo = linhas.filter(l => l.dia.data === dia.data && l.origem?.titulo === origem.titulo);
    const hora = mesmoTitulo.length > 1 ? origem.hora : undefined;
    const mesmoHorario = mesmoTitulo.filter(l => l.origem?.hora === origem.hora);
    const registro = mesmoHorario.length > 1
      ? `Registro ${mesmoHorario.indexOf(linha) + 1} de ${mesmoHorario.length}` : undefined;
    return { dia, origem: { ...origem, hora, registro } };
  });
}

function OrigemDoTreino({ dia, origem, conta }: {
  dia: SessaoDoExercicio; origem: Origem; conta: string;
}) {
  const resumo = useId();
  const { sessao, titulo, hora, registro } = origem;
  const data = formatarDataCompleta(dia.data) + (hora ? ` às ${hora}` : "") + (registro ? ` · ${registro}` : "");
  return (
    <>
      <FolhaDasSeries descricao={`${titulo} · ${data}`} gatilho={
        <button type="button" aria-label={`Ver séries de ${titulo} de ${data}`} aria-describedby={resumo}
          className="alvo foco hover:text-primary flex w-full items-center gap-2 rounded-md text-left after:absolute after:inset-0">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium wrap-anywhere">{titulo}</span>
            <span className="numero text-muted-foreground text-xs">
              {formatarData(dia.data)}{hora && ` · ${hora}`}{registro && ` · ${registro}`}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        </button>
      }>
        <DetalheNaFicha sessao={sessao} conta={conta} recorte={dia.series} />
      </FolhaDasSeries>
      <div id={resumo}><SeriesDoDia data={dia.data} series={dia.series} /></div>
    </>
  );
}

function DetalheNaFicha({ sessao, conta, recorte }: { sessao: SessaoBruta; conta: string; recorte: readonly SerieBruta[] }) {
  const consulta = useSeriesDaSessaoNaFicha(conta, sessao.id);
  if (consulta.error) return (
    <div className="px-4 pb-6"><Erro mensagem={consulta.error.message} aoTentarDeNovo={() => void consulta.refetch()} /></div>
  );
  const fonte = consulta.data;
  return <SeriesRegistradas sessao={sessao} conta={conta}
    linhas={fonte && (fonte.completa || fonte.linhas.length > 0) ? fonte.linhas : recorte}
    completa={fonte?.completa === true} carregando={consulta.isFetching && !fonte} />;
}

function Recorde({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="border-border rounded-lg border p-2">
      <dt className="text-muted-foreground text-micro tracking-wide uppercase">{rotulo}</dt>
      <dd className="numero text-lg">{valor}</dd>
    </div>
  );
}

function SeriesDoDia({ data, series }: { data: string; series: readonly SerieBruta[] }) {
  const valores = series.map(serie => valoresDaSerieRegistrada(serie));
  if (valores.every(valor => valor === valores[0])) {
    return (
      <p className="numero text-sm">
        {valores.length > 1 && `${valores.length} séries · `}{valores[0]}
      </p>
    );
  }

  return (
    <ol className="space-y-1" aria-label={`Séries de trabalho de ${formatarDataCompleta(data)}`}>
      {series.map((serie, i) => (
        <li key={serie.id ?? `${serie.set_index}-${i}`} className="flex flex-wrap gap-x-2 text-sm">
          <span className="text-muted-foreground">Série {serie.set_index}</span>
          <span className="numero">{valores[i]}</span>
        </li>
      ))}
    </ol>
  );
}
