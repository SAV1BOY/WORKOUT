/**
 * "Adicionar ao meu calendário" (SPEC §23.12, aceite §23.14 item 4): a
 * estrutura do .ics que o botão baixa — RFC 5545 medida linha a linha.
 */
import { describe, expect, it } from "vitest";
import { BYDAY, dobrarLinha, duracaoIcs, escaparTexto, gerarIcs } from "@/lib/ics";
import { eventosDoCalendario } from "@/lib/lembretes-regra";

const perfil = {
  fase_atual: "fase1" as const,
  ultimo_treino: null,
  fase_desde: "2026-09-01",
  data_inicio: "2026-09-01",
  semana_corrida: 3,
  semana_corda: 1,
  semana_fixa: 1,
  prefs: {
    lembretes: { treino: { ligado: true, hora: "07:00" }, corrida: { ligado: false, hora: "18:30" } },
  },
};
const AGORA = new Date("2026-09-21T12:00:00Z"); // segunda, 09:00 em São Paulo
const ID = "0b6f1c2e-1111-4222-8333-944445555666";

/** Desfaz a dobra (RFC 5545 §3.1): CRLF seguido de espaço some. */
function desdobrar(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n").filter((l) => l !== "");
}

function eventos(ics: string): string[][] {
  const linhas = desdobrar(ics);
  const saida: string[][] = [];
  let atual: string[] | null = null;
  for (const l of linhas) {
    if (l === "BEGIN:VEVENT") atual = [];
    else if (l === "END:VEVENT" && atual) {
      saida.push(atual);
      atual = null;
    } else if (atual) atual.push(l);
  }
  return saida;
}

describe("gerarIcs", () => {
  const ics = gerarIcs(eventosDoCalendario(perfil, AGORA), ID, AGORA);

  it("toda linha termina em CRLF e nenhuma passa de 75 octetos", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    // nenhum LF solto (sem o CR antes)
    expect(/(^|[^\r])\n/.test(ics)).toBe(false);
    for (const linha of ics.split("\r\n")) {
      expect(new TextEncoder().encode(linha).length, linha).toBeLessThanOrEqual(75);
    }
  });

  it("abre e fecha o calendário, com o fuso de São Paulo declarado", () => {
    const linhas = desdobrar(ics);
    expect(linhas[0]).toBe("BEGIN:VCALENDAR");
    expect(linhas.at(-1)).toBe("END:VCALENDAR");
    expect(linhas).toContain("VERSION:2.0");
    expect(linhas).toContain("PRODID:-//Treino do Terraço//Lembretes//PT-BR");
    expect(linhas).toContain("BEGIN:VTIMEZONE");
    expect(linhas).toContain("TZID:America/Sao_Paulo");
    expect(linhas).toContain("TZOFFSETTO:-0300");
  });

  it("um evento semanal por dia de treino do perfil, com BYDAY certo e a hora de cada tipo", () => {
    const evs = eventos(ics);
    const regras = evs.map((e) => e.find((l) => l.startsWith("RRULE:")));
    expect(regras).toEqual([
      "RRULE:FREQ=WEEKLY;BYDAY=MO",
      "RRULE:FREQ=WEEKLY;BYDAY=TU",
      "RRULE:FREQ=WEEKLY;BYDAY=WE",
      "RRULE:FREQ=WEEKLY;BYDAY=FR",
      "RRULE:FREQ=WEEKLY;BYDAY=SA",
    ]);
    const inicios = evs.map((e) => e.find((l) => l.startsWith("DTSTART")));
    expect(inicios).toEqual([
      "DTSTART;TZID=America/Sao_Paulo:20260921T070000",
      "DTSTART;TZID=America/Sao_Paulo:20260922T183000",
      "DTSTART;TZID=America/Sao_Paulo:20260923T070000",
      "DTSTART;TZID=America/Sao_Paulo:20260925T070000",
      "DTSTART;TZID=America/Sao_Paulo:20260926T183000",
    ]);
    for (const e of evs) {
      expect(e).toContain("BEGIN:VALARM");
      expect(e).toContain("TRIGGER:PT0M");
      expect(e.find((l) => l.startsWith("DURATION:"))).toMatch(/^DURATION:PT(\d+H)?(\d+M)?$/);
      expect(e.find((l) => l.startsWith("DTSTAMP:"))).toBe("DTSTAMP:20260921T120000Z");
    }
  });

  it("os dias escolhidos no perfil (§17) mudam o BYDAY", () => {
    const outro = gerarIcs(
      eventosDoCalendario({ ...perfil, prefs: { ...perfil.prefs, dias_de_treino: ["ter", "qui", "sab"] } }, AGORA),
      ID,
      AGORA,
    );
    expect(eventos(outro).map((e) => e.find((l) => l.startsWith("RRULE:"))?.split("BYDAY=")[1])).toEqual([
      "TU",
      "TH",
      "SA",
    ]);
  });

  it("evento que repete toda semana não congela a semana do plano na descrição (auditoria L35)", () => {
    // o plano avança; o evento recorrente não pode ficar falso na semana seguinte
    const conjuntos: (string[] | undefined)[] = [undefined, ["ter", "qui", "sab"], ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]];
    for (const semana_corrida of [1, 3, 5, 12]) {
      for (const dias_de_treino of conjuntos) {
        const texto = gerarIcs(
          eventosDoCalendario({ ...perfil, semana_corrida, prefs: { ...perfil.prefs, dias_de_treino } }, AGORA),
          ID,
          AGORA,
        );
        const lidos = eventos(texto);
        expect(lidos.length).toBeGreaterThan(0);
        for (const e of lidos) {
          expect(e.some((l) => l.startsWith("RRULE:FREQ=WEEKLY"))).toBe(true);
          const descricao = e.find((l) => l.startsWith("DESCRIPTION:")) ?? "";
          expect(descricao).toMatch(/^DESCRIPTION:Treino do Terraço: abra o app para ver /);
          expect(descricao).not.toMatch(/semana \d/i);
          expect(descricao).not.toMatch(/\d+ ?×/);
        }
      }
    }
    const cardio = eventos(ics).find((e) => e.some((l) => l.startsWith("UID:corrida-")));
    expect(cardio?.find((l) => l.startsWith("DESCRIPTION:"))).toMatch(
      /^DESCRIPTION:Treino do Terraço: abra o app para ver a corrida da semana \(cerca de \d+ min\)\.$/,
    );
  });

  it("UID estável: baixar de novo substitui em vez de duplicar", () => {
    const depois = gerarIcs(eventosDoCalendario(perfil, new Date("2026-09-22T12:00:00Z")), ID, new Date("2026-09-22T12:00:00Z"));
    const uids = (texto: string) =>
      eventos(texto)
        .map((e) => e.find((l) => l.startsWith("UID:")))
        .sort();
    expect(uids(depois)).toEqual(uids(ics));
    expect(new Set(uids(ics)).size).toBe(5);
    expect(uids(ics)[0]).toMatch(/^UID:(treino|corrida)-[a-z]{2}-0b6f1c2e1111@treino-do-terraco$/);
  });

  it("texto pt-BR em UTF-8 inteiro: acentos sobrevivem à dobra", () => {
    const linhas = desdobrar(ics);
    expect(linhas.some((l) => l.includes("Treino do Terraço"))).toBe(true);
    // decodificar o arquivo como bytes UTF-8 devolve o mesmo texto (nada partido)
    const bytes = new TextEncoder().encode(ics);
    expect(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).toBe(ics);
  });
});

describe("as peças", () => {
  it("dobra a 75 octetos sem partir o 'ç' (2 bytes)", () => {
    const linha = `DESCRIPTION:${"a".repeat(62)}ççççç`; // 12 + 62 = 74 octetos, e o ç não cabe inteiro
    const dobrada = dobrarLinha(linha);
    const [primeira, segunda] = dobrada.split("\r\n");
    expect(new TextEncoder().encode(primeira).length).toBe(74);
    expect(segunda?.startsWith(" ç")).toBe(true);
    expect(dobrada.replace(/\r\n /g, "")).toBe(linha);
    // cada pedaço decodifica sozinho (nenhum caractere cortado ao meio)
    for (const pedaco of dobrada.split("\r\n")) {
      const bytes = new TextEncoder().encode(pedaco);
      expect(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).toBe(pedaco);
      expect(bytes.length).toBeLessThanOrEqual(75);
    }
  });
  it("linha curta fica como está", () => {
    expect(dobrarLinha("VERSION:2.0")).toBe("VERSION:2.0");
  });
  it("escapa vírgula, ponto e vírgula, barra e quebra de linha", () => {
    expect(escaparTexto("a, b; c\\d\ne")).toBe("a\\, b\\; c\\\\d\\ne");
  });
  it("duração: PT44M, PT1H, PT1H10M", () => {
    expect(duracaoIcs(44)).toBe("PT44M");
    expect(duracaoIcs(60)).toBe("PT1H");
    expect(duracaoIcs(70)).toBe("PT1H10M");
  });
  it("os sete dias têm BYDAY", () => {
    expect(Object.values(BYDAY)).toEqual(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
  });
});
