import { describe, expect, it } from "vitest";
import { acharExercicio, acharTreino } from "@/lib/dados";
import { capaDoCardio, capaDoExercicio, capaDoTreino, urlCapa } from "@/lib/capas";

describe("capas e miniaturas (SPEC §13.1)", () => {
  it("a capa do exercício é a foto -1 de assets/", () => {
    const url = capaDoExercicio(acharExercicio("agachamento-livre"));
    expect(url).toBe("/fotos/agachamento-livre-1.jpg");
  });

  it("a capa do treino é a foto do primeiro exercício dele", () => {
    const primeiro = acharTreino("A1").exercicios[0]!.exercicio_id;
    expect(capaDoTreino("A1")).toBe(capaDoExercicio(acharExercicio(primeiro)));
  });

  it("todo treino do programa tem capa", () => {
    for (const id of ["A1", "B1", "SA", "IA", "SB", "IB"] as const) {
      expect(capaDoTreino(id)).toMatch(/^\/fotos\/.+-1\.jpg$/);
    }
  });

  it("a corda tem foto de capa; corrida e caminhada ficam sem foto", () => {
    expect(capaDoCardio("corda")).toBe("/fotos/corrida-no-lugar-com-a-corda-1.jpg");
    expect(capaDoCardio("corrida")).toBeNull();
    expect(capaDoCardio("caminhada")).toBeNull();
  });
});

describe("derivada da capa (SPEC §22.4 item 1)", () => {
  it("a foto -1 vira a capa de 720×360 em WebP", () => {
    expect(urlCapa("/fotos/agachamento-livre-1.jpg")).toBe(
      "/fotos/agachamento-livre-1-capa.webp",
    );
  });

  it("toda capa do programa tem derivada", () => {
    for (const id of ["A1", "B1", "SA", "IA", "SB", "IB"] as const) {
      expect(urlCapa(capaDoTreino(id))).toMatch(/^\/fotos\/.+-1-capa\.webp$/);
    }
    expect(urlCapa(capaDoCardio("corda"))).toBe(
      "/fotos/corrida-no-lugar-com-a-corda-1-capa.webp",
    );
  });

  it("o que não é foto de capa fica sem derivada — o cartão usa o original", () => {
    expect(urlCapa(null)).toBeNull();
    expect(urlCapa(capaDoCardio("corrida"))).toBeNull();
    // a segunda foto do exercício nunca vira capa
    expect(urlCapa("/fotos/agachamento-livre-2.jpg")).toBeNull();
    expect(urlCapa("/figuras/agachamento-livre.svg")).toBeNull();
    expect(urlCapa("/ilustracoes/supino-reto-com-barra-1.svg")).toBeNull();
  });

  it("não inventa derivada em cima de derivada", () => {
    expect(urlCapa("/fotos/agachamento-livre-1-capa.webp")).toBeNull();
  });
});
