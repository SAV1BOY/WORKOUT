import { readFileSync } from "node:fs";
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
  grupos,
  passaNoTempo,
  planos,
  semEquipamento,
  progressoDoDesafio,
  semanaPresa,
  semanasConcluidasDoDesafio,
  colecaoDaRota,
  hrefDaColecao,
  segmentoDaColecao,
  semCapasRepetidas,
  todasAsColecoes,
  metaDoAparelho,
  metaDoPlano,
  exerciciosResponsaveis,
  juntarNomes,
  nomeCurtoDaFase,
  type Colecao,
} from "@/lib/colecoes";
import {
  acharExercicio,
  cardio,
  equipamentoDisponivel,
  equipamentos,
  exercicios,
  ultimaSemanaDoPlano,
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

  it("o título sai do JSON e a ficha técnica não vira subtítulo (§22.12 item 2)", () => {
    const tatame = colecaoDoAparelho("tatame");
    const item = equipamentos.itens.find((i) => i.id === "tatame");
    expect(tatame?.titulo).toBe(item?.nome);
    expect(tatame?.subtitulo).toBeNull();
    expect(tatame?.detalhe).toBe(
      `${exerciciosDoAparelho("tatame").length} exercícios que dão para fazer com ele`,
    );
  });

  it("todo aparelho: sem specs, kg, cm nem minutos, e a contagem uma vez só", () => {
    const lista = colecoesPorAparelho();
    expect(lista.length).toBeGreaterThan(0);
    for (const c of lista) {
      const item = equipamentos.itens.find((i) => `aparelho:${i.id}` === c.id);
      expect(item, c.id).toBeDefined();
      const texto = [c.subtitulo ?? "", c.detalhe].join(" | ");
      expect(texto, c.id).not.toContain(item?.specs ?? "@@");
      expect(texto, c.id).not.toMatch(/\bkg\b|\bcm\b|~|\bmin\b|carga máxima/);
      expect(c.detalhe, c.id).toBe(metaDoAparelho(c.exercicios.length));
      // o número da contagem aparece uma vez só na linha
      const n = String(c.exercicios.length);
      expect(texto.split(/\D+/).filter((x) => x === n), c.id).toHaveLength(1);
    }
  });

  it("a meta do aparelho acerta o singular", () => {
    expect(metaDoAparelho(1)).toBe("1 exercício que dá para fazer com ele");
    expect(metaDoAparelho(2)).toBe("2 exercícios que dão para fazer com ele");
    expect(metaDoAparelho(0)).toBe("0 exercícios que dão para fazer com ele");
  });

  /*
   * SPEC §15.3: as fotos de `assets/itens/` são fotografia de anúncio — obra
   * de terceiro sem licença livre. Elas ficam no inventário particular (Mais →
   * Equipamento) e NUNCA na vitrine do Explorar.
   */
  it("nenhuma coleção usa foto de item como capa", () => {
    for (const c of [...colecoesPorAparelho(), ...circuitos(), ...colecoesPorGrupo()]) {
      expect(c.capa ?? "").not.toContain("/itens/");
    }
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
    // a ficha técnica do item não é subtítulo de circuito (§22.12 item 2)
    for (const c of circuitos()) expect(c.subtitulo).toBeNull();
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
    // SPEC §22.12 item 4: título curto — o prazo está no objetivo e na meta
    expect(lista[0]?.titulo).toBe("Primeira barra fixa");
    expect(lista[1]?.titulo).toBe(
      cardio.corrida.semanas[cardio.corrida.semanas.length - 1]?.descricao,
    );
    for (const p of lista) expect(p.titulo).not.toMatch(/\d+ semanas/);
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
    // a corda dura o que o JSON diz ("9–12" → 12), não o número de estágios
    expect(corda?.detalhe).toBe(`${ultimaSemanaDoPlano(cardio.corda.semanas)} semanas`);
    for (const c of colecoesDePlano()) {
      expect(c.detalhe).not.toMatch(/exerc[íi]cio/);
    }
  });

  it("com o perfil, barra fixa e corrida dizem a posição (§22.12 item 4)", () => {
    const [fixa, corrida, corda] = colecoesDePlano({ semanaFixa: 2, semanaCorrida: 5 });
    expect(fixa?.detalhe).toBe("semana 2 de 12");
    expect(corrida?.detalhe).toBe("semana 5 de 12");
    // a corda não tem posição no perfil: fica a duração
    expect(corda?.detalhe).toBe("12 semanas");
    // acima do total fica preso no total; abaixo de 1, na primeira
    expect(metaDoPlano({ id: "corrida", semanas: 12 }, { semanaFixa: 1, semanaCorrida: 99 })).toBe(
      "semana 12 de 12",
    );
    expect(metaDoPlano({ id: "barra_fixa", semanas: 12 }, { semanaFixa: 0, semanaCorrida: 1 })).toBe(
      "semana 1 de 12",
    );
    // sem perfil, a duração
    expect(metaDoPlano({ id: "barra_fixa", semanas: 12 }, null)).toBe("12 semanas");
    // a posição chega à vitrine inteira (e à busca)
    const todas = todasAsColecoes({ semanaFixa: 3, semanaCorrida: 4 });
    expect(todas.find((c) => c.id === "plano:barra_fixa")?.detalhe).toBe("semana 3 de 12");
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
      // o aparelho diz a serventia, sem minutos (§22.12 item 2)
      if (c.tipo === "aparelho") expect(c.detalhe).toMatch(/para fazer com ele$/);
      else expect(c.detalhe).toMatch(/exerc[íi]cios? · ~/);
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

describe("a busca diz por que achou (SPEC §22.12 item 3)", () => {
  const nomeDe = (id: string) => acharExercicio(id).nome;

  it("título antes de subtítulo antes de conteúdo", () => {
    const ondes = buscarColecoes("core").map((c) =>
      semAcentoT(c.titulo).includes("core")
        ? 0
        : semAcentoT(c.subtitulo ?? "").includes("core")
          ? 1
          : 2,
    );
    expect(ondes.length).toBeGreaterThan(1);
    expect([...ondes].sort((a, b) => a - b)).toEqual(ondes);
    expect(buscarColecoes("core")[0]?.id).toBe("grupo:Core");
  });

  it("casamento por título ou subtítulo não diz 'contém'", () => {
    const peito = buscarColecoes("peito").find((c) => c.id === "grupo:Peito");
    expect(peito?.motivoDaBusca ?? null).toBeNull();
    // "Empurrar e agachar" é o subtítulo do Treino A
    const a1 = buscarColecoes("empurrar").find((c) => c.id === "treino:A1");
    expect(a1?.motivoDaBusca ?? null).toBeNull();
  });

  it("toda coleção achada por conteúdo cita o exercício responsável", () => {
    for (const termo of ["agachamento", "prancha", "rosca", "supino", "remada"]) {
      for (const c of buscarColecoes(termo)) {
        const cabeca = semAcentoT(`${c.titulo} ${c.subtitulo ?? ""}`);
        if (cabeca.includes(termo)) {
          expect(c.motivoDaBusca ?? null, `${termo} → ${c.id}`).toBeNull();
          continue;
        }
        expect(c.motivoDaBusca, `${termo} → ${c.id}`).toMatch(/^contém /);
        const citados = c.exercicios
          .map(nomeDe)
          .filter((n) => (c.motivoDaBusca ?? "").includes(n));
        expect(citados.length, `${termo} → ${c.id}`).toBeGreaterThan(0);
        for (const n of citados) expect(semAcentoT(n)).toContain(termo);
      }
    }
  });

  it("sem diferença de acento e caixa", () => {
    const a = buscarColecoes("ROSCA BÍCEPS").map((c) => [c.id, c.motivoDaBusca ?? null]);
    const b = buscarColecoes("rosca biceps").map((c) => [c.id, c.motivoDaBusca ?? null]);
    expect(a).toEqual(b);
  });

  it("dois termos no mesmo exercício citam um nome só", () => {
    const nomes = ["Supino inclinado com halteres", "Supino reto com barra", "Crucifixo"];
    expect(exerciciosResponsaveis(["supino", "reto"], nomes)).toEqual(["Supino reto com barra"]);
  });

  it("termos em exercícios diferentes citam os nomes, únicos, na ordem dos termos", () => {
    const nomes = ["Prancha frontal", "Rosca direta", "Prancha lateral"];
    expect(exerciciosResponsaveis(["rosca", "prancha"], nomes)).toEqual([
      "Rosca direta",
      "Prancha frontal",
    ]);
    // "prancha" e "lateral" estão os dois na Prancha lateral: um nome só por
    // eles, e a Prancha frontal (que só tem "prancha") não sobra na frase
    expect(exerciciosResponsaveis(["prancha", "lateral", "rosca"], nomes)).toEqual([
      "Prancha lateral",
      "Rosca direta",
    ]);
    expect(juntarNomes(["A"])).toBe("A");
    expect(juntarNomes(["A", "B"])).toBe("A e B");
    expect(juntarNomes(["A", "B", "C"])).toBe("A, B e C");
  });

  it("nenhum nome se repete, mesmo quando dois termos caem no mesmo exercício", () => {
    const r = exerciciosResponsaveis(
      ["prancha", "lateral", "frontal"],
      ["Prancha frontal", "Prancha lateral"],
    );
    expect(r).toEqual(["Prancha frontal", "Prancha lateral"]);
    expect(new Set(r).size).toBe(r.length);
    // termo que nenhum exercício tem não inventa nome
    expect(exerciciosResponsaveis(["zzz"], ["Prancha frontal"])).toEqual([]);
  });

  it("com 3 termos, dois no mesmo exercício, nenhum nome sobra (dados reais)", () => {
    const motivo = (termo: string, id: string) =>
      buscarColecoes(termo).find((c) => c.id === id)?.motivoDaBusca;
    // era "contém Flexão declinada, Flexão inclinada e Supino reto com barra"
    expect(motivo("flexao inclinada supino", "grupo:Peito")).toBe(
      "contém Flexão inclinada e Supino reto com barra",
    );
    // era "contém Agachamento livre, Agachamento sumô e Stiff / terra romeno"
    expect(motivo("agachamento sumo stiff", "aparelho:barra-macica")).toBe(
      "contém Agachamento sumô e Stiff / terra romeno",
    );
    // era "contém Barra fixa pronada, Barra fixa com lastro e Remada curvada pronada"
    expect(motivo("barra com remada", "grupo:Costas")).toBe(
      "contém Barra fixa com lastro e Remada curvada pronada",
    );
  });

  it("em toda coleção real, 2 palavras de um exercício + 1 de outro: cada nome citado responde por um termo só dele", () => {
    const palavras = (n: string) =>
      [...new Set(semAcentoT(n).split(/[^a-z0-9]+/).filter((p) => p.length >= 4))];
    let consultas = 0;
    for (const c of todasAsColecoes()) {
      const nomes = c.exercicios.map(nomeDe);
      const normais = nomes.map(semAcentoT);
      nomes.forEach((a, ia) => {
        const pa = palavras(a);
        if (pa.length < 2) return;
        nomes.forEach((b, ib) => {
          if (ib === ia) return;
          const pb = palavras(b).filter((p) => !pa.includes(p));
          const extra = pb[0];
          if (!extra) return;
          for (const termos of [
            [pa[0]!, pa[1]!, extra],
            [extra, pa[0]!, pa[1]!],
            [pa[0]!, extra, pa[1]!],
          ]) {
            consultas += 1;
            const r = exerciciosResponsaveis(termos, nomes);
            const ids = r.map((n) => nomes.indexOf(n));
            expect(new Set(r).size, termos.join(" ")).toBe(r.length);
            // todo termo tem quem responda por ele
            for (const t of termos) {
              expect(ids.some((i) => normais[i]!.includes(t)), `${c.id}: ${termos.join(" ")}`).toBe(true);
            }
            // e todo nome citado tem um termo que nenhum outro citado cobre
            for (const i of ids) {
              const proprio = termos.some(
                (t) => normais[i]!.includes(t) && !ids.some((j) => j !== i && normais[j]!.includes(t)),
              );
              expect(proprio, `${c.id}: "${termos.join(" ")}" → ${r.join(", ")}`).toBe(true);
            }
            // os dois termos que estão juntos em um exercício nunca pedem mais
            // de dois nomes no total
            expect(r.length, `${c.id}: ${termos.join(" ")}`).toBeLessThanOrEqual(2);
          }
        });
      });
    }
    expect(consultas).toBeGreaterThan(1000);
  });

  it("na coleção real, dois termos de exercícios diferentes aparecem os dois", () => {
    // Treino A1 tem agachamento e supino em exercícios diferentes
    const a1 = colecaoDoTreino("A1");
    const nomes = a1.exercicios.map(nomeDe);
    const comAgach = nomes.find((n) => semAcentoT(n).includes("agachamento"));
    const comSupino = nomes.find((n) => semAcentoT(n).includes("supino"));
    expect(comAgach).toBeDefined();
    expect(comSupino).toBeDefined();
    expect(comAgach).not.toBe(comSupino);
    // a ordem é a dos termos, não a da lista do treino
    expect(buscarColecoes("supino agachamento", [a1])[0]?.motivoDaBusca).toBe(
      `contém ${comSupino} e ${comAgach}`,
    );
    expect(buscarColecoes("agachamento supino", [a1])[0]?.motivoDaBusca).toBe(
      `contém ${comAgach} e ${comSupino}`,
    );
    // termo que casa no título não é citado como conteúdo
    const banco = buscarColecoes("supino agachamento").find((c) => c.id === "aparelho:banco");
    expect(banco?.motivoDaBusca ?? "").not.toMatch(/Supino/);
  });
});

function semAcentoT(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

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

  it("a barra e o rótulo leem a mesma coisa (SPEC §22.2 item 8)", () => {
    // "Semana 3 de 12 · 2 concluídas" → barra em 2/12
    const d = { semanaAtual: 3, semanas: 12 };
    expect(semanasConcluidasDoDesafio(d)).toBe(2);
    expect(progressoDoDesafio(d)).toBeCloseTo(2 / 12);
    expect(semanasConcluidasDoDesafio({ semanaAtual: 1, semanas: 12 })).toBe(0);
    // nunca passa do total, nem fica negativo
    expect(semanasConcluidasDoDesafio({ semanaAtual: 30, semanas: 12 })).toBe(12);
    expect(semanasConcluidasDoDesafio({ semanaAtual: 0, semanas: 12 })).toBe(0);
    expect(semanasConcluidasDoDesafio({ semanaAtual: 3, semanas: 0 })).toBe(0);
  });

  it("o CTA de cada desafio sai daqui, e só daqui (§22.12 item 7)", () => {
    const [fixa, corrida, fase] = desafios(base);
    expect(fixa?.acao).toBe("Fazer a sessão de barra fixa");
    expect(corrida?.acao).toBe("Fazer a corrida da semana 4");
    expect(fase?.acao).toBe("Fazer o treino da fase 1");
    expect(nomeCurtoDaFase("Fase 1 — corpo inteiro, 3× por semana")).toBe("Fase 1");
    // a corrida presa ao plano diz a semana presa
    expect(desafios({ ...base, semanaCorrida: 99 })[1]?.acao).toBe(
      "Fazer a corrida da semana 12",
    );
    // nenhuma tela reescreve o rótulo por id: as duas mostram `desafio.acao`
    for (const arquivo of ["components/treino/desafios.tsx", "components/explorar/tela-explorar.tsx"]) {
      const fonte = readFileSync(arquivo, "utf8");
      expect(fonte, arquivo).not.toMatch(/acaoDoDesafio|Fazer a corrida da semana|Fazer o treino da|Fazer a sessão de barra fixa/);
    }
    expect(readFileSync("components/treino/desafios.tsx", "utf8")).toContain("{desafio.acao}");
    expect(readFileSync("components/explorar/tela-explorar.tsx", "utf8")).toContain("{plano.acao}");
  });

  it("a capa sai sempre de assets/ (ou é nenhuma)", () => {
    for (const d of desafios(base)) {
      if (d.capa !== null) expect(d.capa).toMatch(/^\/(fotos|figuras|itens)\//);
    }
  });
});

describe("a rota da coleção (SPEC §22.9 item 9)", () => {
  it("o segmento é minúsculo, sem acento e sem espaço", () => {
    expect(segmentoDaColecao("Bíceps")).toBe("biceps");
    expect(segmentoDaColecao("Core no tatame")).toBe("core-no-tatame");
    expect(segmentoDaColecao("A1")).toBe("a1");
  });

  it("toda coleção abre pela URL que a própria vitrine gerou", () => {
    for (const c of todasAsColecoes()) {
      const [, , tipo = "", valor = ""] = hrefDaColecao(c).split("/");
      const volta = colecaoDaRota(tipo, valor);
      expect(volta, `${c.id} → ${hrefDaColecao(c)}`).not.toBeNull();
      expect(volta?.id).toBe(c.id);
    }
  });

  it("dois segmentos nunca colidem depois de normalizados", () => {
    const vistos = new Map<string, string>();
    for (const c of todasAsColecoes()) {
      const rota = hrefDaColecao(c);
      const antes = vistos.get(rota);
      expect(antes, `${rota} serve a ${antes} e a ${c.id}`).toBeUndefined();
      vistos.set(rota, c.id);
    }
  });

  it("o link antigo, com acento e maiúscula, continua abrindo", () => {
    expect(colecaoDaRota("grupo", "Core")?.id).toBe("grupo:Core");
    expect(colecaoDaRota("grupo", "Bíceps")?.id).toBe("grupo:Bíceps");
    expect(colecaoDaRota("grupo", encodeURIComponent("Bíceps"))?.id).toBe("grupo:Bíceps");
    expect(colecaoDaRota("treino", "B1")?.id).toBe("treino:B1");
    expect(colecaoDaRota("grupo", "nao-existe")).toBeNull();
  });
});

describe("capas de uma seção (SPEC §22.9 item 7)", () => {
  const secoes = () => [
    colecoesDeTreino(),
    colecoesPorGrupo(),
    circuitos(),
    colecoesPorAparelho(),
    colecoesDePlano(),
  ];

  it("hoje a mesma foto repete dentro de uma seção — e depois não repete", () => {
    for (const secao of secoes()) {
      const limpa = semCapasRepetidas(secao);
      const capas = limpa.map((c) => c.capa).filter((f): f is string => f !== null);
      expect(new Set(capas).size).toBe(capas.length);
      // e nenhuma coleção some nem troca de lugar
      expect(limpa.map((c) => c.id)).toEqual(secao.map((c) => c.id));
    }
  });

  it("a capa continua saindo de assets/, e nunca de uma foto de item", () => {
    for (const secao of secoes()) {
      for (const c of semCapasRepetidas(secao)) {
        if (c.capa === null) continue;
        expect(c.capa).toMatch(/^\/(fotos|figuras)\//);
      }
    }
  });

  it("a coleção guardada não muda: a tela da coleção mantém a foto do primeiro", () => {
    const antes = colecoesPorGrupo().map((c) => c.capa);
    semCapasRepetidas(colecoesPorGrupo());
    expect(colecoesPorGrupo().map((c) => c.capa)).toEqual(antes);
  });
});
