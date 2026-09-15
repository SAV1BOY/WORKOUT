/**
 * Agregações da tela de progresso (SPEC §3.7).
 *
 * Tudo aqui é função pura sobre as linhas cruas do banco: nenhuma importa
 * React, Supabase ou Dexie. Quem busca as linhas é `lib/queries/progresso.ts`;
 * quem desenha é `components/progresso/`. Assim a conta é testável (Vitest) e
 * a tela não decide nada sozinha.
 */
import { addDays, differenceInCalendarDays } from "date-fns";
import { inicioDaSemana, iso, paraData, semanaDoPlano } from "@/lib/calendario";
import type { ExcecaoAgenda, PerfilCalendario } from "@/lib/calendario";
import { exercicios } from "@/lib/dados";
import type {
  LinhaBarraFixaSolta,
  LinhaRecorde,
  LinhaSerie,
  LinhaSessao,
  LinhaSessaoCardio,
} from "@/lib/types";

/* ------------------------------------------------------------- tipos */

export type SerieBruta = Pick<
  LinhaSerie,
  | "exercise_id"
  | "session_id"
  | "set_index"
  | "tipo"
  | "reps"
  | "reps_lado2"
  | "carga_kg"
  | "tempo_s"
  | "tempo_s_lado2"
  | "passos"
  | "assistencia"
  | "concluida"
  | "registrada_em"
>;

export type SessaoBruta = Pick<LinhaSessao, "id" | "data" | "status" | "workout_id">;
export type SoltaBruta = Pick<LinhaBarraFixaSolta, "data" | "reps">;
export type CardioBruto = Pick<
  LinhaSessaoCardio,
  "data" | "tipo" | "duracao_min" | "distancia_km" | "feito" | "concluida"
>;

/** Um ponto de qualquer gráfico semanal: a segunda-feira e o valor. */
export interface PontoSemanal {
  inicio: string;
  rotulo: string;
  valor: number;
}

/* ------------------------------------------------------------ datas */

/** A data (dd) de cada sessão, para carimbar as séries. */
export function datasDasSessoes(
  sessoes: readonly SessaoBruta[],
): ReadonlyMap<string, string> {
  return new Map(sessoes.map((s) => [s.id, s.data]));
}

/**
 * O dia de uma série. Vem da sessão; sem ela (a sessão pode estar fora da
 * janela lida) cai no dia de `registrada_em`, que é sempre dela mesma.
 *
 * `registrada_em` é `timestamptz`, então vem em UTC: fatiar os 10 primeiros
 * caracteres jogaria a série das 22 h de Nova Lima (UTC−3) para o dia seguinte.
 * O dia é sempre o do relógio de quem treinou.
 */
export function dataDaSerie(
  serie: SerieBruta,
  porSessao: ReadonlyMap<string, string>,
): string {
  const daSessao = porSessao.get(serie.session_id);
  if (daSessao) return daSessao;
  const bruto = String(serie.registrada_em);
  const quando = new Date(bruto);
  return Number.isNaN(quando.getTime()) ? bruto.slice(0, 10) : iso(quando);
}

/** As segundas-feiras das últimas `semanas` semanas, da mais antiga para hoje. */
export function semanasAte(hoje: string | Date, semanas: number): string[] {
  const primeira = addDays(inicioDaSemana(hoje), -7 * (semanas - 1));
  return Array.from({ length: semanas }, (_, i) => iso(addDays(primeira, 7 * i)));
}

/** dd/MM da segunda-feira — o rótulo curto do eixo x. */
export function rotuloDaSemana(inicio: string): string {
  const d = paraData(inicio);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Em que semana da lista o dia cai (−1 quando está fora da janela). */
function indiceDaSemana(data: string, semanas: readonly string[]): number {
  const inicio = iso(inicioDaSemana(data));
  return semanas.indexOf(inicio);
}

function pontos(semanas: readonly string[], valores: number[]): PontoSemanal[] {
  return semanas.map((inicio, i) => ({
    inicio,
    rotulo: rotuloDaSemana(inicio),
    valor: valores[i] ?? 0,
  }));
}

/* --------------------------------------------------- séries e volume */

/** Uma série conta para o volume? (SPEC §3.7: só as de trabalho concluídas) */
export function serieDeTrabalho(s: SerieBruta): boolean {
  return s.concluida && s.tipo === "trabalho";
}

/** As repetições de uma série; no unilateral, os dois lados somados. */
export function repsDaSerie(s: SerieBruta): number {
  return (s.reps ?? 0) + (s.reps_lado2 ?? 0);
}

/** Volume de uma série: Σ reps × kg. Peso do corpo (0 kg) não soma volume. */
export function volumeDaSerie(s: SerieBruta): number {
  if (!serieDeTrabalho(s)) return 0;
  return repsDaSerie(s) * (s.carga_kg ?? 0);
}

/** Volume por semana (SPEC §3.7: 12 semanas), incluindo as semanas vazias. */
export function volumePorSemana(
  series: readonly SerieBruta[],
  porSessao: ReadonlyMap<string, string>,
  opcoes: { hoje: string | Date; semanas?: number },
): PontoSemanal[] {
  const lista = semanasAte(opcoes.hoje, opcoes.semanas ?? 12);
  const valores = new Array<number>(lista.length).fill(0);
  for (const s of series) {
    const volume = volumeDaSerie(s);
    if (volume === 0) continue;
    const i = indiceDaSemana(dataDaSerie(s, porSessao), lista);
    if (i >= 0) valores[i] = (valores[i] ?? 0) + volume;
  }
  return pontos(
    lista,
    valores.map((v) => Math.round(v)),
  );
}

/** O volume da semana civil de hoje (o card da SPEC §3.7). */
export function volumeDaSemana(
  series: readonly SerieBruta[],
  porSessao: ReadonlyMap<string, string>,
  hoje: string | Date,
): number {
  const ponto = volumePorSemana(series, porSessao, { hoje, semanas: 1 })[0];
  return ponto?.valor ?? 0;
}

/* -------------------------------------------------- treinos e aderência */

export interface TreinosConcluidos {
  semana: number;
  mes: number;
  total: number;
}

/** Treinos de força concluídos na semana civil, no mês e no total (§3.7). */
export function treinosConcluidos(
  sessoes: readonly SessaoBruta[],
  hoje: string | Date,
): TreinosConcluidos {
  const concluidas = sessoes.filter((s) => s.status === "concluida");
  const inicio = iso(inicioDaSemana(hoje));
  const fim = iso(addDays(paraData(inicio), 6));
  const mes = iso(hoje).slice(0, 7);
  return {
    semana: concluidas.filter((s) => s.data >= inicio && s.data <= fim).length,
    mes: concluidas.filter((s) => s.data.slice(0, 7) === mes).length,
    total: concluidas.length,
  };
}

export interface SemanaDeAderencia {
  inicio: string;
  rotulo: string;
  planejados: number;
  feitos: number;
}

export interface Aderencia {
  planejados: number;
  feitos: number;
  /** 0–100, arredondado; 0 quando não havia nada planejado ainda. */
  percentual: number;
  semanas: SemanaDeAderencia[];
  /**
   * A janela começou nesta data porque a fase atual começou aí (`fase_desde`)
   * — a tela mostra "desde dd/MM". `null` quando as 4 semanas couberam
   * inteiras dentro da fase.
   */
  desde: string | null;
}

/**
 * Aderência (SPEC §3.7): dias feitos ÷ dias planejados nas últimas 4 semanas.
 *
 * O planejado sai de `lib/calendario` (o programa + as trocas do calendário),
 * então descanso não entra na conta. Só contam os dias que já passaram e que
 * são posteriores ao início do programa — o futuro não é falta.
 *
 * A janela também não passa de `profiles.fase_desde`: as semanas antigas
 * seriam remontadas com a grade da fase de HOJE (não existe histórico de plano
 * no banco), e a aderência já mostrada mudaria sozinha na virada de fase. Onde
 * isso corta, o resultado diz `desde` e a tela escreve "desde dd/MM".
 */
export function aderencia(opcoes: {
  hoje: string | Date;
  perfil: PerfilCalendario & { data_inicio?: string };
  overrides?: readonly ExcecaoAgenda[];
  sessoes: readonly SessaoBruta[];
  cardios: readonly CardioBruto[];
  semanas?: number;
}): Aderencia {
  const { hoje, perfil, overrides = [], sessoes, cardios } = opcoes;
  const lista = semanasAte(hoje, opcoes.semanas ?? 4);
  const hojeIso = iso(hoje);
  const inicioDoPrograma = perfil.data_inicio ?? null;

  // §5.1: a fase de hoje não descreve as semanas da fase anterior
  const desdeAFase = perfil.fase_desde ?? null;
  const inicioDaJanela = [inicioDoPrograma, desdeAFase]
    .filter((d): d is string => d !== null)
    .sort()
    .pop() ?? null;

  const forcaFeita = new Set(
    sessoes.filter((s) => s.status === "concluida").map((s) => s.data),
  );
  const cardioFeito = new Set(cardios.filter((c) => c.concluida).map((c) => c.data));

  const semanas: SemanaDeAderencia[] = lista.map((inicio) => {
    const dias = semanaDoPlano(inicio, perfil, [...overrides]);
    let planejados = 0;
    let feitos = 0;
    for (const dia of dias) {
      if (dia.tipo === "descanso") continue;
      if (dia.data > hojeIso) continue;
      if (inicioDaJanela && dia.data < inicioDaJanela) continue;
      planejados += 1;
      const fez = dia.tipo === "forca" ? forcaFeita.has(dia.data) : cardioFeito.has(dia.data);
      if (fez) feitos += 1;
    }
    return { inicio, rotulo: rotuloDaSemana(inicio), planejados, feitos };
  });

  const planejados = semanas.reduce((t, s) => t + s.planejados, 0);
  const feitos = semanas.reduce((t, s) => t + s.feitos, 0);
  const primeiraSemana = lista[0] ?? hojeIso;
  return {
    planejados,
    feitos,
    percentual: planejados === 0 ? 0 : Math.round((feitos / planejados) * 100),
    semanas,
    /*
     * Só vale dizer "desde" quando quem encurtou a janela foi a troca de fase:
     * cortar pelo início do programa já é o esperado nas primeiras semanas.
     */
    desde:
      desdeAFase &&
      desdeAFase > iso(primeiraSemana) &&
      (!inicioDoPrograma || desdeAFase > inicioDoPrograma)
        ? desdeAFase
        : null,
  };
}

/* ------------------------------------------------- carga por sessão */

export interface PontoDeCarga {
  data: string;
  rotulo: string;
  carga: number;
  reps: number;
  e1rm: number;
}

/** e1RM de Epley — a mesma conta da view `v_records`. */
export function e1rmEpley(carga: number, reps: number): number {
  return Math.round(carga * (1 + reps / 30) * 10) / 10;
}

/**
 * Carga × data de um exercício (SPEC §3.6 e §3.7): a série de trabalho mais
 * pesada de cada sessão, da mais antiga para a mais nova. Funciona com 1 e
 * com 30 pontos.
 */
export function cargaPorSessao(
  series: readonly SerieBruta[],
  porSessao: ReadonlyMap<string, string>,
  exercicioId: string,
): PontoDeCarga[] {
  const melhor = new Map<string, { carga: number; reps: number }>();
  for (const s of series) {
    if (s.exercise_id !== exercicioId || !serieDeTrabalho(s)) continue;
    const data = dataDaSerie(s, porSessao);
    const carga = s.carga_kg ?? 0;
    const reps = s.reps ?? 0;
    const atual = melhor.get(data);
    if (!atual || carga > atual.carga || (carga === atual.carga && reps > atual.reps)) {
      melhor.set(data, { carga, reps });
    }
  }
  return [...melhor.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, v]) => ({
      data,
      rotulo: rotuloDaSemana(data),
      carga: v.carga,
      reps: v.reps,
      e1rm: e1rmEpley(v.carga, v.reps),
    }));
}

export interface SessaoDoExercicio {
  data: string;
  sessionId: string;
  /** As séries de trabalho daquele dia, na ordem em que foram feitas. */
  series: SerieBruta[];
}

/**
 * As últimas sessões em que o exercício apareceu (SPEC §3.6: "últimas 10
 * sessões"), da mais nova para a mais antiga, com as séries de trabalho na
 * ordem do treino.
 */
export function sessoesDoExercicio(
  series: readonly SerieBruta[],
  porSessao: ReadonlyMap<string, string>,
  exercicioId: string,
  limite = 10,
): SessaoDoExercicio[] {
  const dias = new Map<string, SessaoDoExercicio>();
  for (const s of series) {
    if (s.exercise_id !== exercicioId || !serieDeTrabalho(s)) continue;
    const data = dataDaSerie(s, porSessao);
    const chave = `${data}|${s.session_id}`;
    let dia = dias.get(chave);
    if (!dia) {
      dia = { data, sessionId: s.session_id, series: [] };
      dias.set(chave, dia);
    }
    dia.series.push(s);
  }
  return [...dias.values()]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, limite)
    .map((d) => ({ ...d, series: [...d.series].sort((a, b) => a.set_index - b.set_index) }));
}

/* ------------------------------------------------ barra fixa e corrida */

/** Os exercícios que penduram na barra fixa (implemento `barra_fixa`). */
export function idsDeBarraFixa(): ReadonlySet<string> {
  return new Set(exercicios.filter((e) => e.implemento === "barra_fixa").map((e) => e.id));
}

export interface SemanaDeBarraFixa {
  inicio: string;
  rotulo: string;
  series: number;
  soltas: number;
  total: number;
}

/** Reps de barra fixa por semana: as das séries mais as soltas (SPEC §3.7). */
export function barraFixaPorSemana(
  series: readonly SerieBruta[],
  porSessao: ReadonlyMap<string, string>,
  soltas: readonly SoltaBruta[],
  opcoes: { hoje: string | Date; semanas?: number; ids?: ReadonlySet<string> },
): SemanaDeBarraFixa[] {
  const lista = semanasAte(opcoes.hoje, opcoes.semanas ?? 12);
  const ids = opcoes.ids ?? idsDeBarraFixa();
  const deSerie = new Array<number>(lista.length).fill(0);
  const deSolta = new Array<number>(lista.length).fill(0);

  for (const s of series) {
    if (!ids.has(s.exercise_id) || !serieDeTrabalho(s)) continue;
    const i = indiceDaSemana(dataDaSerie(s, porSessao), lista);
    if (i >= 0) deSerie[i] = (deSerie[i] ?? 0) + repsDaSerie(s);
  }
  for (const s of soltas) {
    const i = indiceDaSemana(s.data, lista);
    if (i >= 0) deSolta[i] = (deSolta[i] ?? 0) + s.reps;
  }

  return lista.map((inicio, i) => ({
    inicio,
    rotulo: rotuloDaSemana(inicio),
    series: deSerie[i] ?? 0,
    soltas: deSolta[i] ?? 0,
    total: (deSerie[i] ?? 0) + (deSolta[i] ?? 0),
  }));
}

/**
 * Minutos **correndo** de uma sessão: a soma dos blocos de corrida que o timer
 * registrou em `feito` (SPEC §3.3). Sem os blocos (sessão importada, caminhada
 * cronometrada) cai na duração total.
 */
export function minutosCorrendo(linha: CardioBruto): number {
  const feito = linha.feito as { blocos?: { tipo?: string | null; s?: number }[] } | null;
  const blocos = feito?.blocos;
  if (Array.isArray(blocos)) {
    const s = blocos
      .filter((b) => b?.tipo === "corrida")
      .reduce((t, b) => t + (b.s ?? 0), 0);
    if (s > 0) return Math.round((s / 60) * 10) / 10;
  }
  return linha.duracao_min ?? 0;
}

export interface SemanaDeCorrida {
  inicio: string;
  rotulo: string;
  minutos: number;
  km: number;
}

/** Corrida por semana: minutos correndo e km (SPEC §3.7). */
export function corridaPorSemana(
  cardios: readonly CardioBruto[],
  opcoes: { hoje: string | Date; semanas?: number },
): SemanaDeCorrida[] {
  const lista = semanasAte(opcoes.hoje, opcoes.semanas ?? 12);
  const minutos = new Array<number>(lista.length).fill(0);
  const km = new Array<number>(lista.length).fill(0);

  for (const c of cardios) {
    if (c.tipo !== "corrida" || !c.concluida) continue;
    const i = indiceDaSemana(c.data, lista);
    if (i < 0) continue;
    minutos[i] = (minutos[i] ?? 0) + minutosCorrendo(c);
    km[i] = (km[i] ?? 0) + (c.distancia_km ?? 0);
  }

  return lista.map((inicio, i) => ({
    inicio,
    rotulo: rotuloDaSemana(inicio),
    minutos: Math.round((minutos[i] ?? 0) * 10) / 10,
    km: Math.round((km[i] ?? 0) * 100) / 100,
  }));
}

/* ---------------------------------------------------------- recordes */

export type TipoDeRecorde = "carga" | "reps" | "tempo";

export interface RecordeRecente {
  exercise_id: string;
  tipo: TipoDeRecorde;
  valor: number;
  data: string;
  /** Repetições da série que fez o recorde de carga (para o e1RM). */
  reps: number | null;
}

/**
 * Recordes batidos nos últimos `dias` (SPEC §3.7, card "recordes recentes").
 *
 * Para cada exercício, o melhor valor de todas as séries e o **primeiro** dia
 * em que ele apareceu: se esse dia é recente, o recorde é recente. Exercício
 * com carga vira recorde de carga; sem carga, de repetições ou de tempo.
 */
export function recordesRecentes(
  series: readonly SerieBruta[],
  porSessao: ReadonlyMap<string, string>,
  opcoes: { hoje: string | Date; dias?: number },
): RecordeRecente[] {
  const limite = iso(addDays(paraData(opcoes.hoje), -(opcoes.dias ?? 30)));
  const melhores = new Map<string, RecordeRecente>();

  const considerar = (
    id: string,
    tipo: TipoDeRecorde,
    valor: number,
    data: string,
    reps: number | null,
  ) => {
    if (valor <= 0) return;
    const chave = `${id}|${tipo}`;
    const atual = melhores.get(chave);
    if (!atual || valor > atual.valor) {
      melhores.set(chave, { exercise_id: id, tipo, valor, data, reps });
      return;
    }
    // mesmo valor num dia anterior: o recorde nasceu antes
    if (valor === atual.valor && data < atual.data) {
      melhores.set(chave, { ...atual, data, reps });
    }
  };

  for (const s of series) {
    if (!serieDeTrabalho(s)) continue;
    const data = dataDaSerie(s, porSessao);
    const carga = s.carga_kg ?? 0;
    if (carga > 0) considerar(s.exercise_id, "carga", carga, data, s.reps ?? 0);
    else if ((s.tempo_s ?? 0) > 0) {
      considerar(s.exercise_id, "tempo", s.tempo_s ?? 0, data, null);
    } else considerar(s.exercise_id, "reps", s.reps ?? 0, data, s.reps ?? 0);
  }

  return [...melhores.values()]
    .filter((r) => r.data >= limite)
    .sort((a, b) => b.data.localeCompare(a.data));
}

export interface RecordeNaLista extends LinhaRecorde {
  nome: string;
}

/** A lista de recordes da `v_records` com o nome do exercício, por nome. */
export function ordenarRecordes(
  recordes: readonly LinhaRecorde[],
  nomePorId: ReadonlyMap<string, string>,
): RecordeNaLista[] {
  return recordes
    .map((r) => ({ ...r, nome: nomePorId.get(r.exercise_id) ?? r.exercise_id }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Há quantos dias foi o último treino (para o card "treinos concluídos"). */
export function diasDesde(data: string | null, hoje: string | Date): number | null {
  if (!data) return null;
  return differenceInCalendarDays(paraData(hoje), paraData(data));
}
