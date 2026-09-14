/**
 * AUDITORIA ADVERSARIAL — lente "spec" (rodada 3).
 *
 * Prova de conformidade do motor (lib/progressao.ts, lib/montagem.ts,
 * lib/calendario.ts) com SPEC.md §5 e §6 e com
 * docs/casos-de-teste-progressao.md — **além** dos 22 casos do documento.
 *
 * O ataque desta rodada é pelas bordas que os 22 casos não tocam: o catálogo
 * inteiro na primeira vez, a prescrição do treino que difere do catálogo, as
 * faixas de peso corporal cujo piso já é 20 reps, a vida completa do
 * `exigir_rep_extra` no pino, a assistência até o fim da escada, o tipo
 * `maximo` com número de séries diferente da sessão anterior, o teto e os
 * avisos, e o calendário §5.2–§5.5 dia a dia.
 *
 * Nada aqui é código de produção.
 */
import { describe, expect, it } from "vitest";
import { acharExercicio, acharTreino, exercicios } from "@/lib/dados";
import {
  alcancavelParaBaixo,
  cargaMaxima,
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
  type ContextoDecisao,
  type EstadoExercicio,
  type SerieFeita,
} from "@/lib/progressao";
import {
  adiarFase2,
  avancarSemanaDeBarraFixa,
  avancarSemanaDeCorda,
  avancarSemanaDeCorrida,
  diaDaSemana,
  proximoTreinoAlternado,
  semanaCurta,
  semanaDaFase,
  semanaDoPlano,
  sessaoCardioDeHoje,
  sugerirFase2,
  treinoDeHoje,
  treinosComAgachamentoOuTerra,
  type DiaDoPlano,
  type ExcecaoAgenda,
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
const flexao = acharExercicio("flexao-de-braco");
const prancha = acharExercicio("prancha");
const pranchaLateral = acharExercicio("prancha-lateral");
const elevacaoPernas = acharExercicio("elevacao-de-pernas-na-barra-fixa");
const bicicleta = acharExercicio("abdominal-bicicleta");
const supra = acharExercicio("abdominal-supra");
const russian = acharExercicio("russian-twist");
const bulgaro = acharExercicio("agachamento-bulgaro");
const farmer = acharExercicio("farmer-s-walk");
const inclinado = acharExercicio("supino-inclinado-com-halteres");
const roscaW = acharExercicio("rosca-com-barra-w");
const lastro = acharExercicio("barra-fixa-com-lastro");

function estadoDe(
  ex: Exercicio,
  patch: Partial<EstadoExercicio> = {},
): EstadoExercicio {
  return { ...estadoInicial(ex), ...patch };
}

function reps(...valores: number[]): SerieFeita[] {
  return valores.map((r) => ({ concluida: true, reps: r }));
}

function porLado(...pares: [number, number][]): SerieFeita[] {
  return pares.map(([d, e]) => ({ concluida: true, reps: d, reps_lado2: e }));
}

function tempos(...valores: number[]): SerieFeita[] {
  return valores.map((t) => ({ concluida: true, tempo_s: t }));
}

function temposPorLado(...pares: [number, number][]): SerieFeita[] {
  return pares.map(([d, e]) => ({
    concluida: true,
    tempo_s: d,
    tempo_s_lado2: e,
  }));
}

function passos(...valores: number[]): SerieFeita[] {
  return valores.map((p) => ({ concluida: true, passos: p }));
}

/* ==================================================================== */
/* §6.1 — a primeira vez                                                 */
/* ==================================================================== */

describe("§6.1 — a primeira vez no exercício", () => {
  it("os 81 exercícios pedem exatamente a carga_inicial do JSON, e ela fecha na escala", () => {
    expect(exercicios.length).toBe(81);
    for (const ex of exercicios) {
      const hoje = cargaDeHoje(ex, null);
      expect(
        { id: ex.id, carga: hoje.carga_kg, primeira: hoje.primeira_vez },
      ).toEqual({
        id: ex.id,
        carga: ex.carga_inicial.kg,
        primeira: true,
      });
      // §6.5: a montagem mostrada na tela tem de fechar exata
      expect({ id: ex.id, exato: hoje.montagem?.exato }).toEqual({
        id: ex.id,
        exato: true,
      });
    }
  });

  it("§4/§10.2: 7,5 na barra · 1,5 por halter · 4 no pino · 0 no corpo · 2,0 na barra W a pesar", () => {
    const cargas = new Map<string, Set<number>>();
    for (const ex of exercicios) {
      const conjunto = cargas.get(ex.implemento) ?? new Set<number>();
      conjunto.add(cargaDeHoje(ex, null).carga_kg ?? Number.NaN);
      cargas.set(ex.implemento, conjunto);
    }
    expect([...(cargas.get("barra_macica") ?? [])]).toEqual([7.5]);
    expect([...(cargas.get("halteres") ?? [])]).toEqual([1.5]);
    expect([...(cargas.get("polia") ?? [])]).toEqual([4]);
    expect([...(cargas.get("peso_corporal") ?? [])]).toEqual([0]);
    expect([...(cargas.get("barra_w") ?? [])]).toEqual([2]);
  });

  it("§6.1: o estado guarda o PISO da faixa; o topo a bater é o topo da prescrição", () => {
    const p = cargaDeHoje(prancha, null);
    expect(p.tempo_alvo_s).toBe(30);
    expect(p.alvo_min).toBe(30);
    expect(p.alvo_max).toBe(60);
    expect(estadoInicial(prancha).tempo_alvo_s).toBe(30);

    const e = cargaDeHoje(elevacaoPernas, null);
    expect(estadoInicial(elevacaoPernas).reps_alvo).toBe(10);
    expect([e.alvo_min, e.alvo_max]).toEqual([10, 15]);

    const f = cargaDeHoje(farmer, null);
    expect([f.passos_alvo, f.alvo_max]).toEqual([30, 40]);

    const a = cargaDeHoje(assistida, null);
    expect(a.assistencia).toBe("pe_inteiro");
    expect([a.carga_kg, a.alvo_min, a.alvo_max]).toEqual([0, 5, 8]);
  });

  it("§3.2/§6.1: a prescrição do treino manda — no Treino A o supino é 3 × 5, não 3 × 5–8", () => {
    const item = acharTreino("A1").exercicios.find(
      (x) => x.exercicio_id === "supino-reto-com-barra",
    );
    expect(item).toBeDefined();
    const alvo = prescricaoDoTreino(item!, supino);
    expect([alvo.series, alvo.min, alvo.max]).toEqual([3, 5, 5]);

    const hoje = cargaDeHoje(supino, null, alvo);
    expect([hoje.carga_kg, hoje.alvo_min, hoje.alvo_max]).toEqual([7.5, 5, 5]);

    // 5, 5, 5 firmes são o topo DESTE treino: sobe, mesmo sendo o piso do catálogo
    const d = decidir(supino, null, reps(5, 5, 5), { prescricao: alvo });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);

    // e com a faixa do catálogo (5–8) as mesmas 5 reps não sobem
    const c = decidir(supino, null, reps(5, 5, 5));
    expect(c.evento?.motivo).toBe("repetiu");
    expect(c.novoEstado.carga_atual_kg).toBe(7.5);
  });
});

/* ==================================================================== */
/* §6.2 — sequências de sessões                                          */
/* ==================================================================== */

describe("§6.2 — a vida do exigir_rep_extra, no pino", () => {
  it("sobe, repete, falha, falha (−10 % + topo/+1), o topo sozinho não sobe e topo+1 sobe e desliga", () => {
    let estado = estadoDe(puxada); // 4 kg no pino, faixa 10–12, incremento 2
    expect(cargaDeHoje(puxada, estado).carga_kg).toBe(4);

    let d = decidir(puxada, estado, reps(12, 12, 12));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(6);
    estado = d.novoEstado;

    d = decidir(puxada, estado, reps(12, 12, 11));
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBeUndefined();
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    estado = d.novoEstado;

    d = decidir(puxada, estado, reps(12, 10, 9)); // 9 < piso 10
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBe(true);
    expect([d.novoEstado.carga_atual_kg, d.novoEstado.falhas_seguidas]).toEqual([
      6, 1,
    ]);
    estado = d.novoEstado;

    d = decidir(puxada, estado, reps(10, 9, 8));
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    // 6 × 0,9 = 5,4 → 5 no pino
    expect(d.novoEstado.carga_atual_kg).toBe(5);
    // incremento 2 ÷ 2 = 1 < passo mínimo 2 → continua 2 e passa a exigir topo + 1
    expect(incrementoDe(puxada, d.novoEstado)).toBe(2);
    expect(d.novoEstado.exigir_rep_extra).toBe(true);
    expect(cargaDeHoje(puxada, d.novoEstado).exigir_rep_extra).toBe(true);
    estado = d.novoEstado;

    d = decidir(puxada, estado, reps(12, 12, 12)); // só o topo: não basta
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(5);
    expect(d.novoEstado.exigir_rep_extra).toBe(true);
    estado = d.novoEstado;

    d = decidir(puxada, estado, reps(13, 13, 13)); // topo + 1 em todas
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(7);
    expect(d.novoEstado.exigir_rep_extra).toBe(false);
    expect(d.novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(puxada, d.novoEstado)).toBe(2);
    estado = d.novoEstado;

    // desligado mesmo: o topo sozinho volta a subir
    d = decidir(puxada, estado, reps(12, 12, 12));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9);
  });

  it("topo + 1 exige a rep extra em TODAS as séries, não só na última", () => {
    const estado = estadoDe(puxada, {
      carga_atual_kg: 5,
      falhas_seguidas: 2,
      incremento_reduzido: true,
      exigir_rep_extra: true,
    });
    const quase = decidir(puxada, estado, reps(13, 13, 12));
    expect(quase.evento?.motivo).toBe("repetiu");
    expect(quase.novoEstado.carga_atual_kg).toBe(5);
  });
});

describe("§6.2 — semana leve, do começo ao fim", () => {
  it("falha ×3 → semana_leve_60 → a tela mostra 60 % → fim_semana_leve → subida com incremento cheio", () => {
    let estado = estadoDe(agachamento, { carga_atual_kg: 47.5 });

    let d = decidir(agachamento, estado, reps(5, 5, 4));
    expect(d.novoEstado.falhas_seguidas).toBe(1);
    estado = d.novoEstado;

    d = decidir(agachamento, estado, reps(5, 4, 4));
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(d.novoEstado.carga_atual_kg).toBe(41.5); // 42,75 → 41,5
    expect(incrementoDe(agachamento, d.novoEstado)).toBe(2);
    expect(d.novoEstado.exigir_rep_extra).toBe(false); // 4 ÷ 2 = 2 = passo mínimo
    estado = d.novoEstado;

    d = decidir(agachamento, estado, reps(4, 4, 3));
    expect(d.evento?.motivo).toBe("semana_leve_60");
    expect(d.novoEstado.semana_leve).toBe(true);
    expect(d.novoEstado.carga_antes_leve).toBe(41.5);
    expect(d.novoEstado.carga_atual_kg).toBe(23.5); // 24,9 → 23,5
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    estado = d.novoEstado;

    const leve = cargaDeHoje(agachamento, estado);
    expect(leve.semana_leve).toBe(true);
    expect(leve.carga_kg).toBe(23.5);
    expect(leve.montagem?.exato).toBe(true);

    d = decidir(agachamento, estado, reps(5, 5, 5));
    expect(d.evento?.motivo).toBe("fim_semana_leve");
    expect(d.novoEstado.carga_atual_kg).toBe(41.5);
    expect(d.novoEstado.semana_leve).toBe(false);
    expect(d.novoEstado.carga_antes_leve).toBeNull();
    expect(incrementoDe(agachamento, d.novoEstado)).toBe(4);
    estado = d.novoEstado;

    d = decidir(agachamento, estado, reps(5, 5, 5));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(45.5);
  });
});

describe("§6.2 — o override de incremento do exercise_state", () => {
  it("manda na subida, na metade da 2ª falha e volta ao cheio depois de subir", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5, incremento_kg: 4 });
    expect(incrementoDe(supino, estado)).toBe(4);
    expect(cargaDeHoje(supino, estado).incremento_kg).toBe(4);

    const sobe = decidir(supino, estado, reps(8, 8, 8));
    expect(sobe.novoEstado.carga_atual_kg).toBe(29.5);

    const f1 = decidir(supino, estado, reps(8, 8, 4));
    const f2 = decidir(supino, f1.novoEstado, reps(7, 5, 4));
    expect(f2.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(f2.novoEstado.carga_atual_kg).toBe(21.5);
    // 4 ÷ 2 = 2 kg: o override é que é reduzido, não o do JSON
    expect(incrementoDe(supino, f2.novoEstado)).toBe(2);
    expect(f2.novoEstado.exigir_rep_extra).toBe(false);

    const volta = decidir(supino, f2.novoEstado, reps(8, 8, 8));
    expect(volta.evento?.motivo).toBe("subiu");
    expect(volta.novoEstado.carga_atual_kg).toBe(23.5);
    expect(incrementoDe(supino, volta.novoEstado)).toBe(4);
  });
});

describe("§6.2 — as três classes e o contador de falhas", () => {
  it("caso 3: topo em todas mas 'última firme' desligada é repetiu, sem falha", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 9.5 });
    const d = decidir(supino, estado, reps(8, 8, 8), { ultimaFirme: false });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBeUndefined();
    expect([d.novoEstado.carga_atual_kg, d.novoEstado.falhas_seguidas]).toEqual([
      9.5, 0,
    ]);
  });

  it("um 'manteve' entre duas falhas não zera o contador (§6.2: falhas não muda)", () => {
    let estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    estado = decidir(supino, estado, reps(8, 6, 4)).novoEstado; // falha 1
    expect(estado.falhas_seguidas).toBe(1);
    estado = decidir(supino, estado, reps(8, 7, 6)).novoEstado; // manteve
    expect(estado.falhas_seguidas).toBe(1);
    const d = decidir(supino, estado, reps(7, 5, 3)); // falha 2
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
  });

  it("uma subida zera o contador de falhas", () => {
    const comFalha = estadoDe(supino, {
      carga_atual_kg: 25.5,
      falhas_seguidas: 1,
    });
    const d = decidir(supino, comFalha, reps(8, 8, 8));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.falhas_seguidas).toBe(0);
  });

  it("§6.1: sem estado no banco, a falha parte da carga inicial do JSON", () => {
    const d = decidir(supino, null, reps(4, 4, 4));
    expect(d.evento?.falha).toBe(true);
    expect([d.novoEstado.carga_atual_kg, d.novoEstado.falhas_seguidas]).toEqual([
      7.5, 1,
    ]);
  });

  it("§6.1: a carga de hoje é a que a decisão do treino anterior gravou", () => {
    const d = decidir(terra, estadoDe(terra, { carga_atual_kg: 43.5 }), reps(5, 5, 5));
    expect(d.novoEstado.carga_atual_kg).toBe(47.5);
    const hoje = cargaDeHoje(terra, d.novoEstado);
    expect(hoje.carga_kg).toBe(47.5);
    expect(hoje.primeira_vez).toBe(false);
    expect(hoje.montagem?.porLado).toEqual([10, 10]); // (47,5 − 7,5) ÷ 2 = 20 por lado
  });
});

/* ==================================================================== */
/* §6.3 — sessão abandonada e substituição                               */
/* ==================================================================== */

describe("§6.3 — sessão abandonada e substituição", () => {
  it("caso 20: abandonada com 1 de 3 séries não muda o estado nem gera evento", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const d = decidir(supino, estado, reps(8), { sessaoAbandonada: true });
    expect(d.evento).toBeNull();
    expect(d.novoEstado).toEqual(estado);
  });

  it("§6.3: numa sessão abandonada, quem TEM todas as séries é avaliado", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const d = decidir(supino, estado, reps(8, 8, 8), { sessaoAbandonada: true });
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("§6.2: numa sessão CONCLUÍDA, série faltando é falha (não é abandono)", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const d = decidir(supino, estado, reps(8, 8));
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("caso 21: o substituto do dia usa o próprio estado e o original fica intacto", () => {
    const estadoSupino = estadoDe(supino, { carga_atual_kg: 25.5 });
    const estadoInclinado = estadoDe(inclinado, { carga_atual_kg: 11.5 });

    const d = decidir(inclinado, estadoInclinado, reps(12, 12, 12));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(13.5);

    // o supino não foi feito: nada é decidido por ele
    expect(cargaDeHoje(supino, estadoSupino).carga_kg).toBe(25.5);
    expect(estadoSupino.carga_atual_kg).toBe(25.5);
    expect(estadoSupino.falhas_seguidas).toBe(0);
  });
});

/* ==================================================================== */
/* §6.3 — assistência do elástico                                        */
/* ==================================================================== */

describe("§6.3 — assistência do elástico até o fim da escada", () => {
  it("pe_inteiro → joelho → joelho_dobrado → sem, sempre com 2 sessões de graça", () => {
    let estado = estadoDe(assistida);
    const degraus: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = decidir(assistida, estado, reps(8, 8, 8, 8));
      expect(d.evento?.motivo).toBe("subiu");
      expect(d.novoEstado.sessoes_graca).toBe(2);
      expect(d.novoEstado.carga_atual_kg).toBe(0); // "a carga não muda"
      degraus.push(String(d.novoEstado.assistencia));
      estado = { ...d.novoEstado, sessoes_graca: 0 };
    }
    expect(degraus).toEqual(["joelho", "joelho_dobrado", "sem"]);
  });

  it("chegando em `sem`, a subida vira repetiu com a sugestão da barra fixa com lastro", () => {
    const estado = estadoDe(assistida, { assistencia: "sem" });
    const d = decidir(assistida, estado, reps(8, 8, 8, 8));
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.assistencia).toBe("sem");
    expect(d.evento?.sugestao).toMatch(/lastro/i);
  });

  it("caso 14: a graça absorve 2 quedas; a 3ª sessão volta a contar falha", () => {
    let estado = estadoDe(assistida, {
      assistencia: "joelho",
      sessoes_graca: 2,
    });
    for (const restante of [1, 0]) {
      const d = decidir(assistida, estado, reps(5, 5, 4, 4));
      expect(d.evento?.motivo).toBe("repetiu");
      expect(d.evento?.falha).toBeUndefined();
      expect(d.novoEstado.falhas_seguidas).toBe(0);
      expect(d.novoEstado.sessoes_graca).toBe(restante);
      estado = d.novoEstado;
    }
    const d = decidir(assistida, estado, reps(5, 5, 4, 4));
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });
});

/* ==================================================================== */
/* §6.3 — tipo `maximo`                                                  */
/* ==================================================================== */

describe("§6.3 — tipo `maximo`: média + 1 E nenhuma série abaixo", () => {
  const anteriores = (v: number[]): ContextoDecisao => ({ seriesAnteriores: v });

  it("caso 15: 4,4,4 → 5,5,5 sobe", () => {
    const d = decidir(
      pronada,
      estadoDe(pronada, { reps_alvo: 4 }),
      reps(5, 5, 5),
      anteriores([4, 4, 4]),
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(5);
  });

  it("a média sobe mas uma série cai: não é sucesso", () => {
    const d = decidir(
      pronada,
      estadoDe(pronada, { reps_alvo: 4 }),
      reps(8, 4, 3),
      anteriores([4, 4, 4]),
    );
    expect(d.evento?.motivo).not.toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(4);
  });

  it("nenhuma série cai mas a média não chega a +1: não é sucesso", () => {
    const d = decidir(
      pronada,
      estadoDe(pronada, { reps_alvo: 4 }),
      reps(6, 4, 4),
      anteriores([4, 4, 4]),
    );
    expect(d.evento?.motivo).not.toBe("subiu");
  });

  it("média menor que a anterior conta falha", () => {
    const d = decidir(
      flexao,
      estadoDe(flexao, { reps_alvo: 10 }),
      reps(8, 8, 8),
      anteriores([10, 10, 10]),
    );
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("uma série a mais na sessão de hoje não inventa queda na série que não existia antes", () => {
    const d = decidir(
      pronada,
      estadoDe(pronada, { reps_alvo: 4 }),
      reps(5, 5, 5, 5),
      anteriores([4, 4, 4]),
    );
    expect(d.evento?.motivo).toBe("subiu");
  });

  it("caso 15 (parte 2): 3 séries de 10 pedem a barra fixa com lastro, subindo ou empacado", () => {
    const subiu = decidir(
      pronada,
      estadoDe(pronada, { reps_alvo: 9 }),
      reps(10, 10, 10),
      anteriores([9, 9, 9]),
    );
    expect(subiu.evento?.motivo).toBe("subiu");
    expect(subiu.evento?.sugestao).toMatch(/lastro/i);

    const empacou = decidir(
      pronada,
      estadoDe(pronada, { reps_alvo: 10 }),
      reps(10, 10, 10),
      anteriores([10, 10, 10]),
    );
    expect(empacou.evento?.sugestao).toMatch(/lastro/i);

    // primeira sessão do exercício, sem referência anterior
    const primeira = decidir(pronada, null, reps(10, 10, 10));
    expect(primeira.evento?.sugestao).toMatch(/lastro/i);
  });

  it("flexão e mergulho (peso corporal, não barra fixa) não recebem sugestão de lastro", () => {
    const d = decidir(
      flexao,
      estadoDe(flexao, { reps_alvo: 9 }),
      reps(12, 12, 12),
      anteriores([9, 9, 9]),
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.evento?.sugestao).toBeUndefined();
  });

  it("a primeira sessão de um `maximo` sem 3 × 10 só registra a média, sem evento", () => {
    const d = decidir(flexao, null, reps(7, 6, 5));
    expect(d.evento).toBeNull();
    expect(d.novoEstado.reps_alvo).toBe(6);
  });
});

/* ==================================================================== */
/* §6.3 — unilateral, tempo, passos, peso corporal                       */
/* ==================================================================== */

describe("§6.3 — unilateral vale o menor lado, também em tempo", () => {
  it("prancha lateral (3 × 20–40 s por lado): 40/35 na última segura a subida", () => {
    const estado = estadoDe(pranchaLateral);
    const segura = decidir(
      pranchaLateral,
      estado,
      temposPorLado([40, 40], [40, 40], [40, 35]),
    );
    expect(segura.evento?.motivo).toBe("repetiu");
    expect(segura.novoEstado.tempo_alvo_s).toBe(20);

    const sobe = decidir(
      pranchaLateral,
      estado,
      temposPorLado([40, 40], [40, 40], [40, 40]),
    );
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.tempo_alvo_s).toBe(45);
  });

  it("o lado fraco abaixo do piso é falha, mesmo com o lado forte no topo", () => {
    const d = decidir(
      pranchaLateral,
      estadoDe(pranchaLateral),
      temposPorLado([40, 40], [40, 19], [40, 40]),
    );
    expect(d.evento?.falha).toBe(true);
    expect(d.novoEstado.falhas_seguidas).toBe(1);
  });

  it("casos 10, 11 e 18: halteres unilaterais valem o menor lado", () => {
    const repete = decidir(
      rosca,
      estadoDe(rosca),
      porLado([12, 12], [12, 12], [12, 11]),
    );
    expect(repete.evento?.motivo).toBe("repetiu");

    const sobe = decidir(
      rosca,
      estadoDe(rosca),
      porLado([12, 12], [12, 12], [12, 12]),
    );
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.carga_atual_kg).toBe(3.5);

    const bulgaroRepete = decidir(
      bulgaro,
      estadoDe(bulgaro, { carga_atual_kg: 5.5 }),
      porLado([10, 10], [10, 10], [10, 9]),
    );
    expect(bulgaroRepete.evento?.motivo).toBe("repetiu");
    expect(bulgaroRepete.novoEstado.carga_atual_kg).toBe(5.5);
  });
});

describe("§6.2/§6.3 — tempo e passos", () => {
  it("caso 16: prancha alvo 30, faixa 30–60, 60 nas três → 65 s com sugestão de variação", () => {
    const d = decidir(prancha, estadoDe(prancha), tempos(60, 60, 60));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.tempo_alvo_s).toBe(65);
    expect(d.evento?.sugestao).toMatch(/varia/i);
    // e o topo a bater da próxima vez passa a ser 65
    const hoje = cargaDeHoje(prancha, d.novoEstado);
    expect([hoje.tempo_alvo_s, hoje.alvo_max]).toEqual([65, 65]);
    const seguinte = decidir(prancha, d.novoEstado, tempos(60, 60, 60));
    expect(seguinte.evento?.motivo).toBe("repetiu");
    const bateu = decidir(prancha, d.novoEstado, tempos(65, 65, 65));
    expect(bateu.novoEstado.tempo_alvo_s).toBe(70);
  });

  it("caso 19: farmer's walk sobe a carga do halter, não os passos", () => {
    const d = decidir(
      farmer,
      estadoDe(farmer, { carga_atual_kg: 11.5 }),
      passos(40, 40, 40),
    );
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(13.5);
    expect(cargaDeHoje(farmer, d.novoEstado).passos_alvo).toBe(30);
  });

  it("exercício sem carga que falha repete o alvo — nunca corta 10 % nem inventa 60 %", () => {
    let estado = estadoDe(elevacaoPernas);
    for (const esperado of [1, 2, 0]) {
      const d = decidir(elevacaoPernas, estado, reps(9, 8, 7));
      expect(d.evento?.motivo).toBe("repetiu");
      expect(d.evento?.falha).toBe(true);
      expect(d.novoEstado.carga_atual_kg).toBe(0);
      expect(d.novoEstado.reps_alvo).toBe(10);
      expect(d.novoEstado.semana_leve).toBe(false);
      expect(d.novoEstado.falhas_seguidas).toBe(esperado);
      estado = d.novoEstado;
    }
  });
});

describe("§6.3 — peso corporal com faixa e a sugestão da anilha", () => {
  it("caso 17: alvo 10, faixa 10–15, 15 nas três → alvo 16", () => {
    const d = decidir(elevacaoPernas, estadoDe(elevacaoPernas), reps(15, 15, 15));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.reps_alvo).toBe(16);
    expect(d.evento?.sugestao).toBeUndefined();
  });

  it("caso 17: passando de 20 em todas as séries, sugere a anilha de 2 kg", () => {
    const d = decidir(
      elevacaoPernas,
      estadoDe(elevacaoPernas, { reps_alvo: 21 }),
      reps(22, 22, 22),
    );
    expect(d.evento?.sugestao).toMatch(/anilha/i);
  });

  it("§6.3: a anilha só é sugerida ACIMA de 20 reps — 20 no piso da faixa 20–30 não é", () => {
    // abdominal bicicleta é 3 × 20–30: 20 em todas as séries é o PISO da faixa,
    // e mandar "voltar ao piso" quem já está no piso não é o que a §6.3 diz.
    const noPiso = decidir(bicicleta, estadoDe(bicicleta), reps(20, 20, 20));
    expect(noPiso.evento?.motivo).toBe("repetiu");
    expect(noPiso.evento?.sugestao).toBeUndefined();

    // russian twist é 3 × 20 (min = max): a primeira sessão perfeita não pode
    // sair com "use uma anilha de 2 kg" — ele já segura uma de 5 kg.
    const exato = decidir(russian, estadoDe(russian), reps(20, 20, 20));
    expect(exato.evento?.motivo).toBe("subiu");
    expect(exato.evento?.sugestao).toBeUndefined();

    // acima de 20, aí sim (§6.3 e a regra do próprio JSON: "quando passar de 20")
    const passou = decidir(bicicleta, estadoDe(bicicleta), reps(21, 21, 21));
    expect(passou.evento?.sugestao).toMatch(/anilha/i);
    const acima = decidir(supra, estadoDe(supra), reps(25, 25, 25));
    expect(acima.evento?.sugestao).toMatch(/anilha/i);
  });
});

/* ==================================================================== */
/* §6.4 — teto, avisos e escala                                          */
/* ==================================================================== */

describe("§6.4 — teto e avisos", () => {
  it("caso 22: 107,5 kg na barra repete com o aviso das anilhas de 10 kg", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 107.5 });
    const d = decidir(supino, estado, reps(8, 8, 8));
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.novoEstado.carga_atual_kg).toBe(107.5);
    expect(d.evento?.aviso).toMatch(/anilhas de 10 kg/i);
    expect(cargaMaxima("barra_macica")).toBe(107.5);
    expect(montagem(109.5, "barra_macica").aviso).toMatch(/anilhas de 10 kg/i);
  });

  it("teto por capacidade (halter 40 kg) não manda comprar anilhas de 10 kg", () => {
    const d = decidir(
      inclinado,
      estadoDe(inclinado, { carga_atual_kg: 39.5 }),
      reps(12, 12, 12),
    );
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.aviso ?? "").not.toMatch(/anilhas de 10 kg/i);
    expect(d.evento?.aviso).toMatch(/40/);
  });

  it("§6.4: o aviso de faltar anilha só aparece no teto — nunca com a barra quase vazia", () => {
    // §3.9 deixa o usuário escolher o incremento por exercício e
    // exercise_state.incremento_kg é numeric(5,2) sem CHECK: 1 kg é gravável e
    // não existe na escala da barra (passo mínimo 2 kg).
    const estado = estadoDe(supino, { carga_atual_kg: 7.5, incremento_kg: 1 });
    const d = decidir(supino, estado, reps(8, 8, 8));
    expect(d.novoEstado.carga_atual_kg).toBe(7.5);
    // com o estoque inteiro intocado, "faltam anilhas de 10 kg" é falso (§6.4)
    expect(d.evento?.aviso ?? "").not.toMatch(/anilhas de 10 kg/i);

    const semIncremento = decidir(
      supino,
      estadoDe(supino, { carga_atual_kg: 25.5, incremento_kg: 0 }),
      reps(8, 8, 8),
    );
    expect(semIncremento.evento?.aviso ?? "").not.toMatch(/anilhas de 10 kg/i);
  });

  it("toda carga que o motor grava existe na escala do implemento", () => {
    for (const ex of exercicios) {
      if (ex.progressao.tipo !== "carga") continue;
      const escala = new Set(cargasPossiveis(ex.implemento));
      let estado = estadoDe(ex);
      const alvo = prescricaoPadrao(ex);
      const topo = alvo.max ?? 0;
      const piso = alvo.min ?? 0;
      const roteiro: SerieFeita[][] = [
        reps(topo, topo, topo),
        reps(topo, topo, topo),
        reps(piso - 1, piso - 1, piso - 1),
        reps(piso - 1, piso - 1, piso - 1),
        reps(piso - 1, piso - 1, piso - 1),
        reps(topo, topo, topo),
        reps(topo, topo, topo),
      ];
      for (const sessao of roteiro) {
        if (alvo.tipo !== "reps") break;
        const d = decidir(ex, estado, sessao);
        const carga = d.novoEstado.carga_atual_kg;
        expect({ id: ex.id, carga, ok: carga === null || escala.has(carga) }).toEqual(
          { id: ex.id, carga, ok: true },
        );
        estado = d.novoEstado;
      }
    }
  });

  it("§6.5: as linhas do documento de casos fecham exatamente", () => {
    expect(montagem(25.5, "barra_macica").porLado).toEqual([5, 4]);
    const fora = montagem(26.5, "barra_macica");
    expect([fora.total, fora.exato, fora.diferenca]).toEqual([25.5, false, -1]);
    expect(montagem(8, "barra_macica").total).toBe(7.5);
    expect(montagem(110, "barra_macica").total).toBe(107.5);
    expect(montagem(5.5, "halteres").porPonta).toEqual([2]);
    expect(montagem(4.5, "halteres").total).toBe(3.5);
    expect(montagem(41.5, "halteres").total).toBe(39.5);
    expect(montagem(0.5, "polia").total).toBe(0);
    expect(montagem(101, "polia").total).toBe(100);
    expect(montagem(52, "barra_w").total).toBe(50);
    expect(montagem(107.5, "barra_macica").porLado).toEqual([
      10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1,
    ]);
  });

  it("§3.9: pesada a barra W, a escala muda e a carga de hoje continua alcançável", () => {
    const opcoes = { pesoBarra: 5.4 };
    const estado = estadoDe(roscaW, { carga_atual_kg: 10 });
    const hoje = cargaDeHoje(roscaW, estado, prescricaoPadrao(roscaW), opcoes);
    expect(hoje.carga_kg).toBe(alcancavelParaBaixo(10, "barra_w", opcoes));
    expect(hoje.montagem?.exato).toBe(true);
    const d = decidir(roscaW, estado, reps(12, 12, 12), { montagem: opcoes });
    expect(cargasPossiveis("barra_w", opcoes)).toContain(
      d.novoEstado.carga_atual_kg,
    );
  });

  it("barra fixa com lastro: sobe de 0 para 2 kg na mochila", () => {
    const d = decidir(lastro, estadoDe(lastro), reps(6, 6, 6, 6));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(2);
  });
});

describe("§3.2/§6 — o que o motor ignora e o que ele não avalia", () => {
  it("as séries de aquecimento não contam para a progressão", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const series: SerieFeita[] = [
      { concluida: true, tipo: "aquecimento", reps: 5 },
      { concluida: true, tipo: "aquecimento", reps: 5 },
      ...reps(8, 8, 8),
    ];
    const d = decidir(supino, estado, series);
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("exercício desativado não é avaliado", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5, desativado: true });
    const d = decidir(supino, estado, reps(8, 8, 8));
    expect(d.evento).toBeNull();
    expect(d.novoEstado).toEqual(estado);
  });

  it("§6.4: o corte de 10 % nos halteres cai na escala de 2 em 2 kg", () => {
    const estado = estadoDe(inclinado, { carga_atual_kg: 21.5, falhas_seguidas: 1 });
    const d = decidir(inclinado, estado, reps(7, 6, 5));
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(d.novoEstado.carga_atual_kg).toBe(
      alcancavelParaBaixo(21.5 * 0.9, "halteres"),
    );
    expect(cargasPossiveis("halteres")).toContain(d.novoEstado.carga_atual_kg);
  });

  it("depois de mudar o degrau, a tela mostra o novo elástico", () => {
    const d = decidir(assistida, estadoDe(assistida), reps(8, 8, 8, 8));
    const hoje = cargaDeHoje(assistida, d.novoEstado);
    expect(hoje.assistencia).toBe("joelho");
    expect(hoje.carga_kg).toBe(0);
  });
});

/* ==================================================================== */
/* §5 — calendário                                                       */
/* ==================================================================== */

const perfil1: PerfilCalendario = {
  fase_atual: "fase1",
  ultimo_treino: null,
  fase_desde: "2026-09-14",
};

describe("§5.2 — o que é hoje", () => {
  it("14/09/2026 é segunda, semana 1 da Fase 1, Treino A com 6 exercícios e 44 min", () => {
    expect(diaDaSemana("2026-09-14")).toBe("seg");
    expect(semanaDaFase("2026-09-14", "2026-09-14")).toBe(1);
    const hoje = treinoDeHoje("2026-09-14", perfil1);
    expect(hoje.tipo).toBe("forca");
    expect(hoje.treinoId).toBe("A1");
    expect(hoje.treino?.exercicios.length).toBe(6);
    expect(hoje.min).toBe(44);
  });

  it("a alternância nunca repete o último treino, semana após semana", () => {
    let ultimo: TreinoId | null = null;
    const vistos: TreinoId[] = [];
    for (const data of [
      "2026-09-14",
      "2026-09-16",
      "2026-09-18",
      "2026-09-21",
      "2026-09-23",
      "2026-09-25",
    ]) {
      const dia = treinoDeHoje(data, { ...perfil1, ultimo_treino: ultimo });
      expect(dia.tipo).toBe("forca");
      vistos.push(dia.treinoId as TreinoId);
      ultimo = dia.treinoId;
    }
    expect(vistos).toEqual(["A1", "B1", "A1", "B1", "A1", "B1"]);
    expect(proximoTreinoAlternado("A1")).toBe("B1");
    expect(proximoTreinoAlternado("B1")).toBe("A1");
    expect(proximoTreinoAlternado(null)).toBe("A1");
  });

  it("Fase 2 tem treino fixo por dia: SA seg · IA ter · SB qui · IB sex", () => {
    const perfil2: PerfilCalendario = {
      fase_atual: "fase2",
      ultimo_treino: "IB",
      fase_desde: "2026-09-14",
    };
    const semana = semanaDoPlano("2026-09-14", perfil2);
    expect(semana.map((d) => `${d.dia}:${d.tipo}:${d.treinoId ?? "-"}`)).toEqual([
      "seg:forca:SA",
      "ter:forca:IA",
      "qua:cardio:-",
      "qui:forca:SB",
      "sex:forca:IB",
      "sab:cardio:-",
      "dom:descanso:-",
    ]);
  });

  it("cardio: terça é a corrida da semana 1 (8 × 1/2 min) e sábado aceita corda", () => {
    const terca = sessaoCardioDeHoje("2026-09-15", perfil1);
    expect(terca?.tipo).toBe("corrida");
    expect(terca?.semana).toBe(1);
    expect(terca?.descricao).toMatch(/8 × \(1 min corrida \/ 2 min caminhada\)/);
    expect(terca?.permiteCorda).toBe(false);

    const sabado = sessaoCardioDeHoje("2026-09-19", perfil1);
    expect(sabado?.permiteCorda).toBe(true);
    expect(sabado?.corda).not.toBeNull();
  });

  it("§5.2 item 5: a quinta traz o lembrete da barra fixa e o domingo, a caminhada leve", () => {
    const quinta = treinoDeHoje("2026-09-17", perfil1);
    expect(quinta.tipo).toBe("descanso");
    expect(quinta.nota).toMatch(/barra fixa/i);
    const domingo = treinoDeHoje("2026-09-20", perfil1);
    expect(domingo.tipo).toBe("descanso");
    expect(domingo.nota).toMatch(/caminhada leve/i);
  });

  it("§5.2 item 1: o override vence o programa e entra na corrente da alternância", () => {
    const overrides: ExcecaoAgenda[] = [
      { data: "2026-09-15", tipo: "forca", workout_id: null, sessao: null },
      { data: "2026-09-16", tipo: "descanso", workout_id: null, sessao: null },
    ];
    const semana = semanaDoPlano("2026-09-14", perfil1, overrides);
    expect(semana.map((d) => `${d.dia}:${d.tipo}:${d.treinoId ?? "-"}`)).toEqual([
      "seg:forca:A1",
      "ter:forca:B1",
      "qua:descanso:-",
      "qui:descanso:-",
      "sex:forca:A1",
      "sab:cardio:-",
      "dom:descanso:-",
    ]);
  });
});

describe("§5.5 — as semanas dos planos de corrida, corda e barra fixa", () => {
  it("2 sessões avançam; 1 e 0 repetem; o plano não passa da semana 12", () => {
    expect(avancarSemanaDeCorrida(3, 2)).toBe(4);
    expect(avancarSemanaDeCorrida(3, 1)).toBe(3);
    expect(avancarSemanaDeCorrida(3, 0)).toBe(3);
    expect(avancarSemanaDeCorrida(12, 2)).toBe(12);

    expect(avancarSemanaDeCorda(5, 2)).toBe(6);
    expect(avancarSemanaDeCorda(5, 1)).toBe(5);
    expect(avancarSemanaDeCorda(12, 2)).toBe(12);

    expect(avancarSemanaDeBarraFixa(7, 2)).toBe(8);
    expect(avancarSemanaDeBarraFixa(7, 1)).toBe(7);
    expect(avancarSemanaDeBarraFixa(12, 2)).toBe(12);
  });

  it("três sessões numa semana civil não pulam duas semanas do plano", () => {
    expect(avancarSemanaDeCorrida(3, 3)).toBe(4);
  });
});

describe("§5.1 — a sugestão da Fase 2", () => {
  it("exige 12 semanas civis E 30 sessões", () => {
    const antes = sugerirFase2(perfil1, 40, "2026-11-30"); // 11 semanas
    expect(antes.semanas).toBe(11);
    expect(antes.sugerir).toBe(false);

    const poucas = sugerirFase2(perfil1, 29, "2026-12-07");
    expect(poucas.semanas).toBe(12);
    expect(poucas.sugerir).toBe(false);

    const vale = sugerirFase2(perfil1, 30, "2026-12-07");
    expect(vale.sugerir).toBe(true);
  });

  it("adiar silencia por 2 semanas e a sugestão volta sozinha", () => {
    const ate = adiarFase2("2026-12-07");
    expect(ate).toBe("2026-12-21");
    const adiado: PerfilCalendario = {
      ...perfil1,
      prefs: { fase2_adiada_ate: ate },
    };
    expect(sugerirFase2(adiado, 30, "2026-12-08").sugerir).toBe(false);
    expect(sugerirFase2(adiado, 30, "2026-12-20").sugerir).toBe(false);
    expect(sugerirFase2(adiado, 30, "2026-12-21").sugerir).toBe(true);
  });

  it("na Fase 2 o app não sugere a Fase 2", () => {
    const perfil2: PerfilCalendario = {
      fase_atual: "fase2",
      ultimo_treino: "SA",
      fase_desde: "2026-09-14",
    };
    expect(sugerirFase2(perfil2, 99, "2027-06-07").sugerir).toBe(false);
  });
});

describe("§5.4 — semana curta", () => {
  const semana = () => semanaDoPlano("2026-09-14", perfil1);

  it("os treinos protegidos saem dos dados: A1, B1, IA e IB", () => {
    expect(treinosComAgachamentoOuTerra().sort()).toEqual(
      ["A1", "B1", "IA", "IB"].sort(),
    );
  });

  it("com três dias sobram os três treinos de força: cortam-se os dois cardios, sábado primeiro", () => {
    const r = semanaCurta(["ter", "qui", "sab", "dom"], semana());
    expect(r.capacidade).toBe(3);
    expect(r.cortados.map((c) => c.dia)).toEqual(["sab", "ter"]);
    expect(r.cortados.every((c) => c.tipo === "cardio")).toBe(true);
    const forca = r.dias.filter((d) => d.tipo === "forca");
    expect(forca.map((d) => d.treinoId)).toEqual(["A1", "B1", "A1"]);
    expect(r.dias.filter((d) => d.tipo === "cardio")).toHaveLength(0);
  });

  it("sobrando um dia só na semana, o que fica é o Treino A — inclusive na semana B-A-B", () => {
    const bab = semanaDoPlano("2026-09-21", { ...perfil1, ultimo_treino: "A1" });
    expect(bab.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "B1",
      "A1",
      "B1",
    ]);
    const r = semanaCurta(["seg", "ter", "qua", "qui", "sex", "sab"], bab);
    expect(r.capacidade).toBe(1);
    const restantes = r.dias.filter((d) => d.tipo !== "descanso");
    expect(restantes).toHaveLength(1);
    expect(restantes[0]?.tipo).toBe("forca");
    expect(restantes[0]?.treinoId).toBe("A1");
    expect(restantes[0]?.dia).toBe("dom");
  });

  it("Fase 2: corta os cardios e depois o superior, nunca IA nem IB", () => {
    const perfil2: PerfilCalendario = {
      fase_atual: "fase2",
      ultimo_treino: null,
      fase_desde: "2026-09-14",
    };
    const r = semanaCurta(
      ["seg", "qua", "sab"],
      semanaDoPlano("2026-09-14", perfil2),
    );
    expect(r.capacidade).toBe(4);
    expect(r.cortados.map((c) => c.treinoId ?? c.tipo)).toEqual([
      "cardio",
      "cardio",
    ]);
    const ficaram = r.dias
      .filter((d) => d.tipo === "forca")
      .map((d) => d.treinoId);
    expect(ficaram).toContain("IA");
    expect(ficaram).toContain("IB");
    expect(ficaram).toHaveLength(4);
  });

  it("marcar um dia de descanso não corta nada", () => {
    const r = semanaCurta("qui", semana());
    expect(r.cortados).toHaveLength(0);
    expect(r.dias.filter((d) => d.tipo === "forca")).toHaveLength(3);
    expect(r.dias.filter((d) => d.tipo === "cardio")).toHaveLength(2);
  });

  it("§3.5: marcar o dia por data (e não por 'seg') dá o mesmo resultado", () => {
    const resumo = (d: DiaDoPlano) => `${d.dia}:${d.tipo}:${d.treinoId ?? "-"}`;
    const porNome = semanaCurta("seg", semana());
    const porData = semanaCurta("2026-09-14", semana());
    expect(porData.capacidade).toBe(porNome.capacidade);
    expect(porData.dias.map(resumo)).toEqual(porNome.dias.map(resumo));
  });

  it("a semana remanejada continua alternando A e B (§5.2 item 3)", () => {
    const r = semanaCurta("seg", semana());
    const forca = r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId);
    expect(forca).toHaveLength(3);
    for (let i = 1; i < forca.length; i++) {
      expect(forca[i]).not.toBe(forca[i - 1]);
    }
  });
});
