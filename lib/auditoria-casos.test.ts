/**
 * AUDITORIA ADVERSARIAL DO MOTOR — lente "casos" (rodada 2).
 *
 * Testes escritos direto de docs/casos-de-teste-progressao.md e de SPEC.md
 * §5–§6, sem reaproveitar nada de lib/progressao.test.ts, lib/montagem.test.ts
 * nem das auditorias anteriores. Cada um dos 22 casos e cada linha da tabela
 * "Cargas alcançáveis" tem teste próprio, comparando valor a valor: carga,
 * falhas, incremento, flags, motivo do evento, avisos e sugestões.
 *
 * Só usa a API pública de lib/progressao.ts e lib/montagem.ts com os
 * exercícios reais de data/exercicios.json.
 */
import { describe, expect, it } from "vitest";

import { acharExercicio } from "@/lib/dados";
import {
  PESO_BARRA_A_PESAR,
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

/* ------------------------------------------------------------- ferramentas */

const E = (id: string) => acharExercicio(id);

/** Estado do exercício: o inicial do JSON com os campos do caso por cima. */
function st(id: string, campos: Partial<EstadoExercicio> = {}): EstadoExercicio {
  return { ...estadoInicial(E(id)), ...campos };
}

/** n séries de reps, todas concluídas. */
const reps = (...v: number[]): SerieFeita[] =>
  v.map((r) => ({ concluida: true, reps: r }));

/** séries unilaterais: [lado direito, lado esquerdo]. */
const lados = (...v: [number, number][]): SerieFeita[] =>
  v.map(([d, e]) => ({ concluida: true, reps: d, reps_lado2: e }));

const segundos = (...v: number[]): SerieFeita[] =>
  v.map((t) => ({ concluida: true, tempo_s: t }));

const passos = (...v: number[]): SerieFeita[] =>
  v.map((p) => ({ concluida: true, passos: p }));

/** A escala teórica do doc: base + 2 × S para S de 0 até `maxS`. */
function escalaEsperada(base: number, maxS: number, fator = 2): number[] {
  return Array.from({ length: maxS + 1 }, (_, s) =>
    Math.round((base + fator * s) * 100) / 100,
  );
}

/* ========================================================================= */
/* TABELA "Cargas alcançáveis (montagem)"                                    */
/* ========================================================================= */

describe("doc, tabela de cargas — linha 1: barra maciça", () => {
  it("fórmula: 7,5 + 2 × S, S soma inteira com no máximo 2 de cada peso por lado (S de 0 a 50)", () => {
    expect(cargasPossiveis("barra_macica")).toEqual(escalaEsperada(7.5, 50));
    expect(cargaMinima("barra_macica")).toBe(7.5);
    expect(cargaMaxima("barra_macica")).toBe(107.5);
  });

  it("exemplos válidos: 7,5 · 9,5 · 11,5 · 25,5 · 107,5 fecham exatos", () => {
    for (const kg of [7.5, 9.5, 11.5, 25.5, 107.5]) {
      const m = montagem(kg, "barra_macica");
      expect(m.exato, `${kg} kg deveria ser exato`).toBe(true);
      expect(m.total).toBe(kg);
      expect(m.diferenca).toBeUndefined();
    }
  });

  it("25,5 = 5·4 por lado e 107,5 = 10·10·5·5·4·4·3·3·2·2·1·1 por lado", () => {
    expect(montagem(25.5, "barra_macica").porLado).toEqual([5, 4]);
    expect(montagem(107.5, "barra_macica").porLado).toEqual([
      10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1,
    ]);
  });

  it("inválidos: 26,5 → 25,5 · 8 → 7,5 · 110 → 107,5", () => {
    expect(alcancavelParaBaixo(26.5, "barra_macica")).toBe(25.5);
    expect(alcancavelParaBaixo(8, "barra_macica")).toBe(7.5);
    expect(alcancavelParaBaixo(110, "barra_macica")).toBe(107.5);
  });

  it("nenhuma montagem da barra usa mais de 2 anilhas do mesmo peso por lado", () => {
    for (const kg of cargasPossiveis("barra_macica")) {
      const contagem = new Map<number, number>();
      for (const a of montagem(kg, "barra_macica").anilhas) {
        contagem.set(a, (contagem.get(a) ?? 0) + 1);
      }
      for (const [peso, n] of contagem) {
        expect(n, `${kg} kg usa ${n} anilhas de ${peso} kg num lado`).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("doc, tabela de cargas — linha 2: halteres (par)", () => {
  it("fórmula: 1,5 + 2 × S por halter, 1 de cada peso por ponta, capacidade 40 kg", () => {
    // S de 0 a 19: 1,5 + 2 × 19 = 39,5 é o último que cabe nos 40 kg da barra.
    expect(cargasPossiveis("halteres")).toEqual(escalaEsperada(1.5, 19));
    expect(cargaMinima("halteres")).toBe(1.5);
    expect(cargaMaxima("halteres")).toBe(39.5);
  });

  it("exemplos válidos com as anilhas do doc: 1,5 · 3,5 (1) · 5,5 (2) · 11,5 (5) · 21,5 (10) · 39,5 (10·5·4)", () => {
    const esperado: [number, number[]][] = [
      [1.5, []],
      [3.5, [1]],
      [5.5, [2]],
      [11.5, [5]],
      [21.5, [10]],
      [39.5, [10, 5, 4]],
    ];
    for (const [kg, ponta] of esperado) {
      const m = montagem(kg, "halteres");
      expect(m.exato, `${kg} kg por halter deveria ser exato`).toBe(true);
      expect(m.total).toBe(kg);
      expect(m.porPonta, `${kg} kg`).toEqual(ponta);
    }
  });

  it("inválidos: 4,5 → 3,5 · 6 → 5,5 · 41,5 → 39,5", () => {
    expect(alcancavelParaBaixo(4.5, "halteres")).toBe(3.5);
    expect(alcancavelParaBaixo(6, "halteres")).toBe(5.5);
    expect(alcancavelParaBaixo(41.5, "halteres")).toBe(39.5);
  });

  it("os dois halteres saem do mesmo estoque: nenhum peso se repete numa ponta", () => {
    for (const kg of cargasPossiveis("halteres")) {
      const ponta = montagem(kg, "halteres").anilhas;
      expect(new Set(ponta).size, `${kg} kg repete anilha na ponta`).toBe(ponta.length);
    }
  });
});

describe("doc, tabela de cargas — linha 3: polia (pino)", () => {
  it("S = qualquer soma do estoque, capacidade 100 → todo inteiro de 0 a 100", () => {
    expect(cargasPossiveis("polia")).toEqual(
      Array.from({ length: 101 }, (_, i) => i),
    );
    expect(cargaMinima("polia")).toBe(0);
    expect(cargaMaxima("polia")).toBe(100);
  });

  it("exemplos válidos: 1 · 2 · 4 · 6 · 9 · 20", () => {
    for (const kg of [1, 2, 4, 6, 9, 20]) {
      const m = montagem(kg, "polia");
      expect(m.exato, `${kg} kg no pino deveria ser exato`).toBe(true);
      expect(m.total).toBe(kg);
      expect(m.noPino?.reduce((s, v) => s + v, 0)).toBe(kg);
    }
  });

  it("inválidos: 0,5 → 0 · 101 → 100", () => {
    expect(alcancavelParaBaixo(0.5, "polia")).toBe(0);
    expect(alcancavelParaBaixo(101, "polia")).toBe(100);
    const m = montagem(0.5, "polia");
    expect(m.total).toBe(0);
    expect(m.exato).toBe(false);
    expect(m.diferenca).toBe(-0.5);
  });
});

describe("doc, tabela de cargas — linha 4: barra W", () => {
  it("2,0 (a pesar) + 2 × S, capacidade 50 → 52 → 50", () => {
    expect(PESO_BARRA_A_PESAR).toBe(2);
    expect(cargaMinima("barra_w")).toBe(2);
    expect(cargaMaxima("barra_w")).toBe(50);
    expect(cargasPossiveis("barra_w")).toEqual(escalaEsperada(2, 24));
    expect(alcancavelParaBaixo(52, "barra_w")).toBe(50);
    expect(montagem(52, "barra_w").total).toBe(50);
  });

  it("depois de pesada, a escala anda junto com o peso real da barra", () => {
    const opcoes = { pesoBarra: 6.4 };
    expect(cargaMinima("barra_w", opcoes)).toBe(6.4);
    expect(alcancavelParaBaixo(10, "barra_w", opcoes)).toBe(8.4);
  });
});

describe("doc, exemplos literais de montagem()", () => {
  it('montagem(25.5, "barra_macica") → { porLado: [5, 4], total: 25.5, exato: true }', () => {
    const m = montagem(25.5, "barra_macica");
    expect(m.porLado).toEqual([5, 4]);
    expect(m.total).toBe(25.5);
    expect(m.exato).toBe(true);
  });

  it('montagem(26.5, "barra_macica") → { porLado: [5, 4], total: 25.5, exato: false, diferenca: -1 }', () => {
    const m = montagem(26.5, "barra_macica");
    expect(m.porLado).toEqual([5, 4]);
    expect(m.total).toBe(25.5);
    expect(m.exato).toBe(false);
    expect(m.diferenca).toBe(-1);
  });

  it('montagem(5.5, "halteres") → { porPonta: [2], total: 5.5, exato: true }', () => {
    const m = montagem(5.5, "halteres");
    expect(m.porPonta).toEqual([2]);
    expect(m.total).toBe(5.5);
    expect(m.exato).toBe(true);
  });

  it('montagem(109.5, "barra_macica") → 107,5 com aviso "faltam anilhas de 10 kg"', () => {
    const m = montagem(109.5, "barra_macica");
    expect(m.total).toBe(107.5);
    expect(m.exato).toBe(false);
    expect(m.aviso).toBe("faltam anilhas de 10 kg");
  });
});

/* ========================================================================= */
/* As prescrições que o doc cita entre parênteses têm que bater com o JSON    */
/* ========================================================================= */

describe("doc, coluna 'Exercício (faixa)' × data/exercicios.json", () => {
  const esperado: [string, string, number, string, number | null, number | null][] = [
    ["supino-reto-com-barra", "Supino reto com barra", 3, "reps", 5, 8],
    ["agachamento-livre", "Agachamento livre", 3, "reps", 5, 5],
    ["levantamento-terra", "Levantamento terra", 3, "reps", 5, 5],
    ["rosca-alternada", "Rosca alternada", 3, "reps", 10, 12],
    ["puxada-alta-na-polia", "Puxada alta na polia", 3, "reps", 10, 12],
    ["barra-fixa-assistida", "Barra fixa assistida", 4, "reps", 5, 8],
    ["barra-fixa-pronada", "Barra fixa pronada", 3, "maximo", null, null],
    ["prancha", "Prancha", 3, "tempo_s", 30, 60],
    ["elevacao-de-pernas-na-barra-fixa", "Elevação de pernas na barra fixa", 3, "reps", 10, 15],
    ["agachamento-bulgaro", "Agachamento búlgaro", 3, "reps", 8, 10],
    ["farmer-s-walk", "Farmer's walk", 3, "passos", 30, 40],
    ["supino-inclinado-com-halteres", "Supino inclinado com halteres", 3, "reps", 8, 12],
  ];

  it.each(esperado)("%s → %s: %i séries, tipo %s, faixa %s–%s", (id, nome, series, tipo, min, max) => {
    const p = E(id).prescricao_padrao;
    expect(E(id).nome).toBe(nome);
    expect(p.series).toBe(series);
    expect(p.tipo).toBe(tipo);
    expect(p.min).toBe(min);
    expect(p.max).toBe(max);
  });

  it("unilaterais do doc: rosca alternada e agachamento búlgaro", () => {
    expect(E("rosca-alternada").prescricao_padrao.unilateral).toBe(true);
    expect(E("agachamento-bulgaro").prescricao_padrao.unilateral).toBe(true);
    expect(E("supino-reto-com-barra").prescricao_padrao.unilateral).toBe(false);
  });

  it("incrementos que os casos citam: 2 kg no supino, 4 kg no agachamento e no terra", () => {
    expect(E("supino-reto-com-barra").progressao.incremento_kg).toBe(2);
    expect(E("agachamento-livre").progressao.incremento_kg).toBe(4);
    expect(E("levantamento-terra").progressao.incremento_kg).toBe(4);
  });
});

/* ========================================================================= */
/* CASOS 1 A 22                                                              */
/* ========================================================================= */

describe("caso 1 — supino reto (3 × 5–8), 1ª sessão sem estado, 8/8/8 firme", () => {
  it("a carga de hoje da 1ª vez é 7,5 kg (barra vazia) e o alvo é a faixa 5–8", () => {
    const hoje = cargaDeHoje(E("supino-reto-com-barra"), null);
    expect(hoje.carga_kg).toBe(7.5);
    expect(hoje.alvo_min).toBe(5);
    expect(hoje.alvo_max).toBe(8);
    expect(hoje.primeira_vez).toBe(true);
  });

  it("subiu: carga 9,5; falhas 0", () => {
    const d = decidir(E("supino-reto-com-barra"), null, reps(8, 8, 8), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(d.evento?.falha).toBeFalsy();
    expect(d.evento?.de).toEqual({ carga_kg: 7.5 });
    expect(d.evento?.para).toEqual({ carga_kg: 9.5 });
  });
});

describe("caso 2 — supino reto, carga 9,5; 8/8/7 firme", () => {
  it("repetiu: carga 9,5 (não chegou ao topo em todas), falhas não mudam", () => {
    const antes = st("supino-reto-com-barra", { carga_atual_kg: 9.5 });
    const d = decidir(E("supino-reto-com-barra"), antes, reps(8, 8, 7), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(d.evento?.falha).toBeFalsy();
  });
});

describe("caso 3 — supino reto, carga 9,5; 8/8/8 NÃO firme", () => {
  it("repetiu: carga 9,5", () => {
    const antes = st("supino-reto-com-barra", { carga_atual_kg: 9.5 });
    const d = decidir(E("supino-reto-com-barra"), antes, reps(8, 8, 8), {
      ultimaFirme: false,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 4 — supino reto, carga 25,5, falhas 0; 8/6/4", () => {
  it("falha nº 1 → repetiu, carga 25,5, falhas 1", () => {
    const antes = st("supino-reto-com-barra", {
      carga_atual_kg: 25.5,
      falhas_seguidas: 0,
    });
    const d = decidir(E("supino-reto-com-barra"), antes, reps(8, 6, 4));
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.carga_atual_kg).toBe(25.5);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(d.novoEstado.exigir_rep_extra).toBe(false);
  });
});

describe("caso 5 — supino reto, carga 25,5, falhas 1; 7/5/3", () => {
  const antes = st("supino-reto-com-barra", {
    carga_atual_kg: 25.5,
    falhas_seguidas: 1,
  });
  const d = decidir(E("supino-reto-com-barra"), antes, reps(7, 5, 3));

  it("falha nº 2 → falha_2x_voltou_10, carga alcançável ≤ 22,95 → 21,5, falhas 2", () => {
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(d.evento?.falha).toBe(true);
    expect(alcancavelParaBaixo(25.5 * 0.9, "barra_macica")).toBe(21.5);
    expect(d.novoEstado.carga_atual_kg).toBe(21.5);
    expect(d.novoEstado.falhas_seguidas).toBe(2);
  });

  it("incremento 2 ÷ 2 = 1 < passo mínimo 2 → mantém 2 kg e exige topo + 1 rep", () => {
    expect(d.novoEstado.incremento_reduzido).toBe(true);
    expect(incrementoDe(E("supino-reto-com-barra"), d.novoEstado)).toBe(2);
    expect(d.novoEstado.exigir_rep_extra).toBe(true);
    expect(cargaDeHoje(E("supino-reto-com-barra"), d.novoEstado).exigir_rep_extra).toBe(
      true,
    );
  });

  it("com a exigência ligada, 8/8/8 firme (topo da faixa) ainda não sobe", () => {
    const d2 = decidir(E("supino-reto-com-barra"), d.novoEstado, reps(8, 8, 8), {
      ultimaFirme: true,
    });
    expect(d2.evento?.motivo).toBe("repetiu");
    expect(d2.novoEstado.carga_atual_kg).toBe(21.5);
    expect(d2.novoEstado.exigir_rep_extra).toBe(true);
  });

  it("9/9/9 firme sobe +2 kg e limpa a exigência e a redução", () => {
    const d2 = decidir(E("supino-reto-com-barra"), d.novoEstado, reps(9, 9, 9), {
      ultimaFirme: true,
    });
    expect(d2.evento?.motivo).toBe("subiu");
    expect(d2.novoEstado.carga_atual_kg).toBe(23.5);
    expect(d2.novoEstado.exigir_rep_extra).toBe(false);
    expect(d2.novoEstado.incremento_reduzido).toBe(false);
    expect(d2.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 6 — agachamento livre (3 × 5), carga 39,5, falhas 1; 5/4/3", () => {
  const antes = st("agachamento-livre", {
    carga_atual_kg: 39.5,
    falhas_seguidas: 1,
  });
  const d = decidir(E("agachamento-livre"), antes, reps(5, 4, 3));

  it("falha nº 2 → carga alcançável ≤ 35,55 → 35,5; falhas 2", () => {
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(alcancavelParaBaixo(39.5 * 0.9, "barra_macica")).toBe(35.5);
    expect(d.novoEstado.carga_atual_kg).toBe(35.5);
    expect(d.novoEstado.falhas_seguidas).toBe(2);
  });

  it("incremento 4 → 2 kg até a próxima subida, SEM exigir rep extra", () => {
    expect(incrementoDe(E("agachamento-livre"), d.novoEstado)).toBe(2);
    expect(d.novoEstado.incremento_reduzido).toBe(true);
    expect(d.novoEstado.exigir_rep_extra).toBe(false);
  });
});

describe("caso 7 — agachamento livre, carga 35,5, falhas 2, incremento reduzido; 5/5/5 firme", () => {
  const antes = st("agachamento-livre", {
    carga_atual_kg: 35.5,
    falhas_seguidas: 2,
    incremento_reduzido: true,
  });
  const d = decidir(E("agachamento-livre"), antes, reps(5, 5, 5), {
    ultimaFirme: true,
  });

  it("subiu: 37,5 (com o incremento reduzido de 2 kg); falhas 0", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(37.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });

  it("o incremento volta a 4 kg depois da subida", () => {
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(E("agachamento-livre"), d.novoEstado)).toBe(4);
    expect(cargaDeHoje(E("agachamento-livre"), d.novoEstado).incremento_kg).toBe(4);
  });
});

describe("caso 8 — levantamento terra (3 × 5), carga 47,5, falhas 2; 4/3/3", () => {
  const antes = st("levantamento-terra", {
    carga_atual_kg: 47.5,
    falhas_seguidas: 2,
  });
  const d = decidir(E("levantamento-terra"), antes, reps(4, 3, 3));

  it("falha nº 3 → semana_leve_60, marca semana_leve, zera as falhas", () => {
    expect(d.evento?.motivo).toBe("semana_leve_60");
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.semana_leve).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });

  it("a próxima sessão pede a alcançável ≤ 28,5 → 27,5, com as mesmas séries", () => {
    expect(alcancavelParaBaixo(47.5 * 0.6, "barra_macica")).toBe(27.5);
    const hoje = cargaDeHoje(E("levantamento-terra"), d.novoEstado);
    expect(hoje.carga_kg).toBe(27.5);
    expect(hoje.semana_leve).toBe(true);
    expect(hoje.alvo_min).toBe(5);
    expect(hoje.alvo_max).toBe(5);
  });

  it("guarda a carga de antes da semana leve para poder voltar", () => {
    expect(d.novoEstado.carga_antes_leve).toBe(47.5);
  });
});

describe("caso 9 — levantamento terra, sessão da semana leve (27,5); 5/5/5", () => {
  const antes = st("levantamento-terra", {
    carga_atual_kg: 27.5,
    carga_antes_leve: 47.5,
    semana_leve: true,
    falhas_seguidas: 0,
  });
  const d = decidir(E("levantamento-terra"), antes, reps(5, 5, 5), {
    ultimaFirme: true,
  });

  it("fim da semana leve: volta a 47,5 (a carga de antes)", () => {
    expect(d.novoEstado.carga_atual_kg).toBe(47.5);
    expect(d.novoEstado.semana_leve).toBe(false);
    expect(d.novoEstado.carga_antes_leve).toBeNull();
  });

  it("motivo do evento: fim_semana_leve", () => {
    expect(d.evento?.motivo).toBe("fim_semana_leve");
  });

  it("incremento normal 4 kg de volta", () => {
    expect(incrementoDe(E("levantamento-terra"), d.novoEstado)).toBe(4);
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(cargaDeHoje(E("levantamento-terra"), d.novoEstado).carga_kg).toBe(47.5);
  });
});

describe("caso 10 — rosca alternada, halteres 1,5; 12/12, 12/12, 12/11", () => {
  it("vale o menor lado: a 3ª série é 11 < 12 → repetiu", () => {
    const antes = st("rosca-alternada", { carga_atual_kg: 1.5 });
    const d = decidir(
      E("rosca-alternada"),
      antes,
      lados([12, 12], [12, 12], [12, 11]),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(1.5);
    expect(d.evento?.falha).toBeFalsy();
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 11 — rosca alternada, halteres 1,5; 12/12 nas 3, firme", () => {
  it("subiu: 3,5 por halter (1 kg em cada ponta)", () => {
    const antes = st("rosca-alternada", { carga_atual_kg: 1.5 });
    const d = decidir(
      E("rosca-alternada"),
      antes,
      lados([12, 12], [12, 12], [12, 12]),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(3.5);
    expect(montagem(3.5, "halteres").porPonta).toEqual([1]);
  });
});

describe("caso 12 — puxada alta na polia (3 × 10–12), 1ª sessão; 12/12/12 firme", () => {
  it("a 1ª sessão começa com 4 kg no pino", () => {
    const hoje = cargaDeHoje(E("puxada-alta-na-polia"), null);
    expect(hoje.carga_kg).toBe(4);
    expect(hoje.montagem?.onde).toBe("noPino");
  });

  it("subiu: 6 kg", () => {
    const d = decidir(E("puxada-alta-na-polia"), null, reps(12, 12, 12), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(6);
  });
});

describe("caso 13 — barra fixa assistida (4 × 5–8), pe_inteiro; 8/8/8/8 firme", () => {
  const antes = st("barra-fixa-assistida", { assistencia: "pe_inteiro" });
  const d = decidir(E("barra-fixa-assistida"), antes, reps(8, 8, 8, 8), {
    ultimaFirme: true,
  });

  it("subiu: assistência pe_inteiro → joelho", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.assistencia).toBe("joelho");
    expect(d.evento?.de).toEqual({ assistencia: "pe_inteiro" });
    expect(d.evento?.para).toEqual({ assistencia: "joelho" });
  });

  it("a carga não muda", () => {
    expect(d.novoEstado.carga_atual_kg).toBe(antes.carga_atual_kg);
  });

  it("sessoes_de_graca = 2", () => {
    expect(d.novoEstado.sessoes_graca).toBe(2);
  });
});

describe("caso 14 — barra fixa assistida, joelho, 1ª sessão após mudar; 5/5/4/4", () => {
  const antes = st("barra-fixa-assistida", {
    assistencia: "joelho",
    sessoes_graca: 2,
    falhas_seguidas: 0,
  });
  const d = decidir(E("barra-fixa-assistida"), antes, reps(5, 5, 4, 4));

  it("dentro da graça: repetiu e NÃO conta falha", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBeFalsy();
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(d.novoEstado.assistencia).toBe("joelho");
  });

  it("a graça vale exatamente 2 sessões: na 3ª a queda volta a contar falha", () => {
    const s2 = decidir(E("barra-fixa-assistida"), d.novoEstado, reps(5, 5, 4, 4));
    expect(s2.novoEstado.sessoes_graca).toBe(0);
    expect(s2.evento?.falha).toBeFalsy();
    expect(s2.novoEstado.falhas_seguidas).toBe(0);

    const s3 = decidir(E("barra-fixa-assistida"), s2.novoEstado, reps(5, 5, 4, 4));
    expect(s3.evento?.falha).toBe(true);
    expect(s3.novoEstado.falhas_seguidas).toBe(1);
  });
});

describe("caso 15 — barra fixa pronada (3 × máximo), média anterior 4,0 (4,4,4); 5/5/5", () => {
  it("subiu: média +1 e nenhuma série abaixo da anterior", () => {
    const antes = st("barra-fixa-pronada", { reps_alvo: 4 });
    const d = decidir(E("barra-fixa-pronada"), antes, reps(5, 5, 5), {
      seriesAnteriores: [4, 4, 4],
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(5);
  });

  it("média ≥ +1 mas uma série abaixo da anterior → não sobe", () => {
    const antes = st("barra-fixa-pronada", { reps_alvo: 4 });
    const d = decidir(E("barra-fixa-pronada"), antes, reps(3, 6, 6), {
      seriesAnteriores: [4, 4, 4],
    });
    expect(d.evento?.motivo).not.toBe("subiu");
  });

  it("3 séries chegando a 10 sugerem a Barra fixa com lastro", () => {
    const antes = st("barra-fixa-pronada", { reps_alvo: 9 });
    const d = decidir(E("barra-fixa-pronada"), antes, reps(10, 10, 10), {
      seriesAnteriores: [9, 9, 9],
    });
    expect(d.evento?.sugestao ?? "").toMatch(/lastro/i);
  });
});

describe("caso 16 — prancha (3 × 30–60 s), tempo alvo 30; 60/60/60 firme", () => {
  const antes = st("prancha", { tempo_alvo_s: 30 });
  const d = decidir(E("prancha"), antes, segundos(60, 60, 60), { ultimaFirme: true });

  it("subiu: tempo alvo 65 s", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.tempo_alvo_s).toBe(65);
    expect(d.evento?.de).toEqual({ tempo_alvo_s: 30 });
    expect(d.evento?.para).toEqual({ tempo_alvo_s: 65 });
  });

  it("acima da faixa do plano: sugere variação", () => {
    expect(d.evento?.sugestao ?? "").toMatch(/varia/i);
  });

  it("na sessão seguinte o alvo a bater é 65 s em todas", () => {
    const hoje = cargaDeHoje(E("prancha"), d.novoEstado);
    expect(hoje.alvo_max).toBe(65);
    const ainda = decidir(E("prancha"), d.novoEstado, segundos(60, 60, 60), {
      ultimaFirme: true,
    });
    expect(ainda.evento?.motivo).toBe("repetiu");
    const sobe = decidir(E("prancha"), d.novoEstado, segundos(65, 65, 65), {
      ultimaFirme: true,
    });
    expect(sobe.novoEstado.tempo_alvo_s).toBe(70);
  });
});

describe("caso 17 — elevação de pernas na barra fixa (3 × 10–15), reps alvo 10; 15/15/15 firme", () => {
  const antes = st("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 10 });
  const d = decidir(E("elevacao-de-pernas-na-barra-fixa"), antes, reps(15, 15, 15), {
    ultimaFirme: true,
  });

  it("subiu: reps alvo 16", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(16);
  });

  it("todas ≥ 20 → sugere anilha de 2 kg e voltar ao piso (10)", () => {
    const comVinte = decidir(
      E("elevacao-de-pernas-na-barra-fixa"),
      st("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 19 }),
      reps(20, 20, 20),
      { ultimaFirme: true },
    );
    expect(comVinte.evento?.sugestao ?? "").toMatch(/2 kg/);
  });
});

describe("caso 18 — agachamento búlgaro (3 × 8–10 por perna), halteres 5,5", () => {
  it("10/10, 10/10, 10/9 → repetiu (vale o menor lado)", () => {
    const antes = st("agachamento-bulgaro", { carga_atual_kg: 5.5 });
    const d = decidir(
      E("agachamento-bulgaro"),
      antes,
      lados([10, 10], [10, 10], [10, 9]),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(5.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 19 — farmer's walk (3 × 30–40 passos), halteres 11,5", () => {
  it("40/40/40 firme → subiu: 13,5 por halter", () => {
    const antes = st("farmer-s-walk", { carga_atual_kg: 11.5 });
    const d = decidir(E("farmer-s-walk"), antes, passos(40, 40, 40), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(13.5);
  });
});

describe("caso 20 — sessão abandonada com 1 série registrada", () => {
  it("não avalia: estado inalterado, sem evento", () => {
    const antes = st("supino-reto-com-barra", {
      carga_atual_kg: 25.5,
      falhas_seguidas: 1,
    });
    const d = decidir(E("supino-reto-com-barra"), antes, reps(8), {
      sessaoAbandonada: true,
    });
    expect(d.evento).toBeNull();
    expect(d.novoEstado).toEqual(antes);
  });
});

describe("caso 21 — supino reto substituído no dia por supino inclinado com halteres", () => {
  it("o inclinado com halteres sobe (12/12/12 firme → 3,5 por halter)", () => {
    const antes = st("supino-inclinado-com-halteres", { carga_atual_kg: 1.5 });
    const d = decidir(E("supino-inclinado-com-halteres"), antes, reps(12, 12, 12), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(3.5);
  });

  it("o supino reto (original) não muda: sem séries, sem evento", () => {
    const original = st("supino-reto-com-barra", {
      carga_atual_kg: 25.5,
      falhas_seguidas: 1,
    });
    const d = decidir(E("supino-reto-com-barra"), original, []);
    expect(d.evento).toBeNull();
    expect(d.novoEstado).toEqual(original);
  });
});

describe("caso 22 — supino reto no teto do kit (107,5); 8/8/8 firme", () => {
  const antes = st("supino-reto-com-barra", { carga_atual_kg: 107.5 });
  const d = decidir(E("supino-reto-com-barra"), antes, reps(8, 8, 8), {
    ultimaFirme: true,
  });

  it("subida impossível → repetiu, carga 107,5", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(107.5);
  });

  it('aviso: "faltam anilhas de 10 kg (marco do guia)"', () => {
    expect(d.evento?.aviso).toBe("faltam anilhas de 10 kg (marco do guia)");
  });
});

/* ========================================================================= */
/* "Regras derivadas dos casos" (fim do doc)                                 */
/* ========================================================================= */

describe("doc, regras derivadas", () => {
  it("alcancavel_para_baixo é aplicado na subida, no −10 % e no 60 %", () => {
    // subida: 6 kg pedidos num pino que só tem inteiros
    expect(
      decidir(E("puxada-alta-na-polia"), st("puxada-alta-na-polia", { carga_atual_kg: 5 }), reps(12, 12, 12), {
        ultimaFirme: true,
      }).novoEstado.carga_atual_kg,
    ).toBe(7);
    // −10 %: 23,5 × 0,9 = 21,15 → 21,5 não cabe; a alcançável para baixo é 19,5
    const menos10 = decidir(
      E("supino-reto-com-barra"),
      st("supino-reto-com-barra", { carga_atual_kg: 23.5, falhas_seguidas: 1 }),
      reps(4, 4, 4),
    ).novoEstado.carga_atual_kg;
    expect(menos10).toBe(alcancavelParaBaixo(23.5 * 0.9, "barra_macica"));
    expect(cargasPossiveis("barra_macica")).toContain(menos10);
    // 60 %: qualquer carga cai na escala
    const leve = decidir(
      E("levantamento-terra"),
      st("levantamento-terra", { carga_atual_kg: 43.5, falhas_seguidas: 2 }),
      reps(1, 1, 1),
    ).novoEstado.carga_atual_kg;
    expect(leve).toBe(alcancavelParaBaixo(43.5 * 0.6, "barra_macica"));
    expect(cargasPossiveis("barra_macica")).toContain(leve);
  });

  it("incremento reduzido = max(incremento / 2, passo mínimo 2)", () => {
    const supino = st("supino-reto-com-barra", { incremento_reduzido: true });
    expect(incrementoDe(E("supino-reto-com-barra"), supino)).toBe(2);
    const agacha = st("agachamento-livre", { incremento_reduzido: true });
    expect(incrementoDe(E("agachamento-livre"), agacha)).toBe(2);
  });

  it("maximo: sucesso exige média ≥ anterior + 1 E nenhuma série menor que a correspondente", () => {
    const antes = st("barra-fixa-pronada", { reps_alvo: 5 });
    // média 6 ≥ 5 + 1 e nenhuma caiu → sobe
    expect(
      decidir(E("barra-fixa-pronada"), antes, reps(6, 6, 6), {
        seriesAnteriores: [5, 5, 5],
      }).evento?.motivo,
    ).toBe("subiu");
    // média 6 mas a 1ª caiu (4 < 5) → não sobe
    expect(
      decidir(E("barra-fixa-pronada"), antes, reps(4, 7, 7), {
        seriesAnteriores: [5, 5, 5],
      }).evento?.motivo,
    ).not.toBe("subiu");
    // média igual à anterior (sem o +1) → não sobe
    expect(
      decidir(E("barra-fixa-pronada"), antes, reps(5, 5, 5), {
        seriesAnteriores: [5, 5, 5],
      }).evento?.motivo,
    ).not.toBe("subiu");
  });

  it("unilateral: vale o menor dos dois lados em cada série", () => {
    const antes = st("rosca-alternada", { carga_atual_kg: 1.5 });
    // 12/9 na 2ª série: 9 < piso 10 → falha
    const d = decidir(
      E("rosca-alternada"),
      antes,
      lados([12, 12], [12, 9], [12, 12]),
      { ultimaFirme: true },
    );
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });
});

/* ========================================================================= */
/* Pressão adversarial: os mesmos casos levados às bordas que o doc implica   */
/* ========================================================================= */

describe("cabeçalho do doc — convenções de carga", () => {
  it("barra = total com a barra maciça de 7,5 kg", () => {
    expect(montagem(25.5, "barra_macica").pesoBarra).toBe(7.5);
  });
  it("halter = por halter com a barra de 1,5 kg", () => {
    expect(montagem(5.5, "halteres").pesoBarra).toBe(1.5);
  });
  it("polia = kg no pino (sem barra)", () => {
    expect(montagem(6, "polia").pesoBarra).toBe(0);
    expect(montagem(6, "polia").onde).toBe("noPino");
  });
});

describe("SPEC §3.2 — o aquecimento não conta para a progressão", () => {
  it("séries de aquecimento são descartadas antes de decidir", () => {
    const antes = st("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const d = decidir(
      E("supino-reto-com-barra"),
      antes,
      [
        { concluida: true, tipo: "aquecimento", reps: 5, carga_kg: 7.5 },
        { concluida: true, tipo: "aquecimento", reps: 5, carga_kg: 13.5 },
        ...reps(8, 8, 8),
      ],
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("uma sessão só de aquecimento não muda nada", () => {
    const antes = st("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const d = decidir(E("supino-reto-com-barra"), antes, [
      { concluida: true, tipo: "aquecimento", reps: 5 },
    ]);
    expect(d.evento).toBeNull();
    expect(d.novoEstado).toEqual(antes);
  });
});

describe("SPEC §6 — decidir é função pura", () => {
  it("não mexe no estado que recebeu e é determinística", () => {
    const antes = st("supino-reto-com-barra", {
      carga_atual_kg: 25.5,
      falhas_seguidas: 1,
    });
    const copia = structuredClone(antes);
    const a = decidir(E("supino-reto-com-barra"), antes, reps(7, 5, 3));
    const b = decidir(E("supino-reto-com-barra"), antes, reps(7, 5, 3));
    expect(antes).toEqual(copia);
    expect(a.novoEstado).toEqual(b.novoEstado);
    expect(a.evento).toEqual(b.evento);
  });

  it("não mexe nas séries que recebeu", () => {
    const series = reps(8, 8, 8);
    const copia = structuredClone(series);
    decidir(E("supino-reto-com-barra"), null, series, { ultimaFirme: true });
    expect(series).toEqual(copia);
  });
});

describe("caso 22, bordas do teto", () => {
  it("105,5 + 2 ainda cabe: sobe para 107,5 sem aviso", () => {
    const d = decidir(
      E("supino-reto-com-barra"),
      st("supino-reto-com-barra", { carga_atual_kg: 105.5 }),
      reps(8, 8, 8),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(107.5);
    expect(d.evento?.aviso).toBeUndefined();
  });

  it("halter no teto (39,5) não sobe e avisa por que", () => {
    const d = decidir(
      E("rosca-alternada"),
      st("rosca-alternada", { carga_atual_kg: 39.5 }),
      lados([12, 12], [12, 12], [12, 12]),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(39.5);
    expect(d.evento?.aviso).toBeTruthy();
  });

  it("polia no teto (100) não sobe", () => {
    const d = decidir(
      E("puxada-alta-na-polia"),
      st("puxada-alta-na-polia", { carga_atual_kg: 100 }),
      reps(12, 12, 12),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(100);
    expect(d.evento?.aviso).toBeTruthy();
  });
});

describe("casos 4→5→8→9 em sequência (a tabela de falhas inteira)", () => {
  it("1ª falha repete, 2ª tira 10 %, 3ª manda para a semana leve e depois volta", () => {
    const e = E("levantamento-terra");
    let estado = st("levantamento-terra", { carga_atual_kg: 47.5 });

    const f1 = decidir(e, estado, reps(4, 4, 4));
    expect(f1.evento?.motivo).toBe("repetiu");
    expect(f1.novoEstado.carga_atual_kg).toBe(47.5);
    expect(f1.novoEstado.falhas_seguidas).toBe(1);
    estado = f1.novoEstado;

    const f2 = decidir(e, estado, reps(4, 4, 4));
    expect(f2.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(f2.novoEstado.carga_atual_kg).toBe(
      alcancavelParaBaixo(47.5 * 0.9, "barra_macica"),
    );
    expect(f2.novoEstado.falhas_seguidas).toBe(2);
    estado = f2.novoEstado;
    const cargaAposMenos10 = estado.carga_atual_kg as number;

    const f3 = decidir(e, estado, reps(4, 4, 4));
    expect(f3.evento?.motivo).toBe("semana_leve_60");
    expect(f3.novoEstado.semana_leve).toBe(true);
    expect(f3.novoEstado.falhas_seguidas).toBe(0);
    expect(f3.novoEstado.carga_antes_leve).toBe(cargaAposMenos10);
    expect(cargaDeHoje(e, f3.novoEstado).carga_kg).toBe(
      alcancavelParaBaixo(cargaAposMenos10 * 0.6, "barra_macica"),
    );
    estado = f3.novoEstado;

    const leve = decidir(e, estado, reps(5, 5, 5), { ultimaFirme: true });
    expect(leve.novoEstado.carga_atual_kg).toBe(cargaAposMenos10);
    expect(leve.novoEstado.semana_leve).toBe(false);
    expect(incrementoDe(e, leve.novoEstado)).toBe(4);
  });
});

describe("SPEC §6.1 — a primeira vez guarda o piso da faixa", () => {
  it("prancha: tempo alvo inicial 30 s (piso), topo a bater 60 s", () => {
    const inicial = estadoInicial(E("prancha"));
    expect(inicial.tempo_alvo_s).toBe(30);
    const hoje = cargaDeHoje(E("prancha"), null);
    expect(hoje.tempo_alvo_s).toBe(30);
    expect(hoje.alvo_max).toBe(60);
  });

  it("elevação de pernas: reps alvo inicial 10 (piso), topo a bater 15", () => {
    const inicial = estadoInicial(E("elevacao-de-pernas-na-barra-fixa"));
    expect(inicial.reps_alvo).toBe(10);
    const hoje = cargaDeHoje(E("elevacao-de-pernas-na-barra-fixa"), null);
    expect(hoje.alvo_max).toBe(15);
  });

  it("barra fixa assistida: começa no degrau pe_inteiro", () => {
    expect(estadoInicial(E("barra-fixa-assistida")).assistencia).toBe("pe_inteiro");
  });
});

describe("SPEC §6.2 — série não concluída numa sessão concluída é falha", () => {
  it("3ª série sem marcar → falha nº 1", () => {
    const antes = st("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const d = decidir(E("supino-reto-com-barra"), antes, [
      { concluida: true, reps: 8 },
      { concluida: true, reps: 8 },
      { concluida: false, reps: 8 },
    ]);
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("série faltando (só 2 de 3 registradas) numa sessão concluída → falha", () => {
    const antes = st("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const d = decidir(E("supino-reto-com-barra"), antes, reps(8, 8));
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });
});

describe("casos 1–19 com a prescrição do treino (programa.json) no lugar da do catálogo", () => {
  it("Treino A1 pede supino 3 × 5: 5/5/5 firme sobe, 5/5/4 é falha", () => {
    const e = E("supino-reto-com-barra");
    const doTreino = { series: 3, tipo: "reps" as const, min: 5, max: 5, unilateral: false };
    const sobe = decidir(e, st("supino-reto-com-barra", { carga_atual_kg: 25.5 }), reps(5, 5, 5), {
      prescricao: doTreino,
      ultimaFirme: true,
    });
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.carga_atual_kg).toBe(27.5);

    const falha = decidir(e, st("supino-reto-com-barra", { carga_atual_kg: 25.5 }), reps(5, 5, 4), {
      prescricao: doTreino,
    });
    expect(falha.evento?.falha).toBe(true);
  });

  it("Treino SA pede 4 × 5–6 de supino: a 4ª série conta", () => {
    const e = E("supino-reto-com-barra");
    const doTreino = { series: 4, tipo: "reps" as const, min: 5, max: 6, unilateral: false };
    const d = decidir(e, st("supino-reto-com-barra", { carga_atual_kg: 25.5 }), reps(6, 6, 6), {
      prescricao: doTreino,
      ultimaFirme: true,
    });
    // falta a 4ª série prescrita → não pode subir
    expect(d.evento?.motivo).not.toBe("subiu");
  });
});

describe("varredura do catálogo: nenhuma decisão sai da escala do implemento", () => {
  const ids = [
    "supino-reto-com-barra",
    "agachamento-livre",
    "levantamento-terra",
    "rosca-alternada",
    "agachamento-bulgaro",
    "farmer-s-walk",
    "puxada-alta-na-polia",
    "rosca-com-barra-w",
    "triceps-testa",
    "barra-fixa-com-lastro",
    "abdominal-com-anilha",
    "russian-twist",
  ];

  it.each(ids)("%s: carga inicial e carga depois de subir estão na escala", (id) => {
    const e = E(id);
    const escala = cargasPossiveis(e.implemento);
    expect(escala, `${id}: carga inicial ${e.carga_inicial.kg} fora da escala`).toContain(
      e.carga_inicial.kg,
    );
    const p = e.prescricao_padrao;
    const topo = p.max ?? p.min ?? 1;
    const series: SerieFeita[] = Array.from({ length: p.series ?? 3 }, () =>
      p.tipo === "tempo_s"
        ? { concluida: true, tempo_s: topo, tempo_s_lado2: topo }
        : p.tipo === "passos"
          ? { concluida: true, passos: topo }
          : { concluida: true, reps: topo, reps_lado2: topo },
    );
    const d = decidir(e, null, series, { ultimaFirme: true });
    const nova = d.novoEstado.carga_atual_kg;
    if (nova !== null && e.progressao.tipo === "carga") {
      expect(escala, `${id}: ${nova} fora da escala`).toContain(nova);
    }
  });
});

describe("caso 20 literal — 'qualquer exercício', sessão abandonada com 1 série", () => {
  const cenarios: [string, SerieFeita[], Partial<EstadoExercicio>][] = [
    ["supino-reto-com-barra", reps(8), { carga_atual_kg: 25.5 }],
    ["prancha", segundos(60), { tempo_alvo_s: 30 }],
    ["barra-fixa-pronada", reps(8), { reps_alvo: 4 }],
    ["rosca-alternada", lados([12, 12]), { carga_atual_kg: 1.5 }],
    ["barra-fixa-assistida", reps(8), { assistencia: "joelho", sessoes_graca: 2 }],
    [
      "levantamento-terra",
      reps(5),
      { carga_atual_kg: 27.5, carga_antes_leve: 47.5, semana_leve: true },
    ],
  ];

  it.each(cenarios)("%s: estado inalterado, sem evento", (id, series, campos) => {
    const antes = st(id, campos);
    const d = decidir(E(id), antes, series, {
      sessaoAbandonada: true,
      seriesAnteriores: [4, 4, 4],
    });
    expect(d.evento).toBeNull();
    expect(d.novoEstado).toEqual(antes);
  });

  it("a sessão não avaliada não gasta sessão de graça (caso 13 × caso 20)", () => {
    const antes = st("barra-fixa-assistida", {
      assistencia: "joelho",
      sessoes_graca: 2,
    });
    const d = decidir(E("barra-fixa-assistida"), antes, reps(8), {
      sessaoAbandonada: true,
    });
    expect(d.novoEstado.sessoes_graca).toBe(2);
  });

  it("a semana leve sobrevive a uma sessão abandonada (caso 8 × caso 20)", () => {
    const antes = st("levantamento-terra", {
      carga_atual_kg: 27.5,
      carga_antes_leve: 47.5,
      semana_leve: true,
    });
    const d = decidir(E("levantamento-terra"), antes, reps(5), {
      sessaoAbandonada: true,
    });
    expect(d.novoEstado.semana_leve).toBe(true);
    expect(cargaDeHoje(E("levantamento-terra"), d.novoEstado).carga_kg).toBe(27.5);
  });
});

describe("caso 9 literal — a semana leve vem de 2 falhas, logo com o incremento reduzido ligado", () => {
  it("o estado da semana leve carrega incremento_reduzido e ele some no fim", () => {
    const antes = st("levantamento-terra", {
      carga_atual_kg: 27.5,
      carga_antes_leve: 47.5,
      semana_leve: true,
      incremento_reduzido: true,
    });
    expect(incrementoDe(E("levantamento-terra"), antes)).toBe(2);
    const d = decidir(E("levantamento-terra"), antes, reps(5, 5, 5), {
      ultimaFirme: true,
    });
    expect(d.novoEstado.carga_atual_kg).toBe(47.5);
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(E("levantamento-terra"), d.novoEstado)).toBe(4);
  });
});

describe("doc, assinatura decidir(exercicio, estado, seriesTrabalho) — sem contexto", () => {
  it("caso 1 com 3 argumentos: sobe para 9,5", () => {
    expect(
      decidir(E("supino-reto-com-barra"), null, reps(8, 8, 8)).novoEstado
        .carga_atual_kg,
    ).toBe(9.5);
  });
  it("caso 11 com 3 argumentos: sobe para 3,5 por halter", () => {
    expect(
      decidir(
        E("rosca-alternada"),
        st("rosca-alternada", { carga_atual_kg: 1.5 }),
        lados([12, 12], [12, 12], [12, 12]),
      ).novoEstado.carga_atual_kg,
    ).toBe(3.5);
  });
  it("caso 13 com 3 argumentos: pe_inteiro → joelho", () => {
    expect(
      decidir(E("barra-fixa-assistida"), st("barra-fixa-assistida"), reps(8, 8, 8, 8))
        .novoEstado.assistencia,
    ).toBe("joelho");
  });
  it("caso 16 com 3 argumentos: tempo alvo 65 s", () => {
    expect(
      decidir(E("prancha"), st("prancha", { tempo_alvo_s: 30 }), segundos(60, 60, 60))
        .novoEstado.tempo_alvo_s,
    ).toBe(65);
  });
  it("caso 19 com 3 argumentos: 13,5 por halter", () => {
    expect(
      decidir(
        E("farmer-s-walk"),
        st("farmer-s-walk", { carga_atual_kg: 11.5 }),
        passos(40, 40, 40),
      ).novoEstado.carga_atual_kg,
    ).toBe(13.5);
  });
});

describe("regra derivada — o −10 % e os 60 % caem na escala mesmo com a aritmética binária", () => {
  it("polia: para toda carga inteira de 0 a 100 o resultado é o piso exato", () => {
    for (let x = 0; x <= 100; x++) {
      expect(alcancavelParaBaixo(x * 0.9, "polia"), `90 % de ${x}`).toBe(
        Math.floor((x * 9) / 10),
      );
      expect(alcancavelParaBaixo(x * 0.6, "polia"), `60 % de ${x}`).toBe(
        Math.floor((x * 6) / 10),
      );
    }
  });

  it("barra maciça: para toda carga da escala o −10 % e os 60 % batem com a conta exata", () => {
    for (let s0 = 0; s0 <= 50; s0++) {
      const carga = 7.5 + 2 * s0;
      // 7,5 + 2 S ≤ 0,9 × (7,5 + 2 S0) → S ≤ (36 S0 − 15) / 40
      // 7,5 + 2 S ≤ 0,6 × (7,5 + 2 S0) → S ≤ (12 S0 − 30) / 20
      const s90 = Math.floor((36 * s0 - 15) / 40);
      const s60 = Math.floor((12 * s0 - 30) / 20);
      expect(alcancavelParaBaixo(carga * 0.9, "barra_macica"), `90 % de ${carga}`).toBe(
        7.5 + 2 * Math.max(s90, 0),
      );
      expect(alcancavelParaBaixo(carga * 0.6, "barra_macica"), `60 % de ${carga}`).toBe(
        7.5 + 2 * Math.max(s60, 0),
      );
    }
  });

  it("halteres: idem para toda carga por halter da escala", () => {
    for (let s0 = 0; s0 <= 19; s0++) {
      const carga = 1.5 + 2 * s0;
      // 1,5 + 2 S ≤ 0,9 × (1,5 + 2 S0) → S ≤ (36 S0 − 3) / 40
      // 1,5 + 2 S ≤ 0,6 × (1,5 + 2 S0) → S ≤ (24 S0 − 12) / 40
      const s90 = Math.floor((36 * s0 - 3) / 40);
      const s60 = Math.floor((24 * s0 - 12) / 40);
      expect(alcancavelParaBaixo(carga * 0.9, "halteres"), `90 % de ${carga}`).toBe(
        1.5 + 2 * Math.max(s90, 0),
      );
      expect(alcancavelParaBaixo(carga * 0.6, "halteres"), `60 % de ${carga}`).toBe(
        1.5 + 2 * Math.max(s60, 0),
      );
    }
  });
});

describe("simulação longa: 40 sessões perfeitas de supino nunca saem da escala", () => {
  it("sobe de 2 em 2 até 107,5 e para lá, sempre com carga montável", () => {
    let estado = st("supino-reto-com-barra");
    const vistas: number[] = [];
    for (let i = 0; i < 60; i++) {
      const d = decidir(E("supino-reto-com-barra"), estado, reps(8, 8, 8), {
        ultimaFirme: true,
      });
      estado = d.novoEstado;
      const kg = estado.carga_atual_kg as number;
      vistas.push(kg);
      expect(montagem(kg, "barra_macica").exato, `${kg} kg não é montável`).toBe(true);
    }
    expect(vistas[0]).toBe(9.5);
    expect(vistas[vistas.length - 1]).toBe(107.5);
    expect(Math.max(...vistas)).toBe(107.5);
  });
});
