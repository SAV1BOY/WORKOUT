/**
 * Auditoria adversarial do motor — lente "bordas" (rodada 4).
 *
 * Bordas numéricas e de estoque, com igualdade EXATA (nada de toBeCloseTo):
 * escala dos implementos, montagem guloso contra o estoque real, as reduções
 * de 10 % e 60 %, o incremento reduzido, séries malformadas, estado sujo vindo
 * do banco, a barra W pesada depois (SPEC §3.9) e as datas na virada do ano.
 *
 * Referências: SPEC.md §3.9, §5.1–§5.5, §6.1–§6.5 e
 * docs/casos-de-teste-progressao.md.
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

/* --------------------------------------------------------------- ajudas */

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

/** Centésimos inteiros: cargas comparadas sem passar por ponto flutuante. */
const cent = (x: number) => Math.round(x * 100);

const PESOS = [1, 2, 3, 4, 5, 10] as const;
/** data/equipamentos.json: quatro anilhas de cada peso. */
const QTD_POR_PESO = 4;

const COM_ANILHAS = [
  "barra_macica",
  "halteres",
  "barra_w",
  "barra_reta_oca",
  "polia",
] as const satisfies readonly ImplementoMontagem[];

/** base, fator, limite por lado/ponta/pino e capacidade — do doc de casos. */
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

/** A escala recalculada aqui, sem olhar lib/montagem.ts. */
function escalaDeReferencia(imp: (typeof COM_ANILHAS)[number]): number[] {
  const { base, fator, porPeso, capacidade } = FICHA[imp];
  const teto = Math.floor((capacidade - base) / fator);
  let somas = new Set<number>([0]);
  for (const kg of PESOS) {
    const novas = new Set<number>();
    for (const s of somas) {
      for (let n = 0; n <= Math.min(porPeso, QTD_POR_PESO); n++) {
        if (s + n * kg <= teto) novas.add(s + n * kg);
      }
    }
    somas = novas;
  }
  return [...somas].sort((a, b) => a - b).map((s) => base + fator * s);
}

/** Maior valor da escala ≤ alvo, em centésimos inteiros (sem float). */
function pisoExato(escalaCent: number[], alvoCent: number): number {
  let melhor = escalaCent[0] as number;
  for (const v of escalaCent) if (v <= alvoCent) melhor = v;
  return melhor;
}

/* ------------------------------------------------- 1. escala e float */

describe("escala: igualdade exata, sem resíduo de ponto flutuante", () => {
  it("cada escala bate com a referência calculada do estoque", () => {
    for (const imp of COM_ANILHAS) {
      const obtida = cargasPossiveis(imp).map(cent);
      const esperada = escalaDeReferencia(imp).map(cent);
      expect(obtida, imp).toEqual(esperada);
    }
  });

  it("os inválidos do doc caem exatamente na vizinha de baixo", () => {
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

  it("tetos e pisos exatos (doc: 107,5 · 39,5 · 100 · 50 · base 2,0)", () => {
    expect(cargaMinima("barra_macica")).toBe(7.5);
    expect(cargaMaxima("barra_macica")).toBe(107.5);
    expect(cargaMinima("halteres")).toBe(1.5);
    expect(cargaMaxima("halteres")).toBe(39.5);
    expect(cargaMinima("barra_w")).toBe(2);
    expect(cargaMaxima("barra_w")).toBe(50);
    expect(cargaMaxima("polia")).toBe(100);
    expect(cargaMaxima("barra_reta_oca")).toBe(60);
  });

  it("50 subidas de 2 kg na barra: cada passo é exatamente +2, sem 9,499999", () => {
    let carga = 7.5;
    const vistos: number[] = [carga];
    for (let i = 0; i < 60; i++) {
      const proxima = alcancavelParaBaixo(carga + 2, "barra_macica");
      if (proxima === carga) break;
      expect(cent(proxima) - cent(carga)).toBe(200);
      carga = proxima;
      vistos.push(carga);
    }
    expect(carga).toBe(107.5);
    expect(vistos).toHaveLength(51);
    expect(vistos.map(cent)).toEqual(cargasPossiveis("barra_macica").map(cent));
  });

  it("19 subidas de 2 kg no halter e 100 de 1 kg no pino ficam exatas", () => {
    let halter = 1.5;
    for (let i = 0; i < 19; i++) {
      halter = alcancavelParaBaixo(halter + 2, "halteres");
      expect(cent(halter)).toBe(cent(1.5) + 200 * (i + 1));
    }
    expect(halter).toBe(39.5);

    let pino = 0;
    for (let i = 1; i <= 100; i++) {
      pino = alcancavelParaBaixo(pino + 1, "polia");
      expect(pino).toBe(i);
    }
  });

  it("alcancavelParaBaixo é idempotente e nunca sobe dentro da escala", () => {
    for (const imp of COM_ANILHAS) {
      for (const carga of cargasPossiveis(imp)) {
        expect(alcancavelParaBaixo(carga, imp), `${imp} ${carga}`).toBe(carga);
        const meio = carga + 0.25;
        expect(alcancavelParaBaixo(meio, imp)).toBe(carga);
      }
    }
  });
});

/* -------------------------------------------- 2. montagem × estoque */

describe("montagem: guloso contra o estoque real (2 por lado, 1 por ponta)", () => {
  it("os exemplos literais do doc de casos", () => {
    expect(montagem(25.5, "barra_macica")).toMatchObject({
      porLado: [5, 4],
      total: 25.5,
      exato: true,
    });
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
    expect(m1095.aviso).toMatch(/anilhas de 10/);
  });

  it("toda carga da escala fecha exata e cabe no estoque dos dois lados", () => {
    for (const imp of COM_ANILHAS) {
      const { base, fator, porPeso } = FICHA[imp];
      for (const carga of cargasPossiveis(imp)) {
        const m = montagem(carga, imp);
        expect(m.exato, `${imp} ${carga}`).toBe(true);
        expect(m.total).toBe(carga);
        const soma = m.anilhas.reduce((s, v) => s + v, 0);
        expect(cent(base + fator * soma), `${imp} ${carga}`).toBe(cent(carga));
        // ordem decrescente e limite por lado / ponta / pino
        expect([...m.anilhas].sort((a, b) => b - a)).toEqual(m.anilhas);
        for (const kg of PESOS) {
          const n = m.anilhas.filter((a) => a === kg).length;
          expect(n, `${imp} ${carga}: ${n} anilhas de ${kg}`).toBeLessThanOrEqual(
            porPeso,
          );
          // o par de halteres usa 4 pontas; a barra, 2 lados; o pino, 1
          const usadas = imp === "halteres" ? n * 4 : n * fator;
          expect(usadas, `${imp} ${carga}: ${kg} kg`).toBeLessThanOrEqual(
            QTD_POR_PESO,
          );
        }
      }
    }
  });

  it("polia: as somas que exigem combinação fecham exatas", () => {
    for (const kg of [7, 9, 11, 13, 17, 19, 23]) {
      const m = montagem(kg, "polia");
      expect(m.exato, `${kg} kg no pino`).toBe(true);
      expect(m.noPino?.reduce((s, v) => s + v, 0)).toBe(kg);
      for (const p of PESOS) {
        expect(m.noPino?.filter((a) => a === p).length ?? 0).toBeLessThanOrEqual(
          QTD_POR_PESO,
        );
      }
    }
    expect(montagem(100, "polia").noPino).toEqual([
      10, 10, 10, 10, 5, 5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1,
    ]);
  });

  it("o aviso das anilhas só sai onde o estoque é o limite (SPEC §6.4)", () => {
    expect(limiteDoImplemento("barra_macica")).toBe("estoque");
    expect(limiteDoImplemento("halteres")).toBe("capacidade");
    expect(limiteDoImplemento("barra_w")).toBe("capacidade");
    expect(limiteDoImplemento("polia")).toBe("capacidade");
    expect(montagem(41.5, "halteres").aviso).toBeUndefined();
    expect(montagem(52, "barra_w").aviso).toBeUndefined();
    expect(montagem(101, "polia").aviso).toBeUndefined();
    expect(montagem(41.5, "halteres").total).toBe(39.5);
    expect(montagem(52, "barra_w").total).toBe(50);
    expect(montagem(101, "polia").total).toBe(100);
  });

  it("toda carga_inicial do catálogo existe na escala do implemento", () => {
    for (const e of exercicios) {
      const inicial = e.carga_inicial.kg;
      expect(
        alcancavelParaBaixo(inicial, e.implemento),
        `${e.id} (${e.implemento}) carga inicial ${inicial}`,
      ).toBe(inicial);
      const hoje = P.cargaDeHoje(e, null);
      expect(hoje.carga_kg, e.id).toBe(inicial);
      expect(hoje.montagem?.exato, e.id).toBe(true);
    }
  });
});

/* ------------------------------------- 3. reduções de 10 % e 60 % */

describe("carga × 0,9 e × 0,6 sempre alcançáveis para baixo (SPEC §6.2/§6.4)", () => {
  it("em toda a escala da barra, do halter e do pino, com aritmética inteira", () => {
    for (const imp of ["barra_macica", "halteres", "polia"] as const) {
      const escala = cargasPossiveis(imp).map(cent);
      for (const carga of cargasPossiveis(imp)) {
        for (const [fator, num] of [
          [0.9, 9],
          [0.6, 6],
        ] as const) {
          const alvo = (cent(carga) * num) / 10; // exato: cargas são múltiplas de 0,5
          expect(Number.isInteger(alvo)).toBe(true);
          const esperado = Math.min(cent(carga), pisoExato(escala, alvo));
          const obtido = Math.min(
            cent(carga),
            cent(alcancavelParaBaixo(carga * fator, imp)),
          );
          expect(obtido, `${imp} ${carga} × ${fator}`).toBe(esperado);
        }
      }
    }
  });

  it("os números dos casos 5, 6, 8 e 9 saem redondos do motor", () => {
    // caso 5: supino 25,5 com 1 falha → 2ª falha
    const d5 = P.decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 25.5, falhas_seguidas: 1 }),
      reps(7, 5, 3),
    );
    expect(d5.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(d5.novoEstado.carga_atual_kg).toBe(21.5);
    expect(d5.novoEstado.exigir_rep_extra).toBe(true);
    expect(P.incrementoDe(ex("supino-reto-com-barra"), d5.novoEstado)).toBe(2);

    // caso 6: agachamento 39,5 com 1 falha
    const d6 = P.decidir(
      ex("agachamento-livre"),
      estado("agachamento-livre", { carga_atual_kg: 39.5, falhas_seguidas: 1 }),
      reps(5, 4, 3),
    );
    expect(d6.novoEstado.carga_atual_kg).toBe(35.5);
    expect(d6.novoEstado.exigir_rep_extra).toBe(false);
    expect(P.incrementoDe(ex("agachamento-livre"), d6.novoEstado)).toBe(2);

    // caso 8: terra 47,5 com 2 falhas → semana leve
    const d8 = P.decidir(
      ex("levantamento-terra"),
      estado("levantamento-terra", { carga_atual_kg: 47.5, falhas_seguidas: 2 }),
      reps(4, 3, 3),
    );
    expect(d8.evento?.motivo).toBe("semana_leve_60");
    expect(d8.novoEstado.carga_atual_kg).toBe(27.5);
    expect(d8.novoEstado.carga_antes_leve).toBe(47.5);
    expect(d8.novoEstado.falhas_seguidas).toBe(0);

    // a tela da semana leve mostra a mesma carga que o estado guardou
    const leve = P.cargaDeHoje(ex("levantamento-terra"), d8.novoEstado);
    expect(leve.carga_kg).toBe(27.5);
    expect(leve.montagem?.exato).toBe(true);

    // caso 9: a sessão da semana leve volta à carga de antes
    const d9 = P.decidir(ex("levantamento-terra"), d8.novoEstado, reps(5, 5, 5));
    expect(d9.evento?.motivo).toBe("fim_semana_leve");
    expect(d9.novoEstado.carga_atual_kg).toBe(47.5);
    expect(d9.novoEstado.semana_leve).toBe(false);
    expect(P.incrementoDe(ex("levantamento-terra"), d9.novoEstado)).toBe(4);
  });

  it("o ciclo 3 falhas → semana leve → volta nunca sai da escala", () => {
    const e = ex("supino-reto-com-barra");
    let st = estado("supino-reto-com-barra", { carga_atual_kg: 45.5 });
    const escala = cargasPossiveis("barra_macica");
    for (let i = 0; i < 3; i++) {
      st = P.decidir(e, st, reps(3, 3, 3)).novoEstado;
      expect(escala).toContain(st.carga_atual_kg);
      expect(P.cargaDeHoje(e, st).carga_kg).toBe(
        st.semana_leve
          ? Math.min(st.carga_antes_leve as number, alcancavelParaBaixo((st.carga_antes_leve as number) * 0.6, "barra_macica"))
          : st.carga_atual_kg,
      );
    }
    expect(st.semana_leve).toBe(true);
    // 45,5 × 0,9 = 40,95 → 39,5; a semana leve roda a 39,5 × 0,6 = 23,7 → 23,5
    expect(st.carga_antes_leve).toBe(39.5);
    expect(st.carga_atual_kg).toBe(23.5);
    const fim = P.decidir(e, st, reps(8, 8, 8)).novoEstado;
    expect(escala).toContain(fim.carga_atual_kg);
    expect(fim.carga_atual_kg).toBe(39.5);
  });

  it("no piso da escala a redução não inventa carga menor que a barra vazia", () => {
    const d = P.decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 7.5, falhas_seguidas: 1 }),
      reps(2, 2, 2),
    );
    expect(d.novoEstado.carga_atual_kg).toBe(7.5);
    const h = P.decidir(
      ex("rosca-alternada"),
      estado("rosca-alternada", { carga_atual_kg: 1.5, falhas_seguidas: 2 }),
      lados([2, 2], [2, 2], [2, 2]),
    );
    expect(h.novoEstado.carga_atual_kg).toBe(1.5);
  });
});

/* ------------------------------------------ 4. incremento reduzido */

describe("incremento reduzido: +4 vira 2 e +2 fica 2 exigindo topo + 1 rep", () => {
  it("nunca cai abaixo do passo mínimo de 2 kg em nenhum exercício de carga", () => {
    for (const e of exercicios) {
      if (e.progressao.tipo !== "carga") continue;
      const st = estado(e.id, { incremento_reduzido: true });
      const inc = P.incrementoDe(e, st);
      const base = e.progressao.incremento_kg ?? 0;
      expect(inc, e.id).toBe(Math.max(base / 2, 2));
      expect(inc, e.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("caso 7: a subida depois da redução usa 2 kg e devolve o incremento normal", () => {
    const e = ex("agachamento-livre");
    const st = estado("agachamento-livre", {
      carga_atual_kg: 35.5,
      falhas_seguidas: 2,
      incremento_reduzido: true,
    });
    expect(P.cargaDeHoje(e, st).incremento_kg).toBe(2);
    const d = P.decidir(e, st, reps(5, 5, 5));
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
    const topo = P.decidir(e, st, reps(8, 8, 8));
    expect(topo.evento?.motivo).toBe("repetiu");
    expect(topo.novoEstado.carga_atual_kg).toBe(21.5);
    const extra = P.decidir(e, st, reps(9, 9, 9));
    expect(extra.evento?.motivo).toBe("subiu");
    expect(extra.novoEstado.carga_atual_kg).toBe(23.5);
    expect(extra.novoEstado.exigir_rep_extra).toBe(false);
  });

  it("a subida reduzida de 2 kg cai num degrau real de cada implemento", () => {
    const halter = P.decidir(
      ex("rosca-martelo"),
      estado("rosca-martelo", {
        carga_atual_kg: 11.5,
        incremento_reduzido: true,
        exigir_rep_extra: true,
      }),
      reps(13, 13, 13),
    );
    expect(halter.novoEstado.carga_atual_kg).toBe(13.5);
    const pino = P.decidir(
      ex("puxada-alta-na-polia"),
      estado("puxada-alta-na-polia", {
        carga_atual_kg: 9,
        incremento_reduzido: true,
        exigir_rep_extra: true,
      }),
      reps(13, 13, 13),
    );
    expect(pino.novoEstado.carga_atual_kg).toBe(11);
  });
});

/* ------------------------------------- 4b. teto de cada implemento */

describe("no teto da escala a subida vira repetiu com o aviso certo (§6.4)", () => {
  it("barra: faltam anilhas de 10 kg (caso 22); halter, pino e W: capacidade", () => {
    const barra = P.decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 107.5 }),
      reps(8, 8, 8),
    );
    expect(barra.evento?.motivo).toBe("repetiu");
    expect(barra.novoEstado.carga_atual_kg).toBe(107.5);
    expect(barra.evento?.aviso).toMatch(/anilhas de 10 kg/);

    const halter = P.decidir(
      ex("rosca-martelo"),
      estado("rosca-martelo", { carga_atual_kg: 39.5 }),
      reps(12, 12, 12),
    );
    expect(halter.evento?.motivo).toBe("repetiu");
    expect(halter.novoEstado.carga_atual_kg).toBe(39.5);
    expect(halter.evento?.aviso).toMatch(/capacidade 40 kg/);
    expect(halter.evento?.aviso).not.toMatch(/faltam anilhas/);

    const pino = P.decidir(
      ex("puxada-alta-na-polia"),
      estado("puxada-alta-na-polia", { carga_atual_kg: 100 }),
      reps(12, 12, 12),
    );
    expect(pino.evento?.aviso).toMatch(/capacidade 100 kg/);

    const w = P.decidir(
      ex("rosca-com-barra-w"),
      estado("rosca-com-barra-w", { carga_atual_kg: 50 }),
      reps(12, 12, 12),
    );
    expect(w.evento?.aviso).toMatch(/capacidade 50 kg/);
  });

  it("um degrau antes do teto ainda sobe, até onde a escala deixa", () => {
    const pino = P.decidir(
      ex("puxada-alta-na-polia"),
      estado("puxada-alta-na-polia", { carga_atual_kg: 99 }),
      reps(12, 12, 12),
    );
    expect(pino.evento?.motivo).toBe("subiu");
    expect(pino.novoEstado.carga_atual_kg).toBe(100); // 99 + 2 = 101 → 100
    const halter = P.decidir(
      ex("rosca-martelo"),
      estado("rosca-martelo", { carga_atual_kg: 37.5 }),
      reps(12, 12, 12),
    );
    expect(halter.novoEstado.carga_atual_kg).toBe(39.5);
    const barra = P.decidir(
      ex("supino-reto-com-barra"),
      estado("supino-reto-com-barra", { carga_atual_kg: 105.5 }),
      reps(8, 8, 8),
    );
    expect(barra.novoEstado.carga_atual_kg).toBe(107.5);
  });
});

/* --------------------------------- 5. séries malformadas (SPEC §6.2) */

describe("séries nulas, não concluídas, a mais e a menos que a prescrição", () => {
  const e = ex("supino-reto-com-barra");
  const st = () => estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });

  it("reps null e série não concluída contam falha na sessão concluída", () => {
    const nula = P.decidir(e, st(), [
      { concluida: true, reps: 8 },
      { concluida: true, reps: 8 },
      { concluida: true, reps: null },
    ]);
    expect(nula.evento?.falha).toBe(true);
    expect(nula.novoEstado.falhas_seguidas).toBe(1);
    expect(nula.novoEstado.carga_atual_kg).toBe(25.5);

    const aberta = P.decidir(e, st(), [
      { concluida: true, reps: 8 },
      { concluida: false, reps: 8 },
      { concluida: true, reps: 8 },
    ]);
    expect(aberta.evento?.falha).toBe(true);
  });

  it("menos séries que a prescrição: falha na concluída, nada na abandonada", () => {
    const concluida = P.decidir(e, st(), reps(8, 8));
    expect(concluida.evento?.falha).toBe(true);
    expect(concluida.novoEstado.falhas_seguidas).toBe(1);

    const abandonada = P.decidir(e, st(), reps(8), { sessaoAbandonada: true });
    expect(abandonada.evento).toBeNull();
    expect(abandonada.novoEstado.falhas_seguidas).toBe(0);
    expect(abandonada.novoEstado.carga_atual_kg).toBe(25.5);
  });

  it("série de trabalho a mais é avaliada junto (§6.2: alguma série abaixo)", () => {
    const ruim = P.decidir(e, st(), reps(8, 8, 8, 3));
    expect(ruim.evento?.falha).toBe(true);
    const boa = P.decidir(e, st(), reps(8, 8, 8, 8));
    expect(boa.evento?.motivo).toBe("subiu");
    expect(boa.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("aquecimento não entra na conta e sessão só de aquecimento não decide", () => {
    const d = P.decidir(e, st(), [
      { concluida: true, reps: 5, tipo: "aquecimento" },
      { concluida: true, reps: 5, tipo: "aquecimento" },
      ...reps(8, 8, 8),
    ]);
    expect(d.evento?.motivo).toBe("subiu");

    const so = P.decidir(e, st(), [
      { concluida: true, reps: 5, tipo: "aquecimento" },
    ]);
    expect(so.evento).toBeNull();
    expect(so.novoEstado.carga_atual_kg).toBe(25.5);

    const vazio = P.decidir(e, st(), []);
    expect(vazio.evento).toBeNull();
  });

  it("unilateral: vale o menor lado; sem lado 2 vale o lado registrado", () => {
    const bulgaro = ex("agachamento-bulgaro");
    const base = estado("agachamento-bulgaro", { carga_atual_kg: 5.5 });
    // caso 18: 10/10, 10/10, 10/9 → repetiu
    expect(
      P.decidir(bulgaro, base, lados([10, 10], [10, 10], [10, 9])).evento?.motivo,
    ).toBe("repetiu");
    // o lado ruim pode ser o primeiro
    expect(
      P.decidir(bulgaro, base, lados([9, 10], [10, 10], [10, 10])).evento?.motivo,
    ).toBe("repetiu");
    // caso 10: rosca alternada 12/12, 12/12, 12/11
    const rosca = ex("rosca-alternada");
    expect(
      P.decidir(rosca, estado("rosca-alternada"), lados([12, 12], [12, 12], [12, 11]))
        .evento?.motivo,
    ).toBe("repetiu");
    // caso 11: 12/12 nas três → 3,5 por halter
    const sobe = P.decidir(
      rosca,
      estado("rosca-alternada"),
      lados([12, 12], [12, 12], [12, 12]),
    );
    expect(sobe.novoEstado.carga_atual_kg).toBe(3.5);
    // lado 2 ausente: vale o lado registrado
    const semLado2 = P.decidir(rosca, estado("rosca-alternada"), reps(12, 12, 12));
    expect(semLado2.evento?.motivo).toBe("subiu");
    expect(semLado2.novoEstado.carga_atual_kg).toBe(3.5);
  });

  it("passos e tempo: casos 19 e 16 fecham nos números do doc", () => {
    const walk = ex("farmer-s-walk");
    const d19 = P.decidir(walk, estado("farmer-s-walk", { carga_atual_kg: 11.5 }), [
      { concluida: true, passos: 40 },
      { concluida: true, passos: 40 },
      { concluida: true, passos: 40 },
    ]);
    expect(d19.evento?.motivo).toBe("subiu");
    expect(d19.novoEstado.carga_atual_kg).toBe(13.5);
    // passos abaixo do piso é falha
    const curto = P.decidir(walk, estado("farmer-s-walk", { carga_atual_kg: 11.5 }), [
      { concluida: true, passos: 40 },
      { concluida: true, passos: 29 },
      { concluida: true, passos: 40 },
    ]);
    expect(curto.evento?.falha).toBe(true);

    const prancha = ex("prancha");
    const d16 = P.decidir(prancha, estado("prancha"), [
      { concluida: true, tempo_s: 60 },
      { concluida: true, tempo_s: 60 },
      { concluida: true, tempo_s: 60 },
    ]);
    expect(d16.evento?.motivo).toBe("subiu");
    expect(d16.novoEstado.tempo_alvo_s).toBe(65);
    expect(P.cargaDeHoje(prancha, d16.novoEstado).alvo_max).toBe(65);
  });
});

/* ---------------------------- 6. estado sujo vindo do banco (§6.1) */

describe("estado com campos null vindos do banco", () => {
  /** Uma linha de exercise_state com tudo que é anulável em null. */
  const linhaCrua = {
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
  } satisfies P.EstadoExercicio;

  it("carga_atual_kg null cai na carga_inicial do JSON, na tela e na decisão", () => {
    const e = ex("supino-reto-com-barra");
    const hoje = P.cargaDeHoje(e, { ...linhaCrua });
    expect(hoje.carga_kg).toBe(7.5);
    expect(hoje.montagem?.exato).toBe(true);
    expect(hoje.incremento_kg).toBe(2);
    const d = P.decidir(e, { ...linhaCrua }, reps(8, 8, 8));
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
    const f = P.decidir(
      e,
      { ...linhaCrua, falhas_seguidas: 1 },
      reps(4, 4, 4),
    );
    expect(f.novoEstado.carga_atual_kg).toBe(7.5); // 7,5 × 0,9 não desce da barra vazia
  });

  it("reps_alvo, tempo_alvo_s e assistência nulos usam a prescrição (§6.1)", () => {
    const pernas = P.cargaDeHoje(ex("elevacao-de-pernas-na-barra-fixa"), {
      ...linhaCrua,
    });
    expect(pernas.alvo_min).toBe(10);
    expect(pernas.alvo_max).toBe(15);
    const prancha = P.cargaDeHoje(ex("prancha"), { ...linhaCrua });
    expect(prancha.tempo_alvo_s).toBe(30);
    expect(prancha.alvo_max).toBe(60);
    const fixa = P.cargaDeHoje(ex("barra-fixa-assistida"), { ...linhaCrua });
    expect(fixa.assistencia).toBe("pe_inteiro");
  });

  it("semana_leve sem carga_antes_leve não inventa carga", () => {
    const e = ex("levantamento-terra");
    const st: P.EstadoExercicio = {
      ...linhaCrua,
      carga_atual_kg: 27.5,
      semana_leve: true,
    };
    expect(P.cargaDeHoje(e, st).carga_kg).toBe(27.5);
    const d = P.decidir(e, st, reps(5, 5, 5));
    expect(d.evento?.motivo).toBe("fim_semana_leve");
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("decidir não muda o estado que recebeu (o objeto do banco fica intacto)", () => {
    const e = ex("supino-reto-com-barra");
    const st = estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });
    const copia = JSON.parse(JSON.stringify(st)) as P.EstadoExercicio;
    P.decidir(e, st, reps(8, 8, 8));
    P.decidir(e, st, reps(2, 2, 2));
    expect(st).toEqual(copia);
  });

  it("carreira de 40 sessões aleatórias: carga sempre na escala e montagem exata", () => {
    let semente = 20260914;
    const aleatorio = () => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente / 2147483648;
    };
    for (const id of [
      "supino-reto-com-barra",
      "agachamento-livre",
      "rosca-alternada",
      "puxada-alta-na-polia",
      "rosca-com-barra-w",
    ]) {
      const e = ex(id);
      const escala = cargasPossiveis(e.implemento);
      let st: P.EstadoExercicio | null = null;
      for (let i = 0; i < 40; i++) {
        const hoje = P.cargaDeHoje(e, st);
        expect(escala, `${id} sessão ${i}`).toContain(hoje.carga_kg);
        expect(hoje.montagem?.exato, `${id} sessão ${i}`).toBe(true);
        expect(hoje.montagem?.total).toBe(hoje.carga_kg);
        const topo = hoje.alvo_max ?? 8;
        const piso = hoje.alvo_min ?? 5;
        const n = Math.floor(aleatorio() * 3);
        const feitas =
          n === 0 ? reps(topo, topo, topo) : n === 1 ? reps(topo, piso, piso) : reps(piso - 2, piso - 2, piso - 2);
        st = P.decidir(e, st, feitas).novoEstado;
        expect(st.falhas_seguidas).toBeLessThanOrEqual(2);
      }
    }
  });
});

/* -------------------------------- 6b. varredura dos 81 exercícios */

describe("varredura: os 81 exercícios do catálogo nas bordas", () => {
  /** Séries no topo do que o app pediu hoje. */
  function seriesNoTopo(e: ReturnType<typeof ex>, alvo: number): P.SerieFeita[] {
    const p = P.prescricaoPadrao(e);
    return Array.from({ length: p.series }, () => {
      switch (p.tipo) {
        case "tempo_s":
          return { concluida: true, tempo_s: alvo, tempo_s_lado2: alvo };
        case "passos":
          return { concluida: true, passos: alvo };
        default:
          return { concluida: true, reps: alvo, reps_lado2: alvo };
      }
    });
  }

  it("primeira sessão no topo: ou o estado muda, ou o evento explica por quê", () => {
    for (const e of exercicios) {
      const p = P.prescricaoPadrao(e);
      if (p.tipo === "ver_cardio_corda" || e.progressao.tipo === "plano_corda") {
        expect(P.decidir(e, null, seriesNoTopo(e, 10)).evento, e.id).toBeNull();
        continue;
      }
      if (p.tipo === "maximo") continue; // sem faixa: coberto pelos casos 15 e 21
      const hoje = P.cargaDeHoje(e, null);
      const alvo = hoje.alvo_max ?? 0;
      expect(alvo, `${e.id} sem topo de faixa`).toBeGreaterThan(0);
      const d = P.decidir(e, null, seriesNoTopo(e, alvo));
      expect(d.evento?.motivo, e.id).toBe("subiu");
      const antes = P.estadoInicial(e);
      const mudou =
        d.novoEstado.carga_atual_kg !== antes.carga_atual_kg ||
        d.novoEstado.reps_alvo !== antes.reps_alvo ||
        d.novoEstado.tempo_alvo_s !== antes.tempo_alvo_s ||
        d.novoEstado.assistencia !== antes.assistencia;
      expect(mudou, `${e.id}: subiu sem mudar nada`).toBe(true);
    }
  });

  it("três falhas seguidas: nenhuma carga negativa, fora da escala ou acima da anterior", () => {
    for (const e of exercicios) {
      const p = P.prescricaoPadrao(e);
      if (p.tipo === "ver_cardio_corda" || p.tipo === "maximo") continue;
      if (e.progressao.tipo === "plano_corda") continue;
      const escala = cargasPossiveis(e.implemento);
      let st = estado(e.id);
      const inicio = st.carga_atual_kg;
      for (let i = 0; i < 3; i++) {
        const antes = st.carga_atual_kg;
        st = P.decidir(e, st, seriesNoTopo(e, 1)).novoEstado;
        const agora = st.carga_atual_kg;
        expect(agora, `${e.id} falha ${i + 1}`).not.toBeNull();
        expect(agora as number, `${e.id} falha ${i + 1}`).toBeGreaterThanOrEqual(0);
        expect(agora as number, `${e.id} falha ${i + 1}`).toBeLessThanOrEqual(
          antes as number,
        );
        expect(escala, `${e.id} falha ${i + 1}`).toContain(agora);
      }
      expect(st.falhas_seguidas).toBe(0);
      if (e.progressao.tipo === "carga" && (inicio as number) > 0) {
        expect(st.semana_leve, e.id).toBe(true);
      }
    }
  });

  it("a carga de hoje é sempre a que o estado guardou (SPEC §6.6)", () => {
    for (const e of exercicios) {
      if (e.progressao.tipo === "plano_corda") continue;
      const st = estado(e.id, { carga_atual_kg: e.carga_inicial.kg });
      const d = P.decidir(e, st, seriesNoTopo(e, 99));
      const depois = d.novoEstado;
      const hoje = P.cargaDeHoje(e, depois);
      if (!depois.semana_leve) {
        expect(hoje.carga_kg, e.id).toBe(depois.carga_atual_kg);
      }
      expect(hoje.montagem?.exato, e.id).toBe(true);
    }
  });
});

/* ------------------------- 7. barra W pesada depois (SPEC §3.9/§6.6) */

describe("barra W e reta oca: base 2,0 até pesar, escala refeita depois", () => {
  it("sem pesar, a escala começa em 2,0 e vai até 50 (doc: 52 → 50)", () => {
    const w = ex("rosca-com-barra-w");
    expect(P.cargaDeHoje(w, null).carga_kg).toBe(2);
    expect(cargasPossiveis("barra_w")[1]).toBe(4);
    // 24 kg por lado: 10 + 10 + 4 (no máximo 2 anilhas de cada peso por lado)
    expect(montagem(50, "barra_w").porLado).toEqual([10, 10, 4]);
  });

  it("pesada em 5,2 kg, a escala inteira se reconstrói sem resíduo", () => {
    const o = { pesoBarra: 5.2 };
    const escala = cargasPossiveis("barra_w", o);
    expect(escala[0]).toBe(5.2);
    expect(escala[1]).toBe(7.2);
    for (const c of escala) expect(montagem(c, "barra_w", o).exato).toBe(true);
    expect(alcancavelParaBaixo(6, "barra_w", o)).toBe(5.2);
  });

  it("carga guardada abaixo da barra pesada: a tela mostra a barra vazia", () => {
    const w = ex("rosca-com-barra-w");
    const o = { pesoBarra: 5.2 };
    const st = estado("rosca-com-barra-w", { carga_atual_kg: 4 });
    expect(P.cargaDeHoje(w, st, P.prescricaoPadrao(w), o).carga_kg).toBe(5.2);
  });

  it("ACHADO: sucesso com a barra pesada não sobe — a próxima sessão repete a carga", () => {
    // SPEC §10 critério 4: "ao concluir com todas as séries no topo da faixa e
    // 'última firme', a próxima sessão mostra a carga + incremento".
    // Cenário da §3.9: a barra W vale 2,0 kg no JSON "até ser pesada"; depois de
    // pesada (5,2 kg) a carga guardada (4 kg) fica abaixo da barra vazia.
    for (const pesoBarra of [5.2, 6]) {
      const w = ex("rosca-com-barra-w");
      const o = { pesoBarra };
      const st = estado("rosca-com-barra-w", { carga_atual_kg: 4 });
      const hoje = P.cargaDeHoje(w, st, P.prescricaoPadrao(w), o);
      expect(hoje.carga_kg, `barra ${pesoBarra}`).toBe(pesoBarra); // barra vazia
      expect(hoje.incremento_kg).toBe(2);

      const d = P.decidir(w, st, reps(12, 12, 12), { montagem: o });
      expect(d.evento?.motivo).toBe("subiu");
      const amanha = P.cargaDeHoje(w, d.novoEstado, P.prescricaoPadrao(w), o);
      expect(
        amanha.carga_kg,
        `barra ${pesoBarra}: hoje ${String(hoje.carga_kg)} kg, amanhã ${String(amanha.carga_kg)} kg`,
      ).toBe((hoje.carga_kg as number) + 2);
    }
  });

  it("ACHADO: depois da falha o estado guarda uma carga fora da escala", () => {
    // SPEC §6.4: toda carga calculada é a "carga possível mais próxima para
    // baixo" na escala do implemento — 4 kg não existe na escala 5,2 · 7,2 · …
    const w = ex("rosca-com-barra-w");
    const o = { pesoBarra: 5.2 };
    const st = estado("rosca-com-barra-w", {
      carga_atual_kg: 4,
      falhas_seguidas: 1,
    });
    const d = P.decidir(w, st, reps(4, 4, 4), { montagem: o });
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(cargasPossiveis("barra_w", o)).toContain(d.novoEstado.carga_atual_kg);
  });
});

/* ------------------------------ 8. datas: virada do ano e segunda */

describe("datas na virada do ano e semana começando na segunda", () => {
  const perfil: C.PerfilCalendario = {
    fase_atual: "fase1",
    ultimo_treino: "B1",
    fase_desde: "2026-09-14",
    semana_corrida: 1,
    semana_corda: 1,
    semana_fixa: 1,
  };

  it("28/12/2026 é segunda e a semana do ano novo começa nele", () => {
    expect(C.diaDaSemana("2026-12-28")).toBe("seg");
    expect(C.iso(C.inicioDaSemana("2027-01-01"))).toBe("2026-12-28");
    expect(C.iso(C.inicioDaSemana("2027-01-03"))).toBe("2026-12-28");
    expect(C.iso(C.inicioDaSemana("2027-01-04"))).toBe("2027-01-04");
    expect(C.diasDaSemana("2027-01-01").map(C.iso)).toEqual([
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
    expect(C.semanaDaFase("2026-09-14", "2026-09-14")).toBe(1);
    expect(C.semanaDaFase("2026-12-28", "2026-09-14")).toBe(16);
    expect(C.semanaDaFase("2027-01-01", "2026-09-14")).toBe(16);
    expect(C.semanaDaFase("2027-01-04", "2026-09-14")).toBe(17);
  });

  it("a semana que cruza o ano mantém os dias do programa e a alternância", () => {
    const semana = C.semanaDoPlano("2026-12-31", perfil);
    expect(semana.map((d) => d.dia)).toEqual([
      "seg",
      "ter",
      "qua",
      "qui",
      "sex",
      "sab",
      "dom",
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
    expect(semana.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "A1",
      "B1",
      "A1",
    ]);
    // 01/01/2027 é sexta: dia de força no programa da Fase 1
    const sexta = semana[4];
    expect(sexta?.data).toBe("2027-01-01");
    expect(sexta?.tipo).toBe("forca");
  });

  it("o que falta na semana compara datas de anos diferentes na ordem certa", () => {
    const semana = C.semanaDoPlano("2026-12-31", perfil);
    const r = C.oQueFaltaNaSemana(
      semana,
      [{ data: "2026-12-28", tipo: "forca" }],
      "2027-01-01",
    );
    expect(r.feitos.map((d) => d.data)).toEqual(["2026-12-28"]);
    expect(r.perdidos.map((d) => d.data)).toEqual(["2026-12-29", "2026-12-30"]);
    expect(r.faltando.map((d) => d.data)).toEqual([
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(r.total).toBe(5);
  });

  it("a Fase 2 conta 12 semanas civis e 30 sessões, mesmo cruzando o ano", () => {
    const desde = "2026-09-14";
    const onze = C.sugerirFase2({ ...perfil, fase_desde: desde }, 40, "2026-11-30");
    expect(onze.semanas).toBe(11);
    expect(onze.sugerir).toBe(false);
    const doze = C.sugerirFase2({ ...perfil, fase_desde: desde }, 40, "2026-12-07");
    expect(doze.semanas).toBe(12);
    expect(doze.sugerir).toBe(true);
    const poucas = C.sugerirFase2({ ...perfil, fase_desde: desde }, 29, "2027-01-04");
    expect(poucas.sugerir).toBe(false);
    // adiamento silencia por 2 semanas e volta depois
    const ate = C.adiarFase2("2026-12-28");
    expect(ate).toBe("2027-01-11");
    const calado = C.sugerirFase2(
      { ...perfil, fase_desde: desde, prefs: { fase2_adiada_ate: ate } },
      40,
      "2027-01-04",
    );
    expect(calado.sugerir).toBe(false);
    const devolta = C.sugerirFase2(
      { ...perfil, fase_desde: desde, prefs: { fase2_adiada_ate: ate } },
      40,
      "2027-01-11",
    );
    expect(devolta.sugerir).toBe(true);
  });

  it("semana curta na virada do ano: corta o sábado e mantém o dia certo", () => {
    const semana = C.semanaDoPlano("2026-12-31", perfil);
    const r = C.semanaCurta(["qua", "sex", "dom"] as DiaSemana[], semana);
    expect(r.capacidade).toBe(4);
    expect(r.cortados.map((c) => c.dia)).toEqual(["sab"]);
    const ocupados = r.dias.filter((d) => d.tipo !== "descanso");
    expect(ocupados).toHaveLength(4);
    for (const d of ocupados) {
      expect(["qua", "sex", "dom"]).not.toContain(d.dia);
    }
    // os treinos de força continuam alternando depois do remanejo (SPEC §5.2)
    const forca = r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId);
    for (let i = 1; i < forca.length; i++) {
      expect(forca[i], `${String(forca[i - 1])} seguido de ${String(forca[i])}`).not.toBe(
        forca[i - 1],
      );
    }
  });

  it("um dia só na semana: sobra o Treino A completo (SPEC §5.4)", () => {
    const semana = C.semanaDoPlano("2026-12-31", perfil);
    const dias: DiaSemana[] = ["ter", "qua", "qui", "sex", "sab", "dom"];
    const r = C.semanaCurta(dias, semana);
    expect(r.capacidade).toBe(1);
    const restou = r.dias.filter((d) => d.tipo !== "descanso");
    expect(restou).toHaveLength(1);
    expect(restou[0]?.tipo).toBe("forca");
    expect(restou[0]?.treinoId).toBe("A1" as TreinoId);
  });
});

/* ------------------------- 9. semanas dos planos de cardio (§5.5) */

describe("semanas dos planos: repetem com menos de 2 sessões e não voltam", () => {
  it("0 e 1 sessão repetem; 2 avançam; o teto do plano segura em 12", () => {
    expect(C.avancarSemanaDeCorrida(3, 0)).toBe(3);
    expect(C.avancarSemanaDeCorrida(3, 1)).toBe(3);
    expect(C.avancarSemanaDeCorrida(3, 2)).toBe(4);
    expect(C.avancarSemanaDeCorrida(12, 2)).toBe(12);
    expect(C.avancarSemanaDeCorda(12, 2)).toBe(12);
    expect(C.avancarSemanaDeBarraFixa(12, 2)).toBe(12);
  });

  it("ACHADO: acima do teto do plano, fazer as 2 sessões devolve uma semana menor", () => {
    // SPEC §5.5: com 0 ou 1 sessão "a semana do plano não muda"; com 2, avança.
    // Numa semana ajustada à mão para além do plano (§3.3/§3.9), cumprir as
    // duas sessões devolve 12 enquanto não fazer nenhuma mantém 13.
    for (const avancar of [
      C.avancarSemanaDeCorrida,
      C.avancarSemanaDeCorda,
      C.avancarSemanaDeBarraFixa,
    ]) {
      expect(avancar(13, 0)).toBe(13);
      expect(avancar(13, 2), "duas sessões não podem valer menos que nenhuma")
        .toBeGreaterThanOrEqual(avancar(13, 0));
    }
  });
});
