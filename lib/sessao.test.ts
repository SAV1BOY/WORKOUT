/**
 * Adaptadores da sessão de força (SPEC §3.2, §6.5, §6.6, §8).
 * O motor já tem os próprios testes: aqui se testa a ponte entre o programa,
 * o estado do banco, a tela e a fila de saída.
 */
import { describe, expect, it } from "vitest";
import { WORKOUT_BARRA_FIXA, itemDaSessao } from "@/lib/barra-fixa";
import { acharExercicio } from "@/lib/dados";
import { estadoInicial, prescricaoPadrao, type EstadoExercicio } from "@/lib/progressao";
import {
  MAX_SERIES_DA_SESSAO,
  MIN_SERIES_DA_SESSAO,
  ajustarPrescricaoDaSessao,
  atualizarSerie,
  comSubstituicoes,
  contadoresDaSessao,
  avaliarSessao,
  concluirSessao,
  escritaDaSerie,
  escritaDaSessao,
  escritaDeDescarte,
  cargaEmUso,
  firmePadrao,
  marcarSerie,
  montarSessao,
  montarSessaoAvulsa,
  montagemDaCarga,
  notasDaSessao,
  progressoDaSessao,
  proximoExercicio,
  proximaCarga,
  idsComSubstitutos,
  idsQueComparamComAnterior,
  reconstruirSessao,
  recordesDoBloco,
  seriesAnterioresPorExercicio,
  substituirExercicio,
  substitutosPara,
  textoDaCargaDoBloco,
  type BlocoLocal,
  type SessaoLocal,
} from "@/lib/sessao";
import type { LinhaSerie } from "@/lib/types";

/** Ids previsíveis para os testes (no app é `crypto.randomUUID`). */
function contador(prefixo = "s") {
  let n = 0;
  return () => `${prefixo}${++n}`;
}

function sessaoA(extras: Partial<Parameters<typeof montarSessao>[0]> = {}): SessaoLocal {
  return montarSessao({
    id: "sess-1",
    userId: "u1",
    data: "2026-09-14",
    treinoId: "A1",
    fase: "fase1",
    agora: "2026-09-14T09:00:00.000Z",
    novoId: contador(),
    ...extras,
  });
}

function bloco(sessao: SessaoLocal, exercicioId: string): BlocoLocal {
  const b = sessao.blocos.find((x) => x.exercicioId === exercicioId);
  if (!b) throw new Error(`bloco ausente: ${exercicioId}`);
  return b;
}

/** Preenche e conclui todas as séries de trabalho de um bloco. */
function fazerTudoNoTopo(
  sessao: SessaoLocal,
  exercicioId: string,
  valores: Partial<{ reps: number; tempoS: number; passos: number; cargaKg: number }> = {},
): SessaoLocal {
  let s = sessao;
  const b = bloco(s, exercicioId);
  for (const serie of b.series) {
    if (serie.tipo !== "trabalho") continue;
    if (Object.keys(valores).length > 0) {
      s = atualizarSerie(s, b.ordem, serie.id, valores);
    }
    s = marcarSerie(s, b.ordem, serie.id, true, "2026-09-14T09:30:00.000Z");
  }
  return s;
}

/* -------------------------------------------------------- montar a sessão */

describe("montarSessao — as linhas iniciais do treino (SPEC §3.2)", () => {
  it("monta os 6 blocos do Treino A na ordem do programa", () => {
    const s = sessaoA();
    expect(s.blocos.map((b) => b.exercicioId)).toEqual([
      "agachamento-livre",
      "supino-reto-com-barra",
      "remada-curvada-pronada",
      "desenvolvimento-com-halteres",
      "rosca-direta-com-barra",
      "elevacao-de-pernas-na-barra-fixa",
    ]);
    expect(s.blocos.map((b) => b.ordem)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(s.status).toBe("em_andamento");
    expect(s.workoutId).toBe("A1");
  });

  it("o aquecimento entra só no PRIMEIRO exercício pesado (barra vazia e metade)", () => {
    const s = sessaoA();
    const agachamento = bloco(s, "agachamento-livre");
    const aquecimento = agachamento.series.filter((x) => x.tipo === "aquecimento");

    expect(aquecimento).toHaveLength(2);
    expect(aquecimento.map((x) => x.reps)).toEqual([5, 5]);
    // barra maciça vazia = 7,5 kg; metade de 7,5 cai no piso da escala
    expect(aquecimento[0]?.cargaKg).toBe(7.5);
    expect(aquecimento[1]?.cargaKg).toBe(7.5);

    // o supino também é composto_pesado, mas o aquecimento é um por treino
    expect(
      bloco(s, "supino-reto-com-barra").series.every((x) => x.tipo === "trabalho"),
    ).toBe(true);
  });

  it("a metade da carga é a alcançável para baixo, não a metade exata", () => {
    const estados: Record<string, EstadoExercicio> = {
      "agachamento-livre": {
        ...estadoInicial(acharExercicio("agachamento-livre")),
        carga_atual_kg: 43.5,
      },
    };
    const s = sessaoA({ estados });
    const aquecimento = bloco(s, "agachamento-livre").series.filter(
      (x) => x.tipo === "aquecimento",
    );
    // 43,5 ÷ 2 = 21,75 → 21,5 (7,5 + 2 × 7) na escala da barra maciça
    expect(aquecimento[1]?.cargaKg).toBe(21.5);
  });

  it("pré-preenche a carga de hoje e o TOPO da faixa em cada série", () => {
    const s = sessaoA();
    const trabalho = bloco(s, "agachamento-livre").series.filter(
      (x) => x.tipo === "trabalho",
    );
    expect(trabalho).toHaveLength(3);
    expect(trabalho.map((x) => x.reps)).toEqual([5, 5, 5]);
    expect(trabalho.map((x) => x.cargaKg)).toEqual([7.5, 7.5, 7.5]);
    expect(trabalho.map((x) => x.setIndex)).toEqual([1, 2, 3]);

    // remada: 3 × 6–8 → o topo é 8 (SPEC §3.2)
    expect(
      bloco(s, "remada-curvada-pronada").series.map((x) => x.reps),
    ).toEqual([8, 8, 8]);
    // desenvolvimento com halteres: 1,5 kg POR HALTER (SPEC §4 e §10.2)
    expect(bloco(s, "desenvolvimento-com-halteres").series[0]?.cargaKg).toBe(1.5);
    // peso corporal fica em 0 e não vira carga nenhuma na tela
    expect(bloco(s, "elevacao-de-pernas-na-barra-fixa").series[0]?.cargaKg).toBe(0);
    expect(textoDaCargaDoBloco(bloco(s, "elevacao-de-pernas-na-barra-fixa"))).toBe(
      "peso do corpo",
    );
    expect(textoDaCargaDoBloco(bloco(s, "desenvolvimento-com-halteres"))).toBe(
      "1,5 kg por halter",
    );
  });

  it("a carga vem do exercise_state quando existe (SPEC §6.1)", () => {
    const estados: Record<string, EstadoExercicio> = {
      "supino-reto-com-barra": {
        ...estadoInicial(acharExercicio("supino-reto-com-barra")),
        carga_atual_kg: 9.5,
      },
    };
    const s = sessaoA({ estados });
    expect(bloco(s, "supino-reto-com-barra").series[0]?.cargaKg).toBe(9.5);
    expect(bloco(s, "supino-reto-com-barra").alvo.incremento_kg).toBe(2);
  });

  it("tempo e passos pré-preenchem o campo certo (prancha e farmer's walk)", () => {
    const iA = montarSessao({
      id: "x",
      userId: "u1",
      data: "2026-09-14",
      treinoId: "IA",
      fase: "fase2",
      novoId: contador("t"),
    });
    const prancha = bloco(iA, "prancha").series[0];
    expect(prancha?.tempoS).toBe(60); // topo da faixa 30–60 s
    expect(prancha?.reps).toBeNull();

    const iB = montarSessao({
      id: "y",
      userId: "u1",
      data: "2026-09-14",
      treinoId: "IB",
      fase: "fase2",
      novoId: contador("p"),
    });
    const farmer = bloco(iB, "farmer-s-walk").series[0];
    expect(farmer?.passos).toBe(40);
    expect(farmer?.reps).toBeNull();
  });

  it("unilateral abre os dois lados (SPEC §6.3)", () => {
    const sB = montarSessao({
      id: "z",
      userId: "u1",
      data: "2026-09-14",
      treinoId: "SB",
      fase: "fase2",
      novoId: contador("u"),
    });
    const serrote = bloco(sB, "remada-unilateral-serrote").series[0];
    expect(serrote?.reps).not.toBeNull();
    expect(serrote?.repsLado2).toBe(serrote?.reps);
    // o `maximo` da barra fixa não pré-preenche reps: quem diz é a série feita
    expect(bloco(sB, "barra-fixa-pronada").series[0]?.reps).toBeNull();
  });

  it("conta as séries de trabalho no rodapé (o aquecimento não conta)", () => {
    const s = sessaoA();
    expect(progressoDaSessao(s)).toMatchObject({ feitas: 0, total: 16 });
    const feito = fazerTudoNoTopo(s, "agachamento-livre");
    expect(progressoDaSessao(feito)).toMatchObject({ feitas: 3, texto: "3/16 séries" });
  });
});

/* ------------------------------------------------------ mexer na sessão */

describe("mexer nas séries", () => {
  it("concluir uma série preenche a seguinte (SPEC §3.2)", () => {
    const s = sessaoA();
    const b = bloco(s, "remada-curvada-pronada");
    const primeira = b.series[0]!;
    let nova = atualizarSerie(s, b.ordem, primeira.id, { reps: 7, cargaKg: 25.5 });
    nova = marcarSerie(nova, b.ordem, primeira.id, true, "2026-09-14T09:10:00.000Z");

    const depois = bloco(nova, "remada-curvada-pronada").series;
    expect(depois[0]?.concluida).toBe(true);
    expect(depois[0]?.registradaEm).toBe("2026-09-14T09:10:00.000Z");
    expect(depois[1]?.reps).toBe(7);
    expect(depois[1]?.cargaKg).toBe(25.5);
    expect(depois[1]?.concluida).toBe(false);
    // a terceira continua com o topo até a segunda ser concluída
    expect(depois[2]?.reps).toBe(8);
  });

  it("a série de aquecimento não vaza para a primeira de trabalho", () => {
    const s = sessaoA();
    const b = bloco(s, "agachamento-livre");
    const aquece = b.series[1]!; // segunda linha de aquecimento
    const nova = marcarSerie(s, b.ordem, aquece.id, true);
    expect(bloco(nova, "agachamento-livre").series[2]?.reps).toBe(5);
    expect(bloco(nova, "agachamento-livre").series[2]?.tipo).toBe("trabalho");
  });

  it("desmarcar limpa o horário de registro", () => {
    const s = sessaoA();
    const b = bloco(s, "rosca-direta-com-barra");
    const id = b.series[0]!.id;
    const marcada = marcarSerie(s, b.ordem, id, true, "2026-09-14T10:00:00.000Z");
    const desmarcada = marcarSerie(marcada, b.ordem, id, false);
    expect(bloco(desmarcada, "rosca-direta-com-barra").series[0]?.concluida).toBe(false);
    expect(bloco(desmarcada, "rosca-direta-com-barra").series[0]?.registradaEm).toBeNull();
  });

  it("cargaEmUso: a folha de montagem fala da carga que está na barra (§6.5)", () => {
    const s = sessaoA();
    const b = bloco(s, "agachamento-livre");
    // sem tocar em nada é a carga do dia
    expect(cargaEmUso(b)).toBe(7.5);

    // mudou a carga da próxima série: é dela que a montagem tem de falar
    const trabalho = b.series.filter((x) => x.tipo === "trabalho");
    const mudada = atualizarSerie(s, b.ordem, trabalho[0]!.id, { cargaKg: 25.5 });
    expect(cargaEmUso(bloco(mudada, "agachamento-livre"))).toBe(25.5);

    // com a primeira já feita, vale a próxima a fazer
    const feita = marcarSerie(mudada, b.ordem, trabalho[0]!.id, true);
    expect(cargaEmUso(bloco(feita, "agachamento-livre"))).toBe(25.5);
    const outra = atualizarSerie(feita, b.ordem, trabalho[1]!.id, { cargaKg: 27.5 });
    expect(cargaEmUso(bloco(outra, "agachamento-livre"))).toBe(27.5);

    // tudo marcado: a última feita
    const tudo = fazerTudoNoTopo(s, "agachamento-livre", { cargaKg: 11.5 });
    expect(cargaEmUso(bloco(tudo, "agachamento-livre"))).toBe(11.5);
  });

  it("firmePadrao: sim quando todas as séries chegaram ao topo", () => {
    const s = sessaoA();
    expect(firmePadrao(bloco(s, "agachamento-livre"))).toBe(false);
    const tudo = fazerTudoNoTopo(s, "agachamento-livre");
    expect(firmePadrao(bloco(tudo, "agachamento-livre"))).toBe(true);
    const curto = fazerTudoNoTopo(s, "remada-curvada-pronada", { reps: 6 });
    expect(firmePadrao(bloco(curto, "remada-curvada-pronada"))).toBe(false);
  });
});

/* ---------------------------------------------------------- substituição */

describe("substituir hoje (SPEC §3.2)", () => {
  it("só oferece exercícios do mesmo grupo com equipamento daqui", () => {
    const lista = substitutosPara("agachamento-livre");
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((e) => e.grupo === "Pernas")).toBe(true);
    expect(lista.some((e) => e.id === "agachamento-livre")).toBe(false);
    expect(lista.some((e) => e.id === "agachamento-frontal")).toBe(true);
  });

  it("as séries que o original já gravou saem do banco (SPEC §3.2)", () => {
    const s = sessaoA();
    const b = bloco(s, "agachamento-livre");
    // nada subiu ainda: não há o que apagar
    expect(escritaDeDescarte(s, b)).toBeNull();

    const comSerie = marcarSerie(s, 1, b.series[0]!.id, true, "2026-09-14T09:10:00.000Z");
    const descarte = escritaDeDescarte(comSerie, bloco(comSerie, "agachamento-livre"));
    expect(descarte).toEqual({
      tabela: "session_sets",
      op: "delete",
      filtro: {
        session_id: "sess-1",
        exercise_id: "agachamento-livre",
        ordem_ex: 1,
      },
    });

    // depois da troca, o bloco é do substituto e as linhas locais são novas
    const trocada = substituirExercicio(comSerie, 1, "agachamento-frontal", null, {
      novoId: contador("n"),
    });
    expect(trocada.blocos[0]?.series.every((x) => x.registradaEm === null)).toBe(true);
  });

  it("o registro fica com o substituto e o original não é avaliado", () => {
    const s = sessaoA();
    const trocada = substituirExercicio(s, 1, "agachamento-frontal", null, {
      novoId: contador("n"),
    });
    const b = trocada.blocos[0]!;
    expect(b.exercicioId).toBe("agachamento-frontal");
    expect(b.originalId).toBe("agachamento-livre");
    expect(b.substituido).toBe(true);

    const feita = fazerTudoNoTopo(trocada, "agachamento-frontal");
    const resultados = avaliarSessao(feita);
    expect(resultados.map((r) => r.exercicioId)).toContain("agachamento-frontal");
    expect(resultados.map((r) => r.exercicioId)).not.toContain("agachamento-livre");
  });

  /*
   * SPEC §6.3: "o substituto usa o próprio estado". Passar `null` aqui seria
   * dizer "nunca fez este exercício" e o upsert do fim apagaria a progressão
   * real dele — o defeito que a auditoria do marco 3 pegou.
   */
  it("o substituto parte da carga dele, e é dela que a subida sai", () => {
    const frontal = acharExercicio("agachamento-frontal");
    const estado: EstadoExercicio = {
      ...estadoInicial(frontal),
      carga_atual_kg: 31.5,
      reps_alvo: 8,
    };
    const trocada = substituirExercicio(sessaoA(), 1, "agachamento-frontal", estado, {
      novoId: contador("n"),
    });
    const b = trocada.blocos[0]!;
    expect(b.alvo.carga_kg).toBe(31.5);
    expect(textoDaCargaDoBloco(b)).toBe("31,5 kg na barra");
    expect(b.series.every((x) => x.cargaKg === 31.5)).toBe(true);

    const { resultados, escritas } = concluirSessao({
      sessao: fazerTudoNoTopo(trocada, "agachamento-frontal"),
      agora: "2026-09-14T10:00:00.000Z",
      novoId: contador("e"),
    });
    const resultado = resultados.find((r) => r.exercicioId === "agachamento-frontal")!;
    expect(resultado.naoAvaliado).toBe(false);
    // 3 × 8 no topo da faixa 6–8 com a última firme: +2 kg (§6.2)
    expect(resultado.texto).toBe("31,5 → 33,5 kg na barra");

    const upsert = escritas.find(
      (e) =>
        e.tabela === "exercise_state" &&
        e.linha?.["exercise_id"] === "agachamento-frontal",
    );
    expect(upsert?.linha).toMatchObject({ carga_atual_kg: 33.5, reps_alvo: 8 });
    // e nada é escrito no nome do exercício que saiu
    expect(
      escritas.some((e) => e.linha?.["exercise_id"] === "agachamento-livre"),
    ).toBe(false);
  });

  it("o substituto leva as séries anteriores e os recordes dele", () => {
    const trocada = substituirExercicio(sessaoA(), 6, "barra-fixa-pronada", null, {
      anteriores: [5, 5, 5],
      recorde: { carga_max_kg: 0, reps_max: 6, e1rm_epley: 0 },
      novoId: contador("n"),
    });
    const b = trocada.blocos[5]!;
    expect(b.seriesAnteriores).toEqual([5, 5, 5]);
    expect(b.recordeReps).toBe(6);

    // 3 × 6 contra 5/5/5: a média sobe 1 e nenhuma série cai (§6.3)
    const feita = fazerTudoNoTopo(trocada, "barra-fixa-pronada", { reps: 6 });
    const resultado = avaliarSessao(feita).find(
      (r) => r.exercicioId === "barra-fixa-pronada",
    )!;
    expect(resultado.motivo).toBe("subiu");
    // 6 repetições não batem o recorde de 6 que ele já tinha (§6.6)
    expect(resultado.recordes).toEqual([]);
  });

  /*
   * Offline sem cache: não dá para saber a carga do substituto. Melhor não
   * avaliar do que apagar a progressão dele (SPEC §6.3).
   */
  it("com o estado do substituto desconhecido, nada é avaliado nem gravado", () => {
    const trocada = substituirExercicio(sessaoA(), 1, "agachamento-frontal", null, {
      estadoConhecido: false,
      novoId: contador("n"),
    });
    const feita = fazerTudoNoTopo(trocada, "agachamento-frontal");
    const { resultados, escritas } = concluirSessao({
      sessao: { ...feita, status: "concluida" },
      agora: "2026-09-14T10:00:00.000Z",
      novoId: contador("e"),
    });

    const resultado = resultados.find((r) => r.exercicioId === "agachamento-frontal")!;
    expect(resultado.naoAvaliado).toBe(true);
    expect(resultado.motivo).toBeNull();
    expect(resultado.decisao.evento).toBeNull();
    // sem os recordes de verdade, qualquer série viraria recorde
    expect(resultado.recordes).toEqual([]);
    expect(recordesDoBloco(feita.blocos[0]!)).toEqual([]);

    expect(
      escritas.some(
        (e) =>
          (e.tabela === "exercise_state" || e.tabela === "progression_events") &&
          e.linha?.["exercise_id"] === "agachamento-frontal",
      ),
    ).toBe(false);
    // as séries do bloco continuam indo para o banco (SPEC §8)
    const b = feita.blocos[0]!;
    expect(escritaDaSerie(feita, b, b.series[2]!).linha).toMatchObject({
      exercise_id: "agachamento-frontal",
    });
  });

  it("uma sessão gravada antes deste campo continua sendo avaliada", () => {
    const s = fazerTudoNoTopo(sessaoA(), "agachamento-livre");
    const antiga: SessaoLocal = {
      ...s,
      blocos: s.blocos.map((b) => {
        const semCampo: Partial<BlocoLocal> = { ...b };
        delete semCampo.estadoConhecido;
        return semCampo as BlocoLocal;
      }),
    };
    const resultado = avaliarSessao(antiga).find(
      (r) => r.exercicioId === "agachamento-livre",
    )!;
    expect(resultado.naoAvaliado).toBe(false);
    expect(resultado.motivo).toBe("subiu");
  });
});

describe("o que a tela precisa carregar antes de uma substituição (SPEC §6.3)", () => {
  it("idsComSubstitutos traz os substitutos possíveis de cada bloco", () => {
    const ids = idsComSubstitutos(["agachamento-livre", "supino-reto-com-barra"]);
    expect(ids).toContain("agachamento-livre");
    expect(ids).toContain("agachamento-frontal");
    expect(ids).toContain("supino-reto-com-barra");
    for (const e of substitutosPara("supino-reto-com-barra")) expect(ids).toContain(e.id);
    // sem repetição e em ordem estável (a chave do cache é ela)
    expect(ids).toEqual([...new Set(ids)].sort());
  });

  it("idsQueComparamComAnterior fica só com o tipo `maximo`", () => {
    const ids = idsQueComparamComAnterior([
      "agachamento-livre",
      "barra-fixa-pronada",
      "flexao-de-braco",
    ]);
    expect(ids).toEqual(["barra-fixa-pronada", "flexao-de-braco"]);
  });
});

/* ------------------------------------------------------------ steppers */

describe("proximaCarga — o ± da carga só anda em cargas alcançáveis (§6.4)", () => {
  it("sobe o incremento do exercício na escala da barra", () => {
    expect(proximaCarga(7.5, "barra_macica", 4, 1)).toBe(11.5);
    expect(proximaCarga(11.5, "barra_macica", 4, -1)).toBe(7.5);
    expect(proximaCarga(7.5, "barra_macica", 2, 1)).toBe(9.5);
  });

  it("não desce abaixo da barra vazia nem sobe acima do teto do kit", () => {
    expect(proximaCarga(7.5, "barra_macica", 4, -1)).toBe(7.5);
    expect(proximaCarga(107.5, "barra_macica", 4, 1)).toBe(107.5);
  });

  it("halteres andam de 2 em 2 por halter e a polia de 1 em 1", () => {
    expect(proximaCarga(1.5, "halteres", 2, 1)).toBe(3.5);
    expect(proximaCarga(4, "polia", 2, 1)).toBe(6);
    expect(proximaCarga(4, "polia", 2, -1)).toBe(2);
  });

  it("o elástico e a corda não têm carga para andar", () => {
    expect(proximaCarga(0, "band", 2, 1)).toBe(0);
    expect(proximaCarga(0, "corda", 2, -1)).toBe(0);
  });

  it("no lastro da mochila o passo é de 1 kg (SPEC §6.4)", () => {
    expect(proximaCarga(0, "barra_fixa", 2, 1)).toBe(2);
    expect(proximaCarga(2, "barra_fixa", 2, -1)).toBe(0);
  });
});

/* ------------------------------------------------------------- montagem */

describe("montagem na tela (SPEC §6.5)", () => {
  it("devolve as anilhas por lado e a diferença quando não fecha", () => {
    const exata = montagemDaCarga("agachamento-livre", 25.5);
    expect(exata?.porLado).toEqual([5, 4]);
    expect(exata?.exato).toBe(true);

    const torta = montagemDaCarga("agachamento-livre", 26.5);
    expect(torta?.total).toBe(25.5);
    expect(torta?.exato).toBe(false);
    expect(torta?.diferenca).toBe(-1);
  });

  it("peso corporal não monta anilha nenhuma", () => {
    const m = montagemDaCarga("elevacao-de-pernas-na-barra-fixa", 0);
    expect(m?.anilhas).toEqual([]);
  });
});

/* ------------------------------------------------- escritas da fila (§8) */

describe("escritas da fila de saída (SPEC §8)", () => {
  it("a criação da sessão é um upsert por id (dá para criar offline)", () => {
    const s = sessaoA();
    expect(escritaDaSessao(s)).toEqual({
      tabela: "sessions",
      op: "upsert",
      onConflict: "id",
      linha: {
        id: "sess-1",
        user_id: "u1",
        data: "2026-09-14",
        workout_id: "A1",
        fase: "fase1",
        status: "em_andamento",
        iniciada_em: "2026-09-14T09:00:00.000Z",
        // treino do programa: a semana do plano é das sessões de fixa (§3.4)
        semana_plano: null,
      },
    });
  });

  it("a sessão de barra fixa grava a semana do plano em que foi criada (§3.4)", () => {
    const sessao = montarSessaoAvulsa({
      id: "fixa-1",
      userId: "u1",
      data: "2026-09-17",
      workoutId: "fixa",
      fase: "fase1",
      itens: [itemDaSessao(3)],
      semanaPlano: 3,
      agora: "2026-09-17T09:00:00.000Z",
      novoId: contador(),
    });
    expect(sessao.semanaPlano).toBe(3);
    expect(escritaDaSessao(sessao).linha?.["semana_plano"]).toBe(3);

    // refeita noutro aparelho: volta com a prescrição DAQUELA semana (4 × 8
    // da semana 5–6), e não com a de hoje
    const refeita = reconstruirSessao(
      {
        id: "fixa-1",
        user_id: "u1",
        data: "2026-09-17",
        workout_id: "fixa",
        fase: "fase1",
        status: "em_andamento",
        iniciada_em: "2026-09-17T09:00:00.000Z",
        semana_plano: 5,
      },
      [],
      { itens: [itemDaSessao(5)], novoId: contador() },
    );
    expect(refeita?.semanaPlano).toBe(5);
    expect(refeita?.blocos[0]?.series).toHaveLength(4);
    expect(refeita?.blocos[0]?.prescricao.max).toBe(8);
  });

  it("cada série concluída é um upsert em session_sets por id", () => {
    const s = fazerTudoNoTopo(sessaoA(), "agachamento-livre");
    const b = bloco(s, "agachamento-livre");
    const serie = b.series.find((x) => x.tipo === "trabalho")!;
    const escrita = escritaDaSerie(s, b, serie);

    expect(escrita.tabela).toBe("session_sets");
    expect(escrita.op).toBe("upsert");
    expect(escrita.onConflict).toBe("id");
    expect(escrita.linha).toMatchObject({
      id: serie.id,
      session_id: "sess-1",
      user_id: "u1",
      exercise_id: "agachamento-livre",
      ordem_ex: 1,
      set_index: 1,
      tipo: "trabalho",
      reps: 5,
      carga_kg: 7.5,
      concluida: true,
      reps_alvo_min: 5,
      reps_alvo_max: 5,
      // SPEC §3.2: o valor que o motor vai usar, não o "ainda não tocado"
      ultima_firme: true,
    });
  });

  it("as notas dos blocos viram uma nota só da sessão", () => {
    const s = sessaoA();
    const comNota: SessaoLocal = {
      ...s,
      blocos: s.blocos.map((b) =>
        b.ordem === 1 ? { ...b, nota: "joelho reclamou" } : b,
      ),
    };
    expect(notasDaSessao(comNota)).toBe("Agachamento livre: joelho reclamou");
    expect(notasDaSessao(s)).toBeNull();
  });
});

/* ----------------------------------------------------------- conclusão */

describe("concluirSessao — o motor e as escritas (SPEC §6.2, §6.6 e §8)", () => {
  function tudoNoTopo(): SessaoLocal {
    let s = sessaoA();
    for (const b of s.blocos) {
      s = fazerTudoNoTopo(s, b.exercicioId);
    }
    return { ...s, status: "concluida" };
  }

  /*
   * A fila de saída (SPEC §8) não garante que a criação da sessão já tenha
   * subido quando a conclusão vai: basta o POST da criação falhar uma vez. Um
   * `update` que não casa com nenhuma linha é sucesso no PostgREST (204, zero
   * linhas) e sairia da fila como enviado, deixando a sessão "em_andamento"
   * para sempre. Por isso a conclusão regrava a linha inteira por upsert.
   */
  it("a conclusão é um upsert da linha inteira, não um update (§8)", () => {
    const sessao: SessaoLocal = {
      ...tudoNoTopo(),
      sensacao: 4,
      pesoCorporal: 86.4,
      notas: "joelho reclamou",
    };
    const { escritas } = concluirSessao({
      sessao,
      agora: "2026-09-14T09:44:00.000Z",
      novoId: contador("ev"),
    });

    const daSessao = escritas.filter((e) => e.tabela === "sessions");
    expect(daSessao).toHaveLength(1);
    expect(daSessao[0]?.filtro).toBeUndefined();
    expect(daSessao[0]).toEqual({
      tabela: "sessions",
      op: "upsert",
      onConflict: "id",
      linha: {
        // tudo que a criação gravaria, para a linha ficar completa mesmo se
        // este for o primeiro item da sessão a chegar no banco
        id: "sess-1",
        user_id: "u1",
        data: "2026-09-14",
        workout_id: "A1",
        fase: "fase1",
        iniciada_em: "2026-09-14T09:00:00.000Z",
        semana_plano: null,
        // e o que o fim do treino acrescenta
        status: "concluida",
        concluida_em: "2026-09-14T09:44:00.000Z",
        duracao_s: 44 * 60,
        sensacao: 4,
        peso_corporal: 86.4,
        notas: "joelho reclamou",
      },
    });
  });

  it("o evento de progressão também é upsert por id (reenviar não duplica, §8)", () => {
    const { escritas } = concluirSessao({
      sessao: tudoNoTopo(),
      agora: "2026-09-14T09:44:00.000Z",
      novoId: contador("ev"),
    });
    const eventos = escritas.filter((e) => e.tabela === "progression_events");
    expect(eventos.length).toBeGreaterThan(0);
    for (const evento of eventos) {
      expect(evento.op).toBe("upsert");
      expect(evento.onConflict).toBe("id");
      expect(evento.linha?.id).toBeTruthy();
    }
  });

  it("tudo no topo com a última firme: sobe e grava o evento", () => {
    const { resultados, escritas } = concluirSessao({
      sessao: tudoNoTopo(),
      agora: "2026-09-14T09:44:00.000Z",
      novoId: contador("ev"),
    });

    const agachamento = resultados.find((r) => r.exercicioId === "agachamento-livre")!;
    expect(agachamento.simbolo).toBe("↑");
    expect(agachamento.motivo).toBe("subiu");
    expect(agachamento.texto).toBe("7,5 → 11,5 kg na barra");
    expect(agachamento.decisao.novoEstado.carga_atual_kg).toBe(11.5);

    // elevação de pernas progride em reps (SPEC §6.3)
    const pernas = resultados.find(
      (r) => r.exercicioId === "elevacao-de-pernas-na-barra-fixa",
    )!;
    expect(pernas.simbolo).toBe("↑");
    /*
     * SPEC §6.1: na primeira vez o estado guarda o PISO da faixa (10), e é
     * dele que o evento da §6.6 parte; o topo a bater (15) é o que a tela
     * pré-preenche em cada série (`alvo_max`).
     */
    expect(pernas.texto).toBe("10 → 16 repetições");

    const sessions = escritas.filter((e) => e.tabela === "sessions");
    expect(sessions).toHaveLength(1);
    // a linha inteira por upsert, para a ordem da fila não perder o fim do
    // treino (§8) — ver "a conclusão é um upsert da linha inteira"
    expect(sessions[0]?.op).toBe("upsert");
    expect(sessions[0]?.linha).toMatchObject({
      status: "concluida",
      concluida_em: "2026-09-14T09:44:00.000Z",
      duracao_s: 2640,
    });

    const estados = escritas.filter((e) => e.tabela === "exercise_state");
    expect(estados).toHaveLength(6);
    expect(estados[0]).toMatchObject({ op: "upsert", onConflict: "user_id,exercise_id" });
    expect(estados[0]?.linha).toMatchObject({
      user_id: "u1",
      exercise_id: "agachamento-livre",
      carga_atual_kg: 11.5,
      falhas_seguidas: 0,
    });

    const eventos = escritas.filter((e) => e.tabela === "progression_events");
    expect(eventos).toHaveLength(6);
    // upsert pelo id do cliente: reenviar não duplica (§8)
    expect(eventos[0]?.op).toBe("upsert");
    expect(eventos[0]?.linha).toMatchObject({
      user_id: "u1",
      exercise_id: "agachamento-livre",
      session_id: "sess-1",
      data: "2026-09-14",
      motivo: "subiu",
      de: { carga_kg: 7.5 },
      para: { carga_kg: 11.5 },
    });

    const perfil = escritas.find((e) => e.tabela === "profiles");
    expect(perfil).toMatchObject({
      op: "update",
      filtro: { user_id: "u1" },
      linha: { ultimo_treino: "A1" },
    });
  });

  it("sem a última firme o exercício repete (SPEC §6.2)", () => {
    let s = tudoNoTopo();
    s = {
      ...s,
      blocos: s.blocos.map((b) =>
        b.exercicioId === "agachamento-livre" ? { ...b, ultimaFirme: false } : b,
      ),
    };
    const { resultados } = concluirSessao({ sessao: s, novoId: contador("e") });
    const agachamento = resultados.find((r) => r.exercicioId === "agachamento-livre")!;
    expect(agachamento.simbolo).toBe("=");
    expect(agachamento.texto).toBe("repetiu 7,5 kg na barra");
  });

  it("abandonar mantém o registrado, não avalia o incompleto e não mexe no perfil", () => {
    let s = sessaoA();
    s = fazerTudoNoTopo(s, "agachamento-livre");
    s = { ...s, status: "abandonada" };

    const { resultados, escritas } = concluirSessao({ sessao: s, novoId: contador("e") });
    const agachamento = resultados.find((r) => r.exercicioId === "agachamento-livre")!;
    expect(agachamento.motivo).toBe("subiu");
    const supino = resultados.find((r) => r.exercicioId === "supino-reto-com-barra")!;
    expect(supino.motivo).toBeNull();

    expect(escritas.find((e) => e.tabela === "profiles")).toBeUndefined();
    expect(escritas.filter((e) => e.tabela === "progression_events")).toHaveLength(1);
    expect(escritas[0]?.linha).toMatchObject({ status: "abandonada", concluida_em: null });
  });

  it("o peso do dia vira uma linha em body_weights (upsert por data)", () => {
    const s: SessaoLocal = { ...tudoNoTopo(), pesoCorporal: 86.4, sensacao: 4 };
    const { escritas } = concluirSessao({ sessao: s, novoId: contador("e") });
    expect(escritas.find((e) => e.tabela === "body_weights")).toMatchObject({
      op: "upsert",
      onConflict: "user_id,data",
      linha: { user_id: "u1", data: "2026-09-14", peso_kg: 86.4 },
    });
    expect(escritas[0]?.linha).toMatchObject({ sensacao: 4, peso_corporal: 86.4 });
  });

  it("uma série abaixo do piso é falha e o resumo mostra ↓ na segunda", () => {
    const estados: Record<string, EstadoExercicio> = {
      "agachamento-livre": {
        ...estadoInicial(acharExercicio("agachamento-livre")),
        carga_atual_kg: 43.5,
        falhas_seguidas: 1,
      },
    };
    let s = sessaoA({ estados });
    s = fazerTudoNoTopo(s, "agachamento-livre", { reps: 3, cargaKg: 43.5 });
    s = { ...s, status: "concluida" };

    const { resultados } = concluirSessao({ sessao: s, novoId: contador("e") });
    const agachamento = resultados.find((r) => r.exercicioId === "agachamento-livre")!;
    expect(agachamento.simbolo).toBe("↓");
    expect(agachamento.motivo).toBe("falha_2x_voltou_10");
    // 43,5 × 0,90 = 39,15 → a alcançável para baixo na barra maciça (§6.4)
    expect(agachamento.decisao.novoEstado.carga_atual_kg).toBe(37.5);
  });
});

/* ------------------------------------------------------------- recordes */

describe("recordes no resumo (SPEC §6.6)", () => {
  it("bate carga, reps e e1RM quando passa do que a view tinha", () => {
    const s = fazerTudoNoTopo(sessaoA(), "agachamento-livre");
    const b = bloco(s, "agachamento-livre");
    const recordes = recordesDoBloco({ ...b, recordeCarga: 5, recordeReps: 4, recordeE1rm: 6 });
    expect(recordes.map((r) => r.tipo)).toEqual(["carga", "reps", "e1rm"]);
    expect(recordes[0]?.texto).toBe("7,5 kg na barra");
    expect(recordes[1]?.texto).toBe("5 repetições");
  });

  it("não inventa recorde quando a marca antiga é maior", () => {
    const s = fazerTudoNoTopo(sessaoA(), "agachamento-livre");
    const b = bloco(s, "agachamento-livre");
    expect(
      recordesDoBloco({ ...b, recordeCarga: 60, recordeReps: 12, recordeE1rm: 80 }),
    ).toEqual([]);
  });

  it("nada concluído, nenhum recorde", () => {
    expect(recordesDoBloco(bloco(sessaoA(), "agachamento-livre"))).toEqual([]);
  });
});

/* ---------------------------------------------------- séries anteriores */

describe("seriesAnterioresPorExercicio — o tipo `maximo` precisa da última sessão", () => {
  const linha = (
    extras: Partial<LinhaSerie> & Pick<LinhaSerie, "session_id" | "set_index" | "reps" | "registrada_em">,
  ) =>
    ({
      exercise_id: "barra-fixa-pronada",
      tipo: "trabalho",
      concluida: true,
      ...extras,
    }) as LinhaSerie;

  it("pega só a sessão mais recente, na ordem das séries", () => {
    const linhas = [
      linha({ session_id: "velha", set_index: 2, reps: 2, registrada_em: "2026-09-01T10:01:00Z" }),
      linha({ session_id: "velha", set_index: 1, reps: 3, registrada_em: "2026-09-01T10:00:00Z" }),
      linha({ session_id: "nova", set_index: 1, reps: 4, registrada_em: "2026-09-08T10:00:00Z" }),
      linha({ session_id: "nova", set_index: 2, reps: 3, registrada_em: "2026-09-08T10:01:00Z" }),
    ];
    expect(seriesAnterioresPorExercicio(linhas)).toEqual({
      "barra-fixa-pronada": [4, 3],
    });
  });

  it("ignora a sessão de hoje, o aquecimento e o que não foi concluído", () => {
    const linhas = [
      linha({ session_id: "hoje", set_index: 1, reps: 9, registrada_em: "2026-09-14T10:00:00Z" }),
      linha({ session_id: "velha", set_index: 1, reps: 5, registrada_em: "2026-09-08T10:00:00Z" }),
      linha({
        session_id: "velha",
        set_index: 2,
        reps: 9,
        registrada_em: "2026-09-08T10:01:00Z",
        tipo: "aquecimento",
      }),
      linha({
        session_id: "velha",
        set_index: 3,
        reps: 9,
        registrada_em: "2026-09-08T10:02:00Z",
        concluida: false,
      }),
    ];
    expect(seriesAnterioresPorExercicio(linhas, "hoje")).toEqual({
      "barra-fixa-pronada": [5],
    });
  });
});

/* -------------------------------------------------------- reconstrução */

describe("reconstruirSessao — voltar de onde parou sem o aparelho de origem", () => {
  it("as séries gravadas vencem as pré-preenchidas", () => {
    const original = fazerTudoNoTopo(sessaoA(), "agachamento-livre");
    const b = bloco(original, "agachamento-livre");
    const gravadas = b.series
      .filter((s) => s.concluida)
      .map(
        (s) =>
          escritaDaSerie(original, b, s).linha as unknown as LinhaSerie,
      );

    const voltou = reconstruirSessao(
      {
        id: "sess-1",
        user_id: "u1",
        data: "2026-09-14",
        workout_id: "A1",
        fase: "fase1",
        status: "em_andamento",
        iniciada_em: "2026-09-14T09:00:00.000Z",
      },
      gravadas,
      { novoId: contador("r") },
    );

    expect(voltou).not.toBeNull();
    expect(progressoDaSessao(voltou!)).toMatchObject({ feitas: 3, total: 16 });
    const reconstruido = voltou!.blocos[0]!;
    expect(reconstruido.series.filter((s) => s.concluida).map((s) => s.id)).toEqual(
      b.series.filter((s) => s.concluida).map((s) => s.id),
    );
  });

  it("sessão em andamento não herda o 'última firme' parcial das séries", () => {
    /*
     * As séries sobem uma a uma: quando a 1ª é gravada as outras ainda nem
     * foram feitas, então o `ultima_firme` daquele instante é `false`. Herdar
     * esse retrato fixava "não" no aparelho que refizesse a sessão e fazia o
     * motor repetir a carga em vez de subir (SPEC §6.2).
     */
    let s = sessaoA();
    const gravadas: LinhaSerie[] = [];
    for (const serie of bloco(s, "agachamento-livre").series) {
      if (serie.tipo !== "trabalho") continue;
      const antes = bloco(s, "agachamento-livre");
      s = marcarSerie(s, antes.ordem, serie.id, true, "2026-09-14T09:30:00.000Z");
      const agora = bloco(s, "agachamento-livre");
      const viva = agora.series.find((x) => x.id === serie.id)!;
      gravadas.push(escritaDaSerie(s, agora, viva).linha as unknown as LinhaSerie);
    }
    expect(gravadas[0]?.ultima_firme).toBe(false);
    expect(gravadas[gravadas.length - 1]?.ultima_firme).toBe(true);

    const linha = {
      id: "sess-1",
      user_id: "u1",
      data: "2026-09-14",
      workout_id: "A1",
      fase: "fase1",
      iniciada_em: "2026-09-14T09:00:00.000Z",
    } as const;

    const aberta = reconstruirSessao(
      { ...linha, status: "em_andamento" },
      gravadas,
      { novoId: contador("r") },
    );
    const refeito = bloco(aberta!, "agachamento-livre");
    expect(refeito.ultimaFirme).toBeNull();
    expect(firmePadrao(refeito)).toBe(true);

    // terminada, o valor gravado é o final da conclusão e vale como está
    const fechada = reconstruirSessao(
      { ...linha, status: "concluida" },
      gravadas,
      { novoId: contador("r") },
    );
    expect(bloco(fechada!, "agachamento-livre").ultimaFirme).toBe(false);
  });
});

describe("sessão avulsa — a barra fixa da semana (SPEC §3.4)", () => {
  function fixa(semana = 1) {
    return montarSessaoAvulsa({
      id: "fixa-1",
      userId: "u1",
      data: "2026-09-17",
      workoutId: WORKOUT_BARRA_FIXA,
      itens: [itemDaSessao(semana)],
      fase: "fase1",
      agora: "2026-09-17T09:00:00.000Z",
      novoId: contador("f"),
    });
  }

  it("um bloco só, com as séries e reps do plano da semana", () => {
    const sessao = fixa(1);
    expect(sessao.workoutId).toBe("fixa");
    expect(sessao.blocos).toHaveLength(1);
    const bloco = sessao.blocos[0]!;
    expect(bloco.exercicioId).toBe("barra-fixa-assistida");
    expect(bloco.prescricao).toMatchObject({ series: 4, tipo: "reps", min: 5, max: 5 });
    // peso corporal: nenhuma série de aquecimento com barra (SPEC §3.2)
    expect(bloco.series.every((s) => s.tipo === "trabalho")).toBe(true);
    expect(bloco.series).toHaveLength(4);
    expect(bloco.series[0]?.repsAlvoMax).toBe(5);
    expect(progressoDaSessao(sessao)).toMatchObject({ feitas: 0, total: 4 });
  });

  it("a semana 11 pede 5 × máximo (o tipo `maximo` do motor)", () => {
    const bloco = fixa(11).blocos[0]!;
    expect(bloco.prescricao).toMatchObject({ series: 5, tipo: "maximo" });
    expect(bloco.series).toHaveLength(5);
    expect(bloco.series[0]?.reps).toBeNull();
  });

  it("concluir NÃO mexe em profiles.ultimo_treino (não é treino do programa, §5.2)", () => {
    const sessao = fixa(1);
    const { escritas } = concluirSessao({
      sessao: { ...sessao, status: "concluida" },
      agora: "2026-09-17T09:30:00.000Z",
      novoId: contador("e"),
    });
    expect(escritas.some((e) => e.tabela === "profiles")).toBe(false);
    // SPEC §8: a conclusão grava a linha inteira por upsert (ver o teste da
    // ordem da fila mais abaixo), não um update do que mudou
    expect(escritas[0]).toMatchObject({ tabela: "sessions", op: "upsert" });
  });

  it("a sessão volta do banco com os itens do plano", () => {
    const voltou = reconstruirSessao(
      {
        id: "fixa-1",
        user_id: "u1",
        data: "2026-09-17",
        workout_id: "fixa",
        fase: "fase1",
        status: "em_andamento",
        iniciada_em: "2026-09-17T09:00:00.000Z",
      },
      [],
      { itens: [itemDaSessao(1)], novoId: contador("r") },
    );
    expect(voltou?.blocos[0]?.exercicioId).toBe("barra-fixa-assistida");

    // sem os itens não dá para refazer: melhor nada do que uma sessão errada
    expect(
      reconstruirSessao(
        {
          id: "fixa-1",
          user_id: "u1",
          data: "2026-09-17",
          workout_id: "fixa",
          fase: "fase1",
          status: "em_andamento",
          iniciada_em: "2026-09-17T09:00:00.000Z",
        },
        [],
        { novoId: contador("r") },
      ),
    ).toBeNull();
  });
});

describe("comSubstituicoes (SPEC §13.3)", () => {
  it("troca o bloco pelo substituto escolhido antes de começar", () => {
    const substituto = substitutosPara("agachamento-livre")[0]!;
    const sessao = comSubstituicoes(
      sessaoA(),
      { "agachamento-livre": substituto.id },
      { novoId: contador("t") },
    );
    const primeiro = sessao.blocos[0]!;
    expect(primeiro.exercicioId).toBe(substituto.id);
    expect(primeiro.originalId).toBe("agachamento-livre");
    expect(primeiro.substituido).toBe(true);
    // a prescrição passa a ser a do substituto (§6.3)
    expect(primeiro.series.length).toBe(primeiro.prescricao.series);
  });

  it("ignora troca vazia, para o próprio exercício e para id inexistente", () => {
    const base = sessaoA();
    expect(comSubstituicoes(base, {})).toBe(base);
    expect(
      comSubstituicoes(base, { "agachamento-livre": "agachamento-livre" }).blocos[0]
        ?.exercicioId,
    ).toBe("agachamento-livre");
    expect(
      comSubstituicoes(base, { "agachamento-livre": "nao-existe" }).blocos[0]?.exercicioId,
    ).toBe("agachamento-livre");
  });

  it("o estado do substituto é o que vale (a progressão do original não muda)", () => {
    const substituto = substitutosPara("agachamento-livre")[0]!;
    const estado = estadoInicial(substituto);
    const sessao = comSubstituicoes(
      sessaoA(),
      { "agachamento-livre": substituto.id },
      { estados: { [substituto.id]: estado }, novoId: contador("t") },
    );
    expect(sessao.blocos[0]?.estado).toEqual(estado);
    expect(sessao.blocos[0]?.estadoConhecido).toBe(true);
  });
});

describe("proximoExercicio (SPEC §13.3)", () => {
  it("é o segundo bloco com série por fazer", () => {
    const sessao = sessaoA();
    const primeiro = sessao.blocos[0]!;
    const segundo = sessao.blocos[1]!;
    expect(proximoExercicio(sessao)).toBe(acharExercicio(segundo.exercicioId).nome);

    // com o primeiro bloco inteiro concluído, o próximo é o terceiro
    let feito = sessao;
    for (const serie of primeiro.series) {
      feito = marcarSerie(feito, primeiro.ordem, serie.id, true);
    }
    expect(proximoExercicio(feito)).toBe(
      acharExercicio(sessao.blocos[2]!.exercicioId).nome,
    );
  });

  it("no último bloco não há próximo", () => {
    let sessao = sessaoA();
    for (const bloco of sessao.blocos.slice(0, -1)) {
      for (const serie of bloco.series) {
        sessao = marcarSerie(sessao, bloco.ordem, serie.id, true);
      }
    }
    expect(proximoExercicio(sessao)).toBeNull();
  });
});

describe("prescrição só de hoje (SPEC §14.2)", () => {
  it("o stepper de repetições muda só as séries que faltam", () => {
    let s = sessaoA();
    const b = bloco(s, "agachamento-livre");
    const primeira = b.series.find((x) => x.tipo === "trabalho")!;
    s = marcarSerie(s, b.ordem, primeira.id, true, "2026-09-14T09:10:00.000Z");

    s = ajustarPrescricaoDaSessao(s, b.ordem, { alvo: 8 });
    const depois = bloco(s, "agachamento-livre").series.filter(
      (x) => x.tipo === "trabalho",
    );
    // a concluída fica como foi registrada
    expect(depois[0]?.reps).toBe(5);
    expect(depois[1]?.reps).toBe(8);
    expect(depois[2]?.reps).toBe(8);
    // o alvo do motor não se mexe (§14.2: nunca o exercise_state)
    expect(bloco(s, "agachamento-livre").alvo.alvo_max).toBe(5);
  });

  it("o stepper de séries acrescenta e tira, sem apagar registro", () => {
    let s = sessaoA();
    const b = bloco(s, "agachamento-livre");
    s = ajustarPrescricaoDaSessao(s, b.ordem, { series: 5 }, { novoId: contador("n") });
    let trabalho = bloco(s, "agachamento-livre").series.filter(
      (x) => x.tipo === "trabalho",
    );
    expect(trabalho).toHaveLength(5);
    expect(trabalho.map((x) => x.setIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(bloco(s, "agachamento-livre").prescricao.series).toBe(5);
    // o aquecimento continua intacto
    expect(
      bloco(s, "agachamento-livre").series.filter((x) => x.tipo === "aquecimento"),
    ).toHaveLength(2);

    s = ajustarPrescricaoDaSessao(s, b.ordem, { series: 1 });
    trabalho = bloco(s, "agachamento-livre").series.filter((x) => x.tipo === "trabalho");
    expect(trabalho).toHaveLength(1);
  });

  it("uma série concluída segura o corte", () => {
    let s = sessaoA();
    const b = bloco(s, "agachamento-livre");
    for (const serie of b.series) {
      if (serie.tipo === "trabalho") {
        s = marcarSerie(s, b.ordem, serie.id, true, "2026-09-14T09:10:00.000Z");
      }
    }
    s = ajustarPrescricaoDaSessao(s, b.ordem, { series: 1 });
    expect(
      bloco(s, "agachamento-livre").series.filter((x) => x.tipo === "trabalho"),
    ).toHaveLength(3);
  });

  it("em tempo e passos o stepper mexe no campo certo", () => {
    let s = montarSessaoAvulsa({
      id: "livre-1",
      userId: "u1",
      data: "2026-09-14",
      workoutId: "livre",
      fase: "fase1",
      novoId: contador("t"),
      itens: [
        {
          exercicioId: "prancha-lateral",
          prescricao: prescricaoPadrao(acharExercicio("prancha-lateral")),
          descansoS: 60,
          descansoTexto: "60 s",
        },
      ],
    });
    s = ajustarPrescricaoDaSessao(s, 1, { alvo: 50 });
    const serie = s.blocos[0]!.series[0]!;
    expect(serie.tempoS).toBe(50);
    // unilateral: os dois lados (SPEC §6.3 usa o menor)
    expect(serie.tempoSLado2).toBe(50);
    expect(serie.reps).toBeNull();
  });

  it("os limites: no mínimo 1 série, no máximo 10", () => {
    const s = sessaoA();
    const b = bloco(s, "agachamento-livre");
    expect(
      ajustarPrescricaoDaSessao(s, b.ordem, { series: 0 }).blocos[0]!.series.filter(
        (x) => x.tipo === "trabalho",
      ),
    ).toHaveLength(MIN_SERIES_DA_SESSAO);
    expect(
      ajustarPrescricaoDaSessao(s, b.ordem, { series: 99 }).blocos[0]!.series.filter(
        (x) => x.tipo === "trabalho",
      ),
    ).toHaveLength(MAX_SERIES_DA_SESSAO);
  });
});

describe("contadores da conclusão (SPEC §14.1.5)", () => {
  it("conta exercícios, séries e volume das séries de trabalho concluídas", () => {
    let s = sessaoA();
    s = fazerTudoNoTopo(s, "agachamento-livre");
    const contas = contadoresDaSessao(s);
    expect(contas.exercicios).toBe(1);
    expect(contas.series).toBe(3);
    // 3 × 5 reps × 7,5 kg
    expect(contas.volumeKg).toBe(112.5);
  });

  it("sessão em branco não conta nada; aquecimento não soma", () => {
    const s = sessaoA();
    expect(contadoresDaSessao(s)).toEqual({ exercicios: 0, series: 0, volumeKg: 0 });
  });

  it("peso do corpo não soma volume, mas conta como série", () => {
    let s = sessaoA();
    s = fazerTudoNoTopo(s, "elevacao-de-pernas-na-barra-fixa");
    const contas = contadoresDaSessao(s);
    expect(contas.exercicios).toBe(1);
    expect(contas.series).toBe(3);
    expect(contas.volumeKg).toBe(0);
  });
});
