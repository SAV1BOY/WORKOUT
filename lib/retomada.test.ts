/**
 * Retomada depois de uma pausa (SPEC §18): a conta dos dias parado, as quatro
 * faixas, o que cada escolha grava e o "perguntar uma vez por pausa".
 */
import { describe, expect, it } from "vitest";
import { acharExercicio } from "@/lib/dados";
import {
  ancoraDaRetomada,
  cargaLeve,
  comRetomada,
  DIAS_PARA_LEVE,
  DIAS_PARA_PERGUNTAR,
  DIAS_PARA_ZERO,
  deveMostrarRetomada,
  diasParado,
  escritasDaRetomada,
  faixaDaRetomada,
  faixaDeDias,
  pausaCorrente,
  retomadaDasPrefs,
  semanaAnterior,
  ultimaAtividade,
  type EscolhaRetomada,
} from "@/lib/retomada";
import type { LinhaEstadoExercicio, Prefs } from "@/lib/types";

const HOJE = "2026-09-16";

/** Uma linha de `exercise_state` como o banco a devolve. */
function estado(
  exercicioId: string,
  ajustes: Partial<LinhaEstadoExercicio> = {},
): LinhaEstadoExercicio {
  return {
    user_id: "u1",
    exercise_id: exercicioId,
    carga_atual_kg: null,
    reps_alvo: null,
    tempo_alvo_s: null,
    assistencia: null,
    incremento_kg: null,
    falhas_seguidas: 0,
    incremento_reduzido: false,
    exigir_rep_extra: false,
    semana_leve: false,
    carga_antes_leve: null,
    sessoes_graca: 0,
    desativado: false,
    notas: null,
    ...ajustes,
  };
}

function perfil(ajustes: Partial<Parameters<typeof escritasDaRetomada>[0]["perfil"]> = {}) {
  return {
    user_id: "u1",
    semana_corrida: 3,
    semana_corda: 2,
    semana_fixa: 4,
    prefs: {} as Prefs,
    ...ajustes,
  };
}

/** Ids previsíveis, para o teste falar do conteúdo e não do uuid. */
function contador(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `ev${n}`;
  };
}

function escrever(
  escolha: EscolhaRetomada,
  opcoes: {
    dias?: number;
    estados?: LinhaEstadoExercicio[];
    perfil?: ReturnType<typeof perfil>;
  } = {},
) {
  return escritasDaRetomada({
    escolha,
    dias: opcoes.dias ?? 20,
    hoje: HOJE,
    perfil: opcoes.perfil ?? perfil(),
    estados: opcoes.estados ?? [],
    novoId: contador(),
  });
}

/* ------------------------------------------------ dias parado (§18.1) */

describe("dias parado (SPEC §18.1)", () => {
  it("conta os dias inteiros desde a última sessão de força concluída", () => {
    const dias = diasParado(HOJE, [{ data: "2026-09-06", status: "concluida" }]);
    expect(dias).toBe(10);
  });

  it("uma sessão abandonada não conta como treino", () => {
    const dias = diasParado(HOJE, [
      { data: "2026-09-06", status: "concluida" },
      { data: "2026-09-14", status: "abandonada" },
      { data: "2026-09-15", status: "em_andamento" },
    ]);
    expect(dias).toBe(10);
  });

  it("cardio concluído e barra fixa também zeram a conta", () => {
    expect(
      diasParado(
        HOJE,
        [{ data: "2026-08-01", status: "concluida" }],
        [{ data: "2026-09-14", concluida: true }],
      ),
    ).toBe(2);
    expect(
      diasParado(
        HOJE,
        [{ data: "2026-08-01", status: "concluida" }],
        [{ data: "2026-08-02", concluida: false }],
        [{ data: "2026-09-15" }],
      ),
    ).toBe(1);
  });

  it("sem nenhuma atividade não há pausa nenhuma", () => {
    expect(ultimaAtividade([], [], [])).toBeNull();
    expect(diasParado(HOJE)).toBeNull();
  });

  it("uma sessão com data no futuro (relógio adiantado) conta como zero", () => {
    expect(diasParado(HOJE, [{ data: "2026-09-20", status: "concluida" }])).toBe(0);
  });
});

/* ------------------------------------------------- as faixas (§18.2) */

describe("as faixas da retomada (SPEC §18.2)", () => {
  it("de 0 a 6 dias não oferece nada", () => {
    for (const dias of [0, 1, 6]) {
      expect(faixaDeDias(dias)).toBe("nenhuma");
      expect(faixaDaRetomada(dias).opcoes).toEqual([]);
    }
    expect(faixaDeDias(null)).toBe("nenhuma");
  });

  it("de 7 a 13 dias: continuar ou recomeçar a semana", () => {
    for (const dias of [DIAS_PARA_PERGUNTAR, 10, 13]) {
      const { faixa, opcoes } = faixaDaRetomada(dias);
      expect(faixa).toBe("curta");
      expect(opcoes.map((o) => o.escolha)).toEqual(["continuar", "semana"]);
    }
  });

  it("de 14 a 27 dias: continuar ou voltar mais leve", () => {
    for (const dias of [DIAS_PARA_LEVE, 20, 27]) {
      const { faixa, opcoes } = faixaDaRetomada(dias);
      expect(faixa).toBe("media");
      expect(opcoes.map((o) => o.escolha)).toEqual(["continuar", "leve"]);
    }
  });

  it("de 28 dias em diante entra o recomeço do zero, e só ele confirma", () => {
    for (const dias of [DIAS_PARA_ZERO, 40, 365]) {
      const { faixa, opcoes } = faixaDaRetomada(dias);
      expect(faixa).toBe("longa");
      expect(opcoes.map((o) => o.escolha)).toEqual(["continuar", "leve", "zero"]);
      expect(opcoes.filter((o) => o.destrutiva).map((o) => o.escolha)).toEqual(["zero"]);
    }
  });
});

/* ------------------------------------ o que cada escolha grava (§18.2) */

describe("continuar de onde parou (SPEC §18.2)", () => {
  it("grava só a decisão nas prefs", () => {
    const e = escrever("continuar", { dias: 10 });
    expect(e.estados).toEqual([]);
    expect(e.eventos).toEqual([]);
    expect(Object.keys(e.perfil)).toEqual(["prefs"]);
    expect(e.perfil.prefs?.retomada).toEqual({
      em: HOJE,
      dias: 10,
      escolha: "continuar",
    });
  });

  it("não mexe nas outras preferências", () => {
    const p = perfil({ prefs: { tema: "escuro", dias_de_treino: ["seg"] } });
    const e = escrever("continuar", { perfil: p });
    expect(e.perfil.prefs?.tema).toBe("escuro");
    expect(e.perfil.prefs?.dias_de_treino).toEqual(["seg"]);
  });
});

describe("recomeçar a semana (SPEC §18.2)", () => {
  it("volta uma semana em corrida, corda e barra fixa; a força não muda", () => {
    const e = escrever("semana", { dias: 10 });
    expect(e.perfil.semana_corrida).toBe(2);
    expect(e.perfil.semana_corda).toBe(1);
    expect(e.perfil.semana_fixa).toBe(3);
    expect(e.perfil.ultimo_treino).toBeUndefined();
    expect(e.estados).toEqual([]);
    expect(e.eventos).toEqual([]);
  });

  it("o piso é a semana 1", () => {
    expect(semanaAnterior(1)).toBe(1);
    const e = escrever("semana", {
      perfil: perfil({ semana_corrida: 1, semana_corda: 1, semana_fixa: 1 }),
    });
    expect(e.perfil.semana_corrida).toBe(1);
    expect(e.perfil.semana_corda).toBe(1);
    expect(e.perfil.semana_fixa).toBe(1);
  });
});

describe("voltar mais leve (SPEC §18.2)", () => {
  const ID = "supino-reto-com-barra";

  it("põe cada exercício com carga em semana leve, guardando a carga de antes", () => {
    const e = escrever("leve", {
      dias: 20,
      estados: [estado(ID, { carga_atual_kg: 39.5 })],
    });
    expect(e.estados).toHaveLength(1);
    const linha = e.estados[0];
    expect(linha?.exercise_id).toBe(ID);
    expect(linha?.semana_leve).toBe(true);
    expect(linha?.carga_antes_leve).toBe(39.5);
    // 60 % arredondados para baixo na escala da barra maciça (7,5 + 2 kg)
    expect(linha?.carga_atual_kg).toBe(cargaLeve(39.5, ID));
    expect(linha?.carga_atual_kg).toBe(23.5);
    // a pausa não é falha: `falhas_seguidas` não entra na escrita
    expect(linha?.falhas_seguidas).toBeUndefined();
  });

  it("registra um evento retomada_leve por exercício", () => {
    const e = escrever("leve", {
      estados: [estado(ID, { carga_atual_kg: 39.5 })],
    });
    expect(e.eventos).toHaveLength(1);
    expect(e.eventos[0]?.motivo).toBe("retomada_leve");
    expect(e.eventos[0]?.exercise_id).toBe(ID);
    expect(e.eventos[0]?.data).toBe(HOJE);
    expect(e.eventos[0]?.de).toEqual({ carga_kg: 39.5 });
  });

  it("também volta uma semana nos planos de cardio e barra fixa", () => {
    const e = escrever("leve", { estados: [estado(ID, { carga_atual_kg: 39.5 })] });
    expect(e.perfil.semana_corrida).toBe(2);
    expect(e.perfil.semana_fixa).toBe(3);
    expect(e.perfil.prefs?.retomada).toEqual({ em: HOJE, dias: 20, escolha: "leve" });
  });

  it("deixa em paz o peso corporal, o desativado e quem já está leve", () => {
    const e = escrever("leve", {
      estados: [
        estado("flexao-declinada", { carga_atual_kg: 0 }),
        estado("supino-inclinado-com-barra", { carga_atual_kg: 29.5, desativado: true }),
        estado("supino-declinado-com-barra", {
          carga_atual_kg: 17.5,
          semana_leve: true,
          carga_antes_leve: 29.5,
        }),
        estado("barra-fixa-assistida"),
      ],
    });
    expect(e.estados).toEqual([]);
    expect(e.eventos).toEqual([]);
  });

  it("não alivia quando a carga já está no piso do implemento", () => {
    const base = acharExercicio(ID).carga_inicial.kg;
    expect(cargaLeve(base, ID)).toBe(base);
    const e = escrever("leve", { estados: [estado(ID, { carga_atual_kg: base })] });
    expect(e.estados).toEqual([]);
  });
});

describe("recomeçar do zero (SPEC §18.2)", () => {
  const ID = "supino-reto-com-barra";

  it("devolve cada exercício ao estado inicial do JSON", () => {
    const e = escrever("zero", {
      dias: 40,
      estados: [
        estado(ID, {
          carga_atual_kg: 39.5,
          reps_alvo: 9,
          falhas_seguidas: 2,
          incremento_reduzido: true,
          exigir_rep_extra: true,
          semana_leve: true,
          carga_antes_leve: 45.5,
          sessoes_graca: 1,
          incremento_kg: 3,
          notas: "ombro",
        }),
      ],
    });
    const linha = e.estados[0];
    expect(linha?.carga_atual_kg).toBe(acharExercicio(ID).carga_inicial.kg);
    expect(linha?.reps_alvo).toBeNull();
    expect(linha?.tempo_alvo_s).toBeNull();
    expect(linha?.assistencia).toBeNull();
    expect(linha?.falhas_seguidas).toBe(0);
    expect(linha?.incremento_reduzido).toBe(false);
    expect(linha?.exigir_rep_extra).toBe(false);
    expect(linha?.semana_leve).toBe(false);
    expect(linha?.carga_antes_leve).toBeNull();
    expect(linha?.sessoes_graca).toBe(0);
    // o override de incremento e as notas são ajustes da pessoa, não progresso
    expect(linha).not.toHaveProperty("incremento_kg");
    expect(linha).not.toHaveProperty("notas");
    expect(linha).not.toHaveProperty("desativado");
  });

  it("zera as semanas dos planos, o último treino e a contagem da fase", () => {
    const e = escrever("zero", { dias: 40 });
    expect(e.perfil.semana_corrida).toBe(1);
    expect(e.perfil.semana_corda).toBe(1);
    expect(e.perfil.semana_fixa).toBe(1);
    expect(e.perfil.ultimo_treino).toBeNull();
    expect(e.perfil.fase_desde).toBe(HOJE);
    // a fase continua a mesma (SPEC §18.2)
    expect(e.perfil.fase_atual).toBeUndefined();
    expect(e.perfil.prefs?.retomada).toEqual({ em: HOJE, dias: 40, escolha: "zero" });
  });

  it("grava um evento recomeco por exercício e um do programa", () => {
    const e = escrever("zero", {
      dias: 40,
      estados: [estado(ID, { carga_atual_kg: 39.5 }), estado("agachamento-livre", { carga_atual_kg: 47.5 })],
    });
    expect(e.eventos.map((v) => v.motivo)).toEqual(["recomeco", "recomeco", "recomeco"]);
    expect(e.eventos.map((v) => v.exercise_id)).toEqual([ID, "agachamento-livre", null]);
    expect(e.eventos.at(-1)?.para).toMatchObject({ semana_corrida: 1, dias_parado: 40 });
  });

  it("ignora a linha de um exercício que não está mais no catálogo", () => {
    const e = escrever("zero", { estados: [estado("exercicio-que-sumiu", { carga_atual_kg: 20 })] });
    expect(e.estados).toEqual([]);
    // só o evento do programa
    expect(e.eventos).toHaveLength(1);
    expect(e.eventos[0]?.exercise_id).toBeNull();
  });
});

/* -------------------------- perguntar uma vez por pausa (SPEC §18.4) */

describe("perguntar uma vez por pausa (SPEC §18.4)", () => {
  const decisao = { em: "2026-09-16", dias: 10, escolha: "semana" as const };

  it("a âncora é o dia da última atividade de então", () => {
    expect(ancoraDaRetomada(decisao)).toBe("2026-09-06");
  });

  it("pergunta quando a pausa chega a 7 dias e ainda não foi decidida", () => {
    expect(
      deveMostrarRetomada({ dias: 7, ultima: "2026-09-09", prefs: {} }),
    ).toBe(true);
    expect(
      deveMostrarRetomada({ dias: 6, ultima: "2026-09-10", prefs: {} }),
    ).toBe(false);
    expect(deveMostrarRetomada({ dias: null, ultima: null, prefs: {} })).toBe(false);
  });

  it("não pergunta de novo pela MESMA pausa, nem no dia seguinte", () => {
    const prefs = comRetomada({}, decisao);
    // mesmo dia
    expect(deveMostrarRetomada({ dias: 10, ultima: "2026-09-06", prefs })).toBe(false);
    // no dia seguinte a pausa é maior, mas é a mesma pausa
    expect(deveMostrarRetomada({ dias: 11, ultima: "2026-09-06", prefs })).toBe(false);
    // e mesmo quando ela cresce até a faixa seguinte
    expect(deveMostrarRetomada({ dias: 30, ultima: "2026-09-06", prefs })).toBe(false);
  });

  it("uma pausa NOVA pergunta de novo", () => {
    const prefs = comRetomada({}, decisao);
    // ele treinou em 17/09 e parou outra vez até 27/09
    expect(deveMostrarRetomada({ dias: 10, ultima: "2026-09-17", prefs })).toBe(true);
    // mas 6 dias parado depois do treino novo continuam não perguntando
    expect(deveMostrarRetomada({ dias: 6, ultima: "2026-09-17", prefs })).toBe(false);
  });

  it("a atividade de HOJE não apaga uma pausa ainda por decidir (§18.1)", () => {
    // ele voltou de 30 dias e tocou no "+1" antes de olhar o card
    const pausa = pausaCorrente({
      hoje: HOJE,
      sessoes: [{ data: "2026-08-17", status: "concluida" }],
      fixas: [{ data: HOJE }],
      prefs: {},
    });
    expect(pausa.mostrar).toBe(true);
    expect(pausa.dias).toBe(30);
    expect(pausa.ultima).toBe("2026-08-17");
  });

  it("o mesmo vale para o cardio e a força registrados hoje", () => {
    for (const registro of [
      { cardios: [{ data: HOJE, concluida: true }] },
      {
        sessoes: [
          { data: "2026-09-02", status: "concluida" },
          { data: HOJE, status: "concluida" },
        ],
      },
    ]) {
      const pausa = pausaCorrente({
        hoje: HOJE,
        sessoes: [{ data: "2026-09-02", status: "concluida" }],
        prefs: {},
        ...registro,
      });
      expect(pausa.mostrar).toBe(true);
      expect(pausa.dias).toBe(14);
    }
  });

  it("decidida a pausa, treinar hoje não traz o card de volta", () => {
    const prefs = comRetomada({}, { em: HOJE, dias: 30, escolha: "leve" });
    const pausa = pausaCorrente({
      hoje: HOJE,
      sessoes: [{ data: "2026-08-17", status: "concluida" }],
      fixas: [{ data: HOJE }],
      prefs,
    });
    expect(pausa.mostrar).toBe(false);
    // e a conta volta a ser a de verdade: ele treinou hoje
    expect(pausa.dias).toBe(0);
  });

  it("no dia seguinte a conta é 1 e não há card nenhum", () => {
    const pausa = pausaCorrente({
      hoje: "2026-09-17",
      sessoes: [{ data: "2026-08-17", status: "concluida" }],
      fixas: [{ data: HOJE }],
      prefs: {},
    });
    expect(pausa.mostrar).toBe(false);
    expect(pausa.dias).toBe(1);
  });

  it("sem pausa longa nenhuma, a atividade de hoje manda", () => {
    const pausa = pausaCorrente({
      hoje: HOJE,
      sessoes: [
        { data: "2026-09-13", status: "concluida" },
        { data: HOJE, status: "concluida" },
      ],
      prefs: {},
    });
    expect(pausa).toEqual({ dias: 0, ultima: HOJE, mostrar: false });
  });

  it("lê e escreve a decisão nas prefs sem confiar no jsonb", () => {
    expect(retomadaDasPrefs(null)).toBeNull();
    expect(retomadaDasPrefs({ retomada: "sim" })).toBeNull();
    expect(retomadaDasPrefs({ retomada: { em: "2026-09-16", dias: 10 } })).toBeNull();
    expect(retomadaDasPrefs({ retomada: { em: "2026-09-16", dias: 10, escolha: "voar" } })).toBeNull();
    expect(retomadaDasPrefs(comRetomada({ tema: "claro" }, decisao))).toEqual(decisao);
    expect(comRetomada(comRetomada({ tema: "claro" }, decisao), null)).toEqual({
      tema: "claro",
    });
  });
});
