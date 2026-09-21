import { describe, expect, it } from "vitest";
import {
  formatarCm,
  formatarData,
  formatarDataCompleta,
  formatarDataLonga,
  formatarDescanso,
  formatarDiaCurto,
  formatarDiaEData,
  formatarDuracao,
  formatarKg,
  formatarKm,
  formatarMinutos,
  formatarNumero,
  formatarPercentual,
  lerNumero,
  rotuloDaCarga,
} from "@/lib/formato";

describe("números com vírgula", () => {
  it("formata kg", () => {
    expect(formatarKg(7.5)).toBe("7,5 kg");
    expect(formatarKg(24)).toBe("24 kg");
    expect(formatarKg(107.5)).toBe("107,5 kg");
  });
  it("formata números soltos", () => {
    expect(formatarNumero(0)).toBe("0");
    expect(formatarNumero(1.25)).toBe("1,25");
    expect(formatarNumero(3.456, 1)).toBe("3,5");
  });
  it("formata cm e km", () => {
    expect(formatarCm(96.5)).toBe("96,5 cm");
    expect(formatarKm(3.62)).toBe("3,62 km");
  });
});

describe("datas", () => {
  it("dd/MM", () => {
    expect(formatarData("2026-09-14")).toBe("14/09");
    expect(formatarDataCompleta("2026-09-14")).toBe("14/09/2026");
  });
  it("por extenso em pt-BR", () => {
    expect(formatarDataLonga("2026-09-14")).toBe(
      "segunda-feira, 14 de setembro de 2026",
    );
  });
});

describe("durações", () => {
  it("mm:ss", () => {
    expect(formatarDuracao(150)).toBe("2:30");
    expect(formatarDuracao(45)).toBe("0:45");
    expect(formatarDuracao(0)).toBe("0:00");
  });
  it("h:mm:ss quando passa de uma hora", () => {
    expect(formatarDuracao(3720)).toBe("1:02:00");
  });
  it("minutos em texto", () => {
    expect(formatarMinutos(44)).toBe("44 min");
    expect(formatarMinutos(95)).toBe("1 h 35");
    expect(formatarMinutos(120)).toBe("2 h");
  });
});

describe("leitura do que o usuário digita", () => {
  it("aceita vírgula e ponto", () => {
    expect(lerNumero("24,5")).toBe(24.5);
    expect(lerNumero("24.5")).toBe(24.5);
    expect(lerNumero(" 8 ")).toBe(8);
  });
  it("devolve null para vazio ou lixo", () => {
    expect(lerNumero("")).toBeNull();
    expect(lerNumero("abc")).toBeNull();
  });
});

describe("rótulo da convenção de carga", () => {
  it("usa o implemento", () => {
    expect(rotuloDaCarga("halteres")).toBe("por halter");
    expect(rotuloDaCarga("polia")).toBe("no pino");
    expect(rotuloDaCarga("barra_macica")).toBe("na barra");
    expect(rotuloDaCarga("barra_fixa")).toBe("na mochila");
    // SPEC §4: no implemento `anilha` a carga é a anilha segurada — nunca "na barra"
    expect(rotuloDaCarga("anilha")).toBe("na anilha");
    expect(rotuloDaCarga("peso_corporal")).toBe("peso do corpo");
  });
});

describe("formatarDescanso", () => {
  it("segundos, minutos redondos e minutos com resto", () => {
    expect(formatarDescanso(90)).toBe("90 s");
    expect(formatarDescanso(45)).toBe("45 s");
    expect(formatarDescanso(120)).toBe("2 min");
    expect(formatarDescanso(150)).toBe("2 min 30 s");
  });
});

describe("formatarDiaEData (SPEC §13.3)", () => {
  it("é o dia da semana sem -feira, com a data dd/MM", () => {
    expect(formatarDiaEData("2026-09-15")).toBe("terça, 15/09");
    expect(formatarDiaEData("2026-09-14")).toBe("segunda, 14/09");
    expect(formatarDiaEData("2026-09-19")).toBe("sábado, 19/09");
    expect(formatarDiaEData("2026-09-20")).toBe("domingo, 20/09");
  });
});

describe("formatarDiaCurto (SPEC §22.1)", () => {
  it("é o rótulo de três letras da semana, com o acento de sábado", () => {
    expect(formatarDiaCurto("2026-09-14")).toBe("seg");
    expect(formatarDiaCurto("2026-09-15")).toBe("ter");
    expect(formatarDiaCurto("2026-09-16")).toBe("qua");
    expect(formatarDiaCurto("2026-09-17")).toBe("qui");
    expect(formatarDiaCurto("2026-09-18")).toBe("sex");
    expect(formatarDiaCurto("2026-09-19")).toBe("sáb");
    expect(formatarDiaCurto("2026-09-20")).toBe("dom");
  });

  /* a faixa da semana (lib/semana.ts) e o calendário (lib/hoje.ts) escrevem o
     mesmo rótulo: era "sab" de um lado e "sáb" do outro */
  it("bate com o `diaCurto` do calendário em toda a semana", async () => {
    const { diaCurto } = await import("@/lib/hoje");
    for (const dia of [14, 15, 16, 17, 18, 19, 20]) {
      const data = `2026-09-${dia}`;
      expect(formatarDiaCurto(data)).toBe(diaCurto(data));
    }
  });

  it("aceita Date além da data pura", () => {
    expect(formatarDiaCurto(new Date(2026, 8, 19, 10, 0, 0))).toBe("sáb");
  });
});

/* SPEC §22.6 item 8: um formato só de porcentagem no app */
describe("porcentagem", () => {
  it("cola o símbolo no número", () => {
    expect(formatarPercentual(78)).toBe("78%");
    expect(formatarPercentual(0)).toBe("0%");
    expect(formatarPercentual(100)).toBe("100%");
  });

  it("arredonda para inteiro por padrão e aceita casas", () => {
    expect(formatarPercentual(78.4)).toBe("78%");
    expect(formatarPercentual(78.45, 1)).toBe("78,5%");
  });
});
