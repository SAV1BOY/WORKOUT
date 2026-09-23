import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
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

  /*
   * Correção da auditoria: "≥ 60 % da largura da CAIXA" era verdadeiro por
   * construção (a caixa estreita até a figura). A medida que discrimina é a
   * da COLUNA de 328 px — e contra ela o teto de 432 px de altura deixa as
   * seis ilustrações mais altas (0,35:1 a 0,42:1) abaixo de 60 %: para o
   * tríceps na corda chegar a 197 px de figura, ela teria 556 px de altura e
   * não caberia na tela de 740 com o segmento. SPEC §22.13 item 1 registra.
   */
  const ALTAS_DEMAIS = [
    "agachamento-goblet",
    "elevacao-frontal",
    "extensao-unilateral",
    "pullover-na-polia",
    "puxada-com-triangulo",
    "triceps-na-corda",
  ];

  it("contra a coluna de 328 px, só as 6 ilustrações mais altas ficam abaixo de 60 %", () => {
    const abaixo = medidas.filter((m) => figuraNaCaixa(m, COLUNA_360).figura / COLUNA_360 < 0.6);
    expect([...new Set(abaixo.map((m) => m.id))].sort()).toEqual(ALTAS_DEMAIS);
    expect(abaixo).toHaveLength(12);
    // e cada uma delas está no teto: a altura manda, a figura não foi espremida
    for (const m of abaixo) {
      const r = figuraNaCaixa(m, COLUNA_360);
      expect(r.alturaDaFigura, m.id).toBeGreaterThanOrEqual(ALTURA_MAXIMA_DA_ILUSTRACAO - 2);
      expect(r.alturaDaFigura, m.id).toBeLessThanOrEqual(ALTURA_MAXIMA_DA_ILUSTRACAO + 1);
    }
  });

  it("toda figura ocupa a coluna (menos a folga) ou bate no teto de altura", () => {
    for (const m of medidas) {
      const r = figuraNaCaixa(m, COLUNA_360);
      const ocupaAColuna = r.figura >= COLUNA_360 - 2 * FOLGA_DA_ILUSTRACAO;
      const bateNoTeto = r.alturaDaFigura >= ALTURA_MAXIMA_DA_ILUSTRACAO - 2;
      expect(ocupaAColuna || bateNoTeto, `${m.id} ${m.largura}×${m.altura}`).toBe(true);
    }
  });

  /*
   * Correção da auditoria 2: o teste acima só pega incoerência entre
   * `larguraMaxima` e a folga — ele passa com o teto em 100, 500 ou 1000 px.
   * Quem prende o teto é esta conta: ele é o menor que leva o goblet a 180 px
   * de figura, e a caixa mais alta ainda cabe na tela da página a 360×740.
   */
  it("o teto fica entre o mínimo do goblet (180 px) e o que cabe na tela de 740", () => {
    const goblet = medidas.find((m) => m.id === "agachamento-goblet")!;
    const minimo = Math.ceil(180 / (goblet.largura / goblet.altura)); // 425
    // a página a 360×740 (medido no e2e): topo do segmento em 132 px, o
    // segmento (44) e o vão (8) acima da caixa; embaixo dela o crédito (alvo
    // de 44) e a barra de baixo (56)
    const acimaDaCaixa = 132 + 44 + 8;
    const abaixoDaCaixa = 44 + 56;
    const maximo = 740 - acimaDaCaixa - abaixoDaCaixa - 2 * FOLGA_DA_ILUSTRACAO; // 440
    expect(ALTURA_MAXIMA_DA_ILUSTRACAO).toBeGreaterThanOrEqual(minimo);
    expect(ALTURA_MAXIMA_DA_ILUSTRACAO).toBeLessThanOrEqual(maximo);
  });

  it("a folga é o p-2 da área da figura (8 px de cada lado)", () => {
    // a conta pura e o CSS têm de dizer a mesma folga: com FOLGA 0 nenhum
    // outro unitário caía, e a caixa passava a figura 16 px mais estreita
    const componente = readFileSync(
      join(process.cwd(), "components/exercicio/ilustracao-alternada.tsx"),
      "utf8",
    );
    expect(componente).toContain('cn("block p-2"');
    expect(FOLGA_DA_ILUSTRACAO).toBe(8);
  });

  it("com a caixa de altura fixa de antes, 100 de 145 (h-52, página) e 112 (h-44, folha) ficavam abaixo de 60 % da coluna", () => {
    const abaixo = (altura: number) =>
      medidas.filter((m) => {
        const areaL = COLUNA_360 - 2 * FOLGA_DA_ILUSTRACAO;
        const areaA = altura - 2 * FOLGA_DA_ILUSTRACAO;
        const figura = Math.min(areaL, areaA * (m.largura / m.altura));
        return figura / COLUNA_360 < 0.6;
      }).length;
    expect(abaixo(208)).toBe(100);
    expect(abaixo(176)).toBe(112);
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

  /*
   * Correção da auditoria 2: as fotos NÃO são todas 3:2 — 304 arquivos em
   * 850×567, 8 em 850×569 e 12 em retrato 2:3 (agachamento búlgaro e as duas
   * barras fixas: 850×1275 no kit, 800×1200 na derivada). Aqui cada foto de
   * `data/exercicios.json` é lida do próprio arquivo do kit.
   */
  it("toda foto do JSON: a proporção da caixa é a do arquivo do kit, e 12 são retrato", async () => {
    const retrato: string[] = [];
    let vistas = 0;
    for (const e of exercicios) {
      for (const url of urlFotos(e)) {
        const nome = url.split("/").pop()!;
        const arquivo = await sharp(join(process.cwd(), "assets", "fotos", nome)).metadata();
        const real = arquivo.width! / arquivo.height!;
        for (const pedida of [url, urlWebp(url)]) {
          if (!pedida) continue;
          const [l, a] = proporcaoDaFoto(pedida).split(" / ").map(Number);
          expect(Math.abs(l! / a! - real), pedida).toBeLessThanOrEqual(0.005);
          if (l! < a!) retrato.push(pedida);
          vistas += 1;
        }
      }
    }
    expect(vistas).toBe(324);
    expect(retrato).toHaveLength(12);
    expect(new Set(retrato.map((u) => u.replace(/-[12]\.(jpg|webp)$/, "")))).toEqual(
      new Set(["/fotos/agachamento-bulgaro", "/fotos/barra-fixa-assistida", "/fotos/barra-fixa-com-lastro"]),
    );
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
