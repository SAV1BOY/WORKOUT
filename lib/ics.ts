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
 */
import type { EventoSemanal } from "@/lib/lembretes-regra";
import { FUSO_DOS_LEMBRETES } from "@/lib/lembretes-regra";
import type { DiaSemana } from "@/lib/schemas";

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

/**
 * O arquivo inteiro. `idDaConta` entra no UID (curto, só para separar contas
 * no mesmo calendário): baixar de novo substitui os eventos em vez de
 * duplicar — o UID é o mesmo por conta, tipo e dia da semana.
 */
export function gerarIcs(eventos: readonly EventoSemanal[], idDaConta: string, agora: Date): string {
  const conta = idDaConta.replace(/[^0-9a-z]/gi, "").slice(0, 12) || "conta";
  const carimbo = dataHoraUtc(agora);
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
  for (const e of eventos) {
    const byday = BYDAY[e.diaSemana];
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${e.tipo}-${byday.toLowerCase()}-${conta}@treino-do-terraco`,
      `DTSTAMP:${carimbo}`,
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
  linhas.push("END:VCALENDAR");
  return `${linhas.map(dobrarLinha).join("\r\n")}\r\n`;
}
