/**
 * Conquistas (SPEC §19.3) — marcos reais dos registros, não pontos.
 *
 * Funções puras: sem React, sem Supabase, sem Dexie. Cada conquista é
 * **derivada** das linhas do banco e devolve a data do registro que a fechou e
 * o que falta para as que ainda não fecharam. Nome de treino, exercício e
 * plano saem dos JSON por `lib/dados.ts`; os limiares (1 · 10 · 25…) são a
 * definição da conquista, que é da SPEC §19, não conteúdo de treino.
 *
 * Gamificação sóbria (§7, §13.1 e §19): sem confete, sem som, sem pontos, sem
 * níveis, sem ranking. O que sobe é o número real.
 */
import { differenceInCalendarDays } from "date-fns";
import { inicioDaSemana, iso, paraData } from "@/lib/calendario";
import { acharExercicio } from "@/lib/dados";
import { formatarNumero } from "@/lib/formato";
import { EXERCICIOS_DE_BARRA_FIXA, type CardioContavel } from "@/lib/numeros";
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
import type { FaseId } from "@/lib/schemas";
import type { LinhaBarraFixaSolta, Prefs } from "@/lib/types";

/* --------------------------------------------------------------- tipos */

export type GrupoDeConquista =
  | "forca"
  | "constancia"
  | "cardio"
  | "barra_fixa"
  | "carga"
  | "volume"
  | "programa";

/** O ícone lucide da conquista; quem resolve o componente é a tela. */
export type IconeDaConquista =
  | "Dumbbell"
  | "Flame"
  | "CalendarCheck"
  | "Footprints"
  | "Timer"
  | "Route"
  | "Zap"
  | "ChevronsUp"
  | "Weight"
  | "Layers"
  | "Trophy";

export type Unidade =
  | "treinos"
  | "semanas"
  | "dias"
  | "sessoes"
  | "minutos"
  | "km"
  | "saltos"
  | "reps"
  | "kg"
  | "nenhuma";

export interface Conquista {
  id: string;
  /** Curto — cabe numa das três colunas a 360 px (SPEC §19.4). */
  nome: string;
  descricao: string;
  /** A frase da regra, mostrada na folha de detalhe. */
  regra: string;
  icone: IconeDaConquista;
  grupo: GrupoDeConquista;
  alvo: number;
  unidade: Unidade;
}

export interface ConquistaAvaliada extends Conquista {
  atingida: boolean;
  /** A data do registro que a fechou (`null` enquanto não fechou). */
  em: string | null;
  atual: number;
  /** "faltam 3 treinos" — `null` quando já foi conquistada. */
  falta: string | null;
}

/** A solta com a assistência (para a primeira repetição sem elástico). */
export type SoltaContavel = SoltaBruta &
  Partial<Pick<LinhaBarraFixaSolta, "assistencia">>;

export interface DadosDasConquistas {
  sessoes?: readonly SessaoBruta[];
  series?: readonly SerieBruta[];
  cardios?: readonly CardioContavel[];
  soltas?: readonly SoltaContavel[];
  /** A meta semanal em uso (`lib/metas.ts`), para as semanas seguidas. */
  meta: number;
  /** Sessões planejadas numa semana (força + cardio da fase, SPEC §17.3). */
  planejadasNaSemana: number;
  fase: { atual: FaseId; desde: string };
}

/* ------------------------------------------------------ dados auxiliares */

/**
 * "Agachamento ou terra" (SPEC §19.3): os cinco exercícios de barra maciça do
 * catálogo cujo padrão é agachar ou levantar do chão. Os ids são referências ao
 * catálogo — `acharExercicio` quebra alto se algum sumir do JSON.
 */
export const EXERCICIOS_DE_CARGA: ReadonlySet<string> = new Set(
  [
    "agachamento-livre",
    "agachamento-frontal",
    "agachamento-sumo",
    "levantamento-terra",
    "stiff-terra-romeno",
  ].map((id) => acharExercicio(id).id),
);

/** A barra fixa assistida é a única do catálogo que nasce com elástico. */
const ASSISTIDA = "barra-fixa-assistida";

/**
 * Sem elástico (SPEC §19.3): a assistência registrada é `"sem"`, ou não há
 * assistência registrada num exercício que não é a barra fixa assistida
 * (a pronada, a supinada e a com lastro não têm elástico por definição).
 */
function semElastico(
  assistencia: string | null | undefined,
  exercicioId: string,
): boolean {
  if (assistencia === "sem") return true;
  return (
    (assistencia === null || assistencia === undefined) && exercicioId !== ASSISTIDA
  );
}

interface BlocoFeito {
  tipo?: unknown;
  s?: unknown;
}

/** Os blocos de `cardio_sessions.feito` (jsonb), sem confiar no formato. */
function blocosDe(cardio: CardioContavel): BlocoFeito[] {
  const feito = cardio.feito;
  if (!feito || typeof feito !== "object") return [];
  const brutos = (feito as { blocos?: unknown }).blocos;
  if (!Array.isArray(brutos)) return [];
  return brutos.filter((b): b is BlocoFeito => Boolean(b) && typeof b === "object");
}

function segundosDoBloco(bloco: BlocoFeito): number {
  return typeof bloco.s === "number" && Number.isFinite(bloco.s) ? bloco.s : 0;
}

/** O maior bloco contínuo de corrida da sessão, em minutos. */
export function maiorBlocoDeCorridaMin(cardio: CardioContavel): number {
  const maior = blocosDe(cardio)
    .filter((b) => b.tipo === "corrida")
    .reduce((t, b) => Math.max(t, segundosDoBloco(b)), 0);
  return maior / 60;
}

/** Sem parar: nenhum bloco de caminhada no meio (SPEC §19.3). */
export function correuSemParar(cardio: CardioContavel): boolean {
  return !blocosDe(cardio).some(
    (b) => b.tipo === "caminhada" && segundosDoBloco(b) > 0,
  );
}

/* ------------------------------------------------- as três formas de medir */

export interface Medida {
  atual: number;
  em: string | null;
  /** Alvo real, quando ele só se sabe com os dados na mão (Semana completa). */
  alvo?: number;
}

interface Registro {
  data: string;
  valor: number;
}

function porData(a: Registro, b: Registro): number {
  return a.data.localeCompare(b.data);
}

/** Acumulado: a data é a do registro em que a soma alcançou o alvo. */
export function acumulado(registros: readonly Registro[], alvo: number): Medida {
  let soma = 0;
  let em: string | null = null;
  for (const r of [...registros].sort(porData)) {
    soma += r.valor;
    if (em === null && soma >= alvo) em = r.data;
  }
  return { atual: soma, em };
}

/** Melhor registro: a data é a do primeiro que sozinho alcançou o alvo. */
export function melhor(registros: readonly Registro[], alvo: number): Medida {
  let atual = 0;
  let em: string | null = null;
  for (const r of [...registros].sort(porData)) {
    if (r.valor > atual) atual = r.valor;
    if (em === null && r.valor >= alvo) em = r.data;
  }
  return { atual, em };
}

/** As sequências já feitas: a maior e em que dia cada tamanho foi alcançado. */
export interface Sequencias {
  melhor: number;
  /** tamanho da sequência → data do registro que a fechou */
  em: ReadonlyMap<number, string>;
}

/**
 * Sequências de passos iguais: `seguidos` diz se dois vizinhos são
 * consecutivos, e `fechaEm` dá a data que carimba o passo.
 */
function sequencias<T>(
  passos: readonly T[],
  seguidos: (anterior: T, atual: T) => boolean,
  fechaEm: (passo: T) => string,
): Sequencias {
  const em = new Map<number, string>();
  let corrida = 0;
  let maior = 0;
  let anterior: T | null = null;

  for (const passo of passos) {
    corrida = anterior !== null && seguidos(anterior, passo) ? corrida + 1 : 1;
    if (corrida > maior) maior = corrida;
    if (!em.has(corrida)) em.set(corrida, fechaEm(passo));
    anterior = passo;
  }

  return { melhor: maior, em };
}

function medidaDaSequencia(seq: Sequencias, alvo: number): Medida {
  let em: string | null = null;
  for (const [tamanho, data] of seq.em) {
    if (tamanho < alvo) continue;
    if (em === null || data < em) em = data;
  }
  return { atual: seq.melhor, em };
}

/* ------------------------------------------------------------- contexto */

interface SemanaFeita {
  inicio: string;
  feitos: number;
  ultimaAtividade: string;
}

interface Contexto {
  /** Sessões de força concluídas (barra fixa fora), uma por data. */
  forca: Registro[];
  volume: Registro[];
  carga: Registro[];
  seriesDeBarraFixa: Registro[];
  barraSemElastico: Registro[];
  soltas: Registro[];
  corridas: CardioContavel[];
  cordas: CardioContavel[];
  diasSeguidos: Sequencias;
  semanasSeguidas: Sequencias;
  semanas: SemanaFeita[];
  planejadasNaSemana: number;
  fase: { atual: FaseId; desde: string };
}

function montarSemanas(
  sessoes: readonly SessaoBruta[],
  cardios: readonly CardioContavel[],
): SemanaFeita[] {
  const porSemana = new Map<string, { feitos: number; ultima: string }>();
  const somar = (data: string) => {
    const inicio = iso(inicioDaSemana(data));
    const atual = porSemana.get(inicio) ?? { feitos: 0, ultima: data };
    porSemana.set(inicio, {
      feitos: atual.feitos + 1,
      ultima: data > atual.ultima ? data : atual.ultima,
    });
  };
  for (const s of sessoes) if (s.status === "concluida") somar(s.data);
  for (const c of cardios) if (c.concluida) somar(c.data);

  return [...porSemana.entries()]
    .map(([inicio, v]) => ({ inicio, feitos: v.feitos, ultimaAtividade: v.ultima }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

function montarContexto(dados: DadosDasConquistas): Contexto {
  const sessoes = dados.sessoes ?? [];
  const series = dados.series ?? [];
  const cardios = dados.cardios ?? [];
  const soltas = dados.soltas ?? [];

  const porSessao = datasDasSessoes(sessoes);
  const feitas = series.filter((s) => s.concluida);

  const deBarraFixa = feitas
    .filter((s) => EXERCICIOS_DE_BARRA_FIXA.has(s.exercise_id))
    .map((s) => ({
      data: dataDaSerie(s, porSessao),
      valor: repsDaSerie(s),
      exercicio: s.exercise_id,
      assistencia: s.assistencia,
    }));

  /* dias com alguma sessão concluída, em ordem e sem repetição */
  const dias = new Set<string>();
  for (const s of sessoes) if (s.status === "concluida") dias.add(s.data);
  for (const c of cardios) if (c.concluida) dias.add(c.data);
  const ordenados = [...dias].sort();

  const semanas = montarSemanas(sessoes, cardios);
  const comMeta = semanas.filter((s) => s.feitos >= dados.meta && dados.meta >= 1);

  return {
    forca: sessoes
      .filter((s) => s.status === "concluida" && s.workout_id !== "fixa")
      .map((s) => ({ data: s.data, valor: 1 })),
    volume: feitas
      .filter(serieDeTrabalho)
      .map((s) => ({ data: dataDaSerie(s, porSessao), valor: volumeDaSerie(s) })),
    carga: feitas
      .filter((s) => serieDeTrabalho(s) && EXERCICIOS_DE_CARGA.has(s.exercise_id))
      .map((s) => ({ data: dataDaSerie(s, porSessao), valor: s.carga_kg ?? 0 })),
    seriesDeBarraFixa: deBarraFixa.map(({ data, valor }) => ({ data, valor })),
    barraSemElastico: [
      ...deBarraFixa
        .filter((s) => semElastico(s.assistencia, s.exercicio))
        .map(({ data, valor }) => ({ data, valor })),
      /*
       * A repetição solta não tem exercício: o "+1" do dia de descanso grava
       * só a data e as reps. Então ela só conta como sem elástico quando a
       * assistência foi registrada explicitamente como "sem".
       */
      ...soltas
        .filter((s) => s.assistencia === "sem")
        .map((s) => ({ data: s.data, valor: s.reps })),
    ],
    soltas: soltas.map((s) => ({ data: s.data, valor: s.reps })),
    corridas: cardios.filter((c) => c.concluida && c.tipo === "corrida"),
    cordas: cardios.filter((c) => c.concluida && c.tipo === "corda"),
    diasSeguidos: sequencias(
      ordenados,
      (antes, agora) =>
        differenceInCalendarDays(paraData(agora), paraData(antes)) === 1,
      (dia) => dia,
    ),
    semanasSeguidas: sequencias(
      comMeta,
      (antes, agora) =>
        differenceInCalendarDays(paraData(agora.inicio), paraData(antes.inicio)) === 7,
      (semana) => semana.ultimaAtividade,
    ),
    semanas,
    planejadasNaSemana: dados.planejadasNaSemana,
    fase: dados.fase,
  };
}

/* ------------------------------------------------------ a lista (SPEC §19.3) */

interface Definicao extends Conquista {
  medir: (c: Contexto) => Medida;
}

function deForca(alvo: number, nome: string, descricao: string): Definicao {
  return {
    id: `forca-${alvo}`,
    nome,
    descricao,
    regra: `${alvo} ${alvo === 1 ? "sessão de força concluída" : "sessões de força concluídas"} (treinos do programa e sessões livres).`,
    icone: "Dumbbell",
    grupo: "forca",
    alvo,
    unidade: "treinos",
    medir: (c) => acumulado(c.forca, alvo),
  };
}

function deSemanas(alvo: number): Definicao {
  return {
    id: `semanas-${alvo}`,
    nome: `${alvo} semanas`,
    descricao: `${alvo} semanas seguidas cumprindo a meta semanal.`,
    regra: `${alvo} semanas civis seguidas (segunda a domingo) com a meta semanal cumprida.`,
    icone: "CalendarCheck",
    grupo: "constancia",
    alvo,
    unidade: "semanas",
    medir: (c) => medidaDaSequencia(c.semanasSeguidas, alvo),
  };
}

function deDias(alvo: number): Definicao {
  return {
    id: `dias-${alvo}`,
    nome: `${alvo} dias seguidos`,
    descricao: `${alvo} dias de calendário seguidos com alguma sessão concluída.`,
    regra: `${alvo} dias seguidos com pelo menos uma sessão concluída — de força, de cardio ou de barra fixa.`,
    icone: "Flame",
    grupo: "constancia",
    alvo,
    unidade: "dias",
    medir: (c) => medidaDaSequencia(c.diasSeguidos, alvo),
  };
}

function deVolume(alvo: number, nome: string): Definicao {
  return {
    id: `volume-${alvo / 1000}k`,
    nome,
    descricao: `${formatarNumero(alvo)} kg levantados somando todas as séries de trabalho.`,
    regra: `Soma de repetições × carga das séries de trabalho concluídas chega a ${formatarNumero(alvo)} kg.`,
    icone: "Layers",
    grupo: "volume",
    alvo,
    unidade: "kg",
    medir: (c) => acumulado(c.volume, alvo),
  };
}

function deCarga(alvo: number): Definicao {
  return {
    id: `carga-${alvo}`,
    nome: `${alvo} kg na barra`,
    descricao: `Agachamento ou terra com ${alvo} kg de carga total na barra.`,
    regra: `Uma série de trabalho concluída de agachamento (livre, frontal ou sumô), levantamento terra ou stiff com carga total na barra de ${alvo} kg ou mais.`,
    icone: "Weight",
    grupo: "carga",
    alvo,
    unidade: "kg",
    medir: (c) => melhor(c.carga, alvo),
  };
}

function deBarraNaSerie(alvo: number): Definicao {
  return {
    id: `fixa-${alvo}`,
    nome: `${alvo} numa série`,
    descricao: `${alvo} repetições de barra fixa numa única série.`,
    regra: `Uma série concluída de barra fixa com ${alvo} repetições ou mais.`,
    icone: "ChevronsUp",
    grupo: "barra_fixa",
    alvo,
    unidade: "reps",
    medir: (c) => melhor(c.seriesDeBarraFixa, alvo),
  };
}

/** As 26 conquistas da SPEC §19.3, na ordem em que aparecem na grade. */
const DEFINICOES: readonly Definicao[] = [
  deForca(1, "Primeiro treino", "A primeira sessão de força concluída."),
  deForca(10, "10 treinos", "Dez sessões de força concluídas."),
  deForca(25, "25 treinos", "Vinte e cinco sessões de força concluídas."),
  deForca(50, "50 treinos", "Cinquenta sessões de força concluídas."),
  deForca(100, "100 treinos", "Cem sessões de força concluídas."),

  deDias(3),
  deDias(7),
  deSemanas(2),
  deSemanas(4),
  deSemanas(8),
  deSemanas(12),
  {
    id: "semana-completa",
    nome: "Semana completa",
    descricao: "Uma semana em que tudo o que estava planejado foi feito.",
    regra:
      "Numa semana civil, todas as sessões planejadas da semana (força + cardio da fase) concluídas.",
    icone: "CalendarCheck",
    grupo: "constancia",
    alvo: 1,
    unidade: "sessoes",
    medir: (c) => {
      const alvo = Math.max(1, c.planejadasNaSemana);
      const primeira = c.semanas.find((s) => s.feitos >= alvo);
      return {
        alvo,
        atual: c.semanas.reduce((maior, s) => Math.max(maior, s.feitos), 0),
        em: primeira ? primeira.ultimaAtividade : null,
      };
    },
  },

  {
    id: "corrida-1",
    nome: "Primeira corrida",
    descricao: "A primeira sessão de corrida concluída.",
    regra: "Uma sessão de corrida concluída.",
    icone: "Footprints",
    grupo: "cardio",
    alvo: 1,
    unidade: "sessoes",
    medir: (c) =>
      acumulado(
        c.corridas.map((x) => ({ data: x.data, valor: 1 })),
        1,
      ),
  },
  {
    id: "corrida-20min",
    nome: "20 min correndo",
    descricao: "Vinte minutos de corrida sem parar numa sessão.",
    regra:
      "Uma corrida com um bloco contínuo de corrida de 20 minutos ou mais no registro da sessão.",
    icone: "Timer",
    grupo: "cardio",
    alvo: 20,
    unidade: "minutos",
    medir: (c) =>
      melhor(
        c.corridas.map((x) => ({ data: x.data, valor: maiorBlocoDeCorridaMin(x) })),
        20,
      ),
  },
  {
    id: "corrida-5km",
    nome: "5 km sem parar",
    descricao: "Cinco quilômetros corridos sem caminhar — a semana 12 do plano.",
    regra:
      "Uma corrida concluída com 5 km ou mais e nenhum bloco de caminhada no meio.",
    icone: "Route",
    grupo: "cardio",
    alvo: 5,
    unidade: "km",
    medir: (c) =>
      melhor(
        c.corridas
          .filter(correuSemParar)
          .map((x) => ({ data: x.data, valor: x.distancia_km ?? 0 })),
        5,
      ),
  },
  {
    id: "corda-1000",
    nome: "1.000 saltos",
    descricao: "Mil saltos de corda numa única sessão.",
    regra: "Uma sessão de corda concluída com 1.000 saltos ou mais.",
    icone: "Zap",
    grupo: "cardio",
    alvo: 1000,
    unidade: "saltos",
    medir: (c) =>
      melhor(
        c.cordas.map((x) => ({ data: x.data, valor: x.saltos ?? 0 })),
        1000,
      ),
  },

  {
    id: "fixa-sem-elastico",
    nome: "Sem elástico",
    descricao: "A primeira repetição de barra fixa sem nenhuma ajuda.",
    regra:
      "Uma repetição de barra fixa sem elástico: numa série com assistência \"sem\" (ou num exercício que não é a barra fixa assistida), ou numa repetição solta registrada como sem assistência.",
    icone: "ChevronsUp",
    grupo: "barra_fixa",
    alvo: 1,
    unidade: "reps",
    medir: (c) => melhor(c.barraSemElastico, 1),
  },
  deBarraNaSerie(5),
  deBarraNaSerie(10),
  {
    id: "fixa-100-soltas",
    nome: "100 soltas",
    descricao: "Cem repetições soltas de barra fixa somadas nos dias de descanso.",
    regra: "As repetições soltas registradas somam 100.",
    icone: "Flame",
    grupo: "barra_fixa",
    alvo: 100,
    unidade: "reps",
    medir: (c) => acumulado(c.soltas, 100),
  },

  deCarga(20),
  deCarga(40),
  deCarga(60),

  deVolume(10000, "10.000 kg"),
  deVolume(50000, "50.000 kg"),

  {
    id: "fase-2",
    nome: "Fase 2",
    descricao: "A troca para a Fase 2 — superior e inferior, 4× por semana.",
    regra: "O perfil passa a estar na Fase 2; a data é a da troca.",
    icone: "Trophy",
    grupo: "programa",
    alvo: 1,
    unidade: "nenhuma",
    medir: (c) => ({
      atual: c.fase.atual === "fase2" ? 1 : 0,
      em: c.fase.atual === "fase2" ? c.fase.desde : null,
    }),
  },
];

/** As conquistas como estão definidas, sem avaliar nada. */
export const CONQUISTAS: readonly Conquista[] = DEFINICOES.map((d) => {
  const { medir, ...resto } = d;
  void medir;
  return resto;
});

export const TOTAL_DE_CONQUISTAS = DEFINICOES.length;

/* ------------------------------------------------------- o que falta */

const NOME_DA_UNIDADE: Record<Unidade, { um: string; muitos: string }> = {
  treinos: { um: "treino", muitos: "treinos" },
  semanas: { um: "semana", muitos: "semanas" },
  dias: { um: "dia", muitos: "dias" },
  sessoes: { um: "sessão", muitos: "sessões" },
  minutos: { um: "minuto", muitos: "minutos" },
  km: { um: "km", muitos: "km" },
  saltos: { um: "salto", muitos: "saltos" },
  reps: { um: "repetição", muitos: "repetições" },
  kg: { um: "kg", muitos: "kg" },
  nenhuma: { um: "", muitos: "" },
};

/** Unidades que podem ficar com casas decimais na frase. */
const COM_DECIMAL: ReadonlySet<Unidade> = new Set<Unidade>(["km", "kg"]);

/** "faltam 3 treinos" · "falta 1 treino" · "faltam 2,5 km" (SPEC §19.4). */
export function textoDoQueFalta(
  alvo: number,
  atual: number,
  unidade: Unidade,
): string | null {
  if (atual >= alvo) return null;
  if (unidade === "nenhuma") return "ainda na Fase 1";
  const bruto = alvo - atual;
  const restante = COM_DECIMAL.has(unidade)
    ? Math.round(bruto * 10) / 10
    : Math.ceil(bruto);
  const nome = NOME_DA_UNIDADE[unidade];
  if (restante === 1) return `falta 1 ${nome.um}`;
  return `faltam ${formatarNumero(restante)} ${nome.muitos}`;
}

/* --------------------------------------------------------------- avaliar */

/** Avalia as 26 conquistas sobre os registros (SPEC §19.3). */
export function avaliarConquistas(
  dados: DadosDasConquistas,
): ConquistaAvaliada[] {
  const contexto = montarContexto(dados);
  return DEFINICOES.map(({ medir, ...conquista }) => {
    const { atual, em, alvo = conquista.alvo } = medir(contexto);
    const atingida = em !== null;
    return {
      ...conquista,
      alvo,
      atingida,
      em,
      atual,
      falta: atingida ? null : textoDoQueFalta(alvo, atual, conquista.unidade),
    };
  });
}

/** Quantas já foram conquistadas. */
export function totalConquistado(lista: readonly ConquistaAvaliada[]): number {
  return lista.filter((c) => c.atingida).length;
}

/* ------------------------------------------------- o aviso (SPEC §19.5) */

/** A chave do jsonb onde os ids já avisados moram. */
export const CHAVE_VISTAS = "conquistas_vistas";

/**
 * Os ids já avisados em `profiles.prefs.conquistas_vistas`. O jsonb vem do
 * banco e de um backup importado, então nada aqui confia no formato.
 */
export function conquistasVistasDasPrefs(
  prefs: Prefs | null | undefined,
): string[] {
  const bruto = prefs?.[CHAVE_VISTAS];
  if (!Array.isArray(bruto)) return [];
  return bruto.filter((v): v is string => typeof v === "string");
}

/** Marca ids como avisados (união, sem repetir e em ordem estável). */
export function comConquistasVistas(
  prefs: Prefs | null | undefined,
  ids: readonly string[],
): Prefs {
  const juntos = new Set([...conquistasVistasDasPrefs(prefs), ...ids]);
  return { ...(prefs ?? {}), [CHAVE_VISTAS]: [...juntos] };
}

/**
 * As conquistas atingidas que ainda não foram avisadas, as mais recentes
 * primeiro (SPEC §19.5).
 */
export function conquistasNovas(
  lista: readonly ConquistaAvaliada[],
  vistas: readonly string[],
): ConquistaAvaliada[] {
  const jaVistas = new Set(vistas);
  return lista
    .filter((c) => c.atingida && !jaVistas.has(c.id))
    .sort((a, b) => (b.em ?? "").localeCompare(a.em ?? ""));
}
