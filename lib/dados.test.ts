import { describe, expect, it } from "vitest";
import {
  acharExercicio,
  acharFase,
  acharTreino,
  cardio,
  caminhoPublico,
  equipamentos,
  exercicioPorId,
  exercicios,
  exerciciosDoTreino,
  perfilInicial,
  programa,
  progressao,
  semanaDeBarraFixa,
  semanaDeCorrida,
  urlFotos,
} from "@/lib/dados";
import {
  cardioSchema,
  equipamentosSchema,
  exerciciosSchema,
  perfilSchema,
  programaSchema,
  progressaoJsonSchema,
} from "@/lib/schemas";

describe("os seis JSON passam pelos schemas", () => {
  it("exercicios.json", () => {
    expect(exerciciosSchema.safeParse(exercicios).success).toBe(true);
    expect(exercicios).toHaveLength(81);
  });
  it("programa.json", () => {
    expect(programaSchema.safeParse(programa).success).toBe(true);
    expect(Object.keys(programa.treinos).sort()).toEqual([
      "A1",
      "B1",
      "IA",
      "IB",
      "SA",
      "SB",
    ]);
  });
  it("cardio.json", () => {
    expect(cardioSchema.safeParse(cardio).success).toBe(true);
    expect(cardio.corrida.semanas).toHaveLength(12);
  });
  it("progressao.json", () => {
    expect(progressaoJsonSchema.safeParse(progressao).success).toBe(true);
  });
  it("equipamentos.json", () => {
    expect(equipamentosSchema.safeParse(equipamentos).success).toBe(true);
  });
  it("perfil.json", () => {
    expect(perfilSchema.safeParse(perfilInicial).success).toBe(true);
  });
});

describe("integridade entre programa e catálogo", () => {
  it("todo exercicio_id do programa existe no catálogo", () => {
    const faltando = Object.values(programa.treinos)
      .flatMap((t) => t.exercicios.map((e) => e.exercicio_id))
      .filter((id) => !exercicioPorId.has(id));
    expect(faltando).toEqual([]);
  });
  it("ids são únicos", () => {
    expect(exercicioPorId.size).toBe(exercicios.length);
  });
});

describe("índices e helpers", () => {
  it("acha exercício, treino e fase", () => {
    expect(acharExercicio("supino-reto-com-barra").grupo).toBe("Peito");
    expect(acharTreino("A1").exercicios.length).toBeGreaterThan(0);
    expect(acharFase("fase1").semana).toHaveLength(7);
  });
  it("erro claro para id desconhecido", () => {
    expect(() => acharExercicio("nao-existe")).toThrow(/desconhecido/);
  });
  it("converte caminho de asset em caminho público", () => {
    expect(caminhoPublico("assets/figuras/x.svg")).toBe("/figuras/x.svg");
    expect(urlFotos(acharExercicio("supino-reto-com-barra"))[0]).toMatch(
      /^\/fotos\//,
    );
  });
  it("junta o item do treino com a ficha do catálogo", () => {
    const lista = exerciciosDoTreino("A1");
    expect(lista[0]?.exercicio.id).toBe(lista[0]?.item.exercicio_id);
  });
  it("prende as semanas dos planos aos limites", () => {
    expect(semanaDeCorrida(0).semana).toBe(1);
    expect(semanaDeCorrida(99).semana).toBe(12);
    expect(semanaDeBarraFixa(1).semanas).toBe("1–2");
    expect(semanaDeBarraFixa(12).semanas).toBe("11–12");
  });
});
