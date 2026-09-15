import { describe, expect, it } from "vitest";
import {
  dominioFolgado,
  ANGULOS,
  MEDIDAS,
  angulosEmComum,
  caminhoDaFoto,
  diasDesdeAPesagem,
  dimensoesReduzidas,
  faltaParaMeta,
  fotosPorData,
  mediaMovel,
  medidasPorData,
  metaDePeso,
  parDeComparacao,
  pontosDePeso,
  serieDeMedida,
  ultimoPeso,
  variacaoDaMedida,
  variacaoPorSemana,
  type FotoBruta,
  type MedidasBrutas,
  type PesoBruto,
} from "@/lib/corpo";

const pesos: PesoBruto[] = [
  { data: "2026-09-14", peso_kg: 80 },
  { data: "2026-09-15", peso_kg: 81 },
  { data: "2026-09-16", peso_kg: 79 },
];

describe("peso", () => {
  it("uma pesagem por dia, a última vence, em ordem de data", () => {
    const pontos = pontosDePeso([
      { data: "2026-09-15", peso_kg: 81 },
      { data: "2026-09-14", peso_kg: 80 },
      { data: "2026-09-15", peso_kg: 82 },
    ]);
    expect(pontos).toEqual([
      { data: "2026-09-14", peso: 80 },
      { data: "2026-09-15", peso: 82 },
    ]);
  });

  it("média móvel de 7 dias de calendário", () => {
    const pontos = mediaMovel(pesos);
    expect(pontos[0]).toMatchObject({ data: "2026-09-14", peso: 80, media: 80 });
    expect(pontos[1]?.media).toBe(80.5);
    expect(pontos[2]?.media).toBe(80);
  });

  it("a pesagem velha sai da janela dos 7 dias", () => {
    const pontos = mediaMovel([
      { data: "2026-09-01", peso_kg: 90 },
      { data: "2026-09-16", peso_kg: 80 },
    ]);
    expect(pontos[1]?.media).toBe(80);
  });

  it("um ponto só: a média é o próprio peso (gráfico com 1 ponto)", () => {
    expect(mediaMovel([{ data: "2026-09-14", peso_kg: 80 }])).toEqual([
      { data: "2026-09-14", rotulo: "14/09", peso: 80, media: 80 },
    ]);
  });

  it("variação por semana usa o último peso de cada semana civil", () => {
    const semanas = variacaoPorSemana([
      { data: "2026-09-07", peso_kg: 82 },
      { data: "2026-09-11", peso_kg: 81.5 },
      { data: "2026-09-14", peso_kg: 81 },
      { data: "2026-09-16", peso_kg: 80.2 },
    ]);
    expect(semanas).toEqual([
      { inicio: "2026-09-07", rotulo: "07/09", peso: 81.5, variacao: null },
      { inicio: "2026-09-14", rotulo: "14/09", peso: 80.2, variacao: -1.3 },
    ]);
  });

  it("último peso, meta e dias desde a pesagem", () => {
    expect(ultimoPeso(pesos)).toEqual({ data: "2026-09-16", peso: 79 });
    expect(ultimoPeso([])).toBeNull();
    expect(metaDePeso({ meta_peso: 75 })).toBe(75);
    expect(metaDePeso({ meta_peso: 0 })).toBeNull();
    expect(metaDePeso({})).toBeNull();
    expect(faltaParaMeta(79, 75)).toBe(4);
    expect(faltaParaMeta(null, 75)).toBeNull();
    expect(diasDesdeAPesagem(pesos, "2026-09-20")).toBe(4);
    expect(diasDesdeAPesagem([], "2026-09-20")).toBeNull();
  });
});

describe("medidas", () => {
  const linhas: MedidasBrutas[] = [
    {
      data: "2026-09-14",
      cintura_cm: 90,
      peito_cm: 100,
      quadril_cm: null,
      braco_dir_cm: 35,
      braco_esq_cm: null,
      coxa_dir_cm: null,
      coxa_esq_cm: null,
      panturrilha_cm: null,
    },
    {
      data: "2026-10-14",
      cintura_cm: 88,
      peito_cm: null,
      quadril_cm: null,
      braco_dir_cm: 36,
      braco_esq_cm: null,
      coxa_dir_cm: null,
      coxa_esq_cm: null,
      panturrilha_cm: null,
    },
  ];

  it("são os 8 campos do schema", () => {
    expect(MEDIDAS).toHaveLength(8);
    expect(MEDIDAS.map((m) => m.campo)).toContain("panturrilha_cm");
  });

  it("a série de uma medida pula os dias em branco", () => {
    expect(serieDeMedida(linhas, "peito_cm")).toEqual([
      { data: "2026-09-14", rotulo: "14/09", valor: 100 },
    ]);
    expect(serieDeMedida(linhas, "cintura_cm").map((p) => p.valor)).toEqual([90, 88]);
  });

  it("a tabela vem da mais nova para a mais antiga", () => {
    expect(medidasPorData(linhas).map((l) => l.data)).toEqual(["2026-10-14", "2026-09-14"]);
  });

  it("variação entre os dois últimos registros", () => {
    expect(variacaoDaMedida(linhas, "cintura_cm")).toBe(-2);
    expect(variacaoDaMedida(linhas, "peito_cm")).toBeNull();
  });
});

describe("fotos", () => {
  const fotos: FotoBruta[] = [
    { id: "1", data: "2026-09-14", angulo: "frente", storage_path: "u/2026-09-14-frente.jpg" },
    { id: "2", data: "2026-09-14", angulo: "lado", storage_path: "u/2026-09-14-lado.jpg" },
    { id: "3", data: "2026-10-14", angulo: "frente", storage_path: "u/2026-10-14-frente.jpg" },
  ];

  it("o caminho segue a policy do bucket", () => {
    expect(caminhoDaFoto("abc", "2026-09-14", "costas")).toBe("abc/2026-09-14-costas.jpg");
  });

  it("agrupa por data, da mais nova para a mais antiga", () => {
    const dias = fotosPorData(fotos);
    expect(dias.map((d) => d.data)).toEqual(["2026-10-14", "2026-09-14"]);
    expect(dias[1]?.quantas).toBe(2);
    expect(dias[1]?.fotos.costas).toBeNull();
    expect(ANGULOS).toEqual(["frente", "lado", "costas"]);
  });

  it("a comparação abre na mais antiga e na mais nova", () => {
    const dias = fotosPorData(fotos);
    expect(parDeComparacao(dias)).toEqual({ antes: "2026-09-14", depois: "2026-10-14" });
    expect(parDeComparacao([])).toEqual({ antes: null, depois: null });
  });

  it("o slider só oferece os ângulos que as duas datas têm", () => {
    const dias = fotosPorData(fotos);
    expect(angulosEmComum(dias[0] ?? null, dias[1] ?? null)).toEqual(["frente"]);
    expect(angulosEmComum(dias[0] ?? null, null)).toEqual([]);
  });
});

describe("dimensoesReduzidas", () => {
  it("cabe em 1600 px no maior lado", () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1600, altura: 1200 });
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 1200, altura: 1600 });
  });

  it("foto pequena não é ampliada", () => {
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
  });

  it("nunca devolve zero", () => {
    expect(dimensoesReduzidas(1, 4000)).toEqual({ largura: 1, altura: 1600 });
  });
});

describe("dominioFolgado — o eixo y das linhas (SPEC §3.8)", () => {
  it("sem ponto nenhum deixa o Recharts decidir", () => {
    expect(dominioFolgado([])).toEqual(["auto", "auto"]);
    expect(dominioFolgado([Number.NaN, Number.POSITIVE_INFINITY])).toEqual([
      "auto",
      "auto",
    ]);
  });

  it("com um ponto só cerca esse ponto", () => {
    expect(dominioFolgado([82.4])).toEqual([81, 84]);
  });

  it("com dois pontos cerca os dois", () => {
    expect(dominioFolgado([82.4, 81.1])).toEqual([80, 84]);
  });

  /* O defeito: 30 pesagens entre 81 e 83 num eixo de 0 a 100. */
  it("com 30 pesagens o eixo fica na faixa, não no zero", () => {
    const pesos = Array.from({ length: 30 }, (_, i) => 81 + (i % 21) / 10);
    const [min, max] = dominioFolgado(pesos);
    expect(min).toBe(80);
    expect(max).toBe(84);
    expect(min).toBeGreaterThanOrEqual(70);
  });

  it("a folga é escolhida por quem chama (2 cm nas medidas)", () => {
    expect(dominioFolgado([88, 91.5], 2)).toEqual([86, 94]);
  });
});
