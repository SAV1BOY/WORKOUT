import { describe, expect, it } from "vitest";
import {
  formatarCm,
  formatarData,
  formatarDataCompleta,
  formatarDataLonga,
  formatarDuracao,
  formatarKg,
  formatarKm,
  formatarMinutos,
  formatarNumero,
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
  });
});
