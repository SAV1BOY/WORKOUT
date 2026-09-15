import { describe, expect, it } from "vitest";
import {
  aderencia,
  barraFixaPorSemana,
  cargaPorSessao,
  corridaPorSemana,
  datasDasSessoes,
  dataDaSerie,
  diasDesde,
  e1rmEpley,
  minutosCorrendo,
  ordenarRecordes,
  recordesRecentes,
  repsDaSerie,
  rotuloDaSemana,
  semanasAte,
  serieDeTrabalho,
  sessoesDoExercicio,
  treinosConcluidos,
  volumeDaSemana,
  volumeDaSerie,
  volumePorSemana,
  type CardioBruto,
  type SerieBruta,
  type SessaoBruta,
} from "@/lib/progresso";
import type { PerfilCalendario } from "@/lib/calendario";

/* 14/09/2026 é a segunda-feira do início do programa (SPEC §5). */
const SEGUNDA = "2026-09-14";

function serie(p: Partial<SerieBruta> & { session_id: string }): SerieBruta {
  return {
    exercise_id: "supino-reto-com-barra",
    set_index: 1,
    tipo: "trabalho",
    reps: 8,
    reps_lado2: null,
    carga_kg: 20,
    tempo_s: null,
    tempo_s_lado2: null,
    passos: null,
    assistencia: null,
    concluida: true,
    registrada_em: "2026-09-14T10:00:00.000Z",
    ...p,
  };
}

function sessao(p: Partial<SessaoBruta> & { id: string; data: string }): SessaoBruta {
  return { status: "concluida", workout_id: "A1", ...p };
}

describe("semanas", () => {
  it("semanasAte devolve as segundas, da mais antiga para a de hoje", () => {
    expect(semanasAte("2026-09-16", 4)).toEqual([
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
    ]);
  });

  it("a semana começa na segunda mesmo pedindo um domingo", () => {
    expect(semanasAte("2026-09-20", 1)).toEqual(["2026-09-14"]);
    expect(rotuloDaSemana("2026-09-14")).toBe("14/09");
  });
});

describe("volume", () => {
  const porSessao = datasDasSessoes([
    sessao({ id: "s1", data: SEGUNDA }),
    sessao({ id: "s2", data: "2026-09-16" }),
    sessao({ id: "s3", data: "2026-09-07" }),
  ]);

  it("Σ reps × kg só das séries de trabalho concluídas", () => {
    expect(volumeDaSerie(serie({ session_id: "s1", reps: 8, carga_kg: 20 }))).toBe(160);
    expect(volumeDaSerie(serie({ session_id: "s1", tipo: "aquecimento" }))).toBe(0);
    expect(volumeDaSerie(serie({ session_id: "s1", concluida: false }))).toBe(0);
    expect(serieDeTrabalho(serie({ session_id: "s1" }))).toBe(true);
  });

  it("unilateral soma os dois lados", () => {
    const s = serie({ session_id: "s1", reps: 10, reps_lado2: 8, carga_kg: 12 });
    expect(repsDaSerie(s)).toBe(18);
    expect(volumeDaSerie(s)).toBe(216);
  });

  it("peso do corpo (0 kg) não soma volume", () => {
    expect(volumeDaSerie(serie({ session_id: "s1", carga_kg: 0, reps: 12 }))).toBe(0);
  });

  it("agrupa por semana civil e devolve as 12 semanas, com as vazias", () => {
    const series = [
      serie({ session_id: "s1", reps: 5, carga_kg: 40 }), // 200 na semana de 14/09
      serie({ session_id: "s2", reps: 5, carga_kg: 40 }), // 200 na mesma semana
      serie({ session_id: "s3", reps: 10, carga_kg: 10 }), // 100 na semana anterior
    ];
    const pontos = volumePorSemana(series, porSessao, { hoje: "2026-09-16" });
    expect(pontos).toHaveLength(12);
    expect(pontos[11]).toMatchObject({ inicio: "2026-09-14", valor: 400 });
    expect(pontos[10]).toMatchObject({ inicio: "2026-09-07", valor: 100 });
    expect(pontos[0]?.valor).toBe(0);
    expect(volumeDaSemana(series, porSessao, "2026-09-16")).toBe(400);
  });

  it("a série sem sessão conhecida cai no dia de registrada_em", () => {
    const solta = serie({
      session_id: "desconhecida",
      registrada_em: "2026-09-15T08:00:00.000Z",
    });
    expect(dataDaSerie(solta, porSessao)).toBe("2026-09-15");
    expect(volumePorSemana([solta], porSessao, { hoje: "2026-09-16" })[11]?.valor).toBe(160);
  });
});

describe("aderência (4 semanas)", () => {
  const perfil: PerfilCalendario & { data_inicio: string } = {
    fase_atual: "fase1",
    ultimo_treino: null,
    fase_desde: SEGUNDA,
    data_inicio: SEGUNDA,
    semana_corrida: 1,
    semana_corda: 1,
    semana_fixa: 1,
  };

  it("não conta os dias antes do início do programa nem os do futuro", () => {
    const a = aderencia({ hoje: SEGUNDA, perfil, sessoes: [], cardios: [] });
    // só a segunda 14/09 já passou: 1 dia planejado (Treino A), nenhum feito
    expect(a.planejados).toBe(1);
    expect(a.feitos).toBe(0);
    expect(a.percentual).toBe(0);
    expect(a.semanas).toHaveLength(4);
  });

  it("conta força pelas sessões concluídas e cardio pelas sessões de cardio", () => {
    const a = aderencia({
      hoje: "2026-09-16",
      perfil,
      sessoes: [sessao({ id: "s1", data: SEGUNDA })],
      cardios: [
        { data: "2026-09-15", tipo: "corrida", duracao_min: 34, distancia_km: 3, feito: null, concluida: true },
      ],
    });
    // seg (força, feito), ter (cardio, feito), qua (força, não feito)
    expect(a.planejados).toBe(3);
    expect(a.feitos).toBe(2);
    expect(a.percentual).toBe(67);
  });

  it("sessão abandonada não conta como feita", () => {
    const a = aderencia({
      hoje: SEGUNDA,
      perfil,
      sessoes: [sessao({ id: "s1", data: SEGUNDA, status: "abandonada" })],
      cardios: [],
    });
    expect(a.feitos).toBe(0);
  });

  it("o dia trocado para descanso sai do planejado", () => {
    const a = aderencia({
      hoje: SEGUNDA,
      perfil,
      overrides: [{ data: SEGUNDA, tipo: "descanso", workout_id: null, sessao: null }],
      sessoes: [],
      cardios: [],
    });
    expect(a.planejados).toBe(0);
    expect(a.percentual).toBe(0);
  });
});

describe("carga por sessão e e1RM", () => {
  const porSessao = datasDasSessoes([
    sessao({ id: "s1", data: "2026-09-14" }),
    sessao({ id: "s2", data: "2026-09-18" }),
  ]);

  it("um ponto por sessão, com a série mais pesada", () => {
    const pontos = cargaPorSessao(
      [
        serie({ session_id: "s1", carga_kg: 7.5, reps: 5 }),
        serie({ session_id: "s1", carga_kg: 7.5, reps: 5, set_index: 2 }),
        serie({ session_id: "s1", carga_kg: 5, reps: 5, tipo: "aquecimento" }),
        serie({ session_id: "s2", carga_kg: 11.5, reps: 5 }),
      ],
      porSessao,
      "supino-reto-com-barra",
    );
    expect(pontos).toEqual([
      { data: "2026-09-14", rotulo: "14/09", carga: 7.5, reps: 5, e1rm: e1rmEpley(7.5, 5) },
      { data: "2026-09-18", rotulo: "18/09", carga: 11.5, reps: 5, e1rm: e1rmEpley(11.5, 5) },
    ]);
  });

  it("funciona com um ponto só", () => {
    const pontos = cargaPorSessao([serie({ session_id: "s1" })], porSessao, "supino-reto-com-barra");
    expect(pontos).toHaveLength(1);
  });

  it("e1RM de Epley: carga × (1 + reps/30)", () => {
    expect(e1rmEpley(30, 0)).toBe(30);
    expect(e1rmEpley(30, 10)).toBe(40);
  });
});

describe("sessõesDoExercicio", () => {
  const porSessao = datasDasSessoes([
    sessao({ id: "s1", data: "2026-09-14" }),
    sessao({ id: "s2", data: "2026-09-18" }),
    sessao({ id: "s3", data: "2026-09-21" }),
  ]);

  it("agrupa por sessão, da mais nova para a mais antiga, e ordena as séries", () => {
    const dias = sessoesDoExercicio(
      [
        serie({ session_id: "s1", set_index: 2, reps: 6 }),
        serie({ session_id: "s1", set_index: 1, reps: 8 }),
        serie({ session_id: "s2", set_index: 1, reps: 8 }),
        serie({ session_id: "s2", set_index: 1, tipo: "aquecimento" }),
        serie({ session_id: "s3", exercise_id: "outro", set_index: 1 }),
      ],
      porSessao,
      "supino-reto-com-barra",
    );
    expect(dias.map((d) => d.data)).toEqual(["2026-09-18", "2026-09-14"]);
    expect(dias[1]?.series.map((s) => s.set_index)).toEqual([1, 2]);
  });

  it("guarda no máximo o limite pedido", () => {
    const muitas = Array.from({ length: 15 }, (_, i) =>
      serie({ session_id: `s${i}`, registrada_em: `2026-09-${String(i + 1).padStart(2, "0")}T10:00:00.000Z` }),
    );
    expect(sessoesDoExercicio(muitas, new Map(), "supino-reto-com-barra", 10)).toHaveLength(10);
  });
});

describe("barra fixa por semana", () => {
  it("soma as séries e as repetições soltas", () => {
    const porSessao = datasDasSessoes([sessao({ id: "s1", data: SEGUNDA, workout_id: "fixa" })]);
    const semanas = barraFixaPorSemana(
      [
        serie({ session_id: "s1", exercise_id: "barra-fixa-assistida", reps: 5, carga_kg: 0 }),
        serie({ session_id: "s1", exercise_id: "barra-fixa-assistida", reps: 4, carga_kg: 0, set_index: 2 }),
        serie({ session_id: "s1", exercise_id: "supino-reto-com-barra", reps: 8 }),
      ],
      porSessao,
      [
        { data: SEGUNDA, reps: 1 },
        { data: "2026-09-16", reps: 2 },
        { data: "2026-09-07", reps: 3 },
      ],
      { hoje: "2026-09-16", semanas: 12 },
    );
    expect(semanas).toHaveLength(12);
    expect(semanas[11]).toMatchObject({ series: 9, soltas: 3, total: 12 });
    expect(semanas[10]).toMatchObject({ series: 0, soltas: 3, total: 3 });
  });
});

describe("corrida por semana", () => {
  const sessaoCorrida = (p: Partial<CardioBruto>): CardioBruto => ({
    data: "2026-09-15",
    tipo: "corrida",
    duracao_min: 34,
    distancia_km: 3.2,
    feito: null,
    concluida: true,
    ...p,
  });

  it("minutos correndo vêm dos blocos de corrida do `feito`", () => {
    const linha = sessaoCorrida({
      feito: {
        blocos: [
          { tipo: "aquecimento", s: 300 },
          { tipo: "corrida", s: 60 },
          { tipo: "caminhada", s: 120 },
          { tipo: "corrida", s: 60 },
        ],
      },
    });
    expect(minutosCorrendo(linha)).toBe(2);
  });

  it("sem blocos cai na duração total", () => {
    expect(minutosCorrendo(sessaoCorrida({ feito: null }))).toBe(34);
  });

  it("agrupa por semana e ignora corda e sessão não concluída", () => {
    const semanas = corridaPorSemana(
      [
        sessaoCorrida({ data: "2026-09-15", duracao_min: 30, distancia_km: 3 }),
        sessaoCorrida({ data: "2026-09-17", duracao_min: 20, distancia_km: 2.5 }),
        sessaoCorrida({ data: "2026-09-17", tipo: "corda", duracao_min: 13 }),
        sessaoCorrida({ data: "2026-09-16", concluida: false, duracao_min: 99 }),
      ],
      { hoje: "2026-09-18", semanas: 12 },
    );
    expect(semanas[11]).toMatchObject({ inicio: SEGUNDA, minutos: 50, km: 5.5 });
  });
});

describe("recordes", () => {
  const porSessao = datasDasSessoes([
    sessao({ id: "s1", data: "2026-07-06" }),
    sessao({ id: "s2", data: "2026-09-14" }),
  ]);

  it("recorde recente é o que nasceu dentro da janela", () => {
    const recentes = recordesRecentes(
      [
        serie({ session_id: "s1", carga_kg: 20, reps: 5 }),
        serie({ session_id: "s2", carga_kg: 30, reps: 5 }),
        serie({ session_id: "s1", exercise_id: "prancha", carga_kg: 0, reps: null, tempo_s: 60 }),
      ],
      porSessao,
      { hoje: "2026-09-16", dias: 30 },
    );
    expect(recentes).toHaveLength(1);
    expect(recentes[0]).toMatchObject({
      exercise_id: "supino-reto-com-barra",
      tipo: "carga",
      valor: 30,
      data: "2026-09-14",
    });
  });

  it("o recorde repetido guarda o dia em que apareceu primeiro", () => {
    const recentes = recordesRecentes(
      [
        serie({ session_id: "s1", carga_kg: 30, reps: 5 }),
        serie({ session_id: "s2", carga_kg: 30, reps: 5 }),
      ],
      porSessao,
      { hoje: "2026-09-16", dias: 30 },
    );
    expect(recentes).toHaveLength(0);
  });

  it("exercício sem carga vira recorde de reps ou de tempo", () => {
    const recentes = recordesRecentes(
      [
        serie({ session_id: "s2", exercise_id: "prancha", carga_kg: 0, reps: null, tempo_s: 45 }),
        serie({ session_id: "s2", exercise_id: "barra-fixa-assistida", carga_kg: 0, reps: 6 }),
      ],
      porSessao,
      { hoje: "2026-09-16", dias: 30 },
    );
    expect(recentes.map((r) => r.tipo).sort()).toEqual(["reps", "tempo"]);
  });

  it("ordenarRecordes põe o nome e ordena em pt-BR", () => {
    const lista = ordenarRecordes(
      [
        { user_id: "u", exercise_id: "b", carga_max_kg: 10, e1rm_epley: 11, reps_max: 5, tempo_max_s: null },
        { user_id: "u", exercise_id: "a", carga_max_kg: 20, e1rm_epley: 22, reps_max: 5, tempo_max_s: null },
      ],
      new Map([
        ["a", "Zagueiro"],
        ["b", "Abdominal"],
      ]),
    );
    expect(lista.map((r) => r.nome)).toEqual(["Abdominal", "Zagueiro"]);
  });
});

describe("treinos concluídos e dias desde", () => {
  it("conta semana, mês e total", () => {
    const t = [
      sessao({ id: "1", data: "2026-09-14" }),
      sessao({ id: "2", data: "2026-09-16" }),
      sessao({ id: "3", data: "2026-09-02" }),
      sessao({ id: "4", data: "2026-08-31" }),
      sessao({ id: "5", data: "2026-09-16", status: "abandonada" }),
    ];
    // 16/09/2026 é quarta; a semana civil vai de 14 a 20/09
    expect(treinosConcluidos(t, "2026-09-16")).toEqual({ semana: 2, mes: 3, total: 4 });
  });

  it("diasDesde", () => {
    expect(diasDesde("2026-09-14", "2026-09-16")).toBe(2);
    expect(diasDesde(null, "2026-09-16")).toBeNull();
  });
});


describe("dataDaSerie no fuso de quem treinou", () => {
  const serie = (registrada_em: string): SerieBruta => ({
    exercise_id: "supino-reto-com-barra",
    session_id: "sem-sessao-na-janela",
    set_index: 1,
    tipo: "trabalho",
    reps: 5,
    reps_lado2: null,
    carga_kg: 20,
    tempo_s: null,
    tempo_s_lado2: null,
    passos: null,
    assistencia: null,
    concluida: true,
    registrada_em,
  });

  it("sem a sessão na janela, o dia é o do relógio local, não o de UTC", () => {
    // 16/09/2026 às 22h em Nova Lima (UTC−3) = 17/09 01h em UTC
    const vazio = new Map<string, string>();
    expect(dataDaSerie(serie("2026-09-17T01:00:00.000Z"), vazio)).toBe("2026-09-16");
  });

  it("com a sessão na janela, vale a data da sessão", () => {
    const porSessao = new Map([["sem-sessao-na-janela", "2026-09-16"]]);
    expect(dataDaSerie(serie("2026-09-17T01:00:00.000Z"), porSessao)).toBe("2026-09-16");
  });
});
