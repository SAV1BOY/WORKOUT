/**
 * AUDITORIA ADVERSARIAL — lente "spec" (rodada 4).
 *
 * Conformidade do motor (lib/progressao.ts, lib/montagem.ts, lib/calendario.ts)
 * com SPEC.md §5 e §6 e com docs/casos-de-teste-progressao.md — **além** dos 22
 * casos do documento e das três rodadas anteriores.
 *
 * O ataque desta rodada:
 *  - invariantes varridas no catálogo inteiro (81 exercícios) e nas prescrições
 *    reais dos 6 treinos, em vez de exemplos escolhidos a dedo;
 *  - o contrato entre `cargaDeHoje` (o que a tela mostra) e `decidir` (o que o
 *    motor grava) — inclusive depois de pesar a barra W (§3.9) e com uma linha
 *    de `exercise_state` fora da escala do implemento;
 *  - o toggle "última repetição saiu firme?" (§3.2/§6.2) em TODOS os tipos de
 *    prescrição, `maximo` incluído;
 *  - a semana curta (§5.4) convivendo com `schedule_overrides` (§5.2 item 1).
 *
 * Os três achados desta rodada estão nos testes marcados "ACHADO":
 *  A — §6.2/§3.2: no tipo `maximo` o motor sobe mesmo com "última firme"
 *      desligada (5 exercícios do catálogo).
 *  B — §6.2/§6.4/§3.9/§10.5 (uma causa, três sintomas): `decidir()` decide a
 *      partir do valor cru de `exercise_state.carga_atual_kg`, enquanto
 *      `cargaDeHoje()` projeta na escala do implemento.
 *  C — §5.2 item 1: `semanaCurta()` reescreve o treino que o usuário escolheu
 *      num `schedule_override`, mesmo sem cortar nem remanejar o dia.
 *
 * Nada aqui é código de produção.
 */
import { describe, expect, it } from "vitest";
import { acharExercicio, acharTreino, exercicios } from "@/lib/dados";
import { alcancavelParaBaixo, cargaMaxima, cargasPossiveis } from "@/lib/montagem";
import {
  cargaDeHoje,
  decidir,
  estadoInicial,
  incrementoDe,
  prescricaoDoTreino,
  prescricaoPadrao,
  type Alvo,
  type EstadoExercicio,
  type SerieFeita,
} from "@/lib/progressao";
import {
  adiarFase2,
  avancarSemanaDeBarraFixa,
  avancarSemanaDeCorda,
  avancarSemanaDeCorrida,
  semanaCurta,
  semanaDoPlano,
  sessaoCardioDeHoje,
  sugerirFase2,
  treinoDeHoje,
  treinosComAgachamentoOuTerra,
  type ExcecaoAgenda,
  type PerfilCalendario,
} from "@/lib/calendario";
import type { Exercicio, TreinoId } from "@/lib/schemas";

/* ------------------------------------------------------------- atalhos */

const supino = acharExercicio("supino-reto-com-barra");
const agachamento = acharExercicio("agachamento-livre");
const terra = acharExercicio("levantamento-terra");
const puxada = acharExercicio("puxada-alta-na-polia");
const roscaW = acharExercicio("rosca-com-barra-w");
const assistida = acharExercicio("barra-fixa-assistida");
const pronada = acharExercicio("barra-fixa-pronada");
const flexao = acharExercicio("flexao-de-braco");
const prancha = acharExercicio("prancha");
const elevacaoPernas = acharExercicio("elevacao-de-pernas-na-barra-fixa");
const farmer = acharExercicio("farmer-s-walk");

const TREINOS: TreinoId[] = ["A1", "B1", "SA", "IA", "SB", "IB"];

function estadoDe(ex: Exercicio, patch: Partial<EstadoExercicio> = {}): EstadoExercicio {
  return { ...estadoInicial(ex), ...patch };
}

function reps(...valores: number[]): SerieFeita[] {
  return valores.map((r) => ({ concluida: true, reps: r }));
}

function tempos(...valores: number[]): SerieFeita[] {
  return valores.map((t) => ({ concluida: true, tempo_s: t }));
}

/** Uma série no formato certo para o tipo de prescrição do exercício. */
function serieDe(presc: Alvo, valor: number): SerieFeita {
  const s: SerieFeita = { concluida: true };
  if (presc.tipo === "tempo_s") {
    s.tempo_s = valor;
    if (presc.unilateral) s.tempo_s_lado2 = valor;
  } else if (presc.tipo === "passos") {
    s.passos = valor;
  } else {
    s.reps = valor;
    if (presc.unilateral) s.reps_lado2 = valor;
  }
  return s;
}

function sessaoDe(presc: Alvo, valor: number): SerieFeita[] {
  return Array.from({ length: presc.series }, () => serieDe(presc, valor));
}

/** A prescrição real de um exercício dentro de um treino do programa. */
function prescricaoNoTreino(tid: TreinoId, exId: string): Alvo {
  const item = acharTreino(tid).exercicios.find((e) => e.exercicio_id === exId);
  if (!item) throw new Error(`${exId} não está em ${tid}`);
  return prescricaoDoTreino(item, acharExercicio(exId));
}

const perfilF1: PerfilCalendario = {
  fase_atual: "fase1",
  ultimo_treino: "A1",
  fase_desde: "2026-09-14",
  semana_corrida: 1,
  semana_corda: 1,
  semana_fixa: 1,
};

/* ==================================================================== */
/* §6.1 — a primeira vez, varrida no catálogo e nos treinos reais        */
/* ==================================================================== */

describe("§6.1 — carga de hoje na primeira vez", () => {
  it("§6.1/§10.2: barra 7,5 · halter 1,5 · pino 4 · peso corporal 0, e nada fora da escala", () => {
    const esperado: Record<string, number> = {
      "supino-reto-com-barra": 7.5,
      "agachamento-livre": 7.5,
      "levantamento-terra": 7.5,
      "rosca-alternada": 1.5,
      "agachamento-bulgaro": 1.5,
      "farmer-s-walk": 1.5,
      "puxada-alta-na-polia": 4,
      "prancha": 0,
      "barra-fixa-pronada": 0,
      "elevacao-de-pernas-na-barra-fixa": 0,
    };
    for (const [id, kg] of Object.entries(esperado)) {
      expect(cargaDeHoje(acharExercicio(id), null).carga_kg).toBe(kg);
    }

    for (const ex of exercicios) {
      const a = cargaDeHoje(ex, null);
      expect(a.primeira_vez).toBe(true);
      expect(a.carga_kg).toBe(ex.carga_inicial.kg);
      if (a.carga_kg !== null) {
        expect(cargasPossiveis(ex.implemento)).toContain(a.carga_kg);
      }
      // §6.5: a montagem da carga de hoje sempre fecha exata.
      if (a.montagem) expect(a.montagem.exato).toBe(true);
    }
  });

  it("§6.1: o estado nasce com o PISO da faixa (reps/tempo) e a tela pré-preenche o topo", () => {
    for (const tid of TREINOS) {
      for (const item of acharTreino(tid).exercicios) {
        const ex = acharExercicio(item.exercicio_id);
        const presc = prescricaoDoTreino(item, ex);
        const inicial = estadoInicial(ex, presc);
        const hoje = cargaDeHoje(ex, null, presc);

        if (ex.progressao.tipo === "reps") expect(inicial.reps_alvo).toBe(presc.min);
        if (ex.progressao.tipo === "tempo") expect(inicial.tempo_alvo_s).toBe(presc.min);
        if (ex.progressao.tipo === "assistencia") expect(inicial.assistencia).toBe("pe_inteiro");

        expect(hoje.alvo_min).toBe(presc.min);
        if (presc.tipo !== "maximo") expect(hoje.alvo_max).toBe(presc.max);
        if (presc.tipo === "tempo_s") expect(hoje.tempo_alvo_s).toBe(presc.min);
        if (presc.tipo === "passos") expect(hoje.passos_alvo).toBe(presc.min);
      }
    }
    // farmer's walk: piso 30 no estado, topo 40 na tela (§6.1 + §3.2)
    const f = cargaDeHoje(farmer, null);
    expect(f.passos_alvo).toBe(30);
    expect(f.alvo_max).toBe(40);
  });

  it("§6.1: sem linha no banco, decidir parte da carga_inicial do JSON", () => {
    const d = decidir(supino, null, reps(8, 8, 8));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.evento?.de).toEqual({ carga_kg: 7.5 });
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
  });
});

/* ==================================================================== */
/* §6.2 — as três classes, varridas no catálogo inteiro                  */
/* ==================================================================== */

describe("§6.2 — sucesso, manteve e falha em todo o catálogo", () => {
  it("topo da faixa + firme sobe em TODOS os exercícios dos 6 treinos", () => {
    for (const tid of TREINOS) {
      for (const item of acharTreino(tid).exercicios) {
        const ex = acharExercicio(item.exercicio_id);
        const presc = prescricaoDoTreino(item, ex);
        if (presc.tipo === "ver_cardio_corda") continue;
        const estado =
          presc.tipo === "maximo" ? estadoDe(ex, { reps_alvo: 3 }) : estadoInicial(ex, presc);
        const alvo = presc.tipo === "maximo" ? 8 : (presc.max ?? presc.min ?? 0);
        const d = decidir(ex, estado, sessaoDe(presc, alvo), {
          prescricao: presc,
          ultimaFirme: true,
          seriesAnteriores: presc.tipo === "maximo" ? Array(presc.series).fill(3) : null,
        });
        expect(`${tid}/${ex.id}: ${d.evento?.motivo}`).toBe(`${tid}/${ex.id}: subiu`);
      }
    }
  });

  it("o piso da faixa é 'manteve' (sem falha) em todo exercício de faixa aberta", () => {
    for (const ex of exercicios) {
      const presc = prescricaoPadrao(ex);
      if (presc.tipo === "maximo" || presc.tipo === "ver_cardio_corda") continue;
      if (presc.min === null || presc.max === null || presc.min >= presc.max) continue;
      const d = decidir(ex, estadoInicial(ex), sessaoDe(presc, presc.min));
      expect(`${ex.id}: ${d.evento?.motivo}/${d.evento?.falha ?? false}`).toBe(
        `${ex.id}: repetiu/false`,
      );
      expect(d.novoEstado.falhas_seguidas).toBe(0);
    }
  });

  it("uma série abaixo do piso conta exatamente uma falha em todo o catálogo", () => {
    for (const ex of exercicios) {
      const presc = prescricaoPadrao(ex);
      if (presc.tipo === "maximo" || presc.tipo === "ver_cardio_corda") continue;
      if (presc.min === null) continue;
      const series = sessaoDe(presc, presc.max ?? presc.min);
      series[series.length - 1] = serieDe(presc, Math.max(0, presc.min - 1));
      const d = decidir(ex, estadoInicial(ex), series);
      expect(`${ex.id}: ${d.evento?.falha}`).toBe(`${ex.id}: true`);
      expect(d.novoEstado.falhas_seguidas).toBe(1);
    }
  });

  it("ACHADO A — §6.2/§3.2: 'última firme' desligada nunca pode subir, nem no tipo `maximo`", () => {
    // §6.2: "Manteve = … ou `ultima_firme = false` → repete a carga."
    // O preâmbulo da §6.2 manda a §6.3 só para definir `alvo_max` do tipo
    // `maximo` ("Seja alvo_max o topo da faixa (prescricao.max; para `maximo`,
    // ver 6.3)"), não para dispensar o toggle — que a §3.2 chama de "o que o
    // motor usa".
    const subiramSemFirme: string[] = [];
    for (const ex of exercicios) {
      const presc = prescricaoPadrao(ex);
      if (presc.tipo === "ver_cardio_corda") continue;
      const estado = presc.tipo === "maximo" ? estadoDe(ex, { reps_alvo: 4 }) : estadoInicial(ex);
      const alvo = presc.tipo === "maximo" ? 20 : (presc.max ?? presc.min ?? 10);
      const d = decidir(ex, estado, sessaoDe(presc, alvo), {
        ultimaFirme: false,
        seriesAnteriores: presc.tipo === "maximo" ? Array(presc.series).fill(4) : null,
      });
      if (d.evento?.motivo === "subiu") subiramSemFirme.push(ex.id);
    }
    expect(subiramSemFirme).toEqual([]);
  });

  it("caso 5/§6.2: exigir_rep_extra exige topo + 1 e some na subida", () => {
    const presc = prescricaoNoTreino("A1", "supino-reto-com-barra"); // 3 × 5
    const duasFalhas = decidir(
      supino,
      estadoDe(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 }),
      reps(5, 4, 3),
      { prescricao: presc },
    );
    expect(duasFalhas.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(duasFalhas.novoEstado.carga_atual_kg).toBe(21.5);
    expect(duasFalhas.novoEstado.exigir_rep_extra).toBe(true);
    expect(incrementoDe(supino, duasFalhas.novoEstado)).toBe(2);

    const st = duasFalhas.novoEstado;
    expect(decidir(supino, st, reps(5, 5, 5), { prescricao: presc }).evento?.motivo).toBe("repetiu");
    // a rep extra vale em TODAS as séries
    expect(decidir(supino, st, reps(6, 6, 5), { prescricao: presc }).evento?.motivo).toBe("repetiu");
    const sobe = decidir(supino, st, reps(6, 6, 6), { prescricao: presc });
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.carga_atual_kg).toBe(23.5);
    expect(sobe.novoEstado.exigir_rep_extra).toBe(false);
    expect(sobe.novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(supino, sobe.novoEstado)).toBe(2);
  });

  it("caso 8/9/§6.2: semana leve → fim_semana_leve → subida com o incremento cheio", () => {
    const antes = estadoDe(terra, { carga_atual_kg: 47.5, falhas_seguidas: 2 });
    const leve = decidir(terra, antes, reps(4, 3, 3));
    expect(leve.evento?.motivo).toBe("semana_leve_60");
    expect(leve.novoEstado.carga_atual_kg).toBe(27.5);
    expect(leve.novoEstado.carga_antes_leve).toBe(47.5);
    expect(leve.novoEstado.falhas_seguidas).toBe(0);
    // a tela da semana leve mostra o que o estado gravou, e ele é montável
    const naLeve = cargaDeHoje(terra, leve.novoEstado);
    expect(naLeve.carga_kg).toBe(27.5);
    expect(naLeve.montagem?.exato).toBe(true);

    const fim = decidir(terra, leve.novoEstado, reps(5, 5, 5));
    expect(fim.evento?.motivo).toBe("fim_semana_leve");
    expect(fim.novoEstado.carga_atual_kg).toBe(47.5);
    expect(fim.novoEstado.semana_leve).toBe(false);
    expect(incrementoDe(terra, fim.novoEstado)).toBe(4);

    const sobe = decidir(terra, fim.novoEstado, reps(5, 5, 5));
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.carga_atual_kg).toBe(51.5);
  });

  it("§6.2: o override de incremento do exercise_state manda na subida e na metade", () => {
    const com6 = decidir(agachamento, estadoDe(agachamento, { carga_atual_kg: 35.5, incremento_kg: 6 }), reps(5, 5, 5));
    expect(com6.novoEstado.carga_atual_kg).toBe(41.5);

    const falhou = decidir(
      agachamento,
      estadoDe(agachamento, { carga_atual_kg: 35.5, incremento_kg: 6, falhas_seguidas: 1 }),
      reps(5, 4, 3),
    );
    expect(falhou.novoEstado.incremento_reduzido).toBe(true);
    expect(falhou.novoEstado.exigir_rep_extra).toBe(false); // 6 ÷ 2 = 3 ≥ 2
    expect(incrementoDe(agachamento, falhou.novoEstado)).toBe(3);
  });

  it("§6.2: um 'manteve' não zera o contador de falhas; uma subida zera", () => {
    const uma = decidir(supino, estadoDe(supino, { carga_atual_kg: 25.5 }), reps(8, 8, 4));
    expect(uma.novoEstado.falhas_seguidas).toBe(1);
    const manteve = decidir(supino, uma.novoEstado, reps(8, 8, 6));
    expect(manteve.novoEstado.falhas_seguidas).toBe(1);
    const subiu = decidir(supino, manteve.novoEstado, reps(8, 8, 8));
    expect(subiu.novoEstado.falhas_seguidas).toBe(0);
  });
});

/* ==================================================================== */
/* §6.1 × §6.4 — o contrato entre a tela e o motor                       */
/* ==================================================================== */

describe("§6.1 × §6.4 — a carga que a tela mostra é a que o motor usa", () => {
  it("ACHADO B (1/3) — §3.9/§6.2: pesada a barra W, a sessão perfeita não sobe carga nenhuma", () => {
    // §3.9: a barra W "ainda será pesada"; com `pesoBarra` a escala vira
    // 4,8 + 2k e os 2,0 kg do JSON ficam ABAIXO dela. `cargaDeHoje` projeta
    // (4,8) — `decidir` continua partindo do valor cru do estado.
    const opcoes = { pesoBarra: 4.8 };
    const naTela = cargaDeHoje(roscaW, estadoInicial(roscaW), undefined, opcoes);
    expect(naTela.carga_kg).toBe(4.8);

    const d = decidir(roscaW, estadoInicial(roscaW), reps(12, 12, 12), { montagem: opcoes });
    expect(d.evento?.motivo).toBe("subiu");
    // §6.2: "sobe: carga += incremento" — a partir da carga de hoje (4,8).
    expect(d.novoEstado.carga_atual_kg).toBe(6.8);
  });

  it("ACHADO B (2/3) — §6.4/§10.5: o motor nunca pode gravar (nem publicar em evento) uma carga fora da escala", () => {
    // Linha de exercise_state fora da grade (edição manual, importação de
    // backup, §3.9 depois de pesar a barra): a tela projeta, o estado não.
    const foraDaEscala = estadoDe(supino, { carga_atual_kg: 120 }); // acima do teto 107,5
    expect(cargaDeHoje(supino, foraDaEscala).carga_kg).toBe(107.5);
    const d = decidir(supino, foraDaEscala, reps(8, 8, 8));
    expect(cargasPossiveis("barra_macica")).toContain(d.novoEstado.carga_atual_kg);
    expect(cargasPossiveis("barra_macica")).toContain(
      (d.evento?.para as { carga_kg: number }).carga_kg,
    );
  });

  it("ACHADO B (3/3) — §6.2: com a carga do banco abaixo da barra vazia, a subida não sai do lugar", () => {
    const abaixo = estadoDe(supino, { carga_atual_kg: 5 });
    expect(cargaDeHoje(supino, abaixo).carga_kg).toBe(7.5);
    const d = decidir(supino, abaixo, reps(8, 8, 8));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(9.5);
  });

  it("uma carga fora da grade no meio da escala sobe um degrau a partir do que a tela mostra", () => {
    const d = decidir(supino, estadoDe(supino, { carga_atual_kg: 26.5 }), reps(8, 8, 8));
    expect(cargaDeHoje(supino, estadoDe(supino, { carga_atual_kg: 26.5 })).carga_kg).toBe(25.5);
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("§6.4: reduzir nunca sobe e toda carga gravada existe na escala", () => {
    for (const ex of exercicios) {
      const presc = prescricaoPadrao(ex);
      if (presc.tipo === "ver_cardio_corda") continue;
      const escala = cargasPossiveis(ex.implemento);
      for (const falhas of [1, 2]) {
        const antes = estadoDe(ex, { falhas_seguidas: falhas });
        const d = decidir(ex, antes, sessaoDe(presc, 0));
        const nova = d.novoEstado.carga_atual_kg;
        if (nova === null) continue;
        expect(escala).toContain(nova);
        expect(nova).toBeLessThanOrEqual(antes.carga_atual_kg ?? nova);
      }
    }
  });

  it("§6.4: aviso do teto só no topo — 107,5 na barra, capacidade no halter e no pino", () => {
    const noTeto = decidir(supino, estadoDe(supino, { carga_atual_kg: 107.5 }), reps(8, 8, 8));
    expect(noTeto.evento?.motivo).toBe("repetiu");
    expect(noTeto.evento?.aviso).toBe("faltam anilhas de 10 kg (marco do guia)");
    expect(noTeto.novoEstado.carga_atual_kg).toBe(107.5);

    const noPino = decidir(puxada, estadoDe(puxada, { carga_atual_kg: cargaMaxima("polia") }), reps(12, 12, 12));
    expect(noPino.evento?.aviso).toContain("capacidade 100 kg");
    expect(noPino.evento?.aviso).not.toContain("anilhas de 10 kg");

    // longe do teto, com um incremento que não alcança o degrau: não é falta de anilha
    const curto = decidir(supino, estadoDe(supino, { carga_atual_kg: 25.5, incremento_kg: 1 }), reps(8, 8, 8));
    expect(curto.evento?.aviso).toBeUndefined();
    expect(curto.evento?.sugestao).toContain("incremento");
  });
});

/* ==================================================================== */
/* §6.3 — casos especiais                                                */
/* ==================================================================== */

describe("§6.3 — casos especiais", () => {
  it("caso 20/§6.3: sessão abandonada só avalia quem tem todas as séries", () => {
    const antes = estadoDe(supino, { carga_atual_kg: 25.5 });
    const parcial = decidir(supino, antes, reps(8), { sessaoAbandonada: true });
    expect(parcial.evento).toBeNull();
    expect(parcial.novoEstado).toEqual(antes);

    const completo = decidir(supino, antes, reps(8, 8, 8), { sessaoAbandonada: true });
    expect(completo.evento?.motivo).toBe("subiu");

    // numa sessão CONCLUÍDA, série faltando é falha (§6.2)
    const concluida = decidir(supino, antes, reps(8, 8));
    expect(concluida.evento?.falha).toBe(true);
  });

  it("caso 21/§6.3: substituição — o substituto usa o próprio estado, o original não é tocado", () => {
    const inclinado = acharExercicio("supino-inclinado-com-halteres");
    const estadoOriginal = estadoDe(supino, { carga_atual_kg: 25.5 });
    const d = decidir(inclinado, estadoDe(inclinado, { carga_atual_kg: 11.5 }), reps(12, 12, 12));
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(13.5);
    // o original: nenhuma série registrada → nenhuma decisão
    const original = decidir(supino, estadoOriginal, []);
    expect(original.evento).toBeNull();
    expect(original.novoEstado).toEqual(estadoOriginal);
  });

  it("§6.3: unilateral vale o menor lado — em reps e em tempo", () => {
    const bulgaro = acharExercicio("agachamento-bulgaro");
    const quase = decidir(bulgaro, estadoDe(bulgaro, { carga_atual_kg: 5.5 }), [
      { concluida: true, reps: 10, reps_lado2: 10 },
      { concluida: true, reps: 10, reps_lado2: 10 },
      { concluida: true, reps: 10, reps_lado2: 9 },
    ]);
    expect(quase.evento?.motivo).toBe("repetiu");

    const lateral = acharExercicio("prancha-lateral"); // 3 × 20–40 s por lado
    const segura = decidir(lateral, estadoInicial(lateral), [
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 35 },
    ]);
    expect(segura.evento?.motivo).toBe("repetiu");
    const sobe = decidir(lateral, estadoInicial(lateral), [
      { concluida: true, tempo_s: 40, tempo_s_lado2: 41 },
      { concluida: true, tempo_s: 41, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
    ]);
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.tempo_alvo_s).toBe(45);
  });

  it("caso 13/14/§6.3: assistência sobe degrau a degrau até `sem`, com 2 sessões de graça", () => {
    let st = estadoInicial(assistida);
    const degraus = ["joelho", "joelho_dobrado", "sem"];
    for (const degrau of degraus) {
      const d = decidir(assistida, st, reps(8, 8, 8, 8));
      expect(d.evento?.motivo).toBe("subiu");
      expect(d.novoEstado.assistencia).toBe(degrau);
      expect(d.novoEstado.sessoes_graca).toBe(2);
      expect(d.novoEstado.carga_atual_kg).toBe(0); // "a carga não muda"
      st = d.novoEstado;
      expect(cargaDeHoje(assistida, st).assistencia).toBe(degrau);
    }
    // em `sem` não há degrau: repete e sugere a barra fixa com lastro
    const fim = decidir(assistida, st, reps(8, 8, 8, 8));
    expect(fim.evento?.motivo).toBe("repetiu");
    expect(fim.novoEstado.assistencia).toBe("sem");
    expect(fim.evento?.sugestao).toContain("lastro");

    // a graça absorve 2 quedas; a 3ª volta a contar
    let g = estadoDe(assistida, { assistencia: "joelho", sessoes_graca: 2 });
    for (const esperado of [false, false, true]) {
      const d = decidir(assistida, g, reps(3, 3, 3, 3));
      expect(d.evento?.falha ?? false).toBe(esperado);
      g = d.novoEstado;
    }
    expect(g.falhas_seguidas).toBe(1);
  });

  it("caso 15/§6.3: `maximo` = média + 1 E nenhuma série abaixo; 3 × 10 sugere lastro", () => {
    const base = estadoDe(pronada, { reps_alvo: 4 });
    const sobe = decidir(pronada, base, reps(5, 5, 5), { seriesAnteriores: [4, 4, 4] });
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.reps_alvo).toBe(5);

    const caiuUma = decidir(pronada, base, reps(8, 3, 8), { seriesAnteriores: [4, 4, 4] });
    expect(caiuUma.evento?.motivo).not.toBe("subiu");

    const semMaisUm = decidir(pronada, base, reps(5, 4, 4), { seriesAnteriores: [4, 4, 4] });
    expect(semMaisUm.evento?.motivo).toBe("repetiu");
    expect(semMaisUm.evento?.falha).toBeUndefined();

    const caiu = decidir(pronada, base, reps(2, 2, 2), { seriesAnteriores: [4, 4, 4] });
    expect(caiu.evento?.falha).toBe(true);

    // 3 × 10: a sugestão do lastro sai subindo, empacando ou caindo
    for (const anteriores of [[9, 9, 9], [10, 10, 10], [12, 12, 12]]) {
      const d = decidir(pronada, estadoDe(pronada, { reps_alvo: 9 }), reps(10, 10, 10), {
        seriesAnteriores: anteriores,
      });
      expect(d.evento?.sugestao).toContain("lastro");
    }
    // flexão (peso corporal, não barra fixa) não recebe conselho de lastro
    const semLastro = decidir(flexao, estadoDe(flexao, { reps_alvo: 9 }), reps(10, 10, 10), {
      seriesAnteriores: [9, 9, 9],
    });
    expect(semLastro.evento?.sugestao ?? "").not.toContain("lastro");
  });

  it("caso 16/17/§6.3: tempo, reps de peso corporal e a anilha acima de 20", () => {
    // caso 16: prancha 30 → 60 nas três → 65 s
    const p = decidir(prancha, estadoInicial(prancha), tempos(60, 60, 60));
    expect(p.evento?.motivo).toBe("subiu");
    expect(p.novoEstado.tempo_alvo_s).toBe(65);
    expect(cargaDeHoje(prancha, p.novoEstado).alvo_max).toBe(65);

    // caso 17: elevação de pernas 10 → 15 nas três → 16
    const e = decidir(elevacaoPernas, estadoInicial(elevacaoPernas), reps(15, 15, 15));
    expect(e.novoEstado.reps_alvo).toBe(16);
    expect(e.evento?.sugestao).toBeUndefined();

    // §6.3: "acima de 20" — 20 não é acima de 20
    const vinte = decidir(elevacaoPernas, estadoDe(elevacaoPernas, { reps_alvo: 20 }), reps(20, 20, 20));
    expect(vinte.evento?.sugestao).toBeUndefined();
    const vinteUm = decidir(elevacaoPernas, estadoDe(elevacaoPernas, { reps_alvo: 21 }), reps(21, 21, 21));
    expect(vinteUm.evento?.sugestao).toContain("anilha");
    // e só quando TODAS as séries passam de 20
    const umaAbaixo = decidir(elevacaoPernas, estadoDe(elevacaoPernas, { reps_alvo: 21 }), reps(21, 21, 20));
    expect(umaAbaixo.evento?.sugestao).toBeUndefined();
  });

  it("§6.2/§6.3: exercício sem carga que falha repete o alvo — não existe 60 % do corpo", () => {
    let st = estadoDe(elevacaoPernas, { reps_alvo: 12 });
    for (const falhasEsperadas of [1, 2, 0]) {
      const d = decidir(elevacaoPernas, st, reps(3, 3, 3));
      expect(d.evento?.falha).toBe(true);
      expect(d.novoEstado.reps_alvo).toBe(12);
      expect(d.novoEstado.carga_atual_kg).toBe(0);
      expect(d.novoEstado.falhas_seguidas).toBe(falhasEsperadas);
      expect(d.novoEstado.semana_leve).toBe(false);
      st = d.novoEstado;
    }
  });

  it("§6.2: o aquecimento não conta e a corda não é avaliada", () => {
    const d = decidir(supino, estadoDe(supino, { carga_atual_kg: 25.5 }), [
      { concluida: true, reps: 5, tipo: "aquecimento", carga_kg: 7.5 },
      { concluida: true, reps: 5, tipo: "aquecimento", carga_kg: 15.5 },
      ...reps(8, 8, 8).map((s) => ({ ...s, tipo: "trabalho" as const })),
    ]);
    expect(d.evento?.motivo).toBe("subiu");
    expect(d.novoEstado.carga_atual_kg).toBe(27.5);

    const corda = acharExercicio("salto-basico");
    const nada = decidir(corda, estadoInicial(corda), reps(30, 30, 30));
    expect(nada.evento).toBeNull();
  });
});

/* ==================================================================== */
/* §5 — calendário                                                       */
/* ==================================================================== */

describe("§5.2/§5.3 — o que é hoje", () => {
  it("§5.2: 14/09/2026 é segunda da Fase 1 — Treino A, 6 exercícios, 44 min", () => {
    const hoje = treinoDeHoje("2026-09-14", { ...perfilF1, ultimo_treino: null });
    expect(hoje.tipo).toBe("forca");
    expect(hoje.treinoId).toBe("A1");
    expect(hoje.treino?.exercicios.length).toBe(6);
    expect(hoje.min).toBe(44);
  });

  it("§5.2 item 3: a Fase 1 alterna e a Fase 2 tem treino fixo por dia", () => {
    expect(treinoDeHoje("2026-09-14", { ...perfilF1, ultimo_treino: "A1" }).treinoId).toBe("B1");
    expect(treinoDeHoje("2026-09-14", { ...perfilF1, ultimo_treino: "B1" }).treinoId).toBe("A1");

    const f2: PerfilCalendario = { ...perfilF1, fase_atual: "fase2", ultimo_treino: null };
    const semana = semanaDoPlano("2026-09-14", f2);
    expect(semana.map((d) => d.treinoId)).toEqual(["SA", "IA", null, "SB", "IB", null, null]);
  });

  it("§5.2 itens 4 e 5: cardio da semana do plano e as notas do descanso", () => {
    const semana = semanaDoPlano("2026-09-14", perfilF1);
    expect(semana[1]?.cardio?.corrida?.descricao).toBe("8 × (1 min corrida / 2 min caminhada)");
    expect(semana[1]?.min).toBe(34);
    expect(semana[5]?.cardio?.permiteCorda).toBe(true);
    expect(semana[3]?.nota).toContain("barra fixa");
    expect(semana[6]?.nota).toContain("caminhada");

    // §3.1 + §5.2 item 4: os minutos vêm da semana do plano (cardio.json),
    // não do valor fixo do dia no programa (34 min na terça).
    const s7 = sessaoCardioDeHoje("2026-09-15", { ...perfilF1, semana_corrida: 7 });
    expect(s7?.semana).toBe(7);
    expect(s7?.min).toBe(31);
    const s12 = sessaoCardioDeHoje("2026-09-15", { ...perfilF1, semana_corrida: 12 });
    expect(s12?.min).toBe(45);
    // corda: a semana de corda manda no estágio (sábado aceita as duas)
    const comCorda = sessaoCardioDeHoje("2026-09-19", { ...perfilF1, semana_corda: 5 });
    expect(comCorda?.corda?.semanas).toBe("5–6");
  });

  it("§5.2 item 1 e §5.3: o override vence o programa e entra na alternância", () => {
    const ov: ExcecaoAgenda[] = [
      { data: "2026-09-17", tipo: "forca", workout_id: null, sessao: null },
    ];
    const quinta = treinoDeHoje("2026-09-17", { ...perfilF1, ultimo_treino: "A1" }, ov);
    expect(quinta.tipo).toBe("forca");
    expect(quinta.origem).toBe("override");
    expect(quinta.treinoId).toBe("B1");
    expect(quinta.nota).toBeNull();
    expect(quinta.min).toBe(45);

    const escolhido: ExcecaoAgenda[] = [
      { data: "2026-09-15", tipo: "forca", workout_id: "A1", sessao: null },
    ];
    expect(treinoDeHoje("2026-09-15", perfilF1, escolhido).treinoId).toBe("A1");
  });
});

describe("§5.4 — semana curta", () => {
  it("os treinos protegidos saem dos dados e são exatamente A1, B1, IA e IB", () => {
    expect(treinosComAgachamentoOuTerra().sort()).toEqual(["A1", "B1", "IA", "IB"]);
  });

  it("três dias: corta os dois cardios (sábado primeiro) e mantém os três treinos", () => {
    const semana = semanaDoPlano("2026-09-14", { ...perfilF1, ultimo_treino: "B1" });
    const r = semanaCurta(["ter", "qui", "sab", "dom"], semana);
    expect(r.capacidade).toBe(3);
    expect(r.cortados.map((c) => c.dia)).toEqual(["sab", "ter"]);
    expect(r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "A1",
      "B1",
      "A1",
    ]);
  });

  it("sobrando um dia só, o que fica é o Treino A", () => {
    for (const ultimo of ["A1", "B1"] as TreinoId[]) {
      const semana = semanaDoPlano("2026-09-14", { ...perfilF1, ultimo_treino: ultimo });
      const r = semanaCurta(["ter", "qua", "qui", "sex", "sab", "dom"], semana);
      const restantes = r.dias.filter((d) => d.tipo !== "descanso");
      expect(restantes.length).toBe(1);
      expect(restantes[0]?.treinoId).toBe("A1");
    }
  });

  it("marcar um dia de descanso não corta nada e o remanejamento mantém a alternância", () => {
    const semana = semanaDoPlano("2026-09-14", perfilF1);
    const intacta = semanaCurta(["dom"], semana);
    expect(intacta.cortados).toEqual([]);
    expect(intacta.dias.map((d) => d.treinoId)).toEqual(semana.map((d) => d.treinoId));

    const seg = semanaCurta(["seg"], semana);
    expect(seg.cortados).toEqual([]);
    const treinos = seg.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId);
    expect(treinos.length).toBe(3);
    expect(treinos[0]).not.toBe(treinos[1]);
    expect(treinos[1]).not.toBe(treinos[2]);
  });

  it("ACHADO C — §5.2 item 1: a semana curta não pode reescrever um treino escolhido no override", () => {
    // §5.2 item 1: "Se existe `schedule_overrides` para a data → vale ele."
    // O dia nem é remanejado nem cortado: só `realinharAlternancia` passa por
    // cima do workout_id que o usuário escolheu (e da duração do treino).
    const ov: ExcecaoAgenda[] = [
      { data: "2026-09-16", tipo: "forca", workout_id: "B1", sessao: null },
    ];
    const semana = semanaDoPlano("2026-09-14", perfilF1, ov);
    const quartaPlanejada = semana[2];
    expect(quartaPlanejada?.treinoId).toBe("B1");
    expect(quartaPlanejada?.origem).toBe("override");

    for (const marcados of [[], ["sab"], ["dom"], ["qui"]] as const) {
      const r = semanaCurta([...marcados] as never, semana);
      const quarta = r.dias.find((d) => d.dia === "qua");
      expect(`${marcados.join(",") || "nenhum"} → ${quarta?.treinoId}`).toBe(
        `${marcados.join(",") || "nenhum"} → B1`,
      );
      expect(quarta?.min).toBe(45);
    }
  });

  it("Fase 2: corta os cardios e depois o superior, nunca IA nem IB", () => {
    const f2: PerfilCalendario = { ...perfilF1, fase_atual: "fase2", ultimo_treino: null };
    const semana = semanaDoPlano("2026-09-14", f2);
    const r = semanaCurta(["seg", "ter", "qui", "dom"], semana);
    const ficaram = r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId);
    expect(ficaram).toContain("IA");
    expect(ficaram).toContain("IB");
    expect(r.cortados.some((c) => c.treinoId === "SB")).toBe(true);
  });
});

describe("§5.5 e §5.1 — semanas dos planos e a Fase 2", () => {
  it("§5.5: 2 sessões avançam, 1 e 0 repetem, e o plano para na semana 12", () => {
    for (const avancar of [avancarSemanaDeCorrida, avancarSemanaDeCorda, avancarSemanaDeBarraFixa]) {
      expect(avancar(5, 0)).toBe(5);
      expect(avancar(5, 1)).toBe(5);
      expect(avancar(5, 2)).toBe(6);
      expect(avancar(5, 3)).toBe(6);
      expect(avancar(12, 2)).toBe(12);
    }
  });

  it("§5.1: a Fase 2 exige 12 semanas civis E 30 sessões, e o adiamento silencia 2 semanas", () => {
    const perfil: PerfilCalendario = { fase_atual: "fase1", ultimo_treino: null, fase_desde: "2026-09-14" };
    expect(sugerirFase2(perfil, 30, "2026-12-06").sugerir).toBe(false); // 11 semanas
    expect(sugerirFase2(perfil, 29, "2026-12-07").sugerir).toBe(false); // 29 sessões
    expect(sugerirFase2(perfil, 30, "2026-12-07").sugerir).toBe(true);

    const ate = adiarFase2("2026-12-07");
    expect(ate).toBe("2026-12-21");
    const adiado: PerfilCalendario = { ...perfil, prefs: { fase2_adiada_ate: ate } };
    expect(sugerirFase2(adiado, 30, "2026-12-14").sugerir).toBe(false);
    expect(sugerirFase2(adiado, 30, "2026-12-21").sugerir).toBe(true);

    // na Fase 2 o app não sugere a Fase 2
    expect(sugerirFase2({ ...perfil, fase_atual: "fase2" }, 99, "2027-06-01").sugerir).toBe(false);
  });
});

/* ==================================================================== */
/* pureza                                                                */
/* ==================================================================== */

describe("motor puro", () => {
  it("decidir não altera o estado nem as séries recebidas e é determinístico", () => {
    const st = estadoDe(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 });
    const copia = structuredClone(st);
    const series = reps(1, 1, 1);
    const copiaSeries = structuredClone(series);
    const a = decidir(supino, st, series);
    const b = decidir(supino, st, series);
    expect(st).toEqual(copia);
    expect(series).toEqual(copiaSeries);
    expect(a).toEqual(b);
  });

  it("alcancavelParaBaixo é idempotente em toda a escala de todo implemento", () => {
    for (const ex of exercicios) {
      for (const carga of cargasPossiveis(ex.implemento)) {
        expect(alcancavelParaBaixo(carga, ex.implemento)).toBe(carga);
      }
    }
  });
});
