import { describe, expect, it } from "vitest";
import { acharExercicio, acharFase, acharTreino, urlFotos } from "@/lib/dados";
import { urlsDaIlustracao } from "@/lib/midia";
import { exerciciosDaFase, midiaDaFase } from "@/lib/precache-do-programa";

describe("mídia do programa atual (SPEC §8)", () => {
  it("junta os exercícios dos treinos da fase, sem repetir", () => {
    const ids = exerciciosDaFase("fase1");
    expect(new Set(ids).size).toBe(ids.length);

    const esperados = new Set<string>();
    for (const treinoId of acharFase("fase1").treinos) {
      for (const item of acharTreino(treinoId).exercicios) {
        esperados.add(item.exercicio_id);
      }
    }
    expect(new Set(ids)).toEqual(esperados);
  });

  it("as duas fases têm listas diferentes (o aquecimento é por fase)", () => {
    const um = exerciciosDaFase("fase1");
    const dois = exerciciosDaFase("fase2");
    expect(um.length).toBeGreaterThan(0);
    expect(dois.length).toBeGreaterThan(um.length);
  });

  it("a lista são URLs públicas de ilustração, figura e fotos", () => {
    const urls = midiaDaFase("fase1");
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(
        url.startsWith("/ilustracoes/") ||
          url.startsWith("/figuras/") ||
          url.startsWith("/fotos/"),
      ).toBe(true);
    }

    // toda foto de todo exercício da fase está lá
    for (const id of exerciciosDaFase("fase1")) {
      for (const foto of urlFotos(acharExercicio(id))) {
        expect(urls).toContain(foto);
      }
    }
  });

  /**
   * As duas posições da ilustração entram (marco Mídia): sem sinal no terraço,
   * a ficha ainda alterna início e fim do movimento.
   */
  it("as ilustrações da fase entram no aquecimento", () => {
    const urls = midiaDaFase("fase1");
    let alguma = 0;
    for (const id of exerciciosDaFase("fase1")) {
      for (const url of urlsDaIlustracao(id)) {
        expect(urls).toContain(url);
        alguma += 1;
      }
    }
    expect(alguma).toBeGreaterThan(0);
  });

  /** O precache da instalação é o shell + figuras; o resto entra aqui. */
  it("a fase 1 cabe num aquecimento curto", () => {
    expect(midiaDaFase("fase1").length).toBeLessThan(80);
  });
});
