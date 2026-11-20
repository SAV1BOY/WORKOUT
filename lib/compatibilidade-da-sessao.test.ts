import { describe, expect, it } from "vitest";
import { itemDaSessao, WORKOUT_BARRA_FIXA } from "@/lib/barra-fixa";
import {
  idsDaSessaoRemota,
  planoComExercicioDesconhecido,
  seriesComExercicioDesconhecido,
  sessaoLocalComExercicioDesconhecido,
  sessaoLocalRepresentaServidor,
} from "@/lib/compatibilidade-da-sessao";
import { itensDeIds, planoDaSessao } from "@/lib/livre";
import { escritaDaSerie, montarSessao, montarSessaoAvulsa } from "@/lib/sessao";

const futuro = "movimento-de-uma-versao-futura";
const rosca = "rosca-com-elastico";
const direta = "rosca-direta-com-barra";
const entrada = { id: "sessao-1", userId: "conta-1", data: "2026-11-20", fase: "fase1" } as const;
const itens = itensDeIds([rosca, direta]);
const plano = planoDaSessao(itens);
const bloco = { originalId: rosca, exercicioId: direta };
const serie = { user_id: entrada.userId, session_id: entrada.id, exercise_id: rosca };

describe("compatibilidade do catálogo antes de abrir o player", () => {
  it("aceita os snapshots normais do programa, da barra fixa e do treino livre", () => {
    const sessoes = [
      montarSessao({ ...entrada, treinoId: "A1" }),
      montarSessao({ ...entrada, fase: "fase2", treinoId: "SA" }),
      montarSessaoAvulsa({ ...entrada, workoutId: WORKOUT_BARRA_FIXA, itens: [itemDaSessao(1)] }),
      montarSessaoAvulsa({ ...entrada, workoutId: "livre", plano, itens }),
    ];
    for (const sessao of sessoes) {
      expect(sessaoLocalComExercicioDesconhecido(sessao)).toBe(false);
      expect(planoComExercicioDesconhecido(sessao.plano)).toBe(false);
    }
    expect(planoComExercicioDesconhecido({ itens: [] })).toBe(false);
    expect(planoComExercicioDesconhecido(null)).toBe(false);
  });

  it("reconhece item original futuro mesmo quando o substituto ativo é conhecido", () => {
    const planoMisto = { itens: [{ exercicio_id: futuro }], trocas: { 1: [{ exercicio_id: rosca }] } };
    expect(planoComExercicioDesconhecido(planoMisto)).toBe(true);
    expect(sessaoLocalComExercicioDesconhecido({ plano: planoMisto, blocos: [bloco] })).toBe(true);
  });

  it.each([
    [futuro, rosca], [rosca, futuro],
  ])("verifica o exercício ativo e o arquivado em cada grupo de trocas (%s, %s)", (ativo, anterior) => {
    expect(planoComExercicioDesconhecido({
      ...plano, trocas: { 1: [{ exercicio_id: direta }], 2: [{ exercicio_id: ativo }, { exercicio_id: anterior }] },
    })).toBe(true);
  });

  it.each(["originalId", "exercicioId"])("verifica %s dos blocos e dos registros arquivados do aparelho", campo => {
    const alterado = { ...bloco, [campo]: futuro };
    expect(sessaoLocalComExercicioDesconhecido({ plano, blocos: [bloco, alterado] })).toBe(true);
    expect(sessaoLocalComExercicioDesconhecido({ plano, blocos: [{ ...bloco, trocados: [bloco, alterado] }] })).toBe(true);
  });

  it("considera uma inclusão ativa e permite continuar quando ela já foi desfeita", () => {
    const inclusao = { id: "uuid-da-inclusao", exercicio_id: futuro };
    for (const estado of ["disponivel", "iniciada"]) {
      expect(planoComExercicioDesconhecido({ ...plano, ultima_inclusao: { ...inclusao, estado } })).toBe(true);
    }
    expect(planoComExercicioDesconhecido({ ...plano, ultima_inclusao: { ...inclusao, estado: "desfeita" } })).toBe(false);
  });

  it("ignora rótulos, referências de ordenação, UUIDs, opções de equipamento e ajustes sem bloco", () => {
    const conhecido = {
      ...plano, titulo: futuro, colecao: "grupo:Braços", ordem_execucao: ["inclusao:uuid-do-bloco", rosca],
      equipamento_disponivel: ["super-band"], descansos_por_exercicio: { [futuro]: 60 },
      trocas: { 1: [{ exercicio_id: direta, nota: futuro, trabalho: [1] }] },
    };
    expect(sessaoLocalComExercicioDesconhecido({
      plano: conhecido, blocos: [{ ...bloco, trocados: [{ ...bloco, nota: futuro }], series: [{ id: futuro }] }],
      player: { chave: "serie:uuid-da-serie" }, notaGeral: futuro,
    })).toBe(false);
  });

  it("considera uma série com ID futuro somente se pertence à conta e à sessão solicitadas", () => {
    const conhecida = { ...serie, id: futuro };
    const desconhecida = { ...serie, exercise_id: futuro };
    const restantes = [conhecida, { ...desconhecida, user_id: "outra" }, { ...desconhecida, session_id: "outra" }];
    expect(seriesComExercicioDesconhecido(restantes, entrada.userId, entrada.id)).toBe(false);
    expect(seriesComExercicioDesconhecido([...restantes, desconhecida], entrada.userId, entrada.id)).toBe(true);
    expect(seriesComExercicioDesconhecido(undefined, entrada.userId, entrada.id)).toBe(false);
    expect(seriesComExercicioDesconhecido([], entrada.userId, entrada.id)).toBe(false);
  });
});


it("só volta a confiar no snapshot que representa a ordem, as séries e os valores confirmados", () => {
  const local = montarSessaoAvulsa({ ...entrada, workoutId: "livre", itens, plano });
  const linha = { id: entrada.id, user_id: entrada.userId, workout_id: local.workoutId, plano };
  const segundo = local.blocos[1]!;
  const registrada = escritaDaSerie(local, segundo, segundo.series[0]!).linha;
  expect(sessaoLocalRepresentaServidor(local, linha, [registrada])).toBe(true);
  expect(sessaoLocalRepresentaServidor({ ...local, blocos: [segundo] }, linha, [registrada])).toBe(false);
  expect(sessaoLocalRepresentaServidor(local, linha, [{ ...registrada, ordem_ex: 1 }])).toBe(false);
  expect(sessaoLocalRepresentaServidor(local, linha, [{ ...registrada, reps: 99 }])).toBe(false);
  expect(sessaoLocalRepresentaServidor(local, linha, [{ ...registrada, id: "uuid-distinto" }])).toBe(false);
  expect(sessaoLocalRepresentaServidor(local, { ...linha, user_id: "outra" }, [registrada])).toBe(false);
  expect(sessaoLocalRepresentaServidor(local, { ...linha, id: "outra" }, [registrada])).toBe(false);
});

it("obtém as referências físicas do servidor, inclusive de um catálogo que já conhece um ID antes incompatível", () => {
  const misto = { itens: [{ exercicio_id: futuro }], trocas: { 1: [{ exercicio_id: rosca }, { exercicio_id: futuro }] } };
  expect(idsDaSessaoRemota(misto, [{ ...serie, exercise_id: direta }, { ...serie, user_id: "outra", exercise_id: "fora" }],
    entrada.userId, entrada.id)).toEqual([futuro, rosca, direta]);
});

it("libera programa e barra fixa pela prescrição depois de uma troca retirada de um plano legado vazio", () => {
  const vazio = planoDaSessao([]);
  const programada = montarSessao({ ...entrada, treinoId: "A1" });
  const fixa = montarSessaoAvulsa({ ...entrada, workoutId: WORKOUT_BARRA_FIXA, itens: [itemDaSessao(3)], semanaPlano: 3 });
  const livre = montarSessaoAvulsa({ ...entrada, workoutId: "livre", itens });
  for (const snapshot of [programada, fixa, livre]) {
    const local = { ...snapshot, plano: vazio };
    const linha = { id: local.id, user_id: local.userId, workout_id: local.workoutId, plano: vazio };
    expect(sessaoLocalRepresentaServidor(local, linha, [])).toBe(local.workoutId !== "livre");
  }
});
