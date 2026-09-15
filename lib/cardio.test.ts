import { describe, expect, it } from "vitest";
import {
  avancar,
  avancoDeSemana,
  decorridoTotal,
  duracaoEmMinutos,
  ehTipoDeCardio,
  feitoDaSessao,
  niveisDeEsforco,
  planejadoDaSessao,
  planoDeCardio,
  planoDeCorda,
  planoDeCorrida,
  pausar,
  pularBloco,
  restanteDoBlocoS,
  restanteTotalS,
  retomar,
  saltosEstimados,
  sessoesDaSemanaCivil,
  textoDoPlano,
  timerInicial,
  totalDeSegundos,
  trabalhoCumprido,
} from "@/lib/cardio";
import { cardio } from "@/lib/dados";

const AGORA = 1_700_000_000_000;

describe("blocos da sessão de corrida (SPEC §3.3)", () => {
  it("semana 1 = aquecimento 5 + 8 × (1 min corrida / 2 min caminhada) + soltura 5 = 34 min", () => {
    const plano = planoDeCorrida(1);

    expect(plano.repeticoes).toBe(8);
    // 1 aquecimento + 8 × (corrida + caminhada) + 1 soltura
    expect(plano.blocos).toHaveLength(18);
    expect(plano.blocos[0]).toMatchObject({
      tipo: "aquecimento",
      segundos: 300,
      voz: "caminhada",
      trabalho: false,
    });
    expect(plano.blocos[1]).toMatchObject({
      tipo: "corrida",
      segundos: 60,
      serie: 1,
      trabalho: true,
    });
    expect(plano.blocos[2]).toMatchObject({ tipo: "caminhada", segundos: 120, serie: 1 });
    expect(plano.blocos[16]).toMatchObject({ tipo: "caminhada", serie: 8 });
    expect(plano.blocos[17]).toMatchObject({ tipo: "soltura", segundos: 300 });

    expect(plano.totalS).toBe(34 * 60);
    expect(plano.blocos.filter((b) => b.trabalho)).toHaveLength(8);
  });

  it("os índices são a posição no plano", () => {
    const plano = planoDeCorrida(1);
    expect(plano.blocos.map((b) => b.indice)).toEqual(
      plano.blocos.map((_, i) => i),
    );
  });

  it("todas as 12 semanas batem com o `sessao_min` do JSON (arredondamento de meio minuto)", () => {
    for (const s of cardio.corrida.semanas) {
      const plano = planoDeCorrida(s.semana);
      expect(Math.abs(plano.totalS / 60 - s.sessao_min), `semana ${s.semana}`).toBeLessThanOrEqual(0.5);
      expect(plano.repeticoes).toBe(s.blocos.length);
    }
  });

  it("bloco sem caminhada não vira bloco vazio (semana 8: 12 min + 2 min + 10 min)", () => {
    const plano = planoDeCorrida(8);
    // aquecimento + corrida 12 + caminhada 2 + corrida 10 + soltura
    expect(plano.blocos.map((b) => b.tipo)).toEqual([
      "aquecimento",
      "corrida",
      "caminhada",
      "corrida",
      "soltura",
    ]);
  });

  it("semana 9 é contínua: aquecimento, corrida e soltura", () => {
    const plano = planoDeCorrida(9);
    expect(plano.blocos.map((b) => b.segundos)).toEqual([300, 1200, 300]);
    expect(plano.totalS).toBe(30 * 60);
  });

  it("a semana fora do plano fica presa nos limites (1…12)", () => {
    expect(planoDeCorrida(0).semana).toBe(1);
    expect(planoDeCorrida(99).semana).toBe(12);
  });

  it("o texto do plano é o da tela Hoje", () => {
    expect(textoDoPlano(planoDeCorrida(1))).toBe(
      "Corrida · semana 1 · 8 × (1 min corrida / 2 min caminhada) · 34 min",
    );
  });
});

describe("blocos da sessão de corda", () => {
  it("estágio 1–2: 6 × 30 s com 60 s de descanso entre eles", () => {
    const plano = planoDeCorda(1);
    expect(plano.repeticoes).toBe(6);
    // 6 blocos de corda + 5 descansos (nenhum descanso depois do último)
    expect(plano.blocos).toHaveLength(11);
    expect(plano.blocos.filter((b) => b.tipo === "corda")).toHaveLength(6);
    expect(plano.blocos.filter((b) => b.tipo === "descanso")).toHaveLength(5);
    expect(plano.totalS).toBe(6 * 30 + 5 * 60);
    expect(plano.saltosAprox).toBe(300);
  });

  it("a semana escolhe o estágio pela faixa ('9–12')", () => {
    expect(planoDeCorda(10).blocos.filter((b) => b.tipo === "corda")).toHaveLength(5);
    expect(planoDeCorda(10).blocos[0]?.segundos).toBe(180);
  });

  it("caminhada e outro não têm blocos (só cronômetro)", () => {
    expect(planoDeCardio("caminhada", 1).blocos).toHaveLength(0);
    expect(planoDeCardio("outro", 1).blocos).toHaveLength(0);
    expect(planoDeCardio("caminhada", 1).titulo).toBe("Caminhada leve");
  });

  it("só os quatro tipos da rota são aceitos", () => {
    expect(ehTipoDeCardio("corrida")).toBe(true);
    expect(ehTipoDeCardio("corda")).toBe(true);
    expect(ehTipoDeCardio("caminhada")).toBe(true);
    expect(ehTipoDeCardio("outro")).toBe(true);
    expect(ehTipoDeCardio("2026-09-15")).toBe(false);
  });
});

describe("o relógio do timer (SPEC §3.3 e §8)", () => {
  const blocos = planoDeCorrida(1).blocos;

  it("começa no aquecimento e conta o tempo do bloco", () => {
    const t = timerInicial(true, AGORA);
    expect(t.indice).toBe(0);
    expect(restanteDoBlocoS(t, blocos, AGORA)).toBe(300);
    expect(restanteDoBlocoS(t, blocos, AGORA + 60_000)).toBe(240);
    expect(restanteTotalS(t, blocos, AGORA + 60_000)).toBe(34 * 60 - 60);
  });

  it("troca de bloco quando o tempo acaba e conta o bloco como cumprido", () => {
    const t = avancar(timerInicial(true, AGORA), blocos, AGORA + 300_000);
    expect(t.indice).toBe(1);
    expect(t.cumpridos).toEqual([0]);
    expect(restanteDoBlocoS(t, blocos, AGORA + 300_000)).toBe(60);
  });

  it("recarregar a página no meio recupera vários blocos de uma vez (§8)", () => {
    // 5 min de aquecimento + 1 de corrida + 2 de caminhada + 1 de corrida = 9 min
    const t = avancar(timerInicial(true, AGORA), blocos, AGORA + 9 * 60_000);
    expect(t.indice).toBe(4); // aquecimento, corrida 1, caminhada 1, corrida 2 já foram
    expect(blocos[t.indice]?.tipo).toBe("caminhada");
    expect(t.cumpridos).toEqual([0, 1, 2, 3]);
    expect(trabalhoCumprido(t, blocos)).toBe(2);
    expect(Math.round(decorridoTotal(t, AGORA + 9 * 60_000))).toBe(9 * 60);
  });

  it("o fim do último bloco termina a sessão e para o relógio", () => {
    const t = avancar(timerInicial(true, AGORA), blocos, AGORA + 40 * 60_000);
    expect(t.terminado).toBe(true);
    expect(t.desdeMs).toBeNull();
    expect(t.cumpridos).toHaveLength(blocos.length);
    expect(trabalhoCumprido(t, blocos)).toBe(8);
    expect(restanteTotalS(t, blocos, AGORA + 99 * 60_000)).toBe(0);
  });

  it("pausar congela e retomar continua de onde parou", () => {
    const parado = pausar(timerInicial(true, AGORA), AGORA + 30_000);
    expect(parado.desdeMs).toBeNull();
    expect(restanteDoBlocoS(parado, blocos, AGORA + 10 * 60_000)).toBe(270);

    const voltou = retomar(parado, AGORA + 10 * 60_000);
    expect(restanteDoBlocoS(voltou, blocos, AGORA + 10 * 60_000)).toBe(270);
    expect(restanteDoBlocoS(voltou, blocos, AGORA + 11 * 60_000)).toBe(210);
  });

  it("pular vai para o próximo bloco sem contar o atual como cumprido", () => {
    const t = pularBloco(timerInicial(true, AGORA), blocos, AGORA + 10_000);
    expect(t.indice).toBe(1);
    expect(t.cumpridos).toEqual([]);
    expect(Math.round(decorridoTotal(t, AGORA + 10_000))).toBe(10);
    expect(restanteDoBlocoS(t, blocos, AGORA + 10_000)).toBe(60);
  });

  it("pular no último bloco termina a sessão", () => {
    let t = timerInicial(true, AGORA);
    for (let i = 0; i < blocos.length; i++) t = pularBloco(t, blocos, AGORA);
    expect(t.terminado).toBe(true);
  });
});

describe("o que vai para cardio_sessions (SPEC §3.3)", () => {
  const plano = planoDeCorrida(1);

  it("planejado guarda os blocos do plano", () => {
    const p = planejadoDaSessao(plano);
    expect(p).toMatchObject({ tipo: "corrida", semana: 1, repeticoes: 8, total_s: 2040 });
    expect((p.blocos as unknown[]).length).toBe(18);
  });

  it("feito guarda os blocos cumpridos, não os planejados", () => {
    const t = avancar(timerInicial(true, AGORA), plano.blocos, AGORA + 9 * 60_000);
    const f = feitoDaSessao(plano, t, AGORA + 9 * 60_000);
    expect(f).toMatchObject({
      blocos_cumpridos: 4,
      blocos_planejados: 18,
      repeticoes_cumpridas: 2,
      repeticoes_planejadas: 8,
      terminou: false,
      decorrido_s: 540,
    });
  });

  it("a duração vai em minutos com uma casa (numeric(5,1))", () => {
    expect(duracaoEmMinutos(2040)).toBe(34);
    expect(duracaoEmMinutos(95)).toBe(1.6);
  });

  it("os saltos da corda saem do plano, na proporção cumprida", () => {
    const corda = planoDeCorda(1);
    expect(saltosEstimados(corda, 6)).toBe(300);
    expect(saltosEstimados(corda, 3)).toBe(150);
    expect(saltosEstimados(planoDeCorrida(1), 8)).toBeNull();
  });

  it("o teste da fala vem do JSON", () => {
    const niveis = niveisDeEsforco();
    expect(niveis.map((n) => n.valor)).toEqual(["facil", "moderado", "forte"]);
    expect(niveis[0]?.consegue).toBe("falar frases inteiras sem ofegar");
  });
});

describe("avanço da semana do plano (SPEC §5.5)", () => {
  const hoje = "2026-09-19"; // sábado da semana que começa em 14/09

  it("com 2 sessões concluídas na semana civil, a semana avança", () => {
    const r = avancoDeSemana({
      plano: "corrida",
      semanaAtual: 1,
      sessoesDaSemanaCivil: 2,
      hoje,
    });
    expect(r).toMatchObject({ campo: "semana_corrida", semana: 2 });
    expect(r?.prefs.avanco_corrida_em).toBe("2026-09-14");
  });

  it("com 0 ou 1 sessão a semana repete", () => {
    for (const n of [0, 1]) {
      expect(
        avancoDeSemana({ plano: "corrida", semanaAtual: 3, sessoesDaSemanaCivil: n, hoje }),
      ).toBeNull();
    }
  });

  it("a mesma semana civil não avança duas vezes (a marca fica em prefs)", () => {
    const primeiro = avancoDeSemana({
      plano: "corda",
      semanaAtual: 1,
      sessoesDaSemanaCivil: 2,
      hoje,
    });
    expect(primeiro?.campo).toBe("semana_corda");
    expect(
      avancoDeSemana({
        plano: "corda",
        semanaAtual: primeiro?.semana ?? 1,
        sessoesDaSemanaCivil: 2,
        hoje,
        prefs: primeiro?.prefs,
      }),
    ).toBeNull();
  });

  it("a semana seguinte avança de novo", () => {
    const prefs = { avanco_fixa_em: "2026-09-14" };
    expect(
      avancoDeSemana({
        plano: "fixa",
        semanaAtual: 2,
        sessoesDaSemanaCivil: 2,
        hoje: "2026-09-22",
        prefs,
      }),
    ).toMatchObject({ campo: "semana_fixa", semana: 3 });
  });

  it("no teto do plano a semana não anda (nem para trás)", () => {
    expect(
      avancoDeSemana({ plano: "corrida", semanaAtual: 12, sessoesDaSemanaCivil: 2, hoje }),
    ).toBeNull();
    expect(
      avancoDeSemana({ plano: "fixa", semanaAtual: 13, sessoesDaSemanaCivil: 2, hoje }),
    ).toBeNull();
  });

  it("conta só as sessões do tipo certo dentro da semana civil", () => {
    const linhas = [
      { data: "2026-09-15", tipo: "corrida", concluida: true },
      { data: "2026-09-19", tipo: "corrida", concluida: true },
      { data: "2026-09-19", tipo: "corda", concluida: true },
      { data: "2026-09-17", tipo: "corrida", concluida: false },
      { data: "2026-09-13", tipo: "corrida", concluida: true }, // semana anterior
      { data: "2026-09-21", tipo: "corrida", concluida: true }, // semana seguinte
    ];
    expect(sessoesDaSemanaCivil(linhas, "corrida", hoje)).toBe(2);
    expect(sessoesDaSemanaCivil(linhas, "corda", hoje)).toBe(1);
  });
});

describe("totalDeSegundos", () => {
  it("soma os blocos", () => {
    expect(totalDeSegundos(planoDeCorda(1).blocos)).toBe(480);
  });
});
