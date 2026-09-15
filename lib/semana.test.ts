import { describe, expect, it } from "vitest";
import {
  semanaCurta,
  semanaDoPlano,
  type PerfilCalendario,
} from "@/lib/calendario";
import {
  detalheDoDia,
  faixaDaSemana,
  intervaloDaSemana,
  montarGrade,
  montarMes,
  overridesDaSemanaCurta,
  rotuloDoDia,
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
    const grade = montarGrade(semanaDoPlano(SEMANA_1, PERFIL), [], [], SEMANA_1);
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
    const grade = montarGrade(
      semanaDoPlano(SEMANA_1, { ...PERFIL, ultimo_treino: "A1" }),
      [],
      [],
      SEMANA_1,
    );
    expect(grade.filter((d) => d.dia.tipo === "forca").map((d) => d.rotulo)).toEqual([
      "Treino B",
      "Treino A",
      "Treino B",
    ]);
  });

  it("a terça traz a corrida da semana 1 com os minutos do plano", () => {
    const grade = montarGrade(semanaDoPlano(SEMANA_1, PERFIL), [], [], SEMANA_1);
    expect(grade[1]?.detalhe).toBe(
      "8 × (1 min corrida / 2 min caminhada) · 34 min",
    );
  });

  it("o dia de força mostra quantos exercícios e quanto tempo", () => {
    const grade = montarGrade(semanaDoPlano(SEMANA_1, PERFIL), [], [], SEMANA_1);
    expect(grade[0]?.detalhe).toBe("6 exercícios · 44 min");
  });

  it("marca feito, parcial, faltou e a fazer", () => {
    const hoje = "2026-09-18"; // sexta
    const grade = montarGrade(
      semanaDoPlano(SEMANA_1, PERFIL),
      [
        { id: "s1", data: "2026-09-14", status: "concluida", workout_id: "A1" },
        { id: "s2", data: "2026-09-16", status: "abandonada", workout_id: "B1" },
      ],
      [],
      hoje,
    );
    expect(grade[0]).toMatchObject({ marca: "feito", simbolo: "✓", sessaoId: "s1" });
    expect(grade[1]).toMatchObject({ marca: "faltou", simbolo: "✕" }); // terça sem corrida
    expect(grade[2]).toMatchObject({ marca: "parcial", sessaoId: "s2" });
    expect(grade[3]?.marca).toBe("descanso");
    expect(grade[4]).toMatchObject({ marca: "aberto", ehHoje: true });
    expect(grade[5]?.marca).toBe("aberto");
  });

  it("o cardio concluído marca o dia como feito", () => {
    const grade = montarGrade(
      semanaDoPlano(SEMANA_1, PERFIL),
      [],
      [{ id: "c1", data: "2026-09-15", tipo: "corrida", concluida: true }],
      "2026-09-16",
    );
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
    const semana = semanaDoPlano("2026-09-15", perfil);
    const grade = montarGrade(
      semana,
      [],
      [{ id: "c1", data: "2026-09-15", tipo: "corda", concluida: true }],
      "2026-09-16",
    );
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
      montarGrade(semanaDoPlano(SEMANA_1, PERFIL), [], [], SEMANA_1),
    );
    expect(faixa).toHaveLength(7);
    expect(faixa.map((d) => d.rotulo)).toEqual([
      "seg",
      "ter",
      "qua",
      "qui",
      "sex",
      "sab",
      "dom",
    ]);
    expect(faixa.map((d) => d.numero)).toEqual([14, 15, 16, 17, 18, 19, 20]);
  });

  it("marca ✓ no que foi feito, ponto no planejado e cinza no que faltou", () => {
    const hoje = "2026-09-16";
    const faixa = faixaDaSemana(
      montarGrade(semanaDoPlano(hoje, PERFIL), sessoes, cardios, hoje),
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
    const faixa = faixaDaSemana(montarGrade(semanaDoPlano(hoje, PERFIL), [], [], hoje));
    expect(faixa[0]?.marca).toBe("faltou");
  });

  it("o título conta o dia, a data, o que era e como ficou", () => {
    const faixa = faixaDaSemana(
      montarGrade(semanaDoPlano(SEMANA_1, PERFIL), sessoes, [], SEMANA_1),
    );
    expect(faixa[0]?.titulo).toBe("seg, 14/09 · Treino A · hoje");
    expect(faixa[2]?.titulo).toBe("qua, 16/09 · Treino B · a fazer");
  });
});
