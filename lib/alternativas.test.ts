import { describe, expect, it } from "vitest";
import { montarSessao, montarSessaoAvulsa, substituirExercicio } from "./sessao";
import { estadoInicial, prescricaoPadrao } from "./progressao";
import dados from "@/data/alternativas.json";
import { alternativasPara, equipamentosDaAlternativa, motivoDaAlternativa } from "./alternativas";
import { acharExercicio, exercicios, exercicioPorId, exerciciosComVariacoes, programa, variacoes } from "./dados";
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
      expect(e.progressao.tipo).toBe(e.prescricao_padrao.tipo === "tempo_s" ? "tempo" : "reps");
      expect(e.fotos).toEqual([]);
    }
  });

  it.each(exercicios)("oferece uma troca executável no kit leve para $nome", (origem) => {
    const kit = new Set<EquipamentoTag>(["tatame", "super-band"]);
    const leves = alternativasPara(origem.id, "todos", kit);
    expect(leves.length).toBeGreaterThan(0);
    for (const e of leves) {
      expect(e.id).not.toBe(origem.id);
      expect(equipamentosDaAlternativa(e, kit).some((montagem) => montagem.every((tag) => kit.has(tag)))).toBe(true);
      expect(motivoDaAlternativa(origem, e)).not.toBe("");
      expect(e.prescricao_padrao.tipo).not.toBe("ver_cardio_corda");
      expect(e.grupo === "Cardio").toBe(origem.grupo === "Cardio");
    }
  });

  it("mantém a unidade, o descanso e a progressão dos substitutos nos três cardios", () => {
    const kit = new Set<EquipamentoTag>(["tatame", "super-band"]);
    for (const [id, esperado] of [
      ["salto-basico", "salto-ritmado-sem-corda"],
      ["corrida-no-lugar-com-a-corda", "corrida-estacionaria-sem-corda"],
      ["salto-com-joelho-alto", "salto-vertical-com-contramovimento"],
    ] as const) {
      const origem = acharExercicio(id);
      const leves = alternativasPara(id, "todos", kit);
      expect(leves[0]?.id).toBe(esperado);
      const sessao = montarSessaoAvulsa({
        id: "cardio-avulso", userId: "pessoa", data: "2026-11-18", workoutId: "livre", fase: "fase1",
        itens: [{ exercicioId: id, prescricao: prescricaoPadrao(origem), descansoS: 60, descansoTexto: "60 s" }],
      });
      const bloco = substituirExercicio(sessao, sessao.blocos[0]!.ordem, esperado).blocos[0]!;
      const tempo = origem.prescricao_padrao.tipo !== "reps";
      expect(bloco.alvo.tipo).toBe(tempo ? "tempo_s" : "reps");
      expect(bloco.descansoS).toBe(tempo ? 60 : 90);
      expect(bloco.series.length).toBe(tempo ? 4 : 3);
      for (const serie of bloco.series) {
        expect(tempo ? serie.tempoS : serie.reps).toBeGreaterThan(0);
        expect(tempo ? serie.reps : serie.tempoS).toBeNull();
      }
      for (const e of leves) {
        expect(e.prescricao_padrao.tipo).toBe(tempo ? "tempo_s" : "reps");
        expect(e.progressao.tipo).toBe(tempo ? "tempo" : "reps");
        expect(e.prescricao_padrao.descanso_s).toBe(tempo ? 60 : 90);
      }
    }
    expect(ids(alternativasPara("superman", "tatame"))).toContain("bird-dog-no-tatame");
    expect(ids(alternativasPara("abertura-de-ombros", "tatame"))).toContain("elevacao-em-t-no-tatame");
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
