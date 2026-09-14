/**
 * AUDITORIA ADVERSARIAL — lente "casos".
 *
 * Testes independentes, escritos direto de docs/casos-de-teste-progressao.md
 * e de SPEC.md §5–§6, sem reaproveitar nada de lib/progressao.test.ts nem de
 * lib/montagem.test.ts. Cada caso do doc (1–22) e cada linha da tabela de
 * cargas alcançáveis tem o seu próprio teste, comparando valor a valor.
 */
import { describe, expect, it } from "vitest";

import { acharExercicio } from "@/lib/dados";
import {
  alcancavelParaBaixo,
  cargaMaxima,
  cargaMinima,
  cargasPossiveis,
  montagem,
} from "@/lib/montagem";
import {
  cargaDeHoje,
  decidir,
  estadoInicial,
  incrementoDe,
  type EstadoExercicio,
  type SerieFeita,
} from "@/lib/progressao";

/* ------------------------------------------------------------- helpers */

const ex = (id: string) => acharExercicio(id);

/** Estado do exercício com os campos que o caso descreve por cima do inicial. */
function estado(id: string, campos: Partial<EstadoExercicio> = {}): EstadoExercicio {
  return { ...estadoInicial(ex(id)), ...campos };
}

/** Séries de reps simples, todas concluídas. */
const R = (...n: number[]): SerieFeita[] =>
  n.map((reps) => ({ concluida: true, reps }));

/** Séries unilaterais [direita, esquerda]. */
const UNI = (...pares: [number, number][]): SerieFeita[] =>
  pares.map(([d, e]) => ({ concluida: true, reps: d, reps_lado2: e }));

const TEMPO = (...s: number[]): SerieFeita[] =>
  s.map((tempo_s) => ({ concluida: true, tempo_s }));

const PASSOS = (...p: number[]): SerieFeita[] =>
  p.map((passos) => ({ concluida: true, passos }));

/* ===================================================================== */
/* Tabela "Cargas alcançáveis (montagem)"                                */
/* ===================================================================== */

describe("doc §Cargas alcançáveis — linha: barra maciça", () => {
  it("escala = 7,5 + 2 × S, S soma inteira com no máximo 2 de cada peso por lado", () => {
    const escala = cargasPossiveis("barra_macica");
    expect(escala[0]).toBe(7.5);
    expect(cargaMinima("barra_macica")).toBe(7.5);
    expect(cargaMaxima("barra_macica")).toBe(107.5);
    // passo de 2 kg em toda a escala
    for (let i = 1; i < escala.length; i++) {
      expect(escala[i]! - escala[i - 1]!).toBeCloseTo(2, 10);
    }
  });

  it("válidos: 7,5 · 9,5 · 11,5 · 25,5 · 107,5", () => {
    const escala = cargasPossiveis("barra_macica");
    for (const kg of [7.5, 9.5, 11.5, 25.5, 107.5]) {
      expect(escala).toContain(kg);
      expect(montagem(kg, "barra_macica").exato).toBe(true);
      expect(montagem(kg, "barra_macica").total).toBe(kg);
    }
  });

  it("inválidos: 26,5 → 25,5 · 8 → 7,5 · 110 → 107,5", () => {
    expect(alcancavelParaBaixo(26.5, "barra_macica")).toBe(25.5);
    expect(alcancavelParaBaixo(8, "barra_macica")).toBe(7.5);
    expect(alcancavelParaBaixo(110, "barra_macica")).toBe(107.5);
  });

  it("25,5 = 5·4 num lado e 107,5 = 10·10·5·5·4·4·3·3·2·2·1·1", () => {
    expect(montagem(25.5, "barra_macica").porLado).toEqual([5, 4]);
    expect(montagem(107.5, "barra_macica").porLado).toEqual([
      10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1,
    ]);
  });
});

describe("doc §Cargas alcançáveis — linha: halteres (par)", () => {
  it("escala por halter = 1,5 + 2 × S, 1 de cada peso por ponta, capacidade 40", () => {
    const escala = cargasPossiveis("halteres");
    expect(escala[0]).toBe(1.5);
    expect(cargaMaxima("halteres")).toBe(39.5);
    for (let i = 1; i < escala.length; i++) {
      expect(escala[i]! - escala[i - 1]!).toBeCloseTo(2, 10);
    }
  });

  it("válidos: 1,5 · 3,5 (1) · 5,5 (2) · 11,5 (5) · 21,5 (10) · 39,5 (10·5·4)", () => {
    expect(montagem(1.5, "halteres").porPonta).toEqual([]);
    expect(montagem(3.5, "halteres").porPonta).toEqual([1]);
    expect(montagem(5.5, "halteres").porPonta).toEqual([2]);
    expect(montagem(11.5, "halteres").porPonta).toEqual([5]);
    expect(montagem(21.5, "halteres").porPonta).toEqual([10]);
    expect(montagem(39.5, "halteres").porPonta).toEqual([10, 5, 4]);
    for (const kg of [1.5, 3.5, 5.5, 11.5, 21.5, 39.5]) {
      expect(montagem(kg, "halteres").exato).toBe(true);
    }
  });

  it("inválidos: 4,5 → 3,5 · 6 → 5,5 · 41,5 → 39,5", () => {
    expect(alcancavelParaBaixo(4.5, "halteres")).toBe(3.5);
    expect(alcancavelParaBaixo(6, "halteres")).toBe(5.5);
    expect(alcancavelParaBaixo(41.5, "halteres")).toBe(39.5);
  });

  it("nenhuma montagem de halter repete o mesmo peso na ponta (4 pontas, 4 anilhas)", () => {
    for (const kg of cargasPossiveis("halteres")) {
      const anilhas = montagem(kg, "halteres").porPonta ?? [];
      expect(new Set(anilhas).size).toBe(anilhas.length);
    }
  });
});

describe("doc §Cargas alcançáveis — linha: polia (pino)", () => {
  it("S = qualquer soma do estoque, capacidade 100", () => {
    expect(cargaMinima("polia")).toBe(0);
    expect(cargaMaxima("polia")).toBe(100);
  });

  it("válidos: 1 · 2 · 4 · 6 · 9 · 20", () => {
    for (const kg of [1, 2, 4, 6, 9, 20]) {
      const m = montagem(kg, "polia");
      expect(m.exato).toBe(true);
      expect(m.total).toBe(kg);
      expect((m.noPino ?? []).reduce((s, v) => s + v, 0)).toBe(kg);
    }
  });

  it("inválidos: 0,5 → 0 · 101 → 100", () => {
    expect(alcancavelParaBaixo(0.5, "polia")).toBe(0);
    expect(alcancavelParaBaixo(101, "polia")).toBe(100);
  });
});

describe("doc §Cargas alcançáveis — linha: barra W", () => {
  it("2,0 (a pesar) + 2 × S, capacidade 50; 52 → 50", () => {
    expect(cargaMinima("barra_w")).toBe(2);
    expect(cargaMaxima("barra_w")).toBe(50);
    expect(alcancavelParaBaixo(52, "barra_w")).toBe(50);
  });

  it("com a barra pesada o zero da escala acompanha", () => {
    expect(cargaMinima("barra_w", { pesoBarra: 6.5 })).toBe(6.5);
    expect(alcancavelParaBaixo(9, "barra_w", { pesoBarra: 6.5 })).toBe(8.5);
  });
});

describe("doc §Cargas alcançáveis — exemplos de montagem()", () => {
  it("montagem(25.5, barra_macica) → porLado [5,4], total 25,5, exato", () => {
    const m = montagem(25.5, "barra_macica");
    expect(m.porLado).toEqual([5, 4]);
    expect(m.total).toBe(25.5);
    expect(m.exato).toBe(true);
    expect(m.diferenca).toBeUndefined();
  });

  it("montagem(26.5, barra_macica) → porLado [5,4], total 25,5, exato false, diferenca -1", () => {
    const m = montagem(26.5, "barra_macica");
    expect(m.porLado).toEqual([5, 4]);
    expect(m.total).toBe(25.5);
    expect(m.exato).toBe(false);
    expect(m.diferenca).toBe(-1);
  });

  it("montagem(5.5, halteres) → porPonta [2], total 5,5, exato", () => {
    const m = montagem(5.5, "halteres");
    expect(m.porPonta).toEqual([2]);
    expect(m.total).toBe(5.5);
    expect(m.exato).toBe(true);
  });

  it("montagem(109.5, barra_macica) → 107,5 com aviso 'faltam anilhas de 10 kg'", () => {
    const m = montagem(109.5, "barra_macica");
    expect(m.total).toBe(107.5);
    expect(m.exato).toBe(false);
    expect(m.aviso).toBe("faltam anilhas de 10 kg");
  });
});

/* ===================================================================== */
/* Casos 1–22                                                            */
/* ===================================================================== */

describe("caso 1 — supino reto, 1ª sessão, 8/8/8 firme", () => {
  it("subiu: carga 9,5; falhas 0", () => {
    const d = decidir(ex("supino-reto-com-barra"), null, R(8, 8, 8), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(d.evento?.falha).toBeFalsy();
    // §6.1: a 1ª vez parte de carga_inicial.kg = 7,5
    expect(cargaDeHoje(ex("supino-reto-com-barra"), null).carga_kg).toBe(7.5);
  });
});

describe("caso 2 — supino reto 9,5; 8/8/7 firme", () => {
  it("repetiu: carga 9,5 (não chegou ao topo em todas)", () => {
    const antes = estado("supino-reto-com-barra", { carga_atual_kg: 9.5 });
    const d = decidir(ex("supino-reto-com-barra"), antes, R(8, 8, 7), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(d.evento?.falha).toBeFalsy();
  });
});

describe("caso 3 — supino reto 9,5; 8/8/8 NÃO firme", () => {
  it("repetiu: carga 9,5", () => {
    const antes = estado("supino-reto-com-barra", { carga_atual_kg: 9.5 });
    const d = decidir(ex("supino-reto-com-barra"), antes, R(8, 8, 8), {
      ultimaFirme: false,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 4 — supino reto 25,5, falhas 0; 8/6/4", () => {
  it("falha nº 1 → repetiu, carga 25,5, falhas 1", () => {
    const antes = estado("supino-reto-com-barra", {
      carga_atual_kg: 25.5,
      falhas_seguidas: 0,
    });
    const d = decidir(ex("supino-reto-com-barra"), antes, R(8, 6, 4));
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.carga_atual_kg).toBe(25.5);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
    expect(d.novoEstado.incremento_reduzido).toBe(false);
  });
});

describe("caso 5 — supino reto 25,5, falhas 1; 7/5/3", () => {
  it("falha nº 2 → falha_2x_voltou_10: 21,5; incremento fica 2; exige topo+1; falhas 2", () => {
    const antes = estado("supino-reto-com-barra", {
      carga_atual_kg: 25.5,
      falhas_seguidas: 1,
    });
    const d = decidir(ex("supino-reto-com-barra"), antes, R(7, 5, 3));
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(d.evento?.falha).toBe(true);
    // alcançável ≤ 25,5 × 0,9 = 22,95
    expect(alcancavelParaBaixo(25.5 * 0.9, "barra_macica")).toBe(21.5);
    expect(d.novoEstado.carga_atual_kg).toBe(21.5);
    expect(d.novoEstado.falhas_seguidas).toBe(2);
    expect(d.novoEstado.incremento_reduzido).toBe(true);
    expect(incrementoDe(ex("supino-reto-com-barra"), d.novoEstado)).toBe(2);
    expect(d.novoEstado.exigir_rep_extra).toBe(true);
  });

  it("com exigir_rep_extra, 8/8/8 firme NÃO sobe (precisa de 9/9/9)", () => {
    const antes = estado("supino-reto-com-barra", {
      carga_atual_kg: 21.5,
      falhas_seguidas: 2,
      incremento_reduzido: true,
      exigir_rep_extra: true,
    });
    const d = decidir(ex("supino-reto-com-barra"), antes, R(8, 8, 8), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(21.5);
  });

  it("com exigir_rep_extra, 9/9/9 firme sobe +2 e limpa a exigência", () => {
    const antes = estado("supino-reto-com-barra", {
      carga_atual_kg: 21.5,
      falhas_seguidas: 2,
      incremento_reduzido: true,
      exigir_rep_extra: true,
    });
    const d = decidir(ex("supino-reto-com-barra"), antes, R(9, 9, 9), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(23.5);
    expect(d.novoEstado.exigir_rep_extra).toBe(false);
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(ex("supino-reto-com-barra"), d.novoEstado)).toBe(2);
  });
});

describe("caso 6 — agachamento livre 39,5, falhas 1; 5/4/3", () => {
  it("falha nº 2 → 35,5; incremento 4 vira 2; falhas 2; sem rep extra", () => {
    const antes = estado("agachamento-livre", {
      carga_atual_kg: 39.5,
      falhas_seguidas: 1,
    });
    const d = decidir(ex("agachamento-livre"), antes, R(5, 4, 3));
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(alcancavelParaBaixo(39.5 * 0.9, "barra_macica")).toBe(35.5);
    expect(d.novoEstado.carga_atual_kg).toBe(35.5);
    expect(d.novoEstado.falhas_seguidas).toBe(2);
    expect(incrementoDe(ex("agachamento-livre"), d.novoEstado)).toBe(2);
    expect(d.novoEstado.exigir_rep_extra).toBe(false);
  });
});

describe("caso 7 — agachamento livre 35,5, falhas 2, incremento reduzido; 5/5/5 firme", () => {
  it("subiu: 37,5; falhas 0; incremento volta a 4", () => {
    const antes = estado("agachamento-livre", {
      carga_atual_kg: 35.5,
      falhas_seguidas: 2,
      incremento_reduzido: true,
      exigir_rep_extra: false,
    });
    const d = decidir(ex("agachamento-livre"), antes, R(5, 5, 5), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(37.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(ex("agachamento-livre"), d.novoEstado)).toBe(4);
  });
});

describe("caso 8 — levantamento terra 47,5, falhas 2; 4/3/3", () => {
  it("falha nº 3 → semana_leve_60: 27,5, semana_leve true, falhas 0", () => {
    const antes = estado("levantamento-terra", {
      carga_atual_kg: 47.5,
      falhas_seguidas: 2,
    });
    const d = decidir(ex("levantamento-terra"), antes, R(4, 3, 3));
    expect(d.evento?.motivo).toBe("semana_leve_60");
    expect(alcancavelParaBaixo(47.5 * 0.6, "barra_macica")).toBe(27.5);
    expect(d.novoEstado.semana_leve).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    // a próxima sessão é feita a 27,5
    expect(
      cargaDeHoje(ex("levantamento-terra"), d.novoEstado).carga_kg,
    ).toBe(27.5);
  });
});

describe("caso 9 — levantamento terra, sessão da semana leve a 27,5; 5/5/5", () => {
  it("fim_semana_leve: volta a 47,5 com incremento normal 4", () => {
    const antes = estado("levantamento-terra", {
      carga_atual_kg: 27.5,
      carga_antes_leve: 47.5,
      semana_leve: true,
      falhas_seguidas: 0,
    });
    const d = decidir(ex("levantamento-terra"), antes, R(5, 5, 5), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("fim_semana_leve");
    expect(d.novoEstado.carga_atual_kg).toBe(47.5);
    expect(d.novoEstado.semana_leve).toBe(false);
    expect(incrementoDe(ex("levantamento-terra"), d.novoEstado)).toBe(4);
  });
});

describe("caso 10 — rosca alternada 1,5; 12/12, 12/12, 12/11", () => {
  it("menor lado vale: repetiu", () => {
    const antes = estado("rosca-alternada", { carga_atual_kg: 1.5 });
    const d = decidir(
      ex("rosca-alternada"),
      antes,
      UNI([12, 12], [12, 12], [12, 11]),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(1.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 11 — rosca alternada 1,5; 12/12 nas 3, firme", () => {
  it("subiu: 3,5 por halter (1 kg em cada ponta)", () => {
    const antes = estado("rosca-alternada", { carga_atual_kg: 1.5 });
    const d = decidir(
      ex("rosca-alternada"),
      antes,
      UNI([12, 12], [12, 12], [12, 12]),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(3.5);
    expect(montagem(3.5, "halteres").porPonta).toEqual([1]);
  });
});

describe("caso 12 — puxada alta na polia, 1ª sessão; 12/12/12 firme", () => {
  it("carga de hoje 4 kg e subiu para 6 kg", () => {
    expect(cargaDeHoje(ex("puxada-alta-na-polia"), null).carga_kg).toBe(4);
    const d = decidir(ex("puxada-alta-na-polia"), null, R(12, 12, 12), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(6);
  });
});

describe("caso 13 — barra fixa assistida (4 × 5–8), pe_inteiro; 8/8/8/8 firme", () => {
  it("subiu: assistência → joelho; carga não muda; 2 sessões de graça", () => {
    const antes = estado("barra-fixa-assistida", { assistencia: "pe_inteiro" });
    const d = decidir(ex("barra-fixa-assistida"), antes, R(8, 8, 8, 8), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.assistencia).toBe("joelho");
    expect(d.novoEstado.carga_atual_kg).toBe(antes.carga_atual_kg);
    expect(d.novoEstado.sessoes_graca).toBe(2);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 14 — barra fixa assistida, joelho, 1ª sessão após mudar; 5/5/4/4", () => {
  it("dentro da graça: repetiu, sem contar falha", () => {
    const antes = estado("barra-fixa-assistida", {
      assistencia: "joelho",
      sessoes_graca: 2,
      falhas_seguidas: 0,
    });
    const d = decidir(ex("barra-fixa-assistida"), antes, R(5, 5, 4, 4));
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBeFalsy();
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(d.novoEstado.assistencia).toBe("joelho");
    expect(d.novoEstado.sessoes_graca).toBe(1);
  });

  it("a graça vale 2 sessões: na 3ª a queda volta a contar falha", () => {
    let e = estado("barra-fixa-assistida", {
      assistencia: "joelho",
      sessoes_graca: 2,
    });
    e = decidir(ex("barra-fixa-assistida"), e, R(4, 4, 4, 4)).novoEstado;
    expect(e.falhas_seguidas).toBe(0);
    e = decidir(ex("barra-fixa-assistida"), e, R(4, 4, 4, 4)).novoEstado;
    expect(e.falhas_seguidas).toBe(0);
    const d3 = decidir(ex("barra-fixa-assistida"), e, R(4, 4, 4, 4));
    expect(d3.evento?.falha).toBe(true);
    expect(d3.novoEstado.falhas_seguidas).toBe(1);
  });
});

describe("caso 15 — barra fixa pronada (3 × máximo), média anterior 4 (4,4,4); 5/5/5", () => {
  it("subiu: média +1 e nenhuma série abaixo", () => {
    const antes = estado("barra-fixa-pronada", { reps_alvo: 4 });
    const d = decidir(ex("barra-fixa-pronada"), antes, R(5, 5, 5), {
      seriesAnteriores: [4, 4, 4],
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(5);
  });

  it("média sobe mas uma série cai abaixo da anterior → não sobe", () => {
    const antes = estado("barra-fixa-pronada", { reps_alvo: 4 });
    const d = decidir(ex("barra-fixa-pronada"), antes, R(7, 5, 3), {
      seriesAnteriores: [4, 4, 4],
    });
    expect(d.evento?.motivo).not.toBe("subiu");
  });

  it("3 séries de 10 (subindo) sugerem a barra fixa com lastro", () => {
    const antes = estado("barra-fixa-pronada", { reps_alvo: 9 });
    const d = decidir(ex("barra-fixa-pronada"), antes, R(10, 10, 10), {
      seriesAnteriores: [9, 9, 9],
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.evento?.sugestao ?? "").toMatch(/lastro/i);
  });

  it("SPEC §6.3: 3 séries chegando a 10 sugerem lastro mesmo sem melhorar a média", () => {
    const antes = estado("barra-fixa-pronada", { reps_alvo: 10 });
    const d = decidir(ex("barra-fixa-pronada"), antes, R(10, 10, 10), {
      seriesAnteriores: [10, 10, 10],
    });
    expect(d.evento?.sugestao ?? "").toMatch(/lastro/i);
  });
});

describe("caso 16 — prancha (3 × 30–60 s), tempo alvo 30; 60/60/60 firme", () => {
  it("subiu: tempo alvo 65 s, com sugestão de variação (acima da faixa)", () => {
    const antes = estado("prancha", { tempo_alvo_s: 30 });
    const d = decidir(ex("prancha"), antes, TEMPO(60, 60, 60), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.tempo_alvo_s).toBe(65);
    expect(d.evento?.sugestao ?? "").toMatch(/varia/i);
  });

  it("depois de 65, só sobe de novo com 65 em todas", () => {
    const antes = estado("prancha", { tempo_alvo_s: 65 });
    expect(
      decidir(ex("prancha"), antes, TEMPO(60, 60, 60), { ultimaFirme: true })
        .evento?.motivo,
    ).toBe("repetiu");
    const d = decidir(ex("prancha"), antes, TEMPO(65, 65, 65), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.tempo_alvo_s).toBe(70);
  });

  it("SPEC §6.1: na 1ª vez o tempo alvo é o mínimo da faixa (30 s)", () => {
    expect(estadoInicial(ex("prancha")).tempo_alvo_s).toBe(30);
    expect(cargaDeHoje(ex("prancha"), null).tempo_alvo_s).toBe(30);
  });
});

describe("caso 17 — elevação de pernas (3 × 10–15), reps alvo 10; 15/15/15 firme", () => {
  it("subiu: reps alvo 16", () => {
    const antes = estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 10 });
    const d = decidir(ex("elevacao-de-pernas-na-barra-fixa"), antes, R(15, 15, 15), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(16);
  });

  it("todas ≥ 20 → sugere anilha de 2 kg e voltar ao piso", () => {
    const antes = estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 20 });
    const d = decidir(ex("elevacao-de-pernas-na-barra-fixa"), antes, R(20, 20, 20), {
      ultimaFirme: true,
    });
    expect(d.evento?.sugestao ?? "").toMatch(/anilha/i);
    expect(d.evento?.sugestao ?? "").toMatch(/2 kg/);
  });

  it("SPEC §6.3: acima de 20 reps em todas as séries sugere a anilha mesmo sem subir", () => {
    // alvo já em 22 reps: 21/21/21 fica acima de 20 em todas, mas não sobe
    const antes = estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 22 });
    const d = decidir(ex("elevacao-de-pernas-na-barra-fixa"), antes, R(21, 21, 21), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.sugestao ?? "").toMatch(/anilha/i);
  });
});

describe("caso 18 — agachamento búlgaro (3 × 8–10 por perna), halteres 5,5", () => {
  it("10/10, 10/10, 10/9 → repetiu (menor lado)", () => {
    const antes = estado("agachamento-bulgaro", { carga_atual_kg: 5.5 });
    const d = decidir(
      ex("agachamento-bulgaro"),
      antes,
      UNI([10, 10], [10, 10], [10, 9]),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(5.5);
  });
});

describe("caso 19 — farmer's walk (3 × 30–40 passos), halteres 11,5", () => {
  it("40/40/40 firme → subiu: 13,5 por halter", () => {
    const antes = estado("farmer-s-walk", { carga_atual_kg: 11.5 });
    const d = decidir(ex("farmer-s-walk"), antes, PASSOS(40, 40, 40), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(13.5);
  });

  it("29 passos numa série (abaixo do piso 30) conta falha", () => {
    const antes = estado("farmer-s-walk", { carga_atual_kg: 11.5 });
    const d = decidir(ex("farmer-s-walk"), antes, PASSOS(40, 40, 29));
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });
});

describe("caso 20 — sessão abandonada com 1 série registrada", () => {
  it("não avalia: estado inalterado, sem evento", () => {
    const antes = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const d = decidir(ex("supino-reto-com-barra"), antes, R(8), {
      sessaoAbandonada: true,
    });
    expect(d.evento).toBeNull();
    expect(d.novoEstado).toEqual(antes);
  });

  it("sessão abandonada com todas as séries registradas É avaliada (§6.3)", () => {
    const antes = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const d = decidir(ex("supino-reto-com-barra"), antes, R(8, 8, 8), {
      sessaoAbandonada: true,
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
  });
});

describe("caso 21 — substituição no dia", () => {
  it("o substituto (supino inclinado com halteres) sobe", () => {
    const antes = estado("supino-inclinado-com-halteres", { carga_atual_kg: 11.5 });
    const d = decidir(ex("supino-inclinado-com-halteres"), antes, R(12, 12, 12), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(13.5);
  });

  it("o original (supino reto) não é avaliado: sem séries, estado inalterado", () => {
    const antes = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const d = decidir(ex("supino-reto-com-barra"), antes, []);
    expect(d.evento).toBeNull();
    expect(d.novoEstado).toEqual(antes);
  });
});

describe("caso 22 — supino reto no teto do kit (107,5); 8/8/8 firme", () => {
  it("subida impossível → repetiu com aviso 'faltam anilhas de 10 kg (marco do guia)'", () => {
    const antes = estado("supino-reto-com-barra", { carga_atual_kg: 107.5 });
    const d = decidir(ex("supino-reto-com-barra"), antes, R(8, 8, 8), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(107.5);
    expect(d.evento?.aviso).toBe("faltam anilhas de 10 kg (marco do guia)");
  });
});

/* ===================================================================== */
/* Regras derivadas (fim do doc) e SPEC §6                               */
/* ===================================================================== */

describe("regras derivadas do doc", () => {
  it("alcancavelParaBaixo é aplicado na subida, no −10 % e no 60 %", () => {
    // subida: 7,5 + 2 cai na escala
    expect(
      decidir(ex("supino-reto-com-barra"), null, R(8, 8, 8)).novoEstado
        .carga_atual_kg,
    ).toBe(alcancavelParaBaixo(9.5, "barra_macica"));
    // −10 %
    const d2 = decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 47.5, falhas_seguidas: 1 }),
      R(1, 1, 1),
    );
    expect(d2.novoEstado.carga_atual_kg).toBe(
      alcancavelParaBaixo(47.5 * 0.9, "barra_macica"),
    );
    // 60 %
    const d3 = decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 47.5, falhas_seguidas: 2 }),
      R(1, 1, 1),
    );
    expect(
      cargaDeHoje(ex("supino-reto-com-barra"), d3.novoEstado).carga_kg,
    ).toBe(alcancavelParaBaixo(47.5 * 0.6, "barra_macica"));
  });

  it("incremento reduzido = max(incremento / 2, 2)", () => {
    const supino = estado("supino-reto-com-barra", { incremento_reduzido: true });
    expect(incrementoDe(ex("supino-reto-com-barra"), supino)).toBe(2);
    const agacha = estado("agachamento-livre", { incremento_reduzido: true });
    expect(incrementoDe(ex("agachamento-livre"), agacha)).toBe(2);
    const terra = estado("levantamento-terra", { incremento_reduzido: true });
    expect(incrementoDe(ex("levantamento-terra"), terra)).toBe(2);
  });

  it("série não concluída conta como falha (SPEC §6.2)", () => {
    const antes = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const series: SerieFeita[] = [
      { concluida: true, reps: 8 },
      { concluida: true, reps: 8 },
      { concluida: false, reps: null },
    ];
    const d = decidir(ex("supino-reto-com-barra"), antes, series);
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("SPEC §6.1: primeira vez usa carga_inicial.kg e o piso da faixa", () => {
    const supino = cargaDeHoje(ex("supino-reto-com-barra"), null);
    expect(supino.carga_kg).toBe(7.5);
    expect(supino.reps_alvo_min).toBe(5);
    const halter = cargaDeHoje(ex("rosca-alternada"), null);
    expect(halter.carga_kg).toBe(1.5);
    const corpo = cargaDeHoje(ex("elevacao-de-pernas-na-barra-fixa"), null);
    expect(corpo.carga_kg).toBe(0);
    expect(estadoInicial(ex("elevacao-de-pernas-na-barra-fixa")).reps_alvo).toBe(10);
  });

  it("SPEC §6.1: primeira vez no farmer's walk pede o piso de passos (30)", () => {
    expect(cargaDeHoje(ex("farmer-s-walk"), null).passos_alvo).toBe(30);
  });
});

describe("sondagens adicionais SPEC §6", () => {
  it("§6.2: só as séries de trabalho contam (aquecimento é descartado)", () => {
    const antes = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const series: SerieFeita[] = [
      { concluida: true, tipo: "aquecimento", reps: 3 },
      { concluida: true, tipo: "trabalho", reps: 8 },
      { concluida: true, tipo: "trabalho", reps: 8 },
      { concluida: true, tipo: "trabalho", reps: 8 },
    ];
    const d = decidir(ex("supino-reto-com-barra"), antes, series, {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("§6.2: 'manteve' não mexe em falhas_seguidas", () => {
    const antes = estado("supino-reto-com-barra", {
      carga_atual_kg: 25.5,
      falhas_seguidas: 1,
    });
    const d = decidir(ex("supino-reto-com-barra"), antes, R(8, 8, 7));
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("§6.2: incremento_kg do estado sobrepõe o do JSON", () => {
    const antes = estado("supino-reto-com-barra", {
      carga_atual_kg: 25.5,
      incremento_kg: 6,
    });
    expect(incrementoDe(ex("supino-reto-com-barra"), antes)).toBe(6);
    const d = decidir(ex("supino-reto-com-barra"), antes, R(8, 8, 8), {
      ultimaFirme: true,
    });
    expect(d.novoEstado.carga_atual_kg).toBe(31.5);
  });

  it("§6.6: o evento carrega de/para com a carga antes e depois", () => {
    const d = decidir(ex("supino-reto-com-barra"), null, R(8, 8, 8), {
      ultimaFirme: true,
    });
    expect(d.evento?.de).toEqual({ carga_kg: 7.5 });
    expect(d.evento?.para).toEqual({ carga_kg: 9.5 });
  });

  it("decidir não muta o estado recebido", () => {
    const antes = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const copia = { ...antes };
    decidir(ex("supino-reto-com-barra"), antes, R(8, 8, 8), { ultimaFirme: true });
    expect(antes).toEqual(copia);
  });

  it("§6.3: degraus da assistência vão até 'sem'", () => {
    let e = estado("barra-fixa-assistida", { assistencia: "joelho" });
    e = decidir(ex("barra-fixa-assistida"), e, R(8, 8, 8, 8), {
      ultimaFirme: true,
    }).novoEstado;
    expect(e.assistencia).toBe("joelho_dobrado");
    e = decidir(ex("barra-fixa-assistida"), e, R(8, 8, 8, 8), {
      ultimaFirme: true,
    }).novoEstado;
    expect(e.assistencia).toBe("sem");
  });

  it("§6.4: o aviso de 'faltam anilhas de 10 kg' é sobre as anilhas, não sobre a capacidade da barra W (52 → 50)", () => {
    const m = montagem(52, "barra_w");
    expect(m.total).toBe(50);
    expect(m.aviso).toBeUndefined();
  });

  it("§6.4: idem para o teto do halter (capacidade da barra = 40 kg)", () => {
    const m = montagem(41.5, "halteres");
    expect(m.total).toBe(39.5);
    expect(m.aviso).toBeUndefined();
  });

  it("§6.4: subida bloqueada pelo teto do halter não deve culpar as anilhas de 10 kg", () => {
    const antes = estado("rosca-alternada", { carga_atual_kg: 39.5 });
    const d = decidir(
      ex("rosca-alternada"),
      antes,
      UNI([12, 12], [12, 12], [12, 12]),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.aviso).not.toBe("faltam anilhas de 10 kg (marco do guia)");
  });
});

describe("doc §Cargas alcançáveis — o guloso resolve toda a escala", () => {
  it("barra: 1..50 kg de um lado, no máximo 2 de cada peso", () => {
    for (let s = 1; s <= 50; s++) {
      const m = montagem(7.5 + 2 * s, "barra_macica");
      expect(m.exato).toBe(true);
      expect(m.anilhas.reduce((a, b) => a + b, 0)).toBe(s);
      const contagem = new Map<number, number>();
      for (const a of m.anilhas) contagem.set(a, (contagem.get(a) ?? 0) + 1);
      for (const n of contagem.values()) expect(n).toBeLessThanOrEqual(2);
    }
  });

  it("halteres: 1..19 kg por ponta, no máximo 1 de cada peso", () => {
    for (let s = 1; s <= 19; s++) {
      const m = montagem(1.5 + 2 * s, "halteres");
      expect(m.exato).toBe(true);
      expect(m.anilhas.reduce((a, b) => a + b, 0)).toBe(s);
      expect(new Set(m.anilhas).size).toBe(m.anilhas.length);
    }
  });
});
