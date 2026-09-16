import { describe, expect, it } from "vitest";
import {
  comMetaSemanal,
  diasDesdeAUltimaSessao,
  feitosNaSemana,
  metaSemanal,
  metaSemanalPadrao,
  progressoDaMeta,
  sequenciaDeDias,
  sequenciaDeSemanas,
} from "@/lib/metas";

import type { StatusSessao } from "@/lib/types";

const forca = (data: string, status: StatusSessao = "concluida") => ({ data, status });
const cardio = (data: string, concluida = true) => ({ data, concluida });

describe("meta semanal (SPEC §13.3)", () => {
  it("a padrão da Fase 1 é 3 de força + 2 de cardio", () => {
    expect(metaSemanalPadrao("fase1")).toBe(5);
  });

  it("a padrão da Fase 2 é 4 de força + 2 de cardio", () => {
    expect(metaSemanalPadrao("fase2")).toBe(6);
  });

  it("prefs.meta_semanal manda quando é inteiro ≥ 1", () => {
    expect(metaSemanal({ meta_semanal: 4 }, "fase1")).toBe(4);
    expect(metaSemanal({ meta_semanal: 1 }, "fase1")).toBe(1);
  });

  it("valor impossível no jsonb cai no padrão da fase", () => {
    expect(metaSemanal({ meta_semanal: 0 }, "fase1")).toBe(5);
    expect(metaSemanal({ meta_semanal: 2.5 }, "fase1")).toBe(5);
    expect(metaSemanal({ meta_semanal: "muitas" }, "fase1")).toBe(5);
    expect(metaSemanal(null, "fase2")).toBe(6);
  });

  it("comMetaSemanal grava e apaga sem perder as outras chaves", () => {
    const prefs = comMetaSemanal({ tema: "escuro" }, 4);
    expect(prefs).toEqual({ tema: "escuro", meta_semanal: 4 });
    expect(comMetaSemanal(prefs, null)).toEqual({ tema: "escuro" });
    expect(comMetaSemanal(prefs, 0)).toEqual({ tema: "escuro" });
  });
});

describe("feitos na semana", () => {
  const semana = { de: "2026-09-14", ate: "2026-09-20" };

  it("conta força concluída e cardio concluído", () => {
    const feitos = feitosNaSemana({
      sessoes: [forca("2026-09-14"), forca("2026-09-16")],
      cardios: [cardio("2026-09-15")],
      ...semana,
    });
    expect(feitos).toBe(3);
  });

  it("não conta sessão aberta, abandonada nem cardio não concluído", () => {
    const feitos = feitosNaSemana({
      sessoes: [forca("2026-09-14", "em_andamento"), forca("2026-09-15", "abandonada")],
      cardios: [cardio("2026-09-16", false)],
      ...semana,
    });
    expect(feitos).toBe(0);
  });

  it("não conta o que está fora da semana civil", () => {
    const feitos = feitosNaSemana({
      sessoes: [forca("2026-09-13"), forca("2026-09-21")],
      ...semana,
    });
    expect(feitos).toBe(0);
  });

  it("o texto da meta é feitos/meta", () => {
    const p = progressoDaMeta({
      sessoes: [forca("2026-09-14"), forca("2026-09-16")],
      meta: 5,
      ...semana,
    });
    expect(p.texto).toBe("2/5");
    expect(p.cumprida).toBe(false);
    expect(progressoDaMeta({ sessoes: [], meta: 0, ...semana }).cumprida).toBe(true);
  });
});

describe("sequência de semanas com a meta cumprida", () => {
  /** Uma semana inteira de 2 sessões a partir da segunda. */
  const duas = (segunda: string) => [forca(segunda), forca(segunda)];

  it("a semana em curso ainda sem a meta não zera as de trás", () => {
    const sessoes = [...duas("2026-09-07"), ...duas("2026-08-31"), forca("2026-09-14")];
    expect(
      sequenciaDeSemanas({ sessoes, hoje: "2026-09-15", meta: 2 }),
    ).toBe(2);
  });

  it("a semana em curso entra assim que bate a meta", () => {
    const sessoes = [...duas("2026-09-14"), ...duas("2026-09-07")];
    expect(sequenciaDeSemanas({ sessoes, hoje: "2026-09-15", meta: 2 })).toBe(2);
  });

  it("uma semana furada corta a sequência", () => {
    const sessoes = [...duas("2026-09-07"), ...duas("2026-08-24")];
    expect(sequenciaDeSemanas({ sessoes, hoje: "2026-09-15", meta: 2 })).toBe(1);
  });

  it("sem nada registrado é zero", () => {
    expect(sequenciaDeSemanas({ hoje: "2026-09-15", meta: 5 })).toBe(0);
  });

  it("cardio conta junto com a força", () => {
    expect(
      sequenciaDeSemanas({
        sessoes: [forca("2026-09-14")],
        cardios: [cardio("2026-09-15")],
        hoje: "2026-09-15",
        meta: 2,
      }),
    ).toBe(1);
  });
});

describe("sequência de dias", () => {
  it("conta dias seguidos com qualquer sessão", () => {
    const n = sequenciaDeDias({
      sessoes: [forca("2026-09-14"), forca("2026-09-16")],
      cardios: [cardio("2026-09-15")],
      hoje: "2026-09-16",
    });
    expect(n).toBe(3);
  });

  it("hoje ainda sem treino não zera a sequência de ontem", () => {
    const n = sequenciaDeDias({
      sessoes: [forca("2026-09-14"), forca("2026-09-15")],
      hoje: "2026-09-16",
    });
    expect(n).toBe(2);
  });

  it("um buraco no meio corta", () => {
    const n = sequenciaDeDias({
      sessoes: [forca("2026-09-14"), forca("2026-09-16")],
      hoje: "2026-09-16",
    });
    expect(n).toBe(1);
  });

  it("sem nada é zero", () => {
    expect(sequenciaDeDias({ hoje: "2026-09-16" })).toBe(0);
  });
});

describe("dias desde a última sessão", () => {
  it("conta do registro mais recente", () => {
    expect(
      diasDesdeAUltimaSessao({
        sessoes: [forca("2026-09-10")],
        cardios: [cardio("2026-09-12")],
        hoje: "2026-09-15",
      }),
    ).toBe(3);
  });

  it("nunca treinou é null", () => {
    expect(diasDesdeAUltimaSessao({ hoje: "2026-09-15" })).toBeNull();
  });
});
