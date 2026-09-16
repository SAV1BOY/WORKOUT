/**
 * Retomada depois de uma pausa (SPEC §18) — funções puras, sem React nem
 * Supabase.
 *
 * Conta há quantos dias inteiros o Miguel não registra nada (§18.1), diz o que
 * oferecer nessa faixa (§18.2) e monta as linhas que cada escolha grava — sem
 * tocar no banco: quem enfileira é `lib/queries/retomada.ts`.
 *
 * O motor (§6) não muda: "Voltar mais leve" escreve nos exercícios exatamente
 * os campos que a 3ª falha da §6.2 escreve (`semana_leve`, `carga_antes_leve`,
 * 60 % da carga), e é o motor de sempre que devolve a carga cheia na sessão
 * seguinte. "Recomeçar do zero" escreve o estado inicial da §6.1, que sai do
 * `carga_inicial` do JSON.
 */
import { addDays, differenceInCalendarDays } from "date-fns";
import { iso, paraData, type Data } from "@/lib/calendario";
import { exercicioPorId } from "@/lib/dados";
import { alcancavelParaBaixo, type OpcoesMontagem } from "@/lib/montagem";
import { estadoInicial } from "@/lib/progressao";
import type {
  LinhaEstadoExercicio,
  LinhaEventoProgressao,
  Prefs,
} from "@/lib/types";
import type { MudancaDePerfil } from "@/lib/queries/perfil";

/** A chave do jsonb onde a decisão da pausa mora (SPEC §18.4). */
export const CHAVE_RETOMADA = "retomada";

/** A partir de quantos dias parado o card aparece (SPEC §18.2). */
export const DIAS_PARA_PERGUNTAR = 7;
/** A partir daqui entra "Voltar mais leve". */
export const DIAS_PARA_LEVE = 14;
/** A partir daqui entra "Recomeçar do zero". */
export const DIAS_PARA_ZERO = 28;

/** Quanto da carga a semana leve usa (o mesmo 60 % da §6.2). */
export const FRACAO_LEVE = 0.6;

export type EscolhaRetomada = "continuar" | "semana" | "leve" | "zero";

/** Em que faixa da §18.2 a pausa caiu. */
export type FaixaRetomada = "nenhuma" | "curta" | "media" | "longa";

/** A decisão guardada em `profiles.prefs.retomada` (SPEC §18.4). */
export interface RetomadaGravada {
  /** O dia em que ele decidiu (ISO). */
  em: string;
  /** Quantos dias parado havia naquele momento. */
  dias: number;
  escolha: EscolhaRetomada;
}

/* --------------------------------------------------- dias parado (§18.1) */

/** Uma sessão de força (ou de barra fixa) para a conta dos dias parado. */
export interface SessaoParada {
  data: string;
  status: string;
}

/** Uma sessão de cardio. */
export interface CardioParado {
  data: string;
  concluida: boolean;
}

/** Uma repetição solta de barra fixa (`pullup_singles`). */
export interface FixaParada {
  data: string;
}

/**
 * A data da última atividade: sessão de força concluída (as de barra fixa
 * entram, são `sessions` como as outras), sessão de cardio concluída ou
 * repetição solta de barra fixa. `null` quando nunca houve nenhuma.
 */
export function ultimaAtividade(
  sessoes: readonly SessaoParada[] = [],
  cardios: readonly CardioParado[] = [],
  fixas: readonly FixaParada[] = [],
): string | null {
  const datas = [
    ...sessoes.filter((s) => s.status === "concluida").map((s) => s.data),
    ...cardios.filter((c) => c.concluida).map((c) => c.data),
    ...fixas.map((f) => f.data),
  ].filter((d): d is string => typeof d === "string" && d !== "");
  if (datas.length === 0) return null;
  return datas.reduce((maior, d) => (d > maior ? d : maior));
}

/**
 * Dias inteiros de calendário desde a última atividade (SPEC §18.1). `null`
 * quando não há nenhuma: quem nunca treinou não está voltando de pausa.
 * Nunca negativo — uma sessão registrada "amanhã" (relógio do aparelho
 * adiantado) conta como zero.
 */
export function diasParado(
  hoje: Data,
  sessoes: readonly SessaoParada[] = [],
  cardios: readonly CardioParado[] = [],
  fixas: readonly FixaParada[] = [],
): number | null {
  const ultima = ultimaAtividade(sessoes, cardios, fixas);
  if (!ultima) return null;
  return Math.max(0, differenceInCalendarDays(paraData(hoje), paraData(ultima)));
}

/* ------------------------------------------------ faixas e opções (§18.2) */

export interface OpcaoRetomada {
  escolha: EscolhaRetomada;
  rotulo: string;
  /** A frase de baixo do botão: o que essa opção faz. */
  descricao: string;
  /** Só "Recomeçar do zero": pede confirmação em duas etapas (§18.3). */
  destrutiva?: boolean;
}

const CONTINUAR: OpcaoRetomada = {
  escolha: "continuar",
  rotulo: "Continuar de onde parou",
  descricao: "O próximo treino é o da vez e as cargas ficam como estão.",
};

const SEMANA: OpcaoRetomada = {
  escolha: "semana",
  rotulo: "Recomeçar a semana",
  descricao: "Corrida, corda e barra fixa voltam uma semana no plano.",
};

const LEVE: OpcaoRetomada = {
  escolha: "leve",
  rotulo: "Voltar mais leve",
  descricao:
    "Uma semana a 60 % da carga em todos os exercícios; depois o app devolve a carga.",
};

const ZERO: OpcaoRetomada = {
  escolha: "zero",
  rotulo: "Recomeçar do zero",
  descricao: "As cargas voltam ao começo do programa. O histórico fica.",
  destrutiva: true,
};

/** Em que faixa da §18.2 caem `dias` dias parado. */
export function faixaDeDias(dias: number | null): FaixaRetomada {
  if (dias === null || dias < DIAS_PARA_PERGUNTAR) return "nenhuma";
  if (dias < DIAS_PARA_LEVE) return "curta";
  if (dias < DIAS_PARA_ZERO) return "media";
  return "longa";
}

export interface RetomadaOferecida {
  faixa: FaixaRetomada;
  opcoes: OpcaoRetomada[];
}

/**
 * O que o card oferece para essa pausa (SPEC §18.2). De 0 a 6 dias não há card:
 * semana parcial sem pausa longa é semana normal, continua.
 */
export function faixaDaRetomada(dias: number | null): RetomadaOferecida {
  const faixa = faixaDeDias(dias);
  if (faixa === "curta") return { faixa, opcoes: [CONTINUAR, SEMANA] };
  if (faixa === "media") return { faixa, opcoes: [CONTINUAR, LEVE] };
  if (faixa === "longa") return { faixa, opcoes: [CONTINUAR, LEVE, ZERO] };
  return { faixa, opcoes: [] };
}

/* ------------------------------------- uma vez por pausa (SPEC §18.4) */

function ehEscolha(v: unknown): v is EscolhaRetomada {
  return v === "continuar" || v === "semana" || v === "leve" || v === "zero";
}

/**
 * A decisão guardada nas prefs, ou `null`. O jsonb vem do banco e de um backup
 * importado, então nada aqui confia no formato.
 */
export function retomadaDasPrefs(
  prefs: Prefs | null | undefined,
): RetomadaGravada | null {
  const bruto = prefs?.[CHAVE_RETOMADA];
  if (typeof bruto !== "object" || bruto === null) return null;
  const v = bruto as Partial<RetomadaGravada>;
  if (typeof v.em !== "string" || v.em === "") return null;
  if (typeof v.dias !== "number" || !Number.isFinite(v.dias)) return null;
  if (!ehEscolha(v.escolha)) return null;
  return { em: v.em, dias: Math.max(0, Math.round(v.dias)), escolha: v.escolha };
}

/** Grava (ou apaga, com `null`) a decisão nas prefs. */
export function comRetomada(
  prefs: Prefs | null | undefined,
  decisao: RetomadaGravada | null,
): Prefs {
  const resto = { ...(prefs ?? {}) };
  if (decisao === null) {
    delete resto[CHAVE_RETOMADA];
    return resto;
  }
  return { ...resto, [CHAVE_RETOMADA]: { ...decisao } };
}

/**
 * A âncora de uma decisão: o dia da última atividade de então (`em` − `dias`).
 * É por ela que a mesma pausa é reconhecida depois (SPEC §18.4).
 */
export function ancoraDaRetomada(decisao: RetomadaGravada): string {
  return iso(addDays(paraData(decisao.em), -decisao.dias));
}

export interface EntradaDoCard {
  dias: number | null;
  /** A data da última atividade de agora (`ultimaAtividade`). */
  ultima: string | null;
  prefs?: Prefs | null;
}

/**
 * O card deve aparecer? Sim quando a pausa chegou a 7 dias e ainda não foi
 * decidida. A pausa já decidida é reconhecida pela âncora: enquanto a última
 * atividade for aquela, o card não volta; uma atividade nova e um novo
 * intervalo de 7 dias ou mais trazem o card de volta (SPEC §18.4).
 */
export function deveMostrarRetomada({
  dias,
  ultima,
  prefs,
}: EntradaDoCard): boolean {
  if (dias === null || dias < DIAS_PARA_PERGUNTAR) return false;
  const decidida = retomadaDasPrefs(prefs);
  if (!decidida) return true;
  if (ultima === null) return false;
  // pausa nova = a última atividade é posterior à da pausa já decidida
  return ultima > ancoraDaRetomada(decidida);
}

export interface EntradaDaPausa {
  hoje: Data;
  sessoes?: readonly SessaoParada[];
  cardios?: readonly CardioParado[];
  fixas?: readonly FixaParada[];
  prefs?: Prefs | null;
}

export interface PausaCorrente {
  dias: number | null;
  ultima: string | null;
  /** O card tem de estar na tela (SPEC §18.3). */
  mostrar: boolean;
}

/**
 * A pausa que a aba Treino mostra (SPEC §18.1). É `diasParado` mais uma
 * ressalva: enquanto a pausa não foi decidida, a atividade registrada **hoje**
 * não a apaga. Quem voltou de 30 dias, tocou no "+1" da barra fixa e só depois
 * olhou o card ainda precisa escolher como voltar — sem isso a conta caía para
 * zero, o card sumia por conta própria e ele treinaria no dia seguinte com a
 * carga cheia. No dia seguinte a conta já é 1 e não há card nenhum.
 */
export function pausaCorrente({
  hoje,
  sessoes = [],
  cardios = [],
  fixas = [],
  prefs,
}: EntradaDaPausa): PausaCorrente {
  const data = typeof hoje === "string" ? hoje : iso(hoje);
  const cru = {
    dias: diasParado(hoje, sessoes, cardios, fixas),
    ultima: ultimaAtividade(sessoes, cardios, fixas),
  };
  if (deveMostrarRetomada({ ...cru, prefs })) return { ...cru, mostrar: true };

  const antes = <T extends { data: string }>(linhas: readonly T[]) =>
    linhas.filter((l) => l.data < data);
  const anteriores = {
    sessoes: antes(sessoes),
    cardios: antes(cardios),
    fixas: antes(fixas),
  };
  const semHoje = {
    dias: diasParado(hoje, anteriores.sessoes, anteriores.cardios, anteriores.fixas),
    ultima: ultimaAtividade(anteriores.sessoes, anteriores.cardios, anteriores.fixas),
  };
  if (deveMostrarRetomada({ ...semHoje, prefs })) return { ...semHoje, mostrar: true };

  return { ...cru, mostrar: false };
}

/* ------------------------------------------- o que cada escolha grava */

/** Um upsert em `exercise_state` (só as colunas que mudam + a chave). */
export type EscritaDeEstado = Partial<LinhaEstadoExercicio> & {
  user_id: string;
  exercise_id: string;
};

/** Um insert em `progression_events`. */
export type EscritaDeEvento = Omit<LinhaEventoProgressao, "created_at">;

export interface EscritasDaRetomada {
  /** O update de `profiles` (sempre traz `prefs.retomada`). */
  perfil: MudancaDePerfil;
  estados: EscritaDeEstado[];
  eventos: EscritaDeEvento[];
  /** A decisão que vai para as prefs, já pronta. */
  decisao: RetomadaGravada;
}

/** O perfil de que a retomada precisa (o que ela lê e o que ela escreve). */
export interface PerfilDaRetomada {
  user_id: string;
  semana_corrida: number;
  semana_corda: number;
  semana_fixa: number;
  prefs: Prefs;
}

export interface EntradaDasEscritas {
  escolha: EscolhaRetomada;
  dias: number;
  hoje: Data;
  perfil: PerfilDaRetomada;
  /** As linhas de `exercise_state` do usuário (todas). */
  estados?: readonly LinhaEstadoExercicio[];
  /** Os pesos de barra do §3.9, para os 60 % caírem numa carga possível. */
  montagem?: OpcoesMontagem;
  /** De onde saem os ids dos eventos (uuid do cliente). */
  novoId: () => string;
}

/** Uma semana de plano volta um degrau, com o piso em 1 (SPEC §18.2). */
export function semanaAnterior(semana: number): number {
  return Math.max(1, Math.round(semana) - 1);
}

/** Os 60 % da §6.2: arredondados para baixo na escala do implemento. */
export function cargaLeve(
  carga: number,
  exercicioId: string,
  opcoes?: OpcoesMontagem,
): number {
  const exercicio = exercicioPorId.get(exercicioId);
  if (!exercicio) return carga;
  const base = alcancavelParaBaixo(carga, exercicio.implemento, opcoes);
  return Math.min(
    base,
    alcancavelParaBaixo(base * FRACAO_LEVE, exercicio.implemento, opcoes),
  );
}

/**
 * As linhas que a escolha grava (SPEC §18.2). Nada aqui toca no banco: quem
 * enfileira é `lib/queries/retomada.ts`, pelos caminhos que já existem.
 */
export function escritasDaRetomada({
  escolha,
  dias,
  hoje,
  perfil,
  estados = [],
  montagem,
  novoId,
}: EntradaDasEscritas): EscritasDaRetomada {
  const data = typeof hoje === "string" ? hoje : iso(hoje);
  const decisao: RetomadaGravada = { em: data, dias: Math.max(0, Math.round(dias)), escolha };
  const vazio: EscritasDaRetomada = {
    perfil: { prefs: comRetomada(perfil.prefs, decisao) },
    estados: [],
    eventos: [],
    decisao,
  };

  if (escolha === "continuar") return vazio;

  const semanasUmAtras: MudancaDePerfil = {
    semana_corrida: semanaAnterior(perfil.semana_corrida),
    semana_corda: semanaAnterior(perfil.semana_corda),
    semana_fixa: semanaAnterior(perfil.semana_fixa),
  };

  if (escolha === "semana") {
    return { ...vazio, perfil: { ...vazio.perfil, ...semanasUmAtras } };
  }

  /*
   * "Voltar mais leve" (SPEC §18.2): os MESMOS campos que a 3ª falha da §6.2
   * escreve. O motor não sabe que houve pausa — ele vê semana leve e devolve a
   * carga cheia na sessão seguinte, como sempre fez.
   */
  if (escolha === "leve") {
    const linhas: EscritaDeEstado[] = [];
    const eventos: EscritaDeEvento[] = [];
    for (const e of estados) {
      // exercício desligado no catálogo do usuário: não entra em nada (§3.9)
      if (e.desativado) continue;
      // já estava em semana leve: mexer aqui apagaria a `carga_antes_leve` dele
      if (e.semana_leve) continue;
      const carga = e.carga_atual_kg;
      // peso corporal (carga 0) e linhas sem carga não têm o que aliviar
      if (carga === null || carga <= 0) continue;
      const leve = cargaLeve(carga, e.exercise_id, montagem);
      // sem degrau abaixo na escala do implemento: uma "semana leve" que não
      // alivia nada só atrapalharia o motor na sessão seguinte
      if (leve >= carga) continue;
      linhas.push({
        user_id: perfil.user_id,
        exercise_id: e.exercise_id,
        carga_atual_kg: leve,
        carga_antes_leve: carga,
        semana_leve: true,
      });
      eventos.push({
        id: novoId(),
        user_id: perfil.user_id,
        exercise_id: e.exercise_id,
        session_id: null,
        data,
        de: { carga_kg: carga },
        para: { carga_kg: leve, semana_leve: true, dias_parado: decisao.dias },
        motivo: "retomada_leve",
      });
    }
    return {
      ...vazio,
      perfil: { ...vazio.perfil, ...semanasUmAtras },
      estados: linhas,
      eventos,
    };
  }

  /*
   * "Recomeçar do zero" (SPEC §18.2): cada linha de `exercise_state` volta ao
   * estado inicial da §6.1. `reps_alvo`, `tempo_alvo_s` e `assistencia` voltam
   * a `null` — é assim que o motor guarda "nunca fez", e na próxima sessão eles
   * valem o mínimo da faixa DAQUELE treino, não o do catálogo. Ficam como
   * estavam o override de incremento, o `desativado` e as notas: são ajustes do
   * equipamento e da pessoa, não progresso. Nada é apagado no histórico.
   */
  const linhas: EscritaDeEstado[] = [];
  const eventos: EscritaDeEvento[] = [];
  for (const e of estados) {
    const exercicio = exercicioPorId.get(e.exercise_id);
    // linha de um exercício que não está mais no catálogo: fica como está
    if (!exercicio) continue;
    const inicial = estadoInicial(exercicio);
    linhas.push({
      user_id: perfil.user_id,
      exercise_id: e.exercise_id,
      carga_atual_kg: inicial.carga_atual_kg,
      reps_alvo: null,
      tempo_alvo_s: null,
      assistencia: null,
      falhas_seguidas: 0,
      incremento_reduzido: false,
      exigir_rep_extra: false,
      semana_leve: false,
      carga_antes_leve: null,
      sessoes_graca: 0,
    });
    eventos.push({
      id: novoId(),
      user_id: perfil.user_id,
      exercise_id: e.exercise_id,
      session_id: null,
      data,
      de: { carga_kg: e.carga_atual_kg, reps_alvo: e.reps_alvo },
      para: { carga_kg: inicial.carga_atual_kg, reps_alvo: null },
      motivo: "recomeco",
    });
  }
  // e um evento do programa inteiro, como a troca de fase da §5.1
  eventos.push({
    id: novoId(),
    user_id: perfil.user_id,
    exercise_id: null,
    session_id: null,
    data,
    de: {
      semana_corrida: perfil.semana_corrida,
      semana_corda: perfil.semana_corda,
      semana_fixa: perfil.semana_fixa,
    },
    para: { semana_corrida: 1, semana_corda: 1, semana_fixa: 1, dias_parado: decisao.dias },
    motivo: "recomeco",
  });

  return {
    ...vazio,
    perfil: {
      ...vazio.perfil,
      semana_corrida: 1,
      semana_corda: 1,
      semana_fixa: 1,
      // o próximo treino volta a ser o Treino A da fase (§5.2 item 3)
      ultimo_treino: null,
      // a fase continua a mesma; só a contagem de semanas recomeça hoje
      fase_desde: data,
    },
    estados: linhas,
    eventos,
  };
}
