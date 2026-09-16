import { describe, expect, it } from "vitest";
import {
  EXERCICIOS_DE_BARRA_FIXA,
  intervaloDoPeriodo,
  numerosDoPeriodo,
  treinosComSessao,
  type CardioContavel,
} from "@/lib/numeros";
import type { SerieBruta, SessaoBruta } from "@/lib/progresso";
import type { StatusSessao, WorkoutId } from "@/lib/types";

/** Quarta, 16/09/2026: semana civil 14–20/09, mês 01–30/09. */
const HOJE = "2026-09-16";

function sessao(
  id: string,
  data: string,
  workout: WorkoutId,
  status: StatusSessao = "concluida",
  duracaoS = 2700,
): SessaoBruta {
  return { id, data, workout_id: workout, status, duracao_s: duracaoS, plano: null };
}

function serie(
  sessaoId: string,
  exercicio: string,
  reps: number,
  carga: number | null = null,
  extra: Partial<SerieBruta> = {},
): SerieBruta {
  return {
    session_id: sessaoId,
    exercise_id: exercicio,
    set_index: 1,
    tipo: "trabalho",
    reps,
    reps_lado2: null,
    carga_kg: carga,
    tempo_s: null,
    tempo_s_lado2: null,
    passos: null,
    assistencia: null,
    concluida: true,
    registrada_em: "2026-09-16T12:00:00.000Z",
    ...extra,
  };
}

function corrida(data: string, min: number, km: number | null = null): CardioContavel {
  return {
    data,
    tipo: "corrida",
    duracao_min: min,
    distancia_km: km,
    concluida: true,
  };
}

describe("o período (SPEC §19.2)", () => {
  it("Semana é a semana civil de segunda a domingo", () => {
    expect(intervaloDoPeriodo("semana", HOJE)).toEqual({
      de: "2026-09-14",
      ate: "2026-09-20",
    });
  });

  it("Mês é o mês civil inteiro", () => {
    expect(intervaloDoPeriodo("mes", HOJE)).toEqual({
      de: "2026-09-01",
      ate: "2026-09-30",
    });
  });

  it("Tudo não recorta nada", () => {
    expect(intervaloDoPeriodo("tudo", HOJE)).toEqual({ de: null, ate: null });
  });

  it("a semana de um domingo é a que começou na segunda anterior", () => {
    expect(intervaloDoPeriodo("semana", "2026-09-20")).toEqual({
      de: "2026-09-14",
      ate: "2026-09-20",
    });
  });
});

describe("força por treino (SPEC §19.2)", () => {
  const sessoes = [
    sessao("a1", "2026-09-14", "A1"),
    sessao("a2", "2026-09-16", "B1"),
    sessao("a3", "2026-09-07", "A1"),
    sessao("a4", "2026-09-15", "livre"),
  ];

  it("conta as sessões do período e separa por treino", () => {
    const semana = numerosDoPeriodo({ periodo: "semana", hoje: HOJE, sessoes });
    expect(semana.forca.sessoes).toBe(3);
    expect(semana.forca.livres).toBe(1);
    expect(treinosComSessao(semana.forca)).toEqual([
      { id: "A1", nome: "Treino A", sessoes: 1 },
      { id: "B1", nome: "Treino B", sessoes: 1 },
    ]);
  });

  it("Mês pega a semana anterior também; Tudo pega tudo", () => {
    expect(numerosDoPeriodo({ periodo: "mes", hoje: HOJE, sessoes }).forca.sessoes).toBe(4);
    expect(numerosDoPeriodo({ periodo: "tudo", hoje: HOJE, sessoes }).forca.sessoes).toBe(4);
  });

  it("sessão em andamento e abandonada não contam (SPEC §19.1)", () => {
    const lista = [
      ...sessoes,
      sessao("x1", "2026-09-16", "A1", "em_andamento"),
      sessao("x2", "2026-09-16", "B1", "abandonada"),
    ];
    const tudo = numerosDoPeriodo({ periodo: "tudo", hoje: HOJE, sessoes: lista });
    expect(tudo.forca.sessoes).toBe(4);
  });

  it("a sessão de barra fixa não entra na força (nada conta duas vezes)", () => {
    const lista = [...sessoes, sessao("f1", "2026-09-16", "fixa")];
    const tudo = numerosDoPeriodo({ periodo: "tudo", hoje: HOJE, sessoes: lista });
    expect(tudo.forca.sessoes).toBe(4);
    expect(tudo.barraFixa.sessoes).toBe(1);
  });

  it("o nome do treino vem de programa.json", () => {
    const tudo = numerosDoPeriodo({
      periodo: "tudo",
      hoje: HOJE,
      sessoes: [sessao("s", "2026-09-16", "SA")],
    });
    expect(treinosComSessao(tudo.forca)).toEqual([
      { id: "SA", nome: "Superior A", sessoes: 1 },
    ]);
  });
});

describe("cardio (SPEC §19.2)", () => {
  const cardios: CardioContavel[] = [
    corrida("2026-09-15", 34, 3.2),
    corrida("2026-09-17", 30, 4),
    { data: "2026-09-18", tipo: "corda", duracao_min: 13, distancia_km: null, saltos: 300, concluida: true },
    { data: "2026-09-19", tipo: "caminhada", duracao_min: 20, distancia_km: 2, concluida: true },
    { data: "2026-09-19", tipo: "corrida", duracao_min: 99, distancia_km: 9, concluida: false },
    corrida("2026-08-10", 25, 2.5),
  ];

  it("separa corrida, corda e outros e soma minutos, km e saltos", () => {
    const semana = numerosDoPeriodo({ periodo: "semana", hoje: HOJE, cardios });
    expect(semana.cardio).toEqual({
      sessoes: 4,
      corrida: 2,
      corda: 1,
      outros: 1,
      minutos: 34 + 30 + 13 + 20,
      km: 3.2 + 4 + 2,
      saltos: 300,
    });
  });

  it("cardio não concluído não conta", () => {
    const tudo = numerosDoPeriodo({ periodo: "tudo", hoje: HOJE, cardios });
    expect(tudo.cardio.sessoes).toBe(5);
    expect(tudo.cardio.corrida).toBe(3);
  });

  it("Mês exclui agosto", () => {
    const mes = numerosDoPeriodo({ periodo: "mes", hoje: HOJE, cardios });
    expect(mes.cardio.corrida).toBe(2);
  });
});

describe("barra fixa (SPEC §19.2)", () => {
  const sessoes = [
    sessao("f1", "2026-09-15", "fixa"),
    sessao("t1", "2026-09-16", "A1"),
  ];
  const series = [
    serie("f1", "barra-fixa-assistida", 6),
    serie("f1", "barra-fixa-assistida", 4),
    serie("t1", "barra-fixa-pronada", 3),
    /* a elevação de pernas usa a mesma barra, mas é core: não conta */
    serie("t1", "elevacao-de-pernas-na-barra-fixa", 12),
    serie("t1", "agachamento-livre", 5, 40),
  ];
  const soltas = [
    { data: "2026-09-16", reps: 2 },
    { data: "2026-09-08", reps: 5 },
  ];

  it("o catálogo dá os quatro exercícios de barra fixa", () => {
    expect([...EXERCICIOS_DE_BARRA_FIXA].sort()).toEqual([
      "barra-fixa-assistida",
      "barra-fixa-com-lastro",
      "barra-fixa-pronada",
      "barra-fixa-supinada",
    ]);
  });

  it("conta sessões, reps em sessão, soltas, total e melhor série", () => {
    const semana = numerosDoPeriodo({
      periodo: "semana",
      hoje: HOJE,
      sessoes,
      series,
      soltas,
    });
    expect(semana.barraFixa).toEqual({
      sessoes: 1,
      repsEmSessao: 13,
      repsSoltas: 2,
      reps: 15,
      melhorSerie: 6,
    });
  });

  it("Tudo soma as soltas da semana anterior", () => {
    const tudo = numerosDoPeriodo({
      periodo: "tudo",
      hoje: HOJE,
      sessoes,
      series,
      soltas,
    });
    expect(tudo.barraFixa.repsSoltas).toBe(7);
    expect(tudo.barraFixa.reps).toBe(20);
  });

  it("série não concluída não conta nem no total nem na melhor", () => {
    const tudo = numerosDoPeriodo({
      periodo: "tudo",
      hoje: HOJE,
      sessoes,
      series: [...series, serie("f1", "barra-fixa-pronada", 20, null, { concluida: false })],
    });
    expect(tudo.barraFixa.melhorSerie).toBe(6);
    expect(tudo.barraFixa.repsEmSessao).toBe(13);
  });

  it("o unilateral soma os dois lados na mesma série", () => {
    const tudo = numerosDoPeriodo({
      periodo: "tudo",
      hoje: HOJE,
      sessoes,
      series: [serie("f1", "barra-fixa-pronada", 4, null, { reps_lado2: 3 })],
    });
    expect(tudo.barraFixa.melhorSerie).toBe(7);
  });
});

describe("minutos e volume (SPEC §19.2)", () => {
  it("minutos somam a duração da força e os minutos do cardio", () => {
    const numeros = numerosDoPeriodo({
      periodo: "semana",
      hoje: HOJE,
      sessoes: [sessao("a", "2026-09-14", "A1", "concluida", 2700)],
      cardios: [corrida("2026-09-15", 34)],
    });
    expect(numeros.minutos).toBe(45 + 34);
  });

  it("a sessão de barra fixa também conta nos minutos", () => {
    const numeros = numerosDoPeriodo({
      periodo: "semana",
      hoje: HOJE,
      sessoes: [sessao("f", "2026-09-14", "fixa", "concluida", 600)],
    });
    expect(numeros.minutos).toBe(10);
  });

  it("o volume é Σ reps × kg das séries de trabalho concluídas", () => {
    const numeros = numerosDoPeriodo({
      periodo: "semana",
      hoje: HOJE,
      sessoes: [sessao("a", "2026-09-14", "A1")],
      series: [
        serie("a", "agachamento-livre", 5, 40),
        serie("a", "agachamento-livre", 5, 40, { tipo: "aquecimento" }),
        serie("a", "barra-fixa-assistida", 6, 0),
      ],
    });
    expect(numeros.volumeKg).toBe(200);
  });

  it("a série é datada pela sessão, não pelo fuso de registrada_em", () => {
    /* 01/10 às 00:30 UTC = 30/09 às 21:30 em Nova Lima: é da sessão de 30/09 */
    const numeros = numerosDoPeriodo({
      periodo: "mes",
      hoje: HOJE,
      sessoes: [sessao("a", "2026-09-30", "A1")],
      series: [
        serie("a", "agachamento-livre", 5, 40, {
          registrada_em: "2026-10-01T00:30:00.000Z",
        }),
      ],
    });
    expect(numeros.volumeKg).toBe(200);
  });

  it("sem nada, tudo é zero e nada quebra", () => {
    const vazio = numerosDoPeriodo({ periodo: "tudo", hoje: HOJE });
    expect(vazio.forca.sessoes).toBe(0);
    expect(vazio.cardio.sessoes).toBe(0);
    expect(vazio.barraFixa.reps).toBe(0);
    expect(vazio.minutos).toBe(0);
    expect(vazio.volumeKg).toBe(0);
    expect(treinosComSessao(vazio.forca)).toEqual([]);
  });
});
