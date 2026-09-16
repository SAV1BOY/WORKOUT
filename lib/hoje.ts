/**
 * Adaptadores puros da tela Hoje (SPEC §3.1): a partir do perfil, dos estados
 * por exercício e do que já foi registrado, monta o que a tela mostra.
 * Nenhuma dependência de React, Supabase ou Dexie — tudo aqui é função pura.
 *
 * O conteúdo (nomes, séries, faixas, minutos) vem sempre de `lib/dados.ts`.
 */
import {
  acharExercicio,
  acharTreino,
  estagioDeCorda,
  exerciciosDoTreino,
  treinoPorId,
} from "@/lib/dados";
import {
  formatarData,
  formatarKg,
  formatarMinutos,
  formatarNumero,
  rotuloDaCarga,
} from "@/lib/formato";
import type { OpcoesMontagem } from "@/lib/montagem";
import { aplicarOrdem } from "@/lib/ordem";
import {
  cargaDeHoje,
  prescricaoDoTreino,
  prescricaoPadrao,
  type AlvoDeHoje,
  type EstadoExercicio,
} from "@/lib/progressao";
import type { Grupo, Implemento, TreinoId } from "@/lib/schemas";
import type {
  LinhaEstadoExercicio,
  LinhaSerie,
  LinhaEventoProgressao,
  LinhaPeso,
  LinhaSessao,
  LinhaSessaoCardio,
  LinhaBarraFixaSolta,
} from "@/lib/types";
import type { DiaDoPlano, SessaoCardioDoDia } from "@/lib/calendario";
import { diaDaSemana, iso, paraData } from "@/lib/calendario";
import { differenceInCalendarDays } from "date-fns";

/** Depois de quantos dias sem pesar o app pede a pesagem (SPEC §3.1). */
export const DIAS_PARA_PEDIR_PESAGEM = 7;

/* ------------------------------------------------------------- estados */

/** A linha do banco vira o estado que o motor entende. */
export function estadoDaLinha(
  linha: LinhaEstadoExercicio | null | undefined,
): EstadoExercicio | null {
  if (!linha) return null;
  return {
    carga_atual_kg: linha.carga_atual_kg,
    reps_alvo: linha.reps_alvo,
    tempo_alvo_s: linha.tempo_alvo_s,
    assistencia: linha.assistencia,
    incremento_kg: linha.incremento_kg,
    falhas_seguidas: linha.falhas_seguidas,
    incremento_reduzido: linha.incremento_reduzido,
    exigir_rep_extra: linha.exigir_rep_extra,
    semana_leve: linha.semana_leve,
    carga_antes_leve: linha.carga_antes_leve,
    sessoes_graca: linha.sessoes_graca,
    desativado: linha.desativado,
  };
}

/** Indexa as linhas de `exercise_state` por exercício. */
export function estadosPorExercicio(
  linhas: LinhaEstadoExercicio[] = [],
): Record<string, EstadoExercicio> {
  const mapa: Record<string, EstadoExercicio> = {};
  for (const linha of linhas) {
    const estado = estadoDaLinha(linha);
    if (estado) mapa[linha.exercise_id] = estado;
  }
  return mapa;
}

/* ----------------------------------------------------- resumo do treino */

export interface ResumoDoTreino {
  id: TreinoId;
  nome: string;
  foco: string;
  exercicios: number;
  min: number;
  /** "Treino A · 6 exercícios · 44 min" */
  texto: string;
}

/** O cabeçalho do card de força (SPEC §3.1 e §10.2). */
export function resumoDoTreino(id: TreinoId): ResumoDoTreino {
  const treino = acharTreino(id);
  const n = treino.exercicios.length;
  return {
    id,
    nome: treino.nome,
    foco: treino.foco,
    exercicios: n,
    min: treino.duracao_min,
    texto: `${treino.nome} · ${n} exercício${n === 1 ? "" : "s"} · ${formatarMinutos(treino.duracao_min)}`,
  };
}

/** "44 min · 6 exercícios" — o detalhe do card de força (SPEC §13.3). */
export function detalheDoTreino(id: TreinoId): string {
  const treino = acharTreino(id);
  const n = treino.exercicios.length;
  return `${formatarMinutos(treino.duracao_min)} · ${n} exercício${n === 1 ? "" : "s"}`;
}

/* ------------------------------------------------ sessão aberta: progresso */

export interface ProgressoDaAberta {
  feitas: number;
  /** `null` quando a sessão não é um treino do programa (barra fixa, livre). */
  total: number | null;
  /** "3/15 séries" ou "3 séries" */
  texto: string;
}

/**
 * Séries de trabalho já registradas numa sessão aberta (SPEC §13.3, o card
 * "Continuar"). O total vem da prescrição do treino em `programa.json`.
 */
export function progressoDaAberta(
  workoutId: string,
  series: Pick<LinhaSerie, "tipo" | "concluida">[] = [],
): ProgressoDaAberta {
  const feitas = series.filter((s) => s.tipo === "trabalho" && s.concluida).length;
  // "fixa" e "livre" não são treinos do `programa.json`: não há total prescrito
  const treino = treinoPorId[workoutId as TreinoId] ?? null;
  if (!treino) {
    return {
      feitas,
      total: null,
      texto: `${feitas} série${feitas === 1 ? "" : "s"}`,
    };
  }
  const total = exerciciosDoTreino(workoutId as TreinoId).reduce(
    (soma, { item, exercicio }) => soma + prescricaoDoTreino(item, exercicio).series,
    0,
  );
  return { feitas, total, texto: `${feitas}/${total} séries` };
}

/* ---------------------------------------------------- prévia do treino */

export interface ItemPrevia {
  exercicioId: string;
  /** O exercício do programa, mesmo quando um substituto tomou o lugar. */
  originalId: string;
  substituido: boolean;
  nome: string;
  implemento: Implemento;
  ordem: number;
  /** "3 × 5", "3 × 6–8", "3 × 30 s" — o alvo do dia. */
  alvoTexto: string;
  /** "7,5 kg na barra", "1,5 kg por halter", "4 kg no pino", "peso do corpo". */
  cargaTexto: string;
  /** "subiu +2 kg no treino de 12/09" — só quando houver evento. */
  historico: string | null;
  alvo: AlvoDeHoje;
}

/** Faixa de reps/tempo/passos do dia, já com o topo efetivo do motor. */
export function textoDoAlvo(series: number, alvo: AlvoDeHoje): string {
  const min = alvo.alvo_min;
  const max = alvo.alvo_max;
  const unidade =
    alvo.tipo === "tempo_s" ? " s" : alvo.tipo === "passos" ? " passos" : "";

  if (alvo.tipo === "maximo" || (min === null && max === null)) {
    return `${series} × máximo`;
  }
  const piso = min ?? max ?? 0;
  const topo = max ?? min ?? 0;
  const faixa =
    piso === topo
      ? `${formatarNumero(topo)}${unidade}`
      : `${formatarNumero(piso)}–${formatarNumero(topo)}${unidade}`;
  return `${series} × ${faixa}`;
}

/**
 * Carga do dia com o rótulo certo do implemento (SPEC §4: "mostrar sempre o
 * rótulo certo na tela"). Sem carga nenhuma, é peso do corpo.
 */
export function textoDaCarga(
  implemento: Implemento,
  carga: number | null,
): string {
  if (carga === null || carga === 0) return "peso do corpo";
  return `${formatarKg(carga)} ${rotuloDaCarga(implemento)}`;
}

interface EventoCurto {
  /** `null` no evento do programa inteiro (troca de fase, SPEC §5.1). */
  exercise_id: string | null;
  data: string;
  motivo: LinhaEventoProgressao["motivo"];
  de: Record<string, unknown> | null;
  para: Record<string, unknown> | null;
}

function numeroDe(campo: Record<string, unknown> | null, chave: string): number | null {
  const v = campo?.[chave];
  return typeof v === "number" ? v : null;
}

/**
 * A explicação da carga de hoje (SPEC §6.6): "subiu +2 kg no treino de 12/09".
 * Devolve `null` quando o evento não mudou nada que valha explicar.
 */
export function textoDoEvento(evento: EventoCurto): string | null {
  const quando = `no treino de ${formatarData(evento.data)}`;

  const deKg = numeroDe(evento.de, "carga_kg");
  const paraKg = numeroDe(evento.para, "carga_kg");
  if (deKg !== null && paraKg !== null && deKg !== paraKg) {
    const delta = paraKg - deKg;
    const verbo = delta > 0 ? "subiu" : "voltou";
    const sinal = delta > 0 ? "+" : "−";
    return `${verbo} ${sinal}${formatarNumero(Math.abs(delta))} kg ${quando}`;
  }

  const deReps = numeroDe(evento.de, "reps_alvo");
  const paraReps = numeroDe(evento.para, "reps_alvo");
  if (deReps !== null && paraReps !== null && deReps !== paraReps) {
    const delta = paraReps - deReps;
    const verbo = delta > 0 ? "subiu" : "voltou";
    const sinal = delta > 0 ? "+" : "−";
    const n = Math.abs(delta);
    return `${verbo} ${sinal}${formatarNumero(n)} ${n === 1 ? "repetição" : "repetições"} ${quando}`;
  }

  const deTempo = numeroDe(evento.de, "tempo_alvo_s");
  const paraTempo = numeroDe(evento.para, "tempo_alvo_s");
  if (deTempo !== null && paraTempo !== null && deTempo !== paraTempo) {
    const delta = paraTempo - deTempo;
    const sinal = delta > 0 ? "+" : "−";
    return `${delta > 0 ? "subiu" : "voltou"} ${sinal}${formatarNumero(Math.abs(delta))} s ${quando}`;
  }

  const deAss = evento.de?.["assistencia"];
  const paraAss = evento.para?.["assistencia"];
  if (typeof paraAss === "string" && paraAss !== deAss) {
    return `mudou o elástico ${quando}`;
  }

  if (evento.motivo === "semana_leve_60") return `semana leve ${quando}`;
  if (evento.motivo === "fim_semana_leve") return `voltou da semana leve ${quando}`;
  if (evento.motivo === "repetiu") return `repetiu a carga ${quando}`;
  return null;
}

/** O evento mais recente de cada exercício (a lista pode vir em qualquer ordem). */
export function ultimoEventoPorExercicio(
  eventos: EventoCurto[] = [],
): Record<string, EventoCurto> {
  const mapa: Record<string, EventoCurto> = {};
  for (const e of eventos) {
    // o evento da troca de fase não é de exercício nenhum (§5.1)
    if (e.exercise_id === null) continue;
    const atual = mapa[e.exercise_id];
    if (!atual || e.data >= atual.data) mapa[e.exercise_id] = e;
  }
  return mapa;
}

export interface EntradaPrevia {
  treinoId: TreinoId;
  /**
   * Substituições escolhidas na lista do dia (SPEC §13.3): exercício do
   * programa → substituto. A prescrição passa a ser a **dele**, como na sessão
   * (§3.2 e §6.3).
   */
  trocas?: Record<string, string>;
  /** `exercise_state` por exercício (o que o motor já decidiu). */
  estados?: Record<string, EstadoExercicio | null>;
  /** `progression_events` dos exercícios do treino, em qualquer ordem. */
  eventos?: EventoCurto[];
  /** Barra W / reta oca já pesadas na balança (SPEC §3.9). */
  montagem?: OpcoesMontagem;
  /**
   * A ordem escolhida em "Editar" (SPEC §14.3), por id do exercício **do
   * programa**. Vazia = a ordem do programa. Quem não está na lista fica no
   * fim, na ordem do programa (`aplicarOrdem`): ninguém some.
   */
  ordem?: readonly string[];
}

/**
 * A prévia dos exercícios de hoje (SPEC §3.1): o que o motor vai pedir em cada
 * um, com a carga já projetada na escala do implemento.
 */
export function previaDoTreino({
  treinoId,
  estados = {},
  eventos = [],
  montagem = {},
  trocas = {},
  ordem = [],
}: EntradaPrevia): ItemPrevia[] {
  const ultimos = ultimoEventoPorExercicio(eventos);
  const doTreino = exerciciosDoTreino(treinoId);
  const posicao = aplicarOrdem(
    doTreino.map(({ exercicio }) => exercicio.id),
    ordem,
  );
  const naOrdem = posicao.flatMap((id) => {
    const achado = doTreino.find(({ exercicio }) => exercicio.id === id);
    return achado ? [achado] : [];
  });

  return naOrdem.map(({ item, exercicio: doPrograma }, i) => {
    const substitutoId = trocas[doPrograma.id];
    const exercicio =
      substitutoId && substitutoId !== doPrograma.id
        ? acharExercicio(substitutoId)
        : doPrograma;
    const substituido = exercicio.id !== doPrograma.id;
    /*
     * Com substituto vale a prescrição dele (SPEC §6.3), guardando o número de
     * séries do programa — é o que `substituirExercicio` faz na sessão.
     */
    const prescricao = substituido
      ? { ...prescricaoPadrao(exercicio), series: prescricaoPadrao(exercicio).series || item.series }
      : prescricaoDoTreino(item, exercicio);
    const estado = estados[exercicio.id] ?? null;
    const alvo = cargaDeHoje(exercicio, estado, prescricao, montagem);
    const evento = ultimos[exercicio.id];

    return {
      exercicioId: exercicio.id,
      originalId: doPrograma.id,
      substituido,
      nome: exercicio.nome,
      implemento: exercicio.implemento,
      ordem: i + 1,
      alvoTexto: textoDoAlvo(prescricao.series, alvo),
      cargaTexto: textoDaCarga(exercicio.implemento, alvo.carga_kg),
      historico: evento ? textoDoEvento(evento) : null,
      alvo,
    };
  });
}

/* ---------------------------------------------------------- cardio */

/** "8 × (1 min corrida / 2 min caminhada)" ou "6 × 30 s de corda". */
export function descricaoDoCardio(cardio: SessaoCardioDoDia): string | null {
  if (cardio.descricao) return cardio.descricao;
  const corda = cardio.corda;
  if (corda) {
    return `${corda.blocos} × ${corda.bloco_s} s de corda (${corda.descanso_s} s de descanso)`;
  }
  return null;
}

/** "Corrida · semana 1 · 8 × (1 min corrida / 2 min caminhada) · 34 min". */
export function textoDoCardio(cardio: SessaoCardioDoDia): string {
  const nome =
    cardio.tipo === "corrida"
      ? "Corrida"
      : cardio.tipo === "corda"
        ? "Corda"
        : "Caminhada";
  const partes = [nome, `semana ${cardio.semana}`];
  const desc = descricaoDoCardio(cardio);
  if (desc) partes.push(desc);
  if (cardio.min !== null) partes.push(formatarMinutos(cardio.min));
  return partes.join(" · ");
}

/* --------------------------------------------------- faixa de status */

export interface StatusDoPeso {
  peso: number | null;
  data: string | null;
  dias: number | null;
  pedirPesagem: boolean;
}

/** Peso mais recente e há quantos dias foi pesado (SPEC §3.1). */
export function statusDoPeso(
  pesos: Pick<LinhaPeso, "data" | "peso_kg">[] = [],
  hoje: string | Date,
): StatusDoPeso {
  const ultimo = [...pesos].sort((a, b) => (a.data < b.data ? 1 : -1))[0];
  if (!ultimo) {
    return { peso: null, data: null, dias: null, pedirPesagem: true };
  }
  const dias = Math.max(
    0,
    differenceInCalendarDays(paraData(hoje), paraData(ultimo.data)),
  );
  return {
    peso: ultimo.peso_kg,
    data: ultimo.data,
    dias,
    pedirPesagem: dias > DIAS_PARA_PEDIR_PESAGEM,
  };
}

/**
 * Sequência de treinos de força concluídos: conta do mais recente para trás e
 * para na primeira sessão que não foi concluída (abandonada ou aberta).
 */
export function sequenciaDeTreinos(
  sessoes: Pick<LinhaSessao, "data" | "status">[] = [],
): number {
  const ordenadas = [...sessoes].sort((a, b) => (a.data < b.data ? 1 : -1));
  let n = 0;
  for (const s of ordenadas) {
    if (s.status === "em_andamento") continue;
    if (s.status !== "concluida") break;
    n += 1;
  }
  return n;
}

export interface FaixaDeStatus {
  fase: string;
  semanaDaFase: number;
  sequencia: number;
  peso: StatusDoPeso;
}

/* ------------------------------------------------- reps soltas do dia */

/** Total de repetições soltas de barra fixa registradas numa data. */
export function totalDeSoltas(
  soltas: Pick<LinhaBarraFixaSolta, "data" | "reps">[] = [],
  data: string,
): number {
  return soltas
    .filter((s) => s.data === data)
    .reduce((soma, s) => soma + (s.reps ?? 0), 0);
}

/* ------------------------------------------- aviso de corrida + perna */

/** O grupo de `data/exercicios.json` que marca um treino como "de perna". */
const GRUPO_PERNAS: Grupo = "Pernas";

/**
 * SPEC §5.3 e `cardio.json` `ordem`: correr e treinar perna no mesmo dia não é
 * bloqueado, mas avisa. Só faz sentido quando o dia tem as duas coisas.
 */
export function avisoCorridaEPerna(
  dia: DiaDoPlano,
  treinoId: TreinoId | null,
  houveCorridaHoje: boolean,
): string | null {
  if (!treinoId) return null;
  // quem é exercício de perna sai do `grupo` de `data/exercicios.json`, não de
  // uma lista de nomes escrita aqui.
  const temPerna = acharTreino(treinoId).exercicios.some(
    (e) => acharExercicio(e.exercicio_id).grupo === GRUPO_PERNAS,
  );
  if (!temPerna) return null;
  const vaiCorrer = dia.tipo === "cardio" && dia.cardio?.tipo === "corrida";
  if (!vaiCorrer && !houveCorridaHoje) return null;
  return "Corrida e treino de perna no mesmo dia: deixe 6 h entre os dois e faça a força primeiro.";
}

/* -------------------------------------------- sessão aberta (banner) */

export interface SessaoAberta {
  id: string;
  data: string;
  workoutId: string;
  /** "Você tem um treino aberto de 12/09" */
  texto: string;
}

/** A sessão em andamento mais recente, se houver (SPEC §3.1). */
export function sessaoAberta(
  sessoes: Pick<LinhaSessao, "id" | "data" | "status" | "workout_id">[] = [],
): SessaoAberta | null {
  const abertas = sessoes
    .filter((s) => s.status === "em_andamento")
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  const s = abertas[0];
  if (!s) return null;
  return {
    id: s.id,
    data: s.data,
    workoutId: s.workout_id,
    texto: `Você tem um treino aberto de ${formatarData(s.data)}`,
  };
}

/* ------------------------------------------------ cardio já feito hoje */

export function houveCardioHoje(
  cardios: Pick<LinhaSessaoCardio, "data" | "tipo" | "concluida">[] = [],
  data: string,
  tipo?: LinhaSessaoCardio["tipo"],
): boolean {
  return cardios.some(
    (c) => c.data === data && c.concluida && (tipo ? c.tipo === tipo : true),
  );
}

/** Dia da semana em pt-BR curto, para os rótulos da grade. */
export function diaCurto(data: string | Date): string {
  const nomes: Record<string, string> = {
    seg: "seg",
    ter: "ter",
    qua: "qua",
    qui: "qui",
    sex: "sex",
    sab: "sáb",
    dom: "dom",
  };
  return nomes[diaDaSemana(data)] ?? iso(data);
}

/**
 * A alternativa "fazer corda em vez de corrida" (SPEC §3.1, dia de chuva).
 * O estágio sai de `cardio.json`; a semana, do perfil.
 */
export function alternativaDeCorda(semanaCorda: number): SessaoCardioDoDia {
  const estagio = estagioDeCorda(semanaCorda);
  return {
    tipo: "corda",
    sessao: "corda",
    permiteCorda: true,
    semana: semanaCorda,
    corrida: null,
    corda: estagio,
    descricao: null,
    min: estagio.sessao_min,
  };
}
