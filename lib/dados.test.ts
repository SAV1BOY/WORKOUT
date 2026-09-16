import { describe, expect, it } from "vitest";
import {
  acharExercicio,
  acharFase,
  acharTreino,
  cardio,
  caminhoPublico,
  equipamentos,
  exercicioPorId,
  exercicios,
  exerciciosDoTreino,
  perfilInicial,
  programa,
  progressao,
  medidasDoCorpo,
  semanaDeBarraFixa,
  semanaDeCorrida,
  textoDoMotor,
  ultimaSemanaDeBarraFixa,
  ultimaSemanaDeCorda,
  ultimaSemanaDeCorrida,
  ultimaSemanaDoPlano,
  urlFotos,
} from "@/lib/dados";
import {
  cardioSchema,
  equipamentosSchema,
  exerciciosSchema,
  perfilSchema,
  programaSchema,
  progressaoJsonSchema,
} from "@/lib/schemas";

describe("os seis JSON passam pelos schemas", () => {
  it("exercicios.json", () => {
    expect(exerciciosSchema.safeParse(exercicios).success).toBe(true);
    expect(exercicios).toHaveLength(81);
  });
  it("programa.json", () => {
    expect(programaSchema.safeParse(programa).success).toBe(true);
    expect(Object.keys(programa.treinos).sort()).toEqual([
      "A1",
      "B1",
      "IA",
      "IB",
      "SA",
      "SB",
    ]);
  });
  it("cardio.json", () => {
    expect(cardioSchema.safeParse(cardio).success).toBe(true);
    expect(cardio.corrida.semanas).toHaveLength(12);
  });
  it("progressao.json", () => {
    expect(progressaoJsonSchema.safeParse(progressao).success).toBe(true);
  });
  it("equipamentos.json", () => {
    expect(equipamentosSchema.safeParse(equipamentos).success).toBe(true);
  });
  it("perfil.json", () => {
    expect(perfilSchema.safeParse(perfilInicial).success).toBe(true);
  });
});

describe("integridade entre programa e catálogo", () => {
  it("todo exercicio_id do programa existe no catálogo", () => {
    const faltando = Object.values(programa.treinos)
      .flatMap((t) => t.exercicios.map((e) => e.exercicio_id))
      .filter((id) => !exercicioPorId.has(id));
    expect(faltando).toEqual([]);
  });
  it("ids são únicos", () => {
    expect(exercicioPorId.size).toBe(exercicios.length);
  });
});

describe("índices e helpers", () => {
  it("acha exercício, treino e fase", () => {
    expect(acharExercicio("supino-reto-com-barra").grupo).toBe("Peito");
    expect(acharTreino("A1").exercicios.length).toBeGreaterThan(0);
    expect(acharFase("fase1").semana).toHaveLength(7);
  });
  it("erro claro para id desconhecido", () => {
    expect(() => acharExercicio("nao-existe")).toThrow(/desconhecido/);
  });
  it("converte caminho de asset em caminho público", () => {
    expect(caminhoPublico("assets/figuras/x.svg")).toBe("/figuras/x.svg");
    expect(urlFotos(acharExercicio("supino-reto-com-barra"))[0]).toMatch(
      /^\/fotos\//,
    );
  });
  it("junta o item do treino com a ficha do catálogo", () => {
    const lista = exerciciosDoTreino("A1");
    expect(lista[0]?.exercicio.id).toBe(lista[0]?.item.exercicio_id);
  });
  it("prende as semanas dos planos aos limites", () => {
    expect(semanaDeCorrida(0).semana).toBe(1);
    expect(semanaDeCorrida(99).semana).toBe(12);
    expect(semanaDeBarraFixa(1).semanas).toBe("1–2");
    expect(semanaDeBarraFixa(12).semanas).toBe("11–12");
  });
});

describe("textos do motor (data/progressao.json)", () => {
  it("toda chave de sugestão e de aviso vira frase", () => {
    for (const chave of Object.keys(progressao.sugestoes)) {
      expect(textoDoMotor({ chave } as never)).toBeTruthy();
    }
    for (const chave of Object.keys(progressao.avisos)) {
      expect(textoDoMotor({ chave } as never)).toBeTruthy();
    }
  });

  it("troca {reps} e {kg} com vírgula decimal", () => {
    expect(textoDoMotor({ chave: "anilha_no_core", dados: { reps: 20 } })).toBe(
      progressao.sugestoes.anilha_no_core.replace("{reps}", "20"),
    );
    expect(
      textoDoMotor({ chave: "teto_capacidade", dados: { kg: 39.5 } }),
    ).toContain("39,5 kg");
  });

  it("sem referência não há texto; chave desconhecida é erro ruidoso", () => {
    expect(textoDoMotor(null)).toBeNull();
    expect(textoDoMotor(undefined)).toBeNull();
    expect(() => textoDoMotor({ chave: "nao_existe" } as never)).toThrow(
      /progressao.json/,
    );
  });
});

describe("tetos dos planos saem do JSON (SPEC §5.5)", () => {
  it("a última faixa manda: corda e barra fixa vão até 12", () => {
    expect(ultimaSemanaDoPlano([{ semanas: "1–2" }, { semanas: "9–12" }])).toBe(12);
    expect(ultimaSemanaDoPlano([{ semanas: "7" }])).toBe(7);
    expect(ultimaSemanaDeCorda()).toBe(
      Number(cardio.corda.semanas[cardio.corda.semanas.length - 1]?.semanas.split(/[–-]/)[1]),
    );
    expect(ultimaSemanaDeBarraFixa()).toBe(12);
    expect(ultimaSemanaDeCorrida()).toBe(cardio.corrida.semanas.length);
  });
});

describe("as 8 medidas com fita vêm de data/perfil.json (SPEC §3.8)", () => {
  it("cada campo tem nome e microcópia", () => {
    expect(medidasDoCorpo).toHaveLength(8);
    for (const m of medidasDoCorpo) {
      expect(m.nome.length).toBeGreaterThan(1);
      expect(m.onde.length).toBeGreaterThan(5);
    }
    expect(medidasDoCorpo.map((m) => m.campo)).toContain("panturrilha_cm");
  });
});

describe("nenhum texto dos JSON traz marcação HTML", () => {
  /*
   * O React escapa a string, então um "<strong>" no dado aparece literal na
   * ficha, no player e na página do exercício. O conteúdo é texto puro.
   */
  const MARCACAO = /<\/?[a-zA-Z]/;

  function textos(valor: unknown, caminho: string): [string, string][] {
    if (typeof valor === "string") return [[caminho, valor]];
    if (Array.isArray(valor)) {
      return valor.flatMap((v, i) => textos(v, `${caminho}[${i}]`));
    }
    if (valor && typeof valor === "object") {
      return Object.entries(valor).flatMap(([k, v]) => textos(v, `${caminho}.${k}`));
    }
    return [];
  }

  const TUDO: [string, unknown][] = [
    ["exercicios.json", exercicios],
    ["programa.json", programa],
    ["cardio.json", cardio],
    ["progressao.json", progressao],
    ["equipamentos.json", equipamentos],
    ["perfil.json", perfilInicial],
  ];

  for (const [nome, dados] of TUDO) {
    it(nome, () => {
      const comTag = textos(dados, nome)
        .filter(([, texto]) => MARCACAO.test(texto))
        .map(([caminho, texto]) => `${caminho}: ${texto}`);
      expect(comTag).toEqual([]);
    });
  }
});
