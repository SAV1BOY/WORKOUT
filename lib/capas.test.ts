import { describe, expect, it } from "vitest";
import { acharExercicio, acharTreino, exercicios } from "@/lib/dados";
import {
  capaDoCardio,
  capaDoExercicio,
  capaDoTreino,
  miniaturaDoExercicio,
} from "@/lib/capas";

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

  it("a miniatura traz figura e foto do JSON", () => {
    const m = miniaturaDoExercicio("agachamento-livre");
    expect(m.figura).toBe("/figuras/agachamento-livre.svg");
    expect(m.foto).toBe("/fotos/agachamento-livre-1.jpg");
    expect(m.alt).toBe(acharExercicio("agachamento-livre").nome);
  });

  it("todo exercício do catálogo tem figura ou foto para a miniatura", () => {
    for (const e of exercicios) {
      const m = miniaturaDoExercicio(e.id);
      expect(m.figura ?? m.foto).not.toBeNull();
    }
  });

  it("a corda tem foto de capa; corrida e caminhada ficam sem foto", () => {
    expect(capaDoCardio("corda")).toBe("/fotos/corrida-no-lugar-com-a-corda-1.jpg");
    expect(capaDoCardio("corrida")).toBeNull();
    expect(capaDoCardio("caminhada")).toBeNull();
  });
});
