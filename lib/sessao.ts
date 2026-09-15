/**
 * Adaptadores puros da sessão de força (SPEC §3.2, §6.5, §6.6, §8).
 *
 * Aqui mora tudo que a sessão *é*: montar as linhas do treino a partir do
 * programa e do estado de cada exercício, mexer nelas, virar escritas da fila
 * de saída e, no fim, passar as séries de trabalho pelo motor (`decidir`).
 * Nenhuma dependência de React, Supabase ou Dexie — tudo aqui é função pura.
 *
 * As regras não são reimplementadas: quem decide é `lib/progressao.ts`, quem
 * monta as anilhas é `lib/montagem.ts` e o conteúdo vem de `lib/dados.ts`.
 */
import { acharExercicio, acharTreino, equipamentoDisponivel, exercicios } from "@/lib/dados";
import { formatarKg, formatarNumero, rotuloDaCarga } from "@/lib/formato";
import {
  alcancavelParaBaixo,
  cargaMaxima,
  cargaMinima,
  cargasPossiveis,
  montagem as montarAnilhas,
  type ImplementoMontagem,
  type OpcoesMontagem,
} from "@/lib/montagem";
import {
  cargaDeHoje,
  decidir,
  prescricaoDoTreino,
  prescricaoPadrao,
  type Alvo,
  type AlvoDeHoje,
  type Decisao,
  type EstadoExercicio,
  type SerieFeita,
} from "@/lib/progressao";
import type { Assistencia, Exercicio, FaseId, TreinoId } from "@/lib/schemas";
import type {
  LinhaEstadoExercicio,
  LinhaSerie,
  LinhaSessao,
  MotivoProgressao,
  StatusSessao,
  TipoSerie,
  WorkoutId,
} from "@/lib/types";

/* ----------------------------------------------------------------- tipos */

/**
 * O que `sessions.workout_id` pode ser: um treino do programa, "livre" (treino
 * fora do plano) ou "fixa", a sessão de barra fixa da SPEC §3.4 — que não é um
 * treino do programa e por isso não mexe na alternância da §5.2.
 */
export type { WorkoutId };

/** É um treino do programa (só eles avançam `profiles.ultimo_treino`)? */
export function ehTreinoDoPrograma(id: WorkoutId): id is TreinoId {
  return id !== "livre" && id !== "fixa";
}

/** Uma linha de série na tela e no `session_sets`. */
export interface SerieLocal {
  /** uuid gerado no cliente (SPEC §8: dá para criar offline). */
  id: string;
  setIndex: number;
  tipo: TipoSerie;
  repsAlvoMin: number | null;
  repsAlvoMax: number | null;
  reps: number | null;
  /** Unilateral: o outro lado (o motor usa o menor dos dois). */
  repsLado2: number | null;
  cargaKg: number | null;
  tempoS: number | null;
  tempoSLado2: number | null;
  passos: number | null;
  assistencia: Assistencia | null;
  concluida: boolean;
  registradaEm: string | null;
}

/** Um exercício da sessão, com o que o motor precisa saber dele. */
export interface BlocoLocal {
  /** Posição no treino (1..n) — vira `session_sets.ordem_ex`. */
  ordem: number;
  /** Quem foi registrado hoje (o substituto, quando houve troca). */
  exercicioId: string;
  /** O exercício do programa; a progressão dele não muda se houve troca. */
  originalId: string;
  substituido: boolean;
  prescricao: Alvo;
  descansoS: number;
  /** "2–3 min", "90 s" — o texto do programa (data/programa.json). */
  descansoTexto: string;
  /** A carga/faixa que o motor pediu hoje, congelada no início da sessão. */
  alvo: AlvoDeHoje;
  /** `exercise_state` como estava no início (a conclusão funciona offline). */
  estado: EstadoExercicio | null;
  /**
   * O `exercise_state` deste exercício foi **lido de verdade**? `null` acima
   * quer dizer "nunca fez este exercício"; quando nem isso dá para afirmar
   * (substituir hoje sem conseguir ler o estado do substituto, SPEC §6.3),
   * este campo é `false` e o bloco não é avaliado nem gravado: melhor não
   * avaliar do que apagar a progressão real do exercício.
   */
  estadoConhecido: boolean;
  /** Tipo `maximo`: as reps da última sessão, série a série (SPEC §6.3). */
  seriesAnteriores: (number | null)[] | null;
  /** Recordes antes desta sessão (view `v_records`), para o resumo. */
  recordeCarga: number | null;
  recordeReps: number | null;
  recordeE1rm: number | null;
  series: SerieLocal[];
  /** "Última repetição saiu firme?"; `null` = ainda vale o padrão calculado. */
  ultimaFirme: boolean | null;
  nota: string | null;
}

/** A sessão inteira, como ela vive no IndexedDB (SPEC §8). */
export interface SessaoLocal {
  id: string;
  userId: string;
  data: string;
  workoutId: WorkoutId;
  fase: FaseId;
  status: StatusSessao;
  iniciadaEm: string;
  concluidaEm: string | null;
  sensacao: number | null;
  pesoCorporal: number | null;
  notas: string | null;
  /** Barra W / reta oca já pesadas na balança (SPEC §3.9). */
  opcoesMontagem: OpcoesMontagem;
  blocos: BlocoLocal[];
}

/* ------------------------------------------------------------ montagem */

export interface EntradaMontagem {
  id: string;
  userId: string;
  data: string;
  treinoId: TreinoId;
  fase: FaseId;
  /** `exercise_state` por exercício. */
  estados?: Record<string, EstadoExercicio | null>;
  /**
   * `estados` veio de uma leitura que deu certo? `false` quando a tela não
   * conseguiu ler `exercise_state` (offline sem cache): a sessão registra as
   * séries normalmente, mas não avalia nem grava a progressão.
   */
  estadoConhecido?: boolean;
  /** Tipo `maximo`: reps da última sessão por exercício (SPEC §6.3). */
  anteriores?: Record<string, (number | null)[]>;
  /** `v_records` por exercício, para o resumo do fim (SPEC §6.6). */
  recordes?: Record<string, RecordeAntes>;
  opcoesMontagem?: OpcoesMontagem;
  /** Quando a sessão começou (ISO). */
  agora?: string;
  /** Gerador de id das séries — injetado para os testes serem determinísticos. */
  novoId?: () => string;
}

export interface RecordeAntes {
  carga_max_kg?: number | null;
  reps_max?: number | null;
  e1rm_epley?: number | null;
}

let contador = 0;
function idPadrao(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  contador += 1;
  return `serie-${contador}`;
}

/** Só implementos com escala de carga têm aquecimento com barra (SPEC §3.2). */
function temCarga(alvo: AlvoDeHoje): boolean {
  return alvo.carga_kg !== null && alvo.carga_kg > 0;
}

/** O valor que a tela pré-preenche em cada série (topo da faixa, SPEC §3.2). */
function prefixoDoAlvo(alvo: AlvoDeHoje): {
  reps: number | null;
  tempoS: number | null;
  passos: number | null;
} {
  const topo = alvo.alvo_max;
  if (alvo.tipo === "tempo_s") return { reps: null, tempoS: topo, passos: null };
  if (alvo.tipo === "passos") return { reps: null, tempoS: null, passos: topo };
  if (alvo.tipo === "maximo") return { reps: null, tempoS: null, passos: null };
  return { reps: topo, tempoS: null, passos: null };
}

function serieDeTrabalho(
  setIndex: number,
  alvo: AlvoDeHoje,
  prescricao: Alvo,
  novoId: () => string,
): SerieLocal {
  const pre = prefixoDoAlvo(alvo);
  return {
    id: novoId(),
    setIndex,
    tipo: "trabalho",
    repsAlvoMin: alvo.alvo_min,
    repsAlvoMax: alvo.alvo_max,
    reps: pre.reps,
    repsLado2: prescricao.unilateral ? pre.reps : null,
    cargaKg: alvo.carga_kg,
    tempoS: pre.tempoS,
    tempoSLado2: prescricao.unilateral ? pre.tempoS : null,
    passos: pre.passos,
    assistencia: alvo.assistencia,
    concluida: false,
    registradaEm: null,
  };
}

/** SPEC §3.2: barra vazia × 5 e metade da carga × 5, sempre alcançáveis. */
export const REPS_DE_AQUECIMENTO = 5;

export function seriesDeAquecimento(
  exercicio: Exercicio,
  alvo: AlvoDeHoje,
  opcoes: OpcoesMontagem,
  novoId: () => string,
): SerieLocal[] {
  if (!temCarga(alvo)) return [];
  const implemento = exercicio.implemento as ImplementoMontagem;
  const vazia = cargaMinima(implemento, opcoes);
  const metade = alcancavelParaBaixo((alvo.carga_kg ?? 0) / 2, implemento, opcoes);
  return [vazia, metade].map((carga, i) => ({
    id: novoId(),
    setIndex: i + 1,
    tipo: "aquecimento" as const,
    repsAlvoMin: REPS_DE_AQUECIMENTO,
    repsAlvoMax: REPS_DE_AQUECIMENTO,
    reps: REPS_DE_AQUECIMENTO,
    repsLado2: null,
    cargaKg: carga,
    tempoS: null,
    tempoSLado2: null,
    passos: null,
    assistencia: null,
    concluida: false,
    registradaEm: null,
  }));
}

/** Um exercício da sessão antes de virar bloco (o programa ou um plano). */
export interface ItemDaSessao {
  exercicioId: string;
  prescricao: Alvo;
  descansoS: number;
  /** "2–3 min", "90 s" — o texto que a tela mostra. */
  descansoTexto: string;
}

/** Os itens de um treino do programa (data/programa.json). */
export function itensDoTreino(id: TreinoId): ItemDaSessao[] {
  return exerciciosDoTreinoTipado(id).map(({ item, exercicio }) => ({
    exercicioId: exercicio.id,
    prescricao: prescricaoDoTreino(item, exercicio),
    descansoS: item.descanso_s,
    descansoTexto: item.descanso_texto,
  }));
}

/**
 * Uma sessão que não vem de um treino do programa (SPEC §3.4: a sessão de
 * barra fixa da semana, com um exercício só e as séries/reps do plano).
 */
export interface EntradaAvulsa extends Omit<EntradaMontagem, "treinoId"> {
  workoutId: WorkoutId;
  itens: ItemDaSessao[];
}

/**
 * As linhas iniciais da sessão, a partir do programa e do estado de cada
 * exercício (SPEC §3.2). O aquecimento entra no **primeiro** exercício pesado
 * (`categoria = composto_pesado`) do treino.
 */
export function montarSessao(e: EntradaMontagem): SessaoLocal {
  const { treinoId, ...resto } = e;
  return montarSessaoAvulsa({
    ...resto,
    workoutId: treinoId,
    itens: itensDoTreino(treinoId),
  });
}

/** A mesma montagem, com os exercícios vindo de fora do programa (§3.4). */
export function montarSessaoAvulsa(e: EntradaAvulsa): SessaoLocal {
  const novoId = e.novoId ?? idPadrao;
  const opcoes = e.opcoesMontagem ?? {};
  const estados = e.estados ?? {};
  const anteriores = e.anteriores ?? {};
  const recordes = e.recordes ?? {};
  const agora = e.agora ?? new Date().toISOString();

  let aquecimentoUsado = false;

  const blocos = e.itens.map((item, i) => {
    const exercicio = acharExercicio(item.exercicioId);
    const prescricao = item.prescricao;
    const estado = estados[exercicio.id] ?? null;
    const alvo = cargaDeHoje(exercicio, estado, prescricao, opcoes);

    const series: SerieLocal[] = [];
    if (!aquecimentoUsado && exercicio.categoria === "composto_pesado") {
      const aquece = seriesDeAquecimento(exercicio, alvo, opcoes, novoId);
      if (aquece.length > 0) {
        series.push(...aquece);
        aquecimentoUsado = true;
      }
    }
    for (let s = 1; s <= prescricao.series; s++) {
      series.push(serieDeTrabalho(s, alvo, prescricao, novoId));
    }

    const rec = recordes[exercicio.id];
    return {
      ordem: i + 1,
      exercicioId: exercicio.id,
      originalId: exercicio.id,
      substituido: false,
      prescricao,
      descansoS: item.descansoS,
      descansoTexto: item.descansoTexto,
      alvo,
      estado,
      estadoConhecido: e.estadoConhecido !== false,
      seriesAnteriores: anteriores[exercicio.id] ?? null,
      recordeCarga: rec?.carga_max_kg ?? null,
      recordeReps: rec?.reps_max ?? null,
      recordeE1rm: rec?.e1rm_epley ?? null,
      series,
      ultimaFirme: null,
      nota: null,
    } satisfies BlocoLocal;
  });

  return {
    id: e.id,
    userId: e.userId,
    data: e.data,
    workoutId: e.workoutId,
    fase: e.fase,
    status: "em_andamento",
    iniciadaEm: agora,
    concluidaEm: null,
    sensacao: null,
    pesoCorporal: null,
    notas: null,
    opcoesMontagem: opcoes,
    blocos,
  };
}

/** `exerciciosDoTreino` com o tipo do item preservado. */
function exerciciosDoTreinoTipado(id: TreinoId) {
  const treino = acharTreino(id);
  return treino.exercicios.map((item) => ({
    item,
    exercicio: acharExercicio(item.exercicio_id),
  }));
}

/**
 * Reconstrói a sessão a partir do que está no banco (a sessão sumiu do
 * aparelho: outro celular, dados do site limpos). As séries gravadas vencem as
 * pré-preenchidas, casadas por `(exercise_id, tipo, set_index)`.
 */
export function reconstruirSessao(
  linha: Pick<LinhaSessao, "id" | "user_id" | "data" | "workout_id" | "fase" | "status" | "iniciada_em">,
  series: LinhaSerie[],
  resto: Omit<EntradaMontagem, "id" | "userId" | "data" | "treinoId" | "fase"> & {
    /** Sessão fora do programa (§3.4): os itens não estão em `programa.json`. */
    itens?: ItemDaSessao[];
  } = {},
): SessaoLocal | null {
  const { itens, ...semItens } = resto;
  /*
   * Um treino "livre" não tem lista de exercícios em lugar nenhum, e uma
   * sessão de barra fixa (§3.4) só dá para refazer com os itens do plano da
   * semana, que a tela passa: sem eles é melhor não refazer nada do que
   * inventar uma sessão diferente da que foi registrada.
   */
  if (linha.workout_id === "livre") return null;
  const doPrograma = ehTreinoDoPrograma(linha.workout_id)
    ? itensDoTreino(linha.workout_id)
    : null;
  const lista = itens ?? doPrograma;
  if (!lista) return null;
  const base = montarSessaoAvulsa({
    ...semItens,
    id: linha.id,
    userId: linha.user_id,
    data: linha.data,
    workoutId: linha.workout_id,
    itens: lista,
    fase: linha.fase,
    agora: linha.iniciada_em,
  });

  const porChave = new Map(
    series.map((s) => [`${s.exercise_id}|${s.tipo}|${s.set_index}`, s] as const),
  );

  return {
    ...base,
    status: linha.status,
    blocos: base.blocos.map((bloco) => ({
      ...bloco,
      series: bloco.series.map((serie) => {
        const gravada = porChave.get(
          `${bloco.exercicioId}|${serie.tipo}|${serie.setIndex}`,
        );
        if (!gravada) return serie;
        return {
          ...serie,
          id: gravada.id,
          reps: gravada.reps,
          repsLado2: gravada.reps_lado2,
          cargaKg: gravada.carga_kg,
          tempoS: gravada.tempo_s,
          tempoSLado2: gravada.tempo_s_lado2,
          passos: gravada.passos,
          assistencia: gravada.assistencia,
          concluida: gravada.concluida,
          registradaEm: gravada.registrada_em,
        } satisfies SerieLocal;
      }),
      ultimaFirme: primeiroFirme(series, bloco.exercicioId),
    })),
  };
}

function primeiroFirme(series: LinhaSerie[], exercicioId: string): boolean | null {
  const com = series.find(
    (s) => s.exercise_id === exercicioId && s.ultima_firme !== null,
  );
  return com?.ultima_firme ?? null;
}

/* ------------------------------------------------------ mexer na sessão */

function trocarBloco(
  sessao: SessaoLocal,
  ordem: number,
  fn: (bloco: BlocoLocal) => BlocoLocal,
): SessaoLocal {
  return {
    ...sessao,
    blocos: sessao.blocos.map((b) => (b.ordem === ordem ? fn(b) : b)),
  };
}

/** Muda campos de uma série (cada toque, SPEC §8). */
export function atualizarSerie(
  sessao: SessaoLocal,
  ordem: number,
  serieId: string,
  campos: Partial<SerieLocal>,
): SessaoLocal {
  return trocarBloco(sessao, ordem, (bloco) => ({
    ...bloco,
    series: bloco.series.map((s) => (s.id === serieId ? { ...s, ...campos } : s)),
  }));
}

/**
 * Marca (ou desmarca) a série como concluída. Ao concluir, a série seguinte
 * ainda em branco herda os valores desta (SPEC §3.2).
 */
export function marcarSerie(
  sessao: SessaoLocal,
  ordem: number,
  serieId: string,
  concluida: boolean,
  agora: string = new Date().toISOString(),
): SessaoLocal {
  return trocarBloco(sessao, ordem, (bloco) => {
    const i = bloco.series.findIndex((s) => s.id === serieId);
    const atual = bloco.series[i];
    if (i < 0 || !atual) return bloco;

    const series = [...bloco.series];
    series[i] = {
      ...atual,
      concluida,
      registradaEm: concluida ? agora : null,
    };

    const proxima = series[i + 1];
    if (concluida && proxima && !proxima.concluida && proxima.tipo === atual.tipo) {
      series[i + 1] = {
        ...proxima,
        reps: atual.reps,
        repsLado2: atual.repsLado2,
        cargaKg: atual.cargaKg,
        tempoS: atual.tempoS,
        tempoSLado2: atual.tempoSLado2,
        passos: atual.passos,
        assistencia: atual.assistencia,
      };
    }
    return { ...bloco, series };
  });
}

/** O toggle "Última repetição saiu firme?" e a nota do bloco. */
export function definirFirme(
  sessao: SessaoLocal,
  ordem: number,
  firme: boolean,
): SessaoLocal {
  return trocarBloco(sessao, ordem, (b) => ({ ...b, ultimaFirme: firme }));
}

export function definirNota(
  sessao: SessaoLocal,
  ordem: number,
  nota: string,
): SessaoLocal {
  return trocarBloco(sessao, ordem, (b) => ({ ...b, nota: nota.trim() || null }));
}

/**
 * "Substituir hoje" (SPEC §3.2 e §6.3): o registro passa a ser do substituto,
 * com o estado e a prescrição **dele**; o original não é avaliado.
 */
export function substituirExercicio(
  sessao: SessaoLocal,
  ordem: number,
  novoExercicioId: string,
  estado: EstadoExercicio | null = null,
  extras: {
    anteriores?: (number | null)[] | null;
    recorde?: RecordeAntes;
    /**
     * `estado` acima é o que o banco tem mesmo (`null` = exercício novo)?
     * `false` quando não deu para ler `exercise_state` do substituto: o bloco
     * fica sem avaliação em vez de sobrescrever a progressão dele (§6.3).
     */
    estadoConhecido?: boolean;
    novoId?: () => string;
  } = {},
): SessaoLocal {
  const novoId = extras.novoId ?? idPadrao;
  const exercicio = acharExercicio(novoExercicioId);

  return trocarBloco(sessao, ordem, (bloco) => {
    const padrao = prescricaoPadrao(exercicio);
    const prescricao: Alvo = {
      ...padrao,
      series: padrao.series || bloco.prescricao.series,
    };
    const alvo = cargaDeHoje(exercicio, estado, prescricao, sessao.opcoesMontagem);
    const series: SerieLocal[] = [];
    for (let s = 1; s <= prescricao.series; s++) {
      series.push(serieDeTrabalho(s, alvo, prescricao, novoId));
    }
    return {
      ...bloco,
      exercicioId: exercicio.id,
      substituido: exercicio.id !== bloco.originalId,
      prescricao,
      descansoS: exercicio.prescricao_padrao.descanso_s,
      descansoTexto: textoDoDescanso(exercicio.prescricao_padrao.descanso_s),
      alvo,
      estado,
      estadoConhecido: extras.estadoConhecido !== false,
      seriesAnteriores: extras.anteriores ?? null,
      recordeCarga: extras.recorde?.carga_max_kg ?? null,
      recordeReps: extras.recorde?.reps_max ?? null,
      recordeE1rm: extras.recorde?.e1rm_epley ?? null,
      series,
      ultimaFirme: null,
    };
  });
}

/** O descanso em texto quando o programa não traz um (troca de exercício). */
export function textoDoDescanso(segundos: number): string {
  if (segundos < 120) return `${segundos} s`;
  return `${formatarNumero(segundos / 60)} min`;
}

/** Exercícios que podem substituir: mesmo grupo e equipamento que existe aqui. */
export function substitutosPara(exercicioId: string): Exercicio[] {
  const alvo = acharExercicio(exercicioId);
  const disponivel = equipamentoDisponivel();
  return exercicios
    .filter(
      (e) =>
        e.id !== alvo.id &&
        e.grupo === alvo.grupo &&
        e.prescricao_padrao.tipo !== "ver_cardio_corda" &&
        e.equipamento.every((tag) => disponivel.has(tag)),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * Todos os exercícios que esta sessão pode acabar registrando: os dos blocos e
 * os substitutos possíveis de cada um (SPEC §3.2 e §6.3). É desta lista que a
 * tela carrega `exercise_state`, séries anteriores e recordes — "o substituto
 * usa o próprio estado", e para isso o estado dele precisa estar em mãos
 * antes da troca (que pode acontecer offline).
 */
export function idsComSubstitutos(ids: readonly string[]): string[] {
  const todos = new Set<string>();
  for (const id of ids) {
    todos.add(id);
    for (const e of substitutosPara(id)) todos.add(e.id);
  }
  return [...todos].sort();
}

/**
 * Destes ids, os que o motor compara série a série com a sessão anterior
 * (prescrição do tipo `maximo`, SPEC §6.3) — os únicos que precisam das séries
 * anteriores carregadas.
 */
export function idsQueComparamComAnterior(ids: readonly string[]): string[] {
  return ids.filter((id) => acharExercicio(id).prescricao_padrao.tipo === "maximo");
}

/* ------------------------------------------------------------- steppers */

/**
 * O próximo degrau de carga **alcançável** (SPEC §6.4): sobe/desce pelo menos
 * o incremento do exercício e sempre cai numa carga que a §6.5 monta.
 */
export function proximaCarga(
  atual: number,
  implemento: ImplementoMontagem,
  incremento: number,
  direcao: 1 | -1,
  opcoes: OpcoesMontagem = {},
): number {
  const escala = cargasPossiveis(implemento, opcoes);
  if (escala.length === 0) return atual;
  const minimo = cargaMinima(implemento, opcoes);
  const maximo = cargaMaxima(implemento, opcoes);
  const passo = incremento > 0 ? incremento : 0;
  const alvo = atual + direcao * passo;

  if (direcao > 0) {
    const acima = escala.find((c) => c > atual + 1e-9 && c >= alvo - 1e-9);
    return acima ?? maximo;
  }
  const abaixo = [...escala].reverse().find((c) => c < atual - 1e-9 && c <= alvo + 1e-9);
  return abaixo ?? minimo;
}

/* -------------------------------------------------- progresso e rótulos */

export interface ProgressoSessao {
  feitas: number;
  total: number;
  /** "3/14 séries" */
  texto: string;
}

/** Séries de trabalho concluídas / prescritas (rodapé, SPEC §3.2). */
export function progressoDaSessao(sessao: SessaoLocal): ProgressoSessao {
  let feitas = 0;
  let total = 0;
  for (const bloco of sessao.blocos) {
    for (const serie of bloco.series) {
      if (serie.tipo !== "trabalho") continue;
      total += 1;
      if (serie.concluida) feitas += 1;
    }
  }
  return { feitas, total, texto: `${feitas}/${total} séries` };
}

/** "7,5 kg na barra" / "peso do corpo" — o rótulo certo do implemento (§4). */
export function textoDaCargaDoBloco(bloco: BlocoLocal): string {
  const exercicio = acharExercicio(bloco.exercicioId);
  const carga = bloco.alvo.carga_kg;
  if (carga === null || carga === 0) return "peso do corpo";
  return `${formatarKg(carga)} ${rotuloDaCarga(exercicio.implemento)}`;
}

/**
 * A carga que está de fato na barra agora (SPEC §6.5): a da próxima série a
 * fazer; com tudo marcado, a da última feita. A carga do dia (`alvo.carga_kg`)
 * é só o ponto de partida — quem toca no ± ou digita muda a barra de verdade,
 * e é dessa carga que a folha de montagem tem de falar.
 */
export function cargaEmUso(bloco: BlocoLocal): number | null {
  const trabalho = bloco.series.filter((s) => s.tipo === "trabalho");
  const proxima = trabalho.find((s) => !s.concluida) ?? trabalho[trabalho.length - 1];
  return proxima?.cargaKg ?? bloco.alvo.carga_kg;
}

/**
 * O padrão do toggle "Última repetição saiu firme?" (SPEC §3.2): sim quando
 * todas as séries de trabalho chegaram ao topo da faixa.
 */
export function firmePadrao(bloco: BlocoLocal): boolean {
  const trabalho = bloco.series.filter((s) => s.tipo === "trabalho");
  if (trabalho.length === 0) return true;
  const topo = bloco.alvo.alvo_max;
  if (topo === null) return true;
  return trabalho.every((s) => {
    if (!s.concluida) return false;
    const valor = valorDaLinha(s, bloco.prescricao);
    return valor !== null && valor >= topo;
  });
}

/** O valor que conta nesta série (o menor lado quando é unilateral). */
function valorDaLinha(serie: SerieLocal, prescricao: Alvo): number | null {
  const par = (a: number | null, b: number | null): number | null => {
    if (!prescricao.unilateral) return a;
    if (a === null || b === null) return null;
    return Math.min(a, b);
  };
  if (prescricao.tipo === "tempo_s") return par(serie.tempoS, serie.tempoSLado2);
  if (prescricao.tipo === "passos") return serie.passos;
  return par(serie.reps, serie.repsLado2);
}

/** A série local vira o que o motor entende (SPEC §6.2). */
export function serieParaMotor(serie: SerieLocal): SerieFeita {
  return {
    concluida: serie.concluida,
    tipo: serie.tipo,
    reps: serie.reps,
    reps_lado2: serie.repsLado2,
    tempo_s: serie.tempoS,
    tempo_s_lado2: serie.tempoSLado2,
    passos: serie.passos,
    carga_kg: serie.cargaKg,
    assistencia: serie.assistencia,
  };
}

/* ------------------------------------------------- escritas (fila §8) */

/** Uma escrita da fila de saída — o mesmo formato de `lib/outbox-supabase.ts`. */
export interface Escrita {
  tabela: string;
  op: "insert" | "upsert" | "update" | "delete";
  linha?: Record<string, unknown>;
  onConflict?: string;
  filtro?: Record<string, string | number | boolean>;
}

/** A criação da sessão (`sessions`), com o id gerado no cliente. */
export function escritaDaSessao(sessao: SessaoLocal): Escrita {
  return {
    tabela: "sessions",
    op: "upsert",
    onConflict: "id",
    linha: {
      id: sessao.id,
      user_id: sessao.userId,
      data: sessao.data,
      workout_id: sessao.workoutId,
      fase: sessao.fase,
      status: sessao.status,
      iniciada_em: sessao.iniciadaEm,
    },
  };
}

/** Uma série concluída (`session_sets`), upsert por id: remarcar não duplica. */
export function escritaDaSerie(
  sessao: SessaoLocal,
  bloco: BlocoLocal,
  serie: SerieLocal,
): Escrita {
  const linha: Omit<LinhaSerie, "registrada_em"> & { registrada_em: string } = {
    id: serie.id,
    session_id: sessao.id,
    user_id: sessao.userId,
    exercise_id: bloco.exercicioId,
    ordem_ex: bloco.ordem,
    set_index: serie.setIndex,
    tipo: serie.tipo,
    reps_alvo_min: serie.repsAlvoMin,
    reps_alvo_max: serie.repsAlvoMax,
    reps: serie.reps,
    reps_lado2: serie.repsLado2,
    carga_kg: serie.cargaKg,
    tempo_s: serie.tempoS,
    tempo_s_lado2: serie.tempoSLado2,
    passos: serie.passos,
    assistencia: serie.assistencia,
    concluida: serie.concluida,
    /*
     * O valor que o motor vai usar (SPEC §3.2: "é esse toggle que o motor
     * usa"), não o `null` de "ainda não foi tocado" — a coluna do banco tem de
     * explicar a decisão. A conclusão reenvia as séries com o valor final.
     */
    ultima_firme: bloco.ultimaFirme ?? firmePadrao(bloco),
    rpe: null,
    registrada_em: serie.registradaEm ?? new Date().toISOString(),
  };
  return { tabela: "session_sets", op: "upsert", onConflict: "id", linha };
}

/* --------------------------------------------------- resumo e conclusão */

export interface RecordeNovo {
  tipo: "carga" | "reps" | "e1rm";
  /** "carga máxima", "repetições", "e1RM" */
  rotulo: string;
  valor: number;
  texto: string;
}

export interface ResultadoExercicio {
  exercicioId: string;
  nome: string;
  ordem: number;
  motivo: MotivoProgressao | null;
  /** ↑ subiu · = repetiu · ↓ voltou (SPEC §6.6). */
  simbolo: "↑" | "=" | "↓" | null;
  /** A decisão veio de uma série abaixo do piso ou faltando (SPEC §6.2). */
  falha: boolean;
  /**
   * O bloco ficou de fora do motor porque o `exercise_state` dele é
   * desconhecido (SPEC §6.3): as séries são gravadas, a progressão não.
   */
  naoAvaliado: boolean;
  /** "7,5 → 9,5 kg na barra", "10 → 11 repetições", "repetiu 7,5 kg na barra". */
  texto: string;
  aviso: string | null;
  sugestao: string | null;
  recordes: RecordeNovo[];
  decisao: Decisao;
}

function numeroDe(campo: Record<string, unknown>, chave: string): number | null {
  const v = campo[chave];
  return typeof v === "number" ? v : null;
}

function simboloDoMotivo(
  motivo: MotivoProgressao,
  de: number | null,
  para: number | null,
): "↑" | "=" | "↓" {
  if (de !== null && para !== null && de !== para) return para > de ? "↑" : "↓";
  if (motivo === "subiu") return "↑";
  if (motivo === "falha_2x_voltou_10" || motivo === "semana_leve_60") return "↓";
  return "=";
}

/** O texto de uma decisão no resumo (SPEC §6.6). */
export function textoDaDecisao(exercicio: Exercicio, decisao: Decisao): string {
  const evento = decisao.evento;
  const unidade = rotuloDaCarga(exercicio.implemento);
  if (!evento) return "sem mudança";

  const deKg = numeroDe(evento.de, "carga_kg");
  const paraKg = numeroDe(evento.para, "carga_kg");
  if (deKg !== null && paraKg !== null) {
    if (deKg !== paraKg) {
      return `${formatarNumero(deKg)} → ${formatarKg(paraKg)} ${unidade}`;
    }
    return `repetiu ${formatarKg(paraKg)} ${unidade}`;
  }

  const deReps = numeroDe(evento.de, "reps_alvo");
  const paraReps = numeroDe(evento.para, "reps_alvo");
  if (deReps !== null && paraReps !== null) {
    if (deReps !== paraReps) return `${deReps} → ${paraReps} repetições`;
    return `repetiu ${paraReps} repetições`;
  }

  const deTempo = numeroDe(evento.de, "tempo_alvo_s");
  const paraTempo = numeroDe(evento.para, "tempo_alvo_s");
  if (deTempo !== null && paraTempo !== null) {
    if (deTempo !== paraTempo) return `${deTempo} → ${paraTempo} s`;
    return `repetiu ${paraTempo} s`;
  }

  const paraAss = evento.para["assistencia"];
  if (typeof paraAss === "string") return `elástico: ${nomeDaAssistencia(paraAss)}`;

  return evento.motivo === "subiu" ? "subiu" : "repetiu";
}

const NOMES_ASSISTENCIA: Record<string, string> = {
  pe_inteiro: "pé inteiro",
  joelho: "joelho",
  joelho_dobrado: "joelho dobrado",
  sem: "sem elástico",
};

export function nomeDaAssistencia(valor: string): string {
  return NOMES_ASSISTENCIA[valor] ?? valor;
}

/** Recordes batidos neste bloco, comparando com a view `v_records` (§6.6). */
export function recordesDoBloco(bloco: BlocoLocal): RecordeNovo[] {
  // sem os recordes de verdade deste exercício, qualquer série viraria recorde
  if (!blocoAvaliavel(bloco)) return [];
  const feitas = bloco.series.filter((s) => s.tipo === "trabalho" && s.concluida);
  if (feitas.length === 0) return [];

  const novos: RecordeNovo[] = [];
  const cargas = feitas.map((s) => s.cargaKg ?? 0);
  const reps = feitas.map((s) => s.reps ?? 0);
  const cargaMax = Math.max(...cargas);
  const repsMax = Math.max(...reps);
  const e1rm = Math.max(
    ...feitas.map((s) => (s.cargaKg ?? 0) * (1 + (s.reps ?? 0) / 30)),
  );
  const exercicio = acharExercicio(bloco.exercicioId);
  const unidade = rotuloDaCarga(exercicio.implemento);

  if (cargaMax > 0 && cargaMax > (bloco.recordeCarga ?? 0)) {
    novos.push({
      tipo: "carga",
      rotulo: "carga máxima",
      valor: cargaMax,
      texto: `${formatarKg(cargaMax)} ${unidade}`,
    });
  }
  if (repsMax > 0 && repsMax > (bloco.recordeReps ?? 0)) {
    novos.push({
      tipo: "reps",
      rotulo: "repetições",
      valor: repsMax,
      texto: `${repsMax} repetições`,
    });
  }
  if (e1rm > 0 && e1rm > (bloco.recordeE1rm ?? 0) + 1e-9) {
    novos.push({
      tipo: "e1rm",
      rotulo: "e1RM",
      valor: e1rm,
      texto: `${formatarKg(e1rm, 1)} de e1RM`,
    });
  }
  return novos;
}

/**
 * Dá para passar este bloco pelo motor? Só quando o `exercise_state` dele foi
 * lido de verdade (SPEC §6.3). A comparação é com `false` de propósito: uma
 * sessão gravada no aparelho antes deste campo existir vale como conhecida.
 */
export function blocoAvaliavel(bloco: BlocoLocal): boolean {
  return bloco.estadoConhecido !== false;
}

/** Passa cada bloco pelo motor (SPEC §6.2). Não grava nada. */
export function avaliarSessao(sessao: SessaoLocal): ResultadoExercicio[] {
  const abandonada = sessao.status === "abandonada";

  return sessao.blocos.map((bloco) => {
    const exercicio = acharExercicio(bloco.exercicioId);
    const firme = bloco.ultimaFirme ?? firmePadrao(bloco);
    const decisao = decidir(
      exercicio,
      bloco.estado,
      bloco.series.filter((s) => s.tipo === "trabalho").map(serieParaMotor),
      {
        prescricao: bloco.prescricao,
        ultimaFirme: firme,
        sessaoAbandonada: abandonada,
        seriesAnteriores: bloco.seriesAnteriores,
        montagem: sessao.opcoesMontagem,
      },
    );
    /*
     * Estado desconhecido (SPEC §6.3): a decisão sairia de uma carga inventada
     * e o upsert apagaria a progressão real. O evento vira nulo — e é ele que
     * `concluirSessao` usa para decidir o que gravar.
     */
    if (!blocoAvaliavel(bloco)) {
      return {
        exercicioId: bloco.exercicioId,
        nome: exercicio.nome,
        ordem: bloco.ordem,
        motivo: null,
        simbolo: null,
        falha: false,
        naoAvaliado: true,
        texto: "não avaliado: não consegui ler a carga atual deste exercício",
        aviso: null,
        sugestao: null,
        recordes: [],
        decisao: { novoEstado: decisao.novoEstado, evento: null },
      } satisfies ResultadoExercicio;
    }

    const evento = decisao.evento;
    const simbolo = evento
      ? simboloDoMotivo(
          evento.motivo,
          numeroDe(evento.de, "carga_kg") ??
            numeroDe(evento.de, "reps_alvo") ??
            numeroDe(evento.de, "tempo_alvo_s"),
          numeroDe(evento.para, "carga_kg") ??
            numeroDe(evento.para, "reps_alvo") ??
            numeroDe(evento.para, "tempo_alvo_s"),
        )
      : null;

    return {
      exercicioId: bloco.exercicioId,
      nome: exercicio.nome,
      ordem: bloco.ordem,
      motivo: evento?.motivo ?? null,
      simbolo,
      falha: evento?.falha === true,
      naoAvaliado: false,
      texto: textoDaDecisao(exercicio, decisao),
      aviso: evento?.aviso ?? null,
      sugestao: evento?.sugestao ?? null,
      recordes: recordesDoBloco(bloco),
      decisao,
    } satisfies ResultadoExercicio;
  });
}

function linhaDeEstado(
  sessao: SessaoLocal,
  exercicioId: string,
  estado: EstadoExercicio,
): LinhaEstadoExercicio {
  return {
    user_id: sessao.userId,
    exercise_id: exercicioId,
    ...estado,
    notas: null,
  };
}

export interface EntradaConclusao {
  sessao: SessaoLocal;
  /** Quando terminou (ISO). */
  agora?: string;
  /** Gerador de id dos eventos de progressão. */
  novoId?: () => string;
}

export interface Conclusao {
  resultados: ResultadoExercicio[];
  escritas: Escrita[];
}

/**
 * O fim da sessão (SPEC §3.2, §6.2, §6.6 e §8): as decisões do motor e todas
 * as escritas que a fila de saída precisa fazer, na ordem.
 *
 * `sessao.status` diz se foi "Concluir treino" (`concluida`) ou "Abandonar"
 * (`abandonada`); no abandono o motor só avalia quem tem todas as séries e o
 * `ultimo_treino` do perfil **não** muda (a alternância da §5.2 não avança).
 */
export function concluirSessao(entrada: EntradaConclusao): Conclusao {
  const { sessao } = entrada;
  const agora = entrada.agora ?? new Date().toISOString();
  const novoId = entrada.novoId ?? idPadrao;
  const resultados = avaliarSessao(sessao);
  const concluida = sessao.status === "concluida";

  const duracaoS = Math.max(
    0,
    Math.round((new Date(agora).getTime() - new Date(sessao.iniciadaEm).getTime()) / 1000),
  );

  const escritas: Escrita[] = [
    {
      tabela: "sessions",
      op: "update",
      filtro: { id: sessao.id },
      linha: {
        status: sessao.status,
        concluida_em: concluida ? agora : null,
        duracao_s: duracaoS,
        sensacao: sessao.sensacao,
        peso_corporal: sessao.pesoCorporal,
        notas: sessao.notas,
      },
    },
  ];

  for (const resultado of resultados) {
    const bloco = sessao.blocos.find((b) => b.ordem === resultado.ordem);
    if (!bloco) continue;
    // estado desconhecido: nem `exercise_state` nem `progression_events` (§6.3)
    if (resultado.naoAvaliado) continue;
    if (!resultado.decisao.evento) continue;

    escritas.push({
      tabela: "exercise_state",
      op: "upsert",
      onConflict: "user_id,exercise_id",
      linha: { ...linhaDeEstado(sessao, bloco.exercicioId, resultado.decisao.novoEstado) },
    });
    escritas.push({
      tabela: "progression_events",
      op: "insert",
      linha: {
        id: novoId(),
        user_id: sessao.userId,
        exercise_id: bloco.exercicioId,
        session_id: sessao.id,
        data: sessao.data,
        de: resultado.decisao.evento.de,
        para: resultado.decisao.evento.para,
        motivo: resultado.decisao.evento.motivo,
      },
    });
  }

  // As notas do bloco viram a nota da série (o schema não tem nota por bloco):
  // a nota curta fica em `sessions.notas`, montada abaixo.

  if (concluida && ehTreinoDoPrograma(sessao.workoutId)) {
    escritas.push({
      tabela: "profiles",
      op: "update",
      filtro: { user_id: sessao.userId },
      linha: { ultimo_treino: sessao.workoutId },
    });
  }

  if (sessao.pesoCorporal !== null && sessao.pesoCorporal > 0) {
    escritas.push({
      tabela: "body_weights",
      op: "upsert",
      onConflict: "user_id,data",
      linha: {
        id: novoId(),
        user_id: sessao.userId,
        data: sessao.data,
        peso_kg: sessao.pesoCorporal,
      },
    });
  }

  return { resultados, escritas };
}

/** Junta as notas dos blocos numa nota só da sessão (o schema tem uma). */
export function notasDaSessao(sessao: SessaoLocal): string | null {
  const partes = sessao.blocos
    .filter((b) => b.nota)
    .map((b) => `${acharExercicio(b.exercicioId).nome}: ${b.nota}`);
  return partes.length > 0 ? partes.join(" · ") : null;
}

/** A montagem das anilhas de uma carga qualquer (SPEC §6.5). */
export function montagemDaCarga(
  exercicioId: string,
  carga: number | null,
  opcoes: OpcoesMontagem = {},
) {
  const exercicio = acharExercicio(exercicioId);
  if (carga === null) return null;
  return montarAnilhas(carga, exercicio.implemento as ImplementoMontagem, opcoes);
}

/** As séries de trabalho da última sessão de cada exercício (tipo `maximo`). */
export function seriesAnterioresPorExercicio(
  linhas: Pick<LinhaSerie, "exercise_id" | "session_id" | "set_index" | "reps" | "tipo" | "concluida" | "registrada_em">[],
  ignorarSessao?: string,
): Record<string, (number | null)[]> {
  const uteis = linhas.filter(
    (l) =>
      l.tipo === "trabalho" &&
      l.concluida &&
      (!ignorarSessao || l.session_id !== ignorarSessao),
  );

  // por exercício: a sessão mais recente (a que tem a série gravada por último)
  const ultimaSessao = new Map<string, { sessao: string; quando: string }>();
  for (const linha of uteis) {
    const atual = ultimaSessao.get(linha.exercise_id);
    if (!atual || linha.registrada_em > atual.quando) {
      ultimaSessao.set(linha.exercise_id, {
        sessao: linha.session_id,
        quando: linha.registrada_em,
      });
    }
  }

  const saida: Record<string, (number | null)[]> = {};
  for (const [exercicio, { sessao }] of ultimaSessao) {
    saida[exercicio] = uteis
      .filter((l) => l.exercise_id === exercicio && l.session_id === sessao)
      .sort((a, b) => a.set_index - b.set_index)
      .map((l) => l.reps);
  }
  return saida;
}
