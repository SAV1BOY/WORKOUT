/**
 * Ultraloop — Rodada 33, Lote 15 (SPEC §22.19): Corpo — peso, gráficos e
 * campo de data. As regras puras de cada item e o HTML que os componentes
 * desenham no servidor; o caminho de tela está em e2e/ultraloop-l15.spec.ts.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardImc } from "@/components/corpo/card-imc";
import { GraficoBarras, GraficoLinha } from "@/components/graficos/grafico";
import { CampoData } from "@/components/ui/campo-data";
import { dataDaEscolha, dataValida, escolherData, opcoesDaData } from "@/lib/campo-data";
import {
  mediaMovel,
  mediaTemPontos,
  pontosDePeso,
  pontosDoGraficoDoPeso,
  reguaDoEixo,
  reguaDoPeso,
  seriesDoPeso,
  textoDaVariacao,
  variacaoDoPeriodo,
} from "@/lib/corpo";
import { PONTOS_CITADOS, leituraDoGrafico, tendencia } from "@/lib/grafico-leitura";
import { faixasDaBarra } from "@/lib/imc";

/** As três pesagens das capturas do ultraloop (scripts/capturas-ultraloop.ts). */
const PESOS = [
  { data: "2026-08-12", peso_kg: 84.2 },
  { data: "2026-08-26", peso_kg: 83.1 },
  { data: "2026-09-12", peso_kg: 82.4 },
];

/** 30 pesagens seguidas em agosto, entre 81 e 83 kg. */
const TRINTA = Array.from({ length: 30 }, (_, i) => ({
  data: `2026-08-${String(i + 1).padStart(2, "0")}`,
  peso_kg: 81 + (i % 21) / 10,
}));

/* ------------------------------------------------------------ item 1 */

describe("§22.19 item 1 — a leitura em texto do gráfico", () => {
  it("três pontos: cada um com a data e a tendência", () => {
    expect(
      leituraDoGrafico({
        titulo: "Peso por data",
        dados: mediaMovel(PESOS),
        x: "rotulo",
        series: [{ chave: "peso", nome: "Peso" }],
        sufixo: " kg",
      }),
    ).toBe(
      "Peso por data. Peso: 84,2 kg em 12/08, 83,1 kg em 26/08, 82,4 kg em 12/09 — queda de 1,8 kg.",
    );
  });

  it("um ponto: o valor, sem tendência", () => {
    expect(
      leituraDoGrafico({
        titulo: "Peso por data",
        dados: mediaMovel([{ data: "2026-09-16", peso_kg: 82 }]),
        x: "rotulo",
        series: [{ chave: "peso", nome: "Peso" }],
        sufixo: " kg",
      }),
    ).toBe("Peso por data. Peso: 82 kg em 16/09.");
  });

  it("30 pontos: o resumo (quantos, de quando a quando, primeiro, último, menor e maior)", () => {
    const leitura = leituraDoGrafico({
      titulo: "Peso por data, com a média de 7 dias",
      dados: mediaMovel(TRINTA),
      x: "rotulo",
      series: [
        { chave: "peso", nome: "Peso" },
        { chave: "media", nome: "Média de 7 dias" },
      ],
      sufixo: " kg",
    });
    expect(leitura).toContain(
      "Peso: 30 valores de 01/08 a 30/08; primeiro 81 kg, último 81,8 kg — alta de 0,8 kg; menor 81 kg em 01/08, maior 83 kg em 21/08",
    );
    expect(leitura).toContain("Média de 7 dias: 30 valores de 01/08 a 30/08");
    // o resumo não cita os 30 pontos um a um
    expect(leitura).not.toContain("em 02/08,");
  });

  it("o limiar: com 6 pontos cita os 6; com 7, o resumo (correção da auditoria)", () => {
    expect(PONTOS_CITADOS).toBe(6);
    const serie = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ x: `0${i + 1}/09`, v: 80 + i }));
    const ler = (n: number) =>
      leituraDoGrafico({
        titulo: "T",
        dados: serie(n),
        x: "x",
        series: [{ chave: "v", nome: "V" }],
        sufixo: " kg",
      });
    expect(ler(6)).toBe(
      "T. V: 80 kg em 01/09, 81 kg em 02/09, 82 kg em 03/09, 83 kg em 04/09, 84 kg em 05/09, 85 kg em 06/09 — alta de 5 kg.",
    );
    expect(ler(7)).toBe(
      "T. V: 7 valores de 01/09 a 07/09; primeiro 80 kg, último 86 kg — alta de 6 kg; menor 80 kg em 01/09, maior 86 kg em 07/09.",
    );
  });

  it("série constante com 7+ pontos: o número uma vez só ('todos 0')", () => {
    const semanas = Array.from({ length: 12 }, (_, i) => ({
      rotulo: `${String(i + 1).padStart(2, "0")}/08`,
      series: 0,
    }));
    expect(
      leituraDoGrafico({
        titulo: "Repetições de barra fixa por semana",
        dados: semanas,
        x: "rotulo",
        series: [{ chave: "series", nome: "Séries" }],
      }),
    ).toBe(
      "Repetições de barra fixa por semana. Séries: 12 valores de 01/08 a 12/08, todos 0.",
    );
    expect(
      leituraDoGrafico({
        titulo: "Minutos",
        dados: semanas.map((s) => ({ ...s, series: 30 })),
        x: "rotulo",
        series: [{ chave: "series", nome: "Minutos" }],
        sufixo: " min",
      }),
    ).toBe("Minutos. Minutos: 12 valores de 01/08 a 12/08, todos 30 min.");
    // até 6 pontos a série constante continua citada um a um
    expect(
      leituraDoGrafico({
        titulo: "T",
        dados: semanas.slice(0, 2),
        x: "rotulo",
        series: [{ chave: "series", nome: "S" }],
      }),
    ).toBe("T. S: 0 em 01/08, 0 em 02/08 — sem variação.");
  });

  it("alta, queda e sem variação", () => {
    expect(tendencia(80, 81.5, " kg")).toBe("alta de 1,5 kg");
    expect(tendencia(81.5, 80, " kg")).toBe("queda de 1,5 kg");
    expect(tendencia(80, 80, " kg")).toBe("sem variação");
    // o erro do ponto flutuante (82,4 − 84,2) não vira "1,8000000000000114"
    expect(tendencia(84.2, 82.4, " kg")).toBe("queda de 1,8 kg");
    // 82,4 − 1,1 = 81,30000000000001 no ponto flutuante: sem o arredondamento
    // a leitura diria "queda de 0 kg" no lugar de "sem variação"
    expect(tendencia(82.4 - 1.1, 81.3, " kg")).toBe("sem variação");
  });

  it("série sem valor não é citada; sem valor nenhum, 'sem dados'", () => {
    const dados = [
      { rotulo: "07/09", series: 12, soltas: null },
      { rotulo: "14/09", series: 20, soltas: undefined },
    ];
    const leitura = leituraDoGrafico({
      titulo: "Repetições de barra fixa por semana",
      dados,
      x: "rotulo",
      series: [
        { chave: "series", nome: "Séries" },
        { chave: "soltas", nome: "Soltas" },
      ],
    });
    expect(leitura).toBe(
      "Repetições de barra fixa por semana. Séries: 12 em 07/09, 20 em 14/09 — alta de 8.",
    );
    expect(leitura).not.toContain("Soltas");
    expect(
      leituraDoGrafico({
        titulo: "Volume por semana",
        dados: [{ rotulo: "07/09" }],
        x: "rotulo",
        series: [{ chave: "valor", nome: "Volume" }],
      }),
    ).toBe("Volume por semana. sem dados.");
  });

  it("a meta entra no fim, com o sufixo", () => {
    expect(
      leituraDoGrafico({
        titulo: "Peso por data",
        dados: mediaMovel(PESOS),
        x: "rotulo",
        series: [{ chave: "peso", nome: "Peso" }],
        sufixo: " kg",
        referencia: { nome: "Meta", valor: 80 },
      }),
    ).toMatch(/— queda de 1,8 kg\. Meta: 80 kg\.$/);
  });

  it("o invólucro desenha uma figura role=img com a leitura e o gráfico fora da árvore", () => {
    const linha = renderToStaticMarkup(
      createElement(GraficoLinha, {
        titulo: "Peso por data",
        dados: mediaMovel(PESOS),
        x: "rotulo",
        sufixo: " kg",
        series: [{ chave: "peso", nome: "Peso" }],
        referencia: { nome: "Meta", valor: 80 },
      }),
    );
    expect(linha).toMatch(
      /^<figure role="img" class="w-full" aria-label="Peso por data\. Peso: 84,2 kg em 12\/08, 83,1 kg em 26\/08, 82,4 kg em 12\/09 — queda de 1,8 kg\. Meta: 80 kg\."><div style="height:180px" class="w-full" aria-hidden="true">/,
    );
    const barras = renderToStaticMarkup(
      createElement(GraficoBarras, {
        titulo: "Volume por semana",
        dados: [
          { rotulo: "07/09", valor: 1200 },
          { rotulo: "14/09", valor: 1500 },
        ],
        x: "rotulo",
        sufixo: " kg",
        series: [{ chave: "valor", nome: "Volume" }],
      }),
    );
    expect(barras).toContain(
      'role="img" class="w-full" aria-label="Volume por semana. Volume: 1.200 kg em 07/09, 1.500 kg em 14/09 — alta de 300 kg."',
    );
    expect(barras).toContain('aria-hidden="true"');
  });

  it("os gráficos desligam a camada de acessibilidade do Recharts (sem role=application)", () => {
    const fonte = readFileSync(join(process.cwd(), "components/graficos/grafico.tsx"), "utf8");
    // um LineChart e um BarChart, os dois com a camada desligada
    expect(fonte.match(/accessibilityLayer=\{false\}/g)?.length).toBe(2);
    expect(fonte).toMatch(/<LineChart[\s\S]*?accessibilityLayer=\{false\}[\s\S]*?>/);
    expect(fonte).toMatch(/<BarChart[\s\S]*?accessibilityLayer=\{false\}[\s\S]*?>/);
  });
});

/* ------------------------------------------------------------ item 3 */

describe("§22.19 item 3 — a régua do peso, a média e a variação", () => {
  it("82,4–84,2 kg: de 82 a 86, de 2 em 2", () => {
    expect(reguaDoPeso(PESOS)).toEqual({ dominio: [82, 86], ticks: [82, 84, 86] });
  });

  it("um valor só abre um passo para cada lado quando cai no múltiplo", () => {
    expect(reguaDoPeso([{ data: "2026-09-16", peso_kg: 82 }])).toEqual({
      dominio: [80, 84],
      ticks: [80, 82, 84],
    });
    expect(reguaDoPeso([{ data: "2026-09-16", peso_kg: 82.4 }])).toEqual({
      dominio: [82, 84],
      ticks: [82, 84],
    });
  });

  it("a meta entra na régua (fica dentro do gráfico)", () => {
    expect(reguaDoPeso(PESOS, 88)).toEqual({ dominio: [82, 88], ticks: [82, 84, 86, 88] });
    expect(reguaDoPeso(PESOS, 81)).toEqual({ dominio: [80, 86], ticks: [80, 82, 84, 86] });
  });

  it("a meta no piso abre um passo para baixo: a linha dela não se deita no eixo x", () => {
    // 80 seria o piso (e a linha tracejada cairia sobre a do eixo): 78 a 86
    expect(reguaDoPeso(PESOS, 80)).toEqual({
      dominio: [78, 86],
      ticks: [78, 80, 82, 84, 86],
    });
    // o passo a mais passa de 5 intervalos: sobe o passo e a regra vale de novo
    const largo = [
      { data: "2026-09-01", peso_kg: 81 },
      { data: "2026-09-10", peso_kg: 89.9 },
    ];
    expect(reguaDoPeso(largo, 80)).toEqual({ dominio: [75, 90], ticks: [75, 80, 85, 90] });
    // uma pesagem no piso não abre nada (só a meta)
    expect(reguaDoEixo([80, 84])).toEqual({ dominio: [80, 84], ticks: [80, 82, 84] });
    // a meta no teto não muda nada
    expect(reguaDoPeso(PESOS, 86)).toEqual({ dominio: [82, 86], ticks: [82, 84, 86] });
  });

  it("o limiar de 5 intervalos: 72–82 fica no passo 2; 70–82 (6 intervalos) sobe para 5", () => {
    expect(reguaDoEixo([72, 82])).toEqual({
      dominio: [72, 82],
      ticks: [72, 74, 76, 78, 80, 82],
    });
    expect(reguaDoEixo([70, 82])).toEqual({ dominio: [70, 85], ticks: [70, 75, 80, 85] });
    // uma meta 10 kg abaixo do peso (82 → 72) cabe no passo 2 com 5 intervalos
    expect(reguaDoPeso([{ data: "2026-09-16", peso_kg: 82 }], 72.5)).toEqual({
      dominio: [72, 82],
      ticks: [72, 74, 76, 78, 80, 82],
    });
  });

  it("a média de 7 dias do gráfico vai com 1 casa, como o peso", () => {
    const tres = [
      { data: "2026-09-14", peso_kg: 81.9 },
      { data: "2026-09-15", peso_kg: 82 },
      { data: "2026-09-16", peso_kg: 82 },
    ];
    // mediaMovel guarda centésimos (81,97); o gráfico e a leitura, 1 casa
    expect(mediaMovel(tres).map((p) => p.media)).toEqual([81.9, 81.95, 81.97]);
    const pontos = pontosDoGraficoDoPeso(tres);
    expect(pontos.map((p) => p.media)).toEqual([81.9, 82, 82]);
    expect(pontos.map((p) => p.peso)).toEqual([81.9, 82, 82]);
    expect(
      leituraDoGrafico({
        titulo: "Peso por data, com a média de 7 dias",
        dados: pontos,
        x: "rotulo",
        series: [{ chave: "media", nome: "Média de 7 dias" }],
        sufixo: " kg",
      }),
    ).toBe(
      "Peso por data, com a média de 7 dias. Média de 7 dias: 81,9 kg em 14/09, 82 kg em 15/09, 82 kg em 16/09 — alta de 0,1 kg.",
    );
  });

  it("faixa larga sobe o passo para caber (≤ 5 intervalos)", () => {
    expect(reguaDoEixo([70, 83])).toEqual({ dominio: [70, 85], ticks: [70, 75, 80, 85] });
    expect(reguaDoEixo([60, 99])).toEqual({ dominio: [60, 100], ticks: [60, 70, 80, 90, 100] });
    for (const [a, b] of [
      [81, 83],
      [70, 90],
      [50, 120],
      [45.5, 46.1],
      [140, 141],
    ] as const) {
      const r = reguaDoEixo([a, b]);
      expect(r, `${a}–${b}`).not.toBeNull();
      if (!r) continue;
      expect(r.dominio[0]).toBeLessThanOrEqual(a);
      expect(r.dominio[1]).toBeGreaterThanOrEqual(b);
      expect(r.ticks.length - 1).toBeLessThanOrEqual(5);
      expect(r.ticks[0]).toBe(r.dominio[0]);
      expect(r.ticks[r.ticks.length - 1]).toBe(r.dominio[1]);
    }
  });

  it("sem pesagem não há régua", () => {
    expect(reguaDoPeso([])).toBeNull();
    expect(reguaDoPeso([], 80)).toBeNull();
    expect(reguaDoEixo([Number.NaN])).toBeNull();
  });

  it("a média de 7 dias não muda a régua: Corpo e Relatório têm o mesmo eixo", () => {
    for (const linhas of [PESOS, TRINTA]) {
      const comMedia = reguaDoEixo(mediaMovel(linhas).flatMap((p) => [p.peso, p.media]));
      expect(comMedia).toEqual(reguaDoPeso(linhas));
    }
  });

  it("a média só entra com duas pesagens a até 6 dias uma da outra", () => {
    expect(seriesDoPeso(PESOS)).toEqual(["peso"]);
    expect(seriesDoPeso(TRINTA)).toEqual(["peso", "media"]);
    expect(seriesDoPeso([{ data: "2026-09-16", peso_kg: 82 }])).toEqual(["peso"]);
    expect(
      seriesDoPeso([
        { data: "2026-09-10", peso_kg: 82 },
        { data: "2026-09-16", peso_kg: 81.6 },
      ]),
    ).toEqual(["peso", "media"]);
    expect(
      mediaTemPontos([
        { data: "2026-09-09", peso_kg: 82 },
        { data: "2026-09-16", peso_kg: 81.6 },
      ]),
    ).toBe(false);
    // duas pesagens no MESMO dia são uma só (a última vale)
    expect(
      seriesDoPeso([
        { data: "2026-09-16", peso_kg: 82 },
        { data: "2026-09-16", peso_kg: 81.6 },
      ]),
    ).toEqual(["peso"]);
  });

  it("'média só com ponto próprio' é o mesmo que a média diferir de uma cópia do peso", () => {
    // com as pesagens espaçadas, cada média é o próprio peso
    expect(mediaMovel(PESOS).every((p) => p.media === p.peso)).toBe(true);
  });

  it("a variação do período: '−1,8 kg desde 12/08'", () => {
    expect(textoDaVariacao(PESOS)).toBe("−1,8 kg desde 12/08");
    expect(variacaoDoPeriodo(PESOS)).toEqual({ variacao: -1.8, desde: "2026-08-12" });
    expect(
      textoDaVariacao([
        { data: "2026-09-12", peso_kg: 82.4 },
        { data: "2026-08-12", peso_kg: 81.8 },
      ]),
    ).toBe("+0,6 kg desde 12/08");
    expect(
      textoDaVariacao([
        { data: "2026-08-12", peso_kg: 82 },
        { data: "2026-09-12", peso_kg: 82 },
      ]),
    ).toBe("mesmo peso desde 12/08");
    expect(textoDaVariacao([{ data: "2026-08-12", peso_kg: 82 }])).toBeNull();
    expect(textoDaVariacao([])).toBeNull();
    expect(pontosDePeso(PESOS)).toHaveLength(3);
  });
});

/* ------------------------------------------------------------ item 4 */

/** O texto de um arquivo .tsx sem os comentários (só o que vai para a tela). */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("§22.19 item 4 — ninguém orienta por 'embaixo' no Corpo", () => {
  it("nenhum texto de components/corpo/ diz 'embaixo'", () => {
    const pasta = join(process.cwd(), "components/corpo");
    for (const arquivo of readdirSync(pasta)) {
      const fonte = semComentarios(readFileSync(join(pasta, arquivo), "utf8"));
      expect(fonte, arquivo).not.toMatch(/embaixo/i);
    }
  });

  it("a aba Peso tem o link 'Definir uma meta' para o campo da meta", () => {
    const fonte = readFileSync(join(process.cwd(), "components/corpo/aba-peso.tsx"), "utf8");
    expect(fonte).toContain('href="#peso-meta"');
    expect(fonte).toContain("Definir uma meta");
    expect(fonte).toContain('id="peso-meta"');
  });
});

/* ------------------------------------------------------------ item 5 */

describe("§22.19 item 5 — a faixa do IMC em texto", () => {
  it("quatro trechos na ordem, somando a barra inteira", () => {
    const trechos = faixasDaBarra(null);
    expect(trechos.map((t) => t.rotulo)).toEqual(["abaixo", "saudável", "sobrepeso", "obesidade"]);
    expect(trechos.reduce((s, t) => s + t.largura, 0)).toBeCloseTo(1, 10);
    expect(trechos.map((t) => Math.round(t.largura * 100))).toEqual([14, 26, 20, 40]);
    expect(trechos.some((t) => t.atual)).toBe(false);
  });

  it.each([
    [12, "abaixo"],
    [15, "abaixo"],
    [18.4, "abaixo"],
    [18.5, "saudavel"],
    [22.8, "saudavel"],
    [24.9, "saudavel"],
    [25, "sobrepeso"],
    [29.9, "sobrepeso"],
    [30, "obesidade"],
    [34.9, "obesidade"],
    [35, "obesidade"],
    [45, "obesidade"],
  ])("IMC %s → '%s' aceso, só ele", (valor, chave) => {
    const acesos = faixasDaBarra(valor).filter((t) => t.atual);
    expect(acesos.map((t) => t.chave)).toEqual([chave]);
  });

  it("o card desenha os quatro rótulos, o atual aceso, e o marcador fino", () => {
    // 82,4 kg e 190 cm → 22,8, saudável (as capturas)
    const html = renderToStaticMarkup(
      createElement(CardImc, { pesoKg: 82.4, alturaCm: 190 }),
    );
    expect(html).toContain("22,8");
    for (const rotulo of ["abaixo", "saudável", "sobrepeso", "obesidade"]) {
      expect(html).toContain(`>${rotulo}</span>`);
    }
    expect(html).toMatch(/data-trecho="saudavel" data-atual=""[^>]*class="[^"]*font-semibold/);
    expect(html.match(/data-atual=""/g)).toHaveLength(1);
    // o marcador: triângulo + traço, não o círculo de antes
    expect(html).toContain('data-marcador="imc"');
    expect(html).not.toMatch(/data-marcador="imc"[^>]*rounded-full/);
    // as pontas "15" e "40" deram lugar aos rótulos
    expect(html).not.toMatch(/>15<\/span>|>40<\/span>/);
    expect(html).toContain("<h3");
  });

  it("na aba Peso o título do IMC é h2 (logo abaixo do h1 'Corpo')", () => {
    const html = renderToStaticMarkup(
      createElement(CardImc, { pesoKg: 82.4, alturaCm: 190, nivel: 2 }),
    );
    expect(html).toContain('<h2 class="text-sm font-semibold">IMC</h2>');
    expect(html).not.toContain("<h3");
  });
});

/* ------------------------------------------------------------ item 6 */

describe("§22.19 item 6 — o campo de data Hoje · Ontem · Outra data", () => {
  it("hoje, ontem e outra, com as datas em dd/mm", () => {
    expect(opcoesDaData("2026-09-24", "2026-09-24")).toEqual({
      hoje: "2026-09-24",
      ontem: "2026-09-23",
      rotuloHoje: "24/09",
      rotuloOntem: "23/09",
      rotuloOutra: null,
      qual: "hoje",
    });
    expect(opcoesDaData("2026-09-24", "2026-09-23").qual).toBe("ontem");
    const outra = opcoesDaData("2026-09-24", "2026-08-16");
    expect(outra.qual).toBe("outra");
    expect(outra.rotuloOutra).toBe("16/08");
  });

  it("vira o mês e o ano", () => {
    expect(opcoesDaData("2026-10-01", "2026-09-30")).toMatchObject({
      ontem: "2026-09-30",
      rotuloOntem: "30/09",
      qual: "ontem",
    });
    expect(opcoesDaData("2027-01-01", "2026-12-31")).toMatchObject({
      ontem: "2026-12-31",
      rotuloOntem: "31/12",
      qual: "ontem",
    });
    // 1º de março depois de fevereiro de 28 dias
    expect(opcoesDaData("2027-03-01", "2027-03-01").ontem).toBe("2027-02-28");
  });

  it("a escolha acompanha o dia: sem toque é hoje, e segue a virada", () => {
    // sem toque: o hoje de agora (não o da montagem)
    expect(dataDaEscolha(null, "2026-09-16")).toBe("2026-09-16");
    expect(dataDaEscolha(null, "2026-09-17")).toBe("2026-09-17");
    // escolher hoje é o mesmo que não tocar
    expect(escolherData("2026-09-16", "2026-09-16")).toBeNull();
    // Ontem tocado em 16/09 vale em 16/09…
    const ontem = escolherData("2026-09-15", "2026-09-16");
    expect(ontem).toEqual({ data: "2026-09-15", em: "2026-09-16" });
    expect(dataDaEscolha(ontem, "2026-09-16")).toBe("2026-09-15");
    // …e, com a tela aberta na virada, volta para hoje (não grava na véspera)
    expect(dataDaEscolha(ontem, "2026-09-17")).toBe("2026-09-17");
    // Outra data, idem
    const outra = escolherData("2026-08-16", "2026-09-16");
    expect(dataDaEscolha(outra, "2026-09-16")).toBe("2026-08-16");
    expect(dataDaEscolha(outra, "2026-09-17")).toBe("2026-09-17");
    // a virada do ano
    expect(dataDaEscolha(escolherData("2026-12-30", "2026-12-31"), "2027-01-01")).toBe(
      "2027-01-01",
    );
    // o botão aceso depois da virada, sem toque: Hoje (não Ontem)
    expect(opcoesDaData("2026-09-17", dataDaEscolha(null, "2026-09-17")).qual).toBe("hoje");
  });

  it("o valor do seletor só vale se for uma data até hoje", () => {
    expect(dataValida("2026-09-24", "2026-09-24")).toBe(true);
    expect(dataValida("2026-08-16", "2026-09-24")).toBe(true);
    expect(dataValida("", "2026-09-24")).toBe(false);
    expect(dataValida("2026-09-25", "2026-09-24")).toBe(false);
    expect(dataValida("16/08/2026", "2026-09-24")).toBe(false);
  });

  it("o componente: grupo 'Data', Hoje aceso, nome estável da 'Outra data'", () => {
    const html = renderToStaticMarkup(
      createElement(CampoData, {
        id: "peso-data",
        valor: "2026-09-24",
        hoje: "2026-09-24",
        aoMudar: () => {},
      }),
    );
    expect(html).toMatch(/^<div role="group" aria-labelledby="[^"]+"/);
    expect(html).toContain(">Data</span>");
    const botoes = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    expect(botoes).toHaveLength(3);
    expect(botoes[0]).toContain('aria-pressed="true"');
    expect(botoes[1]).toContain('aria-pressed="false"');
    expect(botoes[2]).toContain('aria-pressed="false"');
    expect(botoes[2]).toContain('aria-label="Outra data"');
    expect(botoes[2]).toMatch(/aria-describedby="[^"]+"/);
    for (const b of botoes) expect(b).toContain("alvo");
    expect(html).toContain(">24/09</span>");
    expect(html).toContain(">23/09</span>");
    expect(html).toContain("escolher");
    // o seletor do aparelho: escondido, fora do Tab, com max = hoje
    expect(html).toMatch(/<input[^>]*id="peso-data"[^>]*type="date"[^>]*tabindex="-1"[^>]*aria-hidden="true"/);
    expect(html).toMatch(/<input[^>]*max="2026-09-24"/);
    // nenhuma data crua na tela
    expect(html.replace(/<input[^>]*>/g, "")).not.toMatch(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/);
  });

  it("escolhida outra data, o terceiro botão acende e mostra dd/mm", () => {
    const html = renderToStaticMarkup(
      createElement(CampoData, {
        id: "fotos-data",
        valor: "2026-08-16",
        hoje: "2026-09-24",
        aoMudar: () => {},
      }),
    );
    const botoes = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    expect(botoes[0]).toContain('aria-pressed="false"');
    expect(botoes[2]).toContain('aria-pressed="true"');
    expect(html).toContain("16/08");
    expect(html).not.toContain("escolher");
  });

  it("as três abas do Corpo usam o campo novo, sem type=date cru", () => {
    for (const aba of ["aba-peso.tsx", "aba-medidas.tsx", "aba-fotos.tsx"]) {
      const fonte = readFileSync(join(process.cwd(), "components/corpo", aba), "utf8");
      expect(fonte, aba).toContain("<CampoData");
      expect(fonte, aba).not.toContain('type="date"');
    }
  });
});
