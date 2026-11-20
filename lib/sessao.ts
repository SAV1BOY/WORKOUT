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
import { alternativasPara } from "@/lib/alternativas";
import { carimbarUltimaInclusao, chavesDosItensDoPlano, ordensDeExecucao } from "@/lib/ordem-da-sessao";
import { descansoPersonalizadoDaSessao, limitarTempoDeDescanso } from "@/lib/descanso-da-sessao";
export { descansoPersonalizadoDaSessao } from "@/lib/descanso-da-sessao";
import { equipamentoDaSessao, tagsDoEquipamento } from "@/lib/equipamento-da-sessao";
import { resolverTrocasDoTreino } from "@/lib/trocas";
import {
  acharExercicio,
  acharTreino,
  ehTreinoDoPrograma,
  exercicioPorId,
  textoDoMotor,
} from "@/lib/dados";
import { itemDoExercicio, itemParaPlano, itensDoPlano, planoDaSessao } from "@/lib/livre";
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
import type { EstadoPlayer } from "@/lib/player";
import type { Assistencia, EquipamentoTag, Exercicio, FaseId, TreinoId } from "@/lib/schemas";
import type {
  InclusaoNaSessao,
  LinhaSerie,
  LinhaSessao,
  MotivoProgressao,
  PlanoDaSessao,
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

export { ehTreinoDoPrograma } from "@/lib/dados";

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
  /** Rascunho local da medição, associado aos segundos que o cronômetro gravou nesta série. */
  medicaoCronometro?: { serieId: string; alvoS: number; medidoS: number };
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
  /** Estado de cada exercício anterior deste bloco, inclusive feedback e séries feitas. */
  trocados?: RegistroDoExercicioTrocado[];
}

export type RegistroDoExercicioTrocado = Omit<BlocoLocal, "trocados">;

export const MENSAGEM_NOTA_GERAL_ALTERADA = "A nota do treino mudou. Cancele a edição para ver a versão atual.";

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
  /**
   * Sessão fora do programa (§3.4): a semana do plano em que ela foi criada.
   * É ela que remonta a sessão noutro aparelho — o plano pode ter avançado
   * desde então, e a folha tem de voltar com a prescrição daquele dia.
   */
  semanaPlano: number | null;
  /**
   * `sessions.plano` (SPEC §13.4 e §14.3): a lista de exercícios com que a
   * sessão nasceu. Obrigatório na sessão livre — ela não está em lugar nenhum
   * — e usado também para guardar a **ordem desta sessão** quando o Miguel
   * reordena o treino do dia. `null` = a ordem é a do programa.
   */
  plano: PlanoDaSessao | null;
  /** Coluna da sessão livre. O plano contém uma cópia para clientes antigos. */
  ordemExecucao?: string[] | null;
  /** Identifica localmente a escolha para descartar respostas remotas anteriores. */
  revisaoOrdemExecucao?: string;
  sensacao: number | null;
  pesoCorporal: number | null;
  notas: string | null;
  /** Texto sobre este treino inteiro, independente das notas dos blocos. */
  notaGeral?: string | null;
  /** Identifica a edição no aparelho enquanto uma leitura do servidor está em andamento. */
  revisaoNotaGeral?: string;
  /** Barra W / reta oca já pesadas na balança (SPEC §3.9). */
  opcoesMontagem: OpcoesMontagem;
  blocos: BlocoLocal[];
  /**
   * Onde o player parou (SPEC §14.1): a chave do passo e, no descanso e na
   * preparação, o instante em que a contagem acaba. Fica **só** no aparelho
   * (dentro de `sessaoAtiva`, no Dexie) — nenhuma coluna do banco guarda isto,
   * e `escritaDaSessao` não o envia. Ausente = a sessão nunca passou pelo
   * player neste aparelho, e o passo é recalculado por `indiceDeRetomada`.
   */
  player?: EstadoPlayer | null;
  /** Último padrão da conta lido neste aparelho, usado ao retomar a sessão sem o perfil.
   * Ausente = perfil ainda desconhecido; null = a conta usa a prescrição de cada exercício. */
  descansoPadraoConhecidoS?: number | null;
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
  /**
   * Quais exercícios tiveram o `exercise_state` lido de verdade. Quando existe,
   * manda no lugar do `estadoConhecido` acima e a degradação passa a ser **por
   * exercício**: sem rede, só quem nunca foi lido fica sem avaliação — o resto
   * do treino continua passando pelo motor (SPEC §6.3 e §14.1).
   */
  conhecidos?: ReadonlySet<string>;
  /** Tipo `maximo`: reps da última sessão por exercício (SPEC §6.3). */
  anteriores?: Record<string, (number | null)[]>;
  /** `v_records` por exercício, para o resumo do fim (SPEC §6.6). */
  recordes?: Record<string, RecordeAntes>;
  opcoesMontagem?: OpcoesMontagem;
  /** Materiais que a pessoa marcou para esta única sessão. */
  equipamentosDisponiveis?: ReadonlySet<EquipamentoTag>;
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
  /** Semana do plano da barra fixa (§3.4), gravada com a sessão. */
  semanaPlano?: number | null;
  /** `sessions.plano` (§13.4): o que refaz esta sessão noutro aparelho. */
  plano?: PlanoDaSessao | null;
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

export type DadosDoExercicioAcrescentado = Pick<
  EntradaMontagem, "estados" | "estadoConhecido" | "conhecidos" | "anteriores" | "recordes" | "novoId"
>;

function montarBloco(
  item: ItemDaSessao, ordem: number, dados: DadosDoExercicioAcrescentado,
  opcoes: OpcoesMontagem, podeAquecer: boolean,
): BlocoLocal {
  const exercicio = acharExercicio(item.exercicioId);
  const prescricao = item.prescricao;
  const estado = dados.estados?.[exercicio.id] ?? null;
  const alvo = cargaDeHoje(exercicio, estado, prescricao, opcoes);
  const novoId = dados.novoId ?? idPadrao;
  const series = podeAquecer && exercicio.categoria === "composto_pesado"
    ? seriesDeAquecimento(exercicio, alvo, opcoes, novoId) : [];
  for (let s = 1; s <= prescricao.series; s++) {
    series.push(serieDeTrabalho(s, alvo, prescricao, novoId));
  }

  const rec = dados.recordes?.[exercicio.id];
  return {
    ordem,
    exercicioId: exercicio.id,
    originalId: exercicio.id,
    substituido: false,
    prescricao,
    descansoS: item.descansoS,
    descansoTexto: item.descansoTexto,
    alvo,
    estado,
    estadoConhecido: dados.conhecidos ? dados.conhecidos.has(exercicio.id) : dados.estadoConhecido !== false,
    seriesAnteriores: dados.anteriores?.[exercicio.id] ?? null,
    recordeCarga: rec?.carga_max_kg ?? null,
    recordeReps: rec?.reps_max ?? null,
    recordeE1rm: rec?.e1rm_epley ?? null,
    series,
    ultimaFirme: null,
    nota: null,
  };
}

/** A mesma montagem, com os exercícios vindo de fora do programa (§3.4). */
export function montarSessaoAvulsa(e: EntradaAvulsa): SessaoLocal {
  const opcoes = e.opcoesMontagem ?? {};
  const agora = e.agora ?? new Date().toISOString();
  let aquecimentoUsado = false;
  const blocos = e.itens.map((item, i) => {
    const bloco = montarBloco(item, i + 1, e, opcoes, !aquecimentoUsado);
    if (bloco.series[0]?.tipo === "aquecimento") aquecimentoUsado = true;
    return bloco;
  });

  let plano = e.plano ?? null;
  if (plano?.ultima_inclusao && plano.ultima_inclusao.sessao_id !== e.id) {
    plano = { ...plano };
    delete plano.ultima_inclusao;
  }
  const sessao: SessaoLocal = {
    id: e.id,
    userId: e.userId,
    data: e.data,
    workoutId: e.workoutId,
    fase: e.fase,
    status: "em_andamento",
    iniciadaEm: agora,
    concluidaEm: null,
    semanaPlano: e.semanaPlano ?? null,
    plano,
    sensacao: null,
    pesoCorporal: null,
    notas: null,
    opcoesMontagem: opcoes,
    blocos,
  };
  return e.equipamentosDisponiveis ? definirEquipamentoDaSessao(sessao, e.equipamentosDisponiveis) : sessao;
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
  linha: Pick<
    LinhaSessao,
    | "id"
    | "user_id"
    | "data"
    | "workout_id"
    | "fase"
    | "status"
    | "iniciada_em"
    | "nota_geral"
    | "ordem_execucao"
  > & { semana_plano?: number | null; plano?: PlanoDaSessao | null },
  series: LinhaSerie[],
  resto: Omit<EntradaMontagem, "id" | "userId" | "data" | "treinoId" | "fase" | "equipamentosDisponiveis"> & {
    /** Sessão fora do programa (§3.4): os itens não estão em `programa.json`. */
    itens?: ItemDaSessao[];
  } = {},
): SessaoLocal | null {
  const { itens, ...semItens } = resto;
  /*
   * Um treino "livre" não está escrito em lugar nenhum: os itens dele vêm de
   * `sessions.plano` (§13.4), que a tela lê e passa aqui. Uma sessão de barra
   * fixa (§3.4) idem, com os itens do plano da semana. Sem a lista é melhor
   * não refazer nada do que inventar uma sessão diferente da registrada — e a
   * MESMA lista vale para um treino do programa que foi reordenado, senão a
   * sessão volta na ordem do programa e as séries não casam.
   */
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
    semanaPlano: linha.semana_plano ?? null,
    plano: linha.plano ?? null,
  });

  const blocos = base.blocos.map((bloco) => {
    const linhas = series.filter((s) => s.ordem_ex === bloco.ordem);
    const trocas = linha.plano?.trocas?.[bloco.ordem];
    const configurados = Array.isArray(trocas) ? trocas.filter((t) =>
      t && exercicioPorId.has(t.exercicio_id) && Array.isArray(t.trabalho) && Array.isArray(t.aquecimento)
    ) : [];
    // Um registro antigo não tinha a escolha no plano. A última série desta posição
    // ainda permite reconhecer o exercício ativo e manter também os demais.
    const maisRecente = linhas.reduce<LinhaSerie | undefined>((a, b) =>
      !a || b.registrada_em > a.registrada_em ? b : a, undefined);
    const ativo = configurados[0]?.exercicio_id ?? maisRecente?.exercise_id ?? bloco.exercicioId;
    const ids = new Set([ativo, ...configurados.map((t) => t.exercicio_id), ...linhas.map((r) => r.exercise_id)]);
    const registros: RegistroDoExercicioTrocado[] = [];
    for (const id of ids) {
      if (!exercicioPorId.has(id)) continue;
      const config = configurados.find((t) => t.exercicio_id === id);
      const remoto = linhas.filter((r) => r.exercise_id === id);
      const inicial = id === bloco.exercicioId ? bloco : substituirExercicio(base, bloco.ordem, id, resto.estados?.[id] ?? null, {
        anteriores: resto.anteriores?.[id], recorde: resto.recordes?.[id],
        estadoConhecido: resto.conhecidos ? resto.conhecidos.has(id) : resto.estadoConhecido,
        novoId: resto.novoId,
      }).blocos[bloco.ordem - 1]!;
      const series: SerieLocal[] = [];
      for (const tipo of ["aquecimento", "trabalho"] as const) {
        const indices = new Set(config?.[tipo] ?? inicial.series.filter((s) => s.tipo === tipo).map((s) => s.setIndex));
        for (const r of remoto) if (r.tipo === tipo) indices.add(r.set_index);
        for (const indice of [...indices].filter((n) => Number.isSafeInteger(n) && n > 0).sort((a, b) => a - b)) {
          const r = remoto.find((r) => r.tipo === tipo && r.set_index === indice);
          const padrao = inicial.series.find((s) => s.tipo === tipo && s.setIndex === indice);
          if (r) {
            series.push({
              id: r.id, tipo, setIndex: indice, repsAlvoMin: r.reps_alvo_min, repsAlvoMax: r.reps_alvo_max,
              reps: r.reps, repsLado2: r.reps_lado2, tempoS: r.tempo_s, tempoSLado2: r.tempo_s_lado2,
              passos: r.passos, cargaKg: r.carga_kg, assistencia: r.assistencia,
              concluida: r.concluida, registradaEm: r.registrada_em,
            });
          } else if (padrao) {
            series.push(padrao);
          } else if (tipo === "trabalho") {
            series.push(serieDeTrabalho(indice, inicial.alvo, inicial.prescricao, resto.novoId ?? idPadrao));
          }
        }
      }
      // Em andamento o ultima_firme de uma linha é apenas o cálculo do momento
      // da gravação. Somente o feedback explícito do plano deve prevalecer.
      const firme = config?.ultima_firme ?? (linha.status !== "em_andamento" ? remoto.find((s) => s.ultima_firme !== null)?.ultima_firme : null);
      const registro: BlocoLocal = {
        ...inicial, series, nota: config?.nota ?? null, ultimaFirme: firme ?? null,
        prescricao: { ...inicial.prescricao, series: series.filter((s) => s.tipo === "trabalho").length },
      };
      delete registro.trocados;
      registros.push(registro);
    }
    const [atual, ...anteriores] = registros;
    return atual ? { ...atual, trocados: anteriores.length ? anteriores : undefined } : bloco;
  });
  const refeita = bloquearDesfazerSeIniciado({
    ...base, status: linha.status, blocos,
    ...(linha.nota_geral !== undefined && { notaGeral: linha.nota_geral }),
  });
  return Array.isArray(linha.ordem_execucao) ? aplicarOrdemRemotaDaSessao(refeita, linha.ordem_execucao) : refeita;
}

/* ------------------------------------------------------ mexer na sessão */

/** Cada movimento já vinculado a uma posição pertence a ela, inclusive depois de uma troca. */
export function exerciciosOcupadosNaSessao(sessao: SessaoLocal): Set<string> {
  return new Set(sessao.blocos.flatMap(bloco => [
    bloco.originalId, bloco.exercicioId, ...(bloco.trocados ?? []).map(anterior => anterior.exercicioId),
  ]));
}

export function acrescentarExercicioNaSessao(
  sessao: SessaoLocal, exercicioId: string, motor: DadosDoExercicioAcrescentado,
): SessaoLocal {
  if (sessao.workoutId !== "livre" || sessao.status !== "em_andamento") return sessao;
  const exercicio = exercicioPorId.get(exercicioId);
  if (!exercicio || exerciciosOcupadosNaSessao(sessao).has(exercicioId)) return sessao;

  const item = itemDoExercicio(exercicio);
  const jaAqueceu = sessao.blocos.some(bloco => [bloco, ...(bloco.trocados ?? [])]
    .some(registro => registro.series.some(serie => serie.tipo === "aquecimento")));
  const ordem = sessao.blocos.length + 1;
  const dados = { ...motor, estadoConhecido: motor.estadoConhecido ?? false };
  const bloco = montarBloco(item, ordem, dados, sessao.opcoesMontagem, !jaAqueceu);
  const plano = planoAtualOuDosBlocos(sessao);
  return {
    ...sessao,
    blocos: [...sessao.blocos, bloco],
    plano: {
      ...plano, itens: [...plano.itens, itemParaPlano(item)],
      ultima_inclusao: {
        id: (motor.novoId ?? idPadrao)(), sessao_id: sessao.id, ordem, exercicio_id: exercicioId,
        estado: "disponivel", series_iniciais: valoresDoBlocoIncluido(bloco),
      },
    },
  };
}

/** A posição física identifica as séries e trocas mesmo quando a pessoa escolhe outra sequência. */
export function blocosNaOrdemDeExecucao(sessao: SessaoLocal): BlocoLocal[] {
  const fisicos = [...sessao.blocos].sort((a, b) => a.ordem - b.ordem);
  if (sessao.workoutId !== "livre" || !sessao.plano) return fisicos;
  const ordens = ordensDeExecucao(sessao.plano, sessao.ordemExecucao);
  if (ordens.length !== fisicos.length || fisicos.some((b, i) => b.ordem !== i + 1)) return fisicos;
  return ordens.map(ordem => fisicos[ordem - 1]!);
}

/** Somente os movimentos pendentes que podem ser antecipados sem passar por uma série registrada. */
export function opcoesDeProximoExercicio(sessao: SessaoLocal, origem: number): number[] {
  const itens = sessao.plano?.itens;
  if (sessao.workoutId !== "livre" || sessao.status !== "em_andamento" || !Array.isArray(itens) ||
      itens.length !== sessao.blocos.length || sessao.blocos.some(b => itens[b.ordem - 1]?.exercicio_id !== b.originalId)) return [];
  const visual = blocosNaOrdemDeExecucao(sessao);
  const inicio = visual.findIndex(bloco => bloco.ordem === origem);
  if (inicio < 0) return [];
  const opcoes: number[] = [];
  for (const [i, bloco] of visual.slice(inicio + 1).entries()) {
    const registros = [bloco, ...(bloco.trocados ?? [])];
    if (registros.some(r => r.series.some(s => s.concluida || s.registradaEm != null))) break;
    if (i > 0) opcoes.push(bloco.ordem);
  }
  return opcoes;
}

export function aplicarOrdemRemotaDaSessao(sessao: SessaoLocal, ordemExecucao: readonly string[]): SessaoLocal {
  if (sessao.workoutId !== "livre" || !sessao.plano) return sessao;
  const chaves = [...new Set(ordemExecucao.filter(chave => typeof chave === "string" && chave !== ""))];
  const ultima = sessao.plano.ultima_inclusao;
  const plano = ultima && chaves.includes(`inclusao:${ultima.id}`) ? carimbarUltimaInclusao(sessao.plano) : sessao.plano;
  const coincide = (lista?: readonly string[] | null) =>
    lista?.length === chaves.length && chaves.every((chave, i) => chave === lista[i]);
  if (plano === sessao.plano && coincide(sessao.ordemExecucao) && coincide(plano.ordem_execucao)) return sessao;
  return { ...sessao, ordemExecucao: chaves, plano: { ...plano, ordem_execucao: chaves } };
}

export function escolherProximoExercicio(sessao: SessaoLocal, origem: number, escolhido: number): SessaoLocal {
  if (!opcoesDeProximoExercicio(sessao, origem).includes(escolhido)) return sessao;
  const chaves = chavesDosItensDoPlano(sessao.plano);
  if (chaves.some(chave => chave === null) || new Set(chaves).size !== chaves.length) return sessao;
  const ordens = ordensDeExecucao(sessao.plano, sessao.ordemExecucao).filter(ordem => ordem !== escolhido);
  ordens.splice(ordens.indexOf(origem) + 1, 0, escolhido);
  return aplicarOrdemRemotaDaSessao(sessao, ordens.map(ordem => chaves[ordem - 1]!));
}

/** Uma reconstrução pelo banco cria novos UUIDs para as séries pendentes. */
function valoresDoBlocoIncluido(bloco: BlocoLocal): string {
  const p = bloco.prescricao;
  return JSON.stringify([
    p.tipo, p.min, p.max, p.unilateral, p.series, bloco.descansoS, bloco.descansoTexto,
    ...bloco.series.map(s => [s.tipo, s.setIndex, s.repsAlvoMin, s.repsAlvoMax, s.reps, s.repsLado2,
      s.tempoS, s.tempoSLado2, s.cargaKg, s.passos, s.assistencia]),
  ]);
}

function playerNoBloco(player: EstadoPlayer | null | undefined, bloco: BlocoLocal): boolean {
  if (!player) return false;
  const chave = player.chave.replace(/^descanso:/, "");
  return player.ordem === bloco.ordem || chave === `firme:${bloco.ordem}` ||
    bloco.series.some(s => chave === `serie:${s.id}`);
}

function blocoDaUltimaInclusao(sessao: SessaoLocal, inclusao: InclusaoNaSessao): BlocoLocal | undefined {
  const plano = sessao.plano;
  if (sessao.workoutId !== "livre" || sessao.status !== "em_andamento" ||
      !plano || inclusao.estado !== "disponivel" || typeof inclusao.id !== "string" || !inclusao.id ||
      inclusao.sessao_id !== sessao.id || inclusao.ordem <= 1 || inclusao.ordem !== sessao.blocos.length ||
      !Array.isArray(plano.itens) || plano.itens.length !== inclusao.ordem ||
      plano.itens.some((item, i) => item?.exercicio_id !== sessao.blocos[i]?.originalId)) return;
  const bloco = sessao.blocos[inclusao.ordem - 1];
  if (bloco?.ordem === inclusao.ordem && bloco.originalId === inclusao.exercicio_id &&
      plano.itens[inclusao.ordem - 1]?.exercicio_id === inclusao.exercicio_id) return bloco;
}

function inclusaoFoiUsada(sessao: SessaoLocal, bloco: BlocoLocal, inclusao: InclusaoNaSessao): boolean {
  return bloco.substituido || bloco.exercicioId !== inclusao.exercicio_id || !!bloco.trocados?.length ||
    sessao.plano?.trocas?.[bloco.ordem] !== undefined || sessao.plano?.descansos_por_exercicio?.[bloco.exercicioId] !== undefined ||
    bloco.nota !== null || bloco.ultimaFirme !== null || bloco.series.some(s => s.concluida || s.registradaEm !== null) ||
    valoresDoBlocoIncluido(bloco) !== inclusao.series_iniciais ||
    playerNoBloco(sessao.player, bloco) || playerNoBloco(sessao.player?.descansoAoCorrigir, bloco);
}

export function ultimaInclusaoDesfazivel(sessao: SessaoLocal): InclusaoNaSessao | null {
  const inclusao = sessao.plano?.ultima_inclusao;
  if (!inclusao) return null;
  const bloco = blocoDaUltimaInclusao(sessao, inclusao);
  return bloco && !inclusaoFoiUsada(sessao, bloco, inclusao) ? inclusao : null;
}

/** O primeiro uso continua gravado mesmo após desmarcar, limpar uma nota ou voltar de passo. */
export function bloquearDesfazerSeIniciado(sessao: SessaoLocal): SessaoLocal {
  const plano = sessao.plano;
  const inclusao = plano?.ultima_inclusao;
  if (!plano || !inclusao) return sessao;
  const bloco = blocoDaUltimaInclusao(sessao, inclusao);
  if (!bloco || !inclusaoFoiUsada(sessao, bloco, inclusao)) return sessao;
  return { ...sessao, plano: { ...plano, ultima_inclusao: { ...inclusao, estado: "iniciada" } } };
}

export function desfazerUltimaInclusao(sessao: SessaoLocal, id: string): SessaoLocal {
  const plano = sessao.plano;
  const inclusao = ultimaInclusaoDesfazivel(sessao);
  if (!plano || !inclusao || inclusao.id !== id) return sessao;
  return { ...sessao, blocos: sessao.blocos.slice(0, -1), plano: {
    ...plano, itens: plano.itens.slice(0, -1), ultima_inclusao: { ...inclusao, estado: "desfeita" },
  } };
}

function trocarBloco(
  sessao: SessaoLocal,
  ordem: number,
  fn: (bloco: BlocoLocal) => BlocoLocal,
): SessaoLocal {
  const base = sessao.plano?.ultima_inclusao?.ordem === ordem ? bloquearDesfazerSeIniciado(sessao) : sessao;
  const atualizada = {
    ...base,
    blocos: sessao.blocos.map((b) => (b.ordem === ordem ? fn(b) : b)),
  };
  return base.plano?.ultima_inclusao?.ordem === ordem ? bloquearDesfazerSeIniciado(atualizada) : atualizada;
}

/** Um cliente antigo pode editar o tempo ou duplicar a série sem conhecer o rascunho. */
export function medicaoDaSerie(serie: SerieLocal) {
  const medicao = serie.medicaoCronometro;
  if (!medicao || medicao.serieId !== serie.id || medicao.medidoS !== serie.tempoS) return;
  const { alvoS, medidoS } = medicao;
  if (Number.isSafeInteger(alvoS) && alvoS > 0 &&
      Number.isSafeInteger(medidoS) && medidoS >= 0 && medidoS <= alvoS) return medicao;
}

export function camposDoCronometro(serieId: string, alvoS: number, medidoS: number) {
  return { tempoS: medidoS, medicaoCronometro: { serieId, alvoS, medidoS } };
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
    series: bloco.series.map((s) => {
      if (s.id !== serieId) return s;
      const nova = { ...s, ...campos };
      const manual = "tempoS" in campos && !("medicaoCronometro" in campos);
      if (nova.medicaoCronometro && (manual || !medicaoDaSerie(nova))) nova.medicaoCronometro = undefined;
      return nova;
    }),
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
        ...(medicaoDaSerie(proxima) ? {} : {
          tempoS: atual.tempoS, tempoSLado2: atual.tempoSLado2, medicaoCronometro: undefined,
        }),
        passos: atual.passos,
        assistencia: atual.assistencia,
      };
    }
    return { ...bloco, series };
  });
}

/* --------------------------------- prescrição só de hoje (SPEC §14.2) */

export const MIN_SERIES_DA_SESSAO = 1;
export const MAX_SERIES_DA_SESSAO = 10;

/**
 * O stepper Duração / Repetições / Séries da ficha (SPEC §14.2): muda **só a
 * prescrição desta sessão**, nunca o `exercise_state` nem o alvo do motor.
 *
 * - `alvo` reescreve o valor pré-preenchido das séries de trabalho que ainda
 *   não foram marcadas (o que já foi registrado não se mexe);
 * - `series` acrescenta séries iguais à última ou tira as que sobram no fim,
 *   sempre preservando as concluídas.
 *
 * O motor continua comparando o que foi feito com `bloco.alvo` (a faixa que
 * ele mandou hoje): fazer mais do que o pedido é sucesso, fazer menos é falha
 * — exatamente como seria digitando os números na mão.
 */
export function ajustarPrescricaoDaSessao(
  sessao: SessaoLocal,
  ordem: number,
  campos: { alvo?: number; series?: number },
  opcoes: { novoId?: () => string } = {},
): SessaoLocal {
  const novoId = opcoes.novoId ?? idPadrao;
  return trocarBloco(sessao, ordem, (bloco) => {
    let series = [...bloco.series];
    let prescricao = bloco.prescricao;

    if (typeof campos.alvo === "number" && Number.isFinite(campos.alvo)) {
      const valor = Math.max(1, Math.round(campos.alvo));
      series = series.map((s) => {
        if (s.tipo !== "trabalho" || s.concluida) return s;
        if (prescricao.tipo === "tempo_s") {
          return {
            ...s,
            tempoS: valor,
            medicaoCronometro: undefined,
            tempoSLado2: prescricao.unilateral ? valor : s.tempoSLado2,
          };
        }
        if (prescricao.tipo === "passos") return { ...s, passos: valor };
        if (prescricao.tipo === "maximo") return s;
        return {
          ...s,
          reps: valor,
          repsLado2: prescricao.unilateral ? valor : s.repsLado2,
        };
      });
    }

    if (typeof campos.series === "number" && Number.isFinite(campos.series)) {
      const quantas = Math.min(
        MAX_SERIES_DA_SESSAO,
        Math.max(MIN_SERIES_DA_SESSAO, Math.round(campos.series)),
      );
      const aquecimento = series.filter((s) => s.tipo === "aquecimento");
      let trabalho = series.filter((s) => s.tipo === "trabalho");

      while (trabalho.length > quantas) {
        const ultima = trabalho[trabalho.length - 1];
        // nunca apagar registro: uma série concluída segura o corte
        if (!ultima || ultima.concluida) break;
        trabalho = trabalho.slice(0, -1);
      }
      while (trabalho.length < quantas) {
        const modelo = trabalho[trabalho.length - 1];
        trabalho = [
          ...trabalho,
          modelo
            ? {
                ...modelo,
                medicaoCronometro: undefined,
                id: novoId(),
                setIndex: trabalho.length + 1,
                concluida: false,
                registradaEm: null,
              }
            : serieDeTrabalho(1, bloco.alvo, prescricao, novoId),
        ];
      }
      trabalho = trabalho.map((s, i) => ({ ...s, setIndex: i + 1 }));
      series = [...aquecimento, ...trabalho];
      prescricao = { ...prescricao, series: trabalho.length };
    }

    return { ...bloco, series, prescricao };
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
  const bloco = sessao.blocos.find((b) => b.ordem === ordem);
  if (!bloco || bloco.exercicioId === novoExercicioId) return sessao;
  const { trocados = [], ...anterior } = bloco;
  const iniciado = [anterior, ...trocados].some((b) => b.series.some((s) => s.concluida));
  const faltam = bloco.series.filter((s) => s.tipo === "trabalho" && !s.concluida).length;
  if (iniciado && faltam === 0) return sessao;

  const exercicio = acharExercicio(novoExercicioId);
  const volta = trocados.find((b) => b.exercicioId === novoExercicioId);
  const itemOriginal = exercicio.id === bloco.originalId && !volta
    ? (itensDoPlano(sessao.plano) ?? (ehTreinoDoPrograma(sessao.workoutId) ? itensDoTreino(sessao.workoutId) : []))
        .find((i) => i.exercicioId === exercicio.id)
    : undefined;
  const prescricao = volta?.prescricao ?? itemOriginal?.prescricao ?? prescricaoPadrao(exercicio);
  const alvo = volta?.alvo ?? cargaDeHoje(exercicio, estado, prescricao, sessao.opcoesMontagem);
  const feitas = volta?.series.filter((s) => s.concluida) ?? [];
  const trabalhoFeito = feitas.filter((s) => s.tipo === "trabalho");
  const vagas = iniciado ? faltam : (prescricao.series || bloco.prescricao.series);
  const usados = new Set(trabalhoFeito.map((s) => s.setIndex));
  const trabalho = [...trabalhoFeito];
  const novoId = extras.novoId ?? idPadrao;
  for (let indice = 1; trabalho.length < trabalhoFeito.length + vagas; indice++) {
    if (!usados.has(indice)) trabalho.push(serieDeTrabalho(indice, alvo, prescricao, novoId));
  }
  trabalho.sort((a, b) => a.setIndex - b.setIndex);
  const aquecimento = volta?.series.filter((s) => s.tipo === "aquecimento" && (s.concluida || !iniciado)) ?? [];
  const destino: RegistroDoExercicioTrocado = volta ?? {
    ...anterior,
    exercicioId: exercicio.id,
    substituido: exercicio.id !== bloco.originalId,
    descansoS: itemOriginal?.descansoS ?? exercicio.prescricao_padrao.descanso_s,
    descansoTexto: itemOriginal?.descansoTexto ?? textoDoDescanso(exercicio.prescricao_padrao.descanso_s),
    estado,
    estadoConhecido: extras.estadoConhecido !== false,
    seriesAnteriores: extras.anteriores ?? null,
    recordeCarga: extras.recorde?.carga_max_kg ?? null,
    recordeReps: extras.recorde?.reps_max ?? null,
    recordeE1rm: extras.recorde?.e1rm_epley ?? null,
    nota: null,
    ultimaFirme: null,
  };
  return trocarBloco(sessao, ordem, () => ({
    ...destino,
    prescricao: { ...prescricao, series: trabalho.length },
    alvo,
    series: [...aquecimento, ...trabalho],
    trocados: [...trocados.filter((b) => b !== volta), anterior],
  }));
}

export function avisoDaTroca(bloco: BlocoLocal): string {
  const feitas = [bloco, ...(bloco.trocados ?? [])].some((b) => b.series.some((s) => s.concluida));
  return feitas
    ? "As séries já feitas ficam com cada exercício. Só as séries de trabalho restantes passam para o exercício escolhido."
    : "O exercício escolhido usa a própria carga e prescrição.";
}

export function textoDosTrocados(bloco: BlocoLocal): string | null {
  const partes: string[] = [];
  for (const anterior of bloco.trocados ?? []) {
    const n = anterior.series.filter((s) => s.concluida).length;
    if (n > 0) partes.push(`${n} ${n === 1 ? "série" : "séries"} de ${acharExercicio(anterior.exercicioId).nome}`);
  }
  return partes.length ? `Feitas antes da troca: ${partes.join(" e ")}.` : null;
}

/**
 * As substituições escolhidas antes de começar (SPEC §13.3) aplicadas de uma
 * vez à sessão recém-montada — o mesmo caminho da troca dentro da sessão
 * (§3.2), bloco a bloco.
 */
export function comSubstituicoes(
  sessao: SessaoLocal,
  substituicoes: Record<string, string>,
  dados: {
    estados?: Record<string, EstadoExercicio | null>;
    anteriores?: Record<string, (number | null)[]>;
    recordes?: Record<string, RecordeAntes>;
    estadoConhecido?: boolean;
    conhecidos?: ReadonlySet<string>;
    novoId?: () => string;
  } = {},
): SessaoLocal {
  const escolhas = ehTreinoDoPrograma(sessao.workoutId)
    ? resolverTrocasDoTreino(sessao.workoutId, {}, substituicoes)
    : substituicoes;
  let atual = sessao;
  for (const bloco of sessao.blocos) {
    const novo = escolhas[bloco.originalId];
    if (!novo || novo === bloco.originalId) continue;
    if (!exercicioPorId.has(novo)) continue;
    atual = substituirExercicio(atual, bloco.ordem, novo, dados.estados?.[novo] ?? null, {
      anteriores: dados.anteriores?.[novo] ?? null,
      recorde: dados.recordes?.[novo],
      estadoConhecido: dados.conhecidos
        ? dados.conhecidos.has(novo)
        : dados.estadoConhecido,
      novoId: dados.novoId,
    });
  }
  return atual;
}

/** O descanso em texto quando o programa não traz um (troca de exercício). */
export function textoDoDescanso(segundos: number): string {
  if (segundos < 120) return `${segundos} s`;
  return `${formatarNumero(segundos / 60)} min`;
}

/** Alternativas compatíveis, compartilhadas com a ficha e a prévia. */
export function substitutosPara(exercicioId: string): Exercicio[] {
  return alternativasPara(exercicioId);
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

/* ------------------------------------------ nomes da série (Visão geral) */

export interface RotulosDaSerie {
  /** "Série 1", "Aquecimento 2" — o que a linha mostra. */
  nome: string;
  /** "Série 1 — Levantamento terra": o nome do grupo da linha. */
  grupo: string;
  /**
   * O visto: "Série 1 concluída — Levantamento terra", "Aquecimento 1
   * concluído — Agachamento livre" (§22.18 item 5): o gênero certo e de qual
   * exercício — eram 6 "Série 1 concluída" iguais na Visão geral.
   */
  concluida: string;
  /** O complemento dos − e +: "da Série 1 de Levantamento terra". */
  contexto: string;
}

/**
 * Os nomes de uma linha de série da Visão geral (SPEC §22.18 item 5): uma
 * fonte só para o grupo, o visto e os steppers. "Aquecimento" é masculino e
 * "Série", feminina; o exercício entra com "de", sem artigo (§22.15 item 3).
 */
export function rotulosDaSerie(
  tipo: TipoSerie,
  indice: number,
  exercicioNome: string,
): RotulosDaSerie {
  const aquecimento = tipo === "aquecimento";
  const nome = aquecimento ? `Aquecimento ${indice}` : `Série ${indice}`;
  return {
    nome,
    grupo: `${nome} — ${exercicioNome}`,
    concluida: `${nome} ${aquecimento ? "concluído" : "concluída"} — ${exercicioNome}`,
    contexto: `${aquecimento ? "do" : "da"} ${nome} de ${exercicioNome}`,
  };
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
    for (const anterior of bloco.trocados ?? []) {
      const n = anterior.series.filter((s) => s.tipo === "trabalho" && s.concluida).length;
      feitas += n;
      total += n;
    }
    for (const serie of bloco.series) {
      if (serie.tipo !== "trabalho") continue;
      total += 1;
      if (serie.concluida) feitas += 1;
    }
  }
  return { feitas, total, texto: `${feitas}/${total} séries` };
}

/**
 * O "próximo: …" do rodapé da sessão (SPEC §13.3): o exercício que vem depois
 * do que está em andamento — o segundo bloco com série de trabalho por fazer.
 * `null` quando o treino está no último bloco (ou acabou).
 */
export function proximoExercicio(sessao: SessaoLocal): string | null {
  const pendentes = blocosNaOrdemDeExecucao(sessao).filter((bloco) =>
    bloco.series.some((s) => s.tipo === "trabalho" && !s.concluida),
  );
  const proximo = pendentes[1];
  return proximo ? acharExercicio(proximo.exercicioId).nome : null;
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

function planoAtualOuDosBlocos(sessao: SessaoLocal): PlanoDaSessao {
  return sessao.plano ?? planoDaSessao(sessao.blocos.map((bloco) => {
    const original = [bloco, ...(bloco.trocados ?? [])].find((b) => b.exercicioId === bloco.originalId) ?? bloco;
    return { exercicioId: original.exercicioId, prescricao: original.prescricao, descansoS: original.descansoS, descansoTexto: original.descansoTexto };
  }));
}

/** O material só limita as alternativas que a pessoa poderá escolher. */
export function definirEquipamentoDaSessao(sessao: SessaoLocal, disponiveis: ReadonlySet<EquipamentoTag>): SessaoLocal {
  const tags = tagsDoEquipamento(disponiveis);
  const atual = equipamentoDaSessao(sessao);
  if (tags.length === atual.size && tags.every((tag) => atual.has(tag))) return sessao;
  return { ...sessao, plano: { ...planoAtualOuDosBlocos(sessao), equipamento_disponivel: tags } };
}

/** Guarda o intervalo para o movimento executado. A prescrição original continua no bloco. */
export function definirDescansoDoExercicioNaSessao(
  sessao: SessaoLocal, exercicioId: string, segundos: number | null,
): SessaoLocal {
  if (sessao.status !== "em_andamento" || !sessao.blocos.some(b => b.exercicioId === exercicioId)) return sessao;
  if (segundos !== null && !Number.isFinite(segundos)) return sessao;
  const valor = segundos === null ? null : limitarTempoDeDescanso(segundos);
  if (valor === descansoPersonalizadoDaSessao(sessao, exercicioId)) return sessao;

  const plano = { ...planoAtualOuDosBlocos(sessao) };
  const atual = plano.descansos_por_exercicio;
  const descansos = atual && typeof atual === "object" && !Array.isArray(atual) ? { ...atual } : {};
  if (valor === null) delete descansos[exercicioId];
  else descansos[exercicioId] = valor;
  if (Object.keys(descansos).length) plano.descansos_por_exercicio = descansos;
  else delete plano.descansos_por_exercicio;
  return bloquearDesfazerSeIniciado({ ...sessao, plano });
}

/** O plano mantém a escolha mesmo que o substituto ainda não tenha uma série no banco. */
export function planoParaGravar(sessao: SessaoLocal): PlanoDaSessao | null {
  const alterados = sessao.blocos.filter((b) => b.trocados?.length);
  if (!alterados.length) return sessao.plano;
  return {
    ...planoAtualOuDosBlocos(sessao),
    trocas: Object.fromEntries(alterados.map((b) => [b.ordem, [b, ...(b.trocados ?? [])].map((e) => ({
      exercicio_id: e.exercicioId,
      trabalho: e.series.filter((s) => s.tipo === "trabalho").map((s) => s.setIndex),
      aquecimento: e.series.filter((s) => s.tipo === "aquecimento").map((s) => s.setIndex),
      ultima_firme: e.ultimaFirme, nota: e.nota,
    }))])),
  };
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
      semana_plano: sessao.semanaPlano,
      plano: planoParaGravar(sessao),
    },
  };
}

/** Todas as séries efetivamente feitas, com o exercício, a carga e o feedback que lhes pertencem. */
type EscritaDeSerie = Escrita & { linha: LinhaSerie };

export function escritasDasSeriesFeitas(sessao: SessaoLocal): EscritaDeSerie[] {
  return sessao.blocos.flatMap((bloco) =>
    [bloco, ...(bloco.trocados ?? [])].flatMap((exercicio) =>
      exercicio.series.filter((s) => s.concluida).map((s) => escritaDaSerie(sessao, exercicio, s)),
    ),
  );
}

/** Uma série concluída (`session_sets`), upsert por id: remarcar não duplica. */
export function escritaDaSerie(
  sessao: SessaoLocal,
  bloco: BlocoLocal,
  serie: SerieLocal,
): EscritaDeSerie {
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
  /** "carga máxima", "repetições", "carga máxima estimada" */
  rotulo: string;
  valor: number;
  texto: string;
  /**
   * A marca que ele bateu (`v_records` antes desta sessão); `null` = a
   * estreia do exercício — nada a bater (SPEC §22.18 item 3).
   */
  anterior: number | null;
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
   * O bloco ficou de fora do motor: as séries (se houver) são gravadas, a
   * progressão não. São dois casos, em `motivoNaoAvaliado`.
   */
  naoAvaliado: boolean;
  /**
   * Por que ficou de fora:
   * - `"nao_feito"`: nenhuma série de trabalho concluída (SPEC §6.3) — o
   *   exercício não foi tentado, então não conta como falha;
   * - `"estado_desconhecido"`: o `exercise_state` dele não foi lido.
   */
  motivoNaoAvaliado: "nao_feito" | "estado_desconhecido" | null;
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
      anterior: marcaAnterior(bloco.recordeCarga),
    });
  }
  if (repsMax > 0 && repsMax > (bloco.recordeReps ?? 0)) {
    novos.push({
      tipo: "reps",
      rotulo: "repetições",
      valor: repsMax,
      texto: `${repsMax} repetições`,
      anterior: marcaAnterior(bloco.recordeReps),
    });
  }
  if (e1rm > 0 && e1rm > (bloco.recordeE1rm ?? 0) + 1e-9) {
    novos.push({
      tipo: "e1rm",
      rotulo: "carga máxima estimada",
      valor: e1rm,
      texto: `${formatarKg(e1rm, 1)} de carga máxima estimada`,
      anterior: marcaAnterior(bloco.recordeE1rm),
    });
  }
  return novos;
}

function marcaAnterior(valor: number | null): number | null {
  return valor !== null && valor > 0 ? valor : null;
}

/** Quantos recordes a conclusão mostra antes do "Ver todos" (§22.18 item 3). */
export const RECORDES_EM_DESTAQUE = 5;

export interface RecordeDaConclusao {
  nome: string;
  texto: string;
}

/**
 * Os recordes da conclusão em ordem de destaque (SPEC §22.18 item 3): primeiro
 * os que batem uma marca anterior, pelo maior salto relativo sobre ela; depois
 * as estreias (sem marca), na ordem do treino e, no mesmo exercício, carga →
 * repetições → estimada. `visiveis` são os `limite` primeiros; `todos`, a
 * lista inteira nessa mesma ordem.
 */
export function recordesEmDestaque(
  resultados: readonly Pick<ResultadoExercicio, "nome" | "ordem" | "recordes">[],
  limite: number = RECORDES_EM_DESTAQUE,
): { visiveis: RecordeDaConclusao[]; todos: RecordeDaConclusao[] } {
  const ORDEM_DO_TIPO = { carga: 0, reps: 1, e1rm: 2 } as const;
  const lista = resultados.flatMap((r) =>
    r.recordes.map((rec) => ({
      nome: r.nome,
      texto: rec.texto,
      ordem: r.ordem,
      tipo: ORDEM_DO_TIPO[rec.tipo],
      salto: rec.anterior !== null ? (rec.valor - rec.anterior) / rec.anterior : null,
    })),
  );
  lista.sort((a, b) => {
    if (a.salto !== null && b.salto !== null && a.salto !== b.salto) return b.salto - a.salto;
    if ((a.salto === null) !== (b.salto === null)) return a.salto === null ? 1 : -1;
    return a.ordem - b.ordem || a.tipo - b.tipo;
  });
  const todos = lista.map(({ nome, texto }) => ({ nome, texto }));
  return { visiveis: todos.slice(0, Math.max(0, limite)), todos };
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
    const trabalho = bloco.series.filter((s) => s.tipo === "trabalho");
    /*
     * SPEC §6.3: um bloco sem NENHUMA série de trabalho concluída não foi
     * feito — e o que não foi tentado não pode virar falha. A montagem já cria
     * as séries vazias, então mandá-las ao motor seria ler "série não
     * concluída" = falha (§6.2) para um exercício que o dono pulou: duas
     * sessões assim tirariam 10 % da carga de um exercício nunca tentado.
     * Passar a lista vazia faz o motor devolver `nada` (nem estado, nem
     * evento); as séries continuam gravadas como sempre.
     */
    const nadaFeito = !trabalho.some((s) => s.concluida);
    const decisao = decidir(
      exercicio,
      bloco.estado,
      nadaFeito ? [] : trabalho.map(serieParaMotor),
      {
        prescricao: bloco.prescricao,
        ultimaFirme: firme,
        sessaoAbandonada: abandonada,
        seriesAnteriores: bloco.seriesAnteriores,
        montagem: sessao.opcoesMontagem,
      },
    );
    /*
     * Fora do motor (SPEC §6.3), por não ter sido feito ou porque a carga
     * atual dele é desconhecida — aí a decisão sairia de uma carga inventada e
     * o upsert apagaria a progressão real. O evento vira nulo — e é ele que
     * `concluirSessao` usa para decidir o que gravar.
     */
    if (nadaFeito || !blocoAvaliavel(bloco)) {
      return {
        exercicioId: bloco.exercicioId,
        nome: exercicio.nome,
        ordem: bloco.ordem,
        motivo: null,
        simbolo: null,
        falha: false,
        naoAvaliado: true,
        motivoNaoAvaliado: nadaFeito ? "nao_feito" : "estado_desconhecido",
        texto: nadaFeito
          ? "sem série registrada: não foi feito nesta sessão"
          : "não avaliado: não consegui ler a carga atual deste exercício",
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
      motivoNaoAvaliado: null,
      texto: textoDaDecisao(exercicio, decisao),
      // o motor devolve a chave; o texto vem de data/progressao.json
      aviso: textoDoMotor(evento?.aviso),
      sugestao: textoDoMotor(evento?.sugestao),
      recordes: recordesDoBloco(bloco),
      decisao,
    } satisfies ResultadoExercicio;
  });
}

function linhaDeEstado(
  sessao: SessaoLocal,
  exercicioId: string,
  estado: EstadoExercicio,
) {
  // A progressão grava só o que ela calculou. Nota, incremento manual e
  // desativação podem ter sido editados depois da abertura desta sessão.
  return {
    user_id: sessao.userId,
    exercise_id: exercicioId,
    carga_atual_kg: estado.carga_atual_kg,
    reps_alvo: estado.reps_alvo,
    tempo_alvo_s: estado.tempo_alvo_s,
    assistencia: estado.assistencia,
    falhas_seguidas: estado.falhas_seguidas,
    incremento_reduzido: estado.incremento_reduzido,
    exigir_rep_extra: estado.exigir_rep_extra,
    semana_leve: estado.semana_leve,
    carga_antes_leve: estado.carga_antes_leve,
    sessoes_graca: estado.sessoes_graca,
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

  /*
   * A linha INTEIRA por upsert, não um `update` do que mudou (SPEC §8).
   *
   * A criação da sessão e a conclusão dela são dois itens da fila de saída, e
   * a fila não garante que o primeiro tenha subido quando o segundo vai: basta
   * o POST da criação falhar uma vez (um 401 de token vencido ao voltar a
   * rede, um timeout) para o `update` chegar antes. Um `update` que não casa
   * com nenhuma linha é **sucesso** no PostgREST (204, zero linhas), então o
   * item saía da fila como enviado e a sessão ficava "em_andamento" para
   * sempre no banco — sem duração, sem sensação, sem as notas, sem o peso do
   * dia. O upsert por id grava a sessão inteira em qualquer ordem e pode ser
   * repetido à vontade.
   */
  const base = escritaDaSessao(sessao);
  const escritas: Escrita[] = [
    {
      ...base,
      linha: {
        ...base.linha,
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
      // upsert pelo id do cliente: reenviar o item não duplica a linha nem
      // trava a fila num 409 de chave repetida (SPEC §8)
      tabela: "progression_events",
      op: "upsert",
      onConflict: "id",
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

/** Os três contadores da conclusão (SPEC §14.1.5): exercícios, séries, volume. */
export interface ContadoresDaSessao {
  /** Exercícios com pelo menos uma série de trabalho registrada. */
  exercicios: number;
  series: number;
  /** Σ reps × kg das séries de trabalho (peso do corpo não soma). */
  volumeKg: number;
}

export function contadoresDaSessao(sessao: SessaoLocal): ContadoresDaSessao {
  let exercicios = 0;
  let series = 0;
  let volumeKg = 0;
  for (const bloco of sessao.blocos.flatMap((b) => [b, ...(b.trocados ?? [])])) {
    const feitas = bloco.series.filter((s) => s.concluida && s.tipo === "trabalho");
    if (feitas.length > 0) exercicios++;
    series += feitas.length;
    for (const serie of feitas) {
      volumeKg += ((serie.reps ?? 0) + (serie.repsLado2 ?? 0)) * (serie.cargaKg ?? 0);
    }
  }
  return { exercicios, series, volumeKg: Math.round(volumeKg * 10) / 10 };
}

/** Mantém em sessions.notas o resumo das notas dos blocos que os clientes antigos leem. */
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
