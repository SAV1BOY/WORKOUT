/**
 * Lembretes II (SPEC §23.9–23.10, aceite §23.14 itens 1 e 2): as preferências
 * de hora e a regra pura de quem recebe o quê agora.
 *
 * As datas: 21/09/2026 é segunda (força na Fase 1), 22/09 terça (corrida),
 * 24/09 quinta (descanso). São Paulo é UTC−3: 07:00 lá = 10:00Z.
 */
import { describe, expect, it } from "vitest";
import { treinoDeHoje } from "@/lib/calendario";
import { resumoDoTreino } from "@/lib/hoje";
import {
  LEMBRETES_PADRAO,
  comLembretes,
  eventosDoCalendario,
  lembreteDoDia,
  lembretesDasPrefs,
  lembretesDevidos,
  proximoLembrete,
  relogioDeSaoPaulo,
  textoDoUltimo,
  type ContaDaRegra,
} from "@/lib/lembretes-regra";
import { prefsLembretesSchema } from "@/lib/schemas";

const LIGADOS = {
  treino: { ligado: true, hora: "07:00" },
  corrida: { ligado: true, hora: "18:30" },
};

function conta(extra: Partial<ContaDaRegra> = {}, prefs: Record<string, unknown> = { lembretes: LIGADOS }): ContaDaRegra {
  return {
    perfil: {
      fase_atual: "fase1",
      ultimo_treino: null,
      fase_desde: "2026-09-01",
      data_inicio: "2026-09-01",
      semana_corrida: 3,
      semana_corda: 1,
      semana_fixa: 1,
      prefs,
    },
    overrides: [],
    sessoes: [],
    cardios: [],
    enviados: [],
    ...extra,
  };
}

/** Um instante dado na hora de São Paulo. */
function sp(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00-03:00`);
}

describe("prefsLembretesSchema e as preferências (§23.9)", () => {
  it("sem a chave: os dois desligados às 07:00", () => {
    expect(lembretesDasPrefs({})).toEqual(LEMBRETES_PADRAO);
    expect(lembretesDasPrefs(null)).toEqual({
      treino: { ligado: false, hora: "07:00" },
      corrida: { ligado: false, hora: "07:00" },
    });
  });
  it("hora HH:MM no passo de 5 min, de 00:00 a 23:55", () => {
    const ok = (hora: string) =>
      prefsLembretesSchema.safeParse({ treino: { ligado: true, hora }, corrida: { ligado: false, hora: "07:00" } }).success;
    expect(ok("07:00")).toBe(true);
    expect(ok("23:55")).toBe(true);
    expect(ok("00:05")).toBe(true);
    expect(ok("07:03")).toBe(false);
    expect(ok("24:00")).toBe(false);
    expect(ok("7:00")).toBe(false);
    expect(ok("07:60")).toBe(false);
  });
  it("um tipo estragado volta ao padrão sem derrubar o outro", () => {
    expect(lembretesDasPrefs({ lembretes: { treino: { ligado: "sim", hora: "07:00" }, corrida: LIGADOS.corrida } })).toEqual({
      treino: LEMBRETES_PADRAO.treino,
      corrida: LIGADOS.corrida,
    });
  });
  it("gravar não perde as outras chaves de prefs", () => {
    const prefs = { tema: "escuro" as const, dias_de_treino: ["seg"], manter_tela: false };
    expect(comLembretes(prefs, LIGADOS)).toEqual({ ...prefs, lembretes: LIGADOS });
  });
});

describe("relogioDeSaoPaulo", () => {
  it("lê o dia e a hora em São Paulo, qualquer que seja o fuso do processo", () => {
    expect(relogioDeSaoPaulo(new Date("2026-09-21T10:00:00Z"))).toEqual({ dia: "2026-09-21", minutos: 420, hora: "07:00" });
    // 01:30Z ainda é o dia anterior em São Paulo (22:30)
    expect(relogioDeSaoPaulo(new Date("2026-09-22T01:30:00Z"))).toEqual({ dia: "2026-09-21", minutos: 1350, hora: "22:30" });
  });
});

describe("lembretesDevidos (§23.10)", () => {
  it("dia de treino, na hora exata: o do treino, com o texto da aba Treino", () => {
    const c = conta();
    const devidos = lembretesDevidos(c, sp("2026-09-21", "07:00"));
    expect(devidos).toHaveLength(1);
    const [aviso] = devidos;
    expect(aviso?.tipo).toBe("treino");
    expect(aviso?.dia).toBe("2026-09-21");
    expect(aviso?.payload.titulo).toBe("Hora do treino");
    // a mesma fonte da aba Treino: treinoDeHoje → resumoDoTreino (nome e duração do programa.json)
    const doTreino = treinoDeHoje("2026-09-21", c.perfil, []);
    expect(doTreino.tipo).toBe("forca");
    expect(aviso?.payload.corpo).toBe(resumoDoTreino(doTreino.treinoId!).texto);
    expect(aviso?.payload.corpo).toMatch(/^Treino [AB] · \d+ exercícios · \d+ min$/);
    expect(aviso?.payload.url).toBe("/");
    expect(aviso?.payload.tag).toBe("lembrete-treino");
  });

  it("antes da hora, nada; até 30 min depois, sai; 35 min depois, pula o dia", () => {
    const c = conta();
    expect(lembretesDevidos(c, sp("2026-09-21", "06:55"))).toEqual([]);
    expect(lembretesDevidos(c, sp("2026-09-21", "07:15"))).toHaveLength(1);
    expect(lembretesDevidos(c, sp("2026-09-21", "07:30"))).toHaveLength(1);
    expect(lembretesDevidos(c, sp("2026-09-21", "07:35"))).toEqual([]);
  });

  it("dia de descanso: nada, nem com os dois ligados", () => {
    for (const hora of ["07:00", "18:30"]) {
      expect(lembretesDevidos(conta(), sp("2026-09-24", hora))).toEqual([]);
    }
  });

  it("dia de corrida: o da corrida, na hora dela, com a semana do plano", () => {
    const c = conta();
    expect(lembretesDevidos(c, sp("2026-09-22", "07:00"))).toEqual([]);
    const [aviso] = lembretesDevidos(c, sp("2026-09-22", "18:30"));
    expect(aviso?.tipo).toBe("corrida");
    expect(aviso?.payload.titulo).toBe("Hora da corrida");
    expect(aviso?.payload.corpo).toMatch(/^Corrida · semana 3 · /);
  });

  it("desligado não sai; ligado só o seu tipo", () => {
    const soCorrida = conta({}, { lembretes: { ...LIGADOS, treino: { ligado: false, hora: "07:00" } } });
    expect(lembretesDevidos(soCorrida, sp("2026-09-21", "07:00"))).toEqual([]);
    expect(lembretesDevidos(soCorrida, sp("2026-09-22", "18:30"))).toHaveLength(1);
    expect(lembretesDevidos(conta({}, {}), sp("2026-09-21", "07:00"))).toEqual([]);
  });

  it("'Não vou treinar hoje' (o override de descanso da §5.4): nada", () => {
    const pulado = conta({
      overrides: [{ data: "2026-09-21", tipo: "descanso", workout_id: null, sessao: null }],
    });
    expect(lembretesDevidos(pulado, sp("2026-09-21", "07:00"))).toEqual([]);
    // o override de outro dia não mexe neste
    const outroDia = conta({
      overrides: [{ data: "2026-09-24", tipo: "descanso", workout_id: null, sessao: null }],
    });
    expect(lembretesDevidos(outroDia, sp("2026-09-21", "07:00"))).toHaveLength(1);
  });

  it("um descanso trocado por treino num override passa a ter lembrete", () => {
    const trocado = conta({
      overrides: [{ data: "2026-09-24", tipo: "forca", workout_id: "B1", sessao: null }],
    });
    const [aviso] = lembretesDevidos(trocado, sp("2026-09-24", "07:05"));
    expect(aviso?.payload.corpo).toBe(resumoDoTreino("B1").texto);
  });

  it("treino já concluído hoje: nada; só começado (em andamento) ainda lembra", () => {
    const feito = conta({ sessoes: [{ id: "s1", data: "2026-09-21", status: "concluida", workout_id: "A1" }] });
    expect(lembretesDevidos(feito, sp("2026-09-21", "07:10"))).toEqual([]);
    const aberto = conta({ sessoes: [{ id: "s1", data: "2026-09-21", status: "em_andamento", workout_id: "A1" }] });
    expect(lembretesDevidos(aberto, sp("2026-09-21", "07:10"))).toHaveLength(1);
    const corridaFeita = conta({ cardios: [{ id: "c1", data: "2026-09-22", tipo: "corrida", concluida: true }] });
    expect(lembretesDevidos(corridaFeita, sp("2026-09-22", "18:30"))).toEqual([]);
  });

  it("já enviado hoje: não reenvia; o de ontem não conta", () => {
    const hoje = conta({ enviados: [{ tipo: "treino", dia: "2026-09-21" }] });
    expect(lembretesDevidos(hoje, sp("2026-09-21", "07:10"))).toEqual([]);
    const ontem = conta({ enviados: [{ tipo: "treino", dia: "2026-09-20" }] });
    expect(lembretesDevidos(ontem, sp("2026-09-21", "07:10"))).toHaveLength(1);
  });

  it("o enviado de hoje só bloqueia o mesmo tipo: o dia que virou treino depois de um aviso de corrida ainda lembra", () => {
    // terça 22/09 é corrida; o aviso da corrida já saiu hoje e o dia foi trocado por treino num override
    const trocado = conta({
      overrides: [{ data: "2026-09-22", tipo: "forca", workout_id: "B1", sessao: null }],
      enviados: [{ tipo: "corrida", dia: "2026-09-22" }],
    });
    const devidos = lembretesDevidos(trocado, sp("2026-09-22", "07:10"));
    expect(devidos).toHaveLength(1);
    expect(devidos[0]?.tipo).toBe("treino");
    // e o do próprio tipo, sim, bloqueia
    const mesmoTipo = conta({
      overrides: [{ data: "2026-09-22", tipo: "forca", workout_id: "B1", sessao: null }],
      enviados: [{ tipo: "treino", dia: "2026-09-22" }],
    });
    expect(lembretesDevidos(mesmoTipo, sp("2026-09-22", "07:10"))).toEqual([]);
  });

  it("virada de dia: 23:50 não sai às 00:10 do dia seguinte", () => {
    const tarde = conta({}, { lembretes: { ...LIGADOS, treino: { ligado: true, hora: "23:50" } } });
    // domingo 20/09 é descanso; segunda 21/09 é força: às 00:10 de segunda, 23:50 ainda não chegou
    expect(lembretesDevidos(tarde, sp("2026-09-21", "00:10"))).toEqual([]);
    expect(lembretesDevidos(tarde, sp("2026-09-21", "23:55"))).toHaveLength(1);
    // e à meia-noite e dez de terça (corrida), o treino de segunda já passou
    expect(lembretesDevidos(tarde, sp("2026-09-22", "00:10"))).toEqual([]);
  });
});

describe("o que a tela mostra (§23.13)", () => {
  it("próximo: hoje, se ainda vale; senão o próximo dia do tipo ligado", () => {
    const c = conta();
    expect(proximoLembrete(c, sp("2026-09-21", "06:00"))).toMatch(/^Próximo: hoje às 07:00 — Treino [AB] · /);
    expect(proximoLembrete(c, sp("2026-09-21", "08:00"))).toMatch(/^Próximo: amanhã às 18:30 — Corrida · semana 3/);
    expect(proximoLembrete(conta({}, {}), sp("2026-09-21", "06:00"))).toBeNull();
    // enviado hoje: o próximo é o de amanhã
    const enviado = conta({ enviados: [{ tipo: "treino", dia: "2026-09-21" }] });
    expect(proximoLembrete(enviado, sp("2026-09-21", "07:10"))).toMatch(/^Próximo: amanhã às 18:30/);
  });
  it("próximo: o treino de hoje já concluído antes da hora não promete 'hoje'", () => {
    // concluído às 06:00, antes das 07:00 escolhidas: o próximo é a corrida de amanhã
    const feito = conta({ sessoes: [{ id: "s1", data: "2026-09-21", status: "concluida", workout_id: "A1" }] });
    expect(proximoLembrete(feito, sp("2026-09-21", "06:30"))).toMatch(/^Próximo: amanhã às 18:30 — Corrida/);
    // só começado ainda promete hoje
    const aberto = conta({ sessoes: [{ id: "s1", data: "2026-09-21", status: "em_andamento", workout_id: "A1" }] });
    expect(proximoLembrete(aberto, sp("2026-09-21", "06:30"))).toMatch(/^Próximo: hoje às 07:00 — Treino/);
  });
  it("último lembrete: hoje / ontem / dd/mm, na hora de São Paulo", () => {
    const agora = sp("2026-09-21", "12:00");
    expect(textoDoUltimo([{ enviado_em: "2026-09-21T10:00:12.5+00:00" }], agora)).toBe("Último lembrete: hoje às 07:00");
    expect(textoDoUltimo([{ enviado_em: "2026-09-20T21:35:00Z" }], agora)).toBe("Último lembrete: ontem às 18:35");
    expect(
      textoDoUltimo([{ enviado_em: "2026-09-15T10:00:00Z" }, { enviado_em: "2026-09-18T10:05:00Z" }], agora),
    ).toBe("Último lembrete: 18/09 às 07:05");
    expect(textoDoUltimo([], agora)).toBeNull();
  });
});

describe("lembreteDoDia e o calendário", () => {
  it("os dias vêm do perfil (§17): com outros dias escolhidos, o lembrete muda de dia", () => {
    const semana = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];
    const padrao = (c: ContaDaRegra) =>
      semana.map((d) => lembreteDoDia(c, d, "2026-09-21")?.tipo[0] ?? "-").join("");
    // o programa: seg/qua/sex força, ter/sáb corrida
    expect(padrao(conta())).toBe("tct-tc-");
    // ter, qui e sáb escolhidos em Preferências → Dias de treino
    const escolhidos = conta({}, { lembretes: LIGADOS, dias_de_treino: ["ter", "qui", "sab"] });
    expect(padrao(escolhidos)).toBe("-t-t-t-");
    expect(lembretesDevidos(escolhidos, sp("2026-09-21", "07:00"))).toEqual([]);
    expect(lembretesDevidos(escolhidos, sp("2026-09-22", "07:00"))[0]?.tipo).toBe("treino");
  });
  it("um evento por dia de treino da semana do plano, com a hora de cada tipo", () => {
    const eventos = eventosDoCalendario(conta().perfil, sp("2026-09-21", "09:00"));
    expect(eventos.map((e) => `${e.diaSemana}:${e.tipo}:${e.hora}`)).toEqual([
      "seg:treino:07:00",
      "ter:corrida:18:30",
      "qua:treino:07:00",
      "sex:treino:07:00",
      "sab:corrida:18:30",
    ]);
    for (const e of eventos) expect(e.duracaoMin).toBeGreaterThan(0);
  });
});
