import { describe, expect, it } from "vitest";
import {
  adiarFase2,
  avancarSemanaCardio,
  avancarSemanaDeCorrida,
  diaDaSemana,
  oQueFaltaNaSemana,
  proximoTreinoAlternado,
  semanaCoerente,
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
    // SPEC §5.2 item 3: o último treino foi A1, então a semana (curta ou não)
    // começa em B1. Este teste esperava ["A1", "B1", "A1"] — a escada
    // reancorada no treino que sobrou no primeiro dia disponível, que fazia a
    // semana recomeçar pelo mesmo treino já feito. Corrigido na rodada 5.
    expect(forca.map((d) => d.treinoId)).toEqual(["B1", "A1", "B1"]);
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

describe("semana curta — remanejo (SPEC §3.5 com §5.2 item 3 e §5.4)", () => {
  it("a escada da Fase 1 continua ancorada no ultimo_treino do perfil, a partir de HOJE", () => {
    for (const ultimo of ["A1", "B1"] as const) {
      /*
       * SPEC §16.2 item 3: a âncora vale para HOJE e para os dias seguintes —
       * aqui hoje é a própria segunda, o primeiro dia da semana, então o
       * primeiro treino da semana é o próximo da alternância.
       */
      const semana = semanaCoerente(INICIO, perfil({ ultimo_treino: ultimo }), {
        hoje: INICIO,
      });
      const esperado = proximoTreinoAlternado(ultimo);
      expect(semana.find((d) => d.tipo === "forca")?.treinoId).toBe(esperado);

      // marcando o primeiro dia de força, a semana NÃO pode recomeçar pelo
      // treino já feito na sessão anterior
      const curta = semanaCurta("seg", semana);
      expect(curta.cortados).toEqual([]);
      const forca = curta.dias.filter((d) => d.tipo === "forca");
      expect(forca).toHaveLength(3);
      expect(forca[0]?.treinoId).toBe(esperado);
      for (let i = 1; i < forca.length; i++) {
        expect(forca[i]?.treinoId).not.toBe(forca[i - 1]?.treinoId);
      }
    }
  });

  it("o dia marcado é remarcado para um dia POSTERIOR, nunca para um que já passou", () => {
    const semana = semanaDoPlano(INICIO, perfil());
    expect(semana.find((d) => d.dia === "qui")?.tipo).toBe("descanso");
    expect(semana.find((d) => d.dia === "dom")?.tipo).toBe("descanso");

    const curta = semanaCurta("sex", semana);
    expect(curta.cortados).toEqual([]);
    const ocupados = curta.dias.filter((d) => d.tipo !== "descanso").map((d) => d.dia);
    expect(ocupados).not.toContain("qui");
    expect(ocupados).toContain("dom");
  });
});


describe("semana coerente: passado real, futuro projetado (SPEC §16.2)", () => {
  /* O caso do defeito de 16/09/2026: quarta 30/09, ultimo_treino A1, uma
   * sessão A1 concluída na segunda 28/09. Antes, a semana inteira era
   * projetada da segunda a partir do ultimo_treino e saía um degrau atrás:
   * seg "Treino B", qua "Treino A", sex "Treino B" — discordando da aba
   * Treino, que dizia (certo) "HOJE Treino B". */
  const QUARTA = "2026-09-30";
  const SEGUNDA = "2026-09-28";
  const feitoNaSegunda = [{ data: SEGUNDA, workout_id: "A1" }];
  const emQuarta = perfil({ ultimo_treino: "A1" });

  function forca(dias: ReturnType<typeof semanaCoerente>): (string | null)[] {
    return dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId);
  }

  it("o cardio registrado num descanso passado vira o dia (SPEC §22.2)", () => {
    // domingo 20/09 é descanso no programa; ele correu mesmo assim
    const DOMINGO = "2026-09-20";
    const semana = semanaCoerente(INICIO, perfil({ ultimo_treino: "A1" }), {
      cardios: [{ data: DOMINGO, tipo: "corrida", concluida: true }],
      hoje: DOMINGO,
    });
    const domingo = semana.find((d) => d.data === DOMINGO);
    expect(domingo?.tipo).toBe("cardio");
    expect(domingo?.cardio?.tipo).toBe("corrida");
    // sem o registro, o mesmo domingo continua sendo descanso
    const semCardio = semanaCoerente(INICIO, perfil({ ultimo_treino: "A1" }), {
      hoje: DOMINGO,
    });
    expect(semCardio.find((d) => d.data === DOMINGO)?.tipo).toBe("descanso");
  });

  it("o dia passado mostra o treino da sessão que existe nele", () => {
    const semana = semanaCoerente(QUARTA, emQuarta, {
      sessoes: feitoNaSegunda,
      hoje: QUARTA,
    });
    expect(semana[0]?.data).toBe(SEGUNDA);
    expect(semana[0]?.treinoId).toBe("A1");
  });

  it("hoje e o futuro projetam a alternância a partir de HOJE", () => {
    const semana = semanaCoerente(QUARTA, emQuarta, {
      sessoes: feitoNaSegunda,
      hoje: QUARTA,
    });
    // seg 28 = A (feito), qua 30 = B (hoje), sex 02 = A
    expect(forca(semana)).toEqual(["A1", "B1", "A1"]);
  });

  it("o dia de hoje já treinado mostra o treino feito e não desloca o resto", () => {
    /*
     * Auditoria: quarta 30/09 depois de treinar — `ultimo_treino` já é B1 e já
     * contabilizou a sessão de hoje. Antes, hoje voltava a projetar dele e
     * mostrava "Treino A" (dois A na mesma semana, o B feito sumia) e empurrava
     * a sexta para B.
     */
    const semana = semanaCoerente(QUARTA, perfil({ ultimo_treino: "B1" }), {
      sessoes: [...feitoNaSegunda, { data: QUARTA, workout_id: "B1" }],
      hoje: QUARTA,
    });
    expect(forca(semana)).toEqual(["A1", "B1", "A1"]);
    expect(semana[2]?.data).toBe(QUARTA);
  });

  it("hoje SEM sessão continua projetando de ultimo_treino", () => {
    const semana = semanaCoerente(QUARTA, emQuarta, {
      sessoes: feitoNaSegunda,
      hoje: QUARTA,
    });
    expect(semana[2]?.treinoId).toBe("B1");
  });

  it("a semana seguinte continua de onde a corrente terminou", () => {
    const proxima = semanaCoerente("2026-10-05", emQuarta, {
      sessoes: feitoNaSegunda,
      hoje: QUARTA,
    });
    expect(proxima[0]?.data).toBe("2026-10-05");
    // a corrente terminou em A (sexta 02/10) → seg B, qua A, sex B
    expect(forca(proxima)).toEqual(["B1", "A1", "B1"]);
  });

  it("e a seguinte da seguinte continua a mesma escada", () => {
    const terceira = semanaCoerente("2026-10-12", emQuarta, {
      sessoes: feitoNaSegunda,
      hoje: QUARTA,
    });
    expect(forca(terceira)).toEqual(["A1", "B1", "A1"]);
  });

  it("dia passado sem sessão mostra o treino que era esperado naquele momento", () => {
    // sexta 02/10: segunda feita (A), quarta sem sessão → esperava-se B
    const semana = semanaCoerente("2026-10-02", perfil({ ultimo_treino: "A1" }), {
      sessoes: feitoNaSegunda,
      hoje: "2026-10-02",
    });
    expect(semana[2]?.treinoId).toBe("B1"); // quarta, não feita
    expect(semana[2]?.data).toBe("2026-09-30");
    // e a sexta (hoje) continua ancorada no ultimo_treino do perfil
    expect(semana[4]?.treinoId).toBe("B1");
  });

  it("sem nenhuma sessão anterior, o dia passado fica só como dia de força", () => {
    const semana = semanaCoerente(QUARTA, emQuarta, { sessoes: [], hoje: QUARTA });
    expect(semana[0]?.tipo).toBe("forca");
    expect(semana[0]?.treinoId).toBeNull();
    // hoje e o futuro continuam projetando normalmente
    expect(semana[2]?.treinoId).toBe("B1");
  });

  it("sem `hoje`, a semana inteira é projeção — como semanaDoPlano", () => {
    expect(forca(semanaCoerente(QUARTA, emQuarta, { sessoes: feitoNaSegunda }))).toEqual(
      forca(semanaDoPlano(QUARTA, emQuarta)),
    );
  });

  it("na Fase 2 os treinos são fixos por dia da semana — nada muda", () => {
    const f2 = perfil({ fase_atual: "fase2", ultimo_treino: "IB" });
    const semana = semanaCoerente(QUARTA, f2, {
      // uma sessão SB registrada na segunda não reescreve a segunda (é SA)
      sessoes: [{ data: SEGUNDA, workout_id: "SB" }],
      hoje: QUARTA,
    });
    expect(semana.map((d) => d.treinoId)).toEqual([
      "SA",
      "IA",
      null,
      "SB",
      "IB",
      null,
      null,
    ]);
  });

  it("o override com treino escolhido vale por cima, no passado e no futuro", () => {
    const ov: ExcecaoAgenda[] = [
      { data: SEGUNDA, tipo: "forca", workout_id: "B1", sessao: null },
      { data: "2026-10-02", tipo: "forca", workout_id: "B1", sessao: null },
    ];
    const semana = semanaCoerente(QUARTA, emQuarta, {
      overrides: ov,
      sessoes: feitoNaSegunda,
      hoje: QUARTA,
    });
    expect(semana[0]?.treinoId).toBe("B1"); // o escolhido ganha da sessão
    expect(semana[0]?.treinoEscolhido).toBe(true);
    expect(semana[4]?.treinoId).toBe("B1"); // e ganha da projeção
  });

  it("a semana curta continua valendo por cima da semana coerente", () => {
    const semana = semanaCoerente(QUARTA, emQuarta, {
      sessoes: feitoNaSegunda,
      hoje: QUARTA,
    });
    const curta = semanaCurta("qua", semana);
    expect(curta.dias.find((d) => d.dia === "qua")?.tipo).toBe("descanso");
    const restantes = curta.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId);
    for (let i = 1; i < restantes.length; i++) {
      expect(restantes[i]).not.toBe(restantes[i - 1]);
    }
  });
});

/* ------------------------------------- dias de treino escolhidos (§17.3) */

describe("a semana montada dos dias escolhidos (SPEC §17.3)", () => {
  /** seg a sáb escolhidos: força seg/qua/sex, cardio ter/sáb, quinta livre. */
  const segASab = perfil({
    prefs: { dias_de_treino: ["seg", "ter", "qua", "qui", "sex", "sab"] },
  });

  it("tipoDoDia lê a semana do perfil, não o programa.json", () => {
    // no programa a quinta é descanso e o sábado é cardio — aqui também,
    // mas o domingo deixa de ter a nota da caminhada (não foi escolhido)
    expect(tipoDoDia("2026-09-17", segASab).tipo).toBe("descanso");
    expect(tipoDoDia("2026-09-17", segASab).programa.nota).toMatch(/barra fixa/i);
    expect(tipoDoDia("2026-09-20", segASab).programa.nota).toBeUndefined();
  });

  it("uma fase solta continua valendo a semana do programa", () => {
    expect(tipoDoDia("2026-09-20", "fase1").programa.nota).toMatch(/caminhada/i);
  });

  it("quem treina terça, quinta e sábado tem força nesses dias", () => {
    const p = perfil({ prefs: { dias_de_treino: ["ter", "qui", "sab"] } });
    expect(semanaDoPlano(INICIO, p).map((d) => d.tipo)).toEqual([
      "descanso",
      "forca",
      "descanso",
      "forca",
      "descanso",
      "forca",
      "descanso",
    ]);
    // a alternância continua ancorada em `ultimo_treino`, só que nesses dias
    expect(
      semanaDoPlano(INICIO, perfil({ ...p, ultimo_treino: "A1" }))
        .filter((d) => d.tipo === "forca")
        .map((d) => d.treinoId),
    ).toEqual(["B1", "A1", "B1"]);
  });

  it("treinoDeHoje num dia não escolhido é descanso", () => {
    const p = perfil({ prefs: { dias_de_treino: ["ter", "qui", "sab"] } });
    expect(treinoDeHoje(INICIO, p).tipo).toBe("descanso"); // segunda
    expect(treinoDeHoje("2026-09-15", p).tipo).toBe("forca"); // terça
  });

  it("sem cardio escolhido não há sessão de cardio nenhuma na semana", () => {
    const p = perfil({ prefs: { dias_de_treino: ["seg", "qua", "sex"] } });
    expect(semanaDoPlano(INICIO, p).filter((d) => d.tipo === "cardio")).toEqual([]);
    expect(sessaoCardioDeHoje("2026-09-15", p)).toBeNull();
  });

  it("um dia só na semana alterna A e B semana a semana (§17.2 item 6)", () => {
    const p = perfil({
      ultimo_treino: "A1",
      prefs: { dias_de_treino: ["sab"] },
    });
    const sabado = treinoDeHoje("2026-09-19", p);
    expect(sabado.tipo).toBe("forca");
    // o último foi A1, então o único dia da semana é o B1 — com um dia só, o
    // Treino B nunca chegaria se o dia ficasse preso no Treino A
    expect(sabado.treinoId).toBe("B1");
    const comecando = perfil({ ultimo_treino: null, prefs: { dias_de_treino: ["sab"] } });
    expect(treinoDeHoje("2026-09-19", comecando).treinoId).toBe("A1");
  });

  it("a semana coerente rotula os dias escolhidos e só eles", () => {
    const dias = semanaCoerente(INICIO, segASab, { hoje: INICIO });
    expect(dias.map((d) => d.tipo)).toEqual([
      "forca",
      "cardio",
      "forca",
      "descanso",
      "forca",
      "cardio",
      "descanso",
    ]);
    expect(dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "A1",
      "B1",
      "A1",
    ]);
  });

  it("o que falta na semana conta contra os dias escolhidos", () => {
    const p = perfil({ prefs: { dias_de_treino: ["seg", "qua", "sex"] } });
    const falta = oQueFaltaNaSemana(semanaDoPlano(INICIO, p), [], INICIO);
    expect(falta.total).toBe(3);
    expect(falta.faltando.map((d) => d.dia)).toEqual(["seg", "qua", "sex"]);
  });

  it("a semana curta reorganiza por cima da semana escolhida", () => {
    // seis dias escolhidos e cinco sessões: marcar a quarta não corta nada,
    // o treino dela cai no primeiro dia livre depois (a quinta)
    const planejada = semanaCoerente(INICIO, segASab, { hoje: INICIO });
    const curta = semanaCurta("qua", planejada);
    expect(curta.cortados).toEqual([]);
    expect(curta.dias.find((d) => d.dia === "qua")?.tipo).toBe("descanso");
    expect(curta.dias.find((d) => d.dia === "qui")?.tipo).toBe("forca");

    // sobrando dois dias na semana escolhida, o terceiro treino é cortado
    const so3 = perfil({ prefs: { dias_de_treino: ["seg", "qua", "sex"] } });
    const tresDias = semanaCoerente(INICIO, so3, { hoje: INICIO });
    const cortada = semanaCurta(["qua", "qui", "sex", "sab", "dom"], tresDias);
    expect(cortada.capacidade).toBe(2);
    expect(cortada.cortados).toHaveLength(1);
    expect(cortada.cortados[0]?.tipo).toBe("forca");
  });

  it("Fase 2 com quatro dias: SA, IA, SB, IB e nenhum cardio", () => {
    const p = perfil({
      fase_atual: "fase2",
      prefs: { dias_de_treino: ["seg", "ter", "qui", "sex"] },
    });
    const semana = semanaDoPlano(INICIO, p);
    expect(semana.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "SA",
      "IA",
      "SB",
      "IB",
    ]);
    expect(semana.filter((d) => d.tipo === "cardio")).toEqual([]);
  });
});
