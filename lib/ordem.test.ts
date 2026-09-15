import { describe, expect, it } from "vitest";
import {
  aplicarOrdem,
  descer,
  ehAOrdemDoPrograma,
  escreverOrdem,
  lerOrdem,
  mover,
  subir,
} from "@/lib/ordem";

const IDS = ["a", "b", "c", "d"];

describe("mover (as setas ↑↓ e as alças, SPEC §14.3)", () => {
  it("leva o item para a posição pedida sem perder ninguém", () => {
    expect(mover(IDS, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(mover(IDS, 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("não mexe quando o destino é o mesmo ou está fora da lista", () => {
    expect(mover(IDS, 1, 1)).toEqual(IDS);
    expect(mover(IDS, -1, 2)).toEqual(IDS);
    expect(mover(IDS, 0, 9)).toEqual(IDS);
    expect(mover([], 0, 1)).toEqual([]);
  });

  it("subir no primeiro e descer no último não fazem nada", () => {
    expect(subir(IDS, 0)).toEqual(IDS);
    expect(descer(IDS, 3)).toEqual(IDS);
    expect(subir(IDS, 2)).toEqual(["a", "c", "b", "d"]);
    expect(descer(IDS, 0)).toEqual(["b", "a", "c", "d"]);
  });
});

describe("aplicar a ordem guardada", () => {
  it("quem está na ordem vem primeiro; quem não está fica no fim", () => {
    expect(aplicarOrdem(IDS, ["c", "a"])).toEqual(["c", "a", "b", "d"]);
  });

  it("ordem vazia é a ordem do programa", () => {
    expect(aplicarOrdem(IDS, [])).toEqual(IDS);
  });

  it("id que saiu do programa é ignorado, e nada se repete", () => {
    expect(aplicarOrdem(IDS, ["z", "d", "d", "a"])).toEqual(["d", "a", "b", "c"]);
    expect(aplicarOrdem(IDS, ["d", "c", "b", "a"])).toHaveLength(4);
  });

  it("reconhece a ordem do programa", () => {
    expect(ehAOrdemDoPrograma(IDS, IDS)).toBe(true);
    expect(ehAOrdemDoPrograma(IDS, [])).toBe(true);
    expect(ehAOrdemDoPrograma(IDS, ["b", "a"])).toBe(false);
  });
});

describe("guardar e ler no aparelho", () => {
  it("só guarda quando a ordem é diferente da do programa", () => {
    expect(escreverOrdem("2026-09-15", "A1", IDS, IDS)).toBeNull();
    expect(escreverOrdem("2026-09-15", "A1", IDS, [])).toBeNull();
    const texto = escreverOrdem("2026-09-15", "A1", IDS, ["c", "a"]);
    expect(texto).not.toBeNull();
    expect(lerOrdem(texto, "2026-09-15", "A1")).toEqual(["c", "a", "b", "d"]);
  });

  it("a ordem vale só para aquele dia e aquele treino", () => {
    const texto = escreverOrdem("2026-09-15", "A1", IDS, ["c", "a"]);
    expect(lerOrdem(texto, "2026-09-16", "A1")).toEqual([]);
    expect(lerOrdem(texto, "2026-09-15", "B1")).toEqual([]);
  });

  it("texto estragado no storage não vira ordem", () => {
    expect(lerOrdem(null, "2026-09-15", "A1")).toEqual([]);
    expect(lerOrdem("{", "2026-09-15", "A1")).toEqual([]);
    expect(lerOrdem("[]", "2026-09-15", "A1")).toEqual([]);
    expect(
      lerOrdem(
        JSON.stringify({ data: "2026-09-15", treinoId: "A1", ordem: [1, "a", ""] }),
        "2026-09-15",
        "A1",
      ),
    ).toEqual(["a"]);
  });
});
