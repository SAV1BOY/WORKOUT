/**
 * Números por tipo e por período (SPEC §19.2) — "quantos treinos fizemos,
 * quantos de força, cardio, barra".
 *
 * Funções puras sobre as linhas cruas do banco: sem React, sem Supabase, sem
 * Dexie. Nome de treino sai de `programa.json` e a lista de exercícios de barra
 * fixa sai de `exercicios.json`, sempre por `lib/dados.ts` — nada de conteúdo
 * escrito aqui.
 *
 * Sessão em andamento e sessão abandonada **não contam** (SPEC §19.1): só
 * `sessions.status = 'concluida'` e `cardio_sessions.concluida`.
 */
import { endOfMonth, startOfMonth } from "date-fns";
import { inicioDaSemana, iso, paraData, type Data } from "@/lib/calendario";
import { acharTreino, exercicios, programa } from "@/lib/dados";
import { ehSessaoLivre } from "@/lib/livre";
import {
  dataDaSerie,
  datasDasSessoes,
  repsDaSerie,
  serieDeTrabalho,
  volumeDaSerie,
  type SerieBruta,
  type SessaoBruta,
  type SoltaBruta,
} from "@/lib/progresso";
import type { TreinoId } from "@/lib/schemas";
import type { LinhaSessaoCardio, TipoCardio } from "@/lib/types";

/* --------------------------------------------------------------- tipos */

export type Periodo = "semana" | "mes" | "tudo";

/** A ordem do seletor na tela (SPEC §19.2). */
export const PERIODOS: readonly Periodo[] = ["semana", "mes", "tudo"];

/** O rótulo de cada botão do seletor (UI, não conteúdo de treino). */
export const ROTULO_DO_PERIODO: Record<Periodo, string> = {
  semana: "Semana",
  mes: "Mês",
  tudo: "Tudo",
};

/** O cardio de que os números precisam (mais colunas que o `CardioBruto`). */
export type CardioContavel = Pick<
  LinhaSessaoCardio,
  "data" | "tipo" | "duracao_min" | "distancia_km" | "concluida"
> &
  Partial<Pick<LinhaSessaoCardio, "saltos" | "semana_plano" | "feito">>;

export interface Intervalo {
  /** `null` = sem limite (o período "Tudo"). */
  de: string | null;
  ate: string | null;
}

export interface SessoesPorTreino {
  id: TreinoId;
  /** O nome de `programa.json` ("Treino A", "Superior B"). */
  nome: string;
  sessoes: number;
}

export interface NumerosDeForca {
  /** Sessões de força concluídas (programa + livres). Barra fixa não entra. */
  sessoes: number;
  porTreino: SessoesPorTreino[];
  /** Sessões livres e circuitos (`workout_id = 'livre'`). */
  livres: number;
}

export interface NumerosDeCardio {
  sessoes: number;
  corrida: number;
  corda: number;
  /** Caminhada e "outro" somados. */
  outros: number;
  minutos: number;
  km: number;
  saltos: number;
}

export interface NumerosDeBarraFixa {
  /** Sessões de barra fixa concluídas (`workout_id = 'fixa'`). */
  sessoes: number;
  /** Repetições nas séries concluídas de exercícios de barra fixa. */
  repsEmSessao: number;
  /** Repetições soltas (`pullup_singles`). */
  repsSoltas: number;
  /** As duas somadas. */
  reps: number;
  /** A maior série de barra fixa do período. */
  melhorSerie: number;
}

export interface Numeros {
  periodo: Periodo;
  de: string | null;
  ate: string | null;
  forca: NumerosDeForca;
  cardio: NumerosDeCardio;
  barraFixa: NumerosDeBarraFixa;
  /** Força (inclusive barra fixa) + cardio. */
  minutos: number;
  volumeKg: number;
}

export interface EntradaDosNumeros {
  periodo: Periodo;
  hoje: Data;
  sessoes?: readonly SessaoBruta[];
  series?: readonly SerieBruta[];
  cardios?: readonly CardioContavel[];
  soltas?: readonly SoltaBruta[];
}

/* ----------------------------------------------------------- o período */

/** O recorte de cada período (SPEC §19.2); "Tudo" não recorta nada. */
export function intervaloDoPeriodo(periodo: Periodo, hoje: Data): Intervalo {
  if (periodo === "tudo") return { de: null, ate: null };
  const dia = paraData(hoje);
  if (periodo === "mes") {
    return { de: iso(startOfMonth(dia)), ate: iso(endOfMonth(dia)) };
  }
  const segunda = inicioDaSemana(dia);
  const domingo = new Date(segunda);
  domingo.setDate(domingo.getDate() + 6);
  return { de: iso(segunda), ate: iso(domingo) };
}

function dentroDe({ de, ate }: Intervalo): (data: string) => boolean {
  return (data: string) =>
    (de === null || data >= de) && (ate === null || data <= ate);
}

/* ------------------------------------------------- exercícios de barra fixa */

/**
 * Os exercícios de barra fixa do catálogo (SPEC §19.2): `implemento =
 * 'barra_fixa'` e `grupo = 'Costas'` — a elevação de pernas pendurado usa a
 * mesma barra, mas é core, não é barra fixa.
 */
export const EXERCICIOS_DE_BARRA_FIXA: ReadonlySet<string> = new Set(
  exercicios
    .filter((e) => e.implemento === "barra_fixa" && e.grupo === "Costas")
    .map((e) => e.id),
);

export function ehSerieDeBarraFixa(serie: SerieBruta): boolean {
  return EXERCICIOS_DE_BARRA_FIXA.has(serie.exercise_id);
}

/* ------------------------------------------------------------ as contas */

/** A ordem dos treinos na tela é a de `programa.json` (A1, B1, SA, IA, SB, IB). */
const TREINOS: readonly TreinoId[] = programa.fases.flatMap((f) => f.treinos);

function contarForca(
  sessoes: readonly SessaoBruta[],
  dentro: (data: string) => boolean,
): NumerosDeForca {
  const feitas = sessoes.filter(
    (s) => s.status === "concluida" && s.workout_id !== "fixa" && dentro(s.data),
  );
  const porTreino = TREINOS.map((id) => ({
    id,
    nome: acharTreino(id).nome,
    sessoes: feitas.filter((s) => s.workout_id === id).length,
  }));
  return {
    sessoes: feitas.length,
    porTreino,
    livres: feitas.filter((s) => ehSessaoLivre(s.workout_id)).length,
  };
}

const CONTADOS_POR_TIPO: readonly TipoCardio[] = ["corrida", "corda"];

function contarCardio(
  cardios: readonly CardioContavel[],
  dentro: (data: string) => boolean,
): NumerosDeCardio {
  const feitos = cardios.filter((c) => c.concluida && dentro(c.data));
  const porTipo = (tipo: TipoCardio) => feitos.filter((c) => c.tipo === tipo).length;
  return {
    sessoes: feitos.length,
    corrida: porTipo("corrida"),
    corda: porTipo("corda"),
    outros: feitos.filter(
      (c) => !CONTADOS_POR_TIPO.includes(c.tipo),
    ).length,
    minutos: feitos.reduce((t, c) => t + (c.duracao_min ?? 0), 0),
    km: arredondar(feitos.reduce((t, c) => t + (c.distancia_km ?? 0), 0), 2),
    saltos: feitos.reduce((t, c) => t + (c.saltos ?? 0), 0),
  };
}

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

/* --------------------------------------------------------------- pronto */

/**
 * Os números de um período (SPEC §19.2). Tudo sai das linhas cruas: nenhuma
 * leitura, nenhuma decisão de tela.
 */
export function numerosDoPeriodo({
  periodo,
  hoje,
  sessoes = [],
  series = [],
  cardios = [],
  soltas = [],
}: EntradaDosNumeros): Numeros {
  const intervalo = intervaloDoPeriodo(periodo, hoje);
  const dentro = dentroDe(intervalo);

  const porSessao = datasDasSessoes(sessoes);
  const seriesFeitas = series.filter(
    (s) => s.concluida && dentro(dataDaSerie(s, porSessao)),
  );

  const deBarraFixa = seriesFeitas.filter(ehSerieDeBarraFixa);
  const repsEmSessao = deBarraFixa.reduce((t, s) => t + repsDaSerie(s), 0);
  const repsSoltas = soltas
    .filter((s) => dentro(s.data))
    .reduce((t, s) => t + s.reps, 0);
  const melhorSerie = deBarraFixa.reduce(
    (maior, s) => Math.max(maior, repsDaSerie(s)),
    0,
  );

  const forcaConcluida = sessoes.filter(
    (s) => s.status === "concluida" && dentro(s.data),
  );
  const segundos = forcaConcluida.reduce((t, s) => t + (s.duracao_s ?? 0), 0);
  const cardio = contarCardio(cardios, dentro);

  return {
    periodo,
    de: intervalo.de,
    ate: intervalo.ate,
    forca: contarForca(sessoes, dentro),
    cardio,
    barraFixa: {
      sessoes: forcaConcluida.filter((s) => s.workout_id === "fixa").length,
      repsEmSessao,
      repsSoltas,
      reps: repsEmSessao + repsSoltas,
      melhorSerie,
    },
    minutos: Math.round(segundos / 60) + cardio.minutos,
    volumeKg: Math.round(
      seriesFeitas.filter(serieDeTrabalho).reduce((t, s) => t + volumeDaSerie(s), 0),
    ),
  };
}

/** Só os treinos que aconteceram no período — a tela não lista zeros. */
export function treinosComSessao(forca: NumerosDeForca): SessoesPorTreino[] {
  return forca.porTreino.filter((t) => t.sessoes > 0);
}
