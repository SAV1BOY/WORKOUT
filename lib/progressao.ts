/**
 * Motor de progressão (SPEC §6) — funções puras, sem React, Supabase ou Dexie.
 *
 * Entra: o exercício (data/exercicios.json), o estado do exercício
 * (`exercise_state`) e as séries de trabalho da sessão.
 * Sai: o novo estado e o evento que explica a decisão (`progression_events`).
 *
 * Os 22 casos de docs/casos-de-teste-progressao.md são a referência executável
 * destas regras e estão em lib/progressao.test.ts.
 */
import {
  alcancavelParaBaixo,
  capacidadeDoImplemento,
  limiteDoImplemento,
  montagem,
  type Montagem,
  type OpcoesMontagem,
} from "@/lib/montagem";
import type {
  Assistencia,
  Exercicio,
  ExercicioDoTreino,
  PrescricaoTipo,
} from "@/lib/schemas";
import type { LinhaEstadoExercicio, MotivoProgressao, TipoSerie } from "@/lib/types";

/* ------------------------------------------------------------ constantes */

/** Menor passo possível com este estoque de anilhas: 1 kg de cada lado. */
export const PASSO_MINIMO_KG = 2;

/** Degraus da ajuda do elástico, do mais fácil para o mais difícil. */
export const DEGRAUS_ASSISTENCIA: readonly Assistencia[] = [
  "pe_inteiro",
  "joelho",
  "joelho_dobrado",
  "sem",
];

/** Sessões em que a queda de reps depois de mudar o degrau não conta falha. */
export const SESSOES_DE_GRACA = 2;

/** SPEC §6.3: 3 séries chegando a 10 sugerem a barra fixa com lastro. */
export const REPS_PARA_SUGERIR_LASTRO = 10;

/** SPEC §6.3: peso corporal acima de 20 reps em todas as séries pede anilha. */
export const REPS_PARA_SUGERIR_ANILHA = 20;

/* ----------------------------------------------------------------- tipos */

/** O estado do exercício, sem as colunas de identidade do banco. */
export type EstadoExercicio = Omit<
  LinhaEstadoExercicio,
  "user_id" | "exercise_id" | "notas" | "updated_at"
>;

/** O alvo do dia: séries, tipo e faixa. Vem do treino ou do catálogo. */
export interface Alvo {
  series: number;
  tipo: PrescricaoTipo;
  min: number | null;
  max: number | null;
  unilateral: boolean;
}

/** Uma série registrada na sessão (o que o motor precisa saber dela). */
export interface SerieFeita {
  concluida: boolean;
  tipo?: TipoSerie;
  reps?: number | null;
  /** Unilateral: o outro lado (vale o menor dos dois). */
  reps_lado2?: number | null;
  tempo_s?: number | null;
  tempo_s_lado2?: number | null;
  passos?: number | null;
  carga_kg?: number | null;
  assistencia?: Assistencia | null;
}

export interface ContextoDecisao {
  /** Prescrição do dia; por padrão, a `prescricao_padrao` do catálogo. */
  prescricao?: Alvo;
  /** O toggle "última repetição saiu firme?" do bloco. Padrão: sim. */
  ultimaFirme?: boolean;
  /** Sessão abandonada: só avalia exercícios com todas as séries registradas. */
  sessaoAbandonada?: boolean;
  /** Tipo `maximo`: as reps da última sessão, série a série. */
  seriesAnteriores?: (number | null)[] | null;
  /** Peso da barra pesado pelo usuário (barra W, barra reta oca). */
  montagem?: OpcoesMontagem;
}

export interface EventoProgressao {
  motivo: MotivoProgressao;
  de: Record<string, unknown>;
  para: Record<string, unknown>;
  /** A decisão veio de uma falha (série abaixo do piso da faixa). */
  falha?: boolean;
  aviso?: string;
  sugestao?: string;
}

export interface Decisao {
  novoEstado: EstadoExercicio;
  evento: EventoProgressao | null;
}

export interface AlvoDeHoje {
  carga_kg: number | null;
  tipo: PrescricaoTipo;
  /** Piso da faixa (o que o estado guarda na primeira vez). */
  alvo_min: number | null;
  /**
   * Topo efetivo: o que precisa bater em todas as séries para subir — e o que
   * a tela pré-preenche em cada série (SPEC §3.2).
   */
  alvo_max: number | null;
  reps_alvo_min: number | null;
  reps_alvo_max: number | null;
  /**
   * O alvo de tempo guardado no estado (SPEC §6.1: mínimo da faixa na primeira
   * vez). Mesmo significado da coluna `exercise_state.tempo_alvo_s`; o topo a
   * bater está em `alvo_max`.
   */
  tempo_alvo_s: number | null;
  /** Idem para passos: o piso da faixa (o topo a bater está em `alvo_max`). */
  passos_alvo: number | null;
  assistencia: Assistencia | null;
  semana_leve: boolean;
  exigir_rep_extra: boolean;
  incremento_kg: number;
  montagem: Montagem | null;
  primeira_vez: boolean;
}

/* --------------------------------------------------------- prescrições */

export function prescricaoPadrao(exercicio: Exercicio): Alvo {
  const p = exercicio.prescricao_padrao;
  return {
    series: p.series ?? 1,
    tipo: p.tipo,
    min: p.min,
    max: p.max,
    unilateral: p.unilateral,
  };
}

/** A prescrição do treino (programa.json) vence a do catálogo. */
export function prescricaoDoTreino(
  item: ExercicioDoTreino,
  exercicio: Exercicio,
): Alvo {
  return {
    series: item.series,
    tipo: item.reps.tipo,
    min: item.reps.min,
    max: item.reps.max,
    unilateral: exercicio.prescricao_padrao.unilateral,
  };
}

/* -------------------------------------------------------------- estado */

/** O estado de quem nunca fez o exercício (SPEC §6.1). */
export function estadoInicial(
  exercicio: Exercicio,
  prescricao: Alvo = prescricaoPadrao(exercicio),
): EstadoExercicio {
  const tipo = exercicio.progressao.tipo;
  return {
    carga_atual_kg: exercicio.carga_inicial.kg,
    reps_alvo:
      tipo === "reps" || tipo === "reps_depois_lastro" ? prescricao.min : null,
    tempo_alvo_s: tipo === "tempo" ? prescricao.min : null,
    assistencia: tipo === "assistencia" ? "pe_inteiro" : null,
    incremento_kg: null,
    falhas_seguidas: 0,
    incremento_reduzido: false,
    exigir_rep_extra: false,
    semana_leve: false,
    carga_antes_leve: null,
    sessoes_graca: 0,
    desativado: false,
  };
}

/** Incremento de carga válido agora (com a metade das 2 falhas, se for o caso). */
export function incrementoDe(
  exercicio: Exercicio,
  estado?: EstadoExercicio | null,
): number {
  const base = estado?.incremento_kg ?? exercicio.progressao.incremento_kg ?? 0;
  if (base <= 0) return 0;
  if (!estado?.incremento_reduzido) return base;
  return Math.max(base / 2, PASSO_MINIMO_KG);
}

/* ------------------------------------------------------- carga de hoje */

/**
 * O que o app pede hoje neste exercício (SPEC §6.1): carga, faixa de reps,
 * tempo, assistência e a montagem da barra pronta para a tela.
 */
export function cargaDeHoje(
  exercicio: Exercicio,
  estado: EstadoExercicio | null,
  prescricao: Alvo = prescricaoPadrao(exercicio),
  opcoes: OpcoesMontagem = {},
): AlvoDeHoje {
  const primeiraVez = estado === null;
  const base = estado ?? estadoInicial(exercicio, prescricao);

  /*
   * SPEC §6.1: sem carga gravada vale a `carga_inicial.kg` do JSON — o mesmo
   * fallback que decidir()/subir()/falhar() aplicam (as colunas
   * `exercise_state.carga_atual_kg` e `.assistencia` são anuláveis no schema).
   */
  let carga: number | null = base.carga_atual_kg ?? exercicio.carga_inicial.kg;
  if (base.semana_leve && base.carga_antes_leve !== null) {
    carga = base.carga_antes_leve * 0.6;
  }
  /*
   * SPEC §6.4 e §10.5: toda carga calculada passa por `alcancavel_para_baixo`,
   * então a carga do dia sempre existe na escala do implemento e a montagem da
   * §6.5 fecha exata. Vale sobretudo depois de pesar a barra W ou a reta oca
   * (§3.9): com `pesoBarra` a escala muda e os 2,0 kg do JSON ficam abaixo dela.
   */
  if (carga !== null) {
    carga = alcancavelParaBaixo(carga, exercicio.implemento, opcoes);
  }

  const topo = alvoDeCima(exercicio, base, prescricao);
  return {
    carga_kg: carga,
    tipo: prescricao.tipo,
    alvo_min: prescricao.min,
    alvo_max: topo,
    reps_alvo_min: prescricao.tipo === "reps" ? prescricao.min : null,
    reps_alvo_max:
      prescricao.tipo === "reps" ? alvoDeCima(exercicio, base, prescricao) : null,
    tempo_alvo_s:
      prescricao.tipo === "tempo_s" ? (base.tempo_alvo_s ?? prescricao.min) : null,
    passos_alvo: prescricao.tipo === "passos" ? prescricao.min : null,
    assistencia:
      base.assistencia ??
      (exercicio.progressao.tipo === "assistencia"
        ? (DEGRAUS_ASSISTENCIA[0] ?? null)
        : null),
    semana_leve: base.semana_leve,
    exigir_rep_extra: base.exigir_rep_extra,
    incremento_kg: incrementoDe(exercicio, base),
    montagem: carga === null ? null : montagem(carga, exercicio.implemento, opcoes),
    primeira_vez: primeiraVez,
  };
}

/**
 * Topo efetivo da faixa: o maior entre o topo da prescrição e o alvo já
 * conquistado no estado (reps_alvo / tempo_alvo_s), que pode passar da faixa.
 */
function alvoDeCima(
  exercicio: Exercicio,
  estado: EstadoExercicio,
  prescricao: Alvo,
): number | null {
  const doPlano = prescricao.max;
  const tipo = exercicio.progressao.tipo;
  const doEstado =
    tipo === "reps" || tipo === "reps_depois_lastro"
      ? estado.reps_alvo
      : tipo === "tempo"
        ? estado.tempo_alvo_s
        : null;
  if (doPlano === null) return doEstado;
  if (doEstado === null) return doPlano;
  return Math.max(doPlano, doEstado);
}

/* ------------------------------------------------------------- decisão */

function valorDaSerie(s: SerieFeita, prescricao: Alvo): number | null {
  if (!s.concluida) return null;
  const menor = (a?: number | null, b?: number | null): number | null => {
    if (a === null || a === undefined) return null;
    if (!prescricao.unilateral || b === null || b === undefined) return a;
    return Math.min(a, b);
  };
  switch (prescricao.tipo) {
    case "reps":
    case "maximo":
      return menor(s.reps, s.reps_lado2);
    case "tempo_s":
      return menor(s.tempo_s, s.tempo_s_lado2);
    case "passos":
      return menor(s.passos, null);
    default:
      return null;
  }
}

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

function proximoDegrau(atual: Assistencia | null): Assistencia | null {
  const i = DEGRAUS_ASSISTENCIA.indexOf(atual ?? "pe_inteiro");
  return DEGRAUS_ASSISTENCIA[i + 1] ?? null;
}

function foto(
  estado: EstadoExercicio,
  exercicio: Exercicio,
): Record<string, unknown> {
  switch (exercicio.progressao.tipo) {
    case "assistencia":
      return { assistencia: estado.assistencia };
    case "tempo":
      return { tempo_alvo_s: estado.tempo_alvo_s };
    case "reps":
      return { reps_alvo: estado.reps_alvo };
    case "reps_depois_lastro":
      return { reps_alvo: estado.reps_alvo, carga_kg: estado.carga_atual_kg };
    default:
      return { carga_kg: estado.carga_atual_kg };
  }
}

type Classe = "sucesso" | "manteve" | "falha";

/**
 * A decisão do motor ao concluir a sessão, exercício por exercício
 * (SPEC §6.2–6.4). Só recebe séries de trabalho; aquecimento é descartado.
 */
export function decidir(
  exercicio: Exercicio,
  estado: EstadoExercicio | null,
  seriesTrabalho: SerieFeita[],
  contexto: ContextoDecisao = {},
): Decisao {
  const prescricao = contexto.prescricao ?? prescricaoPadrao(exercicio);
  const antes: EstadoExercicio = estado
    ? { ...estado }
    : estadoInicial(exercicio, prescricao);
  const nada: Decisao = { novoEstado: antes, evento: null };

  if (antes.desativado) return nada;
  if (
    exercicio.progressao.tipo === "plano_corda" ||
    prescricao.tipo === "ver_cardio_corda"
  ) {
    return nada;
  }

  const series = seriesTrabalho.filter((s) => (s.tipo ?? "trabalho") === "trabalho");
  if (series.length === 0) return nada;

  // SPEC §6: a entrada são "as séries de trabalho da sessão" — uma série a mais
  // do que a prescrição também é avaliada (§6.2: falha = ALGUMA série de
  // trabalho abaixo do piso ou não concluída).
  const esperadas = Math.max(prescricao.series, 1, series.length);
  const valores: (number | null)[] = [];
  for (let i = 0; i < esperadas; i++) {
    const s = series[i];
    valores.push(s ? valorDaSerie(s, prescricao) : null);
  }
  const completas = valores.every((v) => v !== null);

  // Sessão abandonada: só avalia quem tem todas as séries registradas.
  if (contexto.sessaoAbandonada && !completas) return nada;

  const opcoes = contexto.montagem ?? {};
  const depois: EstadoExercicio = { ...antes };
  const de = foto(antes, exercicio);

  // Consome uma sessão de graça (mudança de degrau do elástico).
  const naGraca = antes.sessoes_graca > 0;
  if (naGraca) depois.sessoes_graca = antes.sessoes_graca - 1;

  /* ---- a sessão da semana leve: volta à carga de antes (SPEC §6.2) ---- */
  if (antes.semana_leve) {
    const volta = antes.carga_antes_leve ?? antes.carga_atual_kg;
    depois.carga_atual_kg = volta;
    depois.carga_antes_leve = null;
    depois.semana_leve = false;
    depois.incremento_reduzido = false;
    depois.exigir_rep_extra = false;
    depois.falhas_seguidas = 0;
    return {
      novoEstado: depois,
      evento: {
        motivo: "fim_semana_leve",
        de,
        para: foto(depois, exercicio),
      },
    };
  }

  /* ------------------------- tipo `maximo`: melhorar a média ---------- */
  if (prescricao.tipo === "maximo") {
    return decidirMaximo(exercicio, antes, depois, valores, contexto, de);
  }

  /* -------------------------------- classificação (SPEC §6.2) --------- */
  const topo = alvoDeCima(exercicio, antes, prescricao);
  const piso = prescricao.min ?? topo;
  const paraSubir = topo === null ? null : topo + (antes.exigir_rep_extra ? 1 : 0);
  const firme = contexto.ultimaFirme ?? true;

  const abaixoDoPiso = valores.some((v) => v === null || (piso !== null && v < piso));
  const noTopo =
    paraSubir !== null && valores.every((v) => v !== null && v >= paraSubir);

  let classe: Classe = abaixoDoPiso
    ? "falha"
    : noTopo && firme
      ? "sucesso"
      : "manteve";

  // Quedas dentro da graça não contam falha.
  if (classe === "falha" && naGraca) classe = "manteve";

  const decisao: Decisao =
    classe === "sucesso"
      ? subir(exercicio, antes, depois, prescricao, valores, opcoes, de)
      : classe === "manteve"
        ? {
            novoEstado: depois,
            evento: { motivo: "repetiu", de, para: foto(depois, exercicio) },
          }
        : falhar(exercicio, antes, depois, opcoes, de);

  // SPEC §6.3: a sugestão da anilha depende só de passar de 20 reps em todas as
  // séries, não de ter subido nesta sessão.
  const anilha = sugestaoDaAnilha(exercicio, valores);
  if (anilha && decisao.evento && !decisao.evento.sugestao) {
    decisao.evento.sugestao = anilha;
  }
  return decisao;
}

/**
 * SPEC §6.3 (peso corporal com faixa): "acima de 20 reps em todas as séries,
 * sugere anilha (2 kg) e volta ao piso da faixa".
 */
function sugestaoDaAnilha(
  exercicio: Exercicio,
  valores: (number | null)[],
): string | null {
  const tipo = exercicio.progressao.tipo;
  if (tipo !== "reps" && tipo !== "reps_depois_lastro") return null;
  const feitas = valores.filter((v): v is number => v !== null);
  if (feitas.length === 0 || feitas.length !== valores.length) return null;
  if (!feitas.every((v) => v >= REPS_PARA_SUGERIR_ANILHA)) return null;
  return `Mais de ${REPS_PARA_SUGERIR_ANILHA} repetições em todas as séries: use uma anilha de 2 kg e volte ao piso da faixa.`;
}

/* ------------------------------------------------------------- subidas */

function subir(
  exercicio: Exercicio,
  antes: EstadoExercicio,
  depois: EstadoExercicio,
  prescricao: Alvo,
  valores: (number | null)[],
  opcoes: OpcoesMontagem,
  de: Record<string, unknown>,
): Decisao {
  depois.falhas_seguidas = 0;

  const pronto = (
    motivo: MotivoProgressao,
    extra: Partial<EventoProgressao> = {},
  ): Decisao => ({
    novoEstado: depois,
    evento: {
      motivo,
      de,
      para: foto(depois, exercicio),
      ...extra,
    },
  });

  switch (exercicio.progressao.tipo) {
    case "assistencia": {
      const degrau = proximoDegrau(antes.assistencia);
      if (degrau === null) {
        // já está sem elástico: a evolução daqui é outro exercício
        return pronto("repetiu", {
          sugestao:
            "Sem elástico em todas as séries: passe para a barra fixa com lastro.",
        });
      }
      depois.assistencia = degrau;
      depois.sessoes_graca = SESSOES_DE_GRACA;
      return pronto("subiu");
    }

    case "tempo": {
      const topo = alvoDeCima(exercicio, antes, prescricao) ?? 0;
      const passo = exercicio.progressao.incremento_s ?? 5;
      depois.tempo_alvo_s = topo + passo;
      depois.incremento_reduzido = false;
      depois.exigir_rep_extra = false;
      const acimaDaFaixa =
        prescricao.max !== null && depois.tempo_alvo_s > prescricao.max;
      return pronto(
        "subiu",
        acimaDaFaixa
          ? {
              sugestao:
                "Tempo acima da faixa do plano: troque por uma variação mais difícil.",
            }
          : {},
      );
    }

    case "reps":
    case "reps_depois_lastro": {
      const topo = alvoDeCima(exercicio, antes, prescricao) ?? 0;
      const passo = exercicio.progressao.incremento_reps ?? 1;
      depois.reps_alvo = topo + passo;
      depois.incremento_reduzido = false;
      depois.exigir_rep_extra = false;
      return pronto("subiu");
    }

    default: {
      // progressão por carga
      const atual = antes.carga_atual_kg ?? exercicio.carga_inicial.kg;
      const incremento = incrementoDe(exercicio, antes);
      const nova = alcancavelParaBaixo(
        atual + incremento,
        exercicio.implemento,
        opcoes,
      );
      if (incremento <= 0 || nova <= atual) {
        // Teto: ou faltam anilhas (SPEC §6.4, marco do guia) ou a barra chegou
        // à capacidade — aí comprar anilhas não sobe 1 kg.
        depois.carga_atual_kg = atual;
        return pronto("repetiu", { aviso: avisoDeTeto(exercicio, opcoes) });
      }
      depois.carga_atual_kg = nova;
      depois.incremento_reduzido = false;
      depois.exigir_rep_extra = false;
      return pronto("subiu");
    }
  }
}

/**
 * O aviso de quem encostou no teto do implemento (SPEC §6.4): só é falta de
 * anilhas quando o estoque acaba antes da capacidade da barra.
 */
function avisoDeTeto(exercicio: Exercicio, opcoes: OpcoesMontagem): string {
  if (limiteDoImplemento(exercicio.implemento, opcoes) === "estoque") {
    return "faltam anilhas de 10 kg (marco do guia)";
  }
  const capacidade = capacidadeDoImplemento(exercicio.implemento, opcoes);
  const kg = String(capacidade).replace(".", ",");
  return `no limite do implemento (capacidade ${kg} kg): comprar anilhas não sobe a carga`;
}

/* -------------------------------------------------------------- falhas */

function falhar(
  exercicio: Exercicio,
  antes: EstadoExercicio,
  depois: EstadoExercicio,
  opcoes: OpcoesMontagem,
  de: Record<string, unknown>,
): Decisao {
  const falhas = antes.falhas_seguidas + 1;
  depois.falhas_seguidas = falhas;
  // Estado parcial vindo do banco: sem carga registrada vale a carga inicial do
  // JSON (SPEC §6.1), a mesma leitura que subir() faz.
  const carga = antes.carga_atual_kg ?? exercicio.carga_inicial.kg;
  const temCarga = exercicio.progressao.tipo === "carga" && carga !== null && carga > 0;

  // 1ª falha (ou exercício sem carga para reduzir): repete a mesma coisa.
  if (falhas === 1 || !temCarga) {
    if (falhas >= 3) depois.falhas_seguidas = 0;
    return {
      novoEstado: depois,
      evento: { motivo: "repetiu", de, para: foto(depois, exercicio), falha: true },
    };
  }

  /*
   * SPEC §6.2 (× 0,90 e × 0,60) com a §6.4 ("a carga possível mais próxima
   * para baixo"): `alcancavelParaBaixo` devolve o mínimo da escala quando o
   * alvo fica abaixo dela, e uma carga do banco abaixo da barra vazia (ou uma
   * barra pesada depois, §3.9) faria a "queda" virar aumento. Reduzir nunca
   * sobe: fica o menor entre a carga de antes e a alcançável.
   */
  const reduzir = (fator: number): number =>
    Math.min(
      carga as number,
      alcancavelParaBaixo((carga as number) * fator, exercicio.implemento, opcoes),
    );

  // 2ª falha seguida: −10 % e incremento pela metade (mínimo 2 kg).
  if (falhas === 2) {
    depois.carga_atual_kg = reduzir(0.9);
    depois.incremento_reduzido = true;
    const base = antes.incremento_kg ?? exercicio.progressao.incremento_kg ?? 0;
    depois.exigir_rep_extra = base / 2 < PASSO_MINIMO_KG;
    return {
      novoEstado: depois,
      evento: {
        motivo: "falha_2x_voltou_10",
        de,
        para: foto(depois, exercicio),
        falha: true,
      },
    };
  }

  // 3ª falha: semana leve a 60 %, mesmas séries; volta depois à carga de antes.
  depois.carga_antes_leve = carga;
  depois.carga_atual_kg = reduzir(0.6);
  depois.semana_leve = true;
  depois.falhas_seguidas = 0;
  return {
    novoEstado: depois,
    evento: {
      motivo: "semana_leve_60",
      de,
      para: foto(depois, exercicio),
      falha: true,
    },
  };
}

/* -------------------------------------------------- tipo `maximo` §6.3 */

/**
 * Sucesso no tipo `maximo` (SPEC §6.3): média ≥ média anterior + 1. A conta é
 * feita em inteiros (soma × nº de séries) porque a média vira dízima quando a
 * soma não é múltipla do número de séries: em ponto flutuante 13/3 fica
 * *menor* que 10/3 + 1 e +1 rep em todas as séries deixaria de subir.
 */
function mediaSubiu(
  somaAgora: number,
  nAgora: number,
  somaAntes: number,
  nAntes: number,
): boolean {
  return somaAgora * nAntes >= (somaAntes + nAntes) * nAgora;
}

/** Média de hoje ≥ média anterior (sem exigir o +1), na mesma aritmética. */
function mediaNaoCaiu(
  somaAgora: number,
  nAgora: number,
  somaAntes: number,
  nAntes: number,
): boolean {
  return somaAgora * nAntes >= somaAntes * nAgora;
}

function decidirMaximo(
  exercicio: Exercicio,
  antes: EstadoExercicio,
  depois: EstadoExercicio,
  valores: (number | null)[],
  contexto: ContextoDecisao,
  de: Record<string, unknown>,
): Decisao {
  const feitas = valores.map((v) => v ?? 0);
  const mediaAgora = media(feitas);
  const anteriores = (contexto.seriesAnteriores ?? []).map((v) => v ?? 0);

  /*
   * SPEC §6.3 / data/progressao.json ("sem carga até 3 × 10 limpas; depois
   * anilha de 2 kg na mochila"): a sugestão do lastro depende só de chegar a 3
   * séries de 10 — não de melhorar a média nesta sessão nem de existir uma
   * sessão anterior. Vale para a barra fixa (progressão `reps_depois_lastro`),
   * não para flexão e mergulho.
   */
  const tresNoTeto =
    exercicio.progressao.tipo === "reps_depois_lastro" &&
    feitas.filter((v) => v >= REPS_PARA_SUGERIR_LASTRO).length >= 3;
  const extra: Partial<EventoProgressao> = tresNoTeto
    ? {
        sugestao:
          "Três séries de 10 repetições: passe para a barra fixa com lastro (2 kg na mochila).",
      }
    : {};

  // Sem referência anterior: a sessão só registra a média (e, se já forem 3
  // séries de 10, a sugestão do lastro sai mesmo assim — caso 15).
  if (anteriores.length === 0 && antes.reps_alvo === null) {
    depois.reps_alvo = Math.round(mediaAgora);
    return {
      novoEstado: depois,
      evento: tresNoTeto
        ? { motivo: "repetiu", de, para: foto(depois, exercicio), ...extra }
        : null,
    };
  }

  const somaAgora = feitas.reduce((s, v) => s + v, 0);
  const nAgora = Math.max(feitas.length, 1);
  const comAnteriores = anteriores.length > 0;
  const somaAntes = comAnteriores
    ? anteriores.reduce((s, v) => s + v, 0)
    : (antes.reps_alvo ?? 0);
  const nAntes = comAnteriores ? anteriores.length : 1;

  const caiuEmAlguma = valores.some((v, i) => {
    const anterior = anteriores[i];
    if (anterior === undefined) return false;
    return v === null || v < anterior;
  });

  if (mediaSubiu(somaAgora, nAgora, somaAntes, nAntes) && !caiuEmAlguma) {
    depois.reps_alvo = Math.round(mediaAgora);
    depois.falhas_seguidas = 0;
    return {
      novoEstado: depois,
      evento: { motivo: "subiu", de, para: foto(depois, exercicio), ...extra },
    };
  }

  if (mediaNaoCaiu(somaAgora, nAgora, somaAntes, nAntes)) {
    return {
      novoEstado: depois,
      evento: { motivo: "repetiu", de, para: foto(depois, exercicio), ...extra },
    };
  }

  depois.falhas_seguidas = antes.falhas_seguidas + 1;
  if (depois.falhas_seguidas >= 3) depois.falhas_seguidas = 0;
  return {
    novoEstado: depois,
    evento: {
      motivo: "repetiu",
      de,
      para: foto(depois, exercicio),
      falha: true,
      ...extra,
    },
  };
}
