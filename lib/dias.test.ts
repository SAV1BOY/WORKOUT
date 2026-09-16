/**
 * Dias de treino escolhidos pelo usuário (SPEC §17.2): a semana montada a
 * partir dos dias, com força primeiro, cardio no que sobra e dia livre no
 * resto — e a ordem de sacrifício da §5.4 quando faltam dias.
 */
import { describe, expect, it } from "vitest";
import { acharFase, DIAS } from "@/lib/dados";
import {
  comDiasDeTreino,
  diasDeTreinoDasPrefs,
  diasPadraoDaFase,
  escolherDiasDeForca,
  faseExigeFolga,
  ordenarDias,
  resumoDosDias,
  semanaPersonalizada,
  treinosParaNDias,
} from "@/lib/dias";
import type { DiaPrograma, DiaSemana, FaseId } from "@/lib/schemas";

type Dias = DiaSemana[];

const TODOS: Dias = [...DIAS];

function porTipo(semana: DiaPrograma[], tipo: DiaPrograma["tipo"]): Dias {
  return semana.filter((d) => d.tipo === tipo).map((d) => d.dia);
}

function treinos(semana: DiaPrograma[]): (string | undefined)[] {
  return semana.filter((d) => d.tipo === "forca").map((d) => d.treino);
}

function sessoes(semana: DiaPrograma[]): (string | undefined)[] {
  return semana.filter((d) => d.tipo === "cardio").map((d) => d.sessao);
}

/** Quantos pares de dias consecutivos no calendário há nesta lista. */
function consecutivos(dias: Dias): number {
  const i = dias.map((d) => DIAS.indexOf(d)).sort((a, b) => a - b);
  let n = 0;
  for (let k = 1; k < i.length; k += 1) {
    if ((i[k] as number) - (i[k - 1] as number) === 1) n += 1;
  }
  return n;
}

/** Todas as combinações de `k` dias — usadas só para provar a propriedade. */
function combinacoes(dias: Dias, k: number): Dias[] {
  if (k === 0) return [[]];
  if (k > dias.length) return [];
  if (k === dias.length) return [dias];
  const [primeiro, ...resto] = dias;
  if (!primeiro) return [];
  return [
    ...combinacoes(resto, k - 1).map((c) => [primeiro, ...c]),
    ...combinacoes(resto, k),
  ];
}

/** Os 127 conjuntos não vazios de dias da semana. */
function todosOsConjuntos(): Dias[] {
  const conjuntos: Dias[] = [];
  for (let mascara = 1; mascara < 128; mascara += 1) {
    conjuntos.push(TODOS.filter((_, i) => (mascara & (1 << i)) !== 0));
  }
  return conjuntos;
}

describe("as prefs (SPEC §17.1)", () => {
  it("sem a chave, não há escolha: vale a semana do programa", () => {
    expect(diasDeTreinoDasPrefs(null)).toBeNull();
    expect(diasDeTreinoDasPrefs({})).toBeNull();
    expect(diasDeTreinoDasPrefs({ tema: "escuro" })).toBeNull();
  });

  it("limpa o que vem do jsonb: só dias conhecidos, na ordem da semana", () => {
    expect(
      diasDeTreinoDasPrefs({ dias_de_treino: ["sab", "seg", "lua", 7, "seg"] }),
    ).toEqual(["seg", "sab"]);
  });

  it("uma lista vazia é uma escolha: nenhum dia de treino", () => {
    expect(diasDeTreinoDasPrefs({ dias_de_treino: [] })).toEqual([]);
  });

  it("grava na ordem da semana e volta ao padrão com null", () => {
    const prefs = comDiasDeTreino({ tema: "escuro" }, ["sex", "seg", "qua"]);
    expect(prefs.dias_de_treino).toEqual(["seg", "qua", "sex"]);
    expect(prefs.tema).toBe("escuro");
    const limpo = comDiasDeTreino(prefs, null);
    expect(limpo.dias_de_treino).toBeUndefined();
    expect(limpo.tema).toBe("escuro");
  });

  it("ordenarDias tira repetição e ordena", () => {
    expect(ordenarDias(["dom", "ter", "dom"])).toEqual(["ter", "dom"]);
  });

  it("os chips nascem nos dias que a fase usa", () => {
    expect(diasPadraoDaFase("fase1")).toEqual(["seg", "ter", "qua", "sex", "sab"]);
    expect(diasPadraoDaFase("fase2")).toEqual([
      "seg",
      "ter",
      "qua",
      "qui",
      "sex",
      "sab",
    ]);
  });

  it("a folga sai do próprio programa: a Fase 1 pede, a Fase 2 não", () => {
    expect(faseExigeFolga("fase1")).toBe(true);
    expect(faseExigeFolga("fase2")).toBe(false);
  });
});

describe("padrão: sem escolha, a semana é a do programa (SPEC §17.2)", () => {
  for (const fase of ["fase1", "fase2"] as FaseId[]) {
    it(`${fase} sem prefs é idêntica ao programa.json`, () => {
      expect(semanaPersonalizada(fase, null)).toEqual(acharFase(fase).semana);
      expect(semanaPersonalizada(fase, undefined)).toEqual(acharFase(fase).semana);
    });
  }

  it("a semana montada não é a mesma referência do JSON (ninguém a muta)", () => {
    const semana = semanaPersonalizada("fase1", null);
    expect(semana).not.toBe(acharFase("fase1").semana);
    expect(semana[0]).not.toBe(acharFase("fase1").semana[0]);
  });
});

describe("Fase 1 (SPEC §17.2)", () => {
  it("seg a sáb: força seg/qua/sex, cardio ter/sáb, quinta livre com a nota da barra fixa", () => {
    const semana = semanaPersonalizada("fase1", [
      "seg",
      "ter",
      "qua",
      "qui",
      "sex",
      "sab",
    ]);
    expect(porTipo(semana, "forca")).toEqual(["seg", "qua", "sex"]);
    expect(porTipo(semana, "cardio")).toEqual(["ter", "sab"]);
    expect(treinos(semana)).toEqual(["alternar", "alternar", "alternar"]);
    expect(sessoes(semana)).toEqual(["corrida", "corrida ou corda"]);

    const quinta = semana.find((d) => d.dia === "qui");
    expect(quinta?.tipo).toBe("descanso");
    expect(quinta?.nota).toMatch(/barra fixa/i);

    // domingo não foi escolhido: descanso e nada mais
    expect(semana.find((d) => d.dia === "dom")).toEqual({
      dia: "dom",
      tipo: "descanso",
    });
  });

  it("seg a sex: 3 de força e 2 de cardio, sem sobra", () => {
    const semana = semanaPersonalizada("fase1", ["seg", "ter", "qua", "qui", "sex"]);
    expect(porTipo(semana, "forca")).toEqual(["seg", "qua", "sex"]);
    expect(porTipo(semana, "cardio")).toEqual(["ter", "qui"]);
    expect(sessoes(semana)).toEqual(["corrida", "corrida ou corda"]);
    expect(porTipo(semana, "descanso")).toEqual(["sab", "dom"]);
  });

  it("os dias do próprio programa reproduzem o plano do programa", () => {
    const semana = semanaPersonalizada("fase1", diasPadraoDaFase("fase1"));
    expect(porTipo(semana, "forca")).toEqual(porTipo(acharFase("fase1").semana, "forca"));
    expect(porTipo(semana, "cardio")).toEqual(
      porTipo(acharFase("fase1").semana, "cardio"),
    );
    expect(sessoes(semana)).toEqual(sessoes(acharFase("fase1").semana));
  });

  it("seg, qua e sex: só força — o cardio cai na ordem da §5.4", () => {
    const semana = semanaPersonalizada("fase1", ["seg", "qua", "sex"]);
    expect(porTipo(semana, "forca")).toEqual(["seg", "qua", "sex"]);
    expect(porTipo(semana, "cardio")).toEqual([]);
    expect(resumoDosDias("fase1", ["seg", "qua", "sex"])).toEqual({
      forca: 3,
      cardio: 0,
      livres: 0,
      sessoes: 3,
    });
  });

  it("dois dias: dois treinos de força e nenhum cardio", () => {
    const semana = semanaPersonalizada("fase1", ["ter", "sab"]);
    expect(porTipo(semana, "forca")).toEqual(["ter", "sab"]);
    expect(porTipo(semana, "cardio")).toEqual([]);
    expect(treinos(semana)).toEqual(["alternar", "alternar"]);
  });

  it("um dia só: a alternância continua decidindo (SPEC §17.2 item 6)", () => {
    const semana = semanaPersonalizada("fase1", ["qua"]);
    expect(porTipo(semana, "forca")).toEqual(["qua"]);
    /*
     * "alternar", não "A1": com um dia de treino por semana o Treino B (o do
     * levantamento terra) nunca chegaria. `proximoTreinoAlternado(null)` já
     * começa em A1 para quem está começando, e daí a alternância roda semana a
     * semana.
     */
    expect(treinos(semana)).toEqual(["alternar"]);
    expect(porTipo(semana, "cardio")).toEqual([]);
  });

  it("sete dias: as duas sobras viram dias livres com as notas do programa", () => {
    const semana = semanaPersonalizada("fase1", TODOS);
    expect(porTipo(semana, "forca")).toEqual(["seg", "qua", "sex"]);
    expect(porTipo(semana, "cardio")).toEqual(["ter", "sab"]);
    const livres = semana.filter((d) => d.tipo === "descanso");
    expect(livres.map((d) => d.dia)).toEqual(["qui", "dom"]);
    expect(livres[0]?.nota).toMatch(/barra fixa/i);
    expect(livres[1]?.nota).toMatch(/caminhada/i);
    expect(resumoDosDias("fase1", TODOS)).toEqual({
      forca: 3,
      cardio: 2,
      livres: 2,
      sessoes: 5,
    });
  });

  it("nenhum dia: a semana inteira é descanso", () => {
    const semana = semanaPersonalizada("fase1", []);
    expect(porTipo(semana, "descanso")).toEqual(TODOS);
    expect(resumoDosDias("fase1", [])).toEqual({
      forca: 0,
      cardio: 0,
      livres: 0,
      sessoes: 0,
    });
  });

  it("dias sem folga possível: os treinos ficam seguidos, mas acontecem", () => {
    const semana = semanaPersonalizada("fase1", ["seg", "ter", "qua"]);
    expect(porTipo(semana, "forca")).toEqual(["seg", "ter", "qua"]);
  });

  it("dias fora do programa continuam espalhados", () => {
    const semana = semanaPersonalizada("fase1", ["ter", "qui", "sab"]);
    expect(porTipo(semana, "forca")).toEqual(["ter", "qui", "sab"]);
    expect(consecutivos(porTipo(semana, "forca"))).toBe(0);
  });
});

describe("Fase 2 (SPEC §17.2)", () => {
  it("seis dias: SA, IA, SB, IB mais as duas sessões de cardio", () => {
    const semana = semanaPersonalizada("fase2", [
      "seg",
      "ter",
      "qua",
      "qui",
      "sex",
      "sab",
    ]);
    expect(treinos(semana)).toEqual(["SA", "IA", "SB", "IB"]);
    expect(porTipo(semana, "forca")).toEqual(["seg", "ter", "qui", "sex"]);
    expect(porTipo(semana, "cardio")).toEqual(["qua", "sab"]);
    expect(sessoes(semana)).toEqual(["corrida", "corrida longa"]);
  });

  it("quatro dias: só os quatro de força, na ordem", () => {
    const semana = semanaPersonalizada("fase2", ["seg", "ter", "qui", "sex"]);
    expect(treinos(semana)).toEqual(["SA", "IA", "SB", "IB"]);
    expect(porTipo(semana, "cardio")).toEqual([]);
    expect(resumoDosDias("fase2", ["seg", "ter", "qui", "sex"]).sessoes).toBe(4);
  });

  it("dias fora do programa: os quatro treinos na ordem dos dias escolhidos", () => {
    const semana = semanaPersonalizada("fase2", ["ter", "qui", "sab", "dom"]);
    expect(porTipo(semana, "forca")).toEqual(["ter", "qui", "sab", "dom"]);
    expect(treinos(semana)).toEqual(["SA", "IA", "SB", "IB"]);
  });

  it("três dias: corta SB, que não tem agachamento nem terra (§5.4)", () => {
    expect(treinosParaNDias("fase2", 3)).toEqual(["SA", "IA", "IB"]);
    const semana = semanaPersonalizada("fase2", ["seg", "qua", "sex"]);
    expect(treinos(semana)).toEqual(["SA", "IA", "IB"]);
  });

  it("dois dias: um superior e um inferior (SPEC §17.2 item 6)", () => {
    /*
     * A ordem de sacrifício da §5.4 sozinha deixaria IA e IB — duas pernas e
     * nenhum superior a semana inteira. Como escolha permanente de dias, o
     * corte preserva um treino de cada metade.
     */
    expect(treinosParaNDias("fase2", 2)).toEqual(["SA", "IA"]);
    expect(treinos(semanaPersonalizada("fase2", ["seg", "qui"]))).toEqual(["SA", "IA"]);
  });

  it("um dia só: o Treino A da fase", () => {
    expect(treinosParaNDias("fase2", 1)).toEqual(["SA"]);
    expect(treinos(semanaPersonalizada("fase2", ["sab"]))).toEqual(["SA"]);
  });

  it("a Fase 2 não perde a folga que nunca teve: seg-ter e qui-sex seguem juntos", () => {
    const semana = semanaPersonalizada("fase2", diasPadraoDaFase("fase2"));
    expect(porTipo(semana, "forca")).toEqual(
      porTipo(acharFase("fase2").semana, "forca"),
    );
  });
});

describe("propriedades sobre os 127 conjuntos de dias", () => {
  it("Fase 1: nunca dois treinos de força seguidos quando havia alternativa", () => {
    for (const escolhidos of todosOsConjuntos()) {
      const forca = porTipo(semanaPersonalizada("fase1", escolhidos), "forca");
      const possiveis = combinacoes(escolhidos, forca.length).map(consecutivos);
      expect(
        consecutivos(forca),
        `${escolhidos.join(",")} → ${forca.join(",")}`,
      ).toBe(Math.min(...possiveis));
    }
  });

  for (const fase of ["fase1", "fase2"] as FaseId[]) {
    it(`${fase}: a semana tem sempre os sete dias, na ordem, sem repetir`, () => {
      for (const escolhidos of todosOsConjuntos()) {
        const semana = semanaPersonalizada(fase, escolhidos);
        expect(semana.map((d) => d.dia)).toEqual(TODOS);
      }
    });

    it(`${fase}: força e cardio só caem em dia escolhido, e nunca sobra sessão`, () => {
      const daFase = acharFase(fase);
      const cardiosDaFase = daFase.semana.filter((d) => d.tipo === "cardio").length;
      for (const escolhidos of todosOsConjuntos()) {
        const semana = semanaPersonalizada(fase, escolhidos);
        const forca = porTipo(semana, "forca");
        const cardio = porTipo(semana, "cardio");
        for (const dia of [...forca, ...cardio]) {
          expect(escolhidos).toContain(dia);
        }
        expect(forca.length).toBe(Math.min(daFase.frequencia_forca, escolhidos.length));
        expect(cardio.length).toBe(
          Math.min(cardiosDaFase, Math.max(0, escolhidos.length - forca.length)),
        );
      }
    });

    it(`${fase}: o cardio corta a última sessão da semana primeiro (§5.4)`, () => {
      const daFase = acharFase(fase);
      const todasAsSessoes = daFase.semana
        .filter((d) => d.tipo === "cardio")
        .map((d) => d.sessao);
      for (const escolhidos of todosOsConjuntos()) {
        const feitas = sessoes(semanaPersonalizada(fase, escolhidos));
        expect(feitas).toEqual(todasAsSessoes.slice(0, feitas.length));
      }
    });

    it(`${fase}: dia não escolhido é sempre descanso sem nota`, () => {
      for (const escolhidos of todosOsConjuntos()) {
        for (const dia of semanaPersonalizada(fase, escolhidos)) {
          if (escolhidos.includes(dia.dia)) continue;
          expect(dia).toEqual({ dia: dia.dia, tipo: "descanso" });
        }
      }
    });
  }
});

describe("escolherDiasDeForca (SPEC §17.2 item 1)", () => {
  it("prefere os dias do programa quando a folga empata", () => {
    expect(escolherDiasDeForca("fase1", ["seg", "ter", "qua", "sex", "sab"], 3)).toEqual([
      "seg",
      "qua",
      "sex",
    ]);
  });

  it("pede menos dias do que existem e devolve o começo da semana no empate", () => {
    expect(escolherDiasDeForca("fase1", ["ter", "qui", "sab", "dom"], 2)).toEqual([
      "ter",
      "qui",
    ]);
  });

  it("zero dias pedidos, nenhum dia devolvido", () => {
    expect(escolherDiasDeForca("fase1", ["seg"], 0)).toEqual([]);
    expect(escolherDiasDeForca("fase1", [], 3)).toEqual([]);
  });
});
