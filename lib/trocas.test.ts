import { describe, expect, it } from "vitest";
import { comTrocas, escreverTrocas, lerTrocas } from "@/lib/trocas";

const DATA = "2026-09-15";
const TREINO = "A1";

describe("trocas do dia (SPEC §13.3)", () => {
  it("vai e volta", () => {
    const texto = escreverTrocas(DATA, TREINO, { "supino-reto-com-barra": "flexao-de-braco" });
    expect(texto).not.toBeNull();
    expect(lerTrocas(texto, DATA, TREINO)).toEqual({
      "supino-reto-com-barra": "flexao-de-braco",
    });
  });

  it("a escolha de ontem não vale hoje", () => {
    const texto = escreverTrocas("2026-09-14", TREINO, { a: "b" });
    expect(lerTrocas(texto, DATA, TREINO)).toEqual({});
  });

  it("a escolha de outro treino não vale", () => {
    const texto = escreverTrocas(DATA, "B1", { a: "b" });
    expect(lerTrocas(texto, DATA, TREINO)).toEqual({});
  });

  it("sem troca nenhuma não guarda nada", () => {
    expect(escreverTrocas(DATA, TREINO, {})).toBeNull();
    expect(escreverTrocas(DATA, TREINO, { a: "a" })).toBeNull();
  });

  it("texto estragado no storage não derruba a tela", () => {
    expect(lerTrocas("não é json", DATA, TREINO)).toEqual({});
    expect(lerTrocas("[1,2,3]", DATA, TREINO)).toEqual({});
    expect(lerTrocas(null, DATA, TREINO)).toEqual({});
    expect(
      lerTrocas(JSON.stringify({ data: DATA, treinoId: TREINO, trocas: { a: 7 } }), DATA, TREINO),
    ).toEqual({});
  });

  it("aplica as trocas na ordem da lista", () => {
    expect(comTrocas(["a", "b", "c"], { b: "x" })).toEqual(["a", "x", "c"]);
  });
});
