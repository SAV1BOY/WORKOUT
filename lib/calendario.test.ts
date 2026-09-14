import { describe, expect, it } from "vitest";
import {
  adiarFase2,
  avancarSemanaCardio,
  avancarSemanaDeCorrida,
  diaDaSemana,
  oQueFaltaNaSemana,
  proximoTreinoAlternado,
  semanaCurta,
  semanaDaFase,
  semanaDoPlano,
  sessaoCardioDeHoje,
  sugerirFase2,
  tipoDoDia,
  treinoDeHoje,
  treinosComAgachamentoOuTerra,
  type ExcecaoAgenda,
  type PerfilCalendario,
} from "@/lib/calendario";

const INICIO = "2026-09-14"; // segunda-feira, começo da Fase 1 (SPEC §1)

function perfil(patch: Partial<PerfilCalendario> = {}): PerfilCalendario {
  return {
    fase_atual: "fase1",
    fase_desde: INICIO,
    ultimo_treino: null,
    semana_corrida: 1,
    semana_corda: 1,
    semana_fixa: 1,
    ...patch,
  };
}

describe("dias e semanas", () => {
  it("14/09/2026 é segunda e a semana começa na segunda", () => {
    expect(diaDaSemana(INICIO)).toBe("seg");
    expect(diaDaSemana("2026-09-20")).toBe("dom");
    expect(semanaDoPlano(INICIO, perfil()).map((d) => d.dia)).toEqual([
      "seg",
      "ter",
      "qua",
      "qui",
      "sex",
      "sab",
      "dom",
    ]);
    // o domingo 20/09 pertence à semana que começa em 14/09
    expect(semanaDoPlano("2026-09-20", perfil())[0]?.data).toBe(INICIO);
  });

  it("semana da fase conta a partir da segunda de fase_desde", () => {
    expect(semanaDaFase(INICIO, INICIO)).toBe(1);
    expect(semanaDaFase("2026-09-20", INICIO)).toBe(1);
    expect(semanaDaFase("2026-09-21", INICIO)).toBe(2);
    expect(semanaDaFase("2026-12-07", INICIO)).toBe(13);
  });
});

describe("tipoDoDia e treinoDeHoje (SPEC §5.2)", () => {
  it("14/09/2026, segunda → dia de força, Treino A1", () => {
    const hoje = treinoDeHoje(INICIO, perfil());
    expect(hoje.tipo).toBe("forca");
    expect(hoje.treinoId).toBe("A1");
    expect(hoje.treino?.nome).toBe("Treino A");
    expect(hoje.origem).toBe("programa");
  });

  it("15/09, terça → cardio: corrida da semana 1, 8 × (1 min / 2 min)", () => {
    const hoje = treinoDeHoje("2026-09-15", perfil());
    expect(hoje.tipo).toBe("cardio");
    expect(hoje.treinoId).toBe(null);
    const sessao = sessaoCardioDeHoje("2026-09-15", perfil());
    expect(sessao?.tipo).toBe("corrida");
    expect(sessao?.semana).toBe(1);
    expect(sessao?.descricao).toBe("8 × (1 min corrida / 2 min caminhada)");
    expect(sessao?.corrida?.blocos).toHaveLength(8);
    expect(sessao?.permiteCorda).toBe(false);
  });

  it("sábado da Fase 1 aceita corda no lugar da corrida", () => {
    const sessao = sessaoCardioDeHoje("2026-09-19", perfil());
    expect(sessao?.permiteCorda).toBe(true);
    expect(sessao?.corda).not.toBe(null);
  });

  it("quinta e domingo são descanso, com o lembrete do guia", () => {
    const quinta = treinoDeHoje("2026-09-17", perfil());
    expect(quinta.tipo).toBe("descanso");
    expect(quinta.nota).toContain("barra fixa");
    expect(sessaoCardioDeHoje("2026-09-17", perfil())).toBe(null);
  });

  it("alternância A → B → A a partir do último treino (Fase 1)", () => {
    expect(proximoTreinoAlternado(null)).toBe("A1");
    expect(proximoTreinoAlternado("A1")).toBe("B1");
    expect(proximoTreinoAlternado("B1")).toBe("A1");
    expect(treinoDeHoje("2026-09-16", perfil({ ultimo_treino: "A1" })).treinoId).toBe(
      "B1",
    );
    const semana = semanaDoPlano(INICIO, perfil());
    expect(semana.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "A1",
      "B1",
      "A1",
    ]);
    // semana seguinte, depois de fechar com A1: B-A-B
    const proxima = semanaDoPlano("2026-09-21", perfil({ ultimo_treino: "A1" }));
    expect(proxima.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "B1",
      "A1",
      "B1",
    ]);
  });

  it("Fase 2: segunda é Superior A, terça Inferior A, sem alternância", () => {
    const p = perfil({ fase_atual: "fase2", ultimo_treino: "IB" });
    expect(treinoDeHoje(INICIO, p).treinoId).toBe("SA");
    expect(treinoDeHoje("2026-09-15", p).treinoId).toBe("IA");
    expect(treinoDeHoje("2026-09-16", p).tipo).toBe("cardio");
    expect(treinoDeHoje("2026-09-17", p).treinoId).toBe("SB");
    expect(treinoDeHoje("2026-09-18", p).treinoId).toBe("IB");
  });

  it("o override vence o programa", () => {
    const overrides: ExcecaoAgenda[] = [
      { data: "2026-09-15", tipo: "forca", workout_id: "B1", sessao: null },
      { data: "2026-09-16", tipo: "descanso", workout_id: null, sessao: null },
    ];
    const terca = treinoDeHoje("2026-09-15", perfil(), overrides);
    expect(terca.tipo).toBe("forca");
    expect(terca.treinoId).toBe("B1");
    expect(terca.origem).toBe("override");
    expect(tipoDoDia("2026-09-16", "fase1", overrides).tipo).toBe("descanso");
    // override de força sem treino escolhido segue a alternância
    const semTreino: ExcecaoAgenda[] = [
      { data: "2026-09-17", tipo: "forca", workout_id: null, sessao: null },
    ];
    expect(treinoDeHoje("2026-09-17", perfil(), semTreino).treinoId).toBe("A1");
  });
});

describe("semanas dos planos de cardio (SPEC §5.5)", () => {
  it("2 sessões na semana civil avançam; 0 ou 1 repetem", () => {
    expect(avancarSemanaCardio(3, 2)).toBe(4);
    expect(avancarSemanaCardio(3, 1)).toBe(3);
    expect(avancarSemanaCardio(3, 0)).toBe(3);
    expect(avancarSemanaCardio(3, 5)).toBe(4);
  });

  it("a corrida não passa da semana 12 do plano", () => {
    expect(avancarSemanaDeCorrida(11, 2)).toBe(12);
    expect(avancarSemanaDeCorrida(12, 2)).toBe(12);
  });

  it("acima do teto do plano, o clamp segura mas nunca volta atrás (SPEC §5.5)", () => {
    // Semana ajustada à mão no perfil (§3.3/§3.9): cumprir as duas sessões não
    // pode valer menos que não fazer nenhuma ("a semana do plano não muda").
    expect(avancarSemanaDeCorrida(13, 0)).toBe(13);
    expect(avancarSemanaDeCorrida(13, 2)).toBe(13);
    expect(avancarSemanaCardio(20, 2, { maximo: 12 })).toBe(20);
  });
});

describe("sugestão da Fase 2 (SPEC §5.1)", () => {
  it("sugere com 12 semanas e 30 sessões", () => {
    const r = sugerirFase2(perfil(), 30, "2026-12-07");
    expect(r.semanas).toBe(12);
    expect(r.sugerir).toBe(true);
  });

  it("não sugere antes de 12 semanas nem com menos de 30 sessões", () => {
    expect(sugerirFase2(perfil(), 40, "2026-11-30").sugerir).toBe(false);
    expect(sugerirFase2(perfil(), 29, "2026-12-07").sugerir).toBe(false);
  });

  it("adiar segura a sugestão por 2 semanas", () => {
    const ate = adiarFase2("2026-12-07");
    expect(ate).toBe("2026-12-21");
    const p = perfil({ prefs: { fase2_adiada_ate: ate } });
    expect(sugerirFase2(p, 30, "2026-12-14").sugerir).toBe(false);
    expect(sugerirFase2(p, 30, "2026-12-21").sugerir).toBe(true);
  });

  it("quem já está na Fase 2 não recebe sugestão", () => {
    expect(sugerirFase2(perfil({ fase_atual: "fase2" }), 99, "2027-01-01").sugerir).toBe(
      false,
    );
  });
});

describe("semana curta (SPEC §5.4)", () => {
  it("os treinos com agachamento ou terra são A1, B1, IA e IB", () => {
    expect(treinosComAgachamentoOuTerra()).toEqual(["A1", "B1", "IA", "IB"]);
  });

  it("um dia a menos: nada é cortado, a semana se reorganiza", () => {
    const semana = semanaDoPlano(INICIO, perfil());
    const r = semanaCurta("qua", semana);
    expect(r.cortados).toHaveLength(0);
    const forca = r.dias.filter((d) => d.tipo === "forca");
    expect(forca.map((d) => d.treinoId)).toEqual(["A1", "B1", "A1"]);
    expect(r.dias.find((d) => d.dia === "qua")?.tipo).toBe("descanso");
    expect(forca.map((d) => d.dia)).toEqual(["seg", "qui", "sex"]);
  });

  it("semana de três dias: corta a corrida de sábado e a outra sessão de cardio", () => {
    const semana = semanaDoPlano(INICIO, perfil());
    const r = semanaCurta(["ter", "qui", "sab", "dom"], semana);
    expect(r.cortados.map((c) => c.tipo)).toEqual(["cardio", "cardio"]);
    expect(r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "A1",
      "B1",
      "A1",
    ]);
    expect(r.dias.some((d) => d.tipo === "cardio")).toBe(false);
  });

  it("sobrando um dia só, fica o Treino A", () => {
    const semana = semanaDoPlano(INICIO, perfil());
    const r = semanaCurta(["ter", "qua", "qui", "sex", "sab", "dom"], semana);
    const sobrou = r.dias.filter((d) => d.tipo !== "descanso");
    expect(sobrou).toHaveLength(1);
    expect(sobrou[0]?.treinoId).toBe("A1");
    expect(r.cortados).toHaveLength(4);
  });

  it("o treino escolhido num override não é reescrito; a alternância se reencadeia (SPEC §5.2 item 1)", () => {
    const p = perfil({ ultimo_treino: "A1" });
    const ov: ExcecaoAgenda[] = [
      { data: "2026-09-16", tipo: "forca", workout_id: "B1", sessao: null },
    ];
    const semana = semanaDoPlano(INICIO, p, ov);
    expect(semana.find((d) => d.dia === "qua")?.treinoId).toBe("B1");

    for (const marcados of [[], ["dom"], ["seg"]]) {
      const r = semanaCurta(marcados as never, semana);
      const qua = r.dias.find((d) => d.dia === "qua");
      expect(qua?.treinoId).toBe("B1");
      expect(qua?.min).toBe(45);
      // e os dias de programa alternam ao redor dele
      const forca = r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId);
      for (let i = 1; i < forca.length; i++) expect(forca[i]).not.toBe(forca[i - 1]);
    }
  });

  it("override sem workout_id segue a alternância (SPEC §5.3: 'vale como o próximo treino')", () => {
    const p = perfil({ ultimo_treino: "A1" });
    const ov: ExcecaoAgenda[] = [
      { data: "2026-09-16", tipo: "forca", workout_id: null, sessao: null },
    ];
    const r = semanaCurta("seg", semanaDoPlano(INICIO, p, ov));
    const forca = r.dias.filter((d) => d.tipo === "forca");
    expect(forca.map((d) => d.treinoId)).toEqual(["A1", "B1", "A1"]);
  });

  it("nunca corta o treino com agachamento ou terra antes dos outros", () => {
    const p = perfil({ fase_atual: "fase2" });
    const semana = semanaDoPlano(INICIO, p);
    const r = semanaCurta(["qua", "sab", "dom", "sex"], semana);
    const restantes = r.dias
      .filter((d) => d.tipo === "forca")
      .map((d) => d.treinoId);
    expect(restantes).toContain("IA");
    expect(restantes).toContain("IB");
    expect(restantes).not.toContain("SB");
  });
});

describe("o que falta na semana", () => {
  it("separa feitos, pendentes e perdidos", () => {
    const semana = semanaDoPlano(INICIO, perfil());
    const r = oQueFaltaNaSemana(
      semana,
      [
        { data: INICIO, tipo: "forca", concluida: true },
        { data: "2026-09-15", tipo: "cardio", concluida: false },
      ],
      "2026-09-16",
    );
    expect(r.feitos.map((d) => d.dia)).toEqual(["seg"]);
    expect(r.perdidos.map((d) => d.dia)).toEqual(["ter"]);
    expect(r.faltando.map((d) => d.dia)).toEqual(["qua", "sex", "sab"]);
    expect(r.total).toBe(5);
  });
});
