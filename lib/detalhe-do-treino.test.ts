import { describe, expect, it } from "vitest";
import { detalharSeriesDoTreino, valoresDaSerieAnterior, valoresDaSerieRegistrada } from "@/lib/detalhe-do-treino";
import { itensDeIds, planoDaSessao } from "@/lib/livre";
import type { SerieBruta, SessaoBruta } from "@/lib/progresso";

const supino = "supino-reto-com-barra";
const flexao = "flexao-de-braco";
const conta = "atleta";
const sessao: SessaoBruta = { id: "treino", user_id: conta, data: "2026-11-19", workout_id: "livre", status: "concluida" };

function serie(campos: Partial<SerieBruta> = {}): SerieBruta {
  return {
    exercise_id: supino, session_id: sessao.id, user_id: conta, ordem_ex: 1, set_index: 1, tipo: "trabalho",
    reps: null, reps_lado2: null, carga_kg: null, tempo_s: null, tempo_s_lado2: null,
    passos: null, assistencia: null, concluida: true, registrada_em: "2026-11-19T09:00:00Z", ...campos,
  };
}

describe("a referência à última série no player", () => {
  it("preserva a comparação compacta e distingue carga extra zero de carga ausente no cache antigo", () => {
    const legada = { exercise_id: supino, tipo: "trabalho", reps: 8, carga_kg: 23.5, tempo_s: null };
    expect(valoresDaSerieAnterior(legada)).toBe("23,5 kg na barra × 8");
    expect(valoresDaSerieAnterior({ ...legada, exercise_id: flexao, carga_kg: 0 })).toBe("0 kg de carga adicional × 8");
    expect(valoresDaSerieAnterior({ ...legada, exercise_id: flexao, carga_kg: null })).toBe("× 8");
    expect(valoresDaSerieAnterior({ ...legada, exercise_id: "prancha", reps: null, carga_kg: null, tempo_s: 45 })).toBe("45 s");
  });

  it("mostra somente as medidas que ficaram registradas, inclusive o lado esquerdo isolado", () => {
    expect(valoresDaSerieAnterior(serie({ exercise_id: "rosca-alternada", reps: 10, reps_lado2: 8, carga_kg: 6.5 })))
      .toBe("10 repetições à direita · 8 repetições à esquerda · 6,5 kg por halter");
    expect(valoresDaSerieAnterior(serie({ exercise_id: "prancha-lateral", tempo_s_lado2: 40 }))).toBe("40 s à esquerda");
    expect(valoresDaSerieAnterior(serie({ exercise_id: "barra-fixa-assistida", reps: 4, assistencia: "joelho" })))
      .toBe("4 repetições · elástico no joelho");
    expect(valoresDaSerieAnterior(serie({ exercise_id: "movimento-antigo", passos: 1 }))).toBe("1 passo");
    expect(valoresDaSerieAnterior(serie({ exercise_id: flexao }))).toBe("Sem valores registrados");
  });
});

describe("valores de cada série registrada", () => {
  it.each([
    [supino, "22,5 kg na barra"],
    ["rosca-com-barra-w", "22,5 kg na barra"],
    ["supino-reto-com-halteres", "22,5 kg por halter"],
    ["crossover-na-polia", "22,5 kg no pino"],
    ["mergulho-no-banco", "22,5 kg na anilha"],
    ["barra-fixa-pronada", "22,5 kg na mochila"],
    ["abertura-de-ombros", "22,5 kg com elástico"],
    [flexao, "22,5 kg de carga adicional"],
    ["movimento-antigo", "22,5 kg"],
  ])("conserva a unidade própria de %s", (exercicio, esperado) => {
    expect(valoresDaSerieRegistrada(serie({ exercise_id: exercicio, carga_kg: 22.5 }))).toBe(esperado);
  });

  it("distingue zero, carga desconhecida e valores ausentes", () => {
    expect(valoresDaSerieRegistrada(serie({ reps: 0, carga_kg: 0 }))).toBe("0 repetições · 0 kg na barra");
    expect(valoresDaSerieRegistrada(serie({ reps: 10 }))).toBe("10 repetições · carga não registrada");
    expect(valoresDaSerieRegistrada(serie({ exercise_id: flexao, reps: 10 }))).toBe("10 repetições");
    expect(valoresDaSerieRegistrada(serie({ exercise_id: "removido" }))).toBe("Sem valores registrados");
  });

  it("lê os dois lados e mantém o lado que tem medida mesmo quando falta o outro", () => {
    expect(valoresDaSerieRegistrada(serie({ exercise_id: "rosca-alternada", reps: 10, reps_lado2: 8, carga_kg: 6.5 })))
      .toBe("10 repetições à direita · 8 repetições à esquerda · 6,5 kg por halter");
    expect(valoresDaSerieRegistrada(serie({ exercise_id: "prancha-lateral", tempo_s_lado2: 40 }))).toBe("40 s à esquerda");
    expect(valoresDaSerieRegistrada(serie({ exercise_id: "prancha-lateral", tempo_s: 45 }))).toBe("45 s à direita");
    expect(valoresDaSerieRegistrada(serie({ exercise_id: "ex-antigo", reps: 1, reps_lado2: 0 })))
      .toBe("1 repetição à direita · 0 repetições à esquerda");
    expect(valoresDaSerieRegistrada(serie({ exercise_id: "crossover-na-polia", tipo: "aquecimento", reps: 5, carga_kg: 3 })))
      .toBe("5 repetições · 3 kg no pino");
  });

  it("preserva tempo, passos e a assistência que foi realmente usada", () => {
    expect(valoresDaSerieRegistrada(serie({ exercise_id: "prancha", tempo_s: 40 }))).toBe("40 s");
    expect(valoresDaSerieRegistrada(serie({ exercise_id: "ex-antigo", passos: 1 }))).toBe("1 passo");
    expect(valoresDaSerieRegistrada(serie({ exercise_id: "ex-antigo", passos: 40 }))).toBe("40 passos");
    expect(valoresDaSerieRegistrada(serie({ exercise_id: "barra-fixa-assistida", reps: 4, assistencia: "joelho_dobrado" })))
      .toBe("4 repetições · elástico no joelho dobrado");
    expect(valoresDaSerieRegistrada(serie({ exercise_id: "barra-fixa-assistida", reps: 2, assistencia: "sem" })))
      .toBe("2 repetições · sem elástico");
  });
});

describe("séries exibidas no detalhe do treino concluído", () => {
  it("separa o exercício substituído, ordena as posições e mostra a carga individual de cada série", () => {
    const linhas = [
      serie({ id: "outra-posicao", ordem_ex: 3, reps: 2 }),
      serie({ id: "substituida", exercise_id: flexao, reps: 12, registrada_em: "2026-11-19T09:01:00Z" }),
      serie({ id: "segunda", set_index: 2, reps: 8, carga_kg: 22.5 }),
      serie({ id: "primeira", reps: 10, carga_kg: 20 }),
      serie({ id: "aquec", tipo: "aquecimento", reps: 5, carga_kg: 7.5 }),
    ];
    const resultado = detalharSeriesDoTreino(sessao, Object.freeze(linhas), conta);
    expect(resultado.map(g => [g.ordem, g.nome])).toEqual([[1, "Supino reto com barra"], [1, "Flexão de braço"], [3, "Supino reto com barra"]]);
    expect(resultado[0]!.series).toEqual([
      { chave: "aquec", rotulo: "Aquecimento 1", valores: "5 repetições · 7,5 kg na barra" },
      { chave: "primeira", rotulo: "Série 1", valores: "10 repetições · 20 kg na barra" },
      { chave: "segunda", rotulo: "Série 2", valores: "8 repetições · 22,5 kg na barra" },
    ]);
    expect(resultado[1]!.series[0]!.rotulo).toBe("Série 1");
    expect(linhas.map(s => s.id)).toEqual(["outra-posicao", "substituida", "segunda", "primeira", "aquec"]);
    expect(new Set(resultado.map(g => g.chave)).size).toBe(3);
  });

  it("recupera a posição única do plano legado e mantém linhas e movimentos sem posição comprovada", () => {
    const plano = planoDaSessao(itensDeIds([supino, "prancha"]));
    plano.trocas = { "1": [{ exercicio_id: flexao, trabalho: [1], aquecimento: [], nota: null, ultima_firme: null }] };
    const antigas = [supino, flexao, "movimento-arquivado", "prancha", "movimento-arquivado"].map((id, i) => serie({
      id: undefined, user_id: undefined, ordem_ex: undefined, exercise_id: id, registrada_em: `2026-11-19T09:0${i}:00Z`,
    }));
    const resultado = detalharSeriesDoTreino({ ...sessao, plano }, antigas, conta);
    expect(resultado.map(g => [g.ordem, g.exercicioId])).toEqual([[1, supino], [1, flexao], [2, "prancha"], [null, "movimento-arquivado"]]);
    const desconhecido = resultado[3]!;
    expect(desconhecido.nome).toBe("movimento-arquivado");
    expect(new Set(desconhecido.series.map(s => s.chave)).size).toBe(2);
  });

  it("uma linha antiga de um movimento repetido em duas posições fica com posição desconhecida", () => {
    const resultado = detalharSeriesDoTreino(sessao, [
      serie({ ordem_ex: undefined }), serie({ ordem_ex: 2 }), serie({ ordem_ex: 7 }),
    ], conta);
    expect(resultado.map(g => g.ordem)).toEqual([2, 7, null]);
    const somenteUmaComOrdem = detalharSeriesDoTreino(sessao, [serie({ ordem_ex: 2 }), serie({ ordem_ex: undefined })], conta);
    expect(somenteUmaComOrdem.map(g => g.ordem)).toEqual([2, null]);
  });

  it("sinaliza a numeração repetida só enquanto a posição das séries está ausente no aparelho", () => {
    const plano = planoDaSessao(itensDeIds([supino, flexao, supino]));
    const treino = { ...sessao, plano };
    const antigas = [20, 22.5].map((kg, i) => serie({ id: String(i), ordem_ex: undefined, carga_kg: kg }));
    const [grupo] = detalharSeriesDoTreino(treino, antigas, conta);
    expect(grupo).toMatchObject({ ordem: null, posicaoAmbigua: true });
    expect(grupo!.series.map(s => s.valores)).toEqual(["20 kg na barra", "22,5 kg na barra"]);
    const confirmadas = antigas.map((s, i) => ({ ...s, ordem_ex: i === 0 ? 1 : 3 }));
    expect(detalharSeriesDoTreino(treino, confirmadas, conta).map(g => [g.ordem, g.posicaoAmbigua]))
      .toEqual([[1, false], [3, false]]);
    expect(detalharSeriesDoTreino(treino, [antigas[0]!, { ...antigas[1]!, tipo: "aquecimento" }], conta)[0]?.posicaoAmbigua)
      .toBe(false);
    expect(detalharSeriesDoTreino(treino, [antigas[0]!, { ...antigas[1]!, set_index: 2 }], conta)[0]?.posicaoAmbigua)
      .toBe(false);
  });

  it("usa o movimento original como desempate se duas versões de um bloco têm o mesmo instante", () => {
    const plano = planoDaSessao(itensDeIds([supino]));
    const grupos = detalharSeriesDoTreino({ ...sessao, plano }, [serie({ exercise_id: flexao }), serie()], conta);
    expect(grupos.map(g => g.exercicioId)).toEqual([supino, flexao]);
  });

  it("só apresenta séries concluídas da sessão selecionada e da sua conta", () => {
    const linhas = [serie({ id: "da-pessoa" }), serie({ session_id: "outro-treino" }), serie({ user_id: "outra-conta" }), serie({ concluida: false })];
    expect(detalharSeriesDoTreino(sessao, linhas, conta).flatMap(g => g.series.map(s => s.chave))).toEqual(["da-pessoa"]);
    expect(detalharSeriesDoTreino(sessao, linhas, "outra-conta")).toEqual([]);
    expect(detalharSeriesDoTreino({ ...sessao, status: "em_andamento" }, linhas, conta)).toEqual([]);
    expect(detalharSeriesDoTreino({ ...sessao, status: "abandonada" }, linhas, conta)).toEqual([]);
    expect(detalharSeriesDoTreino(sessao, [], conta)).toEqual([]);
  });
});
