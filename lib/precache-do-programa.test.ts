import { describe, expect, it } from "vitest";
import { fonteComReserva } from "@/components/ui/imagem";
import { capaDoTreino, urlCapa } from "@/lib/capas";
import {
  acharExercicio,
  acharFase,
  acharTreino,
  exercicios,
  urlFigura,
  urlFotos,
} from "@/lib/dados";
import { midiaDaMiniatura, urlMiniatura, urlWebp, urlsDaIlustracao } from "@/lib/midia";
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
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(
        url.startsWith("/ilustracoes/") ||
          url.startsWith("/figuras/") ||
          url.startsWith("/fotos/"),
      ).toBe(true);
    }
  });

  /**
   * O ponto do lote 4 (auditoria): desde as derivadas do prebuild (SPEC §22.4
   * item 1) a tela não pede mais o arquivo do kit. Aquecer o JPEG original
   * deixaria a lista de hoje sem miniatura justamente sem rede. Por isso a
   * lista esperada aqui é montada com as mesmas funções dos componentes —
   * `fonteComReserva`, `urlCapa`, `urlMiniatura`, `urlWebp`.
   */
  function oQueAsTelasPedem(fase: "fase1" | "fase2"): string[] {
    const urls: string[] = [];
    const juntar = (url: string | null | undefined) => {
      if (url && !urls.includes(url)) urls.push(url);
    };

    // components/ui/card-capa.tsx, nos cartões de treinar/tela-treinar.tsx
    for (const treinoId of acharFase(fase).treinos) {
      const foto = capaDoTreino(treinoId);
      if (foto) juntar(fonteComReserva(foto, urlCapa(foto)).src);
    }

    for (const id of exerciciosDaFase(fase)) {
      const exercicio = acharExercicio(id);

      // components/ui/miniatura.tsx
      const { url, mini } = midiaDaMiniatura(id);
      if (url) juntar(fonteComReserva(url, mini).src);

      // components/exercicio/ilustracao-alternada.tsx e media-grande.tsx
      for (const ilustracao of urlsDaIlustracao(id)) juntar(ilustracao);
      juntar(urlFigura(exercicio));

      // components/exercicios/fotos-ampliaveis.tsx e foto-ampliada.tsx
      for (const foto of urlFotos(exercicio)) {
        juntar(fonteComReserva(foto, urlWebp(foto)).src);
      }
    }
    return urls;
  }

  it.each(["fase1", "fase2"] as const)(
    "%s: a lista do aquecimento é a que as telas montam",
    (fase) => {
      expect(midiaDaFase(fase)).toEqual(oQueAsTelasPedem(fase));
    },
  );

  /**
   * Um exercício de cada tipo de mídia (foto, ilustração, figura): o degrau da
   * miniatura é o mesmo dos componentes, e o da ficha também. As duas fases
   * cobrem ilustração e figura; a miniatura de foto só existe fora do
   * programa, e por isso é conferida no catálogo.
   */
  it("o degrau é o mesmo dos componentes nos três tipos de mídia", () => {
    const tipos = ["ilustracao", "figura", "foto"] as const;
    for (const tipo of tipos) {
      const id = exercicios.map((e) => e.id).find((e) => midiaDaMiniatura(e).tipo === tipo);
      expect(id, `nenhum exercício com miniatura de ${tipo}`).toBeTruthy();

      const { url, mini } = midiaDaMiniatura(id!);
      const pedida = fonteComReserva(url!, mini).src;
      // foto e ilustração têm derivada de 112 px; a figura é o SVG animado
      expect(pedida, `${tipo}: ${pedida}`).toBe(
        tipo === "figura" ? url : urlMiniatura(url),
      );

      // e a ficha pede o WebP das duas fotos de execução
      for (const foto of urlFotos(acharExercicio(id!))) {
        expect(fonteComReserva(foto, urlWebp(foto)).src).toMatch(/^\/fotos\/.+\.webp$/);
      }
    }
  });

  it("não baixa nenhum original que a tela não pede", () => {
    const urls = midiaDaFase("fase1");
    // toda foto de `/fotos` tem derivada: nenhum JPEG do kit deve entrar
    expect(urls.filter((u) => /\.jpe?g$/i.test(u))).toEqual([]);
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
    expect(midiaDaFase("fase1").length).toBeLessThan(90);
  });
});
