/**
 * AUDITORIA ADVERSARIAL — lente "bordas" (rodada 1).
 *
 * Bordas numéricas e de estoque do motor: ponto flutuante, escalas de carga,
 * arredondamento para baixo (×0,9 e ×0,6), montagem guloso contra o estoque,
 * incremento reduzido, séries irregulares, estado com campos null vindos do
 * banco e datas na virada do ano.
 *
 * Referências: SPEC.md §5, §6.1–§6.5 e docs/casos-de-teste-progressao.md.
 * Nada aqui é conteúdo novo: os exercícios saem do catálogo (data/exercicios.json).
 */
import { describe, expect, it } from "vitest";
import { acharExercicio } from "@/lib/dados";
import {
  alcancavelParaBaixo,
  cargaMaxima,
  cargasPossiveis,
  montagem,
  PESO_BARRA_A_PESAR,
  type ImplementoMontagem,
} from "@/lib/montagem";
import {
  cargaDeHoje,
  decidir,
  incrementoDe,
  type EstadoExercicio,
  type SerieFeita,
} from "@/lib/progressao";
import {
  avancarSemanaDeCorrida,
  diaDaSemana,
  diasDaSemana,
  inicioDaSemana,
  iso,
  oQueFaltaNaSemana,
  semanaDaFase,
  semanaDoPlano,
  sugerirFase2,
  treinoDeHoje,
} from "@/lib/calendario";

/* ------------------------------------------------------------- ferramentas */

const ex = (id: string) => acharExercicio(id);

/** Estado "limpo" de um exercício de carga, para variar campo a campo. */
function estado(mudancas: Partial<EstadoExercicio> = {}): EstadoExercicio {
  return {
    carga_atual_kg: null,
    reps_alvo: null,
    tempo_alvo_s: null,
    assistencia: null,
    incremento_kg: null,
    falhas_seguidas: 0,
    incremento_reduzido: false,
    exigir_rep_extra: false,
    semana_leve: false,
    carga_antes_leve: null,
    sessoes_graca: 0,
    desativado: false,
    ...mudancas,
  };
}

const reps = (...valores: number[]): SerieFeita[] =>
  valores.map((r) => ({ concluida: true, reps: r }));

/** Décimos inteiros: compara cargas sem passar por ponto flutuante. */
const d10 = (x: number) => Math.round(x * 10);

/** O maior valor da escala ≤ alvo, calculado em décimos inteiros. */
function pisoNaEscala(escala: number[], alvoEmDecimos: number): number {
  let melhor = escala[0] ?? 0;
  for (const c of escala) if (d10(c) <= alvoEmDecimos) melhor = c;
  return melhor;
}

const IMPLEMENTOS: ImplementoMontagem[] = [
  "barra_macica",
  "halteres",
  "polia",
  "barra_w",
  "barra_reta_oca",
];

/* =========================================================================
 * 1. Escala e ponto flutuante (SPEC §6.4 · doc "Cargas alcançáveis")
 * ========================================================================= */

describe("escala de cargas: igualdade exata, sem resíduo de ponto flutuante", () => {
  it("barra maciça = 7,5 + 2 × k, de 7,5 a 107,5, 51 cargas exatas", () => {
    const escala = cargasPossiveis("barra_macica");
    const esperada = Array.from({ length: 51 }, (_, k) => (75 + 20 * k) / 10);
    expect(escala).toEqual(esperada);
    expect(escala[1]).toBe(9.5);
    expect(escala[escala.length - 1]).toBe(107.5);
    // nenhum 9.499999… nem 9.500000000001 na escala
    for (const c of escala) expect(c).toBe(d10(c) / 10);
  });

  it("halteres = 1,5 + 2 × k até 39,5 (capacidade 40 por halter)", () => {
    const escala = cargasPossiveis("halteres");
    expect(escala).toEqual(Array.from({ length: 20 }, (_, k) => (15 + 20 * k) / 10));
    expect(escala[escala.length - 1]).toBe(39.5);
  });

  it("barra W: base 2,0 (a pesar) + 2 × k até 50", () => {
    expect(PESO_BARRA_A_PESAR).toBe(2);
    const escala = cargasPossiveis("barra_w");
    expect(escala[0]).toBe(2);
    expect(escala[escala.length - 1]).toBe(50);
    expect(escala).toEqual(Array.from({ length: 25 }, (_, k) => 2 + 2 * k));
  });

  it("polia: todo inteiro de 0 a 100 no pino", () => {
    const escala = cargasPossiveis("polia");
    expect(escala).toEqual(Array.from({ length: 101 }, (_, k) => k));
  });

  it("os inválidos da tabela do doc caem para a vizinha de baixo, com igualdade exata", () => {
    expect(alcancavelParaBaixo(26.5, "barra_macica")).toBe(25.5);
    expect(alcancavelParaBaixo(8, "barra_macica")).toBe(7.5);
    expect(alcancavelParaBaixo(110, "barra_macica")).toBe(107.5);
    expect(alcancavelParaBaixo(4.5, "halteres")).toBe(3.5);
    expect(alcancavelParaBaixo(6, "halteres")).toBe(5.5);
    expect(alcancavelParaBaixo(41.5, "halteres")).toBe(39.5);
    expect(alcancavelParaBaixo(0.5, "polia")).toBe(0);
    expect(alcancavelParaBaixo(101, "polia")).toBe(100);
    expect(alcancavelParaBaixo(52, "barra_w")).toBe(50);
  });

  it("alcancavelParaBaixo é idempotente em toda a escala de todos os implementos", () => {
    for (const imp of IMPLEMENTOS) {
      for (const c of cargasPossiveis(imp)) {
        expect(alcancavelParaBaixo(c, imp)).toBe(c);
        // 0,1 kg acima continua na mesma carga; 0,1 abaixo desce um degrau
        expect(alcancavelParaBaixo(d10(c) / 10 + 0.1, imp)).toBe(c);
      }
    }
  });

  it("50 subidas encadeadas na barra: 7,5 → 107,5 sem drift (cada passo exatamente +2)", () => {
    const supino = ex("supino-reto-com-barra");
    let st = estado({ carga_atual_kg: 7.5 });
    const vistas: number[] = [7.5];
    for (let i = 0; i < 50; i++) {
      const dec = decidir(supino, st, reps(8, 8, 8));
      expect(dec.evento?.motivo).toBe("subiu");
      const anterior = st.carga_atual_kg as number;
      st = dec.novoEstado;
      expect(st.carga_atual_kg).toBe(d10(anterior + 2) / 10);
      vistas.push(st.carga_atual_kg as number);
    }
    expect(vistas).toEqual(cargasPossiveis("barra_macica"));
    expect(st.carga_atual_kg).toBe(107.5);
    // no teto, repete com o aviso do guia (caso 22)
    const noTeto = decidir(supino, st, reps(8, 8, 8));
    expect(noTeto.evento?.motivo).toBe("repetiu");
    expect(noTeto.novoEstado.carga_atual_kg).toBe(107.5);
  });

  it("subidas encadeadas no halter: 1,5 → 39,5 sem drift", () => {
    const rosca = ex("rosca-martelo");
    let st = estado({ carga_atual_kg: 1.5 });
    const vistas: number[] = [1.5];
    for (let i = 0; i < 19; i++) {
      st = decidir(rosca, st, reps(12, 12, 12)).novoEstado;
      vistas.push(st.carga_atual_kg as number);
    }
    expect(vistas).toEqual(cargasPossiveis("halteres"));
  });

  it("partindo de uma carga fora da escala, a subida volta para a escala", () => {
    const supino = ex("supino-reto-com-barra");
    const dec = decidir(supino, estado({ carga_atual_kg: 26.5 }), reps(8, 8, 8));
    expect(dec.novoEstado.carga_atual_kg).toBe(27.5);
    expect(cargasPossiveis("barra_macica")).toContain(dec.novoEstado.carga_atual_kg);
  });
});

/* =========================================================================
 * 2. ×0,9 e ×0,6 sempre alcançáveis para baixo (SPEC §6.2 e §6.4)
 * ========================================================================= */

describe("−10 % e 60 % caem sempre numa carga alcançável", () => {
  it("varredura: para toda carga da escala, 0,9 e 0,6 dão o piso certo da escala", () => {
    for (const imp of IMPLEMENTOS) {
      const escala = cargasPossiveis(imp);
      for (const c of escala) {
        for (const [num, den] of [
          [9, 10],
          [6, 10],
        ] as const) {
          // alvo em décimos de kg, em inteiros: (c * num / den) * 10
          const alvo = Math.floor((d10(c) * num) / den);
          const esperado = pisoNaEscala(escala, alvo);
          const obtido = alcancavelParaBaixo((c * num) / den, imp);
          expect(obtido).toBe(esperado);
          expect(obtido).toBeLessThanOrEqual(c);
        }
      }
    }
  });

  it("os números do doc: 25,5 → 21,5 (2ª falha) e 47,5 → 27,5 (semana leve)", () => {
    const supino = ex("supino-reto-com-barra");
    const segunda = decidir(
      supino,
      estado({ carga_atual_kg: 25.5, falhas_seguidas: 1 }),
      reps(7, 5, 3),
    );
    expect(segunda.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(segunda.novoEstado.carga_atual_kg).toBe(21.5);

    const terra = ex("levantamento-terra");
    const terceira = decidir(
      terra,
      estado({ carga_atual_kg: 47.5, falhas_seguidas: 2 }),
      reps(4, 3, 3),
    );
    expect(terceira.evento?.motivo).toBe("semana_leve_60");
    expect(terceira.novoEstado.carga_atual_kg).toBe(27.5);
    expect(terceira.novoEstado.carga_antes_leve).toBe(47.5);
  });

  it("toda carga que o motor devolve numa falha está na escala do implemento", () => {
    const supino = ex("supino-reto-com-barra");
    const escala = cargasPossiveis("barra_macica");
    for (const c of escala) {
      const segunda = decidir(
        supino,
        estado({ carga_atual_kg: c, falhas_seguidas: 1 }),
        reps(2, 2, 2),
      ).novoEstado.carga_atual_kg as number;
      expect(escala).toContain(segunda);
      expect(segunda).toBeLessThanOrEqual(c);

      const terceira = decidir(
        supino,
        estado({ carga_atual_kg: c, falhas_seguidas: 2 }),
        reps(2, 2, 2),
      ).novoEstado.carga_atual_kg as number;
      expect(escala).toContain(terceira);
      expect(terceira).toBeLessThanOrEqual(segunda);
    }
  });

  it("no piso da escala a redução não inventa carga menor que a barra vazia", () => {
    const supino = ex("supino-reto-com-barra");
    const dec = decidir(
      supino,
      estado({ carga_atual_kg: 7.5, falhas_seguidas: 1 }),
      reps(2, 2, 2),
    );
    expect(dec.novoEstado.carga_atual_kg).toBe(7.5);
  });
});

/* =========================================================================
 * 3. Montagem: guloso × estoque (SPEC §6.5 · doc "Cargas alcançáveis")
 * ========================================================================= */

describe("montagem fecha com o estoque (4 de cada peso)", () => {
  const LIMITE: Record<string, number> = {
    barra_macica: 2,
    barra_w: 2,
    barra_reta_oca: 2,
    halteres: 1,
    polia: 4,
  };

  it("varredura: soma das anilhas × fator + barra = total, ordenado e dentro do limite", () => {
    for (const imp of IMPLEMENTOS) {
      const fator = imp === "polia" ? 1 : 2;
      for (const c of cargasPossiveis(imp)) {
        const m = montagem(c, imp);
        const soma = m.anilhas.reduce((s, v) => s + v, 0);
        expect(d10(m.pesoBarra + fator * soma)).toBe(d10(c));
        expect(m.total).toBe(c);
        expect(m.exato).toBe(true);
        expect([...m.anilhas].sort((a, b) => b - a)).toEqual(m.anilhas);
        const contagem = new Map<number, number>();
        for (const a of m.anilhas) contagem.set(a, (contagem.get(a) ?? 0) + 1);
        for (const [kg, n] of contagem) {
          expect([1, 2, 3, 4, 5, 10]).toContain(kg);
          expect(n).toBeLessThanOrEqual(LIMITE[imp] as number);
          // o estoque total (4 de cada) nunca é estourado
          expect(n * (imp === "halteres" ? 4 : imp === "polia" ? 1 : 2)).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it("polia: as somas que exigem combinação fecham exatas (7, 9, 11, 13, 17, 19, 23)", () => {
    const esperado: Record<number, number[]> = {
      7: [5, 2],
      9: [5, 4],
      11: [10, 1],
      13: [10, 3],
      17: [10, 5, 2],
      19: [10, 5, 4],
      23: [10, 10, 3],
    };
    for (const [kg, anilhas] of Object.entries(esperado)) {
      const m = montagem(Number(kg), "polia");
      expect(m.total).toBe(Number(kg));
      expect(m.exato).toBe(true);
      expect(m.anilhas.reduce((s, v) => s + v, 0)).toBe(Number(kg));
      expect(m.anilhas).toEqual(anilhas);
      expect(m.noPino).toEqual(anilhas);
    }
  });

  it("polia: 100 kg no pino usa as 24 anilhas do estoque; 101 → 100", () => {
    const cheio = montagem(100, "polia");
    expect(cheio.total).toBe(100);
    expect(cheio.anilhas).toHaveLength(24);
    const acima = montagem(101, "polia");
    expect(acima.total).toBe(100);
    expect(acima.exato).toBe(false);
    expect(acima.diferenca).toBe(-1);
  });

  it("barra maciça: 25,5 = [5,4] por lado e 107,5 = o kit inteiro (2 de cada por lado)", () => {
    expect(montagem(25.5, "barra_macica").porLado).toEqual([5, 4]);
    expect(montagem(26.5, "barra_macica")).toMatchObject({
      total: 25.5,
      exato: false,
      diferenca: -1,
    });
    expect(montagem(107.5, "barra_macica").porLado).toEqual([
      10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1,
    ]);
  });

  it("halteres: no máximo 1 de cada peso por ponta (os dois halteres usam as 4)", () => {
    expect(montagem(5.5, "halteres").porPonta).toEqual([2]);
    expect(montagem(39.5, "halteres").porPonta).toEqual([10, 5, 4]);
    const m = montagem(41.5, "halteres");
    expect(m.total).toBe(39.5);
    expect(m.exato).toBe(false);
  });

  it("barra W: 52 → 50 e a barra vale 2,0 kg até ser pesada", () => {
    const m = montagem(52, "barra_w");
    expect(m.total).toBe(50);
    expect(m.pesoBarra).toBe(2);
    expect(m.exato).toBe(false);
    // com a barra pesada, a escala anda junto
    expect(cargasPossiveis("barra_w", { pesoBarra: 6.2 })[0]).toBe(6.2);
    expect(alcancavelParaBaixo(9, "barra_w", { pesoBarra: 6.2 })).toBe(8.2);
  });

  it("ACHADO: o aviso das anilhas de 10 kg só vale para a barra maciça (SPEC §6.4)", () => {
    // SPEC §6.4: "Aviso quando a carga pedida exige mais anilhas de 10 kg do que
    // existem (marco do guia: comprar duas de 10 kg)"; no doc, só o pedido de
    // 109,5 kg na barra maciça carrega esse aviso. No halter (capacidade 40 kg) e
    // na barra W (capacidade 50 kg) quem limita é a BARRA, não o estoque: comprar
    // duas anilhas de 10 kg não sobe nem 1 kg nesses implementos.
    expect(montagem(109.5, "barra_macica").aviso).toBe("faltam anilhas de 10 kg");
    expect(montagem(41.5, "halteres").aviso).toBeUndefined();
    expect(montagem(52, "barra_w").aviso).toBeUndefined();
  });

  it("ACHADO: no teto do halter e da barra W o motor manda comprar anilhas de 10 kg (SPEC §6.4)", () => {
    const halter = decidir(
      ex("rosca-martelo"),
      estado({ carga_atual_kg: 39.5 }),
      reps(12, 12, 12),
    );
    expect(halter.evento?.motivo).toBe("repetiu");
    expect(halter.evento?.aviso ?? "").not.toContain("anilhas de 10 kg");

    const barraW = decidir(
      ex("rosca-com-barra-w"),
      estado({ carga_atual_kg: 50 }),
      reps(12, 12, 12),
    );
    expect(barraW.evento?.aviso ?? "").not.toContain("anilhas de 10 kg");
  });
});

/* =========================================================================
 * 4. Incremento reduzido (doc casos 5, 6 e 7 · SPEC §6.2)
 * ========================================================================= */

describe("incremento reduzido: +4 vira 2 e +2 fica 2 exigindo topo + 1 rep", () => {
  it("agachamento (+4): 2ª falha reduz para exatamente 2 kg, sem rep extra", () => {
    const agacho = ex("agachamento-livre");
    const dec = decidir(
      agacho,
      estado({ carga_atual_kg: 39.5, falhas_seguidas: 1 }),
      reps(5, 4, 3),
    );
    expect(dec.novoEstado.carga_atual_kg).toBe(35.5);
    expect(dec.novoEstado.incremento_reduzido).toBe(true);
    expect(dec.novoEstado.exigir_rep_extra).toBe(false);
    expect(incrementoDe(agacho, dec.novoEstado)).toBe(2);

    const sobe = decidir(agacho, dec.novoEstado, reps(5, 5, 5));
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.carga_atual_kg).toBe(37.5);
    expect(sobe.novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(agacho, sobe.novoEstado)).toBe(4);
  });

  it("supino (+2): 2ª falha mantém 2 kg e passa a exigir topo + 1 rep", () => {
    const supino = ex("supino-reto-com-barra");
    const dec = decidir(
      supino,
      estado({ carga_atual_kg: 25.5, falhas_seguidas: 1 }),
      reps(7, 5, 3),
    );
    expect(incrementoDe(supino, dec.novoEstado)).toBe(2);
    expect(dec.novoEstado.exigir_rep_extra).toBe(true);
    expect(cargaDeHoje(supino, dec.novoEstado).incremento_kg).toBe(2);

    expect(decidir(supino, dec.novoEstado, reps(8, 8, 8)).evento?.motivo).toBe("repetiu");
    const nove = decidir(supino, dec.novoEstado, reps(9, 9, 9));
    expect(nove.evento?.motivo).toBe("subiu");
    expect(nove.novoEstado.carga_atual_kg).toBe(23.5);
    expect(nove.novoEstado.exigir_rep_extra).toBe(false);
  });

  it("o incremento nunca fica abaixo do passo mínimo de 2 kg", () => {
    for (const id of ["supino-reto-com-barra", "agachamento-livre", "puxada-alta-na-polia", "rosca-martelo"]) {
      const e = ex(id);
      expect(incrementoDe(e, estado({ incremento_reduzido: true }))).toBeGreaterThanOrEqual(2);
    }
  });
});

/* =========================================================================
 * 5. Séries irregulares (SPEC §6.2)
 * ========================================================================= */

describe("séries a menos, a mais, nulas e não concluídas", () => {
  const supino = ex("supino-reto-com-barra");
  const base = estado({ carga_atual_kg: 25.5 });

  it("reps null ou série não concluída conta falha", () => {
    const comNull = decidir(supino, base, [
      { concluida: true, reps: 8 },
      { concluida: true, reps: 8 },
      { concluida: true, reps: null },
    ]);
    expect(comNull.novoEstado.falhas_seguidas).toBe(1);
    expect(comNull.evento?.falha).toBe(true);

    const naoConcluida = decidir(supino, base, [
      { concluida: true, reps: 8 },
      { concluida: true, reps: 8 },
      { concluida: false, reps: 8 },
    ]);
    expect(naoConcluida.novoEstado.falhas_seguidas).toBe(1);
  });

  it("menos séries que a prescrição: falha na sessão concluída, nada na abandonada", () => {
    const concluida = decidir(supino, base, reps(8, 8));
    expect(concluida.evento?.falha).toBe(true);
    expect(concluida.novoEstado.falhas_seguidas).toBe(1);

    const abandonada = decidir(supino, base, reps(8, 8), { sessaoAbandonada: true });
    expect(abandonada.evento).toBeNull();
    expect(abandonada.novoEstado).toEqual(base);
  });

  it("ACHADO: série de trabalho a mais, abaixo do piso, é ignorada (SPEC §6.2)", () => {
    // SPEC §6.2: "Falha = alguma série de trabalho com reps < alvo_min"; a entrada
    // do motor (§6) são "as séries de trabalho da sessão", não as primeiras N.
    // Aqui a 4ª série registrada tem 2 reps (piso 5) e mesmo assim o motor sobe.
    const quatro = decidir(supino, base, reps(8, 8, 8, 2));
    expect(quatro.evento?.motivo).not.toBe("subiu");
    expect(quatro.novoEstado.carga_atual_kg).toBe(25.5);
  });

  it("ACHADO: série a mais não concluída também é ignorada (SPEC §6.2)", () => {
    const quatro = decidir(supino, base, [
      { concluida: true, reps: 8 },
      { concluida: true, reps: 8 },
      { concluida: true, reps: 8 },
      { concluida: false, reps: null },
    ]);
    expect(quatro.evento?.motivo).not.toBe("subiu");
  });

  it("unilateral: vale o menor lado e um lado ausente não derruba o motor", () => {
    const bulgaro = ex("agachamento-bulgaro");
    const st = estado({ carga_atual_kg: 5.5 });
    const menor = decidir(bulgaro, st, [
      { concluida: true, reps: 10, reps_lado2: 10 },
      { concluida: true, reps: 10, reps_lado2: 10 },
      { concluida: true, reps: 10, reps_lado2: 9 },
    ]);
    expect(menor.evento?.motivo).toBe("repetiu");
    expect(menor.novoEstado.carga_atual_kg).toBe(5.5);
    // só um lado registrado: o motor não pode quebrar nem gerar NaN
    const umLado = decidir(bulgaro, st, [
      { concluida: true, reps: 10, reps_lado2: null },
      { concluida: true, reps: 10, reps_lado2: null },
      { concluida: true, reps: 10, reps_lado2: null },
    ]);
    expect(Number.isNaN(umLado.novoEstado.carga_atual_kg as number)).toBe(false);
    expect(cargasPossiveis("halteres")).toContain(umLado.novoEstado.carga_atual_kg);
  });
});

/* =========================================================================
 * 6. Estado com campos null vindos do banco (SPEC §6.1 · schema nullable)
 * ========================================================================= */

describe("estado com campos null vindos do banco", () => {
  const supino = ex("supino-reto-com-barra");

  it("carga_atual_kg null: a subida cai na carga inicial do JSON (§6.1)", () => {
    const dec = decidir(supino, estado({ carga_atual_kg: null }), reps(8, 8, 8));
    expect(dec.evento?.motivo).toBe("subiu");
    expect(dec.novoEstado.carga_atual_kg).toBe(9.5);
  });

  it("ACHADO: carga_atual_kg null na 2ª falha não aplica −10 % nem reduz o incremento (§6.2)", () => {
    // §6.1 diz que a carga de quem não tem estado é carga_inicial.kg (7,5 no supino);
    // subir() usa esse fallback, falhar() não: trata como exercício sem carga.
    const dec = decidir(
      supino,
      estado({ carga_atual_kg: null, falhas_seguidas: 1 }),
      reps(2, 2, 2),
    );
    expect(dec.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(dec.novoEstado.incremento_reduzido).toBe(true);
    expect(dec.novoEstado.exigir_rep_extra).toBe(true);
  });

  it("reps_alvo e tempo_alvo_s null: o topo da faixa vem da prescrição", () => {
    const prancha = ex("prancha");
    const hoje = cargaDeHoje(prancha, estado({ tempo_alvo_s: null }));
    expect(hoje.alvo_max).toBe(60);
    const sobe = decidir(prancha, estado({ tempo_alvo_s: null }), [
      { concluida: true, tempo_s: 60 },
      { concluida: true, tempo_s: 60 },
      { concluida: true, tempo_s: 60 },
    ]);
    expect(sobe.novoEstado.tempo_alvo_s).toBe(65);

    const pernas = ex("elevacao-de-pernas-na-barra-fixa");
    expect(cargaDeHoje(pernas, estado({ reps_alvo: null })).alvo_max).toBe(15);
  });

  it("semana_leve com carga_antes_leve null: usa a carga atual e volta para ela", () => {
    const hoje = cargaDeHoje(
      supino,
      estado({ carga_atual_kg: 15.5, semana_leve: true, carga_antes_leve: null }),
    );
    expect(hoje.carga_kg).toBe(15.5);
    const fim = decidir(
      supino,
      estado({ carga_atual_kg: 15.5, semana_leve: true, carga_antes_leve: null }),
      reps(5, 5, 5),
    );
    expect(fim.evento?.motivo).toBe("fim_semana_leve");
    expect(fim.novoEstado.carga_atual_kg).toBe(15.5);
    expect(fim.novoEstado.semana_leve).toBe(false);
  });

  it("contadores null (linha antiga do banco) não viram NaN", () => {
    const sujo = {
      ...estado({ carga_atual_kg: 25.5 }),
      falhas_seguidas: null,
      sessoes_graca: null,
    } as unknown as EstadoExercicio;
    const dec = decidir(supino, sujo, reps(2, 2, 2));
    expect(Number.isNaN(dec.novoEstado.falhas_seguidas)).toBe(false);
    expect(dec.novoEstado.falhas_seguidas).toBe(1);
    expect(dec.novoEstado.carga_atual_kg).toBe(25.5);
  });

  it("assistencia null (barra fixa assistida) parte do pé inteiro (§6.1)", () => {
    const fixa = ex("barra-fixa-assistida");
    const dec = decidir(fixa, estado({ assistencia: null }), reps(8, 8, 8, 8));
    expect(dec.novoEstado.assistencia).toBe("joelho");
    expect(dec.novoEstado.sessoes_graca).toBe(2);
  });
});

/* =========================================================================
 * 7. Tipo `maximo`: a média em ponto flutuante (SPEC §6.3 · doc caso 15)
 * ========================================================================= */

describe("tipo maximo: média ≥ média anterior + 1", () => {
  const fixa = ex("barra-fixa-pronada");

  it("caso 15 tal como está no doc: 4/4/4 → 5/5/5 sobe", () => {
    const dec = decidir(fixa, estado({ reps_alvo: 4 }), reps(5, 5, 5), {
      seriesAnteriores: [4, 4, 4],
    });
    expect(dec.evento?.motivo).toBe("subiu");
  });

  it("ACHADO: +1 rep em todas as séries não sobe quando a média cai num dízima (§6.3)", () => {
    // 3/3/4 (média 10/3) → 4/4/5 (média 13/3) é exatamente +1 de média e nenhuma
    // série abaixo da anterior: o doc (caso 15) e a §6.3 mandam SUBIR.
    // O motor compara `mediaAgora >= mediaAntes + 1` em ponto flutuante:
    // 10/3 + 1 = 4.333333333333334 > 13/3 = 4.333333333333333 → vira "repetiu".
    const dec = decidir(fixa, estado({ reps_alvo: 3 }), reps(4, 4, 5), {
      seriesAnteriores: [3, 3, 4],
    });
    expect(dec.evento?.motivo).toBe("subiu");
  });

  it("ACHADO: o mesmo erro em outras somas (1/1/3 → 2/2/4 e 8/8/7 → 9/9/8)", () => {
    const a = decidir(fixa, estado({ reps_alvo: 1 }), reps(2, 2, 4), {
      seriesAnteriores: [1, 1, 3],
    });
    const b = decidir(fixa, estado({ reps_alvo: 8 }), reps(9, 9, 8), {
      seriesAnteriores: [8, 8, 7],
    });
    expect([a.evento?.motivo, b.evento?.motivo]).toEqual(["subiu", "subiu"]);
  });

  it("média menor conta falha e série abaixo da anterior segura a subida", () => {
    const caiu = decidir(fixa, estado({ reps_alvo: 5 }), reps(3, 3, 3), {
      seriesAnteriores: [5, 5, 5],
    });
    expect(caiu.evento?.falha).toBe(true);
    const umaAbaixo = decidir(fixa, estado({ reps_alvo: 5 }), reps(8, 8, 4), {
      seriesAnteriores: [5, 5, 5],
    });
    expect(umaAbaixo.evento?.motivo).toBe("repetiu");
  });
});

/* =========================================================================
 * 8. Calendário na virada do ano (SPEC §5 · semana começa na segunda)
 * ========================================================================= */

describe("datas na virada do ano, com a semana começando na segunda", () => {
  const perfil = { fase_atual: "fase1" as const, ultimo_treino: "A1" as const };

  it("01/01/2027 é sexta e a semana dele começa em 28/12/2026", () => {
    expect(diaDaSemana("2027-01-01")).toBe("sex");
    expect(iso(inicioDaSemana("2027-01-01"))).toBe("2026-12-28");
    expect(diasDaSemana("2027-01-01").map(iso)).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("a semana da fase não reinicia no ano novo", () => {
    expect(semanaDaFase("2026-12-28", "2026-09-14")).toBe(16);
    expect(semanaDaFase("2026-12-31", "2026-09-14")).toBe(16);
    expect(semanaDaFase("2027-01-03", "2026-09-14")).toBe(16); // domingo: mesma semana
    expect(semanaDaFase("2027-01-04", "2026-09-14")).toBe(17); // segunda: a seguinte
  });

  it("a semana que cruza o ano mantém a alternância A/B e os dias do programa", () => {
    const semana = semanaDoPlano("2026-12-31", perfil);
    expect(semana.map((d) => d.dia)).toEqual(["seg", "ter", "qua", "qui", "sex", "sab", "dom"]);
    expect(semana.map((d) => d.tipo)).toEqual([
      "forca", "cardio", "forca", "descanso", "forca", "cardio", "descanso",
    ]);
    expect(semana.map((d) => d.treinoId)).toEqual([
      "B1", null, "A1", null, "B1", null, null,
    ]);
    expect(semana[4]?.data).toBe("2027-01-01");
    expect(treinoDeHoje("2026-12-31", perfil).tipo).toBe("descanso");
  });

  it("o que falta na semana compara datas de anos diferentes na ordem certa", () => {
    const semana = semanaDoPlano("2026-12-31", perfil);
    const falta = oQueFaltaNaSemana(
      semana,
      [{ data: "2026-12-30", tipo: "forca" }],
      "2027-01-01",
    );
    expect(falta.feitos.map((d) => d.data)).toEqual(["2026-12-30"]);
    expect(falta.perdidos.map((d) => d.data)).toEqual(["2026-12-28", "2026-12-29"]);
    expect(falta.faltando.map((d) => d.data)).toEqual(["2027-01-01", "2027-01-02"]);
  });

  it("a sugestão da Fase 2 conta 12 semanas civis mesmo cruzando o ano", () => {
    const antes = sugerirFase2(
      { fase_atual: "fase1", ultimo_treino: null, fase_desde: "2026-10-12" },
      30,
      "2026-12-28",
    );
    expect(antes.semanas).toBe(11);
    expect(antes.sugerir).toBe(false);
    const depois = sugerirFase2(
      { fase_atual: "fase1", ultimo_treino: null, fase_desde: "2026-10-12" },
      30,
      "2027-01-04",
    );
    expect(depois.semanas).toBe(12);
    expect(depois.sugerir).toBe(true);
  });

  it("a semana do plano de corrida não passa de 12 nem avança com 1 sessão", () => {
    expect(avancarSemanaDeCorrida(12, 2)).toBe(12);
    expect(avancarSemanaDeCorrida(11, 2)).toBe(12);
    expect(avancarSemanaDeCorrida(3, 1)).toBe(3);
  });

  it("o teto do implemento é o mesmo que a escala anuncia", () => {
    expect(cargaMaxima("barra_macica")).toBe(107.5);
    expect(cargaMaxima("halteres")).toBe(39.5);
    expect(cargaMaxima("polia")).toBe(100);
    expect(cargaMaxima("barra_w")).toBe(50);
  });
});

