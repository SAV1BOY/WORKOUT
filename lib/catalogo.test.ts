import { describe, expect, it } from "vitest";
import {
  FILTROS_VAZIOS,
  chipsDosFiltros,
  filtrarExercicios,
  quantosFiltrosLigados,
  rotuloDoVerResultados,
  semFiltrosDaFolha,
  semOFiltro,
  idsDoPrograma,
  itemDoCatalogo,
  opcoesDoCatalogo,
  semAcento,
  temFiltro,
  treinosDoExercicio,
} from "@/lib/catalogo";
import { exercicios, programa } from "@/lib/dados";

describe("semAcento", () => {
  it("tira acento e caixa", () => {
    expect(semAcento("Tríceps na Polia")).toBe("triceps na polia");
    expect(semAcento("  AGACHAMENTO  ")).toBe("agachamento");
    expect(semAcento("Rosca direta com barra W")).toBe("rosca direta com barra w");
  });
});

describe("filtrarExercicios", () => {
  it("sem filtro devolve os 81", () => {
    expect(filtrarExercicios(exercicios, FILTROS_VAZIOS)).toHaveLength(81);
    expect(temFiltro(FILTROS_VAZIOS)).toBe(false);
  });

  it("busca sem acento acha o exercício acentuado", () => {
    const achados = filtrarExercicios(exercicios, { busca: "triceps" });
    expect(achados.length).toBeGreaterThan(0);
    expect(achados.every((e) => semAcento(e.nome).includes("triceps"))).toBe(true);
  });

  it("busca com várias palavras exige todas", () => {
    const achados = filtrarExercicios(exercicios, { busca: "supino reto" });
    expect(achados.map((e) => e.id)).toContain("supino-reto-com-barra");
    expect(achados.every((e) => semAcento(e.nome).includes("supino"))).toBe(true);
    expect(filtrarExercicios(exercicios, { busca: "supino agachamento" })).toHaveLength(0);
  });

  it("filtra por grupo, equipamento e implemento", () => {
    const peito = filtrarExercicios(exercicios, { grupo: "Peito" });
    expect(peito.length).toBeGreaterThan(0);
    expect(peito.every((e) => e.grupo === "Peito")).toBe(true);

    const halteres = filtrarExercicios(exercicios, { implemento: "halteres" });
    expect(halteres.every((e) => e.implemento === "halteres")).toBe(true);

    const banco = filtrarExercicios(exercicios, { equipamento: "banco" });
    expect(banco.every((e) => e.equipamento.includes("banco"))).toBe(true);
  });

  it("os filtros se somam", () => {
    const achados = filtrarExercicios(exercicios, {
      grupo: "Costas",
      implemento: "barra_fixa",
    });
    expect(achados.every((e) => e.grupo === "Costas" && e.implemento === "barra_fixa")).toBe(
      true,
    );
  });

  it('"está no meu programa" reduz para os ids de programa.json', () => {
    const doPrograma = idsDoPrograma();
    const achados = filtrarExercicios(exercicios, { soPrograma: true });
    expect(achados).toHaveLength(doPrograma.size);
    expect(achados.every((e) => doPrograma.has(e.id))).toBe(true);
    expect(achados.length).toBeLessThan(exercicios.length);
  });
});

describe("idsDoPrograma", () => {
  it("bate com os exercícios dos treinos das duas fases", () => {
    const ids = idsDoPrograma();
    const esperados = new Set(
      Object.values(programa.treinos).flatMap((t) => t.exercicios.map((e) => e.exercicio_id)),
    );
    expect([...ids].sort()).toEqual([...esperados].sort());
    expect(ids.size).toBeGreaterThan(0);
  });

  it("todo id do programa existe no catálogo", () => {
    const catalogo = new Set(exercicios.map((e) => e.id));
    for (const id of idsDoPrograma()) expect(catalogo.has(id)).toBe(true);
  });
});

describe("treinosDoExercicio", () => {
  it("o agachamento aparece nos treinos que o programa diz", () => {
    const treinos = treinosDoExercicio("agachamento-livre");
    expect(treinos.length).toBeGreaterThan(0);
    for (const t of treinos) {
      const treino = programa.treinos[t];
      expect(treino?.exercicios.some((e) => e.exercicio_id === "agachamento-livre")).toBe(true);
    }
  });

  it("exercício fora do programa não tem treino", () => {
    const fora = exercicios.find((e) => !idsDoPrograma().has(e.id));
    expect(fora).toBeDefined();
    expect(treinosDoExercicio(fora?.id ?? "")).toEqual([]);
  });
});

describe("opcoesDoCatalogo", () => {
  it("lista os grupos, equipamentos e implementos que existem", () => {
    const { grupos, equipamentos, implementos } = opcoesDoCatalogo(exercicios);
    expect(grupos).toContain("Peito");
    expect(implementos).toContain("barra_macica");
    expect(equipamentos).toContain("anilhas");
    expect(new Set(grupos).size).toBe(grupos.length);
    expect(new Set(implementos).size).toBe(implementos.length);
  });
});

describe("itemDoCatalogo", () => {
  it("leva o texto da prescrição e a marca do programa", () => {
    const supino = exercicios.find((e) => e.id === "supino-reto-com-barra");
    expect(supino).toBeDefined();
    const item = itemDoCatalogo(supino!);
    expect(item.nome).toBe(supino?.nome);
    expect(item.prescricao).toBe(supino?.prescricao_padrao.texto);
    expect(item.noPrograma).toBe(true);
  });
});

describe("a folha de filtros (SPEC §22.12 item 1)", () => {
  const peitoHalteres = {
    ...FILTROS_VAZIOS,
    busca: "supino",
    grupo: "Peito" as const,
    implemento: "halteres" as const,
  };

  it("o selo conta filtros ligados, não resultados — e a busca não conta", () => {
    expect(quantosFiltrosLigados(FILTROS_VAZIOS)).toBe(0);
    expect(quantosFiltrosLigados({ ...FILTROS_VAZIOS, busca: "supino" })).toBe(0);
    expect(quantosFiltrosLigados(peitoHalteres)).toBe(2);
    expect(
      quantosFiltrosLigados({ ...peitoHalteres, equipamento: "banco", soPrograma: true }),
    ).toBe(4);
    // dois filtros que não acham nada continuam sendo dois
    const nada = { ...FILTROS_VAZIOS, grupo: "Costas" as const, busca: "supino" };
    expect(filtrarExercicios(exercicios, nada, idsDoPrograma())).toHaveLength(0);
    expect(quantosFiltrosLigados(nada)).toBe(1);
  });

  it("um chip por filtro ligado, com o nome das opções", () => {
    expect(chipsDosFiltros(FILTROS_VAZIOS)).toEqual([]);
    expect(chipsDosFiltros({ ...peitoHalteres, soPrograma: true })).toEqual([
      { chave: "grupo", rotulo: "Peito" },
      { chave: "implemento", rotulo: "Halteres" },
      { chave: "soPrograma", rotulo: "No meu programa" },
    ]);
    const opcoes = opcoesDoCatalogo(exercicios);
    for (const eq of opcoes.equipamentos) {
      const chips = chipsDosFiltros({ ...FILTROS_VAZIOS, equipamento: eq });
      expect(chips).toHaveLength(1);
      expect(chips[0]?.rotulo.length).toBeGreaterThan(0);
    }
  });

  it("tirar um chip solta só aquele filtro e mantém a busca", () => {
    const sem = semOFiltro(peitoHalteres, "grupo");
    expect(sem).toEqual({ ...peitoHalteres, grupo: "todos" });
    expect(quantosFiltrosLigados(sem)).toBe(1);
    expect(semOFiltro({ ...peitoHalteres, soPrograma: true }, "soPrograma").soPrograma).toBe(false);
    expect(semFiltrosDaFolha(peitoHalteres)).toEqual({ ...FILTROS_VAZIOS, busca: "supino" });
  });

  it("o CTA diz o número real, com singular", () => {
    expect(rotuloDoVerResultados(0)).toBe("Nenhum exercício");
    expect(rotuloDoVerResultados(1)).toBe("Ver 1 exercício");
    expect(rotuloDoVerResultados(12)).toBe("Ver 12 exercícios");
    const n = filtrarExercicios(exercicios, peitoHalteres, idsDoPrograma()).length;
    expect(rotuloDoVerResultados(n)).toBe(n === 1 ? "Ver 1 exercício" : n === 0 ? "Nenhum exercício" : `Ver ${n} exercícios`);
  });
});
