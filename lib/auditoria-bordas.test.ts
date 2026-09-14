/**
 * Auditoria adversarial do motor — lente "bordas" (rodada 3).
 *
 * Bordas numéricas e de estoque com igualdade EXATA (nada de toBeCloseTo),
 * montagem guloso contra o estoque real, reduções de 10 % e 60 %, séries
 * malformadas, estado sujo vindo do banco e datas na virada do ano / bissexto.
 * Referências: SPEC.md §3.9, §5.1–§5.5, §6.1–§6.5 e
 * docs/casos-de-teste-progressao.md.
 *
 * Os testes marcados "ACHADO" afirmam o que a spec/o doc pedem e falham com o
 * motor de hoje; o valor observado está no comentário de cada um. O resto passa
 * e serve de rede para as correções.
 */
import { describe, expect, it } from "vitest";
import { acharExercicio, exercicios } from "@/lib/dados";
import {
  alcancavelParaBaixo,
  cargaMaxima,
  cargaMinima,
  cargasPossiveis,
  limiteDoImplemento,
  montagem,
  PESO_BARRA_A_PESAR,
  type ImplementoMontagem,
} from "@/lib/montagem";
import * as C from "@/lib/calendario";
import * as P from "@/lib/progressao";
import type { DiaSemana, TreinoId } from "@/lib/schemas";

const ex = (id: string) => acharExercicio(id);

function estado(
  id: string,
  over: Partial<P.EstadoExercicio> = {},
): P.EstadoExercicio {
  return { ...P.estadoInicial(ex(id)), ...over };
}

/** Séries de trabalho concluídas com estas repetições. */
function reps(...valores: (number | null)[]): P.SerieFeita[] {
  return valores.map((r) => ({ concluida: true, reps: r }));
}

/** Pares (direito/esquerdo) para exercícios unilaterais. */
function lados(...pares: [number, number][]): P.SerieFeita[] {
  return pares.map(([a, b]) => ({ concluida: true, reps: a, reps_lado2: b }));
}

/** Centésimos inteiros: comparação de cargas sem passar por ponto flutuante. */
const c100 = (x: number) => Math.round(x * 100);

const PESOS = [1, 2, 3, 4, 5, 10] as const;

/** Estoque real de data/equipamentos.json: quatro anilhas de cada peso. */
const QTD_POR_PESO = 4;

const COM_ANILHAS = [
  "barra_macica",
  "halteres",
  "barra_w",
  "barra_reta_oca",
  "polia",
] as const satisfies readonly ImplementoMontagem[];

/** base, fator, anilhas por lado/ponta/pino e capacidade de cada implemento. */
const FICHA: Record<
  (typeof COM_ANILHAS)[number],
  { base: number; fator: 1 | 2; porPeso: number; capacidade: number }
> = {
  barra_macica: { base: 7.5, fator: 2, porPeso: 2, capacidade: 400 },
  halteres: { base: 1.5, fator: 2, porPeso: 1, capacidade: 40 },
  barra_w: { base: PESO_BARRA_A_PESAR, fator: 2, porPeso: 2, capacidade: 50 },
  barra_reta_oca: { base: PESO_BARRA_A_PESAR, fator: 2, porPeso: 2, capacidade: 60 },
  polia: { base: 0, fator: 1, porPeso: QTD_POR_PESO, capacidade: 100 },
};

/** Escala calculada de novo aqui, sem olhar para lib/montagem.ts. */
function escalaDeReferencia(imp: (typeof COM_ANILHAS)[number]): number[] {
  const { base, fator, porPeso, capacidade } = FICHA[imp];
  const teto = Math.floor((capacidade - base) / fator);
  let somas = new Set<number>([0]);
  for (const kg of PESOS) {
    const novas = new Set<number>();
    for (const s of somas) {
      for (let n = 0; n <= Math.min(porPeso, QTD_POR_PESO); n++) {
        const soma = s + n * kg;
        if (soma <= teto) novas.add(soma);
      }
    }
    somas = novas;
  }
  return [...somas].sort((a, b) => a - b).map((s) => base + fator * s);
}

/* ------------------------------------------------------------------ escala */

describe("escala dos implementos: igualdade exata, sem resíduo de ponto flutuante", () => {
  it("cada escala bate com o cálculo independente feito do estoque", () => {
    for (const imp of COM_ANILHAS) {
      const ref = escalaDeReferencia(imp);
      const escala = cargasPossiveis(imp);
      expect({ imp, n: escala.length }).toEqual({ imp, n: ref.length });
      escala.forEach((v, i) => expect(c100(v)).toBe(c100(ref[i] as number)));
    }
  });

  it("barra maciça: 7,5 + 2k, de 7,5 a 107,5 (SPEC §6.4, marco do guia)", () => {
    const escala = cargasPossiveis("barra_macica");
    expect(escala).toHaveLength(51);
    escala.forEach((v, i) => expect(v).toBe(7.5 + 2 * i));
    expect(cargaMinima("barra_macica")).toBe(7.5);
    expect(cargaMaxima("barra_macica")).toBe(107.5);
  });

  it("halteres: 1,5 + 2k até 39,5 por halter (teto 40 kg da barra de halter)", () => {
    const escala = cargasPossiveis("halteres");
    escala.forEach((v, i) => expect(v).toBe(1.5 + 2 * i));
    expect(cargaMaxima("halteres")).toBe(39.5);
    expect(escala).not.toContain(41.5);
  });

  it("barra W: base 2,0 a pesar + 2k até 50 kg (doc: 52 → 50)", () => {
    expect(PESO_BARRA_A_PESAR).toBe(2);
    const escala = cargasPossiveis("barra_w");
    escala.forEach((v, i) => expect(v).toBe(2 + 2 * i));
    expect(cargaMaxima("barra_w")).toBe(50);
    expect(cargaMaxima("barra_reta_oca")).toBe(60);
  });

  it("polia: todo inteiro de 0 a 100 kg no pino (SPEC §6.4)", () => {
    const escala = cargasPossiveis("polia");
    expect(escala).toHaveLength(101);
    escala.forEach((v, i) => expect(v).toBe(i));
  });

  it("os inválidos do doc caem exatamente na vizinha de baixo", () => {
    const casos: [number, ImplementoMontagem, number][] = [
      [26.5, "barra_macica", 25.5],
      [8, "barra_macica", 7.5],
      [110, "barra_macica", 107.5],
      [109.5, "barra_macica", 107.5],
      [4.5, "halteres", 3.5],
      [6, "halteres", 5.5],
      [41.5, "halteres", 39.5],
      [0.5, "polia", 0],
      [101, "polia", 100],
      [52, "barra_w", 50],
    ];
    for (const [pedido, imp, esperado] of casos) {
      expect(alcancavelParaBaixo(pedido, imp)).toBe(esperado);
      expect(montagem(pedido, imp).total).toBe(esperado);
    }
  });

  it("alcancavelParaBaixo é idempotente e nunca sobe dentro da escala", () => {
    for (const imp of COM_ANILHAS) {
      for (const v of cargasPossiveis(imp)) {
        expect(alcancavelParaBaixo(v, imp)).toBe(v);
        expect(alcancavelParaBaixo(v + 0.000000001, imp)).toBe(v);
      }
    }
  });

  it("50 subidas de 2 kg na barra: 7,5 → 107,5 sempre exatamente +2", () => {
    let carga = 7.5;
    for (let i = 0; i < 50; i++) {
      const proxima = alcancavelParaBaixo(carga + 2, "barra_macica");
      expect(c100(proxima) - c100(carga)).toBe(200);
      carga = proxima;
    }
    expect(carga).toBe(107.5);
    expect(alcancavelParaBaixo(carga + 2, "barra_macica")).toBe(107.5);
  });

  it("19 subidas de 2 kg no halter: 1,5 → 39,5 sem nenhum 9,499999", () => {
    let carga = 1.5;
    for (let i = 0; i < 19; i++) {
      carga = alcancavelParaBaixo(carga + 2, "halteres");
      expect(carga).toBe(1.5 + 2 * (i + 1));
      expect(String(carga)).not.toMatch(/999|000000/);
    }
    expect(carga).toBe(39.5);
  });
});

/* --------------------------------------------------------------- montagem */

describe("montagem: guloso contra o estoque real (4 de cada peso)", () => {
  it("os exemplos literais do doc de casos", () => {
    const m255 = montagem(25.5, "barra_macica");
    expect(m255.porLado).toEqual([5, 4]);
    expect(m255.total).toBe(25.5);
    expect(m255.exato).toBe(true);

    const m265 = montagem(26.5, "barra_macica");
    expect(m265.porLado).toEqual([5, 4]);
    expect(m265.total).toBe(25.5);
    expect(m265.exato).toBe(false);
    expect(m265.diferenca).toBe(-1);

    expect(montagem(5.5, "halteres").porPonta).toEqual([2]);
    expect(montagem(107.5, "barra_macica").porLado).toEqual([
      10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1,
    ]);

    const m1095 = montagem(109.5, "barra_macica");
    expect(m1095.total).toBe(107.5);
    expect(m1095.aviso).toBe("faltam anilhas de 10 kg");
  });

  it("toda carga da escala fecha exata, em ordem e dentro do estoque", () => {
    for (const imp of COM_ANILHAS) {
      const { base, fator, porPeso } = FICHA[imp];
      for (const carga of cargasPossiveis(imp)) {
        const m = montagem(carga, imp);
        expect({ imp, carga, exato: m.exato }).toEqual({ imp, carga, exato: true });
        expect(m.diferenca).toBeUndefined();
        const soma = m.anilhas.reduce((s, v) => s + v, 0);
        expect(c100(base + fator * soma)).toBe(c100(carga));
        for (const p of PESOS) {
          const n = m.anilhas.filter((a) => a === p).length;
          // barra: 2 por lado (4 no total); halter: 1 por ponta (4 pontas)
          expect({ imp, carga, p, n: n <= porPeso }).toEqual({
            imp,
            carga,
            p,
            n: true,
          });
          expect(n * (fator === 2 ? 2 : 1)).toBeLessThanOrEqual(QTD_POR_PESO);
        }
        expect([...m.anilhas].sort((a, b) => b - a)).toEqual(m.anilhas);
      }
    }
  });

  it("polia: as somas que exigem combinação fecham exatas", () => {
    const esperado: Record<number, number> = {
      7: 7,
      9: 9,
      11: 11,
      13: 13,
      17: 17,
      19: 19,
      23: 23,
    };
    for (const kg of Object.keys(esperado).map(Number)) {
      const m = montagem(kg, "polia");
      expect({ kg, exato: m.exato, total: m.total }).toEqual({
        kg,
        exato: true,
        total: kg,
      });
      expect(m.noPino?.reduce((s, v) => s + v, 0)).toBe(kg);
      for (const p of PESOS) {
        expect(m.anilhas.filter((a) => a === p).length).toBeLessThanOrEqual(
          QTD_POR_PESO,
        );
      }
    }
  });

  it("entre duas cargas da escala devolve a de baixo com a diferença negativa", () => {
    for (const imp of COM_ANILHAS) {
      const escala = cargasPossiveis(imp);
      for (let k = 0; k <= 220; k++) {
        const pedido = k / 2;
        if (pedido < (escala[0] as number)) continue;
        const m = montagem(pedido, imp);
        const esperado = escala.filter((v) => v <= pedido).pop() as number;
        expect({ imp, pedido, total: m.total }).toEqual({
          imp,
          pedido,
          total: esperado,
        });
        expect(m.exato).toBe(c100(m.total) === c100(pedido));
        if (!m.exato) expect(m.diferenca).toBe((c100(m.total) - c100(pedido)) / 100);
        if (m.diferenca !== undefined) expect(m.diferenca).toBeLessThanOrEqual(0);
      }
    }
  });

  it("o aviso das anilhas só sai onde o estoque é o limite (SPEC §6.4)", () => {
    expect(limiteDoImplemento("barra_macica")).toBe("estoque");
    expect(montagem(110, "barra_macica").aviso).toBe("faltam anilhas de 10 kg");
    // halter e barra W param na capacidade: comprar anilhas não muda nada
    expect(limiteDoImplemento("halteres")).toBe("capacidade");
    expect(montagem(41.5, "halteres").aviso).toBeUndefined();
    expect(limiteDoImplemento("barra_w")).toBe("capacidade");
    expect(montagem(52, "barra_w").aviso).toBeUndefined();
    // dentro da escala ninguém avisa nada
    expect(montagem(26.5, "barra_macica").aviso).toBeUndefined();
    expect(montagem(26.5, "barra_macica").limite).toBeUndefined();
  });

  it("com a barra W pesada depois (SPEC §3.9) a escala inteira se reconstrói", () => {
    for (const pesoBarra of [5, 6.2, 7.3, 9.5]) {
      const o = { pesoBarra };
      const escala = cargasPossiveis("barra_w", o);
      expect(escala[0]).toBe(pesoBarra);
      expect(cargaMaxima("barra_w", o)).toBeLessThanOrEqual(50);
      for (const carga of escala) {
        const m = montagem(carga, "barra_w", o);
        expect({ pesoBarra, carga, exato: m.exato }).toEqual({
          pesoBarra,
          carga,
          exato: true,
        });
        expect(c100(pesoBarra + 2 * m.anilhas.reduce((s, v) => s + v, 0))).toBe(
          c100(carga),
        );
      }
    }
  });

  it("toda carga_inicial do catálogo existe na escala do seu implemento", () => {
    for (const e of exercicios) {
      const kg = e.carga_inicial.kg;
      if (kg === null) continue;
      const escala = cargasPossiveis(e.implemento);
      expect({ id: e.id, kg, tem: escala.some((v) => c100(v) === c100(kg)) }).toEqual({
        id: e.id,
        kg,
        tem: true,
      });
    }
  });
});

/* ------------------------------------------------- reduções de 10 % e 60 % */

describe("carga × 0,9 e × 0,6 sempre alcançáveis para baixo (SPEC §6.2 e §6.4)", () => {
  /** Maior carga da escala ≤ carga × fator, em centésimos inteiros. */
  function referencia(carga: number, num: number, imp: ImplementoMontagem): number {
    const alvo = (c100(carga) * num) / 10;
    const escala = cargasPossiveis(imp);
    const abaixo = escala.filter((v) => c100(v) <= alvo);
    return abaixo.length > 0 ? (abaixo[abaixo.length - 1] as number) : (escala[0] as number);
  }

  it("2ª falha: −10 % exato em toda a escala da barra, do halter e da polia", () => {
    const porImplemento: [string, ImplementoMontagem][] = [
      ["supino-reto-com-barra", "barra_macica"],
      ["rosca-martelo", "halteres"],
      ["puxada-alta-na-polia", "polia"],
    ];
    for (const [id, imp] of porImplemento) {
      for (const carga of cargasPossiveis(imp)) {
        // pino vazio (0 kg) não tem o que reduzir: SPEC §6.2 só manda tirar 10 %
        // de uma carga que existe
        if (carga === 0) continue;
        const d = P.decidir(ex(id), estado(id, { carga_atual_kg: carga, falhas_seguidas: 1 }), reps(1, 1, 1));
        expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
        const esperado = Math.min(carga, referencia(carga, 9, imp));
        expect({ id, carga, novo: d.novoEstado.carga_atual_kg }).toEqual({
          id,
          carga,
          novo: esperado,
        });
      }
    }
  });

  it("3ª falha: 60 % exato e volta à carga de antes (casos 8 e 9)", () => {
    const id = "levantamento-terra";
    for (const carga of cargasPossiveis("barra_macica")) {
      const leve = P.decidir(
        ex(id),
        estado(id, { carga_atual_kg: carga, falhas_seguidas: 2 }),
        reps(1, 1, 1),
      );
      expect(leve.evento?.motivo).toBe("semana_leve_60");
      expect(leve.novoEstado.semana_leve).toBe(true);
      expect(leve.novoEstado.falhas_seguidas).toBe(0);
      expect(leve.novoEstado.carga_antes_leve).toBe(carga);
      const esperado = Math.min(carga, referencia(carga, 6, "barra_macica"));
      expect({ carga, leve: leve.novoEstado.carga_atual_kg }).toEqual({
        carga,
        leve: esperado,
      });
      // a tela da semana leve mostra exatamente o que o estado guardou
      const hoje = P.cargaDeHoje(ex(id), leve.novoEstado);
      expect(hoje.carga_kg).toBe(leve.novoEstado.carga_atual_kg);
      expect(hoje.montagem?.exato).toBe(true);
      // e a sessão seguinte devolve a carga de antes, com o incremento normal
      const volta = P.decidir(ex(id), leve.novoEstado, reps(5, 5, 5));
      expect(volta.evento?.motivo).toBe("fim_semana_leve");
      expect(volta.novoEstado.carga_atual_kg).toBe(carga);
      expect(volta.novoEstado.semana_leve).toBe(false);
      expect(volta.novoEstado.incremento_reduzido).toBe(false);
      expect(P.incrementoDe(ex(id), volta.novoEstado)).toBe(4);
    }
  });

  it("ACHADO: na semana leve a tela mostra uma carga e o estado guarda outra", () => {
    /*
     * `cargaDeHoje` recalcula os 60 % a partir de `carga_antes_leve` sem o teto
     * que `falhar()` aplica (nunca subir na queda). Quando a carga guardada
     * está abaixo da escala atual — barra W ainda com os 2,0 kg do JSON depois
     * de ser pesada (SPEC §3.9 deixa corrigir o peso da barra), ou uma linha
     * antiga do banco — os dois caminhos divergem: o estado guarda 2 kg e a
     * tela pede 6 kg (300 % em vez de 60 %, SPEC §6.2), e o resumo da §6.6
     * ("Hoje: X kg") deixa de bater com o evento gravado.
     * Obtido: estado 2 kg × tela 6 kg (barra W pesada em 6 kg) e
     * estado 5 kg × tela 7,5 kg (carga fora da escala na barra maciça).
     */
    const opcoes = { pesoBarra: 6 };
    const e = ex("rosca-com-barra-w");
    const leve = P.decidir(
      e,
      estado("rosca-com-barra-w", { carga_atual_kg: 2, falhas_seguidas: 2 }),
      reps(1, 1, 1),
      { montagem: opcoes },
    );
    expect(leve.evento?.motivo).toBe("semana_leve_60");
    expect(P.cargaDeHoje(e, leve.novoEstado, undefined, opcoes).carga_kg).toBe(
      leve.novoEstado.carga_atual_kg,
    );

    const barra = ex("supino-reto-com-barra");
    const fora = P.decidir(
      barra,
      estado("supino-reto-com-barra", { carga_atual_kg: 5, falhas_seguidas: 2 }),
      reps(1, 1, 1),
    );
    expect(P.cargaDeHoje(barra, fora.novoEstado).carga_kg).toBe(
      fora.novoEstado.carga_atual_kg,
    );
  });

  it("os números dos casos 5, 6 e 8 saem redondos", () => {
    const c5 = P.decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 25.5, falhas_seguidas: 1 }),
      reps(7, 5, 3),
    );
    expect(c5.novoEstado.carga_atual_kg).toBe(21.5);
    expect(c5.novoEstado.exigir_rep_extra).toBe(true);
    expect(P.incrementoDe(ex("supino-reto-com-barra"), c5.novoEstado)).toBe(2);

    const c6 = P.decidir(
      ex("agachamento-livre"),
      estado("agachamento-livre", { carga_atual_kg: 39.5, falhas_seguidas: 1 }),
      reps(5, 4, 3),
    );
    expect(c6.novoEstado.carga_atual_kg).toBe(35.5);
    expect(c6.novoEstado.exigir_rep_extra).toBe(false);
    expect(P.incrementoDe(ex("agachamento-livre"), c6.novoEstado)).toBe(2);

    const c8 = P.decidir(
      ex("levantamento-terra"),
      estado("levantamento-terra", { carga_atual_kg: 47.5, falhas_seguidas: 2 }),
      reps(4, 3, 3),
    );
    expect(c8.novoEstado.carga_atual_kg).toBe(27.5);
    expect(c8.novoEstado.carga_antes_leve).toBe(47.5);
  });

  it("no piso da escala a redução não inventa carga menor que a barra vazia", () => {
    for (const [id, piso] of [
      ["supino-reto-com-barra", 7.5],
      ["rosca-martelo", 1.5],
      ["rosca-com-barra-w", 2],
    ] as const) {
      const d = P.decidir(ex(id), estado(id, { carga_atual_kg: piso, falhas_seguidas: 1 }), reps(0, 0, 0));
      expect({ id, novo: d.novoEstado.carga_atual_kg }).toEqual({ id, novo: piso });
    }
  });
});

/* ----------------------------------------------------- incremento reduzido */

describe("incremento reduzido: +4 vira 2 e +2 fica 2 exigindo topo + 1 rep", () => {
  it("o incremento nunca cai abaixo do passo mínimo de 2 kg", () => {
    for (const e of exercicios) {
      if (e.progressao.tipo !== "carga") continue;
      const st = { ...P.estadoInicial(e), incremento_reduzido: true };
      const inc = P.incrementoDe(e, st);
      expect({ id: e.id, ok: inc >= P.PASSO_MINIMO_KG }).toEqual({ id: e.id, ok: true });
      expect(inc).toBe(Math.max((e.progressao.incremento_kg ?? 0) / 2, 2));
    }
  });

  it("caso 7: a subida depois da redução usa 2 kg e devolve o incremento normal", () => {
    const e = ex("agachamento-livre");
    const d = P.decidir(
      e,
      estado("agachamento-livre", {
        carga_atual_kg: 35.5,
        falhas_seguidas: 2,
        incremento_reduzido: true,
      }),
      reps(5, 5, 5),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(37.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(P.incrementoDe(e, d.novoEstado)).toBe(4);
  });

  it("caso 5: com rep extra o topo da faixa não sobe, topo + 1 sobe", () => {
    const e = ex("supino-reto-com-barra");
    const st = estado("supino-reto-com-barra", {
      carga_atual_kg: 21.5,
      falhas_seguidas: 2,
      incremento_reduzido: true,
      exigir_rep_extra: true,
    });
    expect(P.decidir(e, st, reps(8, 8, 8)).evento?.motivo).toBe("repetiu");
    const sobe = P.decidir(e, st, reps(9, 9, 9));
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.carga_atual_kg).toBe(23.5);
    expect(sobe.novoEstado.exigir_rep_extra).toBe(false);
  });

  it("ACHADO: incremento menor que o passo do implemento vira aviso de falta de anilhas", () => {
    /*
     * SPEC §3.9 e a coluna exercise_state.incremento_kg deixam o Miguel
     * escolher o incremento por exercício; o guia fala em "2 kg viram 1 kg".
     * Com 1 kg na barra, a carga alcançável para baixo (SPEC §6.4) continua a
     * mesma e o motor trata isso como teto: devolve o aviso do marco do guia
     * ("faltam anilhas de 10 kg") a 25,5 kg, com o teto a 107,5 kg — e o mesmo
     * no halter a 11,5 kg ("capacidade 40 kg"). SPEC §6.4 reserva o aviso para
     * "quando a carga pedida exige mais anilhas de 10 kg do que existem"
     * (caso 22: 107,5 kg).
     * Obtido: aviso "faltam anilhas de 10 kg (marco do guia)" a 25,5 kg e
     * "no limite do implemento (capacidade 40 kg)" a 11,5 kg.
     */
    const barra = P.decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 25.5, incremento_kg: 1 }),
      reps(8, 8, 8),
      { ultimaFirme: true },
    );
    expect(barra.evento?.aviso).toBeUndefined();

    const halter = P.decidir(
      ex("rosca-martelo"),
      estado("rosca-martelo", { carga_atual_kg: 11.5, incremento_kg: 1 }),
      reps(12, 12, 12),
      { ultimaFirme: true },
    );
    expect(halter.evento?.aviso).toBeUndefined();
  });
});

/* ------------------------------------------------------- séries malformadas */

describe("séries nulas, não concluídas, a mais e a menos que a prescrição", () => {
  const id = "supino-reto-com-barra";

  it("reps null e série não concluída contam falha na sessão concluída", () => {
    const comNull = P.decidir(ex(id), estado(id, { carga_atual_kg: 25.5 }), reps(8, null, 8));
    expect(comNull.evento?.motivo).toBe("repetiu");
    expect(comNull.evento?.falha).toBe(true);
    expect(comNull.novoEstado.falhas_seguidas).toBe(1);

    const naoConcluida = P.decidir(ex(id), estado(id, { carga_atual_kg: 25.5 }), [
      { concluida: true, reps: 8 },
      { concluida: true, reps: 8 },
      { concluida: false, reps: 8 },
    ]);
    expect(naoConcluida.evento?.falha).toBe(true);
    expect(naoConcluida.novoEstado.carga_atual_kg).toBe(25.5);
  });

  it("menos séries que a prescrição: falha na concluída, nada na abandonada (caso 20)", () => {
    const st = estado(id, { carga_atual_kg: 25.5 });
    const curta = P.decidir(ex(id), st, reps(8, 8));
    expect(curta.novoEstado.falhas_seguidas).toBe(1);
    const abandonada = P.decidir(ex(id), st, reps(8), { sessaoAbandonada: true });
    expect(abandonada.evento).toBeNull();
    expect(abandonada.novoEstado).toEqual(st);
  });

  it("série de trabalho a mais é avaliada junto", () => {
    const st = estado(id, { carga_atual_kg: 25.5 });
    expect(P.decidir(ex(id), st, reps(8, 8, 8, 8)).evento?.motivo).toBe("subiu");
    const quarta = P.decidir(ex(id), st, reps(8, 8, 8, 3));
    expect(quarta.evento?.motivo).toBe("repetiu");
    expect(quarta.evento?.falha).toBe(true);
  });

  it("aquecimento não entra na conta (SPEC §3.2)", () => {
    const st = estado(id, { carga_atual_kg: 25.5 });
    const d = P.decidir(ex(id), st, [
      { concluida: true, tipo: "aquecimento", reps: 5 },
      { concluida: true, tipo: "aquecimento", reps: 5 },
      { concluida: true, tipo: "trabalho", reps: 8 },
      { concluida: true, tipo: "trabalho", reps: 8 },
      { concluida: true, tipo: "trabalho", reps: 8 },
    ]);
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
    expect(P.decidir(ex(id), st, [{ concluida: true, tipo: "aquecimento", reps: 5 }]).evento).toBeNull();
  });

  it("unilateral vale o menor lado; lado 2 ausente usa o lado registrado (casos 10 e 18)", () => {
    const uni = "agachamento-bulgaro"; // 3 × 8–10 por perna, halteres
    const st = estado(uni, { carga_atual_kg: 5.5 });
    expect(P.decidir(ex(uni), st, lados([10, 10], [10, 10], [10, 9])).evento?.motivo).toBe(
      "repetiu",
    );
    expect(P.decidir(ex(uni), st, lados([10, 10], [10, 10], [10, 10])).evento?.motivo).toBe(
      "subiu",
    );
    // sem o segundo lado (o usuário só registrou um): vale o que foi registrado
    const semLado2 = P.decidir(ex(uni), st, reps(10, 10, 10));
    expect(semLado2.evento?.motivo).toBe("subiu");
    expect(semLado2.novoEstado.carga_atual_kg).toBe(7.5);
    const lado2Null = P.decidir(ex(uni), st, [
      { concluida: true, reps: 10, reps_lado2: null },
      { concluida: true, reps: 10, reps_lado2: null },
      { concluida: true, reps: 10, reps_lado2: null },
    ]);
    expect(lado2Null.evento?.motivo).toBe("subiu");
  });

  it("tempo unilateral (prancha lateral) também vale pelo menor lado", () => {
    const e = ex("prancha-lateral"); // 3 × 20–40 s por lado
    const st = { ...P.estadoInicial(e), tempo_alvo_s: 20 };
    const curto = P.decidir(e, st, [
      { concluida: true, tempo_s: 40, tempo_s_lado2: 30 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
    ]);
    expect(curto.evento?.motivo).toBe("repetiu");
    const cheio = P.decidir(e, st, [
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
    ]);
    expect(cheio.evento?.motivo).toBe("subiu");
    expect(cheio.novoEstado.tempo_alvo_s).toBe(45);
  });

  it("passos (farmer's walk, caso 19) e tempo (caso 16) fecham nos números do doc", () => {
    const fw = ex("farmer-s-walk");
    const d = P.decidir(fw, { ...P.estadoInicial(fw), carga_atual_kg: 11.5 }, [
      { concluida: true, passos: 40 },
      { concluida: true, passos: 40 },
      { concluida: true, passos: 40 },
    ]);
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(13.5);

    const pr = ex("prancha");
    const p = P.decidir(pr, { ...P.estadoInicial(pr), tempo_alvo_s: 30 }, [
      { concluida: true, tempo_s: 60 },
      { concluida: true, tempo_s: 60 },
      { concluida: true, tempo_s: 60 },
    ]);
    expect(p.novoEstado.tempo_alvo_s).toBe(65);
    expect(P.cargaDeHoje(pr, p.novoEstado).alvo_max).toBe(65);
  });
});

/* -------------------------------------------- estado sujo vindo do banco */

describe("estado com campos null vindos do banco (colunas anuláveis do schema)", () => {
  it("carga_atual_kg null cai na carga_inicial do JSON, na tela e na decisão", () => {
    const id = "supino-reto-com-barra";
    const st = estado(id, { carga_atual_kg: null });
    const hoje = P.cargaDeHoje(ex(id), st);
    expect(hoje.carga_kg).toBe(7.5);
    expect(hoje.montagem?.exato).toBe(true);
    const d = P.decidir(ex(id), st, reps(8, 8, 8));
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
  });

  it("reps_alvo e tempo_alvo_s nulos usam a faixa da prescrição (SPEC §6.1)", () => {
    const ep = ex("elevacao-de-pernas-na-barra-fixa"); // 3 × 10–15
    const hoje = P.cargaDeHoje(ep, { ...P.estadoInicial(ep), reps_alvo: null });
    expect(hoje.alvo_min).toBe(10);
    expect(hoje.alvo_max).toBe(15);
    const pr = ex("prancha");
    expect(P.cargaDeHoje(pr, { ...P.estadoInicial(pr), tempo_alvo_s: null }).alvo_max).toBe(60);
  });

  it("semana_leve sem carga_antes_leve não perde a carga nem inventa outra", () => {
    const id = "levantamento-terra";
    const st = estado(id, { carga_atual_kg: 27.5, semana_leve: true, carga_antes_leve: null });
    expect(P.cargaDeHoje(ex(id), st).carga_kg).toBe(27.5);
    const d = P.decidir(ex(id), st, reps(5, 5, 5));
    expect(d.evento?.motivo).toBe("fim_semana_leve");
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("assistência null num exercício de elástico começa no primeiro degrau", () => {
    const e = ex("barra-fixa-assistida");
    const hoje = P.cargaDeHoje(e, { ...P.estadoInicial(e), assistencia: null });
    expect(hoje.assistencia).toBe("pe_inteiro");
  });

  it("carreira aleatória: carga na escala, falhas ≤ 2, montagem exata, sem mutação", () => {
    let seed = 20260914;
    const r = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (const e of exercicios) {
      if (e.progressao.tipo === "plano_corda") continue;
      const presc = P.prescricaoPadrao(e);
      const escala = cargasPossiveis(e.implemento);
      let st: P.EstadoExercicio = P.estadoInicial(e, presc);
      for (let i = 0; i < 120; i++) {
        const congelado = JSON.stringify(st);
        const hoje = P.cargaDeHoje(e, st, presc);
        const alvo = hoje.alvo_max ?? 8;
        const series: P.SerieFeita[] = Array.from({ length: Math.max(1, presc.series) }, () => {
          const v = Math.max(0, Math.round(alvo + (r() * 6 - 3)));
          return {
            concluida: r() < 0.95,
            reps: v,
            reps_lado2: v,
            tempo_s: v,
            tempo_s_lado2: v,
            passos: v,
          };
        });
        const d = P.decidir(e, st, series, {
          prescricao: presc,
          ultimaFirme: r() < 0.7,
          seriesAnteriores: [4, 4, 4],
        });
        expect(JSON.stringify(st)).toBe(congelado);
        st = d.novoEstado;
        const carga = st.carga_atual_kg;
        if (carga !== null) {
          expect({ id: e.id, i, tem: escala.some((v) => c100(v) === c100(carga)) }).toEqual({
            id: e.id,
            i,
            tem: true,
          });
        }
        expect(st.falhas_seguidas).toBeGreaterThanOrEqual(0);
        expect(st.falhas_seguidas).toBeLessThanOrEqual(2);
        expect(st.sessoes_graca).toBeGreaterThanOrEqual(0);
        if (st.semana_leve) expect(st.carga_antes_leve).not.toBeNull();
        const depois = P.cargaDeHoje(e, st, presc);
        if (depois.montagem) expect(depois.montagem.exato).toBe(true);
        if (depois.carga_kg !== null) expect(Number.isNaN(depois.carga_kg)).toBe(false);
      }
    }
  });
});

/* ------------------------------------------------ tipo maximo e sugestões */

describe("tipo maximo, assistência e sugestões (SPEC §6.3)", () => {
  it("caso 15: 4,4,4 → 5,5,5 sobe; série abaixo da anterior segura a subida", () => {
    const e = ex("barra-fixa-pronada");
    const st = { ...P.estadoInicial(e), reps_alvo: 4 };
    const sobe = P.decidir(e, st, reps(5, 5, 5), { seriesAnteriores: [4, 4, 4] });
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.reps_alvo).toBe(5);
    const segura = P.decidir(e, st, reps(6, 6, 3), { seriesAnteriores: [4, 4, 4] });
    expect(segura.evento?.motivo).toBe("repetiu");
  });

  it("caso 15b: 3 séries de 10 sugerem a barra fixa com lastro", () => {
    const e = ex("barra-fixa-pronada");
    const d = P.decidir(e, { ...P.estadoInicial(e), reps_alvo: 9 }, reps(10, 10, 10), {
      seriesAnteriores: [9, 9, 9],
    });
    expect(d.evento?.sugestao).toMatch(/lastro/i);
  });

  it("caso 17: elevação de pernas 15,15,15 → alvo 16 e a sugestão da anilha passando de 20", () => {
    /*
     * CORRIGIDO (rodada 3): o gatilho é ACIMA de 20, não ≥ 20. SPEC §6.3 diz
     * "acima de 20 reps em todas as séries" e a `progressao.regra` do JSON,
     * "quando passar de 20" — o "todas ≥ 20" do doc é abreviação. Com ≥ 20 a
     * sugestão sairia no piso da faixa 20–30 (abdominal bicicleta) mandando
     * "voltar ao piso" quem já está nele.
     */
    const e = ex("elevacao-de-pernas-na-barra-fixa");
    const d = P.decidir(e, { ...P.estadoInicial(e), reps_alvo: 10 }, reps(15, 15, 15));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(16);
    expect(d.evento?.sugestao).toBeUndefined();
    const vinte = P.decidir(e, { ...P.estadoInicial(e), reps_alvo: 20 }, reps(20, 20, 20));
    expect(vinte.evento?.sugestao).toBeUndefined();
    const passou = P.decidir(e, { ...P.estadoInicial(e), reps_alvo: 20 }, reps(21, 21, 21));
    expect(passou.evento?.sugestao).toMatch(/anilha de 2 kg/i);
  });

  it("casos 13 e 14: degrau do elástico sobe e dá 2 sessões de graça", () => {
    const e = ex("barra-fixa-assistida"); // 4 × 5–8
    const sobe = P.decidir(e, P.estadoInicial(e), reps(8, 8, 8, 8), { ultimaFirme: true });
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.assistencia).toBe("joelho");
    expect(sobe.novoEstado.sessoes_graca).toBe(2);
    const graca1 = P.decidir(e, sobe.novoEstado, reps(5, 5, 4, 4));
    expect(graca1.evento?.motivo).toBe("repetiu");
    expect(graca1.evento?.falha).toBeUndefined();
    expect(graca1.novoEstado.falhas_seguidas).toBe(0);
    const graca2 = P.decidir(e, graca1.novoEstado, reps(5, 5, 4, 4));
    expect(graca2.novoEstado.falhas_seguidas).toBe(0);
    const semGraca = P.decidir(e, graca2.novoEstado, reps(5, 5, 4, 4));
    expect(semGraca.novoEstado.falhas_seguidas).toBe(1);
  });

  it("ACHADO: exercício de elástico recebe a sugestão da barra fixa com lastro", () => {
    /*
     * SPEC §6.3 liga os degraus do elástico e a saída para a "barra fixa com
     * lastro" à barra fixa assistida. `abertura-de-ombros` e
     * `good-morning-com-elastico` também têm progressao.tipo "assistencia" e,
     * ao chegar em "sem", recebem a mesma sugestão — conteúdo que não está no
     * JSON deles (progressao.regra: "Reduza a ajuda do elástico ... em vez de
     * mudar carga") e que manda fazer barra fixa em um exercício de ombro.
     * Obtido: "Sem elástico em todas as séries: passe para a barra fixa com
     * lastro." em abertura-de-ombros e good-morning-com-elastico.
     */
    for (const id of ["abertura-de-ombros", "good-morning-com-elastico"]) {
      const e = ex(id);
      const presc = P.prescricaoPadrao(e);
      const d = P.decidir(
        e,
        { ...P.estadoInicial(e), assistencia: "sem" },
        Array.from({ length: presc.series }, () => ({
          concluida: true,
          reps: presc.max ?? 20,
        })),
        { ultimaFirme: true },
      );
      expect({ id, sugestao: d.evento?.sugestao ?? "" }).toEqual({
        id,
        sugestao: expect.not.stringMatching(/barra fixa/i) as unknown as string,
      });
    }
  });

  it("caso 22: no teto da barra a subida vira repetiu com o aviso das anilhas", () => {
    const e = ex("supino-reto-com-barra");
    const d = P.decidir(e, estado("supino-reto-com-barra", { carga_atual_kg: 107.5 }), reps(8, 8, 8), {
      ultimaFirme: true,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.aviso).toMatch(/anilhas de 10 kg/);
    expect(d.novoEstado.carga_atual_kg).toBe(107.5);
  });
});

/* ------------------------------------------------------------- calendário */

describe("datas na virada do ano, bissexto e semana começando na segunda", () => {
  const perfil1: C.PerfilCalendario = {
    fase_atual: "fase1",
    ultimo_treino: "A1",
    fase_desde: "2026-09-14",
  };

  it("01/01/2027 é sexta e a semana dele começa em 28/12/2026", () => {
    expect(C.diaDaSemana("2027-01-01")).toBe("sex");
    expect(C.iso(C.inicioDaSemana("2027-01-01"))).toBe("2026-12-28");
    expect(C.diasDaSemana("2027-01-01").map(C.iso)).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
    // domingo fecha a semana, não abre outra
    expect(C.iso(C.inicioDaSemana("2027-01-03"))).toBe("2026-12-28");
    expect(C.iso(C.inicioDaSemana("2027-01-04"))).toBe("2027-01-04");
  });

  it("29/02/2028 (bissexto) é terça e cai no cardio da Fase 1", () => {
    expect(C.diaDaSemana("2028-02-29")).toBe("ter");
    const dia = C.treinoDeHoje("2028-02-29", perfil1);
    expect(dia.tipo).toBe("cardio");
    expect(C.iso(C.inicioDaSemana("2028-02-29"))).toBe("2028-02-28");
    expect(C.diasDaSemana("2028-02-29").map(C.iso)).toContain("2028-03-05");
  });

  it("a semana da fase não reinicia no ano novo", () => {
    expect(C.semanaDaFase("2026-09-14", "2026-09-14")).toBe(1);
    expect(C.semanaDaFase("2026-12-28", "2026-09-14")).toBe(16);
    expect(C.semanaDaFase("2027-01-03", "2026-09-14")).toBe(16);
    expect(C.semanaDaFase("2027-01-04", "2026-09-14")).toBe(17);
  });

  it("a semana que cruza o ano mantém os dias do programa e a alternância", () => {
    const semana = C.semanaDoPlano("2026-12-31", perfil1);
    expect(semana.map((d) => d.tipo)).toEqual([
      "forca",
      "cardio",
      "forca",
      "descanso",
      "forca",
      "cardio",
      "descanso",
    ]);
    expect(semana.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "B1",
      "A1",
      "B1",
    ]);
    expect(semana.map((d) => d.data)).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  it("a Fase 2 conta 12 semanas civis e 30 sessões, mesmo cruzando o ano", () => {
    const base: C.PerfilCalendario = {
      fase_atual: "fase1",
      ultimo_treino: null,
      fase_desde: "2026-12-28",
    };
    expect(C.sugerirFase2(base, 30, "2027-03-21").sugerir).toBe(false);
    expect(C.sugerirFase2(base, 30, "2027-03-22").sugerir).toBe(true);
    expect(C.sugerirFase2(base, 29, "2027-03-22").sugerir).toBe(false);
    // adiar silencia por 2 semanas e volta exatamente no dia
    const adiada = C.adiarFase2("2027-03-22");
    expect(adiada).toBe("2027-04-05");
    const comAdiamento = { ...base, prefs: { fase2_adiada_ate: adiada } };
    expect(C.sugerirFase2(comAdiamento, 30, "2027-04-04").sugerir).toBe(false);
    expect(C.sugerirFase2(comAdiamento, 30, "2027-04-05").sugerir).toBe(true);
  });

  it("as semanas dos planos repetem com menos de 2 sessões e param em 12 (§5.5)", () => {
    expect(C.avancarSemanaDeCorrida(3, 0)).toBe(3);
    expect(C.avancarSemanaDeCorrida(3, 1)).toBe(3);
    expect(C.avancarSemanaDeCorrida(3, 2)).toBe(4);
    expect(C.avancarSemanaDeCorrida(12, 2)).toBe(12);
    expect(C.avancarSemanaDeCorda(12, 2)).toBe(12);
    expect(C.avancarSemanaDeBarraFixa(12, 2)).toBe(12);
    expect(C.avancarSemanaDeBarraFixa(11, 2)).toBe(12);
  });

  it("o que falta na semana compara datas de anos diferentes na ordem certa", () => {
    const semana = C.semanaDoPlano("2026-12-31", perfil1);
    const r = C.oQueFaltaNaSemana(
      semana,
      [{ data: "2026-12-28", tipo: "forca" }],
      "2027-01-01",
    );
    expect(r.feitos.map((d) => d.data)).toEqual(["2026-12-28"]);
    expect(r.perdidos.map((d) => d.data)).toEqual(["2026-12-29", "2026-12-30"]);
    expect(r.faltando.map((d) => d.data)).toEqual(["2027-01-01", "2027-01-02"]);
    expect(r.total).toBe(5);
  });

  it("ACHADO: na Fase 2 um dia trocado para força fica sem treino", () => {
    /*
     * SPEC §3.5 deixa trocar o tipo de um dia futuro (schedule_overrides, com
     * workout_id nulo) e §5.3 diz que treinar fora do dia vale como o próximo
     * treino. Na Fase 1 a alternância resolve; na Fase 2 o motor lê o treino
     * fixo do dia da semana e, num dia de cardio ou descanso, devolve null —
     * a tela Hoje fica com um card de força sem treino para começar.
     * Obtido: treinoId null e treino null em 30/12/2026 (quarta, cardio) e
     * 03/01/2027 (domingo, descanso).
     */
    const perfil2: C.PerfilCalendario = {
      fase_atual: "fase2",
      ultimo_treino: "SA",
      fase_desde: "2026-09-14",
    };
    for (const data of ["2026-12-30", "2027-01-03"]) {
      const dia = C.treinoDeHoje(data, perfil2, [
        { data, tipo: "forca", workout_id: null, sessao: null },
      ]);
      expect(dia.tipo).toBe("forca");
      expect({ data, treinoId: dia.treinoId }).not.toEqual({ data, treinoId: null });
    }
  });
});

/* ------------------------------------------------------------ semana curta */

describe("semana curta: as vagas, a ordem de sacrifício e o Treino A (SPEC §5.4)", () => {
  const DIAS7: DiaSemana[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

  function perfilDe(fase: "fase1" | "fase2"): C.PerfilCalendario {
    return {
      fase_atual: fase,
      ultimo_treino: fase === "fase1" ? "B1" : null,
      fase_desde: "2026-09-14",
    };
  }

  it("os treinos protegidos saem dos dados, não do código", () => {
    expect(C.treinosComAgachamentoOuTerra().sort()).toEqual(["A1", "B1", "IA", "IB"]);
  });

  it("corta primeiro a corrida de sábado, depois a outra sessão de cardio", () => {
    const semana = C.semanaDoPlano("2026-12-28", perfilDe("fase1"));
    const tres = C.semanaCurta(["qui", "sab", "dom", "ter"], semana);
    expect(tres.capacidade).toBe(3);
    expect(tres.cortados.map((c) => c.tipo)).toEqual(["cardio", "cardio"]);
    expect(tres.dias.filter((d) => d.tipo === "cardio")).toHaveLength(0);
    expect(tres.dias.filter((d) => d.tipo === "forca")).toHaveLength(3);
  });

  it("os 128 subconjuntos de dias marcados, nas duas fases, respeitam as regras", () => {
    const prot = C.treinosComAgachamentoOuTerra();
    for (const fase of ["fase1", "fase2"] as const) {
      const semana = C.semanaDoPlano("2026-12-28", perfilDe(fase));
      const atividades = semana.filter((d) => d.tipo !== "descanso").length;
      for (let mask = 0; mask < 128; mask++) {
        const marcados = DIAS7.filter((_, i) => mask & (1 << i));
        const r = C.semanaCurta(marcados, semana);
        const rotulo = `${fase} [${marcados.join(",") || "nenhum"}]`;
        const ficaram = r.dias.filter((d) => d.tipo !== "descanso");
        expect({ rotulo, cabe: ficaram.length <= r.capacidade }).toEqual({
          rotulo,
          cabe: true,
        });
        for (const d of ficaram) {
          expect({ rotulo, dia: d.dia, marcado: marcados.includes(d.dia) }).toEqual({
            rotulo,
            dia: d.dia,
            marcado: false,
          });
        }
        expect({ rotulo, soma: ficaram.length + r.cortados.length }).toEqual({
          rotulo,
          soma: atividades,
        });
        const cortouProtegido = r.cortados.some(
          (c) => c.treinoId !== null && prot.includes(c.treinoId),
        );
        const sobrouAlternativa = ficaram.some(
          (d) =>
            d.tipo === "cardio" ||
            (d.treinoId !== null && !prot.includes(d.treinoId as TreinoId)),
        );
        expect({ rotulo, erro: cortouProtegido && sobrouAlternativa }).toEqual({
          rotulo,
          erro: false,
        });
        const cortouForca = r.cortados.some((c) => c.tipo === "forca");
        const sobrouCardio = ficaram.some((d) => d.tipo === "cardio");
        expect({ rotulo, erro: cortouForca && sobrouCardio }).toEqual({
          rotulo,
          erro: false,
        });
        const forca = ficaram.filter((d) => d.tipo === "forca");
        if (fase === "fase1" && forca.length === 1) {
          expect({ rotulo, treino: forca[0]?.treinoId }).toEqual({ rotulo, treino: "A1" });
        }
        for (let i = 1; i < forca.length; i++) {
          if (fase !== "fase1") break;
          expect({ rotulo, igual: forca[i]?.treinoId === forca[i - 1]?.treinoId }).toEqual({
            rotulo,
            igual: false,
          });
        }
        for (const d of ficaram) {
          if (d.tipo === "forca") {
            expect({ rotulo, dia: d.dia, temTreino: d.treinoId !== null }).toEqual({
              rotulo,
              dia: d.dia,
              temTreino: true,
            });
          }
          if (d.tipo === "cardio") {
            expect({ rotulo, dia: d.dia, temSessao: d.cardio !== null }).toEqual({
              rotulo,
              dia: d.dia,
              temSessao: true,
            });
          }
        }
      }
    }
  });
});
