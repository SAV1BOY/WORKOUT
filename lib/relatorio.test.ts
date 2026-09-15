import { describe, expect, it } from "vitest";
import {
  contadoresDoRelatorio,
  registros,
  textoDoMotorDaSessao,
  tituloDaSessao,
  volumeDaSessao,
  type EventoDeSessao,
} from "@/lib/relatorio";
import { planoDaSessao, itensDeIds } from "@/lib/livre";
import type { CardioBruto, SerieBruta, SessaoBruta } from "@/lib/progresso";

function serie(campos: Partial<SerieBruta> & { session_id: string }): SerieBruta {
  return {
    exercise_id: "agachamento-livre",
    set_index: 1,
    tipo: "trabalho",
    reps: 5,
    reps_lado2: null,
    carga_kg: 10,
    tempo_s: null,
    tempo_s_lado2: null,
    passos: null,
    assistencia: null,
    concluida: true,
    registrada_em: "2026-09-15T10:00:00.000Z",
    ...campos,
  };
}

const SESSOES: SessaoBruta[] = [
  {
    id: "s1",
    data: "2026-09-15",
    status: "concluida",
    workout_id: "A1",
    duracao_s: 2_700,
    plano: null,
  },
  {
    id: "s2",
    data: "2026-09-14",
    status: "em_andamento",
    workout_id: "B1",
    duracao_s: null,
    plano: null,
  },
];

const CARDIOS: CardioBruto[] = [
  {
    data: "2026-09-16",
    tipo: "corrida",
    duracao_min: 34,
    distancia_km: 4,
    feito: null,
    concluida: true,
    semana_plano: 3,
  },
  {
    data: "2026-09-13",
    tipo: "corda",
    duracao_min: 13,
    distancia_km: null,
    feito: null,
    concluida: false,
    semana_plano: 1,
  },
];

const SERIES: SerieBruta[] = [
  serie({ session_id: "s1" }),
  serie({ session_id: "s1", set_index: 2, reps: 5, carga_kg: 10 }),
  serie({ session_id: "s1", set_index: 1, tipo: "aquecimento", carga_kg: 7.5 }),
  serie({ session_id: "s1", set_index: 3, concluida: false }),
];

describe("contadores do Relatório (SPEC §13.5)", () => {
  it("contam força concluída + cardio concluído, minutos e volume", () => {
    const c = contadoresDoRelatorio({
      sessoes: SESSOES,
      cardios: CARDIOS,
      series: SERIES,
    });
    expect(c.treinos).toBe(2); // s1 + a corrida (a corda não foi concluída)
    expect(c.minutos).toBe(45 + 34);
    expect(c.volumeKg).toBe(100); // duas séries de 5 × 10 kg; aquecimento fora
  });

  it("tela vazia não quebra", () => {
    expect(contadoresDoRelatorio({ sessoes: [], cardios: [], series: [] })).toEqual({
      treinos: 0,
      minutos: 0,
      volumeKg: 0,
    });
  });
});

describe("todos os registros (SPEC §13.5)", () => {
  const eventos: EventoDeSessao[] = [
    { session_id: "s1", motivo: "subiu" },
    { session_id: "s1", motivo: "subiu" },
    { session_id: "s1", motivo: "repetiu" },
    { session_id: "s1", motivo: "falha_2x_voltou_10" },
    { session_id: "outra", motivo: "subiu" },
  ];

  it("lista da mais recente para a mais antiga, sem a sessão aberta", () => {
    const lista = registros({
      sessoes: SESSOES,
      cardios: CARDIOS,
      series: SERIES,
      soltas: [
        { data: "2026-09-15", reps: 3 },
        { data: "2026-09-15", reps: 5 },
      ],
      eventos,
    });
    expect(lista.map((r) => r.chave)).toEqual([
      "cardio:2026-09-16:corrida:0",
      "forca:s1",
      "soltas:2026-09-15",
    ]);
    expect(lista.some((r) => r.chave === "forca:s2")).toBe(false);
  });

  it("a linha de força tem treino, duração, séries e o ↑/=/↓", () => {
    const [, forca] = registros({
      sessoes: SESSOES,
      cardios: CARDIOS,
      series: SERIES,
      eventos,
    });
    expect(forca?.titulo).toBe("Treino A");
    expect(forca?.detalhe).toBe("45 min · 2 séries");
    expect(forca?.motor).toEqual({ subiu: 2, repetiu: 1, voltou: 1 });
    expect(textoDoMotorDaSessao(forca?.motor ?? null)).toBe("↑ 2 · = 1 · ↓ 1");
    expect(forca?.href).toBe("/treinar/s1");
  });

  it("a linha de cardio tem tipo, semana e duração", () => {
    const [corrida] = registros({ sessoes: [], cardios: CARDIOS, series: [] });
    expect(corrida?.titulo).toBe("Corrida");
    expect(corrida?.detalhe).toBe("semana 3 · 34 min");
  });

  it("as reps soltas somam por dia", () => {
    const lista = registros({
      sessoes: [],
      cardios: [],
      series: [],
      soltas: [
        { data: "2026-09-15", reps: 3 },
        { data: "2026-09-15", reps: 5 },
        { data: "2026-09-14", reps: 1 },
      ],
    });
    expect(lista.map((r) => r.detalhe)).toEqual(["8 repetições", "1 repetição"]);
  });

  it("o intervalo da faixa da semana corta o que está fora", () => {
    const lista = registros({
      sessoes: SESSOES,
      cardios: CARDIOS,
      series: SERIES,
      de: "2026-09-14",
      ate: "2026-09-15",
    });
    expect(lista.map((r) => r.chave)).toEqual(["forca:s1"]);
  });

  it("sem evento nenhum o motor fica em zero e o texto some", () => {
    const [forca] = registros({ sessoes: [SESSOES[0] as SessaoBruta], cardios: [], series: [] });
    expect(forca?.motor).toEqual({ subiu: 0, repetiu: 0, voltou: 0 });
    expect(textoDoMotorDaSessao(forca?.motor ?? null)).toBeNull();
    expect(textoDoMotorDaSessao(null)).toBeNull();
  });
});

describe("título da sessão", () => {
  const base = { id: "x", data: "2026-09-15", status: "concluida" as const };

  it("treino do programa usa o nome do programa.json", () => {
    expect(tituloDaSessao({ ...base, workout_id: "SA" })).toBe("Superior A");
  });

  it("barra fixa e sessão livre têm nome próprio", () => {
    expect(tituloDaSessao({ ...base, workout_id: "fixa" })).toBe("Barra fixa");
    expect(tituloDaSessao({ ...base, workout_id: "livre" })).toBe("Treino livre");
    expect(
      tituloDaSessao({
        ...base,
        workout_id: "livre",
        plano: planoDaSessao(itensDeIds(["abdominal-supra"]), {
          titulo: "Core no tatame",
        }),
      }),
    ).toBe("Core no tatame");
  });
});

describe("resumo de uma sessão", () => {
  it("soma reps e volume só das séries de trabalho concluídas", () => {
    expect(volumeDaSessao(SERIES, "s1")).toEqual({ reps: 10, volumeKg: 100 });
    expect(volumeDaSessao(SERIES, "nenhuma")).toEqual({ reps: 0, volumeKg: 0 });
  });
});
