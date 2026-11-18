/**
 * "Adicionar ao meu calendário" (SPEC §23.12): um arquivo iCalendar
 * (RFC 5545) com um evento semanal por dia de treino. Puro: recebe os eventos
 * de `eventosDoCalendario()` (`lib/lembretes-regra.ts`) e devolve o texto.
 *
 * O que a RFC pede e os calendários de celular cobram:
 *  - linhas terminadas em CRLF (§3.1);
 *  - linha com mais de 75 **octetos** dobrada em CRLF + espaço, sem partir
 *    um caractere UTF-8 no meio (os acentos têm 2 bytes);
 *  - `\`, `;`, `,` e quebra de linha escapados no texto (§3.3.11);
 *  - `DTSTART;TZID=…` com o `VTIMEZONE` correspondente no arquivo.
 *
 * E o que saiu do plano (SPEC §23.15): para cada UID possível (tipo × dia da
 * semana) que não está no plano de agora, um `VEVENT` com o mesmo UID e
 * `STATUS:CANCELLED`; todos com o mesmo `SEQUENCE`, maior a cada download.
 */
import type { EventoSemanal } from "@/lib/lembretes-regra";
import { FUSO_DOS_LEMBRETES, relogioDeSaoPaulo } from "@/lib/lembretes-regra";
import type { DiaSemana, TipoDeLembrete } from "@/lib/schemas";

export const NOME_DO_ARQUIVO_ICS = "treino-do-terraco.ics";
export const TIPO_ICS = "text/calendar;charset=utf-8";

/** O BYDAY da RFC 5545 para cada dia da semana do app. */
export const BYDAY: Readonly<Record<DiaSemana, string>> = {
  seg: "MO",
  ter: "TU",
  qua: "WE",
  qui: "TH",
  sex: "FR",
  sab: "SA",
  dom: "SU",
};

const LIMITE_OCTETOS = 75;

/** Escapa um valor TEXT (RFC 5545 §3.3.11). */
export function escaparTexto(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Dobra uma linha em pedaços de até 75 octetos (o primeiro) e 74 + o espaço
 * inicial (os seguintes), sem partir um caractere UTF-8.
 */
export function dobrarLinha(linha: string): string {
  const codificador = new TextEncoder();
  const partes: string[] = [];
  let atual = "";
  let octetos = 0;
  for (const caractere of linha) {
    const tamanho = codificador.encode(caractere).length;
    const limite = partes.length === 0 ? LIMITE_OCTETOS : LIMITE_OCTETOS - 1;
    if (octetos + tamanho > limite) {
      partes.push(atual);
      atual = "";
      octetos = 0;
    }
    atual += caractere;
    octetos += tamanho;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

/** `20260923T070000` (hora local, para usar com TZID). */
function dataHoraLocal(dia: string, hora: string): string {
  return `${dia.replace(/-/g, "")}T${hora.replace(":", "")}00`;
}

/** `20260923T103000Z` (UTC, para o DTSTAMP). */
function dataHoraUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${doisDigitos(d.getUTCMonth() + 1)}${doisDigitos(d.getUTCDate())}` +
    `T${doisDigitos(d.getUTCHours())}${doisDigitos(d.getUTCMinutes())}${doisDigitos(d.getUTCSeconds())}Z`
  );
}

/** `PT44M`, `PT1H10M`. */
export function duracaoIcs(minutos: number): string {
  const total = Math.max(1, Math.round(minutos));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `PT${h > 0 ? `${h}H` : ""}${m > 0 ? `${m}M` : ""}`;
}

/**
 * O fuso de São Paulo: UTC−3 o ano todo (o horário de verão acabou em 2019).
 * Um `STANDARD` só basta e todo calendário entende.
 */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${FUSO_DOS_LEMBRETES}`,
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:-0300",
  "TZOFFSETTO:-0300",
  "TZNAME:-03",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Os tipos e os dias: os 14 UIDs possíveis de uma conta. */
const TIPOS_DO_ICS: readonly TipoDeLembrete[] = ["treino", "corrida"];
const DIAS_DO_ICS: readonly DiaSemana[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
/** `getUTCDay()` (0 = domingo) → o dia do app. */
const DIA_DO_JS: readonly DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

const RESUMO_DO_CANCELADO: Readonly<Record<TipoDeLembrete, string>> = {
  treino: "Treino de força (saiu do plano)",
  corrida: "Corrida (saiu do plano)",
};

/** O começo da contagem do `SEQUENCE`: segundos desde 01/01/2026 00:00 UTC. */
const INICIO_DA_SEQUENCIA_MS = Date.UTC(2026, 0, 1);

/**
 * O `SEQUENCE` de um download: segundos desde 01/01/2026 — sempre maior que o
 * do arquivo baixado antes, então o calendário que atualiza pelo UID aceita a
 * versão nova (a ativa e a cancelada).
 */
export function sequenciaIcs(agora: Date): number {
  return Math.max(0, Math.floor((agora.getTime() - INICIO_DA_SEQUENCIA_MS) / 1000));
}

/** O próximo `dia` da semana a partir de `hoje` (inclusive), em ISO. */
function proximoDia(hoje: string, dia: DiaSemana): string {
  const [a, m, d] = hoje.split("-").map(Number);
  for (let k = 0; k < 7; k += 1) {
    const data = new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, (d ?? 1) + k));
    if (DIA_DO_JS[data.getUTCDay()] === dia) return data.toISOString().slice(0, 10);
  }
  return hoje;
}

function uidDoEvento(tipo: TipoDeLembrete, dia: DiaSemana, conta: string): string {
  return `UID:${tipo}-${BYDAY[dia].toLowerCase()}-${conta}@treino-do-terraco`;
}

/**
 * O arquivo inteiro. `idDaConta` entra no UID (curto, só para separar contas
 * no mesmo calendário): baixar de novo substitui os eventos em vez de
 * duplicar — o UID é o mesmo por conta, tipo e dia da semana. O que não está
 * em `eventos` vai cancelado (mesmo UID, `STATUS:CANCELLED`); `horas` é a hora
 * de cada tipo, para o `DTSTART` do cancelado (padrão 07:00).
 */
export function gerarIcs(
  eventos: readonly EventoSemanal[],
  idDaConta: string,
  agora: Date,
  horas: Partial<Record<TipoDeLembrete, string>> = {},
): string {
  const conta = idDaConta.replace(/[^0-9a-z]/gi, "").slice(0, 12) || "conta";
  const carimbo = dataHoraUtc(agora);
  const sequencia = sequenciaIcs(agora);
  const hoje = relogioDeSaoPaulo(agora).dia;
  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Treino do Terraço//Lembretes//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escaparTexto("Treino do Terraço")}`,
    `X-WR-TIMEZONE:${FUSO_DOS_LEMBRETES}`,
    ...VTIMEZONE,
  ];
  const ativos = new Set<string>();
  for (const e of eventos) {
    const byday = BYDAY[e.diaSemana];
    const uid = uidDoEvento(e.tipo, e.diaSemana, conta);
    ativos.add(uid);
    linhas.push(
      "BEGIN:VEVENT",
      uid,
      `DTSTAMP:${carimbo}`,
      `SEQUENCE:${sequencia}`,
      "STATUS:CONFIRMED",
      `DTSTART;TZID=${FUSO_DOS_LEMBRETES}:${dataHoraLocal(e.inicio, e.hora)}`,
      `DURATION:${duracaoIcs(e.duracaoMin)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${byday}`,
      `SUMMARY:${escaparTexto(e.resumo)}`,
      `DESCRIPTION:${escaparTexto(e.descricao)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escaparTexto(e.resumo)}`,
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  // o que saiu do plano: o mesmo UID, cancelado (sem alarme)
  for (const tipo of TIPOS_DO_ICS) {
    for (const dia of DIAS_DO_ICS) {
      const uid = uidDoEvento(tipo, dia, conta);
      if (ativos.has(uid)) continue;
      linhas.push(
        "BEGIN:VEVENT",
        uid,
        `DTSTAMP:${carimbo}`,
        `SEQUENCE:${sequencia}`,
        "STATUS:CANCELLED",
        `DTSTART;TZID=${FUSO_DOS_LEMBRETES}:${dataHoraLocal(proximoDia(hoje, dia), horas[tipo] ?? "07:00")}`,
        "DURATION:PT1M",
        `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[dia]}`,
        `SUMMARY:${escaparTexto(RESUMO_DO_CANCELADO[tipo])}`,
        "END:VEVENT",
      );
    }
  }
  linhas.push("END:VCALENDAR");
  return `${linhas.map(dobrarLinha).join("\r\n")}\r\n`;
}

/**
 * A assinatura do que o .ics faz tocar (SPEC §23.16): os eventos ativos como
 * `tipo·dia·hora`, em ordem fixa. Muda quando muda a hora ou os dias; não muda
 * com a duração da semana (A e B alternam) nem com o interruptor — o .ics não
 * depende dele (§23.12). A tela guarda a do último download neste aparelho e
 * avisa quando a de agora é outra: o arquivo importado não se atualiza sozinho.
 */
export function assinaturaDoIcs(eventos: readonly EventoSemanal[]): string {
  return eventos
    .map((e) => `${e.tipo}·${e.diaSemana}·${e.hora}`)
    .sort()
    .join(",");
}

/* ------------------------------ as pontas com localStorage (nunca lançam) */

/** A chave da assinatura do último .ics baixado neste aparelho, por conta. */
export function chaveDoIcsBaixado(idDaConta: string): string {
  return `treino-ics-baixado:${idDaConta}`;
}

/** A assinatura do último .ics baixado neste aparelho; `null` se nunca (ou sem storage). */
export function lerIcsBaixado(idDaConta: string): string | null {
  try {
    return window.localStorage.getItem(chaveDoIcsBaixado(idDaConta));
  } catch {
    return null;
  }
}

export function guardarIcsBaixado(idDaConta: string, assinatura: string): void {
  try {
    window.localStorage.setItem(chaveDoIcsBaixado(idDaConta), assinatura);
  } catch {
    /* sem storage, a tela só não sabe avisar que o arquivo ficou velho */
  }
}
