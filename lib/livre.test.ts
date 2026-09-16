import { describe, expect, it } from "vitest";
import { acharExercicio } from "@/lib/dados";
import {
  EXERCICIOS_DA_SESSAO_LIVRE,
  WORKOUT_LIVRE,
  detalheDaColecao,
  ehDeCircuito,
  ehSessaoLivre,
  itemDoExercicio,
  itensDeIds,
  itensDoPlano,
  itensNaOrdem,
  mediaDaFaixa,
  planoDaSessao,
  podeCircuito,
  tituloDoPlano,
} from "@/lib/livre";
import { montarSessaoAvulsa, escritaDaSessao, reconstruirSessao } from "@/lib/sessao";

const IDS = ["abdominal-supra", "escalador", "superman"];

describe("itens da sessão livre", () => {
  it("saem da prescrição padrão do catálogo", () => {
    const item = itemDoExercicio(acharExercicio("abdominal-supra"));
    expect(item).toEqual({
      exercicioId: "abdominal-supra",
      prescricao: { series: 3, tipo: "reps", min: 15, max: 25, unilateral: false },
      descansoS: 60,
      descansoTexto: "60 s",
    });
  });

  it("ignoram id que não existe, sem quebrar", () => {
    expect(itensDeIds(["abdominal-supra", "nao-existe"]).map((i) => i.exercicioId)).toEqual([
      "abdominal-supra",
    ]);
    expect(itensDeIds([])).toEqual([]);
  });

  it("a ordem escolhida vale e ninguém some", () => {
    const itens = itensDeIds(IDS);
    const trocados = itensNaOrdem(itens, ["superman", "escalador"]);
    expect(trocados.map((i) => i.exercicioId)).toEqual([
      "superman",
      "escalador",
      "abdominal-supra",
    ]);
    expect(itensNaOrdem(itens, []).map((i) => i.exercicioId)).toEqual(IDS);
  });
});

describe("sessions.plano (o jsonb) — ida e volta", () => {
  it("guarda o que refaz a sessão", () => {
    const plano = planoDaSessao(itensDeIds(IDS), {
      titulo: "Core no tatame",
      colecao: "circuito:tatame",
    });
    expect(plano.titulo).toBe("Core no tatame");
    expect(plano.colecao).toBe("circuito:tatame");
    expect(plano.itens).toHaveLength(3);
    expect(plano.itens[0]).toEqual({
      exercicio_id: "abdominal-supra",
      series: 3,
      tipo: "reps",
      min: 15,
      max: 25,
      unilateral: false,
      descanso_s: 60,
      descanso_texto: "60 s",
    });
    expect(itensDoPlano(plano)?.map((i) => i.exercicioId)).toEqual(IDS);
    expect(tituloDoPlano(plano)).toBe("Core no tatame");
  });

  it("não confia no formato: jsonb torto não vira sessão inventada", () => {
    expect(itensDoPlano(null)).toBeNull();
    expect(itensDoPlano("texto")).toBeNull();
    expect(itensDoPlano({})).toBeNull();
    expect(itensDoPlano({ itens: [] })).toBeNull();
    expect(itensDoPlano({ itens: [{ exercicio_id: "nao-existe" }] })).toBeNull();
    expect(tituloDoPlano({ titulo: 7 })).toBeNull();
    expect(tituloDoPlano(undefined)).toBeNull();
  });

  it("um item incompleto cai no padrão do catálogo em vez de sumir", () => {
    const itens = itensDoPlano({ itens: [{ exercicio_id: "escalador", series: "x" }] });
    expect(itens).toHaveLength(1);
    expect(itens?.[0]?.prescricao.series).toBe(3);
    expect(itens?.[0]?.descansoS).toBe(60);
  });
});

describe("a sessão livre grava e refaz (SPEC §13.4)", () => {
  const itens = itensDeIds(IDS);
  const plano = planoDaSessao(itens, { titulo: "Core no tatame" });
  let n = 0;
  const sessao = montarSessaoAvulsa({
    id: "s1",
    userId: "u1",
    data: "2026-09-15",
    fase: "fase1",
    workoutId: WORKOUT_LIVRE,
    itens,
    plano,
    agora: "2026-09-15T10:00:00.000Z",
    novoId: () => `serie-${++n}`,
  });

  it("nasce com workout_id livre e o plano dentro", () => {
    expect(ehSessaoLivre(sessao.workoutId)).toBe(true);
    expect(sessao.blocos.map((b) => b.exercicioId)).toEqual(IDS);
    expect(sessao.plano).toEqual(plano);
  });

  it("a escrita de `sessions` leva o plano", () => {
    const escrita = escritaDaSessao(sessao);
    expect(escrita.tabela).toBe("sessions");
    expect(escrita.linha?.workout_id).toBe("livre");
    expect(escrita.linha?.plano).toEqual(plano);
  });

  it("noutro aparelho ela volta do plano, com as séries gravadas", () => {
    const refeita = reconstruirSessao(
      {
        id: "s1",
        user_id: "u1",
        data: "2026-09-15",
        workout_id: "livre",
        fase: "fase1",
        status: "em_andamento",
        iniciada_em: "2026-09-15T10:00:00.000Z",
        plano,
      },
      [],
      { itens: itensDoPlano(plano) ?? undefined },
    );
    expect(refeita?.blocos.map((b) => b.exercicioId)).toEqual(IDS);
    expect(refeita?.plano).toEqual(plano);
  });

  it("sem plano nenhum, a sessão livre não é inventada", () => {
    const refeita = reconstruirSessao({
      id: "s1",
      user_id: "u1",
      data: "2026-09-15",
      workout_id: "livre",
      fase: "fase1",
      status: "em_andamento",
      iniciada_em: "2026-09-15T10:00:00.000Z",
    }, []);
    expect(refeita).toBeNull();
  });
});

describe("o que entra no modo por tempo (SPEC §13.6)", () => {
  it("peso do corpo, corda, elástico e anilha entram", () => {
    expect(ehDeCircuito(acharExercicio("abdominal-supra"))).toBe(true);
    expect(ehDeCircuito(acharExercicio("salto-basico"))).toBe(true);
    expect(ehDeCircuito(acharExercicio("abertura-de-ombros"))).toBe(true);
  });

  it("barra, halteres, polia e barra fixa nunca entram", () => {
    expect(ehDeCircuito(acharExercicio("agachamento-livre"))).toBe(false);
    expect(ehDeCircuito(acharExercicio("barra-fixa-assistida"))).toBe(false);
    expect(podeCircuito(["abdominal-supra", "agachamento-livre"])).toBe(false);
    expect(podeCircuito(["abdominal-supra", "nao-existe"])).toBe(false);
  });
});

describe("detalhes", () => {
  it("a média da faixa aceita faixa aberta", () => {
    expect(mediaDaFaixa(10, 20)).toBe(15);
    expect(mediaDaFaixa(null, 12)).toBe(12);
    expect(mediaDaFaixa(8, null)).toBe(8);
    expect(mediaDaFaixa(null, null)).toBeNull();
  });

  it("o detalhe é “N exercícios · ~M min”, com o singular certo", () => {
    expect(detalheDaColecao([acharExercicio("abdominal-supra")])).toBe(
      "1 exercício · ~6 min",
    );
    expect(detalheDaColecao(IDS.map(acharExercicio))).toMatch(
      /^3 exercícios · ~\d+ min$/,
    );
  });

  it("a sessão de uma coleção leva 6 exercícios por padrão", () => {
    expect(EXERCICIOS_DA_SESSAO_LIVRE).toBe(6);
  });
});
