import { describe, expect, it } from "vitest";
import {
  buscarColecoes,
  circuitos,
  colecaoDoAparelho,
  colecaoDoCircuito,
  colecaoDoGrupo,
  colecaoDoTreino,
  colecoesDePlano,
  colecoesDeTreino,
  colecoesPorAparelho,
  colecoesPorGrupo,
  desafios,
  exerciciosDoAparelho,
  exerciciosDoCircuito,
  exerciciosDoGrupo,
  exerciciosParaSessao,
  colecaoFiltrada,
  exercicioPassaNoFiltro,
  filtrarColecoes,
  fotoDoItem,
  grupos,
  passaNoTempo,
  planos,
  semEquipamento,
  progressoDoDesafio,
  semanaPresa,
  todasAsColecoes,
  type Colecao,
} from "@/lib/colecoes";
import {
  acharExercicio,
  cardio,
  equipamentoDisponivel,
  equipamentos,
  exercicios,
} from "@/lib/dados";
import { minutosDaColecao, podeCircuito, segundosDoExercicio } from "@/lib/livre";
import type { EquipamentoTag } from "@/lib/schemas";

describe("coleções por grupo (SPEC §13.4)", () => {
  it("são os 8 grupos de exercicios.json, sem inventar nenhum", () => {
    expect(grupos()).toEqual([
      "Peito",
      "Costas",
      "Ombros",
      "Bíceps",
      "Tríceps",
      "Pernas",
      "Core",
      "Cardio",
    ]);
    expect(colecoesPorGrupo()).toHaveLength(8);
  });

  it("cada grupo tem exatamente os exercícios do JSON", () => {
    let soma = 0;
    for (const g of grupos()) {
      const lista = exerciciosDoGrupo(g);
      soma += lista.length;
      expect(lista.every((e) => e.grupo === g)).toBe(true);
      expect(colecaoDoGrupo(g).exercicios).toEqual(lista.map((e) => e.id));
    }
    expect(soma).toBe(exercicios.length);
  });

  it("Core tem 13 exercícios e o título é o nome do grupo", () => {
    const core = colecaoDoGrupo("Core");
    expect(core.exercicios).toHaveLength(13);
    expect(core.titulo).toBe("Core");
    expect(core.id).toBe("grupo:Core");
  });

  it("a dificuldade é a maior do conjunto", () => {
    expect(colecaoDoGrupo("Core").raios).toBe(1);
    expect(colecaoDoGrupo("Pernas").raios).toBe(3);
  });
});

describe("coleções por aparelho (SPEC §13.4)", () => {
  it("são os 10 itens de equipamentos.json", () => {
    expect(equipamentos.itens).toHaveLength(10);
    const lista = colecoesPorAparelho();
    expect(lista.length).toBeLessThanOrEqual(10);
    for (const c of lista) {
      expect(c.exercicios.length).toBeGreaterThan(0);
      expect(c.tipo).toBe("aparelho");
    }
  });

  it("o título e o subtítulo saem do JSON, e a capa da pasta do item", () => {
    const tatame = colecaoDoAparelho("tatame");
    const item = equipamentos.itens.find((i) => i.id === "tatame");
    expect(tatame?.titulo).toBe(item?.nome);
    expect(tatame?.subtitulo).toBe(item?.specs);
    expect(tatame?.capa).toBe("/itens/tatame/tatame_01.jpg");
    expect(fotoDoItem("banco")).toBe("/itens/banco/banco_01.jpg");
    expect(fotoDoItem("nao-existe")).toBeNull();
  });

  it("lista só quem tem a tag do item", () => {
    for (const e of exerciciosDoAparelho("super-band")) {
      expect(e.equipamento).toContain("super-band");
    }
    expect(colecaoDoAparelho("nao-existe")).toBeNull();
  });
});

describe("circuitos (SPEC §13.4: os 14 de origem aparelho)", () => {
  it("são 8 no tatame, 3 de corda e 3 de elástico", () => {
    expect(exerciciosDoCircuito("tatame")).toHaveLength(8);
    expect(exerciciosDoCircuito("corda")).toHaveLength(3);
    expect(exerciciosDoCircuito("band")).toHaveLength(3);
    const total = circuitos().reduce((n, c) => n + c.exercicios.length, 0);
    expect(total).toBe(exercicios.filter((e) => e.origem === "aparelho").length);
    expect(total).toBe(14);
  });

  it("os rótulos são de UI e os exercícios vêm do subgrupo do JSON", () => {
    expect(colecaoDoCircuito("tatame").titulo).toBe("Core no tatame");
    expect(colecaoDoCircuito("corda").titulo).toBe("Corda");
    expect(colecaoDoCircuito("band").titulo).toBe("Elástico");
    for (const e of exerciciosDoCircuito("corda")) expect(e.subgrupo).toBe("corda");
  });

  it("tatame e corda rodam no modo por tempo; elástico não (barra fixa)", () => {
    expect(colecaoDoCircuito("tatame").circuito).toBe(true);
    expect(colecaoDoCircuito("corda").circuito).toBe(true);
    // barra-fixa-assistida é `barra_fixa`: a §13.6 não deixa entrar
    expect(colecaoDoCircuito("band").circuito).toBe(false);
    expect(podeCircuito([])).toBe(false);
  });
});

describe("planos e treinos do programa", () => {
  it("os três planos são os de cardio.json, com as semanas do próprio plano", () => {
    const lista = planos();
    expect(lista.map((p) => p.id)).toEqual(["barra_fixa", "corrida", "corda"]);
    // SPEC §14.3: rótulo de UI com o número de semanas do próprio plano…
    expect(lista[0]?.titulo).toBe("Primeira barra fixa em 12 semanas");
    expect(lista[1]?.titulo).toBe("5 km sem parar em 12 semanas");
    // …e o objetivo do JSON continua na tela, como subtítulo
    expect(lista[0]?.subtitulo).toBe(cardio.barra_fixa.objetivo);
    expect(lista[1]?.subtitulo).toBe(cardio.corrida.objetivo);
    expect(lista[1]?.semanas).toBe(12);
    expect(lista[2]?.titulo).toBe("Corda: 5 estágios");
    expect(colecoesDePlano()).toHaveLength(3);
  });

  it("o detalhe de um plano é o tamanho dele, não uma contagem de exercícios", () => {
    const [fixa, corrida, corda] = colecoesDePlano();
    // a corrida não tem exercício em exercicios.json: "0 exercícios · ~1 min"
    // era o que aparecia na tela antes da auditoria do V3
    expect(corrida?.detalhe).toBe("12 semanas");
    expect(fixa?.detalhe).toBe("12 semanas");
    expect(corda?.detalhe).toBe(`${cardio.corda.semanas.length} semanas`);
    for (const c of colecoesDePlano()) {
      expect(c.detalhe).not.toMatch(/exerc[íi]cio/);
    }
  });

  it("os seis treinos vêm do programa.json, com nome, subtítulo e duração", () => {
    const lista = colecoesDeTreino();
    expect(lista.map((c) => c.treino)).toEqual(["A1", "B1", "SA", "IA", "SB", "IB"]);
    const a1 = colecaoDoTreino("A1");
    expect(a1.titulo).toBe("Treino A");
    expect(a1.subtitulo).toBe("Empurrar e agachar");
    expect(a1.minutos).toBe(44);
    expect(a1.detalhe).toBe("6 exercícios · ~44 min");
    expect(a1.capa).toMatch(/^\/fotos\/.+-1\.jpg$/);
  });

  it("a vitrine tem 6 treinos + 8 grupos + 3 circuitos + aparelhos + 3 planos", () => {
    const todas = todasAsColecoes();
    const conta = (t: Colecao["tipo"]) => todas.filter((c) => c.tipo === t).length;
    expect(conta("treino")).toBe(6);
    expect(conta("grupo")).toBe(8);
    expect(conta("circuito")).toBe(3);
    expect(conta("plano")).toBe(3);
    expect(conta("aparelho")).toBe(colecoesPorAparelho().length);
    // nenhum id repetido: a tela usa o id como chave
    expect(new Set(todas.map((c) => c.id)).size).toBe(todas.length);
  });
});

describe("estimativa de minutos (SPEC §14.3)", () => {
  it("é séries × (reps médias × 3 s + descanso)", () => {
    const supra = acharExercicio("abdominal-supra"); // 3 × 15–25, descanso 60
    // 3 × ((15+25)/2 × 3 + 60) = 3 × 120 = 360 s
    expect(segundosDoExercicio(supra)).toBe(360);
    expect(minutosDaColecao([supra])).toBe(6);
  });

  it("exercício por tempo usa o próprio tempo, e o unilateral conta dois lados", () => {
    const escalador = acharExercicio("escalador"); // 3 × 30–45 s, descanso 60
    expect(segundosDoExercicio(escalador)).toBe(Math.round(3 * (37.5 + 60)));
    const prancha = acharExercicio("prancha-lateral"); // 3 × 20–40 s por lado
    expect(prancha.prescricao_padrao.unilateral).toBe(true);
    expect(segundosDoExercicio(prancha)).toBe(3 * (30 * 2 + 60));
  });

  it("sem faixa (máximo) cai na cadência de uma série de 10 reps", () => {
    const flexao = acharExercicio("flexao-de-braco"); // 3 × máximo, descanso 90
    expect(segundosDoExercicio(flexao)).toBe(3 * (10 * 3 + 90));
  });

  it("nenhuma coleção de exercícios fica com 0 min (o plano conta semanas)", () => {
    for (const c of todasAsColecoes()) {
      if (c.tipo === "plano") {
        // um plano é a prescrição por semana de cardio.json, não uma lista
        expect(c.minutos).toBe(0);
        expect(c.detalhe).toMatch(/^\d+ semanas$/);
        continue;
      }
      expect(c.exercicios.length).toBeGreaterThan(0);
      expect(c.minutos).toBeGreaterThan(0);
      expect(c.detalhe).toMatch(/exerc[íi]cios? · ~/);
    }
  });
});

describe("a lista que vira sessão livre (SPEC §14.3)", () => {
  const todos = equipamentoDisponivel();

  it("põe compostos antes de isolamento, mantendo a ordem do catálogo dentro", () => {
    const ids = exerciciosDoGrupo("Peito").map((e) => e.id);
    const escolhidos = exerciciosParaSessao(ids, { disponiveis: todos, limite: 12 });
    const pesos = escolhidos.map((id) => acharExercicio(id).categoria);
    const ordem = ["composto_pesado", "composto_moderado", "core_peso_corporal", "isolamento"];
    const indices = pesos.map((c) => ordem.indexOf(c));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it("leva 6 por padrão", () => {
    const ids = exerciciosDoGrupo("Costas").map((e) => e.id);
    expect(exerciciosParaSessao(ids, { disponiveis: todos })).toHaveLength(6);
  });

  it("deixa de fora quem precisa de equipamento que não existe", () => {
    const so: ReadonlySet<EquipamentoTag> = new Set<EquipamentoTag>(["tatame"]);
    const ids = exerciciosDoGrupo("Core").map((e) => e.id);
    const escolhidos = exerciciosParaSessao(ids, { disponiveis: so, limite: 20 });
    for (const id of escolhidos) {
      expect(acharExercicio(id).equipamento.every((t) => t === "tatame")).toBe(true);
    }
    expect(escolhidos.length).toBeGreaterThan(0);
  });

  it("joga o “não gosto” para o fim sem tirar ninguém da lista", () => {
    const ids = exerciciosDoCircuito("tatame").map((e) => e.id);
    const primeiro = ids[0] ?? "";
    const comEvitado = exerciciosParaSessao(ids, {
      disponiveis: todos,
      limite: 20,
      prefs: { evitar_exercicios: [primeiro] },
    });
    expect(comEvitado).toHaveLength(ids.length);
    expect(comEvitado[comEvitado.length - 1]).toBe(primeiro);
  });

  it("não inventa exercício: todo id sai da lista que entrou", () => {
    const ids = exerciciosDoGrupo("Ombros").map((e) => e.id);
    for (const id of exerciciosParaSessao(ids, { disponiveis: todos })) {
      expect(ids).toContain(id);
    }
  });
});

describe("filtros derivados (SPEC §14.3)", () => {
  it("“sem equipamento” é o exercício que só precisa do tatame", () => {
    expect(semEquipamento(acharExercicio("abdominal-supra"))).toBe(true);
    expect(semEquipamento(acharExercicio("agachamento-livre"))).toBe(false);
    expect(
      exercicioPassaNoFiltro(acharExercicio("abdominal-supra"), "com-equipamento"),
    ).toBe(false);
  });

  it("encolhe a lista da coleção em vez de esconder o grupo inteiro", () => {
    const core = colecaoDoGrupo("Core");
    const sem = colecaoFiltrada(core, ["sem-equipamento"]);
    expect(sem).not.toBeNull();
    expect(sem?.exercicios.length).toBeGreaterThan(0);
    expect(sem?.exercicios.length).toBeLessThan(core.exercicios.length);
    for (const id of sem?.exercicios ?? []) {
      expect(semEquipamento(acharExercicio(id))).toBe(true);
    }
    // a contagem e os minutos acompanham
    expect(sem?.detalhe).toBe(
      `${sem?.exercicios.length} exercícios · ~${sem?.minutos} min`,
    );
  });

  it("um grupo que fica sem nada some", () => {
    // Bíceps não tem exercício de peso do corpo no catálogo
    expect(colecaoFiltrada(colecaoDoGrupo("Bíceps"), ["sem-equipamento"])).toBeNull();
    // e "core" só sobra no grupo Core
    expect(colecaoFiltrada(colecaoDoGrupo("Tríceps"), ["core"])).toBeNull();
    expect(colecaoFiltrada(colecaoDoGrupo("Core"), ["core"])).not.toBeNull();
  });

  it("sem filtro nenhum a coleção volta igual (mesma referência)", () => {
    const core = colecaoDoGrupo("Core");
    expect(colecaoFiltrada(core, [])).toBe(core);
    expect(filtrarColecoes(todasAsColecoes(), [])).toHaveLength(
      todasAsColecoes().length,
    );
  });

  it("as faixas de tempo olham os minutos da coleção já filtrada", () => {
    expect(passaNoTempo(12, "ate15")).toBe(true);
    expect(passaNoTempo(20, "ate15")).toBe(false);
    expect(passaNoTempo(20, "de15a30")).toBe(true);
    expect(passaNoTempo(15, "de15a30")).toBe(false);
    for (const c of todasAsColecoes()) {
      expect(passaNoTempo(c.minutos, "ate15") && passaNoTempo(c.minutos, "de15a30")).toBe(
        false,
      );
    }
  });

  it("filtros combinados são um E, e o resultado nunca inventa exercício", () => {
    const todas = todasAsColecoes();
    const so = filtrarColecoes(todas, ["core", "sem-equipamento"]);
    for (const c of so) {
      const original = todas.find((o) => o.id === c.id);
      for (const id of c.exercicios) {
        expect(original?.exercicios).toContain(id);
        expect(acharExercicio(id).grupo).toBe("Core");
        expect(semEquipamento(acharExercicio(id))).toBe(true);
      }
    }
    expect(so.length).toBeGreaterThan(0);
  });
});

describe("busca sem acento (SPEC §13.4)", () => {
  it("acha pela coleção e pelo exercício de dentro", () => {
    expect(buscarColecoes("biceps").some((c) => c.id === "grupo:Bíceps")).toBe(true);
    expect(buscarColecoes("TRICEPS").some((c) => c.id === "grupo:Tríceps")).toBe(true);
    expect(buscarColecoes("agachamento").some((c) => c.id === "treino:A1")).toBe(true);
  });

  it("busca vazia devolve tudo e busca sem resultado devolve nada", () => {
    expect(buscarColecoes("   ")).toHaveLength(todasAsColecoes().length);
    expect(buscarColecoes("zzzzz")).toHaveLength(0);
  });
});

describe("desafios da aba Treino (SPEC §14.3)", () => {
  const base = {
    fase: "fase1" as const,
    semanaDaFase: 3,
    semanaFixa: 2,
    semanaCorrida: 4,
    proximoTreino: "A1" as const,
  };

  it("são os dois planos de cardio.json e a fase do programa.json", () => {
    const lista = desafios(base);
    expect(lista.map((d) => d.id)).toEqual(["barra_fixa", "corrida", "fase"]);
    expect(lista[0]?.titulo).toBe("Primeira barra fixa em 12 semanas");
    expect(lista[1]?.titulo).toBe("5 km sem parar em 12 semanas");
    expect(lista[0]?.subtitulo).toBe(cardio.barra_fixa.objetivo);
    expect(lista[1]?.subtitulo).toBe(cardio.corrida.objetivo);
    expect(lista[2]?.titulo).toBe("Fase 1 — corpo inteiro, 3× por semana");
    expect(lista[2]?.semanas).toBe(12);
  });

  it("a semana fica presa ao tamanho do plano", () => {
    expect(semanaPresa(0, 12)).toBe(1);
    expect(semanaPresa(99, 12)).toBe(12);
    const lista = desafios({ ...base, semanaCorrida: 99 });
    expect(lista[1]?.semanaAtual).toBe(12);
    expect(lista[1]?.href).toBe("/cardio/corrida?semana=12");
  });

  it("o progresso conta as semanas fechadas atrás da atual", () => {
    expect(progressoDoDesafio({ semanaAtual: 1, semanas: 12 })).toBe(0);
    expect(progressoDoDesafio({ semanaAtual: 7, semanas: 12 })).toBeCloseTo(0.5);
    expect(progressoDoDesafio({ semanaAtual: 13, semanas: 12 })).toBe(1);
  });

  it("a capa sai sempre de assets/ (ou é nenhuma)", () => {
    for (const d of desafios(base)) {
      if (d.capa !== null) expect(d.capa).toMatch(/^\/(fotos|figuras|itens)\//);
    }
  });
});
