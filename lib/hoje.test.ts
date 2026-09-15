import { describe, expect, it } from "vitest";
import { sessaoCardioDeHoje, type PerfilCalendario } from "@/lib/calendario";
import {
  alternativaDeCorda,
  avisoCorridaEPerna,
  descricaoDoCardio,
  estadosPorExercicio,
  houveCardioHoje,
  previaDoTreino,
  resumoDoTreino,
  sequenciaDeTreinos,
  sessaoAberta,
  statusDoPeso,
  textoDaCarga,
  textoDoCardio,
  textoDoEvento,
  totalDeSoltas,
  ultimoEventoPorExercicio,
} from "@/lib/hoje";
import { treinoDeHoje } from "@/lib/calendario";
import type { LinhaEstadoExercicio } from "@/lib/types";

const PERFIL: PerfilCalendario = {
  fase_atual: "fase1",
  ultimo_treino: null,
  fase_desde: "2026-09-14",
  semana_corrida: 1,
  semana_corda: 1,
  semana_fixa: 1,
};

/** Linha de `exercise_state` com os defaults do schema. */
function estado(
  exercise_id: string,
  campos: Partial<LinhaEstadoExercicio> = {},
): LinhaEstadoExercicio {
  return {
    user_id: "u",
    exercise_id,
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
    ...campos,
  };
}

describe("resumo do treino (SPEC §3.1 e §10.2)", () => {
  it("o Treino A da segunda é 'Treino A · 6 exercícios · 44 min'", () => {
    const r = resumoDoTreino("A1");
    expect(r.texto).toBe("Treino A · 6 exercícios · 44 min");
    expect(r.exercicios).toBe(6);
    expect(r.min).toBe(44);
    expect(r.foco).toBe("agachamento no centro");
  });

  it("o Treino B tem 6 exercícios e 45 min", () => {
    expect(resumoDoTreino("B1").texto).toBe("Treino B · 6 exercícios · 45 min");
  });
});

describe("prévia do treino (SPEC §3.1 com §6.1)", () => {
  it("na primeira vez traz as cargas iniciais com o rótulo de cada implemento", () => {
    const itens = previaDoTreino({ treinoId: "A1" });
    const porId = Object.fromEntries(itens.map((i) => [i.exercicioId, i]));

    expect(porId["agachamento-livre"]?.cargaTexto).toBe("7,5 kg na barra");
    expect(porId["desenvolvimento-com-halteres"]?.cargaTexto).toBe(
      "1,5 kg por halter",
    );
    // peso corporal não vira "0 kg na mochila"
    expect(porId["elevacao-de-pernas-na-barra-fixa"]?.cargaTexto).toBe(
      "peso do corpo",
    );
  });

  it("o Treino B traz os 4 kg no pino da polia", () => {
    const itens = previaDoTreino({ treinoId: "B1" });
    const polia = itens.find((i) => i.exercicioId === "puxada-alta-na-polia");
    expect(polia?.cargaTexto).toBe("4 kg no pino");
  });

  it("a faixa de reps é a do programa, não a do catálogo", () => {
    const itens = previaDoTreino({ treinoId: "A1" });
    const porId = Object.fromEntries(itens.map((i) => [i.exercicioId, i]));
    // programa.json: agachamento 3 × 5, desenvolvimento com halteres 2 × 8–12
    expect(porId["agachamento-livre"]?.alvoTexto).toBe("3 × 5");
    expect(porId["remada-curvada-pronada"]?.alvoTexto).toBe("3 × 6–8");
    expect(porId["desenvolvimento-com-halteres"]?.alvoTexto).toBe("2 × 8–12");
  });

  it("a ordem e a numeração são as do treino", () => {
    const itens = previaDoTreino({ treinoId: "A1" });
    expect(itens.map((i) => i.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(itens[0]?.exercicioId).toBe("agachamento-livre");
  });

  it("com carga no estado e evento, explica por que hoje é esta carga (§6.6)", () => {
    const itens = previaDoTreino({
      treinoId: "A1",
      estados: estadosPorExercicio([
        estado("supino-reto-com-barra", { carga_atual_kg: 9.5 }),
      ]),
      eventos: [
        {
          exercise_id: "supino-reto-com-barra",
          data: "2026-09-12",
          motivo: "subiu",
          de: { carga_kg: 7.5 },
          para: { carga_kg: 9.5 },
        },
      ],
    });
    const supino = itens.find((i) => i.exercicioId === "supino-reto-com-barra");
    expect(supino?.cargaTexto).toBe("9,5 kg na barra");
    expect(supino?.historico).toBe("subiu +2 kg no treino de 12/09");
  });

  it("quem não tem evento fica sem histórico", () => {
    const itens = previaDoTreino({ treinoId: "A1" });
    expect(itens.every((i) => i.historico === null)).toBe(true);
  });
});

describe("texto da carga (SPEC §4)", () => {
  it("usa o rótulo do implemento e a vírgula decimal", () => {
    expect(textoDaCarga("barra_macica", 25.5)).toBe("25,5 kg na barra");
    expect(textoDaCarga("halteres", 11.5)).toBe("11,5 kg por halter");
    expect(textoDaCarga("polia", 12)).toBe("12 kg no pino");
    expect(textoDaCarga("barra_fixa", 2)).toBe("2 kg na mochila");
    expect(textoDaCarga("peso_corporal", 0)).toBe("peso do corpo");
    expect(textoDaCarga("barra_macica", null)).toBe("peso do corpo");
  });
});

describe("texto do evento (SPEC §6.6)", () => {
  const base = { exercise_id: "x", data: "2026-09-12" } as const;

  it("carga que subiu e carga que voltou", () => {
    expect(
      textoDoEvento({ ...base, motivo: "subiu", de: { carga_kg: 7.5 }, para: { carga_kg: 9.5 } }),
    ).toBe("subiu +2 kg no treino de 12/09");
    expect(
      textoDoEvento({
        ...base,
        motivo: "falha_2x_voltou_10",
        de: { carga_kg: 25.5 },
        para: { carga_kg: 23.5 },
      }),
    ).toBe("voltou −2 kg no treino de 12/09");
  });

  it("reps, tempo e elástico", () => {
    expect(
      textoDoEvento({ ...base, motivo: "subiu", de: { reps_alvo: 10 }, para: { reps_alvo: 11 } }),
    ).toBe("subiu +1 repetição no treino de 12/09");
    expect(
      textoDoEvento({ ...base, motivo: "subiu", de: { tempo_alvo_s: 60 }, para: { tempo_alvo_s: 65 } }),
    ).toBe("subiu +5 s no treino de 12/09");
    expect(
      textoDoEvento({
        ...base,
        motivo: "subiu",
        de: { assistencia: "pe_inteiro" },
        para: { assistencia: "joelho" },
      }),
    ).toBe("mudou o elástico no treino de 12/09");
  });

  it("repetiu sem mudar nada ainda explica o dia", () => {
    expect(
      textoDoEvento({ ...base, motivo: "repetiu", de: { carga_kg: 9.5 }, para: { carga_kg: 9.5 } }),
    ).toBe("repetiu a carga no treino de 12/09");
  });

  it("evento vazio não inventa texto", () => {
    expect(textoDoEvento({ ...base, motivo: "manual", de: null, para: null })).toBeNull();
  });

  it("vale sempre o evento mais recente de cada exercício", () => {
    const ultimos = ultimoEventoPorExercicio([
      { exercise_id: "a", data: "2026-09-01", motivo: "subiu", de: null, para: null },
      { exercise_id: "a", data: "2026-09-12", motivo: "repetiu", de: null, para: null },
      { exercise_id: "b", data: "2026-09-05", motivo: "subiu", de: null, para: null },
    ]);
    expect(ultimos["a"]?.data).toBe("2026-09-12");
    expect(ultimos["b"]?.data).toBe("2026-09-05");
  });
});

describe("cardio do dia (SPEC §3.1)", () => {
  it("terça de 15/09/2026 é a corrida da semana 1", () => {
    const sessao = sessaoCardioDeHoje("2026-09-15", PERFIL);
    expect(sessao).not.toBeNull();
    expect(textoDoCardio(sessao!)).toBe(
      "Corrida · semana 1 · 8 × (1 min corrida / 2 min caminhada) · 34 min",
    );
  });

  it("a alternativa da chuva é a corda da semana do perfil", () => {
    const corda = alternativaDeCorda(1);
    expect(descricaoDoCardio(corda)).toBe("6 × 30 s de corda (60 s de descanso)");
    expect(textoDoCardio(corda)).toBe(
      "Corda · semana 1 · 6 × 30 s de corda (60 s de descanso) · 13 min",
    );
  });
});

describe("faixa de status (SPEC §3.1)", () => {
  it("sem peso registrado, pede a pesagem", () => {
    const s = statusDoPeso([], "2026-09-14");
    expect(s.peso).toBeNull();
    expect(s.pedirPesagem).toBe(true);
  });

  it("pesado há 3 dias não pede; há 8 dias pede", () => {
    expect(statusDoPeso([{ data: "2026-09-11", peso_kg: 82.4 }], "2026-09-14")).toMatchObject({
      peso: 82.4,
      dias: 3,
      pedirPesagem: false,
    });
    expect(statusDoPeso([{ data: "2026-09-06", peso_kg: 82.4 }], "2026-09-14").pedirPesagem).toBe(
      true,
    );
  });

  it("vale sempre a pesagem mais recente", () => {
    const s = statusDoPeso(
      [
        { data: "2026-09-01", peso_kg: 80 },
        { data: "2026-09-13", peso_kg: 81.2 },
      ],
      "2026-09-14",
    );
    expect(s.peso).toBe(81.2);
    expect(s.dias).toBe(1);
  });

  it("a sequência conta os treinos concluídos até a primeira quebra", () => {
    expect(
      sequenciaDeTreinos([
        { data: "2026-09-11", status: "concluida" },
        { data: "2026-09-09", status: "concluida" },
        { data: "2026-09-07", status: "abandonada" },
        { data: "2026-09-04", status: "concluida" },
      ]),
    ).toBe(2);
  });

  it("uma sessão ainda aberta não quebra nem conta a sequência", () => {
    expect(
      sequenciaDeTreinos([
        { data: "2026-09-14", status: "em_andamento" },
        { data: "2026-09-11", status: "concluida" },
      ]),
    ).toBe(1);
  });
});

describe("reps soltas e sessão aberta", () => {
  it("soma só as do dia", () => {
    const soltas = [
      { data: "2026-09-14", reps: 1 },
      { data: "2026-09-14", reps: 2 },
      { data: "2026-09-13", reps: 5 },
    ];
    expect(totalDeSoltas(soltas, "2026-09-14")).toBe(3);
  });

  it("o banner mostra a data do treino aberto mais recente", () => {
    const aberta = sessaoAberta([
      { id: "1", data: "2026-09-09", status: "em_andamento", workout_id: "A1" },
      { id: "2", data: "2026-09-12", status: "em_andamento", workout_id: "B1" },
      { id: "3", data: "2026-09-13", status: "concluida", workout_id: "A1" },
    ]);
    expect(aberta?.id).toBe("2");
    expect(aberta?.texto).toBe("Você tem um treino aberto de 12/09");
  });

  it("sem treino aberto, não há banner", () => {
    expect(
      sessaoAberta([{ id: "3", data: "2026-09-13", status: "concluida", workout_id: "A1" }]),
    ).toBeNull();
  });
});

describe("corrida e perna no mesmo dia (SPEC §5.3)", () => {
  it("avisa quando o dia é de corrida e o treino da vez tem agachamento", () => {
    const terca = treinoDeHoje("2026-09-15", PERFIL);
    expect(avisoCorridaEPerna(terca, "A1", false)).toMatch(/6 h/);
  });

  it("não avisa num dia de força sem corrida nenhuma", () => {
    const segunda = treinoDeHoje("2026-09-14", PERFIL);
    expect(avisoCorridaEPerna(segunda, "A1", false)).toBeNull();
  });

  it("avisa no dia de força quando já se correu hoje", () => {
    const segunda = treinoDeHoje("2026-09-14", PERFIL);
    expect(avisoCorridaEPerna(segunda, "A1", true)).not.toBeNull();
  });

  it("sem treino nenhum não avisa", () => {
    const terca = treinoDeHoje("2026-09-15", PERFIL);
    expect(avisoCorridaEPerna(terca, null, true)).toBeNull();
  });

  it("houveCardioHoje olha data, tipo e conclusão", () => {
    const cardios = [
      { data: "2026-09-15", tipo: "corrida" as const, concluida: true },
      { data: "2026-09-16", tipo: "corda" as const, concluida: false },
    ];
    expect(houveCardioHoje(cardios, "2026-09-15", "corrida")).toBe(true);
    expect(houveCardioHoje(cardios, "2026-09-16", "corda")).toBe(false);
    expect(houveCardioHoje(cardios, "2026-09-17")).toBe(false);
  });
});
