import { describe, expect, it } from "vitest";
import { ilustracoes, medidasDeFoto, urlFotos, exercicios } from "@/lib/dados";
import {
  ALTURA_MAXIMA_DA_ILUSTRACAO,
  FOLGA_DA_ILUSTRACAO,
  caixaDaIlustracao,
  figuraNaCaixa,
  proporcaoDaFoto,
  urlDaLicenca,
  urlWebp,
} from "@/lib/midia";

/** A coluna da ficha a 360 px: 360 − 2 × 16 de margem. */
const COLUNA_360 = 328;

describe("caixaDaIlustracao (SPEC §22.13 item 1)", () => {
  const medidas = ilustracoes.flatMap((i) =>
    i.arquivos.map((a) => ({ id: i.exercicio_id, largura: a.largura, altura: a.altura })),
  );

  it("cobre todas as medidas do JSON (145 arquivos)", () => {
    expect(medidas.length).toBe(145);
  });

  it("nenhuma ilustração ocupa menos de 60 % da largura da caixa a 360 px", () => {
    const abaixo = medidas.filter((m) => figuraNaCaixa(m, COLUNA_360).fracao < 0.6);
    expect(abaixo).toEqual([]);
  });

  it("com a caixa de altura fixa de antes (328 × 208), 78+ ficavam abaixo de 60 %", () => {
    // a conta de antes, para o teste não ser tautológico: caixa larga e fixa
    const antes = medidas.filter((m) => {
      const areaL = COLUNA_360 - 2 * FOLGA_DA_ILUSTRACAO;
      const areaA = 208 - 2 * FOLGA_DA_ILUSTRACAO;
      const figura = Math.min(areaL, areaA * (m.largura / m.altura));
      return figura / COLUNA_360 < 0.6;
    });
    expect(antes.length).toBeGreaterThanOrEqual(78);
  });

  it("o agachamento goblet passa de 180 px de figura", () => {
    const goblet = medidas.find((m) => m.id === "agachamento-goblet")!;
    const r = figuraNaCaixa(goblet, COLUNA_360);
    expect(r.figura).toBeGreaterThanOrEqual(180);
    expect(r.alturaDaFigura).toBeLessThanOrEqual(ALTURA_MAXIMA_DA_ILUSTRACAO + 1);
  });

  it("a figura larga ocupa a coluna inteira e a alta para no teto", () => {
    const larga = figuraNaCaixa({ largura: 640, altura: 233 }, COLUNA_360);
    expect(larga.caixa).toBe(COLUNA_360);
    const alta = figuraNaCaixa({ largura: 640, altura: 1807 }, COLUNA_360);
    expect(alta.caixa).toBeLessThan(COLUNA_360);
    expect(Math.round(alta.alturaDaFigura)).toBeLessThanOrEqual(ALTURA_MAXIMA_DA_ILUSTRACAO + 1);
  });

  it("a proporção é o par do próprio arquivo", () => {
    expect(caixaDaIlustracao({ largura: 640, altura: 1510 }).proporcao).toBe("640 / 1510");
    expect(caixaDaIlustracao({ largura: 640, altura: 1510 }).larguraMaxima).toBe(
      Math.round(ALTURA_MAXIMA_DA_ILUSTRACAO * (640 / 1510)) + 2 * FOLGA_DA_ILUSTRACAO,
    );
  });
});

describe("proporcaoDaFoto (SPEC §22.13 item 2)", () => {
  it("toda foto de execução tem a proporção do arquivo, não um quadrado", () => {
    let vistas = 0;
    for (const e of exercicios) {
      for (const url of urlFotos(e)) {
        for (const pedida of [url, urlWebp(url)]) {
          if (!pedida) continue;
          const [l, a] = proporcaoDaFoto(pedida).split(" / ").map(Number);
          expect(l).toBeGreaterThan(0);
          expect(l).not.toBe(a);
          vistas += 1;
        }
      }
    }
    expect(vistas).toBeGreaterThan(100);
    expect(Object.keys(medidasDeFoto).length).toBeGreaterThan(0);
  });

  it("sem medida conhecida, 3:2 (a das fotos do kit)", () => {
    expect(proporcaoDaFoto("https://exemplo.test/x.jpg")).toBe("3 / 2");
    expect(proporcaoDaFoto(null)).toBe("3 / 2");
  });
});

describe("urlDaLicenca (SPEC §22.13 item 3)", () => {
  it("toda licença do JSON vira a página dela na Creative Commons", () => {
    for (const i of ilustracoes) {
      expect(urlDaLicenca(i.licenca)).toMatch(
        /^https:\/\/creativecommons\.org\/licenses\/by-sa\/[34]\.0\/$/,
      );
    }
    expect(urlDaLicenca("CC BY-SA 3.0")).toBe("https://creativecommons.org/licenses/by-sa/3.0/");
    expect(urlDaLicenca("CC BY-SA 4.0")).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
  });

  it("o que não é código CC fica sem link", () => {
    expect(urlDaLicenca("MIT")).toBeNull();
    expect(urlDaLicenca("")).toBeNull();
  });
});
