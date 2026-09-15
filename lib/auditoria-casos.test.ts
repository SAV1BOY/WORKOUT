/**
 * AUDITORIA ADVERSARIAL — lente "casos" (rodada 4).
 *
 * Testes escritos do zero a partir de docs/casos-de-teste-progressao.md e de
 * SPEC.md §5–§6, sem reaproveitar lib/progressao.test.ts nem lib/montagem.test.ts.
 * Cada linha da tabela "Cargas alcançáveis" e cada um dos 22 casos tem o seu
 * bloco, comparando valor a valor (carga, falhas, incremento, flags, motivo do
 * evento, avisos e sugestões) com os exercícios reais de data/exercicios.json.
 *
 * Arquivo de auditoria: NÃO é o arquivo de testes do construtor.
 */
import { describe, expect, it } from "vitest";

import { acharExercicio, exercicios, programa, textoDoMotor } from "@/lib/dados";
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
  prescricaoDoTreino,
  prescricaoPadrao,
  type EstadoExercicio,
  type SerieFeita,
} from "@/lib/progressao";
import type { Exercicio, RefDeTexto } from "@/lib/schemas";

/**
 * O texto de uma sugestão/aviso do motor: o motor devolve só a chave e os
 * números (SPEC §6.3/§6.4) e a frase mora em `data/progressao.json`, montada
 * por `textoDoMotor`. As asserções continuam sobre o texto que o app mostra.
 */
function txt(ref: RefDeTexto | null | undefined): string {
  return textoDoMotor(ref) ?? "";
}

/* ------------------------------------------------------------- utilidades */

const supino = acharExercicio("supino-reto-com-barra");
const supinoInclinadoHalteres = acharExercicio("supino-inclinado-com-halteres");
const agachamento = acharExercicio("agachamento-livre");
const terra = acharExercicio("levantamento-terra");
const roscaAlternada = acharExercicio("rosca-alternada");
const puxada = acharExercicio("puxada-alta-na-polia");
const fixaAssistida = acharExercicio("barra-fixa-assistida");
const fixaPronada = acharExercicio("barra-fixa-pronada");
const prancha = acharExercicio("prancha");
const elevacaoPernas = acharExercicio("elevacao-de-pernas-na-barra-fixa");
const bulgaro = acharExercicio("agachamento-bulgaro");
const farmer = acharExercicio("farmer-s-walk");

function estado(e: Exercicio, over: Partial<EstadoExercicio> = {}): EstadoExercicio {
  return { ...estadoInicial(e), ...over };
}

/** Séries de repetições bilaterais, todas concluídas. */
function reps(...lista: number[]): SerieFeita[] {
  return lista.map((r) => ({ concluida: true, reps: r }));
}

/** Séries unilaterais [direito, esquerdo]. */
function repsLados(...pares: [number, number][]): SerieFeita[] {
  return pares.map(([d, e]) => ({ concluida: true, reps: d, reps_lado2: e }));
}

function tempos(...lista: number[]): SerieFeita[] {
  return lista.map((t) => ({ concluida: true, tempo_s: t }));
}

function passos(...lista: number[]): SerieFeita[] {
  return lista.map((p) => ({ concluida: true, passos: p }));
}

function soma(v: number[]): number {
  return v.reduce((s, x) => s + x, 0);
}

/* ===================================================================== */
/* PARTE 1 — tabela "Cargas alcançáveis (montagem)"                      */
/* ===================================================================== */

describe("doc, cabeçalho: convenções de carga e passo mínimo", () => {
  it("barra maciça vazia = 7,5 kg (total) e halter vazio = 1,5 kg (por halter)", () => {
    expect(cargaMinima("barra_macica")).toBe(7.5);
    expect(cargaMinima("halteres")).toBe(1.5);
    expect(cargaMinima("polia")).toBe(0);
  });

  it("passo mínimo de 2 kg na barra e nos halteres (1 kg por lado / ponta)", () => {
    for (const imp of ["barra_macica", "halteres"] as const) {
      const escala = cargasPossiveis(imp);
      for (let i = 1; i < escala.length; i++) {
        expect(Math.round(((escala[i] as number) - (escala[i - 1] as number)) * 10) / 10).toBe(2);
      }
    }
  });
});

describe("doc, linha 'barra maciça': 7,5 + 2 × S, no máximo 2 de cada peso por lado", () => {
  const escala = cargasPossiveis("barra_macica");

  it("a escala é exatamente 7,5 + 2 × S para S inteiro de 0 a 50", () => {
    const esperada = Array.from({ length: 51 }, (_, s) => 7.5 + 2 * s);
    expect(escala).toEqual(esperada);
  });

  it("exemplos válidos do doc pertencem à escala: 7,5 · 9,5 · 11,5 · 25,5 · 107,5", () => {
    for (const kg of [7.5, 9.5, 11.5, 25.5, 107.5]) expect(escala).toContain(kg);
  });

  it("inválidos do doc caem para baixo: 26,5 → 25,5 · 8 → 7,5 · 110 → 107,5", () => {
    expect(alcancavelParaBaixo(26.5, "barra_macica")).toBe(25.5);
    expect(alcancavelParaBaixo(8, "barra_macica")).toBe(7.5);
    expect(alcancavelParaBaixo(110, "barra_macica")).toBe(107.5);
    expect(montagem(26.5, "barra_macica").total).toBe(25.5);
    expect(montagem(8, "barra_macica").total).toBe(7.5);
    expect(montagem(110, "barra_macica").total).toBe(107.5);
  });

  it("25,5 é montado como 5 · 4 de um lado (exemplo do doc)", () => {
    expect(montagem(25.5, "barra_macica").porLado).toEqual([5, 4]);
  });

  it("107,5 usa o estoque inteiro: 10·10·5·5·4·4·3·3·2·2·1·1 por lado", () => {
    expect(montagem(107.5, "barra_macica").porLado).toEqual([
      10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1,
    ]);
    expect(cargaMaxima("barra_macica")).toBe(107.5);
  });

  it("toda carga da escala fecha exata, com no máximo 2 anilhas de cada peso por lado", () => {
    for (const carga of escala) {
      const m = montagem(carga, "barra_macica");
      expect(m.exato).toBe(true);
      expect(7.5 + 2 * soma(m.anilhas)).toBeCloseTo(carga, 6);
      const conta = new Map<number, number>();
      for (const a of m.anilhas) conta.set(a, (conta.get(a) ?? 0) + 1);
      for (const [, n] of conta) expect(n).toBeLessThanOrEqual(2);
    }
  });

  it("doc, nota do guloso: 1·2·3·4·5·10 (2 de cada) cobrem todo inteiro de 1 a 50", () => {
    for (let s = 1; s <= 50; s++) {
      expect(montagem(7.5 + 2 * s, "barra_macica").exato).toBe(true);
    }
  });
});

describe("doc, linha 'halteres (par)': 1,5 + 2 × S por halter, 1 de cada peso por ponta", () => {
  const escala = cargasPossiveis("halteres");

  it("a escala por halter é 1,5 + 2 × S com S de 0 a 19 (capacidade 40 kg)", () => {
    const esperada = Array.from({ length: 20 }, (_, s) => 1.5 + 2 * s);
    expect(escala).toEqual(esperada);
    expect(cargaMaxima("halteres")).toBe(39.5);
  });

  it("exemplos válidos do doc: 1,5 · 3,5 (1) · 5,5 (2) · 11,5 (5) · 21,5 (10) · 39,5 (10·5·4)", () => {
    expect(montagem(1.5, "halteres").porPonta).toEqual([]);
    expect(montagem(3.5, "halteres").porPonta).toEqual([1]);
    expect(montagem(5.5, "halteres").porPonta).toEqual([2]);
    expect(montagem(11.5, "halteres").porPonta).toEqual([5]);
    expect(montagem(21.5, "halteres").porPonta).toEqual([10]);
    expect(montagem(39.5, "halteres").porPonta).toEqual([10, 5, 4]);
  });

  it("inválidos do doc: 4,5 → 3,5 · 6 → 5,5 · 41,5 → 39,5", () => {
    expect(alcancavelParaBaixo(4.5, "halteres")).toBe(3.5);
    expect(alcancavelParaBaixo(6, "halteres")).toBe(5.5);
    expect(alcancavelParaBaixo(41.5, "halteres")).toBe(39.5);
    expect(montagem(41.5, "halteres").total).toBe(39.5);
  });

  it("nenhuma ponta repete um peso (os dois halteres consomem as 4 do estoque)", () => {
    for (const carga of escala) {
      const m = montagem(carga, "halteres");
      expect(m.exato).toBe(true);
      expect(1.5 + 2 * soma(m.anilhas)).toBeCloseTo(carga, 6);
      expect(new Set(m.anilhas).size).toBe(m.anilhas.length);
    }
  });
});

describe("doc, linha 'polia (pino)': qualquer soma do estoque, capacidade 100", () => {
  it("a escala do pino é todo inteiro de 0 a 100", () => {
    expect(cargasPossiveis("polia")).toEqual(Array.from({ length: 101 }, (_, i) => i));
  });

  it("exemplos válidos do doc: 1 · 2 · 4 · 6 · 9 · 20", () => {
    for (const kg of [1, 2, 4, 6, 9, 20]) {
      const m = montagem(kg, "polia");
      expect(m.exato).toBe(true);
      expect(soma(m.noPino ?? [])).toBe(kg);
    }
  });

  it("inválidos do doc: 0,5 → 0 · 101 → 100", () => {
    expect(montagem(0.5, "polia").total).toBe(0);
    expect(montagem(0.5, "polia").exato).toBe(false);
    expect(montagem(101, "polia").total).toBe(100);
    expect(cargaMaxima("polia")).toBe(100);
  });
});

describe("doc, linha 'barra W': 2,0 (a pesar) + 2 × S, capacidade 50", () => {
  it("sem pesar, a barra W vale 2,0 kg e a escala vai de 2 a 50 de 2 em 2", () => {
    const escala = cargasPossiveis("barra_w");
    expect(escala[0]).toBe(2);
    expect(escala[escala.length - 1]).toBe(50);
    expect(escala).toEqual(Array.from({ length: 25 }, (_, s) => 2 + 2 * s));
  });

  it("inválido do doc: 52 → 50", () => {
    expect(montagem(52, "barra_w").total).toBe(50);
    expect(montagem(52, "barra_w").exato).toBe(false);
  });
});

describe("doc, exemplos literais de montagem()", () => {
  it('montagem(25.5, "barra_macica") → { porLado: [5, 4], total: 25.5, exato: true }', () => {
    const m = montagem(25.5, "barra_macica");
    expect(m.porLado).toEqual([5, 4]);
    expect(m.total).toBe(25.5);
    expect(m.exato).toBe(true);
    expect(m.diferenca).toBeUndefined();
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

  it("montagem(107.5) → porLado [10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1], exato", () => {
    const m = montagem(107.5, "barra_macica");
    expect(m.porLado).toEqual([10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
    expect(m.exato).toBe(true);
    expect(m.aviso).toBeUndefined();
  });

  it('montagem(109.5) → 107,5 com aviso "faltam anilhas de 10 kg"', () => {
    const m = montagem(109.5, "barra_macica");
    expect(m.total).toBe(107.5);
    expect(m.exato).toBe(false);
    expect(m.diferenca).toBe(-2);
    expect(m.aviso).toBe("faltam anilhas de 10 kg");
  });
});

/* ===================================================================== */
/* PARTE 2 — os 22 casos                                                 */
/* ===================================================================== */

describe("caso 1 — supino reto (3 × 5–8), 1ª sessão, 8/8/8 firme", () => {
  it("a prescrição do JSON é mesmo 3 × 5–8", () => {
    const p = prescricaoPadrao(supino);
    expect([p.series, p.min, p.max, p.tipo]).toEqual([3, 5, 8, "reps"]);
  });

  it("a 1ª sessão parte da barra vazia: 7,5 kg", () => {
    const hoje = cargaDeHoje(supino, null);
    expect(hoje.carga_kg).toBe(7.5);
    expect(hoje.primeira_vez).toBe(true);
  });

  it("resultado: subiu, carga 9,5, falhas 0", () => {
    const d = decidir(supino, null, reps(8, 8, 8), { ultimaFirme: true });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(d.evento?.falha).toBeUndefined();
    expect(d.evento?.de).toMatchObject({ carga_kg: 7.5 });
    expect(d.evento?.para).toMatchObject({ carga_kg: 9.5 });
  });
});

describe("caso 2 — supino reto, carga 9,5, 8/8/7 firme", () => {
  it("resultado: repetiu, carga 9,5 (não chegou ao topo em todas)", () => {
    const d = decidir(supino, estado(supino, { carga_atual_kg: 9.5 }), reps(8, 8, 7), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
  });

  it("7 está dentro da faixa 5–8: não é falha", () => {
    const d = decidir(supino, estado(supino, { carga_atual_kg: 9.5 }), reps(8, 8, 7), {
      ultimaFirme: true,
    });
    expect(d.evento?.falha).toBeUndefined();
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 3 — supino reto, carga 9,5, 8/8/8 SEM firme", () => {
  it("resultado: repetiu, carga 9,5", () => {
    const d = decidir(supino, estado(supino, { carga_atual_kg: 9.5 }), reps(8, 8, 8), {
      ultimaFirme: false,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 4 — supino reto, carga 25,5, falhas 0, 8/6/4", () => {
  const d = decidir(
    supino,
    estado(supino, { carga_atual_kg: 25.5, falhas_seguidas: 0 }),
    reps(8, 6, 4),
    { ultimaFirme: true },
  );

  it("falha nº 1: repetiu a mesma carga (25,5), marcado como falha", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.carga_atual_kg).toBe(25.5);
  });

  it("falhas_seguidas = 1", () => {
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("a 1ª falha não mexe no incremento nem na exigência de repetição extra", () => {
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(d.novoEstado.exigir_rep_extra).toBe(false);
    expect(incrementoDe(supino, d.novoEstado)).toBe(2);
  });
});

describe("caso 5 — supino reto, carga 25,5, falhas 1, 7/5/3", () => {
  const d = decidir(
    supino,
    estado(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 }),
    reps(7, 5, 3),
    { ultimaFirme: true },
  );

  it("falha nº 2: motivo falha_2x_voltou_10", () => {
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(d.evento?.falha).toBe(true);
  });

  it("carga = alcançável ≤ 25,5 × 0,9 = 22,95 → 21,5", () => {
    expect(d.novoEstado.carga_atual_kg).toBe(21.5);
  });

  it("falhas_seguidas = 2", () => {
    expect(d.novoEstado.falhas_seguidas).toBe(2);
  });

  it("2 ÷ 2 = 1 < passo mínimo 2: o incremento continua 2 kg", () => {
    expect(d.novoEstado.incremento_reduzido).toBe(true);
    expect(incrementoDe(supino, d.novoEstado)).toBe(2);
  });

  it("passa a exigir topo da faixa + 1 rep (9, 9, 9) para a próxima subida", () => {
    expect(d.novoEstado.exigir_rep_extra).toBe(true);
    const com8 = decidir(supino, d.novoEstado, reps(8, 8, 8), { ultimaFirme: true });
    expect(com8.evento?.motivo).toBe("repetiu");
    expect(com8.novoEstado.carga_atual_kg).toBe(21.5);
    const com9 = decidir(supino, d.novoEstado, reps(9, 9, 9), { ultimaFirme: true });
    expect(com9.evento?.motivo).toBe("subiu");
    expect(com9.novoEstado.carga_atual_kg).toBe(23.5);
  });

  it("depois da subida, a exigência e o incremento reduzido somem", () => {
    const com9 = decidir(supino, d.novoEstado, reps(9, 9, 9), { ultimaFirme: true });
    expect(com9.novoEstado.exigir_rep_extra).toBe(false);
    expect(com9.novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(supino, com9.novoEstado)).toBe(2);
  });

  it("a tela do dia seguinte mostra 21,5 kg e o topo 8 (a exigência é do motor)", () => {
    const hoje = cargaDeHoje(supino, d.novoEstado);
    expect(hoje.carga_kg).toBe(21.5);
    expect(hoje.alvo_max).toBe(8);
    expect(hoje.exigir_rep_extra).toBe(true);
  });
});

describe("caso 6 — agachamento livre (3 × 5), carga 39,5, falhas 1, 5/4/3", () => {
  const d = decidir(
    agachamento,
    estado(agachamento, { carga_atual_kg: 39.5, falhas_seguidas: 1 }),
    reps(5, 4, 3),
    { ultimaFirme: true },
  );

  it("a prescrição do JSON é 3 × 5 (min = max = 5) e o incremento é 4 kg", () => {
    const p = prescricaoPadrao(agachamento);
    expect([p.series, p.min, p.max]).toEqual([3, 5, 5]);
    expect(incrementoDe(agachamento, null)).toBe(4);
  });

  it("falha nº 2: carga alcançável ≤ 35,55 → 35,5", () => {
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(d.novoEstado.carga_atual_kg).toBe(35.5);
  });

  it("incremento 4 → 2 kg até a próxima subida", () => {
    expect(d.novoEstado.incremento_reduzido).toBe(true);
    expect(incrementoDe(agachamento, d.novoEstado)).toBe(2);
  });

  it("falhas 2 e, com incremento 4, não passa a exigir repetição extra", () => {
    expect(d.novoEstado.falhas_seguidas).toBe(2);
    expect(d.novoEstado.exigir_rep_extra).toBe(false);
  });
});

describe("caso 7 — agachamento livre, carga 35,5, falhas 2, incremento reduzido, 5/5/5 firme", () => {
  const antes = estado(agachamento, {
    carga_atual_kg: 35.5,
    falhas_seguidas: 2,
    incremento_reduzido: true,
    exigir_rep_extra: false,
  });
  const d = decidir(agachamento, antes, reps(5, 5, 5), { ultimaFirme: true });

  it("sobe 2 kg (o incremento reduzido): 37,5", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(37.5);
  });

  it("zera as falhas", () => {
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });

  it("o incremento volta a 4 kg", () => {
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(agachamento, d.novoEstado)).toBe(4);
  });
});

describe("caso 8 — levantamento terra (3 × 5), carga 47,5, falhas 2, 4/3/3", () => {
  const d = decidir(
    terra,
    estado(terra, { carga_atual_kg: 47.5, falhas_seguidas: 2 }),
    reps(4, 3, 3),
    { ultimaFirme: true },
  );

  it("falha nº 3: motivo semana_leve_60", () => {
    expect(d.evento?.motivo).toBe("semana_leve_60");
    expect(d.evento?.falha).toBe(true);
  });

  it("a próxima sessão é a alcançável ≤ 28,5 → 27,5", () => {
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
    expect(cargaDeHoje(terra, d.novoEstado).carga_kg).toBe(27.5);
  });

  it("marca semana_leve, guarda a carga de antes e zera falhas_seguidas", () => {
    expect(d.novoEstado.semana_leve).toBe(true);
    expect(d.novoEstado.carga_antes_leve).toBe(47.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });

  it("mesmas séries: a prescrição do dia continua 3 × 5", () => {
    const hoje = cargaDeHoje(terra, d.novoEstado);
    expect([hoje.alvo_min, hoje.alvo_max]).toEqual([5, 5]);
  });
});

describe("caso 9 — levantamento terra na sessão da semana leve (27,5), 5/5/5", () => {
  const leve = decidir(
    terra,
    estado(terra, { carga_atual_kg: 47.5, falhas_seguidas: 2 }),
    reps(4, 3, 3),
    { ultimaFirme: true },
  ).novoEstado;
  const d = decidir(terra, leve, reps(5, 5, 5), { ultimaFirme: true });

  it("volta à carga de antes da semana leve: 47,5", () => {
    expect(d.novoEstado.carga_atual_kg).toBe(47.5);
    expect(d.novoEstado.semana_leve).toBe(false);
    expect(d.novoEstado.carga_antes_leve).toBeNull();
  });

  it("evento com motivo fim_semana_leve, de 27,5 para 47,5", () => {
    expect(d.evento?.motivo).toBe("fim_semana_leve");
    expect(d.evento?.de).toMatchObject({ carga_kg: 27.5 });
    expect(d.evento?.para).toMatchObject({ carga_kg: 47.5 });
  });

  it("incremento normal de 4 kg depois da semana leve", () => {
    expect(incrementoDe(terra, d.novoEstado)).toBe(4);
    expect(d.novoEstado.incremento_reduzido).toBe(false);
  });
});

describe("caso 10 — rosca alternada (3 × 10–12 por braço), 12/12, 12/12, 12/11", () => {
  const d = decidir(
    roscaAlternada,
    estado(roscaAlternada, { carga_atual_kg: 1.5 }),
    repsLados([12, 12], [12, 12], [12, 11]),
    { ultimaFirme: true },
  );

  it("o exercício é mesmo unilateral, 3 × 10–12", () => {
    const p = prescricaoPadrao(roscaAlternada);
    expect([p.series, p.min, p.max, p.unilateral]).toEqual([3, 10, 12, true]);
  });

  it("vale o menor lado: 11 < 12 na 3ª série → repetiu", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(1.5);
  });

  it("11 está dentro da faixa: não conta falha", () => {
    expect(d.evento?.falha).toBeUndefined();
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });
});

describe("caso 11 — rosca alternada, 1,5 por halter, 12/12 nas 3, firme", () => {
  const d = decidir(
    roscaAlternada,
    estado(roscaAlternada, { carga_atual_kg: 1.5 }),
    repsLados([12, 12], [12, 12], [12, 12]),
    { ultimaFirme: true },
  );

  it("sobe para 3,5 kg por halter", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(3.5);
  });

  it("3,5 é 1 kg em cada ponta", () => {
    expect(montagem(3.5, "halteres").porPonta).toEqual([1]);
    expect(cargaDeHoje(roscaAlternada, d.novoEstado).montagem?.porPonta).toEqual([1]);
  });
});

describe("caso 12 — puxada alta na polia (3 × 10–12), 1ª sessão, 4 kg, 12/12/12 firme", () => {
  it("a 1ª sessão começa com 4 kg no pino", () => {
    expect(cargaDeHoje(puxada, null).carga_kg).toBe(4);
  });

  it("sobe para 6 kg", () => {
    const d = decidir(puxada, null, reps(12, 12, 12), { ultimaFirme: true });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(6);
  });
});

describe("caso 13 — barra fixa assistida (4 × 5–8), pe_inteiro, 8/8/8/8 firme", () => {
  const antes = estado(fixaAssistida, { assistencia: "pe_inteiro" });
  const d = decidir(fixaAssistida, antes, reps(8, 8, 8, 8), { ultimaFirme: true });

  it("a prescrição do JSON é 4 × 5–8", () => {
    const p = prescricaoPadrao(fixaAssistida);
    expect([p.series, p.min, p.max]).toEqual([4, 5, 8]);
  });

  it("sobe um degrau: pe_inteiro → joelho", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.assistencia).toBe("joelho");
    expect(d.evento?.de).toMatchObject({ assistencia: "pe_inteiro" });
    expect(d.evento?.para).toMatchObject({ assistencia: "joelho" });
  });

  it("a carga não muda", () => {
    expect(d.novoEstado.carga_atual_kg).toBe(antes.carga_atual_kg);
  });

  it("sessoes_de_graca = 2", () => {
    expect(d.novoEstado.sessoes_graca).toBe(2);
  });
});

describe("caso 14 — barra fixa assistida, joelho, 1ª sessão após mudar, 5/5/4/4", () => {
  const depoisDaTroca = decidir(
    fixaAssistida,
    estado(fixaAssistida, { assistencia: "pe_inteiro" }),
    reps(8, 8, 8, 8),
    { ultimaFirme: true },
  ).novoEstado;
  const d = decidir(fixaAssistida, depoisDaTroca, reps(5, 5, 4, 4), { ultimaFirme: true });

  it("dentro da graça → repetiu", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.assistencia).toBe("joelho");
  });

  it("NÃO conta falha", () => {
    expect(d.evento?.falha).toBeUndefined();
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });

  it("a graça vale 2 sessões e a 3ª já conta falha", () => {
    expect(d.novoEstado.sessoes_graca).toBe(1);
    const segunda = decidir(fixaAssistida, d.novoEstado, reps(5, 5, 4, 4), {
      ultimaFirme: true,
    });
    expect(segunda.evento?.falha).toBeUndefined();
    expect(segunda.novoEstado.falhas_seguidas).toBe(0);
    expect(segunda.novoEstado.sessoes_graca).toBe(0);
    const terceira = decidir(fixaAssistida, segunda.novoEstado, reps(5, 5, 4, 4), {
      ultimaFirme: true,
    });
    expect(terceira.evento?.falha).toBe(true);
    expect(terceira.novoEstado.falhas_seguidas).toBe(1);
  });
});

describe("caso 15 — barra fixa pronada (3 × máximo), média anterior 4,0 (4, 4, 4), 5/5/5", () => {
  const d = decidir(fixaPronada, estado(fixaPronada), reps(5, 5, 5), {
    seriesAnteriores: [4, 4, 4],
  });

  it("a prescrição do JSON é 3 × máximo", () => {
    expect(prescricaoPadrao(fixaPronada).tipo).toBe("maximo");
  });

  it("subiu: média +1 e nenhuma série abaixo da correspondente", () => {
    expect(d.evento?.motivo).toBe("subiu");
  });

  it("média +1 mas uma série abaixo da anterior NÃO sobe", () => {
    const caiu = decidir(fixaPronada, estado(fixaPronada), reps(4, 5, 6), {
      seriesAnteriores: [6, 4, 2],
    });
    expect(caiu.evento?.motivo).not.toBe("subiu");
  });

  it("3 séries ≥ 10 → sugere a barra fixa com lastro", () => {
    const lastro = decidir(fixaPronada, estado(fixaPronada), reps(10, 10, 10), {
      seriesAnteriores: [9, 9, 9],
    });
    expect(txt(lastro.evento?.sugestao)).toMatch(/lastro/i);
  });
});

describe("caso 16 — prancha (3 × 30–60 s), tempo alvo 30, 60/60/60 firme", () => {
  const d = decidir(prancha, estado(prancha, { tempo_alvo_s: 30 }), tempos(60, 60, 60), {
    ultimaFirme: true,
  });

  it("a prescrição do JSON é 3 × 30–60 s e o estado inicial guarda 30", () => {
    const p = prescricaoPadrao(prancha);
    expect([p.series, p.min, p.max, p.tipo]).toEqual([3, 30, 60, "tempo_s"]);
    expect(estadoInicial(prancha).tempo_alvo_s).toBe(30);
  });

  it("subiu: tempo alvo 65 s", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.tempo_alvo_s).toBe(65);
  });

  it("acima da faixa: sugere variação", () => {
    expect(txt(d.evento?.sugestao)).toMatch(/varia/i);
  });

  it("no dia seguinte o alvo a bater é 65 s nas três séries", () => {
    const hoje = cargaDeHoje(prancha, d.novoEstado);
    expect(hoje.alvo_max).toBe(65);
    expect(hoje.tempo_alvo_s).toBe(65);
  });
});

describe("caso 17 — elevação de pernas na barra fixa (3 × 10–15), reps alvo 10, 15/15/15 firme", () => {
  const d = decidir(
    elevacaoPernas,
    estado(elevacaoPernas, { reps_alvo: 10 }),
    reps(15, 15, 15),
    { ultimaFirme: true },
  );

  it("a prescrição do JSON é 3 × 10–15 e o estado inicial guarda 10", () => {
    const p = prescricaoPadrao(elevacaoPernas);
    expect([p.series, p.min, p.max]).toEqual([3, 10, 15]);
    expect(estadoInicial(elevacaoPernas).reps_alvo).toBe(10);
  });

  it("subiu: reps alvo 16", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(16);
  });

  it("todas passando de 20 → sugere a anilha de 2 kg e voltar ao piso", () => {
    const acima = decidir(
      elevacaoPernas,
      estado(elevacaoPernas, { reps_alvo: 20 }),
      reps(21, 21, 21),
      { ultimaFirme: true },
    );
    expect(txt(acima.evento?.sugestao)).toMatch(/anilha/i);
    expect(txt(acima.evento?.sugestao)).toMatch(/2 kg/i);
  });

  it("20 redondas ainda não passaram de 20: sem sugestão", () => {
    const vinte = decidir(
      elevacaoPernas,
      estado(elevacaoPernas, { reps_alvo: 19 }),
      reps(20, 20, 20),
      { ultimaFirme: true },
    );
    expect(vinte.evento?.sugestao).toBeUndefined();
  });
});

describe("caso 18 — agachamento búlgaro (3 × 8–10 por perna), halteres 5,5, 10/10, 10/10, 10/9", () => {
  const d = decidir(
    bulgaro,
    estado(bulgaro, { carga_atual_kg: 5.5 }),
    repsLados([10, 10], [10, 10], [10, 9]),
    { ultimaFirme: true },
  );

  it("repetiu pelo menor lado", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(5.5);
    expect(d.evento?.falha).toBeUndefined();
  });

  it("com 10/10 nas três, sobe para 7,5 por halter", () => {
    const sobe = decidir(
      bulgaro,
      estado(bulgaro, { carga_atual_kg: 5.5 }),
      repsLados([10, 10], [10, 10], [10, 10]),
      { ultimaFirme: true },
    );
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.carga_atual_kg).toBe(7.5);
  });
});

describe("caso 19 — farmer's walk (3 × 30–40 passos), halteres 11,5, 40/40/40 firme", () => {
  const d = decidir(farmer, estado(farmer, { carga_atual_kg: 11.5 }), passos(40, 40, 40), {
    ultimaFirme: true,
  });

  it("a prescrição do JSON é 3 × 30–40 passos", () => {
    const p = prescricaoPadrao(farmer);
    expect([p.series, p.min, p.max, p.tipo]).toEqual([3, 30, 40, "passos"]);
  });

  it("subiu: 13,5 por halter", () => {
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(13.5);
  });

  it("com 35 passos numa das séries, repete", () => {
    const repete = decidir(
      farmer,
      estado(farmer, { carga_atual_kg: 11.5 }),
      passos(40, 40, 35),
      { ultimaFirme: true },
    );
    expect(repete.evento?.motivo).toBe("repetiu");
    expect(repete.novoEstado.carga_atual_kg).toBe(11.5);
  });
});

describe("caso 20 — sessão abandonada com 1 série registrada", () => {
  const antes = estado(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 });
  const d = decidir(supino, antes, reps(8), { sessaoAbandonada: true });

  it("não avalia: sem evento", () => {
    expect(d.evento).toBeNull();
  });

  it("estado inalterado", () => {
    expect(d.novoEstado).toEqual(antes);
  });

  it("numa sessão abandonada com TODAS as séries registradas, avalia normalmente", () => {
    const completa = decidir(supino, antes, reps(8, 8, 8), {
      sessaoAbandonada: true,
      ultimaFirme: true,
    });
    expect(completa.evento?.motivo).toBe("subiu");
  });
});

describe("caso 21 — supino reto substituído por supino inclinado com halteres", () => {
  const estadoSupino = estado(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 });
  const estadoSubstituto = estado(supinoInclinadoHalteres, { carga_atual_kg: 1.5 });

  it("o substituto sobe com 12/12/12 firme (faixa 8–12)", () => {
    const p = prescricaoPadrao(supinoInclinadoHalteres);
    expect([p.min, p.max]).toEqual([8, 12]);
    const d = decidir(supinoInclinadoHalteres, estadoSubstituto, reps(12, 12, 12), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(3.5);
  });

  it("o supino reto não é avaliado: sem séries, estado intacto e sem evento", () => {
    const d = decidir(supino, estadoSupino, []);
    expect(d.evento).toBeNull();
    expect(d.novoEstado).toEqual(estadoSupino);
    expect(estadoSupino.carga_atual_kg).toBe(25.5);
    expect(estadoSupino.falhas_seguidas).toBe(1);
  });
});

describe("caso 22 — supino reto na carga 107,5 (teto), 8/8/8 firme", () => {
  const d = decidir(supino, estado(supino, { carga_atual_kg: 107.5 }), reps(8, 8, 8), {
    ultimaFirme: true,
  });

  it("subiu impossível → repetiu", () => {
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(107.5);
  });

  it('aviso "faltam anilhas de 10 kg (marco do guia)"', () => {
    expect(txt(d.evento?.aviso)).toBe("faltam anilhas de 10 kg (marco do guia)");
  });
});

/* ===================================================================== */
/* PARTE 3 — regras derivadas dos casos (fim do doc)                     */
/* ===================================================================== */

describe("doc, regras derivadas", () => {
  it("alcancavel_para_baixo vale em toda carga calculada: subida, −10 % e 60 %", () => {
    // Abaixo da barra vazia não há o que tirar: a escala trava no mínimo.
    const naEscala = (alvo: number, obtido: number | null, escala: number[]): void => {
      expect(escala).toContain(obtido);
      const piso = escala[0] as number;
      expect(obtido as number).toBeLessThanOrEqual(Math.max(alvo, piso) + 1e-9);
    };
    const casos: { e: Exercicio; cargas: number[] }[] = [
      { e: supino, cargas: [9.5, 25.5, 47.5, 63.5, 87.5] },
      { e: roscaAlternada, cargas: [5.5, 13.5, 21.5, 39.5] },
      { e: puxada, cargas: [4, 9, 20, 37] },
    ];
    for (const { e, cargas } of casos) {
      const escala = cargasPossiveis(e.implemento);
      const p = prescricaoPadrao(e);
      const topo = p.max as number;
      const abaixo = (p.min as number) - 1;
      for (const carga of cargas) {
        const sobe = decidir(
          e,
          estado(e, { carga_atual_kg: carga }),
          reps(topo, topo, topo),
          { ultimaFirme: true },
        );
        expect(escala).toContain(sobe.novoEstado.carga_atual_kg);

        const menos10 = decidir(
          e,
          estado(e, { carga_atual_kg: carga, falhas_seguidas: 1 }),
          reps(abaixo, abaixo, abaixo),
          { ultimaFirme: true },
        );
        naEscala(carga * 0.9, menos10.novoEstado.carga_atual_kg, escala);

        const leve = decidir(
          e,
          estado(e, { carga_atual_kg: carga, falhas_seguidas: 2 }),
          reps(abaixo, abaixo, abaixo),
          { ultimaFirme: true },
        );
        naEscala(carga * 0.6, leve.novoEstado.carga_atual_kg, escala);
      }
    }
  });

  it("incremento reduzido = max(incremento ÷ 2, 2) para 2 kg e para 4 kg", () => {
    const de2 = estado(supino, { incremento_reduzido: true });
    expect(incrementoDe(supino, de2)).toBe(2);
    const de4 = estado(agachamento, { incremento_reduzido: true });
    expect(incrementoDe(agachamento, de4)).toBe(2);
  });

  it("unilateral: vale o menor dos dois lados em cada série (falha pelo lado fraco)", () => {
    const d = decidir(
      roscaAlternada,
      estado(roscaAlternada, { carga_atual_kg: 5.5 }),
      repsLados([12, 12], [12, 12], [12, 9]),
      { ultimaFirme: true },
    );
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("manteve não mexe em falhas_seguidas (caso 2 com uma falha guardada)", () => {
    const d = decidir(
      supino,
      estado(supino, { carga_atual_kg: 9.5, falhas_seguidas: 1 }),
      reps(8, 8, 7),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("o incremento reduzido dura até a PRÓXIMA SUBIDA, não até a próxima sessão", () => {
    const apos6 = decidir(
      agachamento,
      estado(agachamento, { carga_atual_kg: 39.5, falhas_seguidas: 1 }),
      reps(5, 4, 3),
      { ultimaFirme: true },
    ).novoEstado;
    const manteve = decidir(agachamento, apos6, reps(5, 5, 5), { ultimaFirme: false });
    expect(manteve.evento?.motivo).toBe("repetiu");
    expect(incrementoDe(agachamento, manteve.novoEstado)).toBe(2);

    const apos5 = decidir(
      supino,
      estado(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 }),
      reps(7, 5, 3),
      { ultimaFirme: true },
    ).novoEstado;
    const mantevoSupino = decidir(supino, apos5, reps(8, 8, 8), { ultimaFirme: true });
    expect(mantevoSupino.novoEstado.exigir_rep_extra).toBe(true);
  });

  it("uma sessão abandonada incompleta não consome a semana leve (casos 8, 9 e 20)", () => {
    const leve = decidir(
      terra,
      estado(terra, { carga_atual_kg: 47.5, falhas_seguidas: 2 }),
      reps(4, 3, 3),
      { ultimaFirme: true },
    ).novoEstado;
    const abandonada = decidir(terra, leve, reps(5), { sessaoAbandonada: true });
    expect(abandonada.evento).toBeNull();
    expect(abandonada.novoEstado.semana_leve).toBe(true);
    expect(abandonada.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("máximo: média igual à anterior não sobe; média menor conta falha", () => {
    const igual = decidir(fixaPronada, estado(fixaPronada), reps(4, 4, 4), {
      seriesAnteriores: [4, 4, 4],
    });
    expect(igual.evento?.motivo).not.toBe("subiu");
    expect(igual.evento?.falha).toBeUndefined();

    const menor = decidir(fixaPronada, estado(fixaPronada), reps(3, 3, 3), {
      seriesAnteriores: [4, 4, 4],
    });
    expect(menor.evento?.falha).toBe(true);
  });
});

/* ===================================================================== */
/* PARTE 4 — os casos aplicados aos 81 exercícios reais                  */
/* ===================================================================== */

describe("SPEC §6.1 + casos 1 e 12 — a 1ª sessão parte da carga_inicial do JSON", () => {
  it("os 81 exercícios começam exatamente na carga_inicial.kg do catálogo", () => {
    for (const e of exercicios) {
      const hoje = cargaDeHoje(e, null);
      expect({ id: e.id, kg: hoje.carga_kg }).toEqual({
        id: e.id,
        kg: e.carga_inicial.kg,
      });
    }
  });

  it("reps/tempo alvo da 1ª vez são o mínimo da faixa (SPEC §6.1)", () => {
    for (const e of exercicios) {
      const p = prescricaoPadrao(e);
      const inicial = estadoInicial(e);
      if (e.progressao.tipo === "reps" || e.progressao.tipo === "reps_depois_lastro") {
        expect({ id: e.id, v: inicial.reps_alvo }).toEqual({ id: e.id, v: p.min });
      }
      if (e.progressao.tipo === "tempo") {
        expect({ id: e.id, v: inicial.tempo_alvo_s }).toEqual({ id: e.id, v: p.min });
      }
    }
  });
});

describe("casos 1, 11, 12 e 19 — a subida de todo exercício de carga cai na escala do implemento", () => {
  it("sucesso no topo da faixa sobe exatamente um incremento a partir do inicial", () => {
    for (const e of exercicios) {
      if (e.progressao.tipo !== "carga") continue;
      const p = prescricaoPadrao(e);
      if (p.max === null) continue;
      const series: SerieFeita[] = Array.from({ length: p.series }, () =>
        p.tipo === "passos"
          ? { concluida: true, passos: p.max as number }
          : p.tipo === "tempo_s"
            ? { concluida: true, tempo_s: p.max as number, tempo_s_lado2: p.max as number }
            : {
                concluida: true,
                reps: p.max as number,
                reps_lado2: p.max as number,
              },
      );
      const d = decidir(e, null, series, { ultimaFirme: true });
      const incremento = e.progressao.incremento_kg ?? 0;
      const esperada = alcancavelParaBaixo(
        e.carga_inicial.kg + incremento,
        e.implemento,
      );
      expect({ id: e.id, motivo: d.evento?.motivo, kg: d.novoEstado.carga_atual_kg }).toEqual({
        id: e.id,
        motivo: "subiu",
        kg: esperada,
      });
      expect({ id: e.id, kg: esperada }).toEqual({
        id: e.id,
        kg: e.carga_inicial.kg + incremento,
      });
    }
  });
});

describe("caso 13 — o doc não dá estado antes: a 1ª sessão do assistido já parte de pe_inteiro", () => {
  it("decidir(exercicio, null, 8/8/8/8 firme) sobe para joelho com 2 sessões de graça", () => {
    const d = decidir(fixaAssistida, null, reps(8, 8, 8, 8), { ultimaFirme: true });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.assistencia).toBe("joelho");
    expect(d.novoEstado.sessoes_graca).toBe(2);
    expect(cargaDeHoje(fixaAssistida, null).assistencia).toBe("pe_inteiro");
  });
});

describe("caso 15 — 'média anterior 4,0' guardada no estado, sem série a série", () => {
  it("com reps_alvo 4 e sem seriesAnteriores, 5/5/5 sobe do mesmo jeito", () => {
    const d = decidir(fixaPronada, estado(fixaPronada, { reps_alvo: 4 }), reps(5, 5, 5));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(5);
  });

  it("1ª sessão de 3 × máximo sem referência: registra a média e não inventa evento", () => {
    const d = decidir(fixaPronada, null, reps(3, 3, 2));
    expect(d.evento).toBeNull();
    expect(d.novoEstado.reps_alvo).toBe(3);
  });

  it("3 séries ≥ 10 sugerem o lastro mesmo na 1ª sessão (sem média anterior)", () => {
    const d = decidir(fixaPronada, null, reps(10, 10, 10));
    expect(txt(d.evento?.sugestao)).toMatch(/lastro/i);
  });
});

describe("caso 5 — a decisão gravada no evento e a montagem que a tela mostra", () => {
  const d = decidir(
    supino,
    estado(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 }),
    reps(7, 5, 3),
    { ultimaFirme: true },
  );

  it("evento de 25,5 para 21,5", () => {
    expect(d.evento?.de).toMatchObject({ carga_kg: 25.5 });
    expect(d.evento?.para).toMatchObject({ carga_kg: 21.5 });
  });

  it("21,5 kg = 5 · 2 de cada lado, exato", () => {
    const hoje = cargaDeHoje(supino, d.novoEstado);
    expect(hoje.montagem?.porLado).toEqual([5, 2]);
    expect(hoje.montagem?.exato).toBe(true);
  });
});

describe("doc, cabeçalho — a convenção do implemento aparece na montagem do dia", () => {
  it("barra = por lado, halter = por ponta, polia = no pino", () => {
    expect(cargaDeHoje(supino, null).montagem?.porLado).toBeDefined();
    expect(cargaDeHoje(roscaAlternada, null).montagem?.porPonta).toBeDefined();
    expect(cargaDeHoje(puxada, null).montagem?.noPino).toEqual([4]);
  });
});

/* ===================================================================== */
/* PARTE 5 — reimplementação independente das regras do doc              */
/* ===================================================================== */

/**
 * As regras dos casos 1–9 escritas de novo, direto do doc, com aritmética
 * inteira (tudo × 20) para não depender do ponto flutuante do motor.
 */
interface EstadoRef {
  carga20: number;
  falhas: number;
  reduzido: boolean;
  repExtra: boolean;
  leve: boolean;
  antesLeve20: number | null;
}

interface SaidaRef {
  motivo: string;
  carga20: number;
  falhas: number;
  reduzido: boolean;
  repExtra: boolean;
  leve: boolean;
}

function escala20(e: Exercicio): number[] {
  return cargasPossiveis(e.implemento).map((c) => Math.round(c * 20));
}

/** Maior carga da escala ≤ alvo (em vigésimos de kg); nunca abaixo do piso. */
function paraBaixo20(e: Exercicio, alvo20: number): number {
  const escala = escala20(e);
  let melhor = escala[0] as number;
  for (const c of escala) if (c <= alvo20) melhor = c;
  return melhor;
}

function referencia(
  e: Exercicio,
  antes: EstadoRef,
  valores: number[],
  firme: boolean,
): SaidaRef {
  const p = prescricaoPadrao(e);
  const piso = p.min as number;
  const topo = p.max as number;
  const base = e.progressao.incremento_kg ?? 0;
  const incremento = antes.reduzido ? Math.max(base / 2, 2) : base;

  if (antes.leve) {
    return {
      motivo: "fim_semana_leve",
      carga20: antes.antesLeve20 ?? antes.carga20,
      falhas: 0,
      reduzido: false,
      repExtra: false,
      leve: false,
    };
  }

  const falhou = valores.some((v) => v < piso);
  const subiu = valores.every((v) => v >= topo + (antes.repExtra ? 1 : 0)) && firme;

  if (falhou) {
    const falhas = antes.falhas + 1;
    // Interpretação do motor (fora dos 22 casos): com 0 kg não há o que reduzir,
    // então a 2ª e a 3ª falha repetem e a 3ª zera o contador. Ver o teste
    // "barra fixa com lastro a 0 kg" mais abaixo.
    if (antes.carga20 === 0) {
      return { ...antes, motivo: "repetiu", falhas: falhas >= 3 ? 0 : falhas };
    }
    if (falhas === 1) {
      return { ...antes, motivo: "repetiu", falhas };
    }
    if (falhas === 2) {
      // −10 %: 9/10 em aritmética inteira, nunca subindo.
      const alvo = Math.floor((antes.carga20 * 9) / 10);
      return {
        motivo: "falha_2x_voltou_10",
        carga20: Math.min(antes.carga20, paraBaixo20(e, alvo)),
        falhas: 2,
        reduzido: true,
        repExtra: base / 2 < 2,
        leve: false,
      };
    }
    const alvo = Math.floor((antes.carga20 * 6) / 10);
    return {
      motivo: "semana_leve_60",
      carga20: Math.min(antes.carga20, paraBaixo20(e, alvo)),
      falhas: 0,
      reduzido: antes.reduzido,
      repExtra: antes.repExtra,
      leve: true,
    };
  }

  if (subiu) {
    const nova = paraBaixo20(e, antes.carga20 + Math.round(incremento * 20));
    if (nova <= antes.carga20) {
      return { ...antes, motivo: "repetiu", falhas: 0 };
    }
    return {
      motivo: "subiu",
      carga20: nova,
      falhas: 0,
      reduzido: false,
      repExtra: false,
      leve: false,
    };
  }

  return { ...antes, motivo: "repetiu" };
}

describe("cruzamento com uma reimplementação independente (casos 1–9)", () => {
  const alvos = [supino, agachamento, terra, roscaAlternada, puxada];
  const padroes: number[][] = [];

  it("motor e referência concordam em carga, falhas, flags e motivo", () => {
    for (const e of alvos) {
      const p = prescricaoPadrao(e);
      const piso = p.min as number;
      const topo = p.max as number;
      const listaSeries = [
        [topo, topo, topo],
        [topo, topo, topo + 1],
        [topo + 1, topo + 1, topo + 1],
        [topo, topo, piso],
        [piso, piso, piso],
        [topo, piso, piso - 1],
        [piso - 1, piso - 1, piso - 1],
        [topo, topo, 0],
      ];
      padroes.push(...listaSeries);
      const escala = cargasPossiveis(e.implemento);
      const cargas = [
        escala[0] as number,
        escala[Math.floor(escala.length / 3)] as number,
        escala[Math.floor(escala.length / 2)] as number,
        escala[escala.length - 1] as number,
      ];
      for (const carga of cargas) {
        for (const falhas of [0, 1, 2]) {
          for (const reduzido of [false, true]) {
            for (const repExtra of [false, true]) {
              for (const firme of [false, true]) {
                for (const valores of listaSeries) {
                  const antes = estado(e, {
                    carga_atual_kg: carga,
                    falhas_seguidas: falhas,
                    incremento_reduzido: reduzido,
                    exigir_rep_extra: repExtra,
                  });
                  const d = decidir(e, antes, reps(...valores), { ultimaFirme: firme });
                  const r = referencia(
                    e,
                    {
                      carga20: Math.round(carga * 20),
                      falhas,
                      reduzido,
                      repExtra,
                      leve: false,
                      antesLeve20: null,
                    },
                    valores,
                    firme,
                  );
                  const rotulo = `${e.id} carga=${carga} falhas=${falhas} red=${reduzido} extra=${repExtra} firme=${firme} series=${valores.join("/")}`;
                  expect({
                    rotulo,
                    motivo: d.evento?.motivo,
                    carga20: Math.round((d.novoEstado.carga_atual_kg as number) * 20),
                    falhas: d.novoEstado.falhas_seguidas,
                    reduzido: d.novoEstado.incremento_reduzido,
                    repExtra: d.novoEstado.exigir_rep_extra,
                    leve: d.novoEstado.semana_leve,
                  }).toEqual({
                    rotulo,
                    motivo: r.motivo,
                    carga20: r.carga20,
                    falhas: r.falhas,
                    reduzido: r.reduzido,
                    repExtra: r.repExtra,
                    leve: r.leve,
                  });
                }
              }
            }
          }
        }
      }
    }
    expect(padroes.length).toBeGreaterThan(30);
  });

  it("a sessão da semana leve devolve a carga de antes em qualquer implemento", () => {
    for (const e of [supino, agachamento, terra, roscaAlternada, puxada]) {
      const escala = cargasPossiveis(e.implemento);
      for (const carga of [escala[Math.floor(escala.length / 2)] as number]) {
        const p = prescricaoPadrao(e);
        const abaixo = (p.min as number) - 1;
        const leve = decidir(
          e,
          estado(e, { carga_atual_kg: carga, falhas_seguidas: 2 }),
          reps(abaixo, abaixo, abaixo),
          { ultimaFirme: true },
        ).novoEstado;
        expect(leve.semana_leve).toBe(true);
        const volta = decidir(e, leve, reps(p.max as number, p.max as number, p.max as number), {
          ultimaFirme: true,
        });
        expect({ id: e.id, motivo: volta.evento?.motivo, kg: volta.novoEstado.carga_atual_kg }).toEqual({
          id: e.id,
          motivo: "fim_semana_leve",
          kg: carga,
        });
      }
    }
  });

  it("−10 % e 60 % conferem com a aritmética exata em toda a escala", () => {
    for (const e of [supino, agachamento, roscaAlternada, puxada]) {
      const p = prescricaoPadrao(e);
      const abaixo = (p.min as number) - 1;
      for (const carga of cargasPossiveis(e.implemento)) {
        const c20 = Math.round(carga * 20);
        const menos10 = decidir(
          e,
          estado(e, { carga_atual_kg: carga, falhas_seguidas: 1 }),
          reps(abaixo, abaixo, abaixo),
          { ultimaFirme: true },
        );
        expect({ carga, kg: Math.round((menos10.novoEstado.carga_atual_kg as number) * 20) }).toEqual({
          carga,
          kg: Math.min(c20, paraBaixo20(e, Math.floor((c20 * 9) / 10))),
        });

        const leve = decidir(
          e,
          estado(e, { carga_atual_kg: carga, falhas_seguidas: 2 }),
          reps(abaixo, abaixo, abaixo),
          { ultimaFirme: true },
        );
        expect({ carga, kg: Math.round((leve.novoEstado.carga_atual_kg as number) * 20) }).toEqual({
          carga,
          kg: Math.min(c20, paraBaixo20(e, Math.floor((c20 * 6) / 10))),
        });
      }
    }
  });
});

describe("borda fora dos 22 casos — exercício de carga com 0 kg (barra fixa com lastro)", () => {
  const lastro = acharExercicio("barra-fixa-com-lastro");

  it("com 0 kg de lastro a 2ª falha repete em vez de tirar 10 % (nada a reduzir)", () => {
    const d = decidir(
      lastro,
      estado(lastro, { carga_atual_kg: 0, falhas_seguidas: 1 }),
      reps(3, 3, 3, 3),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.carga_atual_kg).toBe(0);
    expect(d.novoEstado.falhas_seguidas).toBe(2);
  });

  it("com lastro > 0 a 2ª falha volta 10 % normalmente", () => {
    const d = decidir(
      lastro,
      estado(lastro, { carga_atual_kg: 10, falhas_seguidas: 1 }),
      reps(3, 3, 3, 3),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(d.novoEstado.carga_atual_kg).toBe(9);
  });
});

/* ===================================================================== */
/* PARTE 6 — cruzamento dos tipos reps, tempo e assistência              */
/* ===================================================================== */

describe("cruzamento independente — tipo reps (caso 17) e tipo tempo (caso 16)", () => {
  it("reps: sucesso soma incremento_reps ao topo efetivo; abaixo do piso é falha", () => {
    for (const e of [elevacaoPernas, acharExercicio("abdominal-supra")]) {
      const p = prescricaoPadrao(e);
      const piso = p.min as number;
      const teto = p.max as number;
      const passo = e.progressao.incremento_reps ?? 1;
      for (const alvo of [piso, teto, teto + 3]) {
        const topoEfetivo = Math.max(teto, alvo);
        for (const valores of [
          [topoEfetivo, topoEfetivo, topoEfetivo],
          [topoEfetivo, topoEfetivo, topoEfetivo - 1],
          [piso, piso, piso],
          [piso - 1, piso, piso],
        ]) {
          const d = decidir(e, estado(e, { reps_alvo: alvo }), reps(...valores), {
            ultimaFirme: true,
          });
          const sucesso = valores.every((v) => v >= topoEfetivo);
          const falha = valores.some((v) => v < piso);
          const rotulo = `${e.id} alvo=${alvo} series=${valores.join("/")}`;
          expect({ rotulo, motivo: d.evento?.motivo, alvo: d.novoEstado.reps_alvo }).toEqual({
            rotulo,
            motivo: sucesso ? "subiu" : "repetiu",
            alvo: sucesso ? topoEfetivo + passo : alvo,
          });
          expect({ rotulo, falha: d.evento?.falha ?? false }).toEqual({ rotulo, falha });
        }
      }
    }
  });

  it("tempo: sucesso soma incremento_s ao topo efetivo (5 s), o resto repete", () => {
    for (const e of [prancha, acharExercicio("escalador")]) {
      const p = prescricaoPadrao(e);
      const piso = p.min as number;
      const teto = p.max as number;
      const passo = e.progressao.incremento_s ?? 5;
      for (const alvo of [piso, teto, teto + 10]) {
        const topoEfetivo = Math.max(teto, alvo);
        for (const valores of [
          [topoEfetivo, topoEfetivo, topoEfetivo],
          [topoEfetivo, topoEfetivo, piso],
          [piso - 1, piso, piso],
        ]) {
          const series = valores.map((t) => ({
            concluida: true,
            tempo_s: t,
            tempo_s_lado2: t,
          }));
          const d = decidir(e, estado(e, { tempo_alvo_s: alvo }), series, {
            ultimaFirme: true,
          });
          const sucesso = valores.every((v) => v >= topoEfetivo);
          const rotulo = `${e.id} alvo=${alvo} series=${valores.join("/")}`;
          expect({ rotulo, motivo: d.evento?.motivo, alvo: d.novoEstado.tempo_alvo_s }).toEqual({
            rotulo,
            motivo: sucesso ? "subiu" : "repetiu",
            alvo: sucesso ? topoEfetivo + passo : alvo,
          });
        }
      }
    }
  });

  it("sem firme nenhum tipo sobe (SPEC §6.2, caso 3)", () => {
    const r = decidir(elevacaoPernas, estado(elevacaoPernas, { reps_alvo: 10 }), reps(15, 15, 15), {
      ultimaFirme: false,
    });
    expect(r.evento?.motivo).toBe("repetiu");
    const t = decidir(prancha, estado(prancha, { tempo_alvo_s: 30 }), tempos(60, 60, 60), {
      ultimaFirme: false,
    });
    expect(t.evento?.motivo).toBe("repetiu");
    const a = decidir(fixaAssistida, estado(fixaAssistida), reps(8, 8, 8, 8), {
      ultimaFirme: false,
    });
    expect(a.evento?.motivo).toBe("repetiu");
    expect(a.novoEstado.assistencia).toBe("pe_inteiro");
  });
});

describe("cruzamento independente — degraus da assistência (casos 13 e 14)", () => {
  it("a escada pe_inteiro → joelho → joelho_dobrado → sem sobe um degrau por sucesso", () => {
    let atual = estado(fixaAssistida);
    for (const esperado of ["joelho", "joelho_dobrado", "sem"]) {
      const d = decidir(fixaAssistida, atual, reps(8, 8, 8, 8), { ultimaFirme: true });
      expect(d.evento?.motivo).toBe("subiu");
      expect(d.novoEstado.assistencia).toBe(esperado);
      expect(d.novoEstado.sessoes_graca).toBe(2);
      atual = { ...d.novoEstado, sessoes_graca: 0 };
    }
  });

  it("sem elástico, o sucesso vira repetiu com sugestão de barra fixa com lastro", () => {
    const d = decidir(
      fixaAssistida,
      estado(fixaAssistida, { assistencia: "sem" }),
      reps(8, 8, 8, 8),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.assistencia).toBe("sem");
    expect(txt(d.evento?.sugestao)).toMatch(/lastro/i);
  });

  it("a graça só protege quedas: uma sessão dentro da faixa segue sendo repetiu", () => {
    const d = decidir(
      fixaAssistida,
      estado(fixaAssistida, { assistencia: "joelho", sessoes_graca: 2 }),
      reps(6, 6, 6, 6),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBeUndefined();
    expect(d.novoEstado.sessoes_graca).toBe(1);
  });

  it("dentro da graça, um sucesso no topo ainda sobe de degrau", () => {
    const d = decidir(
      fixaAssistida,
      estado(fixaAssistida, { assistencia: "joelho", sessoes_graca: 2 }),
      reps(8, 8, 8, 8),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.assistencia).toBe("joelho_dobrado");
    expect(d.novoEstado.sessoes_graca).toBe(2);
  });
});

describe("cruzamento independente — tipo máximo (caso 15)", () => {
  const casos: { antes: number[]; agora: number[]; sobe: boolean }[] = [
    { antes: [4, 4, 4], agora: [5, 5, 5], sobe: true },
    { antes: [4, 4, 4], agora: [6, 5, 4], sobe: true },
    { antes: [4, 4, 4], agora: [7, 4, 4], sobe: true },
    { antes: [4, 4, 4], agora: [4, 4, 5], sobe: false },
    { antes: [4, 4, 4], agora: [6, 6, 3], sobe: false },
    { antes: [6, 4, 2], agora: [4, 5, 6], sobe: false },
    { antes: [3, 3, 3], agora: [4, 4, 4], sobe: true },
  ];

  it("sucesso = média ≥ média anterior + 1 E nenhuma série abaixo da correspondente", () => {
    for (const { antes, agora, sobe } of casos) {
      const d = decidir(fixaPronada, estado(fixaPronada), reps(...agora), {
        seriesAnteriores: antes,
      });
      const mediaAntes = antes.reduce((s, v) => s + v, 0) / antes.length;
      const mediaAgora = agora.reduce((s, v) => s + v, 0) / agora.length;
      const caiu = agora.some((v, i) => v < (antes[i] as number));
      const esperado = mediaAgora >= mediaAntes + 1 && !caiu;
      const rotulo = `${antes.join("/")} → ${agora.join("/")}`;
      expect({ rotulo, sobe: d.evento?.motivo === "subiu" }).toEqual({ rotulo, sobe: esperado });
      expect({ rotulo, sobe: esperado }).toEqual({ rotulo, sobe });
    }
  });

  it("subindo, o alvo guardado é a média arredondada da sessão", () => {
    const d = decidir(fixaPronada, estado(fixaPronada), reps(6, 5, 4), {
      seriesAnteriores: [4, 4, 4],
    });
    expect(d.novoEstado.reps_alvo).toBe(5);
  });
});

/* ===================================================================== */
/* PARTE 7 — bordas dos casos: aquecimento, séries faltando, prescrição  */
/*           do treino, barra W e sugestões cruzadas                     */
/* ===================================================================== */

describe("SPEC §6.2 — o motor só olha as séries de trabalho", () => {
  it("as linhas de aquecimento não derrubam a subida do caso 1", () => {
    const series: SerieFeita[] = [
      { concluida: true, tipo: "aquecimento", reps: 5, carga_kg: 7.5 },
      { concluida: true, tipo: "aquecimento", reps: 1, carga_kg: 4 },
      ...reps(8, 8, 8).map((s) => ({ ...s, tipo: "trabalho" as const })),
    ];
    const d = decidir(supino, null, series, { ultimaFirme: true });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
  });

  it("série de trabalho não concluída conta como falha numa sessão concluída", () => {
    const series: SerieFeita[] = [
      { concluida: true, reps: 8 },
      { concluida: true, reps: 8 },
      { concluida: false, reps: 8 },
    ];
    const d = decidir(supino, estado(supino, { carga_atual_kg: 25.5 }), series, {
      ultimaFirme: true,
    });
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
    expect(d.novoEstado.carga_atual_kg).toBe(25.5);
  });

  it("faltando uma das 3 séries prescritas numa sessão concluída, é falha", () => {
    const d = decidir(supino, estado(supino, { carga_atual_kg: 25.5 }), reps(8, 8), {
      ultimaFirme: true,
    });
    expect(d.evento?.falha).toBe(true);
  });
});

describe("caso 20 vale para qualquer tipo de exercício", () => {
  it("máximo, tempo e assistência abandonados com séries faltando não mudam nada", () => {
    const paraCada: [Exercicio, SerieFeita[]][] = [
      [fixaPronada, reps(5)],
      [prancha, tempos(45)],
      [fixaAssistida, reps(8, 8)],
    ];
    for (const [e, series] of paraCada) {
      const antes = estado(e);
      const d = decidir(e, antes, series, { sessaoAbandonada: true });
      expect({ id: e.id, evento: d.evento }).toEqual({ id: e.id, evento: null });
      expect(d.novoEstado).toEqual(antes);
    }
  });
});

describe("a prescrição do treino (programa.json) vence a do catálogo", () => {
  it("no Treino A1 o supino é 3 × 5–5: 5/5/5 firme já sobe para 9,5", () => {
    const item = programa.treinos.A1.exercicios.find(
      (i) => i.exercicio_id === "supino-reto-com-barra",
    );
    expect(item).toBeDefined();
    const alvo = prescricaoDoTreino(item as NonNullable<typeof item>, supino);
    expect([alvo.series, alvo.min, alvo.max]).toEqual([3, 5, 5]);
    const d = decidir(supino, null, reps(5, 5, 5), {
      prescricao: alvo,
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
  });

  it("com a faixa do catálogo (5–8) as mesmas 5/5/5 apenas repetem", () => {
    const d = decidir(supino, null, reps(5, 5, 5), { ultimaFirme: true });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(7.5);
  });
});

describe("doc, linha 'barra W' — a progressão anda na escala de 2 em 2 a partir de 2,0", () => {
  const roscaW = acharExercicio("rosca-com-barra-w");

  it("1ª sessão a 2,0 kg; 12/12/12 firme sobe para 4,0", () => {
    expect(cargaDeHoje(roscaW, null).carga_kg).toBe(2);
    const d = decidir(roscaW, null, reps(12, 12, 12), { ultimaFirme: true });
    expect(d.novoEstado.carga_atual_kg).toBe(4);
  });

  it("no teto de 50 kg a subida vira repetiu com aviso de capacidade, não de anilhas", () => {
    const d = decidir(roscaW, estado(roscaW, { carga_atual_kg: 50 }), reps(12, 12, 12), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(txt(d.evento?.aviso)).toMatch(/capacidade/i);
    expect(txt(d.evento?.aviso)).not.toMatch(/anilhas de 10/i);
  });
});

describe("as sugestões não vazam para quem o doc não manda", () => {
  it("flexão de braço (3 × máximo) não recebe a sugestão de lastro da barra fixa", () => {
    const flexao = acharExercicio("flexao-de-braco");
    const d = decidir(flexao, estado(flexao, { reps_alvo: 9 }), reps(10, 10, 10));
    expect(txt(d.evento?.sugestao)).not.toMatch(/lastro/i);
  });

  it("2 séries ≥ 10 na barra fixa ainda não sugerem lastro (o doc pede 3)", () => {
    const d = decidir(fixaPronada, estado(fixaPronada, { reps_alvo: 8 }), reps(10, 10, 9));
    expect(txt(d.evento?.sugestao)).not.toMatch(/lastro/i);
  });

  it("subida normal dentro da faixa não gera sugestão nenhuma", () => {
    const d = decidir(supino, estado(supino, { carga_atual_kg: 9.5 }), reps(8, 8, 8), {
      ultimaFirme: true,
    });
    expect(d.evento?.sugestao).toBeUndefined();
    expect(d.evento?.aviso).toBeUndefined();
  });
});

describe("doc, tabela — a diferença devolvida em cada 'inválido → devolve'", () => {
  it("barra maciça: 26,5 → −1 · 8 → −0,5 · 110 → −2,5 (com aviso de anilhas)", () => {
    expect(montagem(26.5, "barra_macica").diferenca).toBe(-1);
    expect(montagem(8, "barra_macica").diferenca).toBe(-0.5);
    expect(montagem(8, "barra_macica").aviso).toBeUndefined();
    expect(montagem(110, "barra_macica").diferenca).toBe(-2.5);
    expect(montagem(110, "barra_macica").aviso).toBe("faltam anilhas de 10 kg");
  });

  it("halteres: 4,5 → −1 · 6 → −0,5 · 41,5 → −2 (teto de capacidade, sem aviso de anilhas)", () => {
    expect(montagem(4.5, "halteres").diferenca).toBe(-1);
    expect(montagem(4.5, "halteres").porPonta).toEqual([1]);
    expect(montagem(6, "halteres").diferenca).toBe(-0.5);
    expect(montagem(41.5, "halteres").diferenca).toBe(-2);
    expect(montagem(41.5, "halteres").aviso).toBeUndefined();
  });

  it("polia: 0,5 → −0,5 · 101 → −1; barra W: 52 → −2", () => {
    expect(montagem(0.5, "polia").diferenca).toBe(-0.5);
    expect(montagem(101, "polia").diferenca).toBe(-1);
    expect(montagem(52, "barra_w").diferenca).toBe(-2);
  });
});

describe("caso 10 — o unilateral com um lado só registrado", () => {
  it("sem o segundo lado, vale o lado registrado", () => {
    const series: SerieFeita[] = [
      { concluida: true, reps: 12 },
      { concluida: true, reps: 12 },
      { concluida: true, reps: 12 },
    ];
    const d = decidir(roscaAlternada, estado(roscaAlternada, { carga_atual_kg: 1.5 }), series, {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(3.5);
  });

  it("lado 1 vazio é série sem valor: falha", () => {
    const series: SerieFeita[] = [
      { concluida: true, reps: 12, reps_lado2: 12 },
      { concluida: true, reps: 12, reps_lado2: 12 },
      { concluida: true, reps: null, reps_lado2: 12 },
    ];
    const d = decidir(roscaAlternada, estado(roscaAlternada, { carga_atual_kg: 1.5 }), series, {
      ultimaFirme: true,
    });
    expect(d.evento?.falha).toBe(true);
  });
});
