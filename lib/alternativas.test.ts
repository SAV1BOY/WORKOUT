import { describe, expect, it } from "vitest";
import { montarSessao, substituirExercicio } from "./sessao";
import { estadoInicial } from "./progressao";
import dados from "@/data/alternativas.json";
import { alternativasPara, equipamentosDaAlternativa, motivoDaAlternativa } from "./alternativas";
import { acharExercicio, exercicioPorId, exerciciosComVariacoes, programa, variacoes } from "./dados";
import type { EquipamentoTag } from "./schemas";

const ids = (lista: ReturnType<typeof alternativasPara>) => lista.map((e) => e.id);

describe("alternativas de uma série", () => {
  it("usa movimentos do catálogo e montagens válidas", () => {
    const membros = Object.values(dados.movimentos).flat();
    expect(new Set(membros).size).toBe(membros.length);
    for (const id of [...membros, ...Object.keys(dados.montagens)]) expect(exercicioPorId.has(id), id).toBe(true);
    for (const e of exerciciosComVariacoes) expect(equipamentosDaAlternativa(e).length, e.id).toBeGreaterThan(0);
  });

  it("prefere o mesmo gesto e aceita a mesma função mesmo com músculos primários diferentes", () => {
    const lista = ids(alternativasPara("supino-reto-com-barra"));
    expect(lista.indexOf("supino-reto-com-halteres")).toBeLessThan(lista.indexOf("crucifixo-reto"));
    expect(lista).not.toContain("supino-reto-com-barra");
    expect(ids(alternativasPara("rosca-direta-com-barra"))).toContain("rosca-inversa");
    expect(motivoDaAlternativa(acharExercicio("rosca-direta-com-barra"), acharExercicio("rosca-inversa"))).toMatch(/flexionar os cotovelos/);
  });

  it("trata grupo e músculos secundários como insuficientes por si sós", () => {
    const lista = ids(alternativasPara("agachamento-livre"));
    expect(lista).not.toContain("elevacao-de-panturrilha-em-pe");
    expect(lista).not.toContain("salto-com-joelho-alto");
    expect(ids(alternativasPara("stiff-terra-romeno", "elastico"))).toEqual(["good-morning-com-elastico"]);
  });

  it("cobre todos os blocos do A e B com apenas corpo, tatame e elástico", () => {
    const kit = new Set<EquipamentoTag>(["tatame", "super-band"]);
    for (const id of ["A1", "B1"] as const) {
      for (const { exercicio_id } of programa.treinos[id].exercicios) {
        expect(alternativasPara(exercicio_id, "todos", kit).length, exercicio_id).toBeGreaterThan(0);
      }
    }
    for (const e of variacoes) {
      expect(acharExercicio(e.id)).toBe(e);
      expect(e.progressao.tipo).toBe("reps");
      expect(e.fotos).toEqual([]);
    }
  });

  it("usa a progressão da variação sem transferir o peso do exercício original", () => {
    const barra = { ...estadoInicial(acharExercicio("agachamento-livre")), carga_atual_kg: 40 };
    const corpo = { ...estadoInicial(acharExercicio("agachamento-com-peso-corporal")), reps_alvo: 14 };
    const treino = montarSessao({
      id: "sessao", userId: "pessoa", data: "2026-09-14", treinoId: "A1", fase: "fase1",
      estados: { "agachamento-livre": barra },
    });
    const inicial = treino.blocos.find((b) => b.exercicioId === "agachamento-livre")!;
    const trocado = substituirExercicio(treino, inicial.ordem, "agachamento-com-peso-corporal", corpo);
    const bloco = trocado.blocos.find((b) => b.ordem === inicial.ordem)!;
    expect(bloco.estado).toEqual(corpo);
    expect(bloco.alvo.carga_kg ?? 0).toBe(0);
    expect(bloco.trocados?.find((r) => r.exercicioId === "agachamento-livre")?.estado).toEqual(barra);
  });

  it("compara a montagem real, não apenas o implemento principal", () => {
    const outras = ids(alternativasPara("supino-reto-com-barra", "outro-equipamento"));
    expect(outras).toContain("supino-reto-com-halteres");
    expect(outras).not.toContain("supino-inclinado-com-barra");
    for (const filtro of ["corpo", "tatame"] as const) {
      expect(ids(alternativasPara("supino-reto-com-barra", filtro))).toContain("flexao-de-braco");
    }
    expect(ids(alternativasPara("puxada-alta-na-polia", "elastico"))).not.toContain("barra-fixa-assistida");
    expect(ids(alternativasPara("stiff-terra-romeno", "todos", new Set(["super-band"])))).toEqual(["good-morning-com-elastico"]);
    const pesos = new Set<EquipamentoTag>(["anilhas", "halteres"]);
    expect(equipamentosDaAlternativa(acharExercicio("stiff-terra-romeno"), pesos)).toEqual([]);
    expect(ids(alternativasPara("stiff-terra-romeno", "outro-equipamento", pesos))).toContain("terra-romeno-com-halteres");
    expect(equipamentosDaAlternativa(acharExercicio("supino-reto-com-halteres"), pesos)).toEqual([]);
    expect(equipamentosDaAlternativa(acharExercicio("puxada-alta-na-polia"), new Set(["cross-over", "anilhas", "banco"]))).toEqual([]);
  });
});
