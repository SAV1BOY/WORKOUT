import { describe, expect, it } from "vitest";
import {
  CHAVE_VISTAS,
  CONQUISTAS,
  EXERCICIOS_DE_CARGA,
  TOTAL_DE_CONQUISTAS,
  avaliarConquistas,
  comConquistasVistas,
  conquistasNovas,
  conquistasVistasDasPrefs,
  correuSemParar,
  maiorBlocoDeCorridaMin,
  textoDoQueFalta,
  totalConquistado,
  type ConquistaAvaliada,
  type DadosDasConquistas,
} from "@/lib/conquistas";
import type { CardioContavel } from "@/lib/numeros";
import type { SerieBruta, SessaoBruta } from "@/lib/progresso";
import type { Assistencia } from "@/lib/schemas";
import type { StatusSessao, WorkoutId } from "@/lib/types";

/* --------------------------------------------------------- ajudantes */

/** dias corridos a partir de 05/01/2026 (uma segunda-feira). */
function dia(n: number): string {
  const d = new Date(Date.UTC(2026, 0, 5));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function sessao(
  id: string,
  data: string,
  workout: WorkoutId = "A1",
  status: StatusSessao = "concluida",
): SessaoBruta {
  return { id, data, workout_id: workout, status, duracao_s: 2700, plano: null };
}

/** N sessões de força, uma a cada 3 dias a partir do dia 0. */
function sessoesDeForca(n: number): SessaoBruta[] {
  return Array.from({ length: n }, (_, i) => sessao(`s${i}`, dia(i * 3)));
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
    registrada_em: "2026-01-05T12:00:00.000Z",
    ...extra,
  };
}

const BASE: DadosDasConquistas = {
  meta: 1,
  planejadasNaSemana: 3,
  fase: { atual: "fase1", desde: "2026-01-05" },
};

function avaliar(dados: Partial<DadosDasConquistas> = {}): Map<string, ConquistaAvaliada> {
  return new Map(
    avaliarConquistas({ ...BASE, ...dados }).map((c) => [c.id, c]),
  );
}

function uma(id: string, dados: Partial<DadosDasConquistas> = {}): ConquistaAvaliada {
  const achada = avaliar(dados).get(id);
  if (!achada) throw new Error(`conquista desconhecida no teste: ${id}`);
  return achada;
}

/* ------------------------------------------------------------ a lista */

describe("a lista de conquistas (SPEC §19.3)", () => {
  it("tem 26 conquistas, com id único e nome curto", () => {
    expect(TOTAL_DE_CONQUISTAS).toBe(26);
    expect(CONQUISTAS).toHaveLength(26);
    expect(new Set(CONQUISTAS.map((c) => c.id)).size).toBe(26);
    for (const c of CONQUISTAS) {
      expect(c.nome.length, c.id).toBeLessThanOrEqual(16);
      expect(c.descricao.length, c.id).toBeGreaterThan(10);
      expect(c.regra.length, c.id).toBeGreaterThan(10);
    }
  });

  /*
   * SPEC §22.6 item 8: o texto que chega à tela fala português, sem sigla nem
   * notação matemática solta — e a `regra` só aparece na folha de detalhe, a um
   * toque da grade, então o e2e que lia o corpo da página não a via. Aqui as 26
   * passam de uma vez. O "×" fica: na tela ele lê "vezes" (4× por semana,
   * Treino A × 3).
   */
  it("nenhum nome, descrição ou regra usa sigla nem notação matemática", () => {
    for (const c of CONQUISTAS) {
      for (const texto of [c.nome, c.descricao, c.regra]) {
        expect(texto, c.id).not.toMatch(/[Σ∑≥≤±√∞]/u);
        expect(texto, c.id).not.toContain("1RM");
      }
    }
  });

  it("os ids são exatamente os 26 da SPEC §19.3 (o e2e semeia esta lista)", () => {
    expect(CONQUISTAS.map((c) => c.id)).toEqual([
      "forca-1",
      "forca-10",
      "forca-25",
      "forca-50",
      "forca-100",
      "dias-3",
      "dias-7",
      "semanas-2",
      "semanas-4",
      "semanas-8",
      "semanas-12",
      "semana-completa",
      "corrida-1",
      "corrida-20min",
      "corrida-5km",
      "corda-1000",
      "fixa-sem-elastico",
      "fixa-5",
      "fixa-10",
      "fixa-100-soltas",
      "carga-20",
      "carga-40",
      "carga-60",
      "volume-10k",
      "volume-50k",
      "fase-2",
    ]);
  });

  it("os exercícios de carga existem no catálogo", () => {
    expect([...EXERCICIOS_DE_CARGA].sort()).toEqual([
      "agachamento-frontal",
      "agachamento-livre",
      "agachamento-sumo",
      "levantamento-terra",
      "stiff-terra-romeno",
    ]);
  });

  it("sem nenhum registro nada está conquistado e todas dizem o que falta", () => {
    const lista = avaliarConquistas(BASE);
    expect(totalConquistado(lista)).toBe(0);
    for (const c of lista) {
      expect(c.em, c.id).toBeNull();
      expect(c.falta, c.id).not.toBeNull();
    }
  });
});

/* ------------------------------------------------------------- força */

describe("treinos de força (SPEC §19.3)", () => {
  it("1 treino fecha a primeira e não fecha as 10", () => {
    const sessoes = sessoesDeForca(1);
    expect(uma("forca-1", { sessoes }).atingida).toBe(true);
    expect(uma("forca-1", { sessoes }).em).toBe(dia(0));
    expect(uma("forca-10", { sessoes }).atingida).toBe(false);
  });

  it("10 treinos fecham com a data do décimo; 25 ainda faltam 15", () => {
    const sessoes = sessoesDeForca(12);
    const dez = uma("forca-10", { sessoes });
    expect(dez.atingida).toBe(true);
    expect(dez.em).toBe(dia(27));
    const vinteCinco = uma("forca-25", { sessoes });
    expect(vinteCinco.atingida).toBe(false);
    expect(vinteCinco.atual).toBe(12);
    expect(vinteCinco.falta).toBe("faltam 13 treinos");
  });

  it("25, 50 e 100 fecham com a contagem certa", () => {
    expect(uma("forca-25", { sessoes: sessoesDeForca(25) }).atingida).toBe(true);
    expect(uma("forca-50", { sessoes: sessoesDeForca(49) }).atingida).toBe(false);
    expect(uma("forca-50", { sessoes: sessoesDeForca(50) }).atingida).toBe(true);
    expect(uma("forca-100", { sessoes: sessoesDeForca(99) }).atingida).toBe(false);
    expect(uma("forca-100", { sessoes: sessoesDeForca(100) }).atingida).toBe(true);
  });

  it("sessão em andamento, abandonada e de barra fixa não contam como treino", () => {
    const sessoes = [
      sessao("a", dia(0), "A1", "em_andamento"),
      sessao("b", dia(1), "B1", "abandonada"),
      sessao("c", dia(2), "fixa"),
    ];
    expect(uma("forca-1", { sessoes }).atingida).toBe(false);
  });

  it("a sessão livre conta como treino de força", () => {
    expect(uma("forca-1", { sessoes: [sessao("l", dia(0), "livre")] }).atingida).toBe(
      true,
    );
  });
});

/* -------------------------------------------------------- constância */

describe("dias e semanas seguidas (SPEC §19.3)", () => {
  it("3 dias seguidos fecham na data do terceiro; 2 dias não fecham", () => {
    const tres = [sessao("a", dia(0)), sessao("b", dia(1)), sessao("c", dia(2))];
    expect(uma("dias-3", { sessoes: tres }).em).toBe(dia(2));
    const dois = [sessao("a", dia(0)), sessao("b", dia(1)), sessao("c", dia(3))];
    const falhou = uma("dias-3", { sessoes: dois });
    expect(falhou.atingida).toBe(false);
    expect(falhou.atual).toBe(2);
    expect(falhou.falta).toBe("falta 1 dia");
  });

  it("7 dias seguidos contam cardio junto com a força", () => {
    const sessoes = [0, 1, 2, 3].map((i) => sessao(`s${i}`, dia(i)));
    const cardios: CardioContavel[] = [4, 5, 6].map((i) => ({
      data: dia(i),
      tipo: "corrida",
      duracao_min: 20,
      distancia_km: null,
      concluida: true,
    }));
    expect(uma("dias-7", { sessoes, cardios }).em).toBe(dia(6));
    expect(uma("dias-7", { sessoes }).atingida).toBe(false);
  });

  it("2 semanas seguidas com a meta fecham na última atividade da 2ª", () => {
    /* meta 1: uma sessão por semana basta */
    const sessoes = [sessao("a", dia(0)), sessao("b", dia(8))];
    const duas = uma("semanas-2", { sessoes, meta: 1 });
    expect(duas.atingida).toBe(true);
    expect(duas.em).toBe(dia(8));
    expect(uma("semanas-4", { sessoes, meta: 1 }).falta).toBe("faltam 2 semanas");
  });

  it("semana sem a meta quebra a sequência", () => {
    const sessoes = [sessao("a", dia(0)), sessao("b", dia(14))];
    expect(uma("semanas-2", { sessoes, meta: 1 }).atingida).toBe(false);
  });

  it("meta maior que o feito não fecha semana nenhuma", () => {
    const sessoes = [sessao("a", dia(0)), sessao("b", dia(8))];
    expect(uma("semanas-2", { sessoes, meta: 5 }).atingida).toBe(false);
  });

  it("4, 8 e 12 semanas seguidas fecham quando há 12 semanas seguidas", () => {
    const sessoes = Array.from({ length: 12 }, (_, i) => sessao(`s${i}`, dia(i * 7)));
    expect(uma("semanas-4", { sessoes, meta: 1 }).em).toBe(dia(21));
    expect(uma("semanas-8", { sessoes, meta: 1 }).em).toBe(dia(49));
    expect(uma("semanas-12", { sessoes, meta: 1 }).em).toBe(dia(77));
    const onze = sessoes.slice(0, 11);
    expect(uma("semanas-12", { sessoes: onze, meta: 1 }).atingida).toBe(false);
  });

  it("Semana completa fecha quando os feitos batem os planejados", () => {
    const sessoes = [sessao("a", dia(0)), sessao("b", dia(2))];
    const cardios: CardioContavel[] = [
      { data: dia(4), tipo: "corrida", duracao_min: 20, distancia_km: null, concluida: true },
    ];
    const fechou = uma("semana-completa", { sessoes, cardios, planejadasNaSemana: 3 });
    expect(fechou.atingida).toBe(true);
    expect(fechou.em).toBe(dia(4));

    const naoFechou = uma("semana-completa", { sessoes, planejadasNaSemana: 3 });
    expect(naoFechou.atingida).toBe(false);
    expect(naoFechou.atual).toBe(2);
    expect(naoFechou.alvo).toBe(3);
    expect(naoFechou.falta).toBe("falta 1 sessão");
  });
});

/* ------------------------------------------------------------- cardio */

describe("corrida e corda (SPEC §19.3)", () => {
  const corrida = (extra: Partial<CardioContavel> = {}): CardioContavel => ({
    data: dia(0),
    tipo: "corrida",
    duracao_min: 30,
    distancia_km: null,
    concluida: true,
    ...extra,
  });

  it("a primeira corrida fecha; uma corrida não concluída não fecha", () => {
    expect(uma("corrida-1", { cardios: [corrida()] }).em).toBe(dia(0));
    expect(uma("corrida-1", { cardios: [corrida({ concluida: false })] }).atingida).toBe(
      false,
    );
  });

  it("20 min contínuos vêm do maior bloco de corrida do registro", () => {
    const vinte = corrida({
      feito: { blocos: [{ tipo: "aquecimento", s: 240 }, { tipo: "corrida", s: 1200 }] },
    });
    expect(maiorBlocoDeCorridaMin(vinte)).toBe(20);
    expect(uma("corrida-20min", { cardios: [vinte] }).atingida).toBe(true);

    const picada = corrida({
      feito: {
        blocos: [
          { tipo: "corrida", s: 120 },
          { tipo: "caminhada", s: 120 },
          { tipo: "corrida", s: 120 },
        ],
      },
    });
    const falhou = uma("corrida-20min", { cardios: [picada] });
    expect(falhou.atingida).toBe(false);
    expect(falhou.atual).toBe(2);
    expect(falhou.falta).toBe("faltam 18 minutos");
  });

  it("5 km só fecham sem bloco de caminhada no meio", () => {
    const seguido = corrida({
      distancia_km: 5.1,
      feito: { blocos: [{ tipo: "corrida", s: 2160 }] },
    });
    expect(correuSemParar(seguido)).toBe(true);
    expect(uma("corrida-5km", { cardios: [seguido] }).atingida).toBe(true);

    const comPausa = corrida({
      distancia_km: 6,
      feito: {
        blocos: [
          { tipo: "corrida", s: 1200 },
          { tipo: "caminhada", s: 120 },
        ],
      },
    });
    expect(correuSemParar(comPausa)).toBe(false);
    expect(uma("corrida-5km", { cardios: [comPausa] }).atingida).toBe(false);
  });

  it("uma corrida sem blocos registrados conta pela distância", () => {
    expect(uma("corrida-5km", { cardios: [corrida({ distancia_km: 5 })] }).atingida).toBe(
      true,
    );
    const curta = uma("corrida-5km", { cardios: [corrida({ distancia_km: 3.2 })] });
    expect(curta.atingida).toBe(false);
    expect(curta.falta).toBe("faltam 1,8 km");
  });

  it("1.000 saltos numa sessão de corda", () => {
    const corda = (saltos: number): CardioContavel => ({
      data: dia(1),
      tipo: "corda",
      duracao_min: 13,
      distancia_km: null,
      saltos,
      concluida: true,
    });
    expect(uma("corda-1000", { cardios: [corda(1000)] }).em).toBe(dia(1));
    /* duas sessões de 600 não somam: a regra é numa sessão só */
    const duas = uma("corda-1000", { cardios: [corda(600), corda(600)] });
    expect(duas.atingida).toBe(false);
    expect(duas.atual).toBe(600);
    expect(duas.falta).toBe("faltam 400 saltos");
  });
});

/* ---------------------------------------------------------- barra fixa */

describe("barra fixa (SPEC §19.3)", () => {
  const sessoes = [sessao("f", dia(0), "fixa")];
  const comAssistencia = (a: Assistencia | null, reps = 1) =>
    serie("f", "barra-fixa-assistida", reps, null, { assistencia: a });

  it('assistência "sem" fecha a primeira sem elástico; com elástico não fecha', () => {
    expect(
      uma("fixa-sem-elastico", { sessoes, series: [comAssistencia("sem")] }).em,
    ).toBe(dia(0));
    expect(
      uma("fixa-sem-elastico", { sessoes, series: [comAssistencia("pe_inteiro", 8)] })
        .atingida,
    ).toBe(false);
  });

  it("a barra fixa pronada não tem elástico por definição", () => {
    expect(
      uma("fixa-sem-elastico", {
        sessoes,
        series: [serie("f", "barra-fixa-pronada", 1)],
      }).atingida,
    ).toBe(true);
  });

  it("a repetição solta só conta como sem elástico quando foi registrada assim", () => {
    expect(
      uma("fixa-sem-elastico", { soltas: [{ data: dia(0), reps: 1 }] }).atingida,
    ).toBe(false);
    expect(
      uma("fixa-sem-elastico", {
        soltas: [{ data: dia(0), reps: 1, assistencia: "sem" }],
      }).atingida,
    ).toBe(true);
  });

  it("5 e 10 numa série olham a maior série, não a soma", () => {
    const cinco = [serie("f", "barra-fixa-assistida", 5)];
    expect(uma("fixa-5", { sessoes, series: cinco }).atingida).toBe(true);
    const dez = uma("fixa-10", { sessoes, series: cinco });
    expect(dez.atingida).toBe(false);
    expect(dez.falta).toBe("faltam 5 repetições");

    const duasDeQuatro = [
      serie("f", "barra-fixa-assistida", 4),
      serie("f", "barra-fixa-assistida", 4),
    ];
    expect(uma("fixa-5", { sessoes, series: duasDeQuatro }).atingida).toBe(false);
    expect(
      uma("fixa-10", { sessoes, series: [serie("f", "barra-fixa-pronada", 10)] }).atingida,
    ).toBe(true);
  });

  it("100 soltas somam os dias; 99 ainda faltam 1", () => {
    const cheias = Array.from({ length: 10 }, (_, i) => ({ data: dia(i), reps: 10 }));
    const cem = uma("fixa-100-soltas", { soltas: cheias });
    expect(cem.atingida).toBe(true);
    expect(cem.em).toBe(dia(9));

    const quase = uma("fixa-100-soltas", {
      soltas: [...cheias.slice(0, 9), { data: dia(9), reps: 9 }],
    });
    expect(quase.atingida).toBe(false);
    expect(quase.falta).toBe("falta 1 repetição");
  });
});

/* ------------------------------------------------------- carga e volume */

describe("carga e volume (SPEC §19.3)", () => {
  const sessoes = [sessao("a", dia(0)), sessao("b", dia(3))];

  it("20, 40 e 60 kg olham a carga total na barra do agachamento ou terra", () => {
    const series = [
      serie("a", "agachamento-livre", 5, 27.5),
      serie("b", "levantamento-terra", 5, 45),
    ];
    expect(uma("carga-20", { sessoes, series }).em).toBe(dia(0));
    expect(uma("carga-40", { sessoes, series }).em).toBe(dia(3));
    const sessenta = uma("carga-60", { sessoes, series });
    expect(sessenta.atingida).toBe(false);
    expect(sessenta.atual).toBe(45);
    expect(sessenta.falta).toBe("faltam 15 kg");
  });

  it("60 kg no terra fecham na data da série que aguentou o peso", () => {
    const series = [
      serie("a", "levantamento-terra", 5, 45),
      serie("b", "levantamento-terra", 3, 60),
    ];
    const sessenta = uma("carga-60", { sessoes, series });
    expect(sessenta.atingida).toBe(true);
    expect(sessenta.em).toBe(dia(3));
    expect(sessenta.atual).toBe(60);
  });

  it("supino pesado não fecha a conquista de agachamento ou terra", () => {
    const series = [serie("a", "supino-reto-com-barra", 5, 60)];
    expect(uma("carga-20", { sessoes, series }).atingida).toBe(false);
  });

  it("aquecimento não vale carga", () => {
    const series = [
      serie("a", "agachamento-livre", 5, 60, { tipo: "aquecimento" }),
    ];
    expect(uma("carga-20", { sessoes, series }).atingida).toBe(false);
  });

  it("10.000 kg de volume acumulado fecham na série que passou do alvo", () => {
    const series = Array.from({ length: 50 }, (_, i) =>
      serie(i < 25 ? "a" : "b", "agachamento-livre", 5, 40),
    );
    /* 50 × 5 × 40 = 10.000 kg, a metade em cada sessão */
    const dez = uma("volume-10k", { sessoes, series });
    expect(dez.atingida).toBe(true);
    expect(dez.em).toBe(dia(3));
    expect(dez.atual).toBe(10000);

    const cinquenta = uma("volume-50k", { sessoes, series });
    expect(cinquenta.atingida).toBe(false);
    expect(cinquenta.falta).toBe("faltam 40.000 kg");
  });

  it("50.000 kg fecham na série que passou do alvo", () => {
    /* 250 × 5 × 40 = 50.000 kg; a 125ª série ainda está na sessão do dia 0 */
    const series = Array.from({ length: 250 }, (_, i) =>
      serie(i < 125 ? "a" : "b", "agachamento-livre", 5, 40),
    );
    const cinquenta = uma("volume-50k", { sessoes, series });
    expect(cinquenta.atingida).toBe(true);
    expect(cinquenta.em).toBe(dia(3));
    expect(cinquenta.atual).toBe(50000);
  });

  it("série não concluída não soma volume", () => {
    const series = [serie("a", "agachamento-livre", 5, 40, { concluida: false })];
    expect(uma("volume-10k", { sessoes, series }).atual).toBe(0);
  });
});

/* ------------------------------------------------------------ programa */

describe("Fase 2 (SPEC §19.3)", () => {
  it("fecha com a data da troca e não fecha na Fase 1", () => {
    const fechou = uma("fase-2", { fase: { atual: "fase2", desde: "2026-04-06" } });
    expect(fechou.atingida).toBe(true);
    expect(fechou.em).toBe("2026-04-06");
    const naoFechou = uma("fase-2");
    expect(naoFechou.atingida).toBe(false);
    expect(naoFechou.falta).toBe("ainda na Fase 1");
  });
});

/* -------------------------------------------------------- o que falta */

describe("o texto do que falta (SPEC §19.4)", () => {
  it("usa singular e plural e vírgula decimal", () => {
    expect(textoDoQueFalta(25, 12, "treinos")).toBe("faltam 13 treinos");
    expect(textoDoQueFalta(3, 2, "dias")).toBe("falta 1 dia");
    expect(textoDoQueFalta(5, 3.2, "km")).toBe("faltam 1,8 km");
    expect(textoDoQueFalta(60, 45, "kg")).toBe("faltam 15 kg");
    expect(textoDoQueFalta(10, 10, "reps")).toBeNull();
  });

  it("arredonda para cima o que é contado em unidades inteiras", () => {
    expect(textoDoQueFalta(20, 2.5, "minutos")).toBe("faltam 18 minutos");
  });
});

/* -------------------------------------------------- o aviso (SPEC §19.5) */

describe("conquistas vistas e o aviso", () => {
  it("lê a lista das prefs sem confiar no formato", () => {
    expect(conquistasVistasDasPrefs(null)).toEqual([]);
    expect(conquistasVistasDasPrefs({ [CHAVE_VISTAS]: "forca-1" })).toEqual([]);
    expect(conquistasVistasDasPrefs({ [CHAVE_VISTAS]: ["forca-1", 7] })).toEqual([
      "forca-1",
    ]);
  });

  it("marcar como vista não perde as outras chaves nem repete ids", () => {
    const prefs = comConquistasVistas({ tema: "escuro" }, ["forca-1"]);
    expect(prefs.tema).toBe("escuro");
    const dobrado = comConquistasVistas(prefs, ["forca-1", "dias-3"]);
    expect(dobrado[CHAVE_VISTAS]).toEqual(["forca-1", "dias-3"]);
  });

  it("as novas são as atingidas fora da lista, as mais recentes primeiro", () => {
    const lista = avaliarConquistas({
      ...BASE,
      sessoes: [sessao("a", dia(0)), sessao("b", dia(1)), sessao("c", dia(2))],
    });
    /* três sessões em três dias da mesma semana fecham três conquistas */
    const novas = conquistasNovas(lista, []);
    expect(novas.map((c) => c.id)).toEqual(["dias-3", "semana-completa", "forca-1"]);
    expect(conquistasNovas(lista, ["dias-3", "semana-completa"]).map((c) => c.id)).toEqual([
      "forca-1",
    ]);
    expect(conquistasNovas(lista, ["dias-3", "semana-completa", "forca-1"])).toEqual([]);
  });
});
