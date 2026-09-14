/**
 * Calendário e rotina (SPEC §5) — funções puras, sem React nem Supabase.
 *
 * Que dia é hoje (força, cardio ou descanso), qual treino, qual sessão de
 * cardio, em que semana da fase estamos, quando sugerir a Fase 2, como avançar
 * as semanas dos planos e como reorganizar uma semana curta.
 *
 * A semana começa na segunda (`weekStartsOn: 1`) e todo conteúdo vem dos JSON.
 */
import {
  addDays,
  addWeeks,
  differenceInCalendarWeeks,
  format,
  isBefore,
  parseISO,
  startOfWeek,
} from "date-fns";
import {
  acharExercicio,
  acharFase,
  acharTreino,
  cardio,
  DIAS,
  diaDoPrograma,
  estagioDeCorda,
  semanaDeCorrida,
} from "@/lib/dados";
import type {
  DiaPrograma,
  DiaSemana,
  EstagioCorda,
  FaseId,
  SemanaCorrida,
  TipoDia,
  Treino,
  TreinoId,
} from "@/lib/schemas";
import type { LinhaExcecaoAgenda, Prefs } from "@/lib/types";

const SEMANA_COMECA = { weekStartsOn: 1 } as const;

/** Quantas semanas na fase antes de o app sugerir a Fase 2 (SPEC §5.1). */
export const SEMANAS_PARA_FASE2 = 12;
/** Quantas sessões de força concluídas antes de sugerir a Fase 2. */
export const SESSOES_PARA_FASE2 = 30;
/** Adiar a sugestão da Fase 2 por duas semanas. */
export const SEMANAS_DE_ADIAMENTO = 2;
/** Sessões de cardio numa semana civil para o plano avançar (SPEC §5.5). */
export const SESSOES_PARA_AVANCAR = 2;

/* ----------------------------------------------------------------- tipos */

export type Data = Date | string;

export type ExcecaoAgenda = Pick<
  LinhaExcecaoAgenda,
  "data" | "tipo" | "workout_id" | "sessao"
>;

export interface PerfilCalendario {
  fase_atual: FaseId;
  ultimo_treino: TreinoId | null;
  fase_desde?: string;
  semana_corrida?: number;
  semana_corda?: number;
  semana_fixa?: number;
  prefs?: Prefs;
}

export interface SessaoCardioDoDia {
  tipo: "corrida" | "corda" | "caminhada";
  /** O texto do programa ("corrida", "corrida ou corda", "corrida longa"). */
  sessao: string;
  permiteCorda: boolean;
  semana: number;
  corrida: SemanaCorrida | null;
  corda: EstagioCorda | null;
  descricao: string | null;
  min: number | null;
}

export interface DiaDoPlano {
  data: string;
  dia: DiaSemana;
  tipo: TipoDia;
  origem: "programa" | "override";
  fase: FaseId;
  treinoId: TreinoId | null;
  treino: Treino | null;
  cardio: SessaoCardioDoDia | null;
  nota: string | null;
  min: number | null;
}

export interface TipoDoDia {
  data: string;
  dia: DiaSemana;
  tipo: TipoDia;
  origem: "programa" | "override";
  programa: DiaPrograma;
  excecao: ExcecaoAgenda | null;
}

/* ------------------------------------------------------------ datas */

export function paraData(d: Data): Date {
  return typeof d === "string" ? parseISO(d) : d;
}

export function iso(d: Data): string {
  return format(paraData(d), "yyyy-MM-dd");
}

export function diaDaSemana(d: Data): DiaSemana {
  const i = (paraData(d).getDay() + 6) % 7; // 0 = segunda
  return DIAS[i] as DiaSemana;
}

/** A segunda-feira da semana de `d`. */
export function inicioDaSemana(d: Data): Date {
  return startOfWeek(paraData(d), SEMANA_COMECA);
}

/** Os sete dias da semana de `d`, de segunda a domingo. */
export function diasDaSemana(d: Data): Date[] {
  const seg = inicioDaSemana(d);
  return Array.from({ length: 7 }, (_, i) => addDays(seg, i));
}

/** Em que semana da fase estamos (a semana de `fase_desde` é a 1). */
export function semanaDaFase(d: Data, faseDesde: Data): number {
  return (
    differenceInCalendarWeeks(paraData(d), paraData(faseDesde), SEMANA_COMECA) + 1
  );
}

/* ------------------------------------------------- o que é hoje (§5.2) */

function excecaoDe(
  d: Data,
  overrides: ExcecaoAgenda[] = [],
): ExcecaoAgenda | null {
  const data = iso(d);
  return overrides.find((o) => o.data === data) ?? null;
}

export function tipoDoDia(
  d: Data,
  fase: FaseId,
  overrides: ExcecaoAgenda[] = [],
): TipoDoDia {
  const dia = diaDaSemana(d);
  const programa = diaDoPrograma(fase, dia);
  const excecao = excecaoDe(d, overrides);
  return {
    data: iso(d),
    dia,
    tipo: excecao ? excecao.tipo : programa.tipo,
    origem: excecao ? "override" : "programa",
    programa,
    excecao,
  };
}

/** Fase 1: o treino é sempre o que não foi o último (SPEC §5.2). */
export function proximoTreinoAlternado(ultimo: TreinoId | null): TreinoId {
  const fase = acharFase("fase1");
  const [a, b] = fase.treinos;
  if (!a) throw new Error("fase1 sem treinos");
  if (!b) return a;
  return ultimo === a ? b : a;
}

function treinoDoDia(
  fase: FaseId,
  programa: DiaPrograma,
  ultimo: TreinoId | null,
): TreinoId | null {
  if (fase === "fase1") return proximoTreinoAlternado(ultimo);
  const t = programa.treino;
  return t && t !== "alternar" ? t : null;
}

/** A sessão de cardio do dia, já com a semana do plano (SPEC §5.2 item 4). */
export function sessaoCardioDeHoje(
  d: Data,
  perfil: PerfilCalendario,
  overrides: ExcecaoAgenda[] = [],
): SessaoCardioDoDia | null {
  const info = tipoDoDia(d, perfil.fase_atual, overrides);
  if (info.tipo !== "cardio") return null;

  const texto = info.excecao?.sessao ?? info.programa.sessao ?? "";
  const temCorrida = /corrida/i.test(texto);
  const temCorda = /corda/i.test(texto);
  const tipo: SessaoCardioDoDia["tipo"] = temCorrida
    ? "corrida"
    : temCorda
      ? "corda"
      : /caminhada/i.test(texto)
        ? "caminhada"
        : "corrida";

  const semana =
    tipo === "corda"
      ? (perfil.semana_corda ?? 1)
      : (perfil.semana_corrida ?? 1);
  const plano = tipo === "corrida" ? semanaDeCorrida(semana) : null;

  return {
    tipo,
    sessao: texto,
    permiteCorda: temCorda,
    semana,
    corrida: plano,
    corda:
      tipo === "corda" || temCorda
        ? estagioDeCorda(perfil.semana_corda ?? 1)
        : null,
    descricao: plano?.descricao ?? null,
    min: info.programa.min ?? null,
  };
}

/** O que fazer hoje: tipo do dia, treino da vez ou sessão de cardio. */
export function treinoDeHoje(
  d: Data,
  perfil: PerfilCalendario,
  overrides: ExcecaoAgenda[] = [],
): DiaDoPlano {
  const info = tipoDoDia(d, perfil.fase_atual, overrides);
  return montarDia(info, perfil, overrides, perfil.ultimo_treino);
}

function montarDia(
  info: TipoDoDia,
  perfil: PerfilCalendario,
  overrides: ExcecaoAgenda[],
  ultimo: TreinoId | null,
): DiaDoPlano {
  let treinoId: TreinoId | null = null;
  if (info.tipo === "forca") {
    treinoId =
      info.excecao?.workout_id ??
      treinoDoDia(perfil.fase_atual, info.programa, ultimo);
  }
  return {
    data: info.data,
    dia: info.dia,
    tipo: info.tipo,
    origem: info.origem,
    fase: perfil.fase_atual,
    treinoId,
    treino: treinoId ? acharTreino(treinoId) : null,
    cardio:
      info.tipo === "cardio"
        ? sessaoCardioDeHoje(info.data, perfil, overrides)
        : null,
    nota: info.programa.nota ?? null,
    min: info.programa.min ?? null,
  };
}

/** A semana inteira (segunda a domingo), com a alternância encadeada. */
export function semanaDoPlano(
  d: Data,
  perfil: PerfilCalendario,
  overrides: ExcecaoAgenda[] = [],
): DiaDoPlano[] {
  let ultimo = perfil.ultimo_treino;
  return diasDaSemana(d).map((data) => {
    const info = tipoDoDia(data, perfil.fase_atual, overrides);
    const dia = montarDia(info, perfil, overrides, ultimo);
    if (dia.treinoId) ultimo = dia.treinoId;
    return dia;
  });
}

/* -------------------------------------------- semanas dos planos (§5.5) */

/**
 * O plano de cardio só avança quando as duas sessões da semana civil foram
 * concluídas; com 0 ou 1, repete a mesma semana (regra do guia).
 */
export function avancarSemanaCardio(
  semanaAtual: number,
  sessoesDaSemanaCivil: number,
  opcoes: { exigidas?: number; maximo?: number } = {},
): number {
  const exigidas = opcoes.exigidas ?? SESSOES_PARA_AVANCAR;
  if (sessoesDaSemanaCivil < exigidas) return semanaAtual;
  const maximo = opcoes.maximo ?? Number.POSITIVE_INFINITY;
  return Math.min(semanaAtual + 1, maximo);
}

export function avancarSemanaDeCorrida(
  semanaAtual: number,
  sessoes: number,
): number {
  return avancarSemanaCardio(semanaAtual, sessoes, {
    exigidas: cardio.corrida.sessoes_por_semana,
    maximo: cardio.corrida.semanas.length,
  });
}

export function avancarSemanaDeCorda(semanaAtual: number, sessoes: number): number {
  return avancarSemanaCardio(semanaAtual, sessoes, { maximo: 12 });
}

export function avancarSemanaDeBarraFixa(
  semanaAtual: number,
  sessoes: number,
): number {
  return avancarSemanaCardio(semanaAtual, sessoes, {
    exigidas: cardio.barra_fixa.sessoes_por_semana,
    maximo: 12,
  });
}

/* ------------------------------------------------ sugestão da Fase 2 §5.1 */

export interface SugestaoFase2 {
  sugerir: boolean;
  semanas: number;
  sessoes: number;
  adiadaAte: string | null;
}

/** Até quando a sugestão fica em silêncio depois de o usuário adiar. */
export function adiarFase2(hoje: Data): string {
  return iso(addWeeks(paraData(hoje), SEMANAS_DE_ADIAMENTO));
}

export function sugerirFase2(
  perfil: PerfilCalendario,
  sessoesConcluidas: number,
  hoje: Data,
): SugestaoFase2 {
  const desde = perfil.fase_desde ?? iso(hoje);
  const semanas = Math.max(
    0,
    differenceInCalendarWeeks(paraData(hoje), paraData(desde), SEMANA_COMECA),
  );
  const adiada = perfil.prefs?.["fase2_adiada_ate"];
  const adiadaAte = typeof adiada === "string" ? adiada : null;
  const emSilencio =
    adiadaAte !== null && isBefore(paraData(hoje), paraData(adiadaAte));

  return {
    sugerir:
      perfil.fase_atual === "fase1" &&
      !emSilencio &&
      semanas >= SEMANAS_PARA_FASE2 &&
      sessoesConcluidas >= SESSOES_PARA_FASE2,
    semanas,
    sessoes: sessoesConcluidas,
    adiadaAte,
  };
}

/* ----------------------------------------------------- semana curta §5.4 */

export interface Cortado {
  tipo: "forca" | "cardio";
  treinoId: TreinoId | null;
  sessao: string | null;
  dia: DiaSemana;
}

export interface ResultadoSemanaCurta {
  dias: DiaDoPlano[];
  cortados: Cortado[];
  /** Dias disponíveis para treinar depois do corte. */
  capacidade: number;
}

/**
 * Os treinos que têm agachamento ou terra — os que nunca são cortados.
 * Sai dos dados: qualquer exercício do treino cujo nome comece por
 * "agachamento" ou seja um levantamento terra.
 */
export function treinosComAgachamentoOuTerra(): TreinoId[] {
  const pesado = /^agachamento|terra/i;
  const ids: TreinoId[] = [];
  for (const fase of ["fase1", "fase2"] as const) {
    for (const id of acharFase(fase).treinos) {
      if (ids.includes(id)) continue;
      const tem = acharTreino(id).exercicios.some((e) =>
        pesado.test(acharExercicio(e.exercicio_id).nome),
      );
      if (tem) ids.push(id);
    }
  }
  return ids;
}

/**
 * Reorganiza a semana quando dias são marcados como "não vou treinar".
 * Mantém o que dá nos dias que sobraram e corta na ordem do guia:
 * 1º a corrida de sábado, 2º a outra sessão de cardio, 3º um treino de força —
 * nunca o que tem agachamento ou terra (se sobrar um dia, é o Treino A).
 */
export function semanaCurta(
  diaMarcadoComoNaoTreino: DiaSemana | DiaSemana[] | Data,
  semanaPlanejada: DiaDoPlano[],
): ResultadoSemanaCurta {
  const bruto = Array.isArray(diaMarcadoComoNaoTreino)
    ? diaMarcadoComoNaoTreino
    : [diaMarcadoComoNaoTreino];
  const indisponiveis = new Set<DiaSemana>(
    bruto.map((x) =>
      (DIAS as readonly string[]).includes(x as string)
        ? (x as DiaSemana)
        : diaDaSemana(x as Data),
    ),
  );

  const protegidos = treinosComAgachamentoOuTerra();
  const disponiveis = semanaPlanejada.filter((d) => !indisponiveis.has(d.dia));
  const capacidade = disponiveis.length;

  const atividades = semanaPlanejada.filter((d) => d.tipo !== "descanso");
  const cortados: Cortado[] = [];

  const cortar = (i: number) => {
    const d = atividades[i];
    if (!d) return;
    cortados.push({
      tipo: d.tipo === "forca" ? "forca" : "cardio",
      treinoId: d.treinoId,
      sessao: d.cardio?.sessao ?? null,
      dia: d.dia,
    });
    atividades.splice(i, 1);
  };

  const ultimoQue = (teste: (d: DiaDoPlano) => boolean): number => {
    for (let i = atividades.length - 1; i >= 0; i--) {
      const d = atividades[i];
      if (d && teste(d)) return i;
    }
    return -1;
  };

  while (atividades.length > capacidade) {
    // 1º e 2º: as sessões de cardio, da última da semana para a primeira
    let i = ultimoQue((d) => d.tipo === "cardio");
    // 3º: um treino de força que não tenha agachamento nem terra
    if (i < 0) {
      i = ultimoQue(
        (d) => d.tipo === "forca" && !protegidos.includes(d.treinoId as TreinoId),
      );
    }
    // por último, e só se não sobrar alternativa, um treino protegido
    if (i < 0) i = atividades.length - 1;
    if (i < 0) break;
    cortar(i);
  }

  // Quem pode, fica no próprio dia; o resto vai para o primeiro dia livre.
  const ocupado = new Map<DiaSemana, DiaDoPlano>();
  const sobrando: DiaDoPlano[] = [];
  for (const d of atividades) {
    if (!indisponiveis.has(d.dia)) ocupado.set(d.dia, d);
    else sobrando.push(d);
  }
  for (const d of sobrando) {
    const livre = disponiveis.find((x) => !ocupado.has(x.dia));
    if (!livre) continue;
    ocupado.set(livre.dia, { ...d, data: livre.data, dia: livre.dia });
  }

  const dias = semanaPlanejada.map((original) => {
    const posto = ocupado.get(original.dia);
    if (posto) return { ...posto, data: original.data, dia: original.dia };
    return {
      ...original,
      tipo: "descanso" as TipoDia,
      treinoId: null,
      treino: null,
      cardio: null,
      min: null,
    };
  });

  return { dias, cortados, capacidade };
}

/* --------------------------------------------- o que falta na semana */

export interface Realizado {
  data: string;
  tipo: "forca" | "cardio";
  concluida?: boolean;
}

export interface FaltaNaSemana {
  feitos: DiaDoPlano[];
  faltando: DiaDoPlano[];
  perdidos: DiaDoPlano[];
  total: number;
}

/** Separa a semana planejada em feito, ainda por fazer e perdido. */
export function oQueFaltaNaSemana(
  semanaPlanejada: DiaDoPlano[],
  realizados: Realizado[],
  hoje: Data,
): FaltaNaSemana {
  const dataHoje = iso(hoje);
  const feitos: DiaDoPlano[] = [];
  const faltando: DiaDoPlano[] = [];
  const perdidos: DiaDoPlano[] = [];

  for (const dia of semanaPlanejada) {
    if (dia.tipo === "descanso") continue;
    const fez = realizados.some(
      (r) => r.data === dia.data && r.tipo === dia.tipo && r.concluida !== false,
    );
    if (fez) feitos.push(dia);
    else if (dia.data < dataHoje) perdidos.push(dia);
    else faltando.push(dia);
  }

  return { feitos, faltando, perdidos, total: feitos.length + faltando.length + perdidos.length };
}
