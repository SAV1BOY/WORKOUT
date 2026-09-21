/**
 * A máquina de estados do player (SPEC §14.1).
 *
 * Função pura: recebe a sessão montada por `lib/sessao.ts` e devolve a
 * **sequência de passos** que a tela percorre —
 * preparação → [por exercício: aquecimentos → séries de trabalho → "firme?"]
 * → feedback → conclusão — com os descansos entre séries e entre exercícios.
 *
 * Nada aqui importa React, Supabase ou Dexie, e nada aqui decide progressão:
 * quem decide é `lib/progressao.ts` (intocado). O player só diz **onde o
 * Miguel está** e **para onde vai**.
 *
 * O relógio é sempre um instante em milissegundos (`Date.now()`), nunca uma
 * soma de ticks: com a tela apagada o navegador atrasa o `setInterval`, e
 * somar ticks daria um descanso maior do que o pedido.
 */
import { acharExercicio } from "@/lib/dados";
import type { BlocoLocal, SerieLocal, SessaoLocal } from "@/lib/sessao";

/* ------------------------------------------------------------ constantes */

/** Contagem antes do primeiro exercício (SPEC §14.1.1), em segundos. */
export const PREPARACAO_PADRAO_S = 10;

/** O "+20 s" da tela de descanso (SPEC §14.1.3). */
export const EXTRA_DESCANSO_S = 20;

/** Limites do "Editar tempo de descanso". */
export const DESCANSO_MIN_S = 5;
export const DESCANSO_MAX_S = 900;

/** Limites da preparação (0 = sem tela de preparação). */
export const PREPARACAO_MIN_S = 0;
export const PREPARACAO_MAX_S = 60;

/* ----------------------------------------------------------------- passos */

export interface PassoPreparacao {
  tipo: "preparacao";
  chave: string;
  segundos: number;
  /** O exercício que vem logo depois. */
  ordem: number;
  exercicioId: string;
}

export interface PassoSerie {
  tipo: "serie";
  chave: string;
  ordem: number;
  exercicioId: string;
  serieId: string;
  aquecimento: boolean;
  /** 1..total dentro do próprio tipo (aquecimento ou trabalho). */
  numero: number;
  total: number;
  /** Posição do exercício no treino (1..totalExercicios). */
  posicao: number;
  totalExercicios: number;
}

export interface PassoDescanso {
  tipo: "descanso";
  chave: string;
  segundos: number;
  /** Descanso entre exercícios (em vez de entre séries do mesmo). */
  entreExercicios: boolean;
  /** Índice do passo que vem depois — é para lá que "Pular" leva. */
  indiceProximo: number;
}

export interface PassoFirme {
  tipo: "firme";
  chave: string;
  ordem: number;
  exercicioId: string;
}

export interface PassoFeedback {
  tipo: "feedback";
  chave: "feedback";
}

export interface PassoConclusao {
  tipo: "conclusao";
  chave: "conclusao";
}

export type Passo =
  | PassoPreparacao
  | PassoSerie
  | PassoDescanso
  | PassoFirme
  | PassoFeedback
  | PassoConclusao;

export interface OpcoesDoPlayer {
  /** `prefs.preparacao_s` (0 tira a tela de preparação). */
  preparacaoS?: number;
  /** `prefs.descanso_padrao_s`; vazio/null = o `descanso_s` do exercício. */
  descansoPadraoS?: number | null;
}

/** O descanso deste exercício: a preferência quando existe, senão o do JSON. */
export function descansoDoBloco(
  bloco: BlocoLocal,
  opcoes: OpcoesDoPlayer = {},
): number {
  const padrao = opcoes.descansoPadraoS;
  if (typeof padrao === "number" && padrao > 0) return Math.round(padrao);
  return bloco.descansoS;
}

function descansoDepoisDe(
  passos: Passo[],
  segundos: number,
  entreExercicios: boolean,
): PassoDescanso {
  const anterior = passos[passos.length - 1];
  return {
    tipo: "descanso",
    chave: `descanso:${anterior ? anterior.chave : passos.length}`,
    segundos,
    entreExercicios,
    // o descanso ainda vai ser empilhado: o próximo passo é o índice seguinte
    indiceProximo: passos.length + 1,
  };
}

/**
 * A sequência inteira do player (SPEC §14.1). As séries entram na ordem
 * aquecimento → trabalho, como a sessão as guarda; um exercício sem série de
 * trabalho (não existe hoje, mas o tipo permite) não ganha a pergunta "firme?".
 */
export function sequenciaDoPlayer(
  sessao: SessaoLocal,
  opcoes: OpcoesDoPlayer = {},
): Passo[] {
  const passos: Passo[] = [];
  const blocos = [...sessao.blocos].sort((a, b) => a.ordem - b.ordem);
  const preparacaoS = Math.max(0, Math.round(opcoes.preparacaoS ?? PREPARACAO_PADRAO_S));

  const primeiro = blocos[0];
  if (primeiro && preparacaoS > 0) {
    passos.push({
      tipo: "preparacao",
      chave: "preparacao",
      segundos: preparacaoS,
      ordem: primeiro.ordem,
      exercicioId: primeiro.exercicioId,
    });
  }

  blocos.forEach((bloco, i) => {
    const descanso = descansoDoBloco(bloco, opcoes);
    const aquecimentos = bloco.series.filter((s) => s.tipo === "aquecimento");
    const trabalho = bloco.series.filter((s) => s.tipo !== "aquecimento");
    const todas = [...aquecimentos, ...trabalho];

    todas.forEach((serie, j) => {
      const aquecimento = serie.tipo === "aquecimento";
      passos.push({
        tipo: "serie",
        chave: `serie:${serie.id}`,
        ordem: bloco.ordem,
        exercicioId: bloco.exercicioId,
        serieId: serie.id,
        aquecimento,
        numero: aquecimento ? j + 1 : j - aquecimentos.length + 1,
        total: aquecimento ? aquecimentos.length : trabalho.length,
        posicao: i + 1,
        totalExercicios: blocos.length,
      });
      const ultimaDoBloco = j === todas.length - 1;
      if (!ultimaDoBloco && descanso > 0) {
        passos.push(descansoDepoisDe(passos, descanso, false));
      }
    });

    if (trabalho.length > 0) {
      passos.push({
        tipo: "firme",
        chave: `firme:${bloco.ordem}`,
        ordem: bloco.ordem,
        exercicioId: bloco.exercicioId,
      });
    }

    if (i < blocos.length - 1 && descanso > 0) {
      passos.push(descansoDepoisDe(passos, descanso, true));
    }
  });

  passos.push({ tipo: "feedback", chave: "feedback" });
  passos.push({ tipo: "conclusao", chave: "conclusao" });
  return passos;
}

/* --------------------------------------------------------- olhar a sessão */

export function blocoDoPasso(
  sessao: SessaoLocal,
  passo: Passo,
): BlocoLocal | null {
  if (passo.tipo !== "serie" && passo.tipo !== "firme" && passo.tipo !== "preparacao") {
    return null;
  }
  return sessao.blocos.find((b) => b.ordem === passo.ordem) ?? null;
}

export function serieDoPasso(
  sessao: SessaoLocal,
  passo: PassoSerie,
): SerieLocal | null {
  const bloco = sessao.blocos.find((b) => b.ordem === passo.ordem);
  return bloco?.series.find((s) => s.id === passo.serieId) ?? null;
}

/** "Série 2 de 3" · "Aquecimento 1 de 2" (SPEC §14.1.2). */
export function rotuloDoPasso(passo: PassoSerie): string {
  const nome = passo.aquecimento ? "Aquecimento" : "Série";
  return `${nome} ${passo.numero} de ${passo.total}`;
}

/* ------------------------------------------------ o que a tela do meio é */

/**
 * O bloco central da tela de exercício depende do tipo (SPEC §14.1.2):
 * carga · peso corporal por reps · tempo · passos · máximo · assistida.
 * As séries de aquecimento são sempre reps com carga.
 */
export type TipoEntrada =
  | "carga"
  | "reps"
  | "tempo"
  | "passos"
  | "maximo"
  | "assistida";

export interface EntradaDoPasso {
  tipo: TipoEntrada;
  /** Mostra o stepper de carga (e a montagem). */
  comCarga: boolean;
  /** Dois números, D e E (SPEC §6.3: vale o menor lado). */
  unilateral: boolean;
}

export function entradaDoPasso(
  bloco: BlocoLocal,
  serie: SerieLocal,
): EntradaDoPasso {
  const exercicio = acharExercicio(bloco.exercicioId);
  const comCarga =
    serie.cargaKg !== null &&
    (serie.cargaKg > 0 || exercicio.progressao.tipo === "carga");

  if (serie.tipo === "aquecimento") {
    return { tipo: "carga", comCarga, unilateral: false };
  }

  const unilateral = bloco.prescricao.unilateral;
  if (exercicio.progressao.tipo === "assistencia") {
    return { tipo: "assistida", comCarga, unilateral };
  }
  if (bloco.prescricao.tipo === "tempo_s") {
    return { tipo: "tempo", comCarga, unilateral };
  }
  if (bloco.prescricao.tipo === "passos") {
    return { tipo: "passos", comCarga, unilateral };
  }
  if (bloco.prescricao.tipo === "maximo") {
    return { tipo: "maximo", comCarga, unilateral };
  }
  return { tipo: comCarga ? "carga" : "reps", comCarga, unilateral };
}

/* ------------------------------------------------------------ navegação */

export function indiceDaChave(seq: readonly Passo[], chave: string): number {
  return seq.findIndex((p) => p.chave === chave);
}

export function passoDe(seq: readonly Passo[], indice: number): Passo | null {
  return seq[indice] ?? null;
}

/**
 * Onde retomar uma sessão que não tem passo salvo neste aparelho (refeita a
 * partir do banco, SPEC §8): sem nenhuma série marcada, na preparação; com
 * alguma, na primeira série que falta; com todas, no feedback.
 */
export function indiceDeRetomada(
  seq: readonly Passo[],
  sessao: SessaoLocal,
): number {
  const algumaFeita = sessao.blocos.some((b) => b.series.some((s) => s.concluida));
  if (!algumaFeita) return 0;
  const pendente = seq.findIndex(
    (p) => p.tipo === "serie" && serieDoPasso(sessao, p)?.concluida !== true,
  );
  if (pendente >= 0) return pendente;
  const feedback = indiceDaChave(seq, "feedback");
  return feedback >= 0 ? feedback : Math.max(0, seq.length - 1);
}

/** O passo logo depois do ✓ (normalmente o descanso). */
export function apos(seq: readonly Passo[], indice: number): number {
  return Math.min(indice + 1, Math.max(0, seq.length - 1));
}

/** A seta "próximo": pula os descansos, que são passagem, não destino. */
export function seguinte(seq: readonly Passo[], indice: number): number {
  for (let i = indice + 1; i < seq.length; i++) {
    if (seq[i]?.tipo !== "descanso") return i;
  }
  return Math.max(0, seq.length - 1);
}

/** A seta "anterior": idem, para trás. */
export function anterior(seq: readonly Passo[], indice: number): number {
  for (let i = indice - 1; i >= 0; i--) {
    if (seq[i]?.tipo !== "descanso") return i;
  }
  return 0;
}

/** Quantas séries a sessão tem, para a barra fina de progresso. */
export function totalDeSeries(seq: readonly Passo[]): number {
  return seq.filter((p) => p.tipo === "serie").length;
}

/** Quantas séries já ficaram para trás (inclusive a atual). */
export function posicaoNaSequencia(seq: readonly Passo[], indice: number): number {
  let n = 0;
  for (let i = 0; i <= indice && i < seq.length; i++) {
    if (seq[i]?.tipo === "serie") n += 1;
  }
  return n;
}

/* --------------------------------------------------- estado (com relógio) */

/**
 * O passo atual, como ele vive no Dexie (dentro de `sessaoAtiva`): a chave do
 * passo e, quando ele conta o tempo, o instante em que a contagem acaba.
 */
export interface EstadoPlayer {
  chave: string;
  /** ms epoch do fim da contagem; `null` nos passos sem relógio. */
  fimEm: number | null;
  /** Segundos totais da contagem atual, já com os "+20 s". */
  totalS: number | null;
}

function contaTempo(passo: Passo): number | null {
  if (passo.tipo === "descanso" || passo.tipo === "preparacao") return passo.segundos;
  return null;
}

/** O estado de quem acabou de chegar neste passo. */
export function estadoDoPasso(passo: Passo, agora: number): EstadoPlayer {
  const segundos = contaTempo(passo);
  return {
    chave: passo.chave,
    fimEm: segundos === null ? null : agora + segundos * 1000,
    totalS: segundos,
  };
}

/** Ir para um índice qualquer da sequência (o índice é preso aos limites). */
export function irPara(
  seq: readonly Passo[],
  indice: number,
  agora: number,
): EstadoPlayer {
  const preso = Math.min(Math.max(0, indice), Math.max(0, seq.length - 1));
  const passo = seq[preso];
  if (!passo) return { chave: "conclusao", fimEm: null, totalS: null };
  return estadoDoPasso(passo, agora);
}

/** Segundos que faltam (0 quando já zerou ou quando o passo não conta tempo). */
export function restanteS(estado: EstadoPlayer, agora: number): number {
  if (estado.fimEm === null) return 0;
  return Math.max(0, Math.ceil((estado.fimEm - agora) / 1000));
}

/** Fração que ainda falta (1 → 0), para o anel e a barra. */
export function fracaoRestante(estado: EstadoPlayer, agora: number): number {
  if (estado.fimEm === null || !estado.totalS) return 0;
  const falta = (estado.fimEm - agora) / 1000;
  return Math.min(1, Math.max(0, falta / estado.totalS));
}

export function zerou(estado: EstadoPlayer, agora: number): boolean {
  return estado.fimEm !== null && agora >= estado.fimEm;
}

/**
 * O que o leitor de tela ouve durante o descanso (SPEC §22.5 item 7).
 *
 * O texto só muda em MARCOS — 30 s, 10 s e o fim —, e é isso que o torna
 * dizível: um `role="status"` que mudasse a cada segundo faria o leitor falar
 * por cima de si mesmo, e um `role="timer"` sozinho (o que havia) tem
 * `aria-live` desligado por padrão e nunca anuncia nada. Um marco só existe
 * quando o descanso é mais longo que ele: num descanso de 20 s ninguém deve
 * ouvir "faltam 30 segundos".
 */
export function avisoDoDescanso(
  falta: number,
  totalS: number,
  acabou: boolean,
): string {
  if (acabou) return "Descanso terminado, próxima série.";
  if (falta <= 10 && totalS > 10) return "Faltam 10 segundos de descanso.";
  if (falta <= 30 && totalS > 30) return "Faltam 30 segundos de descanso.";
  return "";
}

/**
 * "+20 s": soma ao que FALTA (empurra o fim), em vez de recomeçar — a 0:10 do
 * fim de um descanso de 2:30 a resposta é 0:30, não 2:50.
 */
export function somarSegundos(
  estado: EstadoPlayer,
  segundos: number,
  agora: number,
): EstadoPlayer {
  if (estado.fimEm === null) return estado;
  return {
    ...estado,
    fimEm: Math.max(estado.fimEm, agora) + segundos * 1000,
    totalS: (estado.totalS ?? 0) + segundos,
  };
}

/** "Editar tempo de descanso": recomeça a contagem com a duração nova. */
export function definirDuracao(
  estado: EstadoPlayer,
  segundos: number,
  agora: number,
): EstadoPlayer {
  const preso = Math.min(DESCANSO_MAX_S, Math.max(DESCANSO_MIN_S, Math.round(segundos)));
  return { ...estado, fimEm: agora + preso * 1000, totalS: preso };
}

/* ------------------------------------------------------------- feedback */

/**
 * "O que você achou do treino de hoje?" (SPEC §14.1.4) → `sessions.sensacao`.
 *
 * O mapeamento é **1 = muito difícil … 5 = muito fácil**: a coluna guarda o
 * esforço percebido de baixo para cima, e é nessa direção que o resumo do
 * histórico lê. Na tela as opções aparecem na ordem da referência (do mais
 * fácil para o mais difícil), por isso a lista abaixo começa no 5.
 */
export interface OpcaoDeFeedback {
  valor: 1 | 2 | 3 | 4 | 5;
  rotulo: string;
}

export const OPCOES_DE_FEEDBACK: readonly OpcaoDeFeedback[] = [
  { valor: 5, rotulo: "Muito fácil" },
  { valor: 4, rotulo: "Um pouco fácil" },
  { valor: 3, rotulo: "Na medida certa" },
  { valor: 2, rotulo: "Um pouco difícil" },
  { valor: 1, rotulo: "Muito difícil" },
];

export function rotuloDaSensacao(valor: number | null): string | null {
  return OPCOES_DE_FEEDBACK.find((o) => o.valor === valor)?.rotulo ?? null;
}

/* -------------------------------------------- "anterior: 9,5 kg × 5" (§7) */

/** O mínimo de uma série já registrada noutra sessão. */
export interface SerieDeOutroDia {
  exercise_id: string;
  session_id: string;
  set_index: number;
  tipo: string;
  concluida: boolean;
  registrada_em: string;
  reps: number | null;
  carga_kg: number | null;
  tempo_s: number | null;
}

/**
 * As séries de trabalho da **última sessão** de cada exercício, em ordem de
 * série — é delas que sai a linha "anterior: 9,5 kg × 5" do player.
 * A sessão de hoje é ignorada: ela não é "a anterior" dela mesma.
 */
export function anterioresPorExercicio(
  linhas: readonly SerieDeOutroDia[],
  ignorarSessao?: string,
): Record<string, SerieDeOutroDia[]> {
  const uteis = linhas.filter(
    (l) =>
      l.tipo === "trabalho" &&
      l.concluida &&
      (!ignorarSessao || l.session_id !== ignorarSessao),
  );

  const ultima = new Map<string, { sessao: string; quando: string }>();
  for (const linha of uteis) {
    const atual = ultima.get(linha.exercise_id);
    if (!atual || linha.registrada_em > atual.quando) {
      ultima.set(linha.exercise_id, {
        sessao: linha.session_id,
        quando: linha.registrada_em,
      });
    }
  }

  const saida: Record<string, SerieDeOutroDia[]> = {};
  for (const [exercicio, { sessao }] of ultima) {
    saida[exercicio] = uteis
      .filter((l) => l.exercise_id === exercicio && l.session_id === sessao)
      .sort((a, b) => a.set_index - b.set_index);
  }
  return saida;
}

/** A série correspondente do dia anterior (a de mesmo número, ou a última). */
export function serieAnteriorDe(
  anteriores: readonly SerieDeOutroDia[] | undefined,
  numero: number,
): SerieDeOutroDia | null {
  if (!anteriores || anteriores.length === 0) return null;
  return anteriores[numero - 1] ?? anteriores[anteriores.length - 1] ?? null;
}
