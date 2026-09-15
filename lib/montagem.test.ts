import { describe, expect, it } from "vitest";
import {
  alcancavelParaBaixo,
  cargasPossiveis,
  montagem,
  PESO_BARRA_A_PESAR,
} from "@/lib/montagem";

describe("cargasPossiveis", () => {
  it("barra maciça: 7,5 + 2 × S, de 7,5 a 107,5 de 2 em 2", () => {
    const escala = cargasPossiveis("barra_macica");
    expect(escala[0]).toBe(7.5);
    expect(escala[escala.length - 1]).toBe(107.5);
    expect(escala).toHaveLength(51);
    for (let i = 1; i < escala.length; i++) {
      expect((escala[i] as number) - (escala[i - 1] as number)).toBeCloseTo(2, 5);
    }
  });

  it("halteres: 1,5 + 2 × S por halter, teto 39,5 (capacidade 40)", () => {
    const escala = cargasPossiveis("halteres");
    expect(escala[0]).toBe(1.5);
    expect(escala[escala.length - 1]).toBe(39.5);
    expect(escala).toContain(3.5);
    expect(escala).toContain(5.5);
    expect(escala).toContain(11.5);
    expect(escala).toContain(21.5);
    expect(escala).not.toContain(41.5);
  });

  it("polia: qualquer soma do estoque, de 0 a 100 kg no pino", () => {
    const escala = cargasPossiveis("polia");
    expect(escala[0]).toBe(0);
    expect(escala[escala.length - 1]).toBe(100);
    for (const kg of [1, 2, 4, 6, 9, 20]) expect(escala).toContain(kg);
  });

  it("barra W: 2,0 (a pesar) + 2 × S, teto 50", () => {
    const escala = cargasPossiveis("barra_w");
    expect(PESO_BARRA_A_PESAR).toBe(2);
    expect(escala[0]).toBe(2);
    expect(escala[escala.length - 1]).toBe(50);
  });

  it("barra reta oca: capacidade 60", () => {
    const escala = cargasPossiveis("barra_reta_oca");
    expect(escala[escala.length - 1]).toBe(60); // 2 + 2 × 29
  });

  it("peso da barra pode ser sobrescrito quando o usuário pesar", () => {
    const escala = cargasPossiveis("barra_w", { pesoBarra: 4.2 });
    expect(escala[0]).toBe(4.2);
  });

  it("lastro (barra fixa / peso corporal): qualquer soma do estoque na mochila", () => {
    expect(cargasPossiveis("barra_fixa")).toContain(2);
    expect(cargasPossiveis("peso_corporal")[0]).toBe(0);
  });

  it("corda e elástico não têm carga", () => {
    expect(cargasPossiveis("corda")).toEqual([0]);
    expect(cargasPossiveis("band")).toEqual([0]);
  });
});

describe("alcancavelParaBaixo", () => {
  it("barra maciça: exemplos inválidos da tabela caem para a vizinha inferior", () => {
    expect(alcancavelParaBaixo(26.5, "barra_macica")).toBe(25.5);
    expect(alcancavelParaBaixo(8, "barra_macica")).toBe(7.5);
    expect(alcancavelParaBaixo(110, "barra_macica")).toBe(107.5);
  });

  it("halteres: 4,5 → 3,5 · 6 → 5,5 · 41,5 → 39,5", () => {
    expect(alcancavelParaBaixo(4.5, "halteres")).toBe(3.5);
    expect(alcancavelParaBaixo(6, "halteres")).toBe(5.5);
    expect(alcancavelParaBaixo(41.5, "halteres")).toBe(39.5);
  });

  it("polia: 0,5 → 0 · 101 → 100", () => {
    expect(alcancavelParaBaixo(0.5, "polia")).toBe(0);
    expect(alcancavelParaBaixo(101, "polia")).toBe(100);
  });

  it("barra W: 52 → 50", () => {
    expect(alcancavelParaBaixo(52, "barra_w")).toBe(50);
  });

  it("abaixo do mínimo devolve o mínimo do implemento", () => {
    expect(alcancavelParaBaixo(0, "barra_macica")).toBe(7.5);
    expect(alcancavelParaBaixo(-5, "halteres")).toBe(1.5);
  });

  it("os arredondamentos do motor (−10 % e 60 %)", () => {
    expect(alcancavelParaBaixo(25.5 * 0.9, "barra_macica")).toBe(21.5); // 22,95
    expect(alcancavelParaBaixo(39.5 * 0.9, "barra_macica")).toBe(35.5); // 35,55
    expect(alcancavelParaBaixo(47.5 * 0.6, "barra_macica")).toBe(27.5); // 28,5
  });
});

describe("montagem — os exemplos de chamada do documento", () => {
  it('montagem(25.5, "barra_macica") → porLado [5, 4] exato', () => {
    expect(montagem(25.5, "barra_macica")).toMatchObject({
      porLado: [5, 4],
      total: 25.5,
      exato: true,
    });
  });

  it('montagem(26.5, "barra_macica") → 25,5 com diferença −1', () => {
    expect(montagem(26.5, "barra_macica")).toMatchObject({
      porLado: [5, 4],
      total: 25.5,
      exato: false,
      diferenca: -1,
    });
  });

  it('montagem(5.5, "halteres") → porPonta [2] em cada halter', () => {
    expect(montagem(5.5, "halteres")).toMatchObject({
      porPonta: [2],
      total: 5.5,
      exato: true,
    });
  });

  it('montagem(107.5, "barra_macica") → o kit inteiro', () => {
    expect(montagem(107.5, "barra_macica")).toMatchObject({
      porLado: [10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1],
      total: 107.5,
      exato: true,
    });
  });

  it('montagem(109.5, "barra_macica") → 107,5 com aviso de anilhas de 10 kg', () => {
    const m = montagem(109.5, "barra_macica");
    expect(m.total).toBe(107.5);
    expect(m.exato).toBe(false);
    expect(m.aviso).toContain("faltam anilhas de 10 kg");
  });
});

describe("montagem — limites de estoque", () => {
  it("barra: no máximo 2 anilhas de cada peso por lado", () => {
    for (const total of cargasPossiveis("barra_macica")) {
      const contagem = new Map<number, number>();
      for (const kg of montagem(total, "barra_macica").anilhas) {
        contagem.set(kg, (contagem.get(kg) ?? 0) + 1);
      }
      for (const n of contagem.values()) expect(n).toBeLessThanOrEqual(2);
    }
  });

  it("halteres: no máximo 1 anilha de cada peso por ponta (4 pontas, 4 anilhas)", () => {
    for (const total of cargasPossiveis("halteres")) {
      const anilhas = montagem(total, "halteres").anilhas;
      expect(new Set(anilhas).size).toBe(anilhas.length);
    }
  });

  it("guloso: sempre do maior para o menor", () => {
    const anilhas = montagem(107.5, "barra_macica").anilhas;
    const ordenado = [...anilhas].sort((a, b) => b - a);
    expect(anilhas).toEqual(ordenado);
  });

  it("polia mostra as anilhas do pino e o lastro, a mochila", () => {
    expect(montagem(9, "polia")).toMatchObject({ noPino: [5, 4], total: 9, exato: true });
    expect(montagem(2, "barra_fixa")).toMatchObject({ naMochila: [2], total: 2, exato: true });
  });

  it("corda e elástico não montam nada", () => {
    expect(montagem(0, "corda")).toMatchObject({ anilhas: [], total: 0, exato: true });
  });
});

describe("montagem — a escala inteira fecha exata", () => {
  it("barra maciça: 7,5 a 107,5 sempre exato, e o meio da escala cai para baixo", () => {
    for (const total of cargasPossiveis("barra_macica")) {
      const m = montagem(total, "barra_macica");
      expect(m.exato, `carga ${total}`).toBe(true);
      expect(m.total).toBe(total);
      const soma = m.anilhas.reduce((s, kg) => s + kg, 0);
      expect(7.5 + 2 * soma).toBeCloseTo(total, 5);
      // um kg acima da escala não existe: volta para a vizinha inferior
      if (total < 107.5) {
        const acima = montagem(total + 1, "barra_macica");
        expect(acima.total, `carga ${total + 1}`).toBe(total);
        expect(acima.exato).toBe(false);
        expect(acima.diferenca).toBe(-1);
      }
    }
  });

  it("halteres: 1,5 a 39,5 sempre exato, com os dois halteres iguais", () => {
    for (const total of cargasPossiveis("halteres")) {
      const m = montagem(total, "halteres");
      expect(m.exato, `carga ${total}`).toBe(true);
      const soma = m.anilhas.reduce((s, kg) => s + kg, 0);
      expect(1.5 + 2 * soma).toBeCloseTo(total, 5);
      if (total < 39.5) {
        expect(montagem(total + 1, "halteres").total).toBe(total);
      }
    }
  });

  it("polia: todo inteiro de 0 a 100 fecha exato", () => {
    for (let kg = 0; kg <= 100; kg++) {
      expect(montagem(kg, "polia").exato, `pino ${kg}`).toBe(true);
    }
  });
});

describe("pesos das barras medidos no perfil (SPEC §3.9)", () => {
  it("`pesosBarras` vale por barra; as outras seguem o JSON", () => {
    const opcoes = { pesosBarras: { "barra-w": 4.8 } } as const;
    expect(cargasPossiveis("barra_w", opcoes)[0]).toBe(4.8);
    expect(cargasPossiveis("barra_macica", opcoes)[0]).toBe(7.5);
    expect(cargasPossiveis("barra_reta_oca", opcoes)[0]).toBe(PESO_BARRA_A_PESAR);
    expect(cargasPossiveis("halteres", opcoes)[0]).toBe(1.5);
  });

  it("dá para corrigir a barra que o JSON já traz (e os halteres)", () => {
    const opcoes = {
      pesosBarras: { "barra-macica": 7.2, halteres: 1.4 },
    } as const;
    expect(cargasPossiveis("barra_macica", opcoes)[0]).toBe(7.2);
    expect(montagem(11.2, "barra_macica", opcoes).porLado).toEqual([2]);
    expect(cargasPossiveis("halteres", opcoes)[0]).toBe(1.4);
  });

  it("o override direto `pesoBarra` continua vencendo", () => {
    const opcoes = { pesoBarra: 6, pesosBarras: { "barra-w": 4.8 } } as const;
    expect(cargasPossiveis("barra_w", opcoes)[0]).toBe(6);
  });

  it("o teto do implemento não muda com a barra mais leve", () => {
    const opcoes = { pesosBarras: { "barra-w": 4.8 } } as const;
    const escala = cargasPossiveis("barra_w", opcoes);
    expect(escala.at(-1)).toBeLessThanOrEqual(50);
  });
});
