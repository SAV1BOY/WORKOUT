import { describe, expect, it } from "vitest";
import { acharExercicio, exercicios } from "@/lib/dados";
import {
  NOME_DA_DIFICULDADE,
  dificuldadeDaColecao,
  dificuldadeDe,
} from "@/lib/dificuldade";

describe("dificuldadeDe (SPEC §13.4)", () => {
  it("composto pesado dá 3 raios", () => {
    expect(dificuldadeDe(acharExercicio("agachamento-livre"))).toBe(3);
  });

  it("composto moderado dá 2 raios", () => {
    const e = exercicios.find((x) => x.categoria === "composto_moderado");
    expect(e && dificuldadeDe(e)).toBe(2);
  });

  it("isolamento e core dão 1 raio", () => {
    const iso = exercicios.find((x) => x.categoria === "isolamento");
    const core = exercicios.find((x) => x.categoria === "core_peso_corporal");
    expect(iso && dificuldadeDe(iso)).toBe(1);
    expect(core && dificuldadeDe(core)).toBe(1);
  });

  it("todo exercício do catálogo tem 1, 2 ou 3 raios", () => {
    for (const e of exercicios) {
      expect([1, 2, 3]).toContain(dificuldadeDe(e));
    }
  });

  it("a coleção mostra a maior dificuldade", () => {
    const colecao = [
      acharExercicio("agachamento-livre"),
      exercicios.find((x) => x.categoria === "isolamento")!,
    ];
    expect(dificuldadeDaColecao(colecao)).toBe(3);
    expect(dificuldadeDaColecao([])).toBeNull();
  });

  it("cada raio tem um nome em pt-BR", () => {
    expect(NOME_DA_DIFICULDADE[1]).toBe("leve");
    expect(NOME_DA_DIFICULDADE[3]).toBe("pesado");
  });
});
