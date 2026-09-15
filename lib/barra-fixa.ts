/**
 * Adaptadores puros do plano da primeira barra fixa (SPEC §3.4).
 *
 * A tabela das 12 semanas, a prescrição da sessão da semana (que vira uma
 * sessão de força com um exercício só) e as repetições soltas do grease the
 * groove. O conteúdo é sempre o de `data/cardio.json` — nada é escrito aqui.
 */
import { addDays } from "date-fns";
import { iso, paraData, type Data } from "@/lib/calendario";
import { acharExercicio, cardio, semanaDeBarraFixa } from "@/lib/dados";
import { formatarDescanso } from "@/lib/formato";
import type { Alvo } from "@/lib/progressao";
import type { SemanaBarraFixa } from "@/lib/schemas";
import type { ItemDaSessao } from "@/lib/sessao";

/** O exercício da sessão da semana (SPEC §3.4). */
export const EXERCICIO_DA_SESSAO = "barra-fixa-assistida";

/** `sessions.workout_id` da sessão de barra fixa (não é um treino do programa). */
export const WORKOUT_BARRA_FIXA = "fixa";

/** Quantos dias o histórico das soltas mostra (SPEC §3.4). */
export const DIAS_DE_HISTORICO = 14;

/* ------------------------------------------------------------- tabela */

export interface LinhaDoPlano {
  /** "1–2", "3–4"… como está no JSON. */
  semanas: string;
  assistencia: string;
  porSessao: string;
  repsSemana: string;
  treina: string;
  /** É a faixa que cobre `profiles.semana_fixa`? */
  atual: boolean;
}

function textoDeReps(valor: SemanaBarraFixa["reps_semana"]): string {
  return typeof valor === "number" ? String(valor) : valor;
}

/** As 12 semanas do plano, com a semana atual marcada (SPEC §3.4). */
export function linhasDoPlano(semanaAtual: number): LinhaDoPlano[] {
  const daVez = semanaDeBarraFixa(semanaAtual);
  return cardio.barra_fixa.semanas.map((s) => ({
    semanas: s.semanas,
    assistencia: s.assistencia,
    porSessao: s.por_sessao,
    repsSemana: textoDeReps(s.reps_semana),
    treina: s.treina,
    atual: s.semanas === daVez.semanas,
  }));
}

/* --------------------------------------------------- sessão da semana */

export interface PrescricaoFixa {
  /** A prescrição que o motor vai usar (SPEC §6). */
  alvo: Alvo;
  /** "4 × 5" — o texto do JSON, como está. */
  texto: string;
  /** A ajuda do elástico que o plano descreve, em texto. */
  assistencia: string;
  treina: string;
  faixa: string;
}

/**
 * A prescrição da sessão da semana, lida de `por_sessao` ("4 × 5", "5 ×
 * máximo"). As semanas 11–12 pedem máximo: o motor compara com a média da
 * sessão anterior (SPEC §6.3).
 */
export function prescricaoDaSemana(semana: number): PrescricaoFixa {
  const s = semanaDeBarraFixa(semana);
  const { series, maximo, reps } = interpretarPorSessao(s.por_sessao);

  return {
    alvo: {
      series,
      tipo: maximo ? "maximo" : "reps",
      min: maximo ? null : reps,
      max: maximo ? null : reps,
      unilateral: false,
    },
    texto: s.por_sessao,
    assistencia: s.assistencia,
    treina: s.treina,
    faixa: s.semanas,
  };
}

/**
 * Lê o `por_sessao` do JSON: "4 × 5" → 4 séries de 5; "5 × máximo" (ou "5 ×
 * falha", "5 × o que der") → 5 séries do tipo `maximo` (SPEC §6.3).
 *
 * O corte é explícito de propósito: separar por um `x` solto fazia
 * "má-x-imo" cair no ramo certo por acidente, e qualquer outra palavra no
 * JSON viraria NaN repetições sem ninguém perceber.
 */
export function interpretarPorSessao(texto: string): {
  series: number;
  maximo: boolean;
  /** `null` quando a semana pede máximo. */
  reps: number | null;
} {
  const m = /^\s*(\d+)\s*[×x]\s*(.+?)\s*$/.exec(texto);
  const series = Math.max(1, Math.round(Number(m?.[1]) || 1));
  const reps = Number((m?.[2] ?? "").replace(",", "."));
  const numerica = m !== null && Number.isFinite(reps) && reps > 0;
  return { series, maximo: !numerica, reps: numerica ? reps : null };
}

/**
 * A sessão da semana como a sessão de força já sabe montar (SPEC §3.4): um
 * exercício só, "Barra fixa assistida", nas séries/reps do plano. O descanso é
 * o do catálogo (`prescricao_padrao.descanso_s`).
 */
export function itemDaSessao(semana: number): ItemDaSessao {
  const exercicio = acharExercicio(EXERCICIO_DA_SESSAO);
  const descansoS = exercicio.prescricao_padrao.descanso_s;
  return {
    exercicioId: exercicio.id,
    prescricao: prescricaoDaSemana(semana).alvo,
    descansoS,
    descansoTexto: formatarDescanso(descansoS),
  };
}

/* ----------------------------------------------------------- soltas */

export interface SoltaCurta {
  data: string;
  reps: number;
}

export interface DiaDeSoltas {
  data: string;
  reps: number;
  ehHoje: boolean;
}

export function somarSoltas(soltas: readonly SoltaCurta[]): number {
  return soltas.reduce((total, s) => total + (s.reps || 0), 0);
}

/** O intervalo do histórico: os últimos `DIAS_DE_HISTORICO` dias até hoje. */
export function intervaloDoHistorico(hoje: Data): { de: string; ate: string } {
  const fim = paraData(hoje);
  return { de: iso(addDays(fim, -(DIAS_DE_HISTORICO - 1))), ate: iso(fim) };
}

/** Um ponto por dia, do mais antigo para o mais novo (SPEC §3.4). */
export function historicoDeSoltas(
  soltas: readonly SoltaCurta[],
  hoje: Data,
): DiaDeSoltas[] {
  const hojeIso = iso(paraData(hoje));
  const porDia = new Map<string, number>();
  for (const s of soltas) {
    porDia.set(s.data, (porDia.get(s.data) ?? 0) + (s.reps || 0));
  }
  const dias: DiaDeSoltas[] = [];
  for (let i = DIAS_DE_HISTORICO - 1; i >= 0; i--) {
    const data = iso(addDays(paraData(hoje), -i));
    dias.push({ data, reps: porDia.get(data) ?? 0, ehHoje: data === hojeIso });
  }
  return dias;
}

/** Soltas da semana civil (segunda a domingo) que contém `hoje`. */
export function soltasDaSemana(
  soltas: readonly SoltaCurta[],
  de: string,
  ate: string,
): number {
  return somarSoltas(soltas.filter((s) => s.data >= de && s.data <= ate));
}

/** Quantas sessões de barra fixa foram concluídas no intervalo (SPEC §5.5). */
export function sessoesDeFixaNoIntervalo(
  sessoes: readonly { data: string; status: string; workout_id: string }[],
  de: string,
  ate: string,
): number {
  return sessoes.filter(
    (s) =>
      s.workout_id === WORKOUT_BARRA_FIXA &&
      s.status === "concluida" &&
      s.data >= de &&
      s.data <= ate,
  ).length;
}
