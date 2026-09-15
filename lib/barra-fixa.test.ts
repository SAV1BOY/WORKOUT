import { describe, expect, it } from "vitest";
import {
  DIAS_DE_HISTORICO,
  historicoDeSoltas,
  intervaloDoHistorico,
  linhasDoPlano,
  prescricaoDaSemana,
  sessoesDeFixaNoIntervalo,
  soltasDaSemana,
  somarSoltas,
} from "@/lib/barra-fixa";

describe("tabela das 12 semanas (SPEC §3.4)", () => {
  it("traz as seis faixas do JSON com a semana atual marcada", () => {
    const linhas = linhasDoPlano(1);
    expect(linhas).toHaveLength(6);
    expect(linhas[0]).toMatchObject({
      semanas: "1–2",
      porSessao: "4 × 5",
      repsSemana: "40",
      atual: true,
    });
    expect(linhas.filter((l) => l.atual)).toHaveLength(1);
  });

  it("a semana 7 marca a faixa 7–8", () => {
    const atual = linhasDoPlano(7).find((l) => l.atual);
    expect(atual?.semanas).toBe("7–8");
    expect(atual?.assistencia).toContain("joelho");
  });

  it("a faixa de reps em texto continua texto ('25–45' na 11–12)", () => {
    expect(linhasDoPlano(11).find((l) => l.atual)?.repsSemana).toBe("25–45");
  });

  it("acima do plano fica na última faixa", () => {
    expect(linhasDoPlano(30).find((l) => l.atual)?.semanas).toBe("11–12");
  });
});

describe("prescrição da sessão da semana", () => {
  it("semana 1: 4 × 5 repetições", () => {
    const p = prescricaoDaSemana(1);
    expect(p.texto).toBe("4 × 5");
    expect(p.alvo).toEqual({
      series: 4,
      tipo: "reps",
      min: 5,
      max: 5,
      unilateral: false,
    });
  });

  it("semana 5: 4 × 8", () => {
    expect(prescricaoDaSemana(5).alvo).toMatchObject({ series: 4, min: 8, max: 8 });
  });

  it("semana 11: 5 × máximo vira o tipo `maximo` do motor (SPEC §6.3)", () => {
    const p = prescricaoDaSemana(11);
    expect(p.texto).toBe("5 × máximo");
    expect(p.alvo).toEqual({
      series: 5,
      tipo: "maximo",
      min: null,
      max: null,
      unilateral: false,
    });
  });

  it("traz o texto da assistência e o que a semana treina", () => {
    const p = prescricaoDaSemana(3);
    expect(p.assistencia).toContain("pé inteiro");
    expect(p.treina).toContain("movimento completo");
    expect(p.faixa).toBe("3–4");
  });
});

describe("repetições soltas — grease the groove (SPEC §3.4)", () => {
  const soltas = [
    { data: "2026-09-17", reps: 1 },
    { data: "2026-09-17", reps: 1 },
    { data: "2026-09-16", reps: 1 },
    { data: "2026-09-08", reps: 1 },
  ];

  it("soma as repetições", () => {
    expect(somarSoltas(soltas)).toBe(4);
    expect(somarSoltas([])).toBe(0);
  });

  it("o histórico tem 14 dias, do mais antigo ao mais novo", () => {
    const dias = historicoDeSoltas(soltas, "2026-09-17");
    expect(dias).toHaveLength(DIAS_DE_HISTORICO);
    expect(dias[0]?.data).toBe("2026-09-04");
    expect(dias[13]).toMatchObject({ data: "2026-09-17", reps: 2, ehHoje: true });
    expect(dias[12]).toMatchObject({ data: "2026-09-16", reps: 1 });
    expect(dias.find((d) => d.data === "2026-09-08")?.reps).toBe(1);
    expect(dias.find((d) => d.data === "2026-09-15")?.reps).toBe(0);
  });

  it("o intervalo do histórico cobre os 14 dias", () => {
    expect(intervaloDoHistorico("2026-09-17")).toEqual({
      de: "2026-09-04",
      ate: "2026-09-17",
    });
  });

  it("a soma da semana respeita o intervalo", () => {
    expect(soltasDaSemana(soltas, "2026-09-14", "2026-09-20")).toBe(3);
  });
});

describe("sessões de barra fixa na semana (SPEC §5.5)", () => {
  const sessoes = [
    { data: "2026-09-15", status: "concluida", workout_id: "fixa" },
    { data: "2026-09-17", status: "concluida", workout_id: "fixa" },
    { data: "2026-09-18", status: "abandonada", workout_id: "fixa" },
    { data: "2026-09-18", status: "concluida", workout_id: "A1" },
    { data: "2026-09-10", status: "concluida", workout_id: "fixa" },
  ];

  it("conta só as concluídas, só as de barra fixa e só dentro do intervalo", () => {
    expect(sessoesDeFixaNoIntervalo(sessoes, "2026-09-14", "2026-09-20")).toBe(2);
    expect(sessoesDeFixaNoIntervalo(sessoes, "2026-09-07", "2026-09-13")).toBe(1);
  });
});
