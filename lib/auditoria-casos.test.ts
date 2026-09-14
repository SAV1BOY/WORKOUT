/**
 * AUDITORIA ADVERSARIAL DO MOTOR — lente "casos" (rodada 3).
 *
 * Testes escritos a partir de docs/casos-de-teste-progressao.md (as 22 linhas
 * da tabela do motor, as 4 linhas da tabela de cargas alcançáveis, os exemplos
 * literais de `montagem(...)` e as "regras derivadas dos casos") e de SPEC.md
 * §6. Nada foi reaproveitado de lib/progressao.test.ts, lib/montagem.test.ts
 * nem das auditorias anteriores: cada caso tem teste próprio, comparando valor
 * a valor (carga, falhas, incremento, flags, motivo, aviso e sugestão) com a
 * API pública de lib/progressao.ts e lib/montagem.ts e os exercícios reais de
 * data/exercicios.json.
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
  PASSO_MINIMO_KG,
  cargaDeHoje,
  decidir,
  estadoInicial,
  incrementoDe,
  type EstadoExercicio,
  type SerieFeita,
} from "@/lib/progressao";

/* ------------------------------------------------------------ ferramentas */

const ex = (id: string) => acharExercicio(id);

/** Estado do exercício: o inicial do catálogo com os campos do caso por cima. */
function estado(id: string, campos: Partial<EstadoExercicio> = {}): EstadoExercicio {
  return { ...estadoInicial(ex(id)), ...campos };
}

/** Séries de repetições, todas concluídas. */
const reps = (...v: number[]): SerieFeita[] =>
  v.map((r) => ({ concluida: true, reps: r }));

/** Séries unilaterais [direito, esquerdo]. */
const doisLados = (...v: readonly (readonly [number, number])[]): SerieFeita[] =>
  v.map(([d, e]) => ({ concluida: true, reps: d, reps_lado2: e }));

/** Séries de tempo (prancha). */
const segundos = (...v: number[]): SerieFeita[] =>
  v.map((t) => ({ concluida: true, tempo_s: t }));

/** Séries de passos (farmer's walk). */
const passos = (...v: number[]): SerieFeita[] =>
  v.map((p) => ({ concluida: true, passos: p }));

/** Soma com o arredondamento de 2 casas que o módulo usa. */
const soma = (v: readonly number[]) =>
  Math.round(v.reduce((s, x) => s + x, 0) * 100) / 100;

/** Quantas vezes cada peso aparece na lista de anilhas. */
function contagem(anilhas: readonly number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const a of anilhas) m.set(a, (m.get(a) ?? 0) + 1);
  return m;
}

/* ========================================================================
 * TABELA "Cargas alcançáveis (montagem)" — doc, linhas 5–20
 * ===================================================================== */

describe("doc §Cargas alcançáveis — barra maciça (7,5 + 2 × S, máx. 2 de cada por lado)", () => {
  const escala = cargasPossiveis("barra_macica");

  it("a escala é exatamente 7,5 + 2 × S com S inteiro de 0 a 50", () => {
    const esperada = Array.from({ length: 51 }, (_, k) => 7.5 + 2 * k);
    expect(escala).toEqual(esperada);
  });

  it("exemplos válidos do doc estão na escala: 7,5 · 9,5 · 11,5 · 25,5 · 107,5", () => {
    for (const kg of [7.5, 9.5, 11.5, 25.5, 107.5]) {
      expect(escala).toContain(kg);
      expect(montagem(kg, "barra_macica").exato).toBe(true);
    }
  });

  it("inválidos do doc devolvem a alcançável para baixo: 26,5 → 25,5 · 8 → 7,5 · 110 → 107,5", () => {
    expect(alcancavelParaBaixo(26.5, "barra_macica")).toBe(25.5);
    expect(alcancavelParaBaixo(8, "barra_macica")).toBe(7.5);
    expect(alcancavelParaBaixo(110, "barra_macica")).toBe(107.5);
    expect(montagem(26.5, "barra_macica").total).toBe(25.5);
    expect(montagem(8, "barra_macica").total).toBe(7.5);
    expect(montagem(110, "barra_macica").total).toBe(107.5);
  });

  it("a barra vazia é 7,5 kg e o teto do kit é 107,5 kg", () => {
    expect(cargaMinima("barra_macica")).toBe(7.5);
    expect(cargaMaxima("barra_macica")).toBe(107.5);
    expect(montagem(30, "barra_macica").pesoBarra).toBe(7.5);
  });

  it("nenhuma montagem passa de 2 anilhas do mesmo peso por lado e as anilhas fecham a conta", () => {
    for (const kg of escala) {
      const m = montagem(kg, "barra_macica");
      expect(m.onde).toBe("porLado");
      expect(m.porLado).toEqual(m.anilhas);
      expect(m.exato).toBe(true);
      expect(soma([7.5, 2 * soma(m.anilhas)])).toBe(kg);
      for (const [peso, n] of contagem(m.anilhas)) {
        expect(n, `${n} anilhas de ${peso} kg por lado em ${kg} kg`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("doc linha 20: com até 2 de cada por lado, 1·2·3·4·5·10 cobrem todo inteiro de 1 a 50", () => {
    for (let s = 1; s <= 50; s++) {
      const m = montagem(7.5 + 2 * s, "barra_macica");
      expect(m.exato, `S = ${s}`).toBe(true);
      expect(soma(m.anilhas)).toBe(s);
    }
  });
});

describe("doc §Cargas alcançáveis — halteres (1,5 + 2 × S por halter, máx. 1 de cada por ponta)", () => {
  const escala = cargasPossiveis("halteres");

  it("a escala por halter é 1,5 + 2 × S com S de 0 a 19 (capacidade 40 kg)", () => {
    const esperada = Array.from({ length: 20 }, (_, k) => 1.5 + 2 * k);
    expect(escala).toEqual(esperada);
    expect(cargaMinima("halteres")).toBe(1.5);
    expect(cargaMaxima("halteres")).toBe(39.5);
  });

  it("exemplos válidos do doc: 1,5 · 3,5 (1) · 5,5 (2) · 11,5 (5) · 21,5 (10) · 39,5 (10·5·4)", () => {
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

  it("inválidos do doc: 4,5 → 3,5 · 6 → 5,5 · 41,5 → 39,5", () => {
    expect(alcancavelParaBaixo(4.5, "halteres")).toBe(3.5);
    expect(alcancavelParaBaixo(6, "halteres")).toBe(5.5);
    expect(alcancavelParaBaixo(41.5, "halteres")).toBe(39.5);
    expect(montagem(41.5, "halteres").total).toBe(39.5);
    expect(montagem(41.5, "halteres").diferenca).toBe(-2);
  });

  it("os dois halteres são iguais: no máximo 1 anilha de cada peso por ponta", () => {
    for (const kg of escala) {
      const m = montagem(kg, "halteres");
      expect(m.onde).toBe("porPonta");
      expect(m.exato).toBe(true);
      expect(m.pesoBarra).toBe(1.5);
      expect(soma([1.5, 2 * soma(m.anilhas)])).toBe(kg);
      for (const [peso, n] of contagem(m.anilhas)) {
        expect(n, `${n} anilhas de ${peso} kg por ponta em ${kg} kg`).toBe(1);
      }
    }
  });
});

describe("doc §Cargas alcançáveis — polia (S = qualquer soma do estoque, capacidade 100)", () => {
  it("a escala do pino é todo inteiro de 0 a 100", () => {
    const escala = cargasPossiveis("polia");
    expect(escala).toEqual(Array.from({ length: 101 }, (_, k) => k));
  });

  it("exemplos válidos do doc: 1 · 2 · 4 · 6 · 9 · 20", () => {
    for (const kg of [1, 2, 4, 6, 9, 20]) {
      const m = montagem(kg, "polia");
      expect(m.exato, `${kg} kg no pino`).toBe(true);
      expect(m.onde).toBe("noPino");
      expect(m.pesoBarra).toBe(0);
      expect(soma(m.anilhas)).toBe(kg);
    }
  });

  it("inválidos do doc: 0,5 → 0 · 101 → 100", () => {
    expect(alcancavelParaBaixo(0.5, "polia")).toBe(0);
    expect(alcancavelParaBaixo(101, "polia")).toBe(100);
    expect(montagem(0.5, "polia").total).toBe(0);
    expect(montagem(101, "polia").total).toBe(100);
  });
});

describe("doc §Cargas alcançáveis — barra W (2,0 a pesar + 2 × S, capacidade 50)", () => {
  it("a barra W ainda não pesada vale 2,0 kg e a escala é 2 + 2 × S até 50", () => {
    expect(PESO_BARRA_A_PESAR).toBe(2);
    expect(cargaMinima("barra_w")).toBe(2);
    expect(cargasPossiveis("barra_w")).toEqual(
      Array.from({ length: 25 }, (_, k) => 2 + 2 * k),
    );
    expect(montagem(10, "barra_w").pesoBarra).toBe(2);
  });

  it("inválido do doc: 52 → 50", () => {
    expect(alcancavelParaBaixo(52, "barra_w")).toBe(50);
    const m = montagem(52, "barra_w");
    expect(m.total).toBe(50);
    expect(m.exato).toBe(false);
    expect(m.diferenca).toBe(-2);
  });
});

describe("doc §Cargas alcançáveis — exemplos literais de montagem()", () => {
  it('montagem(25.5, "barra_macica") → { porLado: [5, 4], total: 25.5, exato: true }', () => {
    const m = montagem(25.5, "barra_macica");
    expect(m.porLado).toEqual([5, 4]);
    expect(m.total).toBe(25.5);
    expect(m.exato).toBe(true);
    expect(m.diferenca).toBeUndefined();
    expect(m.aviso).toBeUndefined();
  });

  it('montagem(26.5, "barra_macica") → { porLado: [5, 4], total: 25.5, exato: false, diferenca: -1 }', () => {
    const m = montagem(26.5, "barra_macica");
    expect(m.porLado).toEqual([5, 4]);
    expect(m.total).toBe(25.5);
    expect(m.exato).toBe(false);
    expect(m.diferenca).toBe(-1);
  });

  it('montagem(5.5, "halteres") → { porPonta: [2], total: 5.5, exato: true } (cada halter)', () => {
    const m = montagem(5.5, "halteres");
    expect(m.porPonta).toEqual([2]);
    expect(m.total).toBe(5.5);
    expect(m.exato).toBe(true);
  });

  it("montagem(107.5) → porLado [10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1]", () => {
    const m = montagem(107.5, "barra_macica");
    expect(m.porLado).toEqual([10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
    expect(m.total).toBe(107.5);
    expect(m.exato).toBe(true);
  });

  it('montagem(109.5) → 107,5 com aviso "faltam anilhas de 10 kg"', () => {
    const m = montagem(109.5, "barra_macica");
    expect(m.total).toBe(107.5);
    expect(m.exato).toBe(false);
    expect(m.diferenca).toBe(-2);
    expect(m.aviso).toBe("faltam anilhas de 10 kg");
  });
});

/* ========================================================================
 * OS 22 CASOS DO MOTOR — doc, linhas 22–49
 * ===================================================================== */

describe("caso 1 — supino reto (3 × 5–8), 1ª sessão, 8/8/8 firme → subiu 9,5", () => {
  const d = decidir(ex("supino-reto-com-barra"), null, reps(8, 8, 8), {
    ultimaFirme: true,
  });

  it("sobe para 9,5 kg com o evento subiu", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
  });

  it("zera as falhas", () => {
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });

  it("a 1ª sessão parte da barra vazia (7,5 kg) e o evento registra de → para", () => {
    expect(cargaDeHoje(ex("supino-reto-com-barra"), null).carga_kg).toBe(7.5);
    expect(d.evento?.de).toEqual({ carga_kg: 7.5 });
    expect(d.evento?.para).toEqual({ carga_kg: 9.5 });
  });
});

describe("caso 2 — supino reto, carga 9,5, 8/8/7 firme → repetiu 9,5", () => {
  const d = decidir(
    ex("supino-reto-com-barra"),
    estado("supino-reto-com-barra", { carga_atual_kg: 9.5 }),
    reps(8, 8, 7),
    { ultimaFirme: true },
  );

  it("repete a carga porque não chegou ao topo em todas", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
  });

  it("não é falha: 7 está dentro da faixa 5–8", () => {
    expect(d.evento?.falha).toBeFalsy();
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 3 — supino reto, carga 9,5, 8/8/8 SEM firme → repetiu 9,5", () => {
  const d = decidir(
    ex("supino-reto-com-barra"),
    estado("supino-reto-com-barra", { carga_atual_kg: 9.5 }),
    reps(8, 8, 8),
    { ultimaFirme: false },
  );

  it("sem a última repetição firme não sobe", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 4 — supino reto, carga 25,5, falhas 0, 8/6/4 → falha nº 1", () => {
  const d = decidir(
    ex("supino-reto-com-barra"),
    estado("supino-reto-com-barra", { carga_atual_kg: 25.5, falhas_seguidas: 0 }),
    reps(8, 6, 4),
  );

  it("repete a mesma carga (25,5) marcando falha", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.carga_atual_kg).toBe(25.5);
  });

  it("falhas_seguidas vai a 1", () => {
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("não mexe no incremento nem exige repetição extra", () => {
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(d.novoEstado.exigir_rep_extra).toBe(false);
    expect(incrementoDe(ex("supino-reto-com-barra"), d.novoEstado)).toBe(2);
  });
});

describe("caso 5 — supino reto, carga 25,5, falhas 1, 7/5/3 → falha nº 2", () => {
  const d = decidir(
    ex("supino-reto-com-barra"),
    estado("supino-reto-com-barra", { carga_atual_kg: 25.5, falhas_seguidas: 1 }),
    reps(7, 5, 3),
  );

  it("motivo falha_2x_voltou_10 e carga alcançável ≤ 22,95 → 21,5", () => {
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(d.evento?.falha).toBe(true);
    expect(alcancavelParaBaixo(25.5 * 0.9, "barra_macica")).toBe(21.5);
    expect(d.novoEstado.carga_atual_kg).toBe(21.5);
  });

  it("falhas_seguidas vai a 2", () => {
    expect(d.novoEstado.falhas_seguidas).toBe(2);
  });

  it("o incremento de 2 kg continua 2 kg (2 ÷ 2 = 1 < passo mínimo 2)", () => {
    expect(PASSO_MINIMO_KG).toBe(2);
    expect(d.novoEstado.incremento_reduzido).toBe(true);
    expect(incrementoDe(ex("supino-reto-com-barra"), d.novoEstado)).toBe(2);
  });

  it("passa a exigir topo da faixa + 1 rep (9, 9, 9) para a próxima subida", () => {
    expect(d.novoEstado.exigir_rep_extra).toBe(true);
    const comOitos = decidir(
      ex("supino-reto-com-barra"),
      d.novoEstado,
      reps(8, 8, 8),
      { ultimaFirme: true },
    );
    expect(comOitos.evento?.motivo).toBe("repetiu");
    expect(comOitos.novoEstado.carga_atual_kg).toBe(21.5);

    const comNoves = decidir(
      ex("supino-reto-com-barra"),
      d.novoEstado,
      reps(9, 9, 9),
      { ultimaFirme: true },
    );
    expect(comNoves.evento?.motivo).toBe("subiu");
    expect(comNoves.novoEstado.carga_atual_kg).toBe(23.5);
    expect(comNoves.novoEstado.exigir_rep_extra).toBe(false);
  });
});

describe("caso 6 — agachamento livre (3 × 5), carga 39,5, falhas 1, 5/4/3 → falha nº 2", () => {
  const d = decidir(
    ex("agachamento-livre"),
    estado("agachamento-livre", { carga_atual_kg: 39.5, falhas_seguidas: 1 }),
    reps(5, 4, 3),
  );

  it("carga alcançável ≤ 35,55 → 35,5", () => {
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(alcancavelParaBaixo(39.5 * 0.9, "barra_macica")).toBe(35.5);
    expect(d.novoEstado.carga_atual_kg).toBe(35.5);
  });

  it("incremento 4 → 2 kg até a próxima subida", () => {
    expect(incrementoDe(ex("agachamento-livre"), estado("agachamento-livre"))).toBe(4);
    expect(d.novoEstado.incremento_reduzido).toBe(true);
    expect(incrementoDe(ex("agachamento-livre"), d.novoEstado)).toBe(2);
  });

  it("falhas 2 e, com 4 kg, a subida NÃO passa a exigir repetição extra", () => {
    expect(d.novoEstado.falhas_seguidas).toBe(2);
    expect(d.novoEstado.exigir_rep_extra).toBe(false);
  });
});

describe("caso 7 — agachamento livre, carga 35,5, falhas 2, incremento reduzido, 5/5/5 firme", () => {
  const d = decidir(
    ex("agachamento-livre"),
    estado("agachamento-livre", {
      carga_atual_kg: 35.5,
      falhas_seguidas: 2,
      incremento_reduzido: true,
    }),
    reps(5, 5, 5),
    { ultimaFirme: true },
  );

  it("sobe 2 kg: 37,5", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(37.5);
  });

  it("zera as falhas", () => {
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });

  it("o incremento volta a 4 kg", () => {
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(ex("agachamento-livre"), d.novoEstado)).toBe(4);
  });
});

describe("caso 8 — levantamento terra (3 × 5), carga 47,5, falhas 2, 4/3/3 → falha nº 3", () => {
  const antes = estado("levantamento-terra", {
    carga_atual_kg: 47.5,
    falhas_seguidas: 2,
    incremento_reduzido: true,
  });
  const d = decidir(ex("levantamento-terra"), antes, reps(4, 3, 3));

  it("motivo semana_leve_60", () => {
    expect(d.evento?.motivo).toBe("semana_leve_60");
    expect(d.evento?.falha).toBe(true);
  });

  it("a próxima sessão é a alcançável ≤ 28,5 → 27,5, com as mesmas séries", () => {
    expect(alcancavelParaBaixo(47.5 * 0.6, "barra_macica")).toBe(27.5);
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
    const hoje = cargaDeHoje(ex("levantamento-terra"), d.novoEstado);
    expect(hoje.carga_kg).toBe(27.5);
    expect(hoje.alvo_min).toBe(5);
    expect(hoje.alvo_max).toBe(5);
    expect(hoje.semana_leve).toBe(true);
  });

  it("marca semana_leve e zera falhas_seguidas", () => {
    expect(d.novoEstado.semana_leve).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(d.novoEstado.carga_antes_leve).toBe(47.5);
  });
});

describe("caso 9 — levantamento terra na sessão da semana leve, 27,5, 5/5/5", () => {
  const antes = estado("levantamento-terra", {
    carga_atual_kg: 27.5,
    semana_leve: true,
    carga_antes_leve: 47.5,
    incremento_reduzido: true,
  });
  const d = decidir(ex("levantamento-terra"), antes, reps(5, 5, 5), {
    ultimaFirme: true,
  });

  it("volta à carga de antes da semana leve: 47,5", () => {
    expect(d.novoEstado.carga_atual_kg).toBe(47.5);
    expect(d.novoEstado.semana_leve).toBe(false);
    expect(d.novoEstado.carga_antes_leve).toBeNull();
  });

  it("evento com motivo fim_semana_leve", () => {
    expect(d.evento?.motivo).toBe("fim_semana_leve");
  });

  it("o incremento volta ao normal (4 kg)", () => {
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(ex("levantamento-terra"), d.novoEstado)).toBe(4);
    expect(cargaDeHoje(ex("levantamento-terra"), d.novoEstado).carga_kg).toBe(47.5);
  });

  it("encadeado com o caso 8: 47,5 → semana leve 27,5 → 47,5", () => {
    const passo1 = decidir(
      ex("levantamento-terra"),
      estado("levantamento-terra", { carga_atual_kg: 47.5, falhas_seguidas: 2 }),
      reps(4, 3, 3),
    );
    const passo2 = decidir(
      ex("levantamento-terra"),
      passo1.novoEstado,
      reps(5, 5, 5),
      { ultimaFirme: true },
    );
    expect(passo2.novoEstado.carga_atual_kg).toBe(47.5);
    expect(passo2.evento?.motivo).toBe("fim_semana_leve");
  });
});

describe("caso 10 — rosca alternada (3 × 10–12 por braço), 12/12, 12/12, 12/11", () => {
  const d = decidir(
    ex("rosca-alternada"),
    estado("rosca-alternada", { carga_atual_kg: 1.5 }),
    doisLados([12, 12], [12, 12], [12, 11]),
    { ultimaFirme: true },
  );

  it("vale o menor lado: 11 < 12 na 3ª série → repetiu", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(1.5);
  });

  it("não conta falha (11 está dentro da faixa 10–12)", () => {
    expect(d.evento?.falha).toBeFalsy();
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 11 — rosca alternada, 1,5 por halter, 12/12 nas 3, firme → 3,5", () => {
  const d = decidir(
    ex("rosca-alternada"),
    estado("rosca-alternada", { carga_atual_kg: 1.5 }),
    doisLados([12, 12], [12, 12], [12, 12]),
    { ultimaFirme: true },
  );

  it("sobe para 3,5 kg por halter", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(3.5);
  });

  it("3,5 é 1 kg em cada ponta", () => {
    expect(montagem(3.5, "halteres").porPonta).toEqual([1]);
  });
});

describe("caso 12 — puxada alta na polia (3 × 10–12), 1ª sessão, 4 kg, 12/12/12 firme", () => {
  const d = decidir(ex("puxada-alta-na-polia"), null, reps(12, 12, 12), {
    ultimaFirme: true,
  });

  it("a 1ª sessão começa com 4 kg no pino", () => {
    expect(cargaDeHoje(ex("puxada-alta-na-polia"), null).carga_kg).toBe(4);
  });

  it("sobe para 6 kg", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(6);
  });
});

describe("caso 13 — barra fixa assistida (4 × 5–8), pe_inteiro, 8/8/8/8 firme", () => {
  const d = decidir(
    ex("barra-fixa-assistida"),
    estado("barra-fixa-assistida", { assistencia: "pe_inteiro" }),
    reps(8, 8, 8, 8),
    { ultimaFirme: true },
  );

  it("sobe um degrau: pe_inteiro → joelho", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.assistencia).toBe("joelho");
  });

  it("a carga não muda", () => {
    expect(d.novoEstado.carga_atual_kg).toBe(0);
  });

  it("dá 2 sessões de graça", () => {
    expect(d.novoEstado.sessoes_graca).toBe(2);
  });
});

describe("caso 14 — barra fixa assistida, joelho, 1ª sessão após mudar, 5/5/4/4", () => {
  const antes = estado("barra-fixa-assistida", {
    assistencia: "joelho",
    sessoes_graca: 2,
  });
  const d = decidir(ex("barra-fixa-assistida"), antes, reps(5, 5, 4, 4));

  it("dentro da graça → repetiu", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.assistencia).toBe("joelho");
  });

  it("NÃO conta falha", () => {
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(d.evento?.falha).toBeFalsy();
  });

  it("consome uma sessão de graça", () => {
    expect(d.novoEstado.sessoes_graca).toBe(1);
  });

  it("encadeado com o caso 13: as duas sessões seguintes não contam falha", () => {
    const subida = decidir(
      ex("barra-fixa-assistida"),
      estado("barra-fixa-assistida", { assistencia: "pe_inteiro" }),
      reps(8, 8, 8, 8),
      { ultimaFirme: true },
    );
    const s1 = decidir(ex("barra-fixa-assistida"), subida.novoEstado, reps(5, 5, 4, 4));
    const s2 = decidir(ex("barra-fixa-assistida"), s1.novoEstado, reps(5, 5, 4, 4));
    expect(s1.novoEstado.falhas_seguidas).toBe(0);
    expect(s2.novoEstado.falhas_seguidas).toBe(0);
    expect(s2.evento?.falha).toBeFalsy();
  });
});

describe("caso 15 — barra fixa pronada (3 × máximo), média anterior 4,0 (4, 4, 4), 5/5/5", () => {
  const anteriores = [4, 4, 4];
  const d = decidir(
    ex("barra-fixa-pronada"),
    estado("barra-fixa-pronada", { reps_alvo: 4 }),
    reps(5, 5, 5),
    { seriesAnteriores: anteriores },
  );

  it("sobe: média +1 e nenhuma série abaixo da correspondente", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(5);
  });

  it("média +1 mas uma série abaixo da anterior NÃO é sucesso", () => {
    const caiu = decidir(
      ex("barra-fixa-pronada"),
      estado("barra-fixa-pronada", { reps_alvo: 4 }),
      reps(6, 6, 3),
      { seriesAnteriores: anteriores },
    );
    expect(caiu.evento?.motivo).not.toBe("subiu");
  });

  it("3 séries chegando a 10 sugerem a barra fixa com lastro", () => {
    const dez = decidir(
      ex("barra-fixa-pronada"),
      estado("barra-fixa-pronada", { reps_alvo: 9 }),
      reps(10, 10, 10),
      { seriesAnteriores: [9, 9, 9] },
    );
    expect(dez.evento?.sugestao ?? "").toMatch(/lastro/i);
  });
});

describe("caso 16 — prancha (3 × 30–60 s), tempo alvo 30, 60/60/60 firme", () => {
  const d = decidir(
    ex("prancha"),
    estado("prancha", { tempo_alvo_s: 30 }),
    segundos(60, 60, 60),
    { ultimaFirme: true },
  );

  it("sobe o tempo alvo para 65 s", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.tempo_alvo_s).toBe(65);
  });

  it("acima da faixa: sugere variação", () => {
    expect(d.evento?.sugestao ?? "").toMatch(/varia/i);
  });

  it("o alvo a bater hoje é o topo da faixa (60 s)", () => {
    const hoje = cargaDeHoje(ex("prancha"), estado("prancha", { tempo_alvo_s: 30 }));
    expect(hoje.alvo_max).toBe(60);
    expect(hoje.tempo_alvo_s).toBe(30);
  });
});

describe("caso 17 — elevação de pernas na barra fixa (3 × 10–15), reps alvo 10, 15/15/15 firme", () => {
  const d = decidir(
    ex("elevacao-de-pernas-na-barra-fixa"),
    estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 10 }),
    reps(15, 15, 15),
    { ultimaFirme: true },
  );

  it("sobe as reps alvo para 16", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(16);
  });

  it("passando de 20 em todas sugere a anilha de 2 kg e voltar ao piso (10)", () => {
    /*
     * CORRIGIDO (rodada 3): SPEC §6.3 ("acima de 20 reps em todas as séries") e
     * a `progressao.regra` do JSON ("quando passar de 20") mandam no gatilho; o
     * "todas ≥ 20" do doc é abreviação. Com 20 a sugestão cairia em cima do
     * piso da faixa 20–30 e do 3 × 20 fechado do russian twist.
     */
    const vinte = decidir(
      ex("elevacao-de-pernas-na-barra-fixa"),
      estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 10 }),
      reps(20, 20, 20),
      { ultimaFirme: true },
    );
    expect(vinte.evento?.sugestao ?? "").toBe("");
    const passou = decidir(
      ex("elevacao-de-pernas-na-barra-fixa"),
      estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 10 }),
      reps(21, 21, 21),
      { ultimaFirme: true },
    );
    expect(passou.evento?.sugestao ?? "").toMatch(/anilha/i);
  });
});

describe("caso 18 — agachamento búlgaro (3 × 8–10 por perna), halteres 5,5, 10/10, 10/10, 10/9", () => {
  const d = decidir(
    ex("agachamento-bulgaro"),
    estado("agachamento-bulgaro", { carga_atual_kg: 5.5 }),
    doisLados([10, 10], [10, 10], [10, 9]),
    { ultimaFirme: true },
  );

  it("vale o menor lado: repetiu em 5,5 kg", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(5.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 19 — farmer's walk (3 × 30–40 passos), halteres 11,5, 40/40/40 firme", () => {
  const d = decidir(
    ex("farmer-s-walk"),
    estado("farmer-s-walk", { carga_atual_kg: 11.5 }),
    passos(40, 40, 40),
    { ultimaFirme: true },
  );

  it("sobe para 13,5 kg por halter", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(13.5);
  });
});

describe("caso 20 — sessão abandonada com 1 série registrada", () => {
  const antes = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
  const d = decidir(ex("supino-reto-com-barra"), antes, reps(8), {
    sessaoAbandonada: true,
  });

  it("não avalia: sem evento", () => {
    expect(d.evento).toBeNull();
  });

  it("estado inalterado", () => {
    expect(d.novoEstado).toEqual(antes);
  });

  it("vale para qualquer exercício (tempo, máximo, assistência)", () => {
    const prancha = estado("prancha", { tempo_alvo_s: 45 });
    const dPrancha = decidir(ex("prancha"), prancha, segundos(60), {
      sessaoAbandonada: true,
    });
    expect(dPrancha.evento).toBeNull();
    expect(dPrancha.novoEstado).toEqual(prancha);

    const fixa = estado("barra-fixa-assistida", { assistencia: "joelho" });
    const dFixa = decidir(ex("barra-fixa-assistida"), fixa, reps(8), {
      sessaoAbandonada: true,
      ultimaFirme: true,
    });
    expect(dFixa.evento).toBeNull();
    expect(dFixa.novoEstado).toEqual(fixa);
  });
});

describe("caso 21 — supino reto substituído por supino inclinado com halteres", () => {
  const estadoSupino = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
  const estadoInclinado = estado("supino-inclinado-com-halteres", {
    carga_atual_kg: 1.5,
  });

  it("o substituto usa o próprio estado e sobe", () => {
    const d = decidir(
      ex("supino-inclinado-com-halteres"),
      estadoInclinado,
      reps(12, 12, 12),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(3.5);
  });

  it("o original não é avaliado: sem séries, estado inalterado e sem evento", () => {
    const d = decidir(ex("supino-reto-com-barra"), estadoSupino, [], {
      ultimaFirme: true,
    });
    expect(d.evento).toBeNull();
    expect(d.novoEstado).toEqual(estadoSupino);
    expect(estadoSupino.carga_atual_kg).toBe(25.5);
  });
});

describe("caso 22 — supino reto na carga 107,5 (teto), 8/8/8 firme", () => {
  const d = decidir(
    ex("supino-reto-com-barra"),
    estado("supino-reto-com-barra", { carga_atual_kg: 107.5 }),
    reps(8, 8, 8),
    { ultimaFirme: true },
  );

  it("subir é impossível → repetiu", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(107.5);
  });

  it('aviso "faltam anilhas de 10 kg (marco do guia)"', () => {
    expect(d.evento?.aviso).toBe("faltam anilhas de 10 kg (marco do guia)");
  });
});

/* ========================================================================
 * "Regras derivadas dos casos" — doc, linhas 51–56
 * ===================================================================== */

describe("doc §Regras derivadas — alcancavel_para_baixo em toda carga calculada", () => {
  it("a subida de carga cai na escala do implemento (barra: 7,5 + 2 k)", () => {
    const escala = cargasPossiveis("barra_macica");
    for (const inicio of [7.5, 21.5, 47.5, 105.5]) {
      const d = decidir(
        ex("supino-reto-com-barra"),
        estado("supino-reto-com-barra", { carga_atual_kg: inicio }),
        reps(8, 8, 8),
        { ultimaFirme: true },
      );
      expect(escala).toContain(d.novoEstado.carga_atual_kg);
    }
  });

  it("os −10 % e os 60 % também caem na escala", () => {
    const escala = cargasPossiveis("barra_macica");
    const dez = decidir(
      ex("levantamento-terra"),
      estado("levantamento-terra", { carga_atual_kg: 61.5, falhas_seguidas: 1 }),
      reps(2, 2, 2),
    );
    expect(dez.novoEstado.carga_atual_kg).toBe(alcancavelParaBaixo(61.5 * 0.9, "barra_macica"));
    expect(escala).toContain(dez.novoEstado.carga_atual_kg);

    const leve = decidir(
      ex("levantamento-terra"),
      estado("levantamento-terra", { carga_atual_kg: 61.5, falhas_seguidas: 2 }),
      reps(2, 2, 2),
    );
    expect(leve.novoEstado.carga_atual_kg).toBe(alcancavelParaBaixo(61.5 * 0.6, "barra_macica"));
    expect(escala).toContain(leve.novoEstado.carga_atual_kg);
  });
});

describe("doc §Regras derivadas — incremento reduzido = max(incremento / 2, passo mínimo)", () => {
  it("2 kg continuam 2 kg e a exigência vira topo + 1 rep", () => {
    const e = estado("supino-reto-com-barra", { incremento_reduzido: true });
    expect(incrementoDe(ex("supino-reto-com-barra"), e)).toBe(
      Math.max(2 / 2, PASSO_MINIMO_KG),
    );
  });

  it("4 kg viram 2 kg sem exigir repetição extra", () => {
    const e = estado("agachamento-livre", { incremento_reduzido: true });
    expect(incrementoDe(ex("agachamento-livre"), e)).toBe(
      Math.max(4 / 2, PASSO_MINIMO_KG),
    );
  });

  it("volta ao incremento normal na próxima subida", () => {
    const d = decidir(
      ex("agachamento-livre"),
      estado("agachamento-livre", {
        carga_atual_kg: 35.5,
        incremento_reduzido: true,
        exigir_rep_extra: true,
        falhas_seguidas: 2,
      }),
      reps(6, 6, 6),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(incrementoDe(ex("agachamento-livre"), d.novoEstado)).toBe(4);
  });
});

describe("doc §Regras derivadas — unilateral vale o menor dos dois lados em cada série", () => {
  it("o lado pior derruba a série (rosca alternada, faixa 10–12)", () => {
    const abaixoDoPiso = decidir(
      ex("rosca-alternada"),
      estado("rosca-alternada", { carga_atual_kg: 3.5 }),
      doisLados([12, 12], [12, 12], [12, 8]),
      { ultimaFirme: true },
    );
    expect(abaixoDoPiso.evento?.falha).toBe(true);
    expect(abaixoDoPiso.novoEstado.falhas_seguidas).toBe(1);
  });
});

/* ========================================================================
 * Segundas leituras dos mesmos casos — encadeamentos, de → para e mutação
 * ===================================================================== */

describe("casos 4 → 5 → 8 encadeados: a tabela de falhas do SPEC §6.2 em sequência", () => {
  const e0 = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
  const f1 = decidir(ex("supino-reto-com-barra"), e0, reps(8, 6, 4));
  const f2 = decidir(ex("supino-reto-com-barra"), f1.novoEstado, reps(7, 5, 3));
  const f3 = decidir(ex("supino-reto-com-barra"), f2.novoEstado, reps(4, 4, 4));
  const leve = decidir(ex("supino-reto-com-barra"), f3.novoEstado, reps(8, 8, 8), {
    ultimaFirme: true,
  });

  it("1ª falha repete 25,5 · 2ª volta 10 % (21,5) · 3ª semana leve a 60 % (11,5)", () => {
    expect([f1.evento?.motivo, f1.novoEstado.carga_atual_kg]).toEqual([
      "repetiu",
      25.5,
    ]);
    expect([f2.evento?.motivo, f2.novoEstado.carga_atual_kg]).toEqual([
      "falha_2x_voltou_10",
      21.5,
    ]);
    expect(f3.evento?.motivo).toBe("semana_leve_60");
    expect(f3.novoEstado.carga_atual_kg).toBe(
      alcancavelParaBaixo(21.5 * 0.6, "barra_macica"),
    );
    expect(f3.novoEstado.carga_atual_kg).toBe(11.5);
  });

  it("as falhas andam 1 → 2 → 0 e a semana leve guarda a carga de antes", () => {
    expect(f1.novoEstado.falhas_seguidas).toBe(1);
    expect(f2.novoEstado.falhas_seguidas).toBe(2);
    expect(f3.novoEstado.falhas_seguidas).toBe(0);
    expect(f3.novoEstado.carga_antes_leve).toBe(21.5);
  });

  it("a sessão da semana leve devolve a carga de antes (21,5) e o incremento normal", () => {
    expect(leve.evento?.motivo).toBe("fim_semana_leve");
    expect(leve.novoEstado.carga_atual_kg).toBe(21.5);
    expect(leve.novoEstado.exigir_rep_extra).toBe(false);
    expect(incrementoDe(ex("supino-reto-com-barra"), leve.novoEstado)).toBe(2);
  });
});

describe("SPEC §6.2 — 'manteve' não mexe em falhas_seguidas (casos 2, 3, 10, 18)", () => {
  it("com uma falha guardada, uma sessão mantida deixa falhas_seguidas em 1", () => {
    const d = decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 9.5, falhas_seguidas: 1 }),
      reps(8, 8, 7),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("uma subida zera falhas_seguidas (casos 1, 7, 11, 12, 19)", () => {
    const d = decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 9.5, falhas_seguidas: 1 }),
      reps(8, 8, 8),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("SPEC §4 e §6.6 — o evento registra de → para em cada caso", () => {
  it("caso 8: de 47,5 → para 27,5", () => {
    const d = decidir(
      ex("levantamento-terra"),
      estado("levantamento-terra", { carga_atual_kg: 47.5, falhas_seguidas: 2 }),
      reps(4, 3, 3),
    );
    expect(d.evento?.de).toEqual({ carga_kg: 47.5 });
    expect(d.evento?.para).toEqual({ carga_kg: 27.5 });
  });

  it("caso 9: de 27,5 → para 47,5", () => {
    const d = decidir(
      ex("levantamento-terra"),
      estado("levantamento-terra", {
        carga_atual_kg: 27.5,
        semana_leve: true,
        carga_antes_leve: 47.5,
      }),
      reps(5, 5, 5),
    );
    expect(d.evento?.de).toEqual({ carga_kg: 27.5 });
    expect(d.evento?.para).toEqual({ carga_kg: 47.5 });
  });

  it("caso 13: de pe_inteiro → para joelho", () => {
    const d = decidir(
      ex("barra-fixa-assistida"),
      estado("barra-fixa-assistida", { assistencia: "pe_inteiro" }),
      reps(8, 8, 8, 8),
      { ultimaFirme: true },
    );
    expect(d.evento?.de).toEqual({ assistencia: "pe_inteiro" });
    expect(d.evento?.para).toEqual({ assistencia: "joelho" });
  });

  it("caso 16: de 30 s → para 65 s", () => {
    const d = decidir(ex("prancha"), estado("prancha", { tempo_alvo_s: 30 }), segundos(60, 60, 60), {
      ultimaFirme: true,
    });
    expect(d.evento?.de).toEqual({ tempo_alvo_s: 30 });
    expect(d.evento?.para).toEqual({ tempo_alvo_s: 65 });
  });

  it("caso 17: de 10 reps → para 16 reps", () => {
    const d = decidir(
      ex("elevacao-de-pernas-na-barra-fixa"),
      estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 10 }),
      reps(15, 15, 15),
      { ultimaFirme: true },
    );
    expect(d.evento?.de).toEqual({ reps_alvo: 10 });
    expect(d.evento?.para).toEqual({ reps_alvo: 16 });
  });
});

describe("caso 21 (lado do estado) — decidir não mexe no estado que recebeu", () => {
  it("o objeto de entrada continua igual depois da decisão", () => {
    const antes = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const copia = { ...antes };
    decidir(ex("supino-reto-com-barra"), antes, reps(8, 8, 8), { ultimaFirme: true });
    expect(antes).toEqual(copia);
  });
});

describe("caso 13/14 — as sessões de graça são 2, e a terceira já conta falha", () => {
  const subida = decidir(
    ex("barra-fixa-assistida"),
    estado("barra-fixa-assistida", { assistencia: "pe_inteiro" }),
    reps(8, 8, 8, 8),
    { ultimaFirme: true },
  );
  const s1 = decidir(ex("barra-fixa-assistida"), subida.novoEstado, reps(5, 5, 4, 4));
  const s2 = decidir(ex("barra-fixa-assistida"), s1.novoEstado, reps(5, 5, 4, 4));
  const s3 = decidir(ex("barra-fixa-assistida"), s2.novoEstado, reps(5, 5, 4, 4));

  it("as duas primeiras não contam falha", () => {
    expect(s1.novoEstado.falhas_seguidas).toBe(0);
    expect(s2.novoEstado.falhas_seguidas).toBe(0);
  });

  it("a terceira, fora da graça, conta falha", () => {
    expect(s3.evento?.falha).toBe(true);
    expect(s3.novoEstado.falhas_seguidas).toBe(1);
  });
});

describe("casos 15 e 17 — as sugestões só saem quando o gatilho do doc acontece", () => {
  it("2 séries de 10 na barra fixa não sugerem lastro; 3 sugerem", () => {
    const duas = decidir(
      ex("barra-fixa-pronada"),
      estado("barra-fixa-pronada", { reps_alvo: 9 }),
      reps(10, 10, 9),
      { seriesAnteriores: [9, 9, 9] },
    );
    expect(duas.evento?.sugestao).toBeUndefined();
    const tres = decidir(
      ex("barra-fixa-pronada"),
      estado("barra-fixa-pronada", { reps_alvo: 9 }),
      reps(10, 10, 10),
      { seriesAnteriores: [9, 9, 9] },
    );
    expect(tres.evento?.sugestao ?? "").toMatch(/lastro/i);
  });

  it("21/21/20 não sugere a anilha; 21/21/21 sugere (§6.3: acima de 20)", () => {
    /*
     * CORRIGIDO (rodada 3): o gatilho é "acima de 20 em TODAS as séries"
     * (SPEC §6.3 e a `progressao.regra` do JSON, "quando passar de 20"), então
     * a série que não passa de 20 é a que segura a sugestão.
     */
    const quase = decidir(
      ex("elevacao-de-pernas-na-barra-fixa"),
      estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 15 }),
      reps(21, 21, 20),
      { ultimaFirme: true },
    );
    expect(quase.evento?.sugestao).toBeUndefined();
    const todas = decidir(
      ex("elevacao-de-pernas-na-barra-fixa"),
      estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 15 }),
      reps(21, 21, 21),
      { ultimaFirme: true },
    );
    expect(todas.evento?.sugestao ?? "").toMatch(/anilha/i);
  });
});

describe("doc linha 20 — os chips saem do guloso do maior para o menor", () => {
  /** Guloso independente: pega o máximo de cada peso, do maior para o menor. */
  function guloso(alvo: number, limite: number): number[] {
    const pesos = [10, 5, 4, 3, 2, 1];
    const saida: number[] = [];
    let resto = alvo;
    for (const kg of pesos) {
      const n = Math.min(limite, Math.floor(resto / kg));
      for (let i = 0; i < n; i++) saida.push(kg);
      resto -= n * kg;
    }
    expect(resto, `o guloso não fechou ${alvo}`).toBe(0);
    return saida;
  }

  it("barra maciça: as anilhas por lado são as do guloso (2 de cada, S de 1 a 50)", () => {
    for (let s = 1; s <= 50; s++) {
      expect(montagem(7.5 + 2 * s, "barra_macica").porLado, `S = ${s}`).toEqual(
        guloso(s, 2),
      );
    }
  });

  it("halteres: as anilhas por ponta são as do guloso (1 de cada, S de 1 a 19)", () => {
    for (let s = 1; s <= 19; s++) {
      expect(montagem(1.5 + 2 * s, "halteres").porPonta, `S = ${s}`).toEqual(
        guloso(s, 1),
      );
    }
  });

  it("polia: o pino usa o estoque inteiro (4 de cada) até 100 kg", () => {
    const m = montagem(100, "polia");
    expect(m.exato).toBe(true);
    expect(soma(m.anilhas)).toBe(100);
    for (const [, n] of contagem(m.anilhas)) expect(n).toBeLessThanOrEqual(4);
  });
});

describe("SPEC §6.1 — o que a tela pede na primeira vez de cada caso", () => {
  it("caso 1: barra vazia, faixa 5–8 e nenhuma anilha", () => {
    const hoje = cargaDeHoje(ex("supino-reto-com-barra"), null);
    expect(hoje.primeira_vez).toBe(true);
    expect(hoje.carga_kg).toBe(7.5);
    expect(hoje.alvo_min).toBe(5);
    expect(hoje.alvo_max).toBe(8);
    expect(hoje.montagem?.anilhas).toEqual([]);
    expect(hoje.montagem?.exato).toBe(true);
  });

  it("caso 13: a assistência começa em pe_inteiro", () => {
    expect(cargaDeHoje(ex("barra-fixa-assistida"), null).assistencia).toBe("pe_inteiro");
  });

  it("caso 16: a prancha começa com 30 s guardados e 60 s a bater", () => {
    const hoje = cargaDeHoje(ex("prancha"), null);
    expect(hoje.tempo_alvo_s).toBe(30);
    expect(hoje.alvo_max).toBe(60);
  });

  it("caso 19: o farmer's walk começa com 1,5 kg por halter e 30–40 passos", () => {
    const hoje = cargaDeHoje(ex("farmer-s-walk"), null);
    expect(hoje.carga_kg).toBe(1.5);
    expect(hoje.alvo_min).toBe(30);
    expect(hoje.alvo_max).toBe(40);
  });
});

describe("caso 20 (o outro lado) — SPEC §6.3: com todas as séries registradas, a sessão abandonada é avaliada", () => {
  it("3 de 3 séries no topo, mesmo abandonada, sobem a carga", () => {
    const d = decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 25.5 }),
      reps(8, 8, 8),
      { sessaoAbandonada: true, ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("2 de 3 séries não avalia nada", () => {
    const antes = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const d = decidir(ex("supino-reto-com-barra"), antes, reps(8, 8), {
      sessaoAbandonada: true,
      ultimaFirme: true,
    });
    expect(d.evento).toBeNull();
    expect(d.novoEstado).toEqual(antes);
  });
});

describe("SPEC §6.2 — override de incremento em exercise_state.incremento_kg", () => {
  it("o override manda na subida e na metade da 2ª falha", () => {
    const comOverride = estado("supino-reto-com-barra", {
      carga_atual_kg: 25.5,
      incremento_kg: 6,
    });
    expect(incrementoDe(ex("supino-reto-com-barra"), comOverride)).toBe(6);

    const subiu = decidir(ex("supino-reto-com-barra"), comOverride, reps(8, 8, 8), {
      ultimaFirme: true,
    });
    expect(subiu.novoEstado.carga_atual_kg).toBe(31.5);

    const falhou = decidir(
      ex("supino-reto-com-barra"),
      { ...comOverride, falhas_seguidas: 1 },
      reps(4, 4, 4),
    );
    expect(falhou.novoEstado.incremento_reduzido).toBe(true);
    expect(incrementoDe(ex("supino-reto-com-barra"), falhou.novoEstado)).toBe(3);
    expect(falhou.novoEstado.exigir_rep_extra).toBe(false);
  });
});

describe("caso 15 — a média anterior guardada no estado (sem as séries da sessão passada)", () => {
  it("reps_alvo 4 e 5/5/5 também sobem", () => {
    const d = decidir(
      ex("barra-fixa-pronada"),
      estado("barra-fixa-pronada", { reps_alvo: 4 }),
      reps(5, 5, 5),
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(5);
  });

  it("média igual à anterior não sobe (4/4/4 contra média 4)", () => {
    const d = decidir(
      ex("barra-fixa-pronada"),
      estado("barra-fixa-pronada", { reps_alvo: 4 }),
      reps(4, 4, 4),
      { seriesAnteriores: [4, 4, 4] },
    );
    expect(d.evento?.motivo).not.toBe("subiu");
  });
});

describe("SPEC §6.2 — só as séries de trabalho entram na decisão", () => {
  it("uma série de aquecimento fraca não derruba a sessão do caso 1", () => {
    const series: SerieFeita[] = [
      { concluida: true, tipo: "aquecimento", reps: 2 },
      ...reps(8, 8, 8).map((s) => ({ ...s, tipo: "trabalho" as const })),
    ];
    const d = decidir(ex("supino-reto-com-barra"), null, series, { ultimaFirme: true });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
  });
});

describe("SPEC §6.4 — os tetos dos outros implementos", () => {
  it("barra reta oca: 60 kg; barra W: 50 kg; polia: 100 kg; halter: 40 kg (39,5 alcançável)", () => {
    expect(cargaMaxima("barra_reta_oca")).toBe(60);
    expect(cargaMaxima("barra_w")).toBe(50);
    expect(cargaMaxima("polia")).toBe(100);
    expect(cargaMaxima("halteres")).toBe(39.5);
  });
});

describe("caso 13 (a escada inteira) — SPEC §6.3: pe_inteiro → joelho → joelho_dobrado → sem", () => {
  const topo = () => reps(8, 8, 8, 8);

  it("cada degrau sobe um passo e renova as 2 sessões de graça", () => {
    let e = estado("barra-fixa-assistida", { assistencia: "pe_inteiro" });
    const degraus: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const d = decidir(ex("barra-fixa-assistida"), e, topo(), { ultimaFirme: true });
      expect(d.evento?.motivo).toBe("subiu");
      expect(d.novoEstado.sessoes_graca).toBe(2);
      degraus.push(d.novoEstado.assistencia);
      e = d.novoEstado;
    }
    expect(degraus).toEqual(["joelho", "joelho_dobrado", "sem"]);
  });

  it("sem elástico não há degrau acima: repete e sugere a barra fixa com lastro", () => {
    const d = decidir(
      ex("barra-fixa-assistida"),
      estado("barra-fixa-assistida", { assistencia: "sem" }),
      topo(),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.assistencia).toBe("sem");
    expect(d.evento?.sugestao ?? "").toMatch(/lastro/i);
  });
});

describe("casos 5 e 11 — as anilhas que a tela mostra depois da decisão", () => {
  it("caso 11: 3,5 kg por halter = 1 kg em cada ponta", () => {
    const d = decidir(
      ex("rosca-alternada"),
      estado("rosca-alternada", { carga_atual_kg: 1.5 }),
      doisLados([12, 12], [12, 12], [12, 12]),
      { ultimaFirme: true },
    );
    const hoje = cargaDeHoje(ex("rosca-alternada"), d.novoEstado);
    expect(hoje.carga_kg).toBe(3.5);
    expect(hoje.montagem?.porPonta).toEqual([1]);
  });

  it("caso 5: 21,5 kg na barra = 5 + 2 por lado", () => {
    const d = decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 25.5, falhas_seguidas: 1 }),
      reps(7, 5, 3),
    );
    const hoje = cargaDeHoje(ex("supino-reto-com-barra"), d.novoEstado);
    expect(hoje.carga_kg).toBe(21.5);
    expect(hoje.montagem?.porLado).toEqual([5, 2]);
    expect(hoje.montagem?.exato).toBe(true);
    expect(hoje.exigir_rep_extra).toBe(true);
    expect(hoje.incremento_kg).toBe(2);
  });
});
