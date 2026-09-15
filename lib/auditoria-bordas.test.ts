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
import { acharExercicio, exercicios, textoDoMotor } from "@/lib/dados";
import {
  alcancavelParaBaixo,
  cargaMaxima,
  cargaMinima,
  cargasPossiveis,
  capacidadeDoImplemento,
  limiteDoImplemento,
  montagem,
  PESO_BARRA_A_PESAR,
  type ImplementoMontagem,
} from "@/lib/montagem";
import * as C from "@/lib/calendario";
import { rotuloDaCarga } from "@/lib/formato";
import * as P from "@/lib/progressao";
import type { DiaSemana, TreinoId, RefDeTexto } from "@/lib/schemas";

/**
 * O texto de uma sugestão/aviso do motor: o motor devolve só a chave e os
 * números (SPEC §6.3/§6.4) e a frase mora em `data/progressao.json`, montada
 * por `textoDoMotor`. As asserções continuam sobre o texto que o app mostra.
 */
function txt(ref: RefDeTexto | null | undefined): string {
  return textoDoMotor(ref) ?? "";
}

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
    expect(txt(barra.evento?.aviso)).toMatch(/anilhas de 10 kg/);

    const halter = P.decidir(
      ex("rosca-martelo"),
      estado("rosca-martelo", { carga_atual_kg: 39.5 }),
      reps(12, 12, 12),
    );
    expect(halter.evento?.motivo).toBe("repetiu");
    expect(halter.novoEstado.carga_atual_kg).toBe(39.5);
    expect(txt(halter.evento?.aviso)).toMatch(/capacidade 40 kg/);
    expect(txt(halter.evento?.aviso)).not.toMatch(/faltam anilhas/);

    const pino = P.decidir(
      ex("puxada-alta-na-polia"),
      estado("puxada-alta-na-polia", { carga_atual_kg: 100 }),
      reps(12, 12, 12),
    );
    expect(txt(pino.evento?.aviso)).toMatch(/capacidade 100 kg/);

    const w = P.decidir(
      ex("rosca-com-barra-w"),
      estado("rosca-com-barra-w", { carga_atual_kg: 50 }),
      reps(12, 12, 12),
    );
    expect(txt(w.evento?.aviso)).toMatch(/capacidade 50 kg/);
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

/* ==================================================================== */
/*  Rodada 5 — auditoria adversarial final, lente "bordas"              */
/*                                                                      */
/*  Bordas numéricas e de estoque depois das correções da rodada 4:     */
/*  ponto flutuante nas reduções, carga fora da escala vinda do banco,  */
/*  a barra W pesada na balança (SPEC §3.9), colunas null de            */
/*  exercise_state, séries a mais/a menos, unilateral sem o lado 2,     */
/*  a virada do ano e a semana que começa na segunda.                   */
/* ==================================================================== */

/* --------------------- 10. ponto flutuante nas reduções (§6.2 × §6.4) */

describe("reduções de 10 % e 60 % em escala inteira não perdem 1 kg no binário", () => {
  /**
   * Polia e lastro têm degraus de 1 kg: ali `carga × 0,9` e `carga × 0,6`
   * caem em cima de um degrau com frequência, e um resíduo binário para baixo
   * (20,999999999999996 em vez de 21) faria a queda ser de um degrau a mais.
   */
  it("o piso de carga × 0,9 e × 0,6 bate com a conta em inteiros", () => {
    for (const implemento of ["polia", "barra_fixa"] as ImplementoMontagem[]) {
      for (const carga of cargasPossiveis(implemento)) {
        for (const [fator, numerador] of [
          [0.9, 9],
          [0.6, 6],
        ] as [number, number][]) {
          const exato = Math.floor((carga * numerador) / 10);
          expect(
            alcancavelParaBaixo(carga * fator, implemento),
            `${implemento} ${carga} × ${fator}`,
          ).toBe(exato);
        }
      }
    }
  });

  it("dez ciclos de −10 % nunca sobem nem saem da escala", () => {
    for (const id of [
      "supino-reto-com-barra",
      "supino-inclinado-com-halteres",
      "puxada-alta-na-polia",
      "barra-fixa-com-lastro",
    ]) {
      const e = ex(id);
      const escala = cargasPossiveis(e.implemento);
      let carga = cargaMaxima(e.implemento);
      for (let i = 0; i < 10; i++) {
        const nova = Math.min(carga, alcancavelParaBaixo(carga * 0.9, e.implemento));
        expect(escala, `${id} #${i}`).toContain(nova);
        expect(cent(nova), `${id} #${i} subiu`).toBeLessThanOrEqual(cent(carga));
        carga = nova;
      }
      expect(cent(carga)).toBeGreaterThanOrEqual(cent(cargaMinima(e.implemento)));
    }
  });
});

/* ------------- 11. barra pesada na balança: ciclo inteiro (§3.9 §6.4) */

describe("barra W pesada (override): ciclo sucesso → 2 falhas → leve → volta", () => {
  const w = ex("rosca-com-barra-w");
  const alvo = P.prescricaoPadrao(w);
  const boas = reps(12, 12, 12);
  const ruins = reps(2, 2, 2);

  it("em seis pesos de barra a escala é exata e a montagem fecha", () => {
    for (const pesoBarra of [2, 2.4, 4.8, 5.2, 6.1, 7.3]) {
      const o = { pesoBarra };
      const escala = cargasPossiveis("barra_w", o);
      expect(escala[0], `barra ${pesoBarra}`).toBe(pesoBarra);
      expect(escala[1]).toBe(Math.round((pesoBarra + 2) * 100) / 100);
      for (const carga of escala) {
        // numeric(6,2) em supabase/schema.sql: nada de 6,800000000000001
        expect(cent(carga) % 1, `barra ${pesoBarra} carga ${carga}`).toBe(0);
        const m = montagem(carga, "barra_w", o);
        expect(m.exato, `barra ${pesoBarra} carga ${carga}`).toBe(true);
        expect(m.total).toBe(carga);
      }
      expect(cent(cargaMaxima("barra_w", o))).toBeLessThanOrEqual(
        cent(capacidadeDoImplemento("barra_w", o)),
      );
    }
  });

  it("o ciclo inteiro fica na escala e a tela mostra o que o estado guarda", () => {
    for (const pesoBarra of [2, 2.4, 4.8, 5.2, 6.1, 7.3]) {
      const o = { pesoBarra };
      const escala = cargasPossiveis("barra_w", o);
      const rotulo = `barra ${pesoBarra}`;
      // carga guardada abaixo da barra pesada (o 2,0 kg do JSON, §3.9)
      let estadoAtual: P.EstadoExercicio = estado("rosca-com-barra-w", {
        carga_atual_kg: 2,
      });

      const sobe = P.decidir(w, estadoAtual, boas, { montagem: o });
      expect(sobe.evento?.motivo, rotulo).toBe("subiu");
      estadoAtual = sobe.novoEstado;
      expect(estadoAtual.carga_atual_kg, rotulo).toBe(escala[1]);

      const primeira = P.decidir(w, estadoAtual, ruins, { montagem: o });
      expect(primeira.evento?.motivo, rotulo).toBe("repetiu");
      expect(primeira.evento?.falha, rotulo).toBe(true);
      expect(primeira.novoEstado.carga_atual_kg, rotulo).toBe(escala[1]);
      estadoAtual = primeira.novoEstado;

      const segunda = P.decidir(w, estadoAtual, ruins, { montagem: o });
      expect(segunda.evento?.motivo, rotulo).toBe("falha_2x_voltou_10");
      const depoisDaQueda = segunda.novoEstado.carga_atual_kg as number;
      expect(escala, rotulo).toContain(depoisDaQueda);
      expect(cent(depoisDaQueda), `${rotulo}: a queda subiu`).toBeLessThan(
        cent(escala[1] as number),
      );
      estadoAtual = segunda.novoEstado;

      const terceira = P.decidir(w, estadoAtual, ruins, { montagem: o });
      expect(terceira.evento?.motivo, rotulo).toBe("semana_leve_60");
      estadoAtual = terceira.novoEstado;
      expect(estadoAtual.semana_leve, rotulo).toBe(true);
      expect(escala, rotulo).toContain(estadoAtual.carga_atual_kg);
      expect(estadoAtual.carga_antes_leve, rotulo).toBe(depoisDaQueda);
      // a tela da semana leve pede a mesma carga que o evento gravou (§6.6)
      const naLeve = P.cargaDeHoje(w, estadoAtual, alvo, o);
      expect(naLeve.carga_kg, rotulo).toBe(estadoAtual.carga_atual_kg);
      expect(naLeve.montagem?.exato, rotulo).toBe(true);

      const fim = P.decidir(w, estadoAtual, boas, { montagem: o });
      expect(fim.evento?.motivo, rotulo).toBe("fim_semana_leve");
      expect(fim.novoEstado.carga_atual_kg, rotulo).toBe(depoisDaQueda);
      expect(fim.novoEstado.incremento_reduzido, rotulo).toBe(false);
      expect(P.incrementoDe(w, fim.novoEstado), rotulo).toBe(2);
    }
  });
});

/* ------------------ 12. carga fora da escala vinda do banco (§6.4) */

describe("carga fora da escala: acima do teto, abaixo da barra e no meio do degrau", () => {
  const porImplemento: [string, ImplementoMontagem][] = [
    ["supino-reto-com-barra", "barra_macica"],
    ["supino-inclinado-com-halteres", "halteres"],
    ["puxada-alta-na-polia", "polia"],
    ["rosca-com-barra-w", "barra_w"],
    ["barra-fixa-com-lastro", "barra_fixa"],
  ];

  it("acima do teto a sessão perfeita repete com aviso e guarda o teto", () => {
    for (const [id, implemento] of porImplemento) {
      const e = ex(id);
      const alvo = P.prescricaoPadrao(e);
      const teto = cargaMaxima(implemento);
      const st = estado(id, { carga_atual_kg: teto + 17 });
      expect(P.cargaDeHoje(e, st, alvo).carga_kg, id).toBe(teto);
      const d = P.decidir(e, st, serieCheia(alvo));
      expect(d.evento?.motivo, id).toBe("repetiu");
      expect(d.novoEstado.carga_atual_kg, id).toBe(teto);
      expect(txt(d.evento?.aviso), `${id}: sem aviso de teto`).not.toBe("");
    }
  });

  it("abaixo do piso e no meio do degrau a decisão parte da escala", () => {
    for (const [id, implemento] of porImplemento) {
      const e = ex(id);
      const alvo = P.prescricaoPadrao(e);
      const escala = cargasPossiveis(implemento);
      const piso = escala[0] as number;
      const segundo = escala[1] as number;
      const incremento = P.incrementoDe(e, null);

      for (const cru of [-40, piso - 3, piso + (segundo - piso) / 2]) {
        const st = estado(id, { carga_atual_kg: cru });
        const partida = P.cargaDeHoje(e, st, alvo).carga_kg as number;
        expect(escala, `${id} cru ${cru}`).toContain(partida);
        const d = P.decidir(e, st, serieCheia(alvo));
        const nova = d.novoEstado.carga_atual_kg as number;
        expect(escala, `${id} cru ${cru}`).toContain(nova);
        expect(cent(nova), `${id} cru ${cru}`).toBe(
          cent(alcancavelParaBaixo(partida + incremento, implemento)),
        );
        // §6.6: o evento fala da carga que a tela pediu, não do valor cru
        expect(d.evento?.de["carga_kg"], `${id} cru ${cru}`).toBe(partida);
      }
    }
  });

  it("cada carga da escala fecha a montagem exata na tela (§6.5 e §10.5)", () => {
    for (const [id, implemento] of porImplemento) {
      const e = ex(id);
      for (const carga of cargasPossiveis(implemento)) {
        const st = estado(id, { carga_atual_kg: carga });
        const hoje = P.cargaDeHoje(e, st);
        expect(hoje.carga_kg, `${id} ${carga}`).toBe(carga);
        expect(hoje.montagem?.exato, `${id} ${carga}`).toBe(true);
        expect(hoje.montagem?.total, `${id} ${carga}`).toBe(carga);
      }
    }
  });
});

/** Uma sessão no topo da faixa, no formato do tipo da prescrição. */
function serieCheia(alvo: P.Alvo, topo?: number): P.SerieFeita[] {
  const v = topo ?? alvo.max ?? 12;
  return Array.from({ length: alvo.series }, () => {
    if (alvo.tipo === "tempo_s") {
      return {
        concluida: true,
        tempo_s: v,
        tempo_s_lado2: alvo.unilateral ? v : null,
      };
    }
    if (alvo.tipo === "passos") return { concluida: true, passos: v };
    return { concluida: true, reps: v, reps_lado2: alvo.unilateral ? v : null };
  });
}

/* ------------- 13. colunas anuláveis de exercise_state, uma a uma (§6.1) */

describe("cada coluna anulável de exercise_state em null, por tipo de progressão", () => {
  it("carga_atual_kg null: a 2ª falha seguida ainda volta 10 % na escala", () => {
    const polia = ex("puxada-alta-na-polia");
    const st = estado("puxada-alta-na-polia", {
      carga_atual_kg: null,
      falhas_seguidas: 1,
    });
    expect(P.cargaDeHoje(polia, st).carga_kg).toBe(4); // carga_inicial do JSON
    const d = P.decidir(polia, st, reps(2, 2, 2));
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(d.novoEstado.carga_atual_kg).toBe(3); // 4 × 0,9 = 3,6 → 3 no pino
  });

  it("tempo_alvo_s, reps_alvo e assistencia null caem na prescrição (§6.1)", () => {
    const prancha = ex("prancha");
    const t = P.decidir(prancha, estado("prancha", { tempo_alvo_s: null }), [
      { concluida: true, tempo_s: 60 },
      { concluida: true, tempo_s: 60 },
      { concluida: true, tempo_s: 60 },
    ]);
    expect(t.evento?.motivo).toBe("subiu");
    expect(t.novoEstado.tempo_alvo_s).toBe(65);

    const pernas = ex("elevacao-de-pernas-na-barra-fixa");
    const r = P.decidir(
      pernas,
      estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: null }),
      reps(15, 15, 15),
    );
    expect(r.evento?.motivo).toBe("subiu");
    expect(r.novoEstado.reps_alvo).toBe(16);

    const fixa = ex("barra-fixa-assistida");
    const a = P.decidir(
      fixa,
      estado("barra-fixa-assistida", { assistencia: null }),
      reps(8, 8, 8, 8),
    );
    expect(a.evento?.motivo).toBe("subiu");
    expect(a.novoEstado.assistencia).toBe("joelho");
    expect(a.novoEstado.sessoes_graca).toBe(P.SESSOES_DE_GRACA);
  });

  it("incremento_kg null usa o do JSON; 0 e 1 travam a subida com sugestão", () => {
    const sup = ex("supino-reto-com-barra");
    expect(P.incrementoDe(sup, estado("supino-reto-com-barra"))).toBe(2);
    for (const override of [0, 1]) {
      const d = P.decidir(
        sup,
        estado("supino-reto-com-barra", { incremento_kg: override }),
        reps(8, 8, 8),
      );
      expect(d.evento?.motivo, `incremento ${override}`).toBe("repetiu");
      expect(d.novoEstado.carga_atual_kg, `incremento ${override}`).toBe(7.5);
      // SPEC §6.4: aqui não faltam anilhas — falta incremento (rodada 3, nº 2)
      expect(d.evento?.aviso, `incremento ${override}`).toBeUndefined();
      expect(txt(d.evento?.sugestao), `incremento ${override}`).not.toBe("");
    }
  });

  it("semana_leve com carga_antes_leve null devolve a carga que está lá", () => {
    const sup = ex("supino-reto-com-barra");
    const st = estado("supino-reto-com-barra", {
      carga_atual_kg: 21.5,
      semana_leve: true,
      carga_antes_leve: null,
    });
    expect(P.cargaDeHoje(sup, st).carga_kg).toBe(21.5);
    const d = P.decidir(sup, st, reps(8, 8, 8));
    expect(d.evento?.motivo).toBe("fim_semana_leve");
    expect(d.novoEstado.carga_atual_kg).toBe(21.5);
    expect(d.novoEstado.semana_leve).toBe(false);
  });
});

/* ------------------- 14. séries a mais, a menos e unilateral (§6.2/§6.3) */

describe("tabela de séries malformadas: concluída × abandonada", () => {
  const sup = ex("supino-reto-com-barra");
  const base = () => estado("supino-reto-com-barra", { carga_atual_kg: 25.5 });

  const casos: [string, P.SerieFeita[], string | null, string | null][] = [
    ["3 no topo", reps(8, 8, 8), "subiu", "subiu"],
    ["4 no topo", reps(8, 8, 8, 8), "subiu", "subiu"],
    ["4ª abaixo do piso", reps(8, 8, 8, 3), "repetiu", "repetiu"],
    ["4ª não concluída", [...reps(8, 8, 8), { concluida: false }], "repetiu", null],
    ["só 2 séries", reps(8, 8), "repetiu", null],
    ["1 série", reps(8), "repetiu", null],
    ["nenhuma série", [], null, null],
  ];

  it("cada combinação decide o mesmo que a SPEC §6.2 e a §6.3 mandam", () => {
    for (const [nome, series, concluida, abandonada] of casos) {
      const a = P.decidir(sup, base(), series);
      expect(a.evento?.motivo ?? null, `${nome} (concluída)`).toBe(concluida);
      const b = P.decidir(sup, base(), series, { sessaoAbandonada: true });
      expect(b.evento?.motivo ?? null, `${nome} (abandonada)`).toBe(abandonada);
      if (abandonada === null) {
        // §6.3: "os demais não mudam"
        expect(b.novoEstado.carga_atual_kg, nome).toBe(25.5);
        expect(b.novoEstado.falhas_seguidas, nome).toBe(0);
      }
    }
  });

  it("unilateral: lado 2 ausente, nulo e zero (SPEC §6.3 'vale o menor')", () => {
    const bulgaro = ex("agachamento-bulgaro");
    const st = () => estado("agachamento-bulgaro", { carga_atual_kg: 5.5 });

    // sem o lado 2 registrado vale o lado que veio
    expect(P.decidir(bulgaro, st(), reps(10, 10, 10)).evento?.motivo).toBe("subiu");
    const nulos = P.decidir(bulgaro, st(), [
      { concluida: true, reps: 10, reps_lado2: null },
      { concluida: true, reps: 10, reps_lado2: null },
      { concluida: true, reps: 10, reps_lado2: null },
    ]);
    expect(nulos.evento?.motivo).toBe("subiu");

    // zero no outro lado é o menor: falha, não sobe
    const zero = P.decidir(bulgaro, st(), lados([10, 0], [10, 10], [10, 10]));
    expect(zero.evento?.motivo).toBe("repetiu");
    expect(zero.evento?.falha).toBe(true);
    expect(zero.novoEstado.carga_atual_kg).toBe(5.5);

    // o lado 1 nulo invalida a série inteira (não vale "só o lado 2")
    const lado1Nulo = P.decidir(bulgaro, st(), [
      { concluida: true, reps: null, reps_lado2: 10 },
      ...lados([10, 10], [10, 10]),
    ]);
    expect(lado1Nulo.evento?.falha).toBe(true);

    // tempo unilateral (prancha lateral): também vale o menor lado
    const pl = ex("prancha-lateral");
    const curto = P.decidir(pl, estado("prancha-lateral"), [
      { concluida: true, tempo_s: 40, tempo_s_lado2: 30 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
    ]);
    expect(curto.evento?.motivo).toBe("repetiu");
    expect(curto.novoEstado.tempo_alvo_s).toBe(20);
  });
});

/* ------------------------ 15. mais viradas de ano e ano bissexto (§5) */

describe("mais viradas de ano, ano bissexto e a segunda como início", () => {
  const perfil: C.PerfilCalendario = {
    fase_atual: "fase1",
    ultimo_treino: "B1",
    fase_desde: "2026-09-14",
  };

  it("a semana de 31/12/2027 (sexta) começa em 27/12 e termina em 02/01/2028", () => {
    expect(C.diaDaSemana("2027-12-31")).toBe("sex");
    expect(C.iso(C.inicioDaSemana("2027-12-31"))).toBe("2027-12-27");
    expect(C.diasDaSemana("2027-12-31").map(C.iso)).toEqual([
      "2027-12-27",
      "2027-12-28",
      "2027-12-29",
      "2027-12-30",
      "2027-12-31",
      "2028-01-01",
      "2028-01-02",
    ]);
    expect(C.iso(C.inicioDaSemana("2028-01-03"))).toBe("2028-01-03");
  });

  it("29/02/2028 cai numa terça e não desalinha a semana", () => {
    expect(C.diaDaSemana("2028-02-29")).toBe("ter");
    expect(C.iso(C.inicioDaSemana("2028-02-29"))).toBe("2028-02-28");
    const semana = C.semanaDoPlano("2028-02-29", perfil);
    expect(semana.map((d) => d.dia)).toEqual([
      "seg",
      "ter",
      "qua",
      "qui",
      "sex",
      "sab",
      "dom",
    ]);
    expect(semana[1]?.data).toBe("2028-02-29");
    expect(semana[6]?.data).toBe("2028-03-05");
  });

  it("semanaDaFase cresce de 1 em 1 e nunca reinicia em 1º de janeiro", () => {
    let anterior = 0;
    for (let i = 0; i < 80; i++) {
      const dia = C.iso(new Date(2026, 8, 14 + i * 7));
      const semana = C.semanaDaFase(dia, "2026-09-14");
      expect(semana, dia).toBe(anterior + 1);
      anterior = semana;
    }
    // dentro da mesma semana civil o número não muda, mesmo virando o ano
    expect(C.semanaDaFase("2026-12-31", "2026-09-14")).toBe(
      C.semanaDaFase("2027-01-03", "2026-09-14"),
    );
  });

  it("toda segunda-feira do ano é o próprio início da sua semana", () => {
    for (let i = 0; i < 400; i++) {
      const dia = C.iso(new Date(2026, 11, 1 + i));
      const inicio = C.iso(C.inicioDaSemana(dia));
      expect(C.diaDaSemana(inicio), dia).toBe("seg");
      expect(inicio <= dia, `${inicio} > ${dia}`).toBe(true);
    }
  });
});

/* ------------------ 16. semanas dos planos: nunca andam para trás (§5.5) */

describe("avançar semana de cardio é monótono em qualquer entrada", () => {
  it("de 1 a 15 semanas e de 0 a 3 sessões, nunca diminui nem pula", () => {
    const funcoes = [
      C.avancarSemanaDeCorrida,
      C.avancarSemanaDeCorda,
      C.avancarSemanaDeBarraFixa,
    ];
    for (const avancar of funcoes) {
      for (let semana = 1; semana <= 15; semana++) {
        for (let sessoes = 0; sessoes <= 3; sessoes++) {
          const nova = avancar(semana, sessoes);
          expect(nova, `${semana}/${sessoes}`).toBeGreaterThanOrEqual(semana);
          expect(nova, `${semana}/${sessoes}`).toBeLessThanOrEqual(semana + 1);
          if (sessoes < 2) expect(nova, `${semana}/${sessoes}`).toBe(semana);
          expect(nova, `${semana}: fazer não pode valer menos`).toBeGreaterThanOrEqual(
            avancar(semana, 0),
          );
        }
      }
    }
  });
});

/* ------------------------------------ 17. achados da rodada 5 (bordas) */

describe("ACHADOS — semana curta e rótulo da carga", () => {
  const perfil: C.PerfilCalendario = {
    fase_atual: "fase1",
    ultimo_treino: "B1",
    fase_desde: "2026-09-14",
  };

  it("ACHADO A — §5.2 item 3: depois da semana curta o primeiro treino repete o último feito", () => {
    // SPEC §5.2 item 3: "Força, Fase 1: o treino é o que não foi o último
    // (profiles.ultimo_treino): se o último foi A1, hoje é B1."
    // A semana planejada respeita isso (seg = A1 depois de um B1). Ao marcar a
    // segunda como "não vou treinar" (§5.4), a alternância é reancorada no
    // treino que sobrou no primeiro dia disponível — que era o SEGUNDO da
    // escada — e a semana volta a começar pelo mesmo treino já feito.
    for (const ultimo of ["A1", "B1"] as TreinoId[]) {
      const semana = C.semanaDoPlano("2026-09-14", { ...perfil, ultimo_treino: ultimo });
      const esperado = C.proximoTreinoAlternado(ultimo);
      expect(semana.find((d) => d.tipo === "forca")?.treinoId, ultimo).toBe(esperado);

      const curta = C.semanaCurta(["seg"] as DiaSemana[], semana);
      const forca = curta.dias.filter((d) => d.tipo === "forca");
      expect(curta.cortados, `${ultimo}: nada deveria ser cortado`).toEqual([]);
      expect(forca).toHaveLength(3);
      expect(
        forca[0]?.treinoId,
        `último treino ${ultimo}: a semana curta recomeça em ${String(forca[0]?.treinoId)}`,
      ).toBe(esperado);
    }
  });

  it("ACHADO B — §3.5/§5.4: o treino do dia marcado é remarcado para um dia ANTERIOR", () => {
    // SPEC §3.5: "Aplica a regra da semana curta (§5.4) ao marcar 'não vou
    // treinar hoje'"; §5.4: "o app reorganiza O RESTO da semana".
    // Marcando a sexta, o treino dela vai para a quinta — um dia que já passou
    // — enquanto o domingo, livre e depois da sexta, fica vazio.
    const semana = C.semanaDoPlano("2026-09-14", perfil);
    expect(semana.find((d) => d.dia === "qui")?.tipo).toBe("descanso");
    expect(semana.find((d) => d.dia === "dom")?.tipo).toBe("descanso");

    const curta = C.semanaCurta(["sex"] as DiaSemana[], semana);
    expect(curta.cortados).toEqual([]);
    const ocupados = curta.dias.filter((d) => d.tipo !== "descanso").map((d) => d.dia);
    expect(
      ocupados,
      `o treino da sexta foi para ${ocupados.join("+")}; o domingo ficou livre`,
    ).not.toContain("qui");
  });

  it("ACHADO C — §4: o rótulo da carga do implemento `anilha` diz 'na barra'", () => {
    // SPEC §4: "O campo implemento do exercício diz qual convenção vale —
    // mostrar sempre o rótulo certo na tela ('por halter', 'no pino')".
    // Três exercícios do catálogo usam o implemento `anilha` (a carga é a
    // anilha segurada, 5 kg no abdominal com anilha e no russian twist) e a
    // tela os rotula como carga "na barra", que não existe no movimento.
    expect(rotuloDaCarga("halteres")).toBe("por halter");
    expect(rotuloDaCarga("polia")).toBe("no pino");
    const comAnilha = exercicios.filter((e) => e.implemento === "anilha");
    expect(comAnilha.length).toBeGreaterThan(0);
    for (const e of comAnilha) {
      expect(
        rotuloDaCarga(e.implemento),
        `${e.id} (${e.carga_inicial.kg} kg) rotulado como "${rotuloDaCarga(e.implemento)}"`,
      ).not.toBe("na barra");
    }
  });
});

/* ================================================================== */
/*  Rodada 2 da lente "bordas" — reverificação e achados novos.        */
/* ================================================================== */

/* -------------- 18. varredura diferencial do tipo `carga` ---------- */

/** Um gerador determinístico (xorshift32): a varredura é sempre a mesma. */
function sorteio(semente: number): () => number {
  let x = (semente >>> 0) || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

interface EstadoDeReferencia {
  carga: number;
  falhas: number;
  reduzido: boolean;
  repExtra: boolean;
  leve: boolean;
  antesLeve: number | null;
}

/**
 * A SPEC §6.2 e a §6.4 reescritas do zero, sem olhar lib/progressao.ts: é
 * contra ela que o motor é comparado sessão a sessão.
 */
function referencia(
  escala: number[],
  incrementoBase: number,
  antes: EstadoDeReferencia,
  valores: (number | null)[],
  piso: number,
  topo: number,
  firme: boolean,
): { estado: EstadoDeReferencia; motivo: string } {
  const paraBaixo = (x: number): number => {
    let melhor = escala[0] as number;
    for (const c of escala) if (c <= x + 1e-9) melhor = c;
    return melhor;
  };
  const s = { ...antes };

  // "depois volta à carga anterior à semana leve com o incremento normal"
  if (s.leve) {
    s.carga = s.antesLeve ?? s.carga;
    s.antesLeve = null;
    s.leve = false;
    s.reduzido = false;
    s.repExtra = false;
    s.falhas = 0;
    return { estado: s, motivo: "fim_semana_leve" };
  }

  const exigido = topo + (s.repExtra ? 1 : 0);
  const abaixoDoPiso = valores.some((v) => v === null || v < piso);
  const noTopo = valores.every((v) => v !== null && v >= exigido);

  if (!abaixoDoPiso && noTopo && firme) {
    s.falhas = 0;
    const incremento = s.reduzido
      ? Math.max(incrementoBase / 2, P.PASSO_MINIMO_KG)
      : incrementoBase;
    const nova = paraBaixo(s.carga + incremento);
    if (incremento <= 0 || nova <= s.carga) return { estado: s, motivo: "repetiu" };
    s.carga = nova;
    s.reduzido = false;
    s.repExtra = false;
    return { estado: s, motivo: "subiu" };
  }
  if (!abaixoDoPiso) return { estado: s, motivo: "repetiu" };

  s.falhas = antes.falhas + 1;
  if (s.falhas === 1) return { estado: s, motivo: "repetiu" };
  if (s.falhas === 2) {
    s.carga = Math.min(s.carga, paraBaixo(s.carga * 0.9));
    s.reduzido = true;
    s.repExtra = incrementoBase / 2 < P.PASSO_MINIMO_KG;
    return { estado: s, motivo: "falha_2x_voltou_10" };
  }
  s.antesLeve = s.carga;
  s.carga = Math.min(s.carga, paraBaixo(s.carga * 0.6));
  s.leve = true;
  s.falhas = 0;
  return { estado: s, motivo: "semana_leve_60" };
}

describe("carreiras longas contra uma reimplementação independente da §6.2", () => {
  it("60 sessões em cada exercício de carga, com e sem a barra pesada", () => {
    const alvos = exercicios.filter(
      (e) =>
        e.progressao.tipo === "carga" &&
        e.prescricao_padrao.tipo === "reps" &&
        !e.prescricao_padrao.unilateral,
    );
    expect(alvos.length).toBeGreaterThan(40);

    for (const e of alvos) {
      for (const pesoBarra of [undefined, 4.8] as const) {
        const opcoes = pesoBarra === undefined ? {} : { pesoBarra };
        const escala = cargasPossiveis(e.implemento, opcoes);
        const prescricao = P.prescricaoPadrao(e);
        const piso = prescricao.min as number;
        const topo = prescricao.max as number;
        const incremento = e.progressao.incremento_kg ?? 0;
        const dado = sorteio(e.id.length * 7919 + (pesoBarra ?? 1) * 131);

        let estadoMotor: P.EstadoExercicio = P.estadoInicial(e);
        let estadoRef: EstadoDeReferencia = {
          carga: alcancavelParaBaixo(e.carga_inicial.kg, e.implemento, opcoes),
          falhas: 0,
          reduzido: false,
          repExtra: false,
          leve: false,
          antesLeve: null,
        };

        for (let sessao = 0; sessao < 60; sessao++) {
          const modo = Math.floor(dado() * 4);
          const firme = dado() > 0.25;
          const valores = Array.from({ length: prescricao.series }, () =>
            modo === 0 ? topo + 1 : modo === 1 ? topo : modo === 2 ? piso : piso - 1,
          );
          const series: P.SerieFeita[] = valores.map((r) => ({ concluida: true, reps: r }));

          const d = P.decidir(e, estadoMotor, series, {
            prescricao,
            ultimaFirme: firme,
            montagem: opcoes,
          });
          const r = referencia(escala, incremento, estadoRef, valores, piso, topo, firme);
          estadoMotor = d.novoEstado;
          estadoRef = r.estado;

          const onde = `${e.id} barra=${String(pesoBarra)} sessão ${sessao} ${JSON.stringify(valores)} firme=${firme}`;
          expect(d.evento?.motivo ?? "sem evento", onde).toBe(r.motivo);
          expect(cent(estadoMotor.carga_atual_kg ?? 0), onde).toBe(cent(estadoRef.carga));
          expect(estadoMotor.falhas_seguidas, onde).toBe(estadoRef.falhas);
          expect(estadoMotor.incremento_reduzido, onde).toBe(estadoRef.reduzido);
          expect(estadoMotor.exigir_rep_extra, onde).toBe(estadoRef.repExtra);
          expect(estadoMotor.semana_leve, onde).toBe(estadoRef.leve);
          expect(escala, onde).toContain(estadoMotor.carga_atual_kg);
        }
      }
    }
  });

  it("estados sujos aleatórios: o motor nunca sai da escala nem muta a entrada", () => {
    const degraus: (P.EstadoExercicio["assistencia"])[] = [
      ...P.DEGRAUS_ASSISTENCIA,
      null,
    ];
    const dado = sorteio(20260914);
    let casos = 0;

    for (const e of exercicios) {
      const prescricao = P.prescricaoPadrao(e);
      for (const pesoBarra of [undefined, 5.2] as const) {
        const opcoes = pesoBarra === undefined ? {} : { pesoBarra };
        const escala = cargasPossiveis(e.implemento, opcoes);
        for (let k = 0; k < 12; k++) {
          casos++;
          // colunas anuláveis do schema, cargas fora da escala, flags soltas
          const entrada: P.EstadoExercicio = {
            carga_atual_kg: dado() < 0.15 ? null : Math.round(dado() * 130 * 4) / 4,
            reps_alvo: dado() < 0.4 ? null : Math.floor(dado() * 30),
            tempo_alvo_s: dado() < 0.4 ? null : Math.floor(dado() * 90),
            assistencia: degraus[Math.floor(dado() * degraus.length)] ?? null,
            incremento_kg: dado() < 0.7 ? null : Math.round(dado() * 12) / 2,
            falhas_seguidas: Math.floor(dado() * 3),
            incremento_reduzido: dado() < 0.3,
            exigir_rep_extra: dado() < 0.3,
            semana_leve: dado() < 0.2,
            carga_antes_leve: dado() < 0.5 ? null : Math.round(dado() * 130 * 4) / 4,
            sessoes_graca: Math.floor(dado() * 3),
            desativado: false,
          };
          const copia = JSON.stringify(entrada);
          const quantas = Math.max(1, prescricao.series + Math.floor(dado() * 3) - 1);
          const series: P.SerieFeita[] = Array.from({ length: quantas }, () => {
            const v = Math.floor(dado() * 30);
            return {
              concluida: dado() > 0.1,
              reps: dado() < 0.08 ? null : v,
              reps_lado2: dado() < 0.5 ? undefined : Math.floor(dado() * 30),
              tempo_s: dado() < 0.08 ? null : v * 3,
              tempo_s_lado2: dado() < 0.5 ? undefined : v * 3,
              passos: v * 2,
            };
          });

          const d = P.decidir(e, entrada, series, {
            prescricao,
            ultimaFirme: dado() > 0.3,
            sessaoAbandonada: dado() < 0.2,
            seriesAnteriores:
              dado() < 0.5
                ? null
                : Array.from({ length: prescricao.series }, () => Math.floor(dado() * 15)),
            montagem: opcoes,
          });

          const onde = `${e.id} barra=${String(pesoBarra)} #${k}`;
          expect(JSON.stringify(entrada), onde).toBe(copia);
          expect(d.novoEstado.falhas_seguidas, onde).toBeGreaterThanOrEqual(0);
          expect(d.novoEstado.sessoes_graca, onde).toBeGreaterThanOrEqual(0);
          if (d.novoEstado.reps_alvo !== null) {
            expect(Number.isInteger(d.novoEstado.reps_alvo), onde).toBe(true);
          }
          if (d.novoEstado.tempo_alvo_s !== null) {
            expect(Number.isInteger(d.novoEstado.tempo_alvo_s), onde).toBe(true);
          }
          // SPEC §6.4/§10.5: decidiu, a carga gravada existe na escala
          if (d.evento !== null && d.novoEstado.carga_atual_kg !== null) {
            expect(escala, `${onde} ${String(d.evento.motivo)}`).toContain(
              d.novoEstado.carga_atual_kg,
            );
          }
          // SPEC §6.5: a montagem que a tela mostra fecha exata e nunca sobra
          const hoje = P.cargaDeHoje(e, d.novoEstado, prescricao, opcoes);
          if (hoje.montagem) {
            expect(hoje.montagem.exato, `${onde} carga ${String(hoje.carga_kg)}`).toBe(true);
            expect(hoje.montagem.diferenca, onde).toBeUndefined();
          }
        }
      }
    }
    expect(casos).toBeGreaterThan(1500);
  });
});

/* ------- 19. séries a mais / a menos e unilateral sem o lado 2 ----- */

describe("séries além e aquém da prescrição, e o lado 2 ausente", () => {
  it("tipo `maximo`: série faltando conta 0 e a média não pode subir", () => {
    // SPEC §6.3: "sucesso = média de reps ≥ média da última sessão + 1 e
    // nenhuma série abaixo da anterior"; §6.2: série "não concluída" é falha.
    const e = ex("barra-fixa-pronada");
    const quatro = { ...P.prescricaoPadrao(e), series: 4 }; // SB pede 4 × máximo
    const anteriores = [8, 8, 8, 8];

    const completa = P.decidir(e, estado("barra-fixa-pronada", { reps_alvo: 8 }), reps(9, 9, 9, 9), {
      prescricao: quatro,
      seriesAnteriores: anteriores,
    });
    expect(completa.evento?.motivo).toBe("subiu");

    const faltando = P.decidir(e, estado("barra-fixa-pronada", { reps_alvo: 8 }), reps(9, 9, 9), {
      prescricao: quatro,
      seriesAnteriores: anteriores,
    });
    expect(faltando.evento?.motivo).toBe("repetiu");
    expect(faltando.evento?.falha).toBe(true);
    expect(faltando.novoEstado.reps_alvo).toBe(8);
  });

  it("tipo `maximo`: uma série a mais entra na média (SPEC §6.3)", () => {
    const e = ex("barra-fixa-pronada");
    const tres = P.prescricaoPadrao(e);
    const d = P.decidir(e, estado("barra-fixa-pronada", { reps_alvo: 8 }), reps(9, 9, 9, 3), {
      prescricao: tres,
      seriesAnteriores: [8, 8, 8],
    });
    // média 7,5 < 8: a 4ª série derruba a média e não há subida
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBe(true);
  });

  it("unilateral em tempo sem o lado 2 (prancha lateral, SPEC §6.3)", () => {
    const e = ex("prancha-lateral");
    const presc = P.prescricaoPadrao(e);
    expect(presc.unilateral).toBe(true);
    const so1 = [40, 40, 40].map((t) => ({ concluida: true, tempo_s: t }));
    const dois = [40, 40, 40].map((t) => ({ concluida: true, tempo_s: t, tempo_s_lado2: 25 }));

    const a = P.decidir(e, estado("prancha-lateral"), so1, { ultimaFirme: true });
    expect(a.evento?.motivo).toBe("subiu");
    expect(a.novoEstado.tempo_alvo_s).toBe(45);

    // com os dois lados vale o menor: 25 < 40 → não sobe
    const b = P.decidir(e, estado("prancha-lateral"), dois, { ultimaFirme: true });
    expect(b.evento?.motivo).toBe("repetiu");
    expect(b.novoEstado.tempo_alvo_s).toBe(20);
  });
});

/* ------- 20. semana curta em toda marcação possível (§5.2/§5.4) ---- */

describe("semana curta: conservação e alternância em toda marcação", () => {
  const DIAS_SEM: DiaSemana[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

  function verificar(perfil: C.PerfilCalendario, segunda: string, marcados: DiaSemana[]) {
    const planejada = C.semanaDoPlano(segunda, perfil);
    const r = C.semanaCurta(marcados, planejada);
    const onde = `${segunda} ${perfil.ultimo_treino ?? "-"} marcados=${marcados.join("+")}`;

    // nenhum dia marcado sobra com atividade
    for (const d of r.dias) {
      if (marcados.includes(d.dia)) expect(d.tipo, onde).toBe("descanso");
    }
    // nada some em silêncio: planejado = o que ficou + o que foi cortado
    const planejadas = planejada.filter((d) => d.tipo !== "descanso").length;
    const ficaram = r.dias.filter((d) => d.tipo !== "descanso").length;
    expect(ficaram + r.cortados.length, onde).toBe(planejadas);
    expect(ficaram, onde).toBeLessThanOrEqual(r.capacidade);

    // SPEC §5.2 item 3: na Fase 1 dois treinos iguais nunca ficam seguidos
    if (perfil.fase_atual === "fase1") {
      const seq = r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId);
      for (let i = 1; i < seq.length; i++) expect(seq[i], `${onde} ${seq.join(">")}`).not.toBe(seq[i - 1]);
      // SPEC §5.4: sobrando um treino só, é o Treino A completo
      if (seq.length === 1) expect(seq[0], onde).toBe("A1");
      // SPEC §5.4: nunca se corta agachamento/terra antes do cardio
      const cortouForca = r.cortados.some((c) => c.tipo === "forca");
      const sobrouCardio = r.dias.some((d) => d.tipo === "cardio");
      if (cortouForca) expect(sobrouCardio, `${onde}: cortou força com cardio de pé`).toBe(false);
    }
  }

  it("cada dia isolado e cada par, nas duas fases e na virada do ano", () => {
    const semanas = ["2026-09-14", "2026-12-28"]; // primeira semana e a do ano novo
    for (const segunda of semanas) {
      for (const fase of ["fase1", "fase2"] as const) {
        for (const ultimo of ["A1", "B1", null] as (TreinoId | null)[]) {
          const perfil: C.PerfilCalendario = {
            fase_atual: fase,
            ultimo_treino: ultimo,
            fase_desde: "2026-09-14",
          };
          for (const a of DIAS_SEM) {
            verificar(perfil, segunda, [a]);
            for (const b of DIAS_SEM) {
              if (b <= a) continue;
              verificar(perfil, segunda, [a, b]);
            }
          }
        }
      }
    }
  });

  it("a semana inteira marcada menos um dia deixa o Treino A (SPEC §5.4)", () => {
    for (const ultimo of ["A1", "B1"] as TreinoId[]) {
      for (const segunda of ["2026-09-14", "2026-12-28", "2027-12-27"]) {
        const planejada = C.semanaDoPlano(segunda, {
          fase_atual: "fase1",
          ultimo_treino: ultimo,
          fase_desde: "2026-09-14",
        });
        const resto = (["ter", "qua", "qui", "sex", "sab", "dom"] as DiaSemana[]);
        const r = C.semanaCurta(resto, planejada);
        const ficaram = r.dias.filter((d) => d.tipo !== "descanso");
        expect(ficaram, `${segunda}/${ultimo}`).toHaveLength(1);
        expect(ficaram[0]?.treinoId, `${segunda}/${ultimo}`).toBe("A1");
        expect(ficaram[0]?.dia).toBe("seg");
      }
    }
  });
});

/* -------- 21. ACHADOS da rodada 2 da lente "bordas" --------------- */

describe("ACHADOS — a foto do evento e o teto do lastro", () => {
  it("ACHADO A — §4/§6.6: com `carga_atual_kg` null o evento grava de: null", () => {
    // O schema deixa `exercise_state.carga_atual_kg` anulável e a SPEC §6.1 diz
    // que sem carga gravada vale a `carga_inicial.kg` do JSON — fallback que a
    // rodada 2 (achado 6) pôs em cargaDeHoje() e a rodada 1 (achado 7) em
    // subir()/falhar(). A projeção da rodada 4 acontece "antes de qualquer
    // conta, foto ou evento", mas está atrás de um `!== null`: a foto do evento
    // é o único lugar que continua lendo a coluna crua.
    // SPEC §4: progression_events guarda "cada decisão do motor (de → para,
    // motivo), para o histórico explicar 'por que hoje é 26,5 kg'"; §6.6 põe
    // essa linha do tempo na ficha do exercício.
    const e = ex("supino-reto-com-barra");
    const doBanco = estado("supino-reto-com-barra", { carga_atual_kg: null });
    expect(P.cargaDeHoje(e, doBanco).carga_kg).toBe(7.5); // o que a tela mostrou

    const subiu = P.decidir(e, doBanco, reps(8, 8, 8), { ultimaFirme: true });
    expect(subiu.evento?.motivo).toBe("subiu");
    expect(subiu.evento?.para).toEqual({ carga_kg: 9.5 });
    expect(subiu.evento?.de, "de: null com a tela mostrando 7,5 kg").toEqual({
      carga_kg: 7.5,
    });

    // pior no "repetiu": de e para saem os dois null e o estado continua null,
    // então a linha do tempo da §6.6 não registra nada e o caso se repete.
    const repetiu = P.decidir(e, doBanco, reps(8, 8, 7), { ultimaFirme: true });
    expect(repetiu.evento?.motivo).toBe("repetiu");
    expect(repetiu.evento?.de).toEqual({ carga_kg: 7.5 });
    expect(repetiu.evento?.para).toEqual({ carga_kg: 7.5 });
    expect(repetiu.novoEstado.carga_atual_kg).toBe(7.5);
  });

  it("ACHADO A — o mesmo com `assistencia`, `reps_alvo` e `tempo_alvo_s` nulos", () => {
    // As três colunas são anuláveis no schema e as três têm fallback na §6.1
    // (assistência → `pe_inteiro`, reps/tempo → a faixa da prescrição).
    const fixa = ex("barra-fixa-assistida");
    const semDegrau = estado("barra-fixa-assistida", { assistencia: null });
    expect(P.cargaDeHoje(fixa, semDegrau).assistencia).toBe("pe_inteiro");
    const sobeDegrau = P.decidir(fixa, semDegrau, reps(8, 8, 8, 8), { ultimaFirme: true });
    expect(sobeDegrau.evento?.para).toEqual({ assistencia: "joelho" });
    expect(sobeDegrau.evento?.de).toEqual({ assistencia: "pe_inteiro" });

    // CORRIGIDO (motor certo, expectativa do auditor errada): em reps e tempo o
    // fallback da §6.1 é o PISO da faixa, não o topo. A §6.1 diz "Primeira vez
    // no exercício: … reps/tempo alvo = mínimo da faixa", `estadoInicial()`
    // grava o mínimo e o próprio `cargaDeHoje()` citado no achado devolve
    // `tempo_alvo_s: base.tempo_alvo_s ?? prescricao.min` (30, não 60). A coluna
    // nula tem de se comportar como a linha que ainda não existe: com
    // `estado = null` o motor já grava `de: {reps_alvo: 10}` / `{tempo_alvo_s:
    // 30}`. O topo (15 / 60) é o alvo a bater, que sai em `para` somado ao
    // incremento (16 / 65) — o defeito real do achado era o `null`.
    const pernas = ex("elevacao-de-pernas-na-barra-fixa");
    const semReps = estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: null });
    expect(P.cargaDeHoje(pernas, semReps).alvo_max).toBe(15);
    const sobeReps = P.decidir(pernas, semReps, reps(15, 15, 15), { ultimaFirme: true });
    expect(sobeReps.evento?.para).toEqual({ reps_alvo: 16 });
    expect(sobeReps.evento?.de).toEqual({ reps_alvo: 10 });
    expect(P.decidir(pernas, null, reps(15, 15, 15), { ultimaFirme: true }).evento)
      .toMatchObject({ de: { reps_alvo: 10 }, para: { reps_alvo: 16 } });

    const prancha = ex("prancha");
    const semTempo = estado("prancha", { tempo_alvo_s: null });
    expect(P.cargaDeHoje(prancha, semTempo).alvo_max).toBe(60);
    expect(P.cargaDeHoje(prancha, semTempo).tempo_alvo_s).toBe(30);
    const segundos = [60, 60, 60].map((t) => ({ concluida: true, tempo_s: t }));
    const sobeTempo = P.decidir(prancha, semTempo, segundos, { ultimaFirme: true });
    expect(sobeTempo.evento?.para).toEqual({ tempo_alvo_s: 65 });
    expect(sobeTempo.evento?.de).toEqual({ tempo_alvo_s: 30 });
    expect(P.decidir(prancha, null, segundos, { ultimaFirme: true }).evento)
      .toMatchObject({ de: { tempo_alvo_s: 30 }, para: { tempo_alvo_s: 65 } });
  });

  it("ACHADO B — §6.4: no teto do lastro o app manda não comprar anilhas", () => {
    // SPEC §6.4: "Aviso quando a carga pedida exige mais anilhas de 10 kg do
    // que existem (marco do guia: comprar duas de 10 kg)".
    // No lastro (mochila) não existe barra nem capacidade: o teto é o estoque
    // inteiro (equipamentos.anilhas.total_kg = 100), e a própria montagem de
    // 101 kg devolve as 24 anilhas do estoque. Mesmo assim
    // limiteDoImplemento() classifica como "capacidade" — o empate
    // `estoque === capacidade` cai no lado errado — e o motor diz "comprar
    // anilhas não sobe a carga", que é justamente o contrário.
    expect(cargaMaxima("barra_fixa")).toBe(100);
    expect(capacidadeDoImplemento("barra_fixa")).toBe(100);
    const m = montagem(101, "barra_fixa");
    expect(m.total).toBe(100);
    expect(m.anilhas).toHaveLength(24); // as 4 de cada peso: o estoque inteiro
    expect(m.limite, "o teto do lastro é o estoque, não uma capacidade").toBe("estoque");
    expect(m.aviso).toBe("faltam anilhas de 10 kg");

    const e = ex("barra-fixa-com-lastro");
    expect(e.progressao.tipo).toBe("carga");
    const d = P.decidir(
      e,
      estado("barra-fixa-com-lastro", { carga_atual_kg: 100 }),
      reps(6, 6, 6, 6),
      { ultimaFirme: true },
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(txt(d.evento?.aviso)).toBe("faltam anilhas de 10 kg (marco do guia)");
  });
});
