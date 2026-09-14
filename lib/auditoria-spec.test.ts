/**
 * AUDITORIA ADVERSARIAL — lente "spec" (rodada 2).
 *
 * Conformidade do motor com SPEC.md §5 e §6 e com
 * docs/casos-de-teste-progressao.md, além dos 22 casos do documento. A rodada 1
 * já cobriu a leitura direta de cada regra; aqui o ataque é por *sequência*:
 * cadeias de sessões (subir → falhar → falhar → semana leve → subir), a vida do
 * `exigir_rep_extra`, o estado do elástico degrau a degrau, a semana curta com
 * a alternância A/B da §5.2 e as semanas dos planos de cardio.
 *
 * Nada aqui é código de produção: é prova de conformidade.
 */
import { describe, expect, it } from "vitest";
import { acharExercicio, acharTreino, exercicios } from "@/lib/dados";
import {
  alcancavelParaBaixo,
  cargaMaxima,
  cargaMinima,
  cargasPossiveis,
  montagem,
} from "@/lib/montagem";
import {
  cargaDeHoje,
  decidir,
  estadoInicial,
  incrementoDe,
  prescricaoDoTreino,
  prescricaoPadrao,
  type Alvo,
  type ContextoDecisao,
  type Decisao,
  type EstadoExercicio,
  type SerieFeita,
} from "@/lib/progressao";
import {
  avancarSemanaDeBarraFixa,
  avancarSemanaDeCorda,
  avancarSemanaDeCorrida,
  proximoTreinoAlternado,
  semanaCurta,
  semanaDoPlano,
  sessaoCardioDeHoje,
  sugerirFase2,
  treinoDeHoje,
  type DiaDoPlano,
  type PerfilCalendario,
} from "@/lib/calendario";
import type { Exercicio, TreinoId } from "@/lib/schemas";

/* ------------------------------------------------------------- atalhos */

const supino = acharExercicio("supino-reto-com-barra");
const agachamento = acharExercicio("agachamento-livre");
const terra = acharExercicio("levantamento-terra");
const rosca = acharExercicio("rosca-alternada");
const puxada = acharExercicio("puxada-alta-na-polia");
const assistida = acharExercicio("barra-fixa-assistida");
const pronada = acharExercicio("barra-fixa-pronada");
const prancha = acharExercicio("prancha");
const pranchaLateral = acharExercicio("prancha-lateral");
const elevacaoPernas = acharExercicio("elevacao-de-pernas-na-barra-fixa");
const farmer = acharExercicio("farmer-s-walk");
const bulgaro = acharExercicio("agachamento-bulgaro");

function estadoDe(
  ex: Exercicio,
  patch: Partial<EstadoExercicio> = {},
): EstadoExercicio {
  return { ...estadoInicial(ex), ...patch };
}

function reps(...valores: number[]): SerieFeita[] {
  return valores.map((r) => ({ concluida: true, reps: r }));
}

function tempos(...valores: number[]): SerieFeita[] {
  return valores.map((t) => ({ concluida: true, tempo_s: t }));
}

/** Uma sessão de `n` séries no topo da faixa, firme: o gatilho de subida. */
function noTopo(alvo: Alvo, extra = 0): SerieFeita[] {
  const v = Math.max(0, (alvo.max ?? 10) + extra);
  return Array.from({ length: alvo.series }, () => ({
    concluida: true,
    reps: v,
    reps_lado2: v,
    tempo_s: v,
    tempo_s_lado2: v,
    passos: v,
  }));
}

const INICIO = "2026-09-14"; // segunda, começo da Fase 1 (SPEC §1)

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

/** Encadeia sessões: cada passo recebe o estado que o anterior devolveu. */
function encadear(
  ex: Exercicio,
  inicial: EstadoExercicio | null,
  sessoes: { series: SerieFeita[]; contexto?: ContextoDecisao }[],
): { estado: EstadoExercicio; passos: Decisao[] } {
  let estado = inicial;
  const passos: Decisao[] = [];
  for (const s of sessoes) {
    const d = decidir(ex, estado, s.series, s.contexto);
    passos.push(d);
    estado = d.novoEstado;
  }
  return { estado: estado ?? estadoInicial(ex), passos };
}

/* ============================================ §6.1 — a carga de hoje */

describe("§6.1 — a primeira vez e a carga de hoje", () => {
  it("as convenções de carga inicial e o alvo no piso valem para o catálogo todo", () => {
    const problemas: string[] = [];
    for (const ex of exercicios) {
      const p = prescricaoPadrao(ex);
      const hoje = cargaDeHoje(ex, null);
      if (hoje.carga_kg !== ex.carga_inicial.kg) {
        problemas.push(`${ex.id}: carga ${hoje.carga_kg} ≠ ${ex.carga_inicial.kg}`);
      }
      if (hoje.alvo_min !== p.min) problemas.push(`${ex.id}: piso ${hoje.alvo_min}`);
      if (!hoje.primeira_vez) problemas.push(`${ex.id}: primeira_vez falsa`);
      // §6.1: o ESTADO guarda o mínimo da faixa
      const inicial = estadoInicial(ex);
      if (ex.progressao.tipo === "tempo" && inicial.tempo_alvo_s !== p.min) {
        problemas.push(`${ex.id}: tempo_alvo ${inicial.tempo_alvo_s} ≠ piso ${p.min}`);
      }
      if (ex.progressao.tipo === "reps" && inicial.reps_alvo !== p.min) {
        problemas.push(`${ex.id}: reps_alvo ${inicial.reps_alvo} ≠ piso ${p.min}`);
      }
      if (ex.progressao.tipo === "assistencia" && inicial.assistencia !== "pe_inteiro") {
        problemas.push(`${ex.id}: assistência inicial ${inicial.assistencia}`);
      }
    }
    expect(problemas).toEqual([]);
  });

  it("as quatro convenções do §10.2: 7,5 na barra · 1,5 por halter · 4 no pino · 0 no corpo", () => {
    expect(cargaDeHoje(supino, null).carga_kg).toBe(7.5);
    expect(cargaDeHoje(agachamento, null).carga_kg).toBe(7.5);
    expect(cargaDeHoje(rosca, null).carga_kg).toBe(1.5);
    expect(cargaDeHoje(puxada, null).carga_kg).toBe(4);
    expect(cargaDeHoje(prancha, null).carga_kg).toBe(0);
    expect(cargaDeHoje(pronada, null).carga_kg).toBe(0);
    // §4: a convenção da tela sai da montagem (total · por halter · no pino)
    expect(cargaDeHoje(supino, null).montagem?.onde).toBe("porLado");
    expect(cargaDeHoje(rosca, null).montagem?.onde).toBe("porPonta");
    expect(cargaDeHoje(puxada, null).montagem?.onde).toBe("noPino");
    expect(cargaDeHoje(pronada, null).montagem?.onde).toBe("naMochila");
  });

  it("§6.1: depois da decisão, a carga de hoje é a que o motor gravou", () => {
    const alvo = prescricaoPadrao(supino);
    const d1 = decidir(supino, null, noTopo(alvo));
    expect(d1.evento?.motivo).toBe("subiu");
    expect(cargaDeHoje(supino, d1.novoEstado).carga_kg).toBe(9.5);
    const d2 = decidir(supino, d1.novoEstado, noTopo(alvo));
    expect(cargaDeHoje(supino, d2.novoEstado).carga_kg).toBe(11.5);
    expect(cargaDeHoje(supino, d2.novoEstado).primeira_vez).toBe(false);
  });

  it("a semana leve aparece na carga de hoje a 60 % e volta sozinha depois", () => {
    const estado = estadoDe(terra, { carga_atual_kg: 47.5, falhas_seguidas: 2 });
    const { novoEstado } = decidir(terra, estado, reps(4, 3, 3));
    const leve = cargaDeHoje(terra, novoEstado);
    expect(leve.semana_leve).toBe(true);
    expect(leve.carga_kg).toBe(27.5); // 47,5 × 0,6 = 28,5 → 27,5 (§6.4)
    expect(leve.montagem?.total).toBe(27.5);
    const depois = decidir(terra, novoEstado, reps(5, 5, 5));
    expect(cargaDeHoje(terra, depois.novoEstado).carga_kg).toBe(47.5);
    expect(cargaDeHoje(terra, depois.novoEstado).semana_leve).toBe(false);
  });
});

/* ====================================== §6.2 — a cadeia de decisões */

describe("§6.2 — sequências completas de sessões", () => {
  it("sobe, falha, falha (−10 % e meio incremento), volta a subir com o incremento cheio", () => {
    const alvo = prescricaoPadrao(agachamento); // 3 × 5
    const { estado, passos } = encadear(
      agachamento,
      estadoDe(agachamento, { carga_atual_kg: 39.5 }),
      [
        { series: reps(5, 5, 5) }, // sobe: 43,5
        { series: reps(5, 4, 3) }, // 1ª falha
        { series: reps(5, 4, 3) }, // 2ª falha: −10 % e incremento 2
        { series: reps(5, 5, 5) }, // sobe com o incremento reduzido
      ],
    );
    expect(passos.map((p) => p.evento?.motivo)).toEqual([
      "subiu",
      "repetiu",
      "falha_2x_voltou_10",
      "subiu",
    ]);
    // 39,5 + 4 = 43,5; 43,5 × 0,9 = 39,15 → 39,5 não cabe → 37,5
    expect(passos[2]?.novoEstado.carga_atual_kg).toBe(
      alcancavelParaBaixo(43.5 * 0.9, "barra_macica"),
    );
    expect(incrementoDe(agachamento, passos[2]?.novoEstado)).toBe(2);
    // a subida usou os 2 kg reduzidos e devolveu o incremento cheio (caso 7)
    expect(estado.carga_atual_kg).toBe(
      (passos[2]?.novoEstado.carga_atual_kg ?? 0) + 2,
    );
    expect(estado.incremento_reduzido).toBe(false);
    expect(incrementoDe(agachamento, estado)).toBe(4);
    expect(estado.falhas_seguidas).toBe(0);
    expect(alvo.series).toBe(3);
  });

  it("exigir_rep_extra: o topo sozinho não sobe, topo + 1 sobe e desliga a exigência", () => {
    // caso 5: supino 25,5 com 1 falha → 2ª falha → 21,5, incremento fica 2 e a
    // subida passa a exigir topo + 1 rep em todas as séries.
    const antes = estadoDe(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 });
    const segunda = decidir(supino, antes, reps(7, 5, 3));
    expect(segunda.evento?.motivo).toBe("falha_2x_voltou_10");
    const estado2 = segunda.novoEstado;
    expect(estado2.carga_atual_kg).toBe(21.5);
    expect(estado2.exigir_rep_extra).toBe(true);
    expect(cargaDeHoje(supino, estado2).exigir_rep_extra).toBe(true);

    // topo da faixa (8) em todas: NÃO sobe enquanto a exigência estiver de pé
    const soNoTopo = decidir(supino, estado2, reps(8, 8, 8));
    expect(soNoTopo.evento?.motivo).toBe("repetiu");
    expect(soNoTopo.novoEstado.carga_atual_kg).toBe(21.5);
    expect(soNoTopo.novoEstado.exigir_rep_extra).toBe(true);
    expect(soNoTopo.novoEstado.falhas_seguidas).toBe(2); // "manteve" não mexe

    // topo + 1 (9) em todas: sobe e desliga a exigência e o incremento reduzido
    const subiu = decidir(supino, soNoTopo.novoEstado, reps(9, 9, 9));
    expect(subiu.evento?.motivo).toBe("subiu");
    expect(subiu.novoEstado.carga_atual_kg).toBe(23.5);
    expect(subiu.novoEstado.exigir_rep_extra).toBe(false);
    expect(subiu.novoEstado.incremento_reduzido).toBe(false);
    expect(subiu.novoEstado.falhas_seguidas).toBe(0);

    // e na sessão seguinte o topo da faixa volta a bastar
    const denovo = decidir(supino, subiu.novoEstado, reps(8, 8, 8));
    expect(denovo.evento?.motivo).toBe("subiu");
    expect(denovo.novoEstado.carga_atual_kg).toBe(25.5);
  });

  it("três falhas seguidas: semana leve, volta à carga de antes e sobe normal", () => {
    const { estado, passos } = encadear(
      terra,
      estadoDe(terra, { carga_atual_kg: 47.5 }),
      [
        { series: reps(4, 4, 4) }, // 1ª falha
        { series: reps(4, 4, 4) }, // 2ª falha: 47,5 × 0,9 = 42,75 → 41,5
        { series: reps(4, 4, 4) }, // 3ª falha: semana leve a 60 %
        { series: reps(5, 5, 5) }, // a sessão leve: volta à carga de antes
        { series: reps(5, 5, 5) }, // agora sobe com o incremento cheio
      ],
    );
    expect(passos.map((p) => p.evento?.motivo)).toEqual([
      "repetiu",
      "falha_2x_voltou_10",
      "semana_leve_60",
      "fim_semana_leve",
      "subiu",
    ]);
    const leve = passos[2]?.novoEstado;
    expect(leve?.semana_leve).toBe(true);
    expect(leve?.falhas_seguidas).toBe(0); // §6.2: a 3ª zera o contador
    expect(leve?.carga_antes_leve).toBe(41.5);
    expect(leve?.carga_atual_kg).toBe(alcancavelParaBaixo(41.5 * 0.6, "barra_macica"));
    const voltou = passos[3]?.novoEstado;
    expect(voltou?.carga_atual_kg).toBe(41.5);
    expect(voltou?.semana_leve).toBe(false);
    expect(incrementoDe(terra, voltou)).toBe(4);
    expect(estado.carga_atual_kg).toBe(45.5);
  });

  it("a 1ª falha marca falha mas repete a carga; um sucesso no meio zera o contador", () => {
    const e0 = estadoDe(supino, { carga_atual_kg: 25.5 });
    const f1 = decidir(supino, e0, reps(8, 6, 4));
    expect(f1.evento?.motivo).toBe("repetiu");
    expect(f1.evento?.falha).toBe(true);
    expect(f1.novoEstado.carga_atual_kg).toBe(25.5);
    expect(f1.novoEstado.falhas_seguidas).toBe(1);

    const ok = decidir(supino, f1.novoEstado, reps(8, 8, 8));
    expect(ok.novoEstado.falhas_seguidas).toBe(0);
    // a falha seguinte volta a ser a "nº 1": repete, não corta 10 %
    const f2 = decidir(supino, ok.novoEstado, reps(8, 6, 4));
    expect(f2.evento?.motivo).toBe("repetiu");
    expect(f2.novoEstado.carga_atual_kg).toBe(ok.novoEstado.carga_atual_kg);
  });

  it("'manteve' por falta de firmeza não conta falha nem mexe na carga (§6.2)", () => {
    const e = estadoDe(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 });
    const d = decidir(supino, e, reps(8, 8, 8), { ultimaFirme: false });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBeUndefined();
    expect(d.novoEstado.carga_atual_kg).toBe(25.5);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("a prescrição do treino manda: SA pede 4 × 5–6 do supino, não o 3 × 5–8 do catálogo", () => {
    const item = acharTreino("SA").exercicios.find(
      (e) => e.exercicio_id === "supino-reto-com-barra",
    );
    expect(item).toBeDefined();
    const alvo = prescricaoDoTreino(item!, supino);
    expect(alvo).toMatchObject({ series: 4, min: 5, max: 6 });
    const e = estadoDe(supino, { carga_atual_kg: 25.5 });
    // 3 séries de 6 numa sessão concluída = a 4ª faltou → falha (§6.2)
    const faltou = decidir(supino, e, reps(6, 6, 6), { prescricao: alvo });
    expect(faltou.evento?.falha).toBe(true);
    expect(faltou.novoEstado.falhas_seguidas).toBe(1);
    // as quatro no topo (6) sobem, mesmo sem chegar aos 8 do catálogo
    const subiu = decidir(supino, e, reps(6, 6, 6, 6), { prescricao: alvo });
    expect(subiu.evento?.motivo).toBe("subiu");
    expect(subiu.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("série de trabalho a mais, abaixo do piso, derruba a sessão (§6.2)", () => {
    const e = estadoDe(supino, { carga_atual_kg: 25.5 });
    const d = decidir(supino, e, [...reps(8, 8, 8), ...reps(3)]);
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
    // aquecimento não conta
    const comAquecimento = decidir(supino, e, [
      { concluida: true, reps: 5, tipo: "aquecimento" },
      ...reps(8, 8, 8),
    ]);
    expect(comAquecimento.evento?.motivo).toBe("subiu");
  });

  it("sessão abandonada: o exercício completo é avaliado, o incompleto não muda", () => {
    const e = estadoDe(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 });
    const parcial = decidir(supino, e, reps(8), { sessaoAbandonada: true });
    expect(parcial.evento).toBeNull();
    expect(parcial.novoEstado).toEqual(e);
    const completo = decidir(supino, e, reps(8, 8, 8), { sessaoAbandonada: true });
    expect(completo.evento?.motivo).toBe("subiu");
    // e o estado de entrada nunca é mutado (função pura)
    expect(e.carga_atual_kg).toBe(25.5);
    expect(e.falhas_seguidas).toBe(1);
  });

  it("incremento override do exercise_state manda na subida e na metade da 2ª falha", () => {
    const e = estadoDe(supino, { carga_atual_kg: 25.5, incremento_kg: 10 });
    expect(incrementoDe(supino, e)).toBe(10);
    const subiu = decidir(supino, e, reps(8, 8, 8));
    expect(subiu.novoEstado.carga_atual_kg).toBe(35.5);
    const f2 = decidir(
      supino,
      { ...e, falhas_seguidas: 1 },
      reps(4, 4, 4),
    );
    expect(f2.novoEstado.carga_atual_kg).toBe(alcancavelParaBaixo(25.5 * 0.9, "barra_macica"));
    expect(incrementoDe(supino, f2.novoEstado)).toBe(5); // 10 ÷ 2, acima do passo
    expect(f2.novoEstado.exigir_rep_extra).toBe(false); // só quando cai no piso de 2 kg
  });
});

/* ======================================= §6.3 — os casos especiais */

describe("§6.3 — assistência do elástico, degrau a degrau", () => {
  it("sobe pe_inteiro → joelho → joelho_dobrado → sem, com 2 sessões de graça em cada", () => {
    const alvo = prescricaoPadrao(assistida); // 4 × 5–8
    let estado = estadoDe(assistida);
    const degraus: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const d = decidir(assistida, estado, noTopo(alvo));
      expect(d.evento?.motivo).toBe("subiu");
      expect(d.novoEstado.sessoes_graca).toBe(2);
      expect(d.novoEstado.carga_atual_kg).toBe(0); // a carga nunca muda
      degraus.push(d.novoEstado.assistencia);
      estado = d.novoEstado;
    }
    expect(degraus).toEqual(["joelho", "joelho_dobrado", "sem"]);
    // sem elástico: não há degrau acima — repete com a sugestão do lastro
    const fim = decidir(assistida, estado, noTopo(alvo));
    expect(fim.evento?.motivo).toBe("repetiu");
    expect(fim.evento?.sugestao).toMatch(/lastro/i);
    expect(fim.novoEstado.assistencia).toBe("sem");
  });

  it("as duas sessões de graça absorvem a queda e a terceira volta a contar falha", () => {
    const alvo = prescricaoPadrao(assistida);
    const subiu = decidir(assistida, estadoDe(assistida), noTopo(alvo));
    const { passos } = encadear(assistida, subiu.novoEstado, [
      { series: reps(5, 5, 4, 4) }, // graça 2 → 1
      { series: reps(4, 4, 4, 4) }, // graça 1 → 0
      { series: reps(4, 4, 4, 4) }, // sem graça: falha
    ]);
    expect(passos.map((p) => p.evento?.falha)).toEqual([undefined, undefined, true]);
    expect(passos.map((p) => p.novoEstado.sessoes_graca)).toEqual([1, 0, 0]);
    expect(passos.map((p) => p.novoEstado.falhas_seguidas)).toEqual([0, 0, 1]);
  });

  it("a graça não é gasta por uma sessão abandonada que o motor nem avalia", () => {
    const e = estadoDe(assistida, { assistencia: "joelho", sessoes_graca: 2 });
    const d = decidir(assistida, e, reps(4), { sessaoAbandonada: true });
    expect(d.evento).toBeNull();
    expect(d.novoEstado.sessoes_graca).toBe(2);
  });
});

describe("§6.3 — tipo `maximo` (barra fixa, flexão, mergulho)", () => {
  it("sucesso exige média + 1 E nenhuma série abaixo da anterior", () => {
    const anteriores = [4, 4, 4];
    const e = estadoDe(pronada, { reps_alvo: 4 });
    const ctx = { seriesAnteriores: anteriores };
    // média 5 = 4 + 1 e nenhuma caiu → sobe
    expect(decidir(pronada, e, reps(5, 5, 5), ctx).evento?.motivo).toBe("subiu");
    // média 5 mas uma série caiu (3 < 4) → repete, sem falha
    const caiu = decidir(pronada, e, reps(7, 5, 3), ctx);
    expect(caiu.evento?.motivo).toBe("repetiu");
    expect(caiu.evento?.falha).toBeUndefined();
    // média igual → repete sem falha
    const igual = decidir(pronada, e, reps(4, 4, 4), ctx);
    expect(igual.evento?.motivo).toBe("repetiu");
    expect(igual.evento?.falha).toBeUndefined();
    // média menor → falha
    const menor = decidir(pronada, e, reps(3, 3, 3), ctx);
    expect(menor.evento?.falha).toBe(true);
    expect(menor.novoEstado.falhas_seguidas).toBe(1);
  });

  it("+1 rep em todas as séries sobe mesmo quando a média é dízima", () => {
    const ctx = { seriesAnteriores: [3, 3, 4] }; // média 10/3
    const e = estadoDe(pronada, { reps_alvo: 3 });
    const d = decidir(pronada, e, reps(4, 4, 5), ctx); // média 13/3
    expect(d.evento?.motivo).toBe("subiu");
  });

  it("a sugestão do lastro sai com 3 séries de 10, subindo ou empacado (§6.3)", () => {
    const e = estadoDe(pronada, { reps_alvo: 10 });
    const empacou = decidir(pronada, e, reps(10, 10, 10), {
      seriesAnteriores: [10, 10, 10],
    });
    expect(empacou.evento?.motivo).toBe("repetiu");
    expect(empacou.evento?.sugestao).toMatch(/lastro/i);
    const subindo = decidir(pronada, e, reps(11, 11, 11), {
      seriesAnteriores: [10, 10, 10],
    });
    expect(subindo.evento?.motivo).toBe("subiu");
    expect(subindo.evento?.sugestao).toMatch(/lastro/i);
    // com 2 séries de 10 ainda não é a hora
    const ainda = decidir(pronada, e, reps(10, 10, 8), {
      seriesAnteriores: [9, 9, 8],
    });
    expect(ainda.evento?.sugestao).toBeUndefined();
  });

  it("a primeira sessão de um `maximo` só registra a média, sem evento", () => {
    const d = decidir(pronada, null, reps(3, 2, 2));
    expect(d.evento).toBeNull();
    expect(d.novoEstado.reps_alvo).toBe(2); // média 7/3 = 2,33 → 2
  });
});

describe("§6.3 — unilateral, tempo, passos e peso corporal", () => {
  it("unilateral vale o menor lado, em repetições e em tempo", () => {
    // caso 18: búlgaro 10/10, 10/10, 10/9 → repete
    const eB = estadoDe(bulgaro, { carga_atual_kg: 5.5 });
    const d = decidir(bulgaro, eB, [
      { concluida: true, reps: 10, reps_lado2: 10 },
      { concluida: true, reps: 10, reps_lado2: 10 },
      { concluida: true, reps: 10, reps_lado2: 9 },
    ]);
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(5.5);
    // prancha lateral (20–40 s, unilateral): 40/35 não sobe, 40/40 sobe
    const eP = estadoDe(pranchaLateral);
    const parcial = decidir(pranchaLateral, eP, [
      { concluida: true, tempo_s: 40, tempo_s_lado2: 35 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
    ]);
    expect(parcial.evento?.motivo).toBe("repetiu");
    const cheia = decidir(pranchaLateral, eP, [
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
    ]);
    expect(cheia.evento?.motivo).toBe("subiu");
    expect(cheia.novoEstado.tempo_alvo_s).toBe(45); // +5 s (§6.2)
  });

  it("tempo: sobe de 5 em 5 e o alvo passa da faixa com a sugestão de variação", () => {
    const e = estadoDe(prancha); // alvo 30, faixa 30–60
    const um = decidir(prancha, e, tempos(60, 60, 60));
    expect(um.novoEstado.tempo_alvo_s).toBe(65);
    expect(um.evento?.sugestao).toMatch(/varia/i);
    expect(cargaDeHoje(prancha, um.novoEstado).alvo_max).toBe(65);
    // agora o topo a bater é 65, não mais os 60 da faixa
    const soSessenta = decidir(prancha, um.novoEstado, tempos(60, 60, 60));
    expect(soSessenta.evento?.motivo).toBe("repetiu");
    const dois = decidir(prancha, um.novoEstado, tempos(65, 65, 65));
    expect(dois.novoEstado.tempo_alvo_s).toBe(70);
  });

  it("passos: farmer's walk sobe a carga do halter, não os passos (caso 19)", () => {
    const e = estadoDe(farmer, { carga_atual_kg: 11.5 });
    const series: SerieFeita[] = [40, 40, 40].map((p) => ({ concluida: true, passos: p }));
    const d = decidir(farmer, e, series);
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(13.5);
    const curto: SerieFeita[] = [40, 40, 35].map((p) => ({ concluida: true, passos: p }));
    expect(decidir(farmer, e, curto).evento?.motivo).toBe("repetiu");
  });

  it("peso corporal com faixa: sobe 1 rep e passa de 20 com a sugestão da anilha", () => {
    const e = estadoDe(elevacaoPernas); // reps alvo 10, faixa 10–15
    const um = decidir(elevacaoPernas, e, reps(15, 15, 15));
    expect(um.evento?.motivo).toBe("subiu");
    expect(um.novoEstado.reps_alvo).toBe(16); // caso 17
    expect(um.evento?.sugestao).toBeUndefined();
    const vinte = decidir(
      elevacaoPernas,
      estadoDe(elevacaoPernas, { reps_alvo: 20 }),
      reps(20, 20, 20),
    );
    expect(vinte.evento?.sugestao).toMatch(/anilha/i);
    expect(vinte.evento?.sugestao).toMatch(/piso|10/i);
  });

  it("exercício sem carga que falha: repete o alvo, nunca corta 10 % nem inventa 60 %", () => {
    const { passos } = encadear(elevacaoPernas, estadoDe(elevacaoPernas), [
      { series: reps(8, 8, 8) },
      { series: reps(8, 8, 8) },
      { series: reps(8, 8, 8) },
    ]);
    for (const p of passos) {
      expect(p.evento?.motivo).toBe("repetiu");
      expect(p.evento?.falha).toBe(true);
      expect(p.novoEstado.reps_alvo).toBe(10);
      expect(p.novoEstado.carga_atual_kg).toBe(0);
      expect(p.novoEstado.semana_leve).toBe(false);
    }
  });

  it("substituição: o substituto usa o próprio estado e o original fica intacto", () => {
    const inclinado = acharExercicio("supino-inclinado-com-halteres");
    const estadoSupino = estadoDe(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 });
    const estadoInclinado = estadoDe(inclinado, { carga_atual_kg: 11.5 });
    const d = decidir(inclinado, estadoInclinado, reps(12, 12, 12));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(13.5);
    expect(estadoSupino).toEqual(
      estadoDe(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 }),
    );
  });
});

/* =================================== §6.4 — arredondamento e limites */

describe("§6.4 — escala, teto e avisos", () => {
  it("toda carga que o motor grava existe na escala do implemento", () => {
    const problemas: string[] = [];
    for (const ex of exercicios) {
      if (ex.progressao.tipo !== "carga") continue;
      const alvo = prescricaoPadrao(ex);
      const partida = estadoDe(ex, {
        carga_atual_kg: alcancavelParaBaixo(
          (ex.carga_inicial.kg || 0) + 20,
          ex.implemento,
        ),
      });
      const caminhos: EstadoExercicio[] = [];
      caminhos.push(decidir(ex, partida, noTopo(alvo)).novoEstado); // subida
      const f1 = decidir(ex, partida, noTopo(alvo, -99)).novoEstado; // 1ª falha
      const f2 = decidir(ex, f1, noTopo(alvo, -99)).novoEstado; // −10 %
      const f3 = decidir(ex, f2, noTopo(alvo, -99)).novoEstado; // 60 %
      caminhos.push(f1, f2, f3);
      for (const e of caminhos) {
        const kg = e.carga_atual_kg;
        if (kg === null) continue;
        if (alcancavelParaBaixo(kg, ex.implemento) !== kg) {
          problemas.push(`${ex.id}: ${kg} fora da escala de ${ex.implemento}`);
        }
      }
      if ((f2.carga_atual_kg ?? 0) > (partida.carga_atual_kg ?? 0) * 0.9 + 1e-9) {
        problemas.push(`${ex.id}: 2ª falha não cortou 10 %`);
      }
      if ((f3.carga_antes_leve ?? 0) * 0.6 + 1e-9 < (f3.carga_atual_kg ?? 0)) {
        problemas.push(`${ex.id}: semana leve acima de 60 %`);
      }
    }
    expect(problemas).toEqual([]);
  });

  it("teto da barra maciça: 107,5 repete com o aviso das anilhas de 10 kg (caso 22)", () => {
    expect(cargaMaxima("barra_macica")).toBe(107.5);
    const e = estadoDe(supino, { carga_atual_kg: 107.5 });
    const d = decidir(supino, e, reps(8, 8, 8));
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.aviso).toMatch(/anilhas de 10 kg/);
    expect(d.novoEstado.carga_atual_kg).toBe(107.5);
    expect(montagem(109.5, "barra_macica").aviso).toBe("faltam anilhas de 10 kg");
    expect(montagem(109.5, "barra_macica").total).toBe(107.5);
  });

  it("teto de capacidade (halter 40 kg) não manda comprar anilhas de 10 kg", () => {
    expect(cargaMaxima("halteres")).toBe(39.5);
    const e = estadoDe(rosca, { carga_atual_kg: 39.5 });
    const d = decidir(rosca, e, [
      { concluida: true, reps: 12, reps_lado2: 12 },
      { concluida: true, reps: 12, reps_lado2: 12 },
      { concluida: true, reps: 12, reps_lado2: 12 },
    ]);
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.aviso).not.toMatch(/anilhas de 10 kg/);
    expect(montagem(41.5, "halteres").aviso).toBeUndefined();
    expect(montagem(41.5, "halteres").total).toBe(39.5);
  });

  it("as escalas do documento: barra 7,5→107,5 de 2 em 2 · halter 1,5→39,5 · pino 0→100", () => {
    const barra = cargasPossiveis("barra_macica");
    expect(barra[0]).toBe(7.5);
    expect(barra[barra.length - 1]).toBe(107.5);
    expect(barra.every((v, i) => i === 0 || v - (barra[i - 1] ?? 0) === 2)).toBe(true);
    const halter = cargasPossiveis("halteres");
    expect(halter[0]).toBe(1.5);
    expect(halter[halter.length - 1]).toBe(39.5);
    const pino = cargasPossiveis("polia");
    expect(pino[0]).toBe(0);
    expect(pino[pino.length - 1]).toBe(100);
    expect(pino).toHaveLength(101);
    // §6.5: guloso do maior para o menor, no máximo 2 de cada por lado
    expect(montagem(107.5, "barra_macica").porLado).toEqual([
      10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1,
    ]);
    expect(montagem(26.5, "barra_macica")).toMatchObject({
      total: 25.5,
      exato: false,
      diferenca: -1,
    });
    expect(montagem(5.5, "halteres").porPonta).toEqual([2]);
  });
});

/* ============================================= §5 — calendário */

describe("§5.2 — o que é hoje", () => {
  it("14/09/2026 é segunda e abre a Fase 1 com o Treino A (§1, §10.2)", () => {
    const dia = treinoDeHoje(INICIO, perfil());
    expect(dia.dia).toBe("seg");
    expect(dia.tipo).toBe("forca");
    expect(dia.treinoId).toBe("A1");
    expect(dia.treino?.exercicios).toHaveLength(6);
    expect(dia.min).toBe(44);
  });

  it("Fase 1 alterna sempre o que não foi o último, semana após semana", () => {
    const semana1 = semanaDoPlano(INICIO, perfil())
      .filter((d) => d.tipo === "forca")
      .map((d) => d.treinoId);
    expect(semana1).toEqual(["A1", "B1", "A1"]);
    const semana2 = semanaDoPlano("2026-09-21", perfil({ ultimo_treino: "A1" }))
      .filter((d) => d.tipo === "forca")
      .map((d) => d.treinoId);
    expect(semana2).toEqual(["B1", "A1", "B1"]);
    expect(proximoTreinoAlternado("A1")).toBe("B1");
    expect(proximoTreinoAlternado("B1")).toBe("A1");
    expect(proximoTreinoAlternado(null)).toBe("A1");
  });

  it("Fase 2: SA seg · IA ter · SB qui · IB sex, com cardio na quarta e no sábado", () => {
    const dias = semanaDoPlano(INICIO, perfil({ fase_atual: "fase2" }));
    expect(dias.map((d) => d.treinoId)).toEqual([
      "SA",
      "IA",
      null,
      "SB",
      "IB",
      null,
      null,
    ]);
    expect(dias.map((d) => d.tipo)).toEqual([
      "forca",
      "forca",
      "cardio",
      "forca",
      "forca",
      "cardio",
      "descanso",
    ]);
  });

  it("cardio: terça é corrida da semana 1 (8 × 1/2 min) e sábado aceita corda", () => {
    const ter = sessaoCardioDeHoje("2026-09-15", perfil());
    expect(ter?.tipo).toBe("corrida");
    expect(ter?.semana).toBe(1);
    expect(ter?.descricao).toBe("8 × (1 min corrida / 2 min caminhada)");
    expect(ter?.permiteCorda).toBe(false);
    const sab = sessaoCardioDeHoje("2026-09-19", perfil({ semana_corda: 3 }));
    expect(sab?.permiteCorda).toBe(true);
    expect(sab?.corda?.semanas).toBe("3–4"); // estágio pela semana de corda
  });

  it("override vence o programa e entra na corrente da alternância (§5.2 item 1)", () => {
    const overrides = [
      { data: "2026-09-15", tipo: "forca" as const, workout_id: "B1" as TreinoId, sessao: null },
    ];
    const dias = semanaDoPlano(INICIO, perfil(), overrides);
    expect(dias[1]?.tipo).toBe("forca");
    expect(dias[1]?.treinoId).toBe("B1");
    expect(dias[1]?.origem).toBe("override");
    expect(dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "A1",
      "B1",
      "A1",
      "B1",
    ]);
  });
});

describe("§5.5 — as semanas dos planos", () => {
  it("2 sessões avançam; 0 e 1 repetem; nada passa da semana 12", () => {
    for (const avancar of [
      avancarSemanaDeCorrida,
      avancarSemanaDeCorda,
      avancarSemanaDeBarraFixa,
    ]) {
      expect(avancar(1, 0)).toBe(1);
      expect(avancar(1, 1)).toBe(1);
      expect(avancar(1, 2)).toBe(2);
      expect(avancar(4, 3)).toBe(5);
      expect(avancar(12, 2)).toBe(12);
    }
  });
});

describe("§5.1 — a sugestão da Fase 2", () => {
  it("12 semanas civis E 30 sessões; adiar silencia por 2 semanas", () => {
    const p = perfil();
    expect(sugerirFase2(p, 30, "2026-12-06").sugerir).toBe(false); // 11 semanas
    expect(sugerirFase2(p, 30, "2026-12-07").sugerir).toBe(true);
    expect(sugerirFase2(p, 29, "2026-12-07").sugerir).toBe(false);
    const adiado = perfil({ prefs: { fase2_adiada_ate: "2026-12-21" } });
    expect(sugerirFase2(adiado, 30, "2026-12-14").sugerir).toBe(false);
    expect(sugerirFase2(adiado, 30, "2026-12-21").sugerir).toBe(true);
  });
});

describe("§5.4 — semana curta", () => {
  it("com três dias, cortam-se os dois cardios (sábado primeiro) e sobram os três treinos", () => {
    const semana = semanaDoPlano(INICIO, perfil());
    const r = semanaCurta(["ter", "qui", "sab", "dom"], semana);
    expect(r.cortados.map((c) => c.dia)).toEqual(["sab", "ter"]);
    expect(r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "A1",
      "B1",
      "A1",
    ]);
  });

  it("sobrando um dia só, o que fica é o Treino A — inclusive na semana B-A-B", () => {
    const foraQuaseTudo = ["seg", "ter", "qua", "qui", "sab", "dom"] as const;
    const semanaAB = semanaDoPlano(INICIO, perfil({ ultimo_treino: null }));
    const rAB = semanaCurta([...foraQuaseTudo], semanaAB);
    expect(rAB.dias.filter((d) => d.tipo !== "descanso").map((d) => d.treinoId)).toEqual([
      "A1",
    ]);
    // a semana par começa pelo Treino B; o que sobra continua tendo de ser o A
    const semanaBA = semanaDoPlano("2026-09-21", perfil({ ultimo_treino: "A1" }));
    expect(
      semanaBA.filter((d) => d.tipo === "forca").map((d) => d.treinoId),
    ).toEqual(["B1", "A1", "B1"]);
    const rBA = semanaCurta([...foraQuaseTudo], semanaBA);
    const sobrou = rBA.dias.filter((d) => d.tipo !== "descanso");
    expect(sobrou).toHaveLength(1);
    expect(sobrou[0]?.treinoId).toBe("A1");
  });

  it("Fase 2: corta os cardios e depois o superior, nunca IA/IB", () => {
    const p = perfil({ fase_atual: "fase2" });
    const semana = semanaDoPlano(INICIO, p);
    const r = semanaCurta(["qua", "sex", "sab", "dom"], semana);
    const restam = r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId);
    expect(restam).toEqual(["SA", "IA", "IB"]);
  });

  it("a semana remanejada continua alternando A e B (§5.2 item 3)", () => {
    const semana = semanaDoPlano(INICIO, perfil());
    const r = semanaCurta(["seg"], semana);
    const treinos = r.dias
      .filter((d): d is DiaDoPlano & { treinoId: TreinoId } => d.treinoId !== null)
      .map((d) => d.treinoId);
    expect(treinos.length).toBeGreaterThan(1);
    const repetidos = treinos.filter((t, i) => i > 0 && t === treinos[i - 1]);
    expect({ treinos, repetidos }).toMatchObject({ repetidos: [] });
  });

  it("marcar um dia de descanso não corta nada (a vaga já não era de treino)", () => {
    const semana = semanaDoPlano(INICIO, perfil());
    const r = semanaCurta(["qui"], semana);
    expect(r.cortados).toEqual([]);
    expect(r.dias.map((d) => d.tipo)).toEqual(
      semana.map((d) => d.tipo),
    );
    expect(r.dias.map((d) => d.treinoId)).toEqual(semana.map((d) => d.treinoId));
  });
});

/* ================= §3.1 e §5.2 item 4 — o que a tela Hoje recebe */

describe("§3.1 / §5.2 — os minutos e a nota do dia", () => {
  it("o dia de cardio traz os minutos da semana do plano, não os do dia do programa", () => {
    // §3.1: "card da sessão da semana atual (… · 34 min)" — os minutos são os da
    // sessão que o plano manda fazer hoje (cardio.json: 45 min na semana 12).
    const s1 = sessaoCardioDeHoje("2026-09-15", perfil({ semana_corrida: 1 }));
    expect(s1?.corrida?.sessao_min).toBe(34);
    expect(s1?.min).toBe(34);
    const s12 = sessaoCardioDeHoje("2026-09-15", perfil({ semana_corrida: 12 }));
    expect(s12?.descricao).toBe("5 km sem parar");
    expect(s12?.corrida?.sessao_min).toBe(45);
    expect(s12?.min).toBe(45);
  });

  it("com override, o dia não herda os minutos nem a nota do dia que substituiu (§5.2 item 1)", () => {
    const viraCardio = [
      { data: INICIO, tipo: "cardio" as const, workout_id: null, sessao: "corrida" },
    ];
    const seg = treinoDeHoje(INICIO, perfil(), viraCardio);
    expect(seg.tipo).toBe("cardio");
    // 44 min é a duração do Treino A, que este dia deixou de ser
    expect(seg.min).not.toBe(44);
    expect(sessaoCardioDeHoje(INICIO, perfil(), viraCardio)?.min).not.toBe(44);

    const viraForca = [
      {
        data: "2026-09-17",
        tipo: "forca" as const,
        workout_id: "A1" as TreinoId,
        sessao: null,
      },
    ];
    const qui = treinoDeHoje("2026-09-17", perfil(), viraForca);
    expect(qui.tipo).toBe("forca");
    // a nota da quinta é o lembrete do dia de descanso (§5.2 item 5)
    expect(qui.nota).toBeNull();
  });
});

/* ======================= §3.9 e §10.5 — quando as barras forem pesadas */

describe("§10.5 — o motor só propõe cargas alcançáveis", () => {
  it("a barra W ainda não pesada vale 2 kg e fecha exato", () => {
    const roscaW = acharExercicio("rosca-com-barra-w");
    const hoje = cargaDeHoje(roscaW, null);
    expect(hoje.carga_kg).toBe(2);
    expect(hoje.montagem?.pesoBarra).toBe(2);
    expect(hoje.montagem?.exato).toBe(true);
    expect(cargaMaxima("barra_w")).toBe(50); // §6.4: capacidade da barra W
    expect(cargaMaxima("barra_reta_oca")).toBe(60);
    expect(montagem(52, "barra_w").total).toBe(50);
  });

  it("depois de pesar a barra (§3.9), a carga de hoje continua existindo na escala", () => {
    const roscaW = acharExercicio("rosca-com-barra-w");
    const presc = prescricaoPadrao(roscaW);
    const opcoes = { pesoBarra: 6.5 };
    expect(cargaMinima("barra_w", opcoes)).toBe(6.5); // a barra vazia
    const hoje = cargaDeHoje(roscaW, null, presc, opcoes);
    // §10.5: nada de propor 2,0 kg numa barra que pesa 6,5 kg
    expect(hoje.montagem?.exato).toBe(true);
    expect(hoje.carga_kg).toBe(6.5);
  });
});
