import { describe, expect, it } from "vitest";
import {
  semanaCurta,
  semanaDoPlano,
  type PerfilCalendario,
} from "@/lib/calendario";
import {
  GLIFO_DA_MARCA,
  LEGENDA_DA_FAIXA,
  NOME_DA_MARCA,
  ORDEM_DA_LEGENDA,
  SIMBOLO,
  detalheDoDia,
  faixaDaSemana,
  faseCumprida,
  intervaloDaSemana,
  montarGrade,
  montarMes,
  overridesDaSemanaCurta,
  rotuloDaFase,
  rotuloDoDia,
  siglaDoDia,
  type MarcaDoDia,
  type MarcaVisivel,
} from "@/lib/semana";

const PERFIL: PerfilCalendario = {
  fase_atual: "fase1",
  ultimo_treino: null,
  fase_desde: "2026-09-14",
  semana_corrida: 1,
  semana_corda: 1,
  semana_fixa: 1,
};

/** A semana do primeiro dia do programa: 14/09/2026 é uma segunda. */
const SEMANA_1 = "2026-09-14";

describe("grade da semana (SPEC §3.5 e §10.6)", () => {
  it("mostra a semana da Fase 1 com A e B alternando", () => {
    const grade = montarGrade({ data: SEMANA_1, perfil: PERFIL, hoje: SEMANA_1 });
    expect(grade.map((d) => d.rotulo)).toEqual([
      "Treino A",
      "Corrida",
      "Treino B",
      "Descanso",
      "Treino A",
      "Corrida",
      "Descanso",
    ]);
  });

  it("a alternância segue o último treino do perfil", () => {
    const grade = montarGrade({
      data: SEMANA_1,
      perfil: { ...PERFIL, ultimo_treino: "A1" },
      hoje: SEMANA_1,
    });
    expect(grade.filter((d) => d.dia.tipo === "forca").map((d) => d.rotulo)).toEqual([
      "Treino B",
      "Treino A",
      "Treino B",
    ]);
  });

  it("a terça traz a corrida da semana 1 com os minutos do plano", () => {
    const grade = montarGrade({ data: SEMANA_1, perfil: PERFIL, hoje: SEMANA_1 });
    expect(grade[1]?.detalhe).toBe(
      "8 × (1 min corrida / 2 min caminhada) · 34 min",
    );
  });

  it("o dia de força mostra quantos exercícios e quanto tempo", () => {
    const grade = montarGrade({ data: SEMANA_1, perfil: PERFIL, hoje: SEMANA_1 });
    expect(grade[0]?.detalhe).toBe("6 exercícios · 44 min");
  });

  it("marca feito, parcial, faltou e a fazer", () => {
    const hoje = "2026-09-18"; // sexta
    const grade = montarGrade({
      data: SEMANA_1,
      perfil: PERFIL,
      sessoes: [
        { id: "s1", data: "2026-09-14", status: "concluida", workout_id: "A1" },
        { id: "s2", data: "2026-09-16", status: "abandonada", workout_id: "B1" },
      ],
      hoje,
    });
    expect(grade[0]).toMatchObject({ marca: "feito", simbolo: "✓", sessaoId: "s1" });
    expect(grade[1]).toMatchObject({ marca: "faltou", simbolo: "✕" }); // terça sem corrida
    expect(grade[2]).toMatchObject({ marca: "parcial", sessaoId: "s2" });
    expect(grade[3]?.marca).toBe("descanso");
    expect(grade[4]).toMatchObject({ marca: "aberto", ehHoje: true });
    expect(grade[5]?.marca).toBe("aberto");
  });

  it("o cardio concluído marca o dia como feito", () => {
    const grade = montarGrade({
      data: SEMANA_1,
      perfil: PERFIL,
      cardios: [{ id: "c1", data: "2026-09-15", tipo: "corrida", concluida: true }],
      hoje: "2026-09-16",
    });
    expect(grade[1]).toMatchObject({ marca: "feito", sessaoId: "c1" });
  });

  it("o rótulo e o detalhe de um dia de descanso vêm da nota do programa", () => {
    const semana = semanaDoPlano(SEMANA_1, PERFIL);
    const quinta = semana[3];
    expect(quinta).toBeDefined();
    expect(rotuloDoDia(quinta!)).toBe("Descanso");
    expect(detalheDoDia(quinta!)).toMatch(/grease the groove/);
  });
});

/**
 * SPEC §22.8 item 11: o programa começa em `profiles.data_inicio`. O dia
 * planejado ANTERIOR a esse começo aparecia como "faltou" — um ✕ vermelho na
 * grade do mês e um "faltou" no nome acessível —, cobrando do usuário dias em
 * que ele ainda não existia no app. Agora vira "antes": sem desenho, sem
 * acusação (§11: sem culpa).
 */
describe("o começo do programa (SPEC §22.8 item 11)", () => {
  /** Miguel começou na segunda 14/09; a semana de 07/09 é anterior a tudo. */
  const COMECOU_EM_14: PerfilCalendario & { data_inicio: string } = {
    ...PERFIL,
    data_inicio: SEMANA_1,
  };
  const QUARTA = "2026-09-16";

  it("dia anterior ao começo do programa não é perdido", () => {
    const grade = montarGrade({
      data: "2026-09-07",
      perfil: COMECOU_EM_14,
      hoje: QUARTA,
    });
    expect(grade.map((d) => d.marca)).toEqual(new Array(7).fill("antes"));
    expect(grade.every((d) => d.simbolo === "")).toBe(true);
    expect(SIMBOLO.antes).toBe("");
    /* e o nome acessível deixa de dizer "faltou" */
    expect(faixaDaSemana(grade).every((d) => !d.titulo.includes("faltou"))).toBe(true);
  });

  it("o mês só cobra os dias a partir do começo", () => {
    const mes = montarMes("2026-09-14", COMECOU_EM_14, [], [], [], QUARTA);
    const perdidos = mes.flat().filter((d) => d.marca === "faltou");
    expect(perdidos.map((d) => d.data)).toEqual(["2026-09-14", "2026-09-15"]);
  });

  it("uma sessão gravada antes do começo continua feita", () => {
    const grade = montarGrade({
      data: "2026-09-07",
      perfil: COMECOU_EM_14,
      sessoes: [
        { id: "s0", data: "2026-09-07", status: "concluida", workout_id: "A1" },
      ],
      hoje: QUARTA,
    });
    expect(grade[0]).toMatchObject({ marca: "feito", sessaoId: "s0" });
  });

  it("sem `data_inicio` a regra antiga continua valendo", () => {
    const grade = montarGrade({ data: "2026-09-07", perfil: PERFIL, hoje: QUARTA });
    expect(grade.some((d) => d.marca === "faltou")).toBe(true);
  });
});

describe("mês em miniatura (SPEC §3.5)", () => {
  const mes = montarMes("2026-09-14", PERFIL, [], [], [], SEMANA_1);

  it("é uma grade de semanas de segunda a domingo", () => {
    expect(mes.every((semana) => semana.length === 7)).toBe(true);
    expect(mes[0]?.[0]?.data).toBe("2026-08-31"); // a semana que contém 1/09
  });

  it("cobre o mês inteiro e marca o que é de fora", () => {
    const todos = mes.flat();
    const doMes = todos.filter((d) => d.doMes);
    expect(doMes.length).toBe(30);
    expect(todos.some((d) => !d.doMes)).toBe(true);
  });

  it("marca o dia de hoje e o tipo de cada dia", () => {
    const todos = mes.flat();
    expect(todos.filter((d) => d.ehHoje).length).toBe(1);
    expect(todos.find((d) => d.data === SEMANA_1)?.tipo).toBe("forca");
    expect(todos.find((d) => d.data === "2026-09-15")?.tipo).toBe("cardio");
    expect(todos.find((d) => d.data === "2026-09-17")?.tipo).toBe("descanso");
  });
});

describe("semana curta vira overrides (SPEC §5.4)", () => {
  const planejada = semanaDoPlano(SEMANA_1, PERFIL);
  const resultado = semanaCurta(SEMANA_1, planejada);
  const novos = overridesDaSemanaCurta(planejada, resultado.dias, SEMANA_1, "chuva");

  it("só grava os dias que realmente mudaram", () => {
    expect(novos.map((n) => n.data)).toEqual([
      "2026-09-14",
      "2026-09-16",
      "2026-09-17",
    ]);
  });

  it("o dia marcado vira descanso e o treino é remarcado para depois", () => {
    expect(novos[0]).toMatchObject({ data: SEMANA_1, tipo: "descanso", workout_id: null });
    // a alternância se reencadeia: quarta A, quinta B
    expect(novos[1]).toMatchObject({ tipo: "forca", workout_id: "A1" });
    expect(novos[2]).toMatchObject({ tipo: "forca", workout_id: "B1" });
  });

  it("o motivo entra em todas as linhas e a descrição explica a troca", () => {
    expect(novos.every((n) => n.motivo === "chuva")).toBe(true);
    expect(novos[0]?.descricao).toBe("14/09 · Treino A → Descanso");
  });

  it("nunca mexe em dia anterior ao marcado", () => {
    const naSexta = "2026-09-18";
    const daSexta = overridesDaSemanaCurta(
      planejada,
      semanaCurta(naSexta, planejada).dias,
      naSexta,
    );
    expect(daSexta.every((n) => n.data >= naSexta)).toBe(true);
  });
});

describe("intervalo da semana", () => {
  it("vai de segunda a domingo", () => {
    expect(intervaloDaSemana("2026-09-17")).toEqual({
      de: "2026-09-14",
      ate: "2026-09-20",
    });
  });
});

describe("grade — a rota do dia de cardio (SPEC §3.3)", () => {
  it("guarda o tipo da sessão de cardio registrada, não só o id", () => {
    const perfil = { fase_atual: "fase1", ultimo_treino: null, fase_desde: "2026-09-14" } as const;
    const grade = montarGrade({
      data: "2026-09-15",
      perfil,
      cardios: [{ id: "c1", data: "2026-09-15", tipo: "corda", concluida: true }],
      hoje: "2026-09-16",
    });
    const terca = grade.find((d) => d.data === "2026-09-15");
    expect(terca?.marca).toBe("feito");
    expect(terca?.sessaoId).toBe("c1");
    expect(terca?.sessaoTipo).toBe("corda");
    // dia de força não tem tipo de cardio
    expect(grade.find((d) => d.data === "2026-09-14")?.sessaoTipo).toBeNull();
  });
});

describe("faixa da semana (SPEC §13.3)", () => {
  const sessoes = [
    { id: "s1", data: "2026-09-14", status: "concluida" as const, workout_id: "A1" as const },
  ];
  const cardios = [
    { id: "c1", data: "2026-09-15", tipo: "corrida" as const, concluida: true },
  ];

  it("são sete casas, de segunda a domingo, com o dia do mês", () => {
    const faixa = faixaDaSemana(
      montarGrade({ data: SEMANA_1, perfil: PERFIL, hoje: SEMANA_1 }),
    );
    expect(faixa).toHaveLength(7);
    // "sáb" com acento, igual ao calendário (SPEC §22.1)
    expect(faixa.map((d) => d.rotulo)).toEqual([
      "seg",
      "ter",
      "qua",
      "qui",
      "sex",
      "sáb",
      "dom",
    ]);
    expect(faixa.map((d) => d.numero)).toEqual([14, 15, 16, 17, 18, 19, 20]);
  });

  it("marca ✓ no que foi feito, ponto no planejado e cinza no que faltou", () => {
    const hoje = "2026-09-16";
    const faixa = faixaDaSemana(
      montarGrade({ data: hoje, perfil: PERFIL, sessoes, cardios, hoje }),
    );
    expect(faixa[0]?.marca).toBe("feito"); // segunda: treino concluído
    expect(faixa[1]?.marca).toBe("feito"); // terça: corrida concluída
    expect(faixa[2]?.marca).toBe("aberto"); // quarta: é hoje, ainda a fazer
    expect(faixa[2]?.ehHoje).toBe(true);
    expect(faixa[3]?.marca).toBe("descanso");
    expect(faixa[4]?.marca).toBe("aberto");
  });

  it("um dia de força passado sem sessão fica como faltou", () => {
    const hoje = "2026-09-18";
    const faixa = faixaDaSemana(montarGrade({ data: hoje, perfil: PERFIL, hoje }));
    expect(faixa[0]?.marca).toBe("faltou");
  });

  it("o título conta o dia, a data, o que era e como ficou", () => {
    // a sessão A1 da segunda é a de hoje, então o perfil já a contabilizou
    // (§16.2 item 2): a segunda mostra o A feito e a quarta projeta o B.
    const faixa = faixaDaSemana(
      montarGrade({
        data: SEMANA_1,
        perfil: { ...PERFIL, ultimo_treino: "A1" },
        sessoes,
        hoje: SEMANA_1,
      }),
    );
    // SPEC §16.3: o nome completo do dia e do treino, para o leitor de tela
    expect(faixa[0]?.titulo).toBe("segunda 14/09: Treino A, hoje");
    expect(faixa[2]?.titulo).toBe("quarta 16/09: Treino B, a fazer");
  });
});


describe("a grade é coerente com a aba Treino (SPEC §16.2)", () => {
  /* O caso do defeito: quarta 30/09/2026, ultimo_treino A1, uma sessão A1
   * concluída na segunda 28/09. */
  const QUARTA = "2026-09-30";
  const perfil: PerfilCalendario = { ...PERFIL, ultimo_treino: "A1" };
  const sessoes = [
    {
      id: "s1",
      data: "2026-09-28",
      status: "concluida" as const,
      workout_id: "A1" as const,
    },
  ];

  const grade = montarGrade({ data: QUARTA, perfil, sessoes, hoje: QUARTA });

  it("a segunda mostra o treino que foi feito, com ✓", () => {
    expect(grade[0]).toMatchObject({ rotulo: "Treino A", marca: "feito", simbolo: "✓" });
  });

  it("hoje e a sexta seguem a alternância a partir de hoje", () => {
    expect(grade[2]).toMatchObject({ rotulo: "Treino B", ehHoje: true });
    expect(grade[4]?.rotulo).toBe("Treino A");
  });

  it("depois de treinar hoje, o dia mostra o que foi feito e a sexta não desloca", () => {
    // auditoria: quarta 30/09 com a sessão B1 de hoje já concluída
    const depois = montarGrade({
      data: QUARTA,
      perfil: { ...PERFIL, ultimo_treino: "B1" },
      sessoes: [
        ...sessoes,
        { id: "s2", data: QUARTA, status: "concluida" as const, workout_id: "B1" as const },
      ],
      hoje: QUARTA,
    });
    expect(depois[0]?.rotulo).toBe("Treino A");
    expect(depois[2]).toMatchObject({ rotulo: "Treino B", marca: "feito", ehHoje: true });
    expect(depois[4]?.rotulo).toBe("Treino A");
    expect(faixaDaSemana(depois)[2]?.titulo).toBe("quarta 30/09: Treino B, hoje");
  });

  it("a semana seguinte continua a escada", () => {
    const proxima = montarGrade({ data: "2026-10-05", perfil, sessoes, hoje: QUARTA });
    expect(proxima.filter((d) => d.dia.tipo === "forca").map((d) => d.rotulo)).toEqual([
      "Treino B",
      "Treino A",
      "Treino B",
    ]);
  });

  it("os rótulos com a semana da fase entram nos cards", () => {
    // fase_desde 14/09 → a semana de 28/09 é a 3ª
    expect(grade[0]?.semanaDaFase).toBe(3);
    expect(grade[0]?.rotuloLongo).toBe("Treino A · semana 3");
    expect(grade[1]?.rotuloLongo).toBe("Corrida · semana 1 do plano");
    expect(grade[3]?.rotuloLongo).toBe("Descanso");
  });

  it("a faixa traz a sigla do treino de cada dia", () => {
    expect(faixaDaSemana(grade).map((d) => d.treino)).toEqual([
      "A",
      "Corr.",
      "B",
      "Desc.",
      "A",
      "Corr.",
      "Desc.",
    ]);
  });

  it("na Fase 2 as siglas são as do dia fixo, com a corrida longa de sábado", () => {
    const f2 = montarGrade({
      data: QUARTA,
      perfil: { ...PERFIL, fase_atual: "fase2", ultimo_treino: "IB" },
      hoje: QUARTA,
    });
    expect(faixaDaSemana(f2).map((d) => d.treino)).toEqual([
      "SA",
      "IA",
      "Corr.",
      "SB",
      "IB",
      "Longa",
      "Desc.",
    ]);
  });
});

describe("rótulos curtos e semana da fase (SPEC §16.3 e §16.4)", () => {
  const semana = montarGrade({ data: SEMANA_1, perfil: PERFIL, hoje: SEMANA_1 });

  it("um dia de força sem treino conhecido é só um dia de força", () => {
    const desconhecido = { ...semana[0]!.dia, treinoId: null, treino: null };
    expect(rotuloDoDia(desconhecido)).toBe("Treino de força");
    expect(siglaDoDia(desconhecido)).toBe("Força");
  });

  it("o cabeçalho do calendário conta a fase e a semana da fase", () => {
    expect(rotuloDaFase("fase1", 3)).toBe("Fase 1 · semana 3 de 12");
    expect(rotuloDaFase("fase2", 5)).toBe("Fase 2 · semana 5");
  });

  /*
   * SPEC §22.8 item 1: quem fica na Fase 1 depois da semana 12 lia
   * "Fase 1 · semana 16 de 12" — numerador maior que o denominador.
   */
  it("passada a semana 12 a Fase 1 não inventa fração impossível", () => {
    expect(rotuloDaFase("fase1", 12)).toBe("Fase 1 · semana 12 de 12");
    expect(rotuloDaFase("fase1", 13)).toBe("Fase 1 · 12 de 12 concluída");
    expect(rotuloDaFase("fase1", 16)).toBe("Fase 1 · 12 de 12 concluída");
    for (const semana of [13, 16, 40]) {
      const [numerador, denominador] = [
        ...rotuloDaFase("fase1", semana).matchAll(/(\d+) de (\d+)/g),
      ]
        .flatMap((m) => [Number(m[1]), Number(m[2])])
        .slice(0, 2);
      expect(numerador ?? 0).toBeLessThanOrEqual(denominador ?? 0);
    }
    // a Fase 2 não tem total: ela continua contando para sempre
    expect(rotuloDaFase("fase2", 30)).toBe("Fase 2 · semana 30");
  });

  it("faseCumprida avisa a tela quando a Fase 1 cobriu o plano", () => {
    expect(faseCumprida("fase1", 11)).toBe(false);
    expect(faseCumprida("fase1", 12)).toBe(true);
    expect(faseCumprida("fase1", 16)).toBe(true);
    expect(faseCumprida("fase2", 30)).toBe(false);
  });

  /*
   * Auditoria do marco Semana: hoje é a semana 1 da fase, então um toque em
   * "‹" já mostra a semana anterior ao começo dela. Ali não existe "semana N"
   * — antes, o cabeçalho dizia "Fase 1 · semana 0 de 12" e os cards "Treino de
   * força · semana 0" (e "semana −1" mais atrás).
   */
  it("antes do começo da fase não inventa semana 0 nem semana negativa", () => {
    expect(rotuloDaFase("fase1", 0)).toBe("Fase 1");
    expect(rotuloDaFase("fase1", -1)).toBe("Fase 1");
    expect(rotuloDaFase("fase2", 0)).toBe("Fase 2");

    const anterior = montarGrade({
      data: "2026-09-07",
      perfil: PERFIL,
      hoje: SEMANA_1,
    });
    expect(anterior.map((d) => d.rotuloLongo)).not.toContain("Treino A · semana 0");
    for (const d of anterior) {
      expect(d.rotuloLongo).not.toMatch(/semana (0|-\d)/);
      expect(d.rotuloLongo).toBe(d.rotulo);
    }
    // e a semana da fase corrente continua contando normalmente
    const corrente = montarGrade({ data: SEMANA_1, perfil: PERFIL, hoje: SEMANA_1 });
    expect(corrente[0]?.rotuloLongo).toBe("Treino A · semana 1");
  });
});

describe("treino feito num dia de descanso (SPEC §16.2 e §5.3)", () => {
  /* quinta 17/09: descanso no programa da Fase 1 */
  const QUINTA = "2026-09-17";

  it("a quinta em que ele treinou mostra a sigla do treino e o ✓", () => {
    const grade = montarGrade({
      data: SEMANA_1,
      perfil: PERFIL,
      hoje: "2026-09-20",
      sessoes: [
        { id: "s1", data: QUINTA, status: "concluida", workout_id: "A1" },
      ],
    });
    const quinta = grade[3];
    expect(quinta?.data).toBe(QUINTA);
    expect(quinta?.sigla).toBe("A");
    expect(quinta?.rotulo).toBe("Treino A");
    expect(quinta?.marca).toBe("feito");
    expect(quinta?.sessaoId).toBe("s1");
  });

  it("o cardio feito no domingo marca o dia e mostra a sigla do cardio", () => {
    const grade = montarGrade({
      data: SEMANA_1,
      perfil: PERFIL,
      hoje: "2026-09-20",
      cardios: [{ id: "c1", data: "2026-09-20", tipo: "corrida", concluida: true }],
    });
    const domingo = grade[6];
    expect(domingo?.marca).toBe("feito");
    expect(domingo?.sessaoTipo).toBe("corrida");
    /*
     * SPEC §22.2 item 5: o dia de descanso em que houve cardio passa a ser o
     * cardio que foi feito — antes ganhava o ✓ mas continuava dizendo "Desc.".
     */
    expect(domingo?.sigla).toBe("Corr.");
    expect(domingo?.rotulo).toBe("Corrida");
    expect(domingo?.dia.tipo).toBe("cardio");
  });

  it("a corda feita no descanso vira 'Corda'; 'outro' não mexe no dia", () => {
    const comCorda = montarGrade({
      data: SEMANA_1,
      perfil: PERFIL,
      hoje: "2026-09-20",
      cardios: [{ id: "c2", data: "2026-09-20", tipo: "corda", concluida: true }],
    });
    expect(comCorda[6]?.sigla).toBe("Corda");
    expect(comCorda[6]?.rotulo).toBe("Corda");

    const comOutro = montarGrade({
      data: SEMANA_1,
      perfil: PERFIL,
      hoje: "2026-09-20",
      cardios: [{ id: "c3", data: "2026-09-20", tipo: "outro", concluida: true }],
    });
    // "outro" não tem sessão no plano nem sigla: o domingo continua descanso
    expect(comOutro[6]?.sigla).toBe("Desc.");
    expect(comOutro[6]?.marca).toBe("feito");
  });

  it("um cardio no futuro não reescreve o dia de descanso", () => {
    const grade = montarGrade({
      data: SEMANA_1,
      perfil: PERFIL,
      hoje: "2026-09-16",
      cardios: [{ id: "c4", data: "2026-09-20", tipo: "corrida", concluida: true }],
    });
    // 20/09 ainda não chegou: a semana projeta o plano, não o registro
    expect(grade[6]?.sigla).toBe("Desc.");
  });

  it("uma sessão abandonada no descanso fica como parcial", () => {
    const grade = montarGrade({
      data: SEMANA_1,
      perfil: PERFIL,
      hoje: "2026-09-20",
      sessoes: [
        { id: "s2", data: QUINTA, status: "abandonada", workout_id: "B1" },
      ],
    });
    expect(grade[3]?.marca).toBe("parcial");
    expect(grade[3]?.sigla).toBe("B");
  });

  it("a quinta vazia continua descanso, sem marca", () => {
    const grade = montarGrade({ data: SEMANA_1, perfil: PERFIL, hoje: "2026-09-20" });
    expect(grade[3]?.marca).toBe("descanso");
    expect(grade[3]?.sigla).toBe("Desc.");
  });
});

/**
 * SPEC §22.6 item 9: a legenda da faixa é contrato. A versão escrita à mão
 * explicava quatro glifos para as cinco marcas de `MarcaDoDia` — "parcial",
 * que `montarGrade` emite de verdade (a sessão começada e não concluída),
 * ficava de fora. Estes testes comparam a legenda com o conjunto de marcas,
 * para a próxima marca nova não passar despercebida.
 */
describe("a legenda da faixa da semana", () => {
  const MARCAS: MarcaDoDia[] = [
    "feito",
    "parcial",
    "faltou",
    "aberto",
    "descanso",
    "antes",
  ];
  /* "antes" é a AUSÊNCIA de marca (§22.8 item 11): não desenha, não entra */
  const DESENHADAS: MarcaVisivel[] = [
    "feito",
    "parcial",
    "faltou",
    "aberto",
    "descanso",
  ];

  it("tem um nome para cada marca e um glifo para cada marca desenhada", () => {
    expect(Object.keys(NOME_DA_MARCA).sort()).toEqual([...MARCAS].sort());
    expect(Object.keys(SIMBOLO).sort()).toEqual([...MARCAS].sort());
    expect(Object.keys(GLIFO_DA_MARCA).sort()).toEqual([...DESENHADAS].sort());
    expect([...ORDEM_DA_LEGENDA].sort()).toEqual([...DESENHADAS].sort());
    expect(new Set(Object.values(GLIFO_DA_MARCA)).size).toBe(DESENHADAS.length);
    /* a marca que não desenha também não escreve nada na grade da semana */
    expect(SIMBOLO.antes).toBe("");
  });

  it("cita todas as marcas, com o nome que o leitor de tela usa", () => {
    for (const marca of DESENHADAS) {
      expect(LEGENDA_DA_FAIXA, marca).toContain(
        `${GLIFO_DA_MARCA[marca]} ${NOME_DA_MARCA[marca]}`,
      );
    }
    expect(LEGENDA_DA_FAIXA).toBe(
      "✓ feito · ◉ parcial · ○ a fazer · ● faltou · — descanso · hoje em destaque",
    );
  });

  it("não promete um desenho que a faixa use para duas coisas", () => {
    /* o ponto cheio é de "faltou" e de mais ninguém — hoje por fazer é anel */
    expect(GLIFO_DA_MARCA.faltou).not.toBe(GLIFO_DA_MARCA.aberto);
    expect(GLIFO_DA_MARCA.parcial).not.toBe(GLIFO_DA_MARCA.feito);
  });
});
