/**
 * Adaptadores puros das sessões de cardio (SPEC §3.3 e §5.5).
 *
 * Aqui mora o plano da sessão virado em blocos de tempo (o que o timer de
 * intervalos mostra), o relógio do timer como dado (pausar, retomar, pular,
 * sobreviver a recarregar) e o que vai para `cardio_sessions`. Nenhuma
 * dependência de React, Supabase ou Dexie — o conteúdo vem de `lib/dados.ts`
 * e a regra das semanas, de `lib/calendario.ts`.
 */
import {
  avancarSemanaDeBarraFixa,
  avancarSemanaDeCorda,
  avancarSemanaDeCorrida,
  inicioDaSemana,
  iso,
  type Data,
} from "@/lib/calendario";
import { cardio, estagioDeCorda, semanaDeCorrida } from "@/lib/dados";
import { formatarMinutos } from "@/lib/formato";
import type { Esforco, Prefs, TipoCardio } from "@/lib/types";

/* ------------------------------------------------------------- blocos */

/** O que se faz num bloco do timer. */
export type TipoBloco =
  | "aquecimento"
  | "corrida"
  | "caminhada"
  | "corda"
  | "descanso"
  | "soltura";

export interface BlocoCardio {
  /** Posição no plano (0…n−1). */
  indice: number;
  tipo: TipoBloco;
  /** "Aquecimento", "Corrida", "Caminhada", "Corda", "Descanso", "Soltura". */
  rotulo: string;
  /** O que a voz fala na troca (SPEC §3.3): "corrida", "caminhada", "corda"… */
  voz: string;
  segundos: number;
  /**
   * A que repetição do plano este bloco pertence ("bloco 3 de 8"); os blocos
   * de aquecimento e soltura ficam de fora (`null`).
   */
  serie: number | null;
  /** Conta como trabalho cumprido no `feito` de `cardio_sessions`. */
  trabalho: boolean;
}

const ROTULO: Record<TipoBloco, string> = {
  aquecimento: "Aquecimento",
  corrida: "Corrida",
  caminhada: "Caminhada",
  corda: "Corda",
  descanso: "Descanso",
  soltura: "Soltura",
};

/** O que a voz do celular fala ao entrar no bloco (pt-BR, SPEC §3.3). */
const VOZ: Record<TipoBloco, string> = {
  aquecimento: "caminhada",
  corrida: "corrida",
  caminhada: "caminhada",
  corda: "corda",
  descanso: "descanso",
  soltura: "caminhada",
};

function bloco(
  tipo: TipoBloco,
  minutosOuSegundos: { min?: number; s?: number },
  serie: number | null,
  trabalho: boolean,
): Omit<BlocoCardio, "indice"> {
  const segundos =
    minutosOuSegundos.s ?? Math.round((minutosOuSegundos.min ?? 0) * 60);
  return { tipo, rotulo: ROTULO[tipo], voz: VOZ[tipo], segundos, serie, trabalho };
}

function numerar(blocos: Omit<BlocoCardio, "indice">[]): BlocoCardio[] {
  return blocos
    .filter((b) => b.segundos > 0)
    .map((b, indice) => ({ ...b, indice }));
}

/* -------------------------------------------------------------- plano */

export interface PlanoCardio {
  tipo: TipoCardio;
  /** Semana do plano (corrida 1–12, corda 1–12); `null` sem plano. */
  semana: number | null;
  /** "Corrida · semana 1" */
  titulo: string;
  /** "8 × (1 min corrida / 2 min caminhada)" */
  descricao: string | null;
  blocos: BlocoCardio[];
  /** Soma dos blocos, em segundos. */
  totalS: number;
  /** Quantas repetições de trabalho o plano tem (os "8 ×"). */
  repeticoes: number;
  /** A duração que o plano anuncia (`cardio.json` `sessao_min`). */
  sessaoMin: number | null;
  paceAlvo: string | null;
  kmTotal: number | null;
  saltosAprox: number | null;
  /** Texto de apoio, sempre vindo do JSON. */
  notas: string[];
}

export function totalDeSegundos(blocos: readonly BlocoCardio[]): number {
  return blocos.reduce((soma, b) => soma + b.segundos, 0);
}

/** Os blocos da sessão de corrida da semana N (SPEC §3.3). */
export function planoDeCorrida(semana: number): PlanoCardio {
  const s = semanaDeCorrida(semana);
  const blocos = numerar([
    bloco("aquecimento", { min: s.aquecimento_min }, null, false),
    ...s.blocos.flatMap((b, i) => [
      bloco("corrida", { min: b.corrida_min }, i + 1, true),
      bloco("caminhada", { min: b.caminhada_min }, i + 1, false),
    ]),
    bloco("soltura", { min: s.soltura_min }, null, false),
  ]);

  return {
    tipo: "corrida",
    semana: s.semana,
    titulo: `Corrida · semana ${s.semana}`,
    descricao: s.descricao,
    blocos,
    totalS: totalDeSegundos(blocos),
    repeticoes: s.blocos.length,
    sessaoMin: s.sessao_min,
    paceAlvo: s.pace_alvo,
    kmTotal: s.km_total,
    saltosAprox: null,
    notas: [...cardio.corrida.regras],
  };
}

/** Os blocos da sessão de corda do estágio que cobre a semana N. */
export function planoDeCorda(semana: number): PlanoCardio {
  const e = estagioDeCorda(semana);
  const passos: Omit<BlocoCardio, "indice">[] = [];
  for (let i = 1; i <= e.blocos; i++) {
    passos.push(bloco("corda", { s: e.bloco_s }, i, true));
    if (i < e.blocos) passos.push(bloco("descanso", { s: e.descanso_s }, i, false));
  }
  const blocos = numerar(passos);

  return {
    tipo: "corda",
    semana,
    titulo: `Corda · semana ${semana}`,
    descricao: `${e.blocos} × ${e.bloco_s} s de corda (${e.descanso_s} s de descanso)`,
    blocos,
    totalS: totalDeSegundos(blocos),
    repeticoes: e.blocos,
    sessaoMin: e.sessao_min,
    paceAlvo: null,
    kmTotal: null,
    saltosAprox: e.saltos_aprox,
    notas: [...cardio.corda.ajustes],
  };
}

/**
 * O plano da sessão. Caminhada leve e "outro" não têm blocos (SPEC §3.3: "só
 * duração e nota") — devolvem um plano vazio, que a tela mostra como
 * cronômetro simples.
 */
export function planoDeCardio(tipo: TipoCardio, semana: number): PlanoCardio {
  if (tipo === "corrida") return planoDeCorrida(semana);
  if (tipo === "corda") return planoDeCorda(semana);
  return {
    tipo,
    semana: null,
    titulo: tipo === "caminhada" ? "Caminhada leve" : "Outro cardio",
    descricao: null,
    blocos: [],
    totalS: 0,
    repeticoes: 0,
    sessaoMin: null,
    paceAlvo: null,
    kmTotal: null,
    saltosAprox: null,
    notas: [],
  };
}

/** "Corrida · semana 1 · 8 × (1 min corrida / 2 min caminhada) · 34 min". */
export function textoDoPlano(plano: PlanoCardio): string {
  const partes = [plano.titulo];
  if (plano.descricao) partes.push(plano.descricao);
  if (plano.totalS > 0) partes.push(formatarMinutos(plano.totalS / 60));
  else if (plano.sessaoMin !== null) partes.push(formatarMinutos(plano.sessaoMin));
  return partes.join(" · ");
}

/** Os quatro tipos que a rota `/cardio/[id]` aceita. */
export const TIPOS_DE_CARDIO: readonly TipoCardio[] = [
  "corrida",
  "corda",
  "caminhada",
  "outro",
];

export function ehTipoDeCardio(valor: string): valor is TipoCardio {
  return (TIPOS_DE_CARDIO as readonly string[]).includes(valor);
}

/* ------------------------------------------------------------- relógio */

/**
 * O relógio do timer como dado puro. Vive no IndexedDB (SPEC §8: recarregar a
 * página não pode zerar a sessão), então nada aqui guarda `Date.now()`
 * implicitamente: o agora entra por parâmetro.
 */
export interface EstadoTimer {
  /** Bloco atual (índice em `plano.blocos`). */
  indice: number;
  /** Segundos já contados NO BLOCO atual, congelados na última pausa. */
  acumuladoS: number;
  /** `Date.now()` do último "retomar"; `null` = pausado. */
  desdeMs: number | null;
  /** Índices dos blocos que foram cumpridos até o fim (pular não conta). */
  cumpridos: number[];
  /** Segundos somados dos blocos que já saíram (cumpridos ou pulados). */
  anterioresS: number;
  terminado: boolean;
}

export function timerInicial(rodando = true, agoraMs = Date.now()): EstadoTimer {
  return {
    indice: 0,
    acumuladoS: 0,
    desdeMs: rodando ? agoraMs : null,
    cumpridos: [],
    anterioresS: 0,
    terminado: false,
  };
}

/** Segundos decorridos no bloco atual. */
export function decorridoNoBloco(e: EstadoTimer, agoraMs: number): number {
  if (e.desdeMs === null) return e.acumuladoS;
  return e.acumuladoS + Math.max(0, (agoraMs - e.desdeMs) / 1000);
}

/** Segundos decorridos na sessão inteira. */
export function decorridoTotal(e: EstadoTimer, agoraMs: number): number {
  return e.anterioresS + decorridoNoBloco(e, agoraMs);
}

function duracao(blocos: readonly BlocoCardio[], i: number): number {
  return blocos[i]?.segundos ?? 0;
}

/**
 * Passa o tempo: troca de bloco quantas vezes couber no que já decorreu.
 * Chamada a cada segundo pela tela e sempre que a sessão volta do IndexedDB
 * (uma recarga pode ter deixado vários blocos para trás).
 */
export function avancar(
  e: EstadoTimer,
  blocos: readonly BlocoCardio[],
  agoraMs: number,
): EstadoTimer {
  if (e.terminado || blocos.length === 0) return e;
  let atual: EstadoTimer = e;
  let volta = 0;

  for (;;) {
    const decorrido = decorridoNoBloco(atual, agoraMs);
    const alvo = duracao(blocos, atual.indice);
    if (decorrido < alvo) return atual;

    const sobra = decorrido - alvo;
    const proximo = atual.indice + 1;
    const cumpridos = atual.cumpridos.includes(atual.indice)
      ? atual.cumpridos
      : [...atual.cumpridos, atual.indice];

    if (proximo >= blocos.length) {
      return {
        indice: atual.indice,
        acumuladoS: alvo,
        desdeMs: null,
        cumpridos,
        anterioresS: atual.anterioresS,
        terminado: true,
      };
    }

    /*
     * Rodando, a sobra entra no relógio (`desdeMs` recuado); pausado, ela entra
     * no acumulado. Somar nos dois contaria o mesmo tempo duas vezes.
     */
    atual = {
      indice: proximo,
      acumuladoS: atual.desdeMs === null ? sobra : 0,
      desdeMs: atual.desdeMs === null ? null : agoraMs - sobra * 1000,
      cumpridos,
      anterioresS: atual.anterioresS + alvo,
      terminado: false,
    };

    // trava de segurança: um plano tem dezenas de blocos, não milhares
    volta += 1;
    if (volta > blocos.length + 1) return atual;
  }
}

/** "Pular bloco": vai para o próximo SEM contar o atual como cumprido. */
export function pularBloco(
  e: EstadoTimer,
  blocos: readonly BlocoCardio[],
  agoraMs: number,
): EstadoTimer {
  if (e.terminado || blocos.length === 0) return e;
  const feito = decorridoNoBloco(e, agoraMs);
  const proximo = e.indice + 1;
  if (proximo >= blocos.length) {
    return { ...e, acumuladoS: feito, desdeMs: null, terminado: true };
  }
  return {
    indice: proximo,
    acumuladoS: 0,
    desdeMs: e.desdeMs === null ? null : agoraMs,
    cumpridos: e.cumpridos,
    anterioresS: e.anterioresS + feito,
    terminado: false,
  };
}

export function pausar(e: EstadoTimer, agoraMs: number): EstadoTimer {
  if (e.desdeMs === null) return e;
  return { ...e, acumuladoS: decorridoNoBloco(e, agoraMs), desdeMs: null };
}

export function retomar(e: EstadoTimer, agoraMs: number): EstadoTimer {
  if (e.desdeMs !== null || e.terminado) return e;
  return { ...e, desdeMs: agoraMs };
}

/** Segundos que faltam para o fim do plano inteiro. */
export function restanteTotalS(
  e: EstadoTimer,
  blocos: readonly BlocoCardio[],
  agoraMs: number,
): number {
  const total = totalDeSegundos(blocos);
  return Math.max(0, Math.round(total - decorridoTotal(e, agoraMs)));
}

/** Segundos que faltam no bloco atual. */
export function restanteDoBlocoS(
  e: EstadoTimer,
  blocos: readonly BlocoCardio[],
  agoraMs: number,
): number {
  return Math.max(0, Math.round(duracao(blocos, e.indice) - decorridoNoBloco(e, agoraMs)));
}

/** Quantos blocos de trabalho (corrida / corda) foram cumpridos até o fim. */
export function trabalhoCumprido(
  e: EstadoTimer,
  blocos: readonly BlocoCardio[],
): number {
  return e.cumpridos.filter((i) => blocos[i]?.trabalho).length;
}

/* ------------------------------------------------- o que vai para o banco */

/** `cardio_sessions.planejado`: os blocos que o plano mandava fazer. */
export function planejadoDaSessao(plano: PlanoCardio): Record<string, unknown> {
  return {
    tipo: plano.tipo,
    semana: plano.semana,
    descricao: plano.descricao,
    total_s: plano.totalS,
    repeticoes: plano.repeticoes,
    blocos: plano.blocos.map((b) => ({ tipo: b.tipo, s: b.segundos })),
  };
}

/** `cardio_sessions.feito`: os blocos realmente cumpridos (SPEC §3.3). */
export function feitoDaSessao(
  plano: PlanoCardio,
  e: EstadoTimer,
  agoraMs: number,
): Record<string, unknown> {
  const cumpridos = [...e.cumpridos].sort((a, b) => a - b);
  return {
    blocos_cumpridos: cumpridos.length,
    blocos_planejados: plano.blocos.length,
    repeticoes_cumpridas: trabalhoCumprido(e, plano.blocos),
    repeticoes_planejadas: plano.repeticoes,
    terminou: e.terminado,
    blocos: cumpridos.map((i) => ({
      tipo: plano.blocos[i]?.tipo ?? null,
      s: plano.blocos[i]?.segundos ?? 0,
    })),
    decorrido_s: Math.round(decorridoTotal(e, agoraMs)),
  };
}

/** Minutos com uma casa, como a coluna `duracao_min` numeric(5,1). */
export function duracaoEmMinutos(segundos: number): number {
  return Math.round((segundos / 60) * 10) / 10;
}

/** Saltos estimados: a proporção do plano que foi cumprida (SPEC §3.3). */
export function saltosEstimados(
  plano: PlanoCardio,
  repeticoesCumpridas: number,
): number | null {
  if (plano.saltosAprox === null || plano.repeticoes === 0) return null;
  const razao = Math.min(1, repeticoesCumpridas / plano.repeticoes);
  return Math.round(plano.saltosAprox * razao);
}

/* ------------------------------------------------------ teste da fala */

export interface NivelDeEsforco {
  valor: Esforco;
  /** "fácil", "moderado", "forte" — o texto do JSON. */
  nivel: string;
  consegue: string;
  onde: string;
}

const VALOR_DO_NIVEL: Record<string, Esforco> = {
  facil: "facil",
  moderado: "moderado",
  forte: "forte",
};

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Os três níveis do teste da fala, com os textos de `data/cardio.json`. */
export function niveisDeEsforco(): NivelDeEsforco[] {
  return cardio.esforco.teste_da_fala.flatMap((n) => {
    const valor = VALOR_DO_NIVEL[semAcento(n.nivel)];
    if (!valor) return [];
    return [{ valor, nivel: n.nivel, consegue: n.consegue, onde: n.onde }];
  });
}

/* ------------------------------------------------- semanas dos planos */

export type PlanoSemanal = "corrida" | "corda" | "fixa";

/** A chave em `profiles` de cada plano (SPEC §5.5). */
export const CAMPO_DA_SEMANA: Record<PlanoSemanal, string> = {
  corrida: "semana_corrida",
  corda: "semana_corda",
  fixa: "semana_fixa",
};

/** A marca em `prefs` que diz que a semana civil já avançou este plano. */
export function chaveDoAvanco(plano: PlanoSemanal): string {
  return `avanco_${plano}_em`;
}

export interface AvancoDeSemana {
  plano: PlanoSemanal;
  /** O campo de `profiles` e o valor novo. */
  campo: string;
  semana: number;
  /** `prefs` já com a marca da semana civil aplicada. */
  prefs: Prefs;
}

function avancarDoPlano(plano: PlanoSemanal, semana: number, sessoes: number): number {
  if (plano === "corrida") return avancarSemanaDeCorrida(semana, sessoes);
  if (plano === "corda") return avancarSemanaDeCorda(semana, sessoes);
  return avancarSemanaDeBarraFixa(semana, sessoes);
}

/**
 * SPEC §5.5: a semana do plano avança quando as 2 sessões da **semana civil**
 * foram concluídas; com 0 ou 1 ela repete. A marca em `prefs` (a segunda-feira
 * da semana que já avançou) faz a regra ser idempotente: a tela pode chamar
 * isto a cada abertura sem empurrar o plano duas vezes.
 *
 * Devolve `null` quando não há nada a mudar.
 */
export function avancoDeSemana(entrada: {
  plano: PlanoSemanal;
  semanaAtual: number;
  sessoesDaSemanaCivil: number;
  hoje: Data;
  prefs?: Prefs;
}): AvancoDeSemana | null {
  const prefs = entrada.prefs ?? {};
  const segunda = iso(inicioDaSemana(entrada.hoje));
  const chave = chaveDoAvanco(entrada.plano);
  if (prefs[chave] === segunda) return null;

  const nova = avancarDoPlano(
    entrada.plano,
    entrada.semanaAtual,
    entrada.sessoesDaSemanaCivil,
  );
  if (nova === entrada.semanaAtual) return null;

  return {
    plano: entrada.plano,
    campo: CAMPO_DA_SEMANA[entrada.plano],
    semana: nova,
    prefs: { ...prefs, [chave]: segunda },
  };
}

/** Quantas sessões de cardio de um tipo foram concluídas na semana civil. */
export function sessoesDaSemanaCivil(
  linhas: readonly { data: string; tipo: string; concluida: boolean }[],
  tipo: TipoCardio,
  hoje: Data,
): number {
  const de = iso(inicioDaSemana(hoje));
  const ate = iso(new Date(inicioDaSemana(hoje).getTime() + 6 * 86_400_000));
  return linhas.filter(
    (l) => l.concluida && l.tipo === tipo && l.data >= de && l.data <= ate,
  ).length;
}
