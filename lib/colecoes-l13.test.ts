import { describe, expect, it } from "vitest";
import { cardio } from "@/lib/dados";
import {
  planos,
  semanaDoPerfilNoPlano,
  semanasDoPlano,
  type PlanoId,
} from "@/lib/colecoes";

describe("semanasDoPlano (SPEC §22.13 item 9)", () => {
  it("corrida na semana 3: 12 linhas, 2 feitas, a 3ª atual, descrição do JSON", () => {
    const linhas = semanasDoPlano("corrida", 3);
    expect(linhas).toHaveLength(12);
    expect(linhas.filter((l) => l.estado === "feita")).toHaveLength(2);
    expect(linhas[2]!.estado).toBe("atual");
    expect(linhas.filter((l) => l.estado === "atual")).toHaveLength(1);
    expect(linhas.slice(3).every((l) => l.estado === "a-fazer")).toBe(true);
    linhas.forEach((l, i) => {
      expect(l.descricao).toBe(cardio.corrida.semanas[i]!.descricao);
      expect(l.rotulo).toBe(`Semana ${cardio.corrida.semanas[i]!.semana}`);
    });
  });

  it("corda por estágios: a semana 5 cai no estágio 5–6, os dois antes feitos", () => {
    const linhas = semanasDoPlano("corda", 5);
    expect(linhas).toHaveLength(cardio.corda.semanas.length);
    expect(linhas.map((l) => l.rotulo)).toEqual(
      cardio.corda.semanas.map((s) => `Semanas ${s.semanas}`),
    );
    expect(linhas.map((l) => l.estado)).toEqual([
      "feita",
      "feita",
      "atual",
      "a-fazer",
      "a-fazer",
    ]);
    // os números do estágio saem do JSON
    const s = cardio.corda.semanas[2]!;
    expect(linhas[2]!.descricao).toContain(`${s.blocos} blocos de ${s.bloco_s} s`);
    expect(linhas[2]!.descricao).toContain(`${s.descanso_s} s de descanso`);
  });

  it("barra fixa: séries por sessão e assistência do JSON", () => {
    const linhas = semanasDoPlano("barra_fixa", 1);
    expect(linhas).toHaveLength(cardio.barra_fixa.semanas.length);
    linhas.forEach((l, i) => {
      const s = cardio.barra_fixa.semanas[i]!;
      expect(l.descricao).toBe(`${s.por_sessao} por sessão · ${s.assistencia}`);
    });
    expect(linhas[0]!.estado).toBe("atual");
    expect(linhas.slice(1).every((l) => l.estado === "a-fazer")).toBe(true);
  });

  it("uma linha atual só, com a semana presa ao plano, em todo plano e toda semana", () => {
    for (const plano of ["corrida", "corda", "barra_fixa"] as PlanoId[]) {
      const total = planos().find((p) => p.id === plano)!.semanas;
      for (let semana = -1; semana <= total + 3; semana += 1) {
        const linhas = semanasDoPlano(plano, semana);
        expect(linhas.filter((l) => l.estado === "atual")).toHaveLength(1);
        // as faixas cobrem o plano sem buraco: da 1 ao total
        expect(linhas[0]!.de).toBe(1);
        expect(linhas.at(-1)!.ate).toBe(total);
      }
    }
    // a semana 99 do plano de 12 é a 12: nada "a fazer"
    const fim = semanasDoPlano("corrida", 99);
    expect(fim.at(-1)!.estado).toBe("atual");
    expect(fim.filter((l) => l.estado === "a-fazer")).toHaveLength(0);
  });

  it("sem perfil, a lista vem sem estado", () => {
    expect(semanasDoPlano("corrida", null).every((l) => l.estado === null)).toBe(true);
    expect(semanasDoPlano("corda", Number.NaN).every((l) => l.estado === null)).toBe(true);
  });

  it("a semana do perfil é a do plano certo", () => {
    const perfil = { semana_corrida: 3, semana_corda: 5, semana_fixa: 7 };
    expect(semanaDoPerfilNoPlano("corrida", perfil)).toBe(3);
    expect(semanaDoPerfilNoPlano("corda", perfil)).toBe(5);
    expect(semanaDoPerfilNoPlano("barra_fixa", perfil)).toBe(7);
    expect(semanaDoPerfilNoPlano("corrida", null)).toBeNull();
  });
});
