/**
 * AUDITORIA ADVERSARIAL — lente "spec" (rodadas 4 e 5).
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
 * ---------------------------------------------------------------------
 * RODADA 5 (as seções marcadas "rodada 5" no fim do arquivo): releitura
 * completa da §5, da §6 e dos 22 casos do documento, procurando regra sem
 * teste. O ataque:
 *  - qualquer linha de `exercise_state` vinda do banco (importada, editada à
 *    mão ou gravada antes de o Miguel pesar a barra W, §3.9) tem que sair de
 *    `cargaDeHoje` como uma carga MONTÁVEL (§6.4, §6.5, §10.5) — inclusive na
 *    semana leve;
 *  - o aviso de teto (§6.4) confrontado com um override de incremento (§3.9)
 *    em todos os implementos;
 *  - o toggle "última firme" no tipo `maximo` (§6.2/§6.3);
 *  - `schedule_overrides` na Fase 2 (§5.2 item 1, §5.3);
 *  - invariantes da semana curta nas 128 combinações de dias (§5.4);
 *  - o teto das semanas dos planos (§5.5).
 *
 * O achado desta rodada está no teste marcado "ACHADO D":
 *  D — §6.4/§6.5/§10.5 + §3.9: na semana leve `cargaDeHoje()` calcula os 60 %
 *      a partir do valor CRU de `carga_antes_leve`, sem projetar na escala do
 *      implemento como `decidir()` faz desde a rodada 4 — a tela pede uma carga
 *      que não se monta e diverge do que o motor gravou.
 *
 * ---------------------------------------------------------------------
 * RODADA 6 (as seções marcadas "rodada 6" no fim do arquivo): nova releitura
 * da §5, da §6 e dos 22 casos do documento, agora atrás das regras que só
 * tinham exemplo — e re-verificando as correções da rodada 5. O ataque troca o
 * exemplo pela PROPRIEDADE:
 *  - §6.2 como escala ordenada: uma repetição a mais nunca pode piorar a
 *    decisão nem a carga, em todo o catálogo, com e sem "última firme";
 *  - a escada de falhas inteira (1ª · 2ª −10 % · 3ª semana leve · volta com o
 *    incremento cheio) rodada em TODO exercício de progressão por carga, com os
 *    números conferidos contra a escala de cada implemento (§6.2 + §6.4);
 *  - a graça do elástico medida em sessões (§6.3, casos 13 e 14);
 *  - toda carga de toda escala montada contra o estoque real de anilhas
 *    (§6.4 + §6.5), inclusive com a barra W já pesada (§3.9);
 *  - a ordem de sacrifício da §5.4 como prefixo, nas 128 combinações de dias e
 *    nas duas fases, e a alternância da §5.2 item 3 atravessando a virada da
 *    semana (a correção da rodada 5 que ainda não tinha sido re-verificada);
 *  - a cadeia tela × motor com `pesoBarra` em 24 sessões (§6.1 + §6.6).
 * Nenhum achado: as oito propriedades passam no motor como ele está.
 *
 * Nada aqui é código de produção.
 */
import { describe, expect, it } from "vitest";
import {
  acharExercicio,
  acharTreino,
  anilhasDisponiveis,
  DIAS,
  exercicios,
} from "@/lib/dados";
import {
  alcancavelParaBaixo,
  capacidadeDoImplemento,
  cargaMaxima,
  cargasPossiveis,
  limiteDoImplemento,
  montagem,
  type ImplementoMontagem,
} from "@/lib/montagem";
import {
  cargaDeHoje,
  decidir,
  estadoInicial,
  incrementoDe,
  PASSO_MINIMO_KG,
  prescricaoDoTreino,
  prescricaoPadrao,
  SESSOES_DE_GRACA,
  type Alvo,
  type Decisao,
  type EstadoExercicio,
  type SerieFeita,
} from "@/lib/progressao";
import {
  adiarFase2,
  avancarSemanaCardio,
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
import type { DiaSemana, Exercicio, TreinoId } from "@/lib/schemas";

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

/* ==================================================================== */
/* RODADA 5 — §6.4/§6.5/§10.5: a carga do dia é sempre montável          */
/* ==================================================================== */

describe("rodada 5 · §6.1 × §6.4 — qualquer linha do banco vira carga montável", () => {
  /** Valores plausíveis de `exercise_state.carga_atual_kg` vindos do banco. */
  const DO_BANCO: (number | null)[] = [null, -3, 0, 1.3, 5, 26.5, 100_000];

  it("§6.4/§6.5/§10.5: cargaDeHoje projeta na escala toda carga_atual_kg", () => {
    const fora: string[] = [];
    for (const ex of exercicios) {
      const escala = cargasPossiveis(ex.implemento);
      for (const v of DO_BANCO) {
        const hoje = cargaDeHoje(ex, estadoDe(ex, { carga_atual_kg: v }));
        if (hoje.carga_kg === null) continue;
        if (!escala.includes(hoje.carga_kg) || hoje.montagem?.exato !== true) {
          fora.push(`${ex.id} @ ${v} → ${hoje.carga_kg}`);
        }
      }
    }
    expect(fora).toEqual([]);
  });

  it("ACHADO D — §3.9/§6.4/§6.5/§10.5: na semana leve a tela pede uma carga que não se monta", () => {
    /*
     * Cenário da §3.9: a barra W está no JSON com `peso_kg: null` ("pesar na
     * balança e anotar no perfil"). Enquanto não é pesada vale 2,0 kg; depois
     * de pesada (4,8 kg) a escala passa a ser 4,8 · 6,8 · … e a linha gravada
     * antes fica ABAIXO dela. `decidir()` projeta `carga_antes_leve` na escala
     * desde a rodada 4; `cargaDeHoje()` calcula os 60 % com o valor cru.
     *
     * SPEC §6.4 ("arredondar(x) = a carga possível mais próxima para baixo na
     * escala do implemento"), §10.5 ("o motor só propõe cargas alcançáveis") e
     * §6.6 (a tela mostra a decisão gravada).
     */
    const opcoes = { pesoBarra: 4.8 };
    const naLeve = estadoDe(roscaW, {
      semana_leve: true,
      carga_antes_leve: 2,
      carga_atual_kg: 2,
    });

    const tela = cargaDeHoje(roscaW, naLeve, undefined, opcoes);
    expect(cargasPossiveis("barra_w", opcoes)).toContain(tela.carga_kg);
    expect(tela.montagem?.exato).toBe(true);
    // §6.5: quando não fecha, a diferença é para baixo — nunca pedir 2 kg e
    // montar 4,8 kg.
    expect(tela.montagem?.diferenca ?? 0).toBeLessThanOrEqual(0);

    // §6.6: o que a tela pede e o que o motor grava têm que ser a mesma carga.
    const fim = decidir(roscaW, naLeve, reps(12, 12, 12), { montagem: opcoes });
    expect(fim.evento?.motivo).toBe("fim_semana_leve");
    expect(tela.carga_kg).toBe(4.8);
    expect(fim.novoEstado.carga_atual_kg).toBe(4.8);

    // O mesmo com uma linha da barra maciça abaixo da barra vazia (backup
    // importado, §9): 60 % de 5 kg não existe — a tela tem que cair na escala.
    const antiga = estadoDe(supino, {
      semana_leve: true,
      carga_antes_leve: 5,
      carga_atual_kg: 5,
    });
    const telaAntiga = cargaDeHoje(supino, antiga);
    expect(cargasPossiveis("barra_macica")).toContain(telaAntiga.carga_kg);
    expect(telaAntiga.montagem?.exato).toBe(true);

    // E uma linha acima do teto do kit: o motor trabalha com 107,5 (§6.4), logo
    // a semana leve é 60 % de 107,5 = 64,5 → 63,5 — não 60 % de 120.
    const acima = estadoDe(supino, {
      semana_leve: true,
      carga_antes_leve: 120,
      carga_atual_kg: 63.5,
    });
    expect(cargaDeHoje(supino, acima).carga_kg).toBe(63.5);
  });

  it("§6.6: em qualquer cadeia de sessões a tela pede exatamente a carga gravada", () => {
    const erros: string[] = [];
    for (const ex of exercicios) {
      if (ex.progressao.tipo !== "carga") continue;
      const presc = prescricaoPadrao(ex);
      if (presc.tipo === "ver_cardio_corda") continue;
      const escala = cargasPossiveis(ex.implemento);
      const topo = presc.max ?? presc.min ?? 10;
      const piso = presc.min ?? topo;
      let estado = estadoInicial(ex, presc);
      // 24 sessões alternando falha (abaixo do piso) e sucesso (acima do topo):
      // passa por −10 %, semana leve, volta e subidas.
      for (let i = 0; i < 24; i++) {
        const valor = i % 3 === 0 ? Math.max(0, piso - 2) : topo + 1;
        estado = decidir(ex, estado, sessaoDe(presc, valor), { prescricao: presc }).novoEstado;
        const hoje = cargaDeHoje(ex, estado, presc);
        if (hoje.carga_kg !== estado.carga_atual_kg) {
          erros.push(`${ex.id}#${i}: tela ${hoje.carga_kg} × estado ${estado.carga_atual_kg}`);
        }
        if (estado.carga_atual_kg !== null && !escala.includes(estado.carga_atual_kg)) {
          erros.push(`${ex.id}#${i}: ${estado.carga_atual_kg} fora da escala`);
        }
      }
    }
    expect(erros).toEqual([]);
  });

  it("§6.2/§6.4: semana leve no teto e no piso da escala — e o retorno à carga de antes", () => {
    // no teto: 60 % de 107,5 = 64,5 → 63,5 (alcançável para baixo)
    const noTeto = estadoDe(supino, { carga_atual_kg: 107.5, falhas_seguidas: 2 });
    const leve = decidir(supino, noTeto, reps(2, 2, 2));
    expect(leve.evento?.motivo).toBe("semana_leve_60");
    expect(leve.novoEstado.carga_antes_leve).toBe(107.5);
    expect(leve.novoEstado.carga_atual_kg).toBe(63.5);
    const tela = cargaDeHoje(supino, leve.novoEstado);
    expect(tela.carga_kg).toBe(63.5);
    expect(tela.montagem?.exato).toBe(true);

    const fim = decidir(supino, leve.novoEstado, reps(8, 8, 8));
    expect(fim.evento?.motivo).toBe("fim_semana_leve");
    expect(fim.novoEstado.carga_atual_kg).toBe(107.5);
    // de volta ao teto, a sessão perfeita avisa em vez de inventar carga (§6.4)
    const outra = decidir(supino, fim.novoEstado, reps(8, 8, 8));
    expect(outra.evento?.motivo).toBe("repetiu");
    expect(outra.evento?.aviso).toBe("faltam anilhas de 10 kg (marco do guia)");

    // no piso: 60 % de 7,5 cairia abaixo da barra vazia — reduzir nunca sobe
    const noPiso = estadoDe(supino, { carga_atual_kg: 7.5, falhas_seguidas: 2 });
    const levePiso = decidir(supino, noPiso, reps(2, 2, 2));
    expect(levePiso.novoEstado.carga_atual_kg).toBe(7.5);
    expect(cargaDeHoje(supino, levePiso.novoEstado).carga_kg).toBe(7.5);
    expect(decidir(supino, levePiso.novoEstado, reps(8, 8, 8)).novoEstado.carga_atual_kg).toBe(7.5);

    // halter no teto: 60 % de 39,5 = 23,7 → 23,5 por halter
    const rosca = acharExercicio("rosca-alternada");
    const halter = decidir(rosca, estadoDe(rosca, { carga_atual_kg: 39.5, falhas_seguidas: 2 }), reps(2, 2, 2));
    expect(halter.novoEstado.carga_atual_kg).toBe(23.5);
    expect(cargasPossiveis("halteres")).toContain(halter.novoEstado.carga_atual_kg);
  });
});

/* ==================================================================== */
/* RODADA 5 — §6.4 × §3.9: teto do kit contra o override de incremento   */
/* ==================================================================== */

describe("rodada 5 · §6.4 — aviso de teto e override de incremento", () => {
  it("no topo da escala o aviso combina com o que segura o implemento, em todo o catálogo", () => {
    const erros: string[] = [];
    for (const ex of exercicios) {
      if (ex.progressao.tipo !== "carga") continue;
      const presc = prescricaoPadrao(ex);
      if (presc.tipo === "ver_cardio_corda") continue;
      const teto = cargaMaxima(ex.implemento);
      const d = decidir(ex, estadoDe(ex, { carga_atual_kg: teto }), sessaoDe(presc, presc.max ?? presc.min ?? 10));
      if (d.evento?.motivo !== "repetiu") {
        erros.push(`${ex.id}: subiu acima do teto ${teto}`);
        continue;
      }
      expect(d.novoEstado.carga_atual_kg).toBe(teto);
      const aviso = d.evento.aviso ?? "";
      if (limiteDoImplemento(ex.implemento) === "estoque") {
        if (aviso !== "faltam anilhas de 10 kg (marco do guia)") erros.push(`${ex.id}: "${aviso}"`);
      } else {
        const capacidade = String(capacidadeDoImplemento(ex.implemento)).replace(".", ",");
        if (!aviso.includes(`capacidade ${capacidade} kg`) || aviso.includes("anilhas de 10 kg")) {
          erros.push(`${ex.id}: "${aviso}"`);
        }
      }
    }
    expect(erros).toEqual([]);
  });

  it("§3.9: o override de incremento não fura o teto nem inventa falta de anilha", () => {
    // um passo grande perto do teto para NO teto (arredonda para baixo, §6.4)
    const quase = decidir(supino, estadoDe(supino, { carga_atual_kg: 105.5, incremento_kg: 10 }), reps(8, 8, 8));
    expect(quase.evento?.motivo).toBe("subiu");
    expect(quase.novoEstado.carga_atual_kg).toBe(107.5);
    expect(quase.evento?.aviso).toBeUndefined();

    // no teto, com override grande: é falta de anilha mesmo
    const noTeto = decidir(supino, estadoDe(supino, { carga_atual_kg: 107.5, incremento_kg: 10 }), reps(8, 8, 8));
    expect(noTeto.evento?.aviso).toBe("faltam anilhas de 10 kg (marco do guia)");

    // halter e barra W travam na capacidade da barra, não no estoque
    const rosca = acharExercicio("rosca-alternada");
    const halter = decidir(rosca, estadoDe(rosca, { carga_atual_kg: 39.5, incremento_kg: 10 }), reps(12, 12, 12));
    expect(halter.evento?.aviso).toContain("capacidade 40 kg");
    expect(halter.evento?.aviso).not.toContain("anilhas de 10 kg");
    const w = decidir(roscaW, estadoDe(roscaW, { carga_atual_kg: cargaMaxima("barra_w") }), reps(12, 12, 12));
    expect(w.evento?.aviso).toContain("capacidade 50 kg");

    // longe do teto, um incremento menor que o passo é problema de incremento
    for (const incremento of [0, 1, 1.5]) {
      const curto = decidir(supino, estadoDe(supino, { carga_atual_kg: 25.5, incremento_kg: incremento }), reps(8, 8, 8));
      expect(curto.evento?.motivo).toBe("repetiu");
      expect(curto.novoEstado.carga_atual_kg).toBe(25.5);
      expect(curto.evento?.aviso).toBeUndefined();
      expect(curto.evento?.sugestao).toContain("incremento");
    }
  });
});

/* ==================================================================== */
/* RODADA 5 — §6.2/§6.3: o toggle "última firme" no tipo `maximo`        */
/* ==================================================================== */

describe("rodada 5 · §6.2/§6.3 — `maximo` com ultima_firme = false", () => {
  it("sem o toggle não sobe, não grava média nova e não vira falha", () => {
    const base = estadoDe(pronada, { reps_alvo: 4 });
    const semFirme = decidir(pronada, base, reps(9, 9, 9), {
      seriesAnteriores: [4, 4, 4],
      ultimaFirme: false,
    });
    expect(semFirme.evento?.motivo).toBe("repetiu");
    expect(semFirme.evento?.falha).toBeUndefined();
    expect(semFirme.novoEstado.reps_alvo).toBe(4);

    const comFirme = decidir(pronada, base, reps(9, 9, 9), {
      seriesAnteriores: [4, 4, 4],
      ultimaFirme: true,
    });
    expect(comFirme.evento?.motivo).toBe("subiu");
    expect(comFirme.novoEstado.reps_alvo).toBe(9);

    // flexão (progressão por reps, sem lastro) segue a mesma regra
    const f = decidir(flexao, estadoDe(flexao, { reps_alvo: 6 }), reps(8, 8, 8), {
      seriesAnteriores: [6, 6, 6],
      ultimaFirme: false,
    });
    expect(f.evento?.motivo).toBe("repetiu");
    expect(f.novoEstado.reps_alvo).toBe(6);

    // queda de média continua falha com ou sem o toggle (§6.2)
    const caiu = decidir(pronada, base, reps(2, 2, 2), {
      seriesAnteriores: [4, 4, 4],
      ultimaFirme: false,
    });
    expect(caiu.evento?.falha).toBe(true);
  });

  it("§6.3: a sugestão do lastro não depende do toggle", () => {
    const d = decidir(pronada, estadoDe(pronada, { reps_alvo: 9 }), reps(10, 10, 10), {
      seriesAnteriores: [9, 9, 9],
      ultimaFirme: false,
    });
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.sugestao).toContain("lastro");
  });
});

/* ==================================================================== */
/* RODADA 5 — §5.2/§5.3: schedule_overrides na Fase 2                    */
/* ==================================================================== */

describe("rodada 5 · §5.2 item 1 — overrides na Fase 2", () => {
  const f2: PerfilCalendario = {
    ...perfilF1,
    fase_atual: "fase2",
    ultimo_treino: "IA",
  };

  it("cardio no lugar de um treino fixo: semana do plano, minutos do cardio, sem nota e sem treino", () => {
    const ov: ExcecaoAgenda[] = [
      { data: "2026-09-14", tipo: "cardio", workout_id: null, sessao: "corrida" },
    ];
    const seg = treinoDeHoje("2026-09-14", f2, ov); // era SA, 54 min
    expect(seg.tipo).toBe("cardio");
    expect(seg.origem).toBe("override");
    expect(seg.treinoId).toBeNull();
    expect(seg.treino).toBeNull();
    expect(seg.cardio?.semana).toBe(1);
    expect(seg.min).toBe(34); // sessao_min da semana 1 (cardio.json), não os 54
    expect(seg.nota).toBeNull();
  });

  it("descanso no lugar de um treino fixo esvazia o dia", () => {
    const ov: ExcecaoAgenda[] = [
      { data: "2026-09-15", tipo: "descanso", workout_id: null, sessao: null },
    ];
    const ter = treinoDeHoje("2026-09-15", f2, ov); // era IA
    expect(ter.tipo).toBe("descanso");
    expect(ter.treinoId).toBeNull();
    expect(ter.cardio).toBeNull();
    expect(ter.min).toBeNull();
  });

  it("§5.3: força sem workout_id num dia de cardio vale o próximo treino da fase", () => {
    const ov: ExcecaoAgenda[] = [
      { data: "2026-09-16", tipo: "forca", workout_id: null, sessao: null },
    ];
    const qua = treinoDeHoje("2026-09-16", f2, ov); // quarta é cardio na Fase 2
    expect(qua.tipo).toBe("forca");
    expect(qua.treinoId).toBe("SB"); // o próximo depois de IA
    expect(qua.treino?.id).toBe("SB");
    expect(qua.treinoEscolhido).toBe(false);
    expect(qua.min).toBe(54);
    expect(qua.nota).toBeNull();
  });

  it("força com workout_id escolhido manda no dia e na semana", () => {
    const ov: ExcecaoAgenda[] = [
      { data: "2026-09-16", tipo: "forca", workout_id: "IB", sessao: null },
    ];
    const qua = treinoDeHoje("2026-09-16", f2, ov);
    expect(qua.treinoId).toBe("IB");
    expect(qua.treinoEscolhido).toBe(true);
    expect(qua.min).toBe(46);

    const semana = semanaDoPlano("2026-09-14", f2, ov);
    expect(semana.map((d) => d.treinoId)).toEqual(["SA", "IA", "IB", "SB", "IB", null, null]);
  });
});

/* ==================================================================== */
/* RODADA 5 — §5.4: invariantes da semana curta em todas as combinações  */
/* ==================================================================== */

describe("rodada 5 · §5.4 — semana curta: invariantes nas 128 combinações", () => {
  const COMBINACOES: DiaSemana[][] = Array.from({ length: 128 }, (_, mascara) =>
    DIAS.filter((_d, i) => (mascara >> i) & 1),
  );

  const perfis: PerfilCalendario[] = [
    { ...perfilF1, ultimo_treino: "A1" },
    { ...perfilF1, ultimo_treino: "B1" },
    { ...perfilF1, fase_atual: "fase2", ultimo_treino: null },
  ];

  it("dia marcado fica livre, a capacidade é respeitada e nada some pelo caminho", () => {
    const erros: string[] = [];
    const protegidos = treinosComAgachamentoOuTerra();
    for (const perfil of perfis) {
      const semana = semanaDoPlano("2026-09-14", perfil);
      const atividades = semana.filter((d) => d.tipo !== "descanso").length;
      for (const marcados of COMBINACOES) {
        const r = semanaCurta(marcados, semana);
        const rotulo = `${perfil.fase_atual}/${perfil.ultimo_treino}/[${marcados.join(",")}]`;
        const ficaram = r.dias.filter((d) => d.tipo !== "descanso");

        // §5.4: "não vou treinar hoje" — o dia marcado não pode receber nada
        for (const d of r.dias) {
          if (marcados.includes(d.dia) && d.tipo !== "descanso") {
            erros.push(`${rotulo}: ${d.dia} marcado continuou ${d.tipo}`);
          }
        }
        if (ficaram.length > r.capacidade) erros.push(`${rotulo}: ${ficaram.length} > ${r.capacidade}`);
        if (ficaram.length + r.cortados.length !== atividades) {
          erros.push(`${rotulo}: ${ficaram.length}+${r.cortados.length} ≠ ${atividades}`);
        }
        // nunca cortar agachamento/terra enquanto sobrar outra coisa para cortar
        const cortouProtegido = r.cortados.some(
          (c) => c.tipo === "forca" && protegidos.includes(c.treinoId as TreinoId),
        );
        if (cortouProtegido) {
          const sobrouCortavel = ficaram.some(
            (d) => d.tipo === "cardio" || !protegidos.includes(d.treinoId as TreinoId),
          );
          if (sobrouCortavel) erros.push(`${rotulo}: cortou protegido com cortável de sobra`);
        }
        // todo dia de força que ficou tem treino e duração
        for (const d of ficaram) {
          if (d.tipo !== "forca") continue;
          if (!d.treinoId || !d.treino) erros.push(`${rotulo}: ${d.dia} de força sem treino`);
          else if (d.min !== d.treino.duracao_min) {
            erros.push(`${rotulo}: ${d.dia} ${d.treinoId} com ${d.min} min`);
          }
        }
      }
    }
    expect(erros).toEqual([]);
  });

  it("§5.2 item 3: a Fase 1 nunca deixa dois treinos iguais seguidos e sobrando um dia é o Treino A", () => {
    const erros: string[] = [];
    for (const ultimo of ["A1", "B1"] as TreinoId[]) {
      const semana = semanaDoPlano("2026-09-14", { ...perfilF1, ultimo_treino: ultimo });
      for (const marcados of COMBINACOES) {
        const r = semanaCurta(marcados, semana);
        const treinos = r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId);
        const rotulo = `${ultimo}/[${marcados.join(",")}]`;
        for (let i = 1; i < treinos.length; i++) {
          if (treinos[i] === treinos[i - 1]) erros.push(`${rotulo}: ${treinos.join(",")}`);
        }
        if (treinos.length === 1 && treinos[0] !== "A1") {
          erros.push(`${rotulo}: sobrou ${treinos[0]} em vez do Treino A`);
        }
      }
    }
    expect(erros).toEqual([]);
  });
});

/* ==================================================================== */
/* RODADA 5 — §5.5: o teto das semanas dos planos                        */
/* ==================================================================== */

describe("rodada 5 · §5.5 — avanço das semanas no teto do plano", () => {
  it("fazer as 2 sessões nunca vale menos que não fazer nenhuma", () => {
    const avancos = [avancarSemanaDeCorrida, avancarSemanaDeCorda, avancarSemanaDeBarraFixa];
    for (const avancar of avancos) {
      for (let semana = 1; semana <= 15; semana++) {
        expect(avancar(semana, 2)).toBeGreaterThanOrEqual(avancar(semana, 0));
        expect(avancar(semana, 0)).toBe(semana);
        expect(avancar(semana, 1)).toBe(semana);
        // uma semana por vez, no máximo
        expect(avancar(semana, 9)).toBeLessThanOrEqual(semana + 1);
      }
      // o plano tem 12 semanas: no teto e acima dele a semana não anda nem volta
      expect(avancar(12, 2)).toBe(12);
      expect(avancar(13, 2)).toBe(13);
      expect(avancar(20, 2)).toBe(20);
    }
  });

  it("avancarSemanaCardio: o teto segura o avanço e nunca puxa para trás", () => {
    expect(avancarSemanaCardio(5, 2)).toBe(6); // sem teto
    expect(avancarSemanaCardio(12, 2, { maximo: 12 })).toBe(12);
    expect(avancarSemanaCardio(13, 2, { maximo: 12 })).toBe(13);
    expect(avancarSemanaCardio(3, 1, { exigidas: 1 })).toBe(4);
  });
});


/* ==================================================================== */
/* RODADA 6 — releitura da §5, da §6 e dos 22 casos procurando REGRA     */
/* sem teste: propriedades varridas em vez de exemplos                   */
/* ==================================================================== */

/**
 * O posto de uma decisão na escala da §6.2 (Sucesso > Manteve > Falha).
 * `fim_semana_leve` e uma sessão sem evento não mexem no alvo: valem "manteve".
 */
function posto(d: Decisao): number {
  const e = d.evento;
  if (e === null) return 2;
  if (e.motivo === "subiu") return 3;
  if (e.motivo === "semana_leve_60") return 0;
  if (e.motivo === "falha_2x_voltou_10") return 1;
  return e.falha ? 1 : 2;
}

describe("rodada 6 · §6.2 — Sucesso > Manteve > Falha é monótono no esforço", () => {
  it("uma repetição a mais nunca piora a decisão nem a carga, em todo o catálogo", () => {
    /*
     * SPEC §6.2 classifica a sessão por comparação com a faixa: sucesso exige
     * o topo em todas as séries, falha é alguma abaixo do piso. Logo a decisão
     * tem que ser MONÓTONA — fazer mais repetições (ou mais segundos, ou mais
     * passos) não pode devolver um resultado pior nem uma carga menor. Vale
     * também no tipo `maximo` (§6.3: "melhorar a média").
     */
    const erros: string[] = [];
    for (const ex of exercicios) {
      const presc = prescricaoPadrao(ex);
      if (presc.tipo === "ver_cardio_corda") continue;
      const estados: (EstadoExercicio | null)[] = [
        null,
        estadoDe(ex),
        estadoDe(ex, { falhas_seguidas: 1 }),
        estadoDe(ex, { falhas_seguidas: 2 }),
        estadoDe(ex, { incremento_reduzido: true, exigir_rep_extra: true }),
        estadoDe(ex, { sessoes_graca: SESSOES_DE_GRACA }),
      ];
      for (const estado of estados) {
        for (const anteriores of [null, [5, 5, 5], [10, 10, 10]]) {
          for (const ultimaFirme of [true, false]) {
            for (let v = 0; v <= 22; v++) {
              const ctx = { prescricao: presc, ultimaFirme, seriesAnteriores: anteriores };
              const menos = decidir(ex, estado, sessaoDe(presc, v), ctx);
              const mais = decidir(ex, estado, sessaoDe(presc, v + 1), ctx);
              if (posto(mais) < posto(menos)) {
                erros.push(
                  `${ex.id} @ ${v}→${v + 1} (firme ${ultimaFirme}): ${menos.evento?.motivo} → ${mais.evento?.motivo}`,
                );
              }
              if ((mais.novoEstado.carga_atual_kg ?? 0) < (menos.novoEstado.carga_atual_kg ?? 0)) {
                erros.push(
                  `${ex.id} @ ${v}→${v + 1}: carga ${menos.novoEstado.carga_atual_kg} → ${mais.novoEstado.carga_atual_kg}`,
                );
              }
            }
          }
        }
      }
    }
    expect([...new Set(erros)]).toEqual([]);
  });
});

describe("rodada 6 · §6.2/§6.4 — a escada de falhas inteira, exercício por exercício", () => {
  it("1ª repete · 2ª −10 % com meio incremento · 3ª semana leve · volta com o incremento cheio", () => {
    /*
     * SPEC §6.2 (as três falhas), §6.4 (`arredondar` para baixo) e a regra
     * derivada do doc ("incremento reduzido = max(incremento / 2, passo
     * mínimo)"; "volta ao incremento normal na próxima subida"). Os casos 4–9
     * do documento fazem isso em três exercícios; aqui a escada inteira roda em
     * TODOS os exercícios de progressão por carga do catálogo, com os números
     * conferidos contra a escala real de cada implemento.
     */
    const erros: string[] = [];
    for (const ex of exercicios) {
      if (ex.progressao.tipo !== "carga") continue;
      const presc = prescricaoPadrao(ex);
      if (presc.tipo === "ver_cardio_corda") continue;
      const escala = cargasPossiveis(ex.implemento);
      const partida = escala[Math.floor(escala.length / 2)] ?? 0;
      if (partida <= 0) continue;
      const incremento = ex.progressao.incremento_kg ?? 0;
      const piso = presc.min ?? 1;
      const topo = presc.max ?? piso;
      const ruim = sessaoDe(presc, Math.max(0, piso - 1));
      const otima = sessaoDe(presc, topo + 1);
      const ctx = { prescricao: presc };
      const conta = (rotulo: string, ok: boolean, detalhe: string) => {
        if (!ok) erros.push(`${ex.id} ${rotulo}: ${detalhe}`);
      };

      // 1ª falha: repete a mesma carga, marcada como falha
      const f1 = decidir(ex, estadoDe(ex, { carga_atual_kg: partida }), ruim, ctx);
      conta(
        "1ª falha",
        f1.evento?.motivo === "repetiu" &&
          f1.evento.falha === true &&
          f1.novoEstado.carga_atual_kg === partida &&
          f1.novoEstado.falhas_seguidas === 1,
        `${f1.evento?.motivo} carga ${f1.novoEstado.carga_atual_kg} falhas ${f1.novoEstado.falhas_seguidas}`,
      );

      // 2ª falha: −10 % alcançável para baixo, incremento pela metade
      const f2 = decidir(ex, f1.novoEstado, ruim, ctx);
      const menos10 = Math.min(partida, alcancavelParaBaixo(partida * 0.9, ex.implemento));
      conta(
        "2ª falha",
        f2.evento?.motivo === "falha_2x_voltou_10" &&
          f2.novoEstado.carga_atual_kg === menos10 &&
          f2.novoEstado.incremento_reduzido === true &&
          f2.novoEstado.falhas_seguidas === 2,
        `${f2.evento?.motivo} carga ${f2.novoEstado.carga_atual_kg} (esperado ${menos10})`,
      );
      conta(
        "incremento reduzido",
        incrementoDe(ex, f2.novoEstado) === Math.max(incremento / 2, PASSO_MINIMO_KG),
        `${incrementoDe(ex, f2.novoEstado)} kg com incremento ${incremento}`,
      );
      // a rep extra só existe quando a metade cai abaixo do passo mínimo (caso 5
      // sim, caso 6 não)
      conta(
        "exigir_rep_extra",
        f2.novoEstado.exigir_rep_extra === incremento / 2 < PASSO_MINIMO_KG,
        `${f2.novoEstado.exigir_rep_extra} com incremento ${incremento}`,
      );

      // 3ª falha: semana leve a 60 %, guardando a carga de antes
      const f3 = decidir(ex, f2.novoEstado, ruim, ctx);
      const antesLeve = f2.novoEstado.carga_atual_kg ?? 0;
      const leve = Math.min(antesLeve, alcancavelParaBaixo(antesLeve * 0.6, ex.implemento));
      conta(
        "3ª falha",
        f3.evento?.motivo === "semana_leve_60" &&
          f3.novoEstado.semana_leve === true &&
          f3.novoEstado.carga_atual_kg === leve &&
          f3.novoEstado.carga_antes_leve === antesLeve &&
          f3.novoEstado.falhas_seguidas === 0,
        `${f3.evento?.motivo} carga ${f3.novoEstado.carga_atual_kg} (esperado ${leve}) antes ${f3.novoEstado.carga_antes_leve}`,
      );
      // a tela da semana leve pede exatamente a carga gravada (§6.6)
      conta(
        "tela da semana leve",
        cargaDeHoje(ex, f3.novoEstado, presc).carga_kg === leve,
        `${cargaDeHoje(ex, f3.novoEstado, presc).carga_kg} × ${leve}`,
      );

      // a sessão da semana leve devolve a carga de antes, com o incremento cheio
      const volta = decidir(ex, f3.novoEstado, otima, ctx);
      conta(
        "fim da semana leve",
        volta.evento?.motivo === "fim_semana_leve" &&
          volta.novoEstado.carga_atual_kg === antesLeve &&
          volta.novoEstado.incremento_reduzido === false &&
          volta.novoEstado.exigir_rep_extra === false,
        `${volta.evento?.motivo} carga ${volta.novoEstado.carga_atual_kg} (esperado ${antesLeve})`,
      );
      const subida = decidir(ex, volta.novoEstado, otima, ctx);
      conta(
        "subida depois da semana leve",
        subida.novoEstado.carga_atual_kg ===
          alcancavelParaBaixo(antesLeve + incremento, ex.implemento),
        `${subida.evento?.motivo} carga ${subida.novoEstado.carga_atual_kg}`,
      );
    }
    expect(erros).toEqual([]);
  });
});

describe("rodada 6 · §6.3 — a graça do elástico dura exatamente duas sessões", () => {
  it("as duas primeiras quedas depois do degrau não contam falha; a terceira conta", () => {
    /*
     * SPEC §6.3: "ao mudar de degrau as reps caem e isso é esperado (não conta
     * como falha por 2 sessões)" e a regra derivada do doc (caso 13/14).
     */
    const presc = prescricaoPadrao(assistida);
    const topo = sessaoDe(presc, presc.max ?? 8);
    const queda = sessaoDe(presc, (presc.min ?? 5) - 2);

    const sobe = decidir(assistida, estadoDe(assistida), topo, { prescricao: presc });
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.assistencia).toBe("joelho");
    expect(sobe.novoEstado.sessoes_graca).toBe(SESSOES_DE_GRACA);

    let estado = sobe.novoEstado;
    for (let i = 1; i <= SESSOES_DE_GRACA; i++) {
      const d = decidir(assistida, estado, queda, { prescricao: presc });
      expect(`${i}: ${d.evento?.motivo}/${d.evento?.falha ?? false}`).toBe(`${i}: repetiu/false`);
      expect(d.novoEstado.falhas_seguidas).toBe(0);
      expect(d.novoEstado.sessoes_graca).toBe(SESSOES_DE_GRACA - i);
      expect(d.novoEstado.assistencia).toBe("joelho");
      estado = d.novoEstado;
    }
    // acabada a graça, a queda volta a ser falha (§6.2)
    const depois = decidir(assistida, estado, queda, { prescricao: presc });
    expect(depois.evento?.falha).toBe(true);
    expect(depois.novoEstado.falhas_seguidas).toBe(1);
  });
});

describe("rodada 6 · §6.4/§6.5 — toda carga da escala fecha com o estoque real", () => {
  it("as anilhas de cada carga somam certo e cabem no estoque de 4 de cada peso", () => {
    /*
     * SPEC §6.4 (as fórmulas e os limites por lado / ponta) e §6.5 ("respeitando
     * o estoque (4 de cada, logo no máximo 2 por lado)"). Em vez dos exemplos
     * do doc, a varredura confere TODA carga de TODO implemento: a soma das
     * anilhas bate com a fórmula do implemento, todo peso existe no estoque e o
     * total usado (2 lados na barra, 4 pontas nos dois halteres) cabe nele.
     */
    const estoque = new Map(anilhasDisponiveis().map((a) => [a.kg, a.qtd]));
    const implementos: ImplementoMontagem[] = [
      "barra_macica",
      "barra_w",
      "barra_reta_oca",
      "halteres",
      "polia",
      "barra_fixa",
      "peso_corporal",
      "anilha",
    ];
    const erros: string[] = [];
    for (const opcoes of [{}, { pesoBarra: 4.8 }]) {
      for (const implemento of implementos) {
        for (const carga of cargasPossiveis(implemento, opcoes)) {
          const m = montagem(carga, implemento, opcoes);
          const fator = m.onde === "porLado" || m.onde === "porPonta" ? 2 : 1;
          const soma = m.anilhas.reduce((s, v) => s + v, 0);
          const esperado = Math.round(((carga - m.pesoBarra) / fator) * 100) / 100;
          if (!m.exato) erros.push(`${implemento} ${carga}: montagem inexata`);
          if (Math.abs(soma - esperado) > 1e-9) {
            erros.push(`${implemento} ${carga}: anilhas somam ${soma}, esperado ${esperado}`);
          }
          const usadas = new Map<number, number>();
          for (const a of m.anilhas) usadas.set(a, (usadas.get(a) ?? 0) + 1);
          for (const [kg, n] of usadas) {
            const total = m.onde === "porPonta" ? n * 4 : m.onde === "porLado" ? n * 2 : n;
            const disponivel = estoque.get(kg) ?? 0;
            if (disponivel === 0) erros.push(`${implemento} ${carga}: anilha de ${kg} kg não existe`);
            if (total > disponivel) {
              erros.push(`${implemento} ${carga}: usa ${total} anilhas de ${kg} kg (estoque ${disponivel})`);
            }
          }
        }
      }
    }
    expect([...new Set(erros)]).toEqual([]);
  });
});

/* ==================================================================== */
/* RODADA 6 — §5.4 com §5.2 item 3: a semana curta vista por fora        */
/* ==================================================================== */

describe("rodada 6 · §5.4 — o corte segue a ordem de sacrifício do guia", () => {
  const COMBINACOES: DiaSemana[][] = Array.from({ length: 128 }, (_, mascara) =>
    DIAS.filter((_d, i) => (mascara >> i) & 1),
  );

  const semanas: { rotulo: string; perfil: PerfilCalendario }[] = [
    { rotulo: "fase1/A1", perfil: { ...perfilF1, ultimo_treino: "A1" } },
    { rotulo: "fase1/B1", perfil: { ...perfilF1, ultimo_treino: "B1" } },
    { rotulo: "fase2", perfil: { ...perfilF1, fase_atual: "fase2", ultimo_treino: null } },
  ];

  it("o que se corta é sempre um prefixo de [cardio de sábado, outro cardio, força não protegida]", () => {
    /*
     * SPEC §5.4 e `programa.json` `semana_curta.regra`: "1º a corrida de sábado,
     * 2º a segunda sessão de cardio, 3º um treino de força. Nunca corte o treino
     * com agachamento ou terra". A ordem é a mesma para qualquer capacidade —
     * o que muda é quantos itens dela caem.
     */
    const protegidos = treinosComAgachamentoOuTerra();
    const erros: string[] = [];
    for (const { rotulo, perfil } of semanas) {
      const semana = semanaDoPlano("2026-09-14", perfil);
      const atividades = semana.filter((d) => d.tipo !== "descanso");
      const dias = (teste: (d: (typeof atividades)[number]) => boolean) =>
        atividades.filter(teste).map((d) => d.dia).reverse();
      const ordem = [
        ...dias((d) => d.tipo === "cardio"),
        ...dias((d) => d.tipo === "forca" && !protegidos.includes(d.treinoId as TreinoId)),
        ...dias((d) => d.tipo === "forca" && protegidos.includes(d.treinoId as TreinoId)),
      ];
      for (const marcados of COMBINACOES) {
        const r = semanaCurta(marcados, semana);
        const quantos = Math.max(0, atividades.length - r.capacidade);
        const esperado = ordem.slice(0, quantos).join(",");
        const obtido = r.cortados.map((c) => c.dia).join(",");
        if (obtido !== esperado) {
          erros.push(`${rotulo} [${marcados.join(",")}]: cortou ${obtido} (esperado ${esperado})`);
        }
      }
    }
    expect(erros).toEqual([]);
  });

  it("§5.2 item 3: o primeiro treino da semana reorganizada nunca repete o último feito", () => {
    /*
     * SPEC §5.2 item 3 ("o treino é o que não foi o último") atravessando a
     * virada da semana: depois do remanejo da §5.4, o primeiro treino que
     * sobrou ainda tem que ser o próximo da alternância. A única exceção é a
     * regra explícita da §5.4 — sobrando um dia só, ele é o Treino A, mesmo que
     * o Treino A tenha sido o último.
     */
    const erros: string[] = [];
    for (const ultimo of ["A1", "B1"] as TreinoId[]) {
      const semana = semanaDoPlano("2026-09-14", { ...perfilF1, ultimo_treino: ultimo });
      for (const marcados of COMBINACOES) {
        const forca = semanaCurta(marcados, semana).dias.filter((d) => d.tipo === "forca");
        const primeiro = forca[0]?.treinoId ?? null;
        if (primeiro === null) continue;
        if (forca.length === 1) {
          if (primeiro !== "A1") erros.push(`${ultimo} [${marcados.join(",")}]: sobrou ${primeiro}`);
          continue;
        }
        if (primeiro === ultimo) {
          erros.push(`${ultimo} [${marcados.join(",")}]: recomeça em ${primeiro}`);
        }
      }
    }
    expect(erros).toEqual([]);
  });
});

/* ==================================================================== */
/* RODADA 6 — §3.9: a barra W pesada na balança, do começo ao fim        */
/* ==================================================================== */

describe("rodada 6 · §6.1/§6.6 — cadeia inteira com a barra W já pesada", () => {
  it("a escala muda, mas a tela e o estado andam juntos em 24 sessões", () => {
    /*
     * SPEC §3.9 (o peso da barra é editável no perfil), §6.4/§10.5 (só cargas
     * alcançáveis) e §6.6 (a tela mostra a decisão gravada). As rodadas 4 e 5
     * corrigiram `decidir()` e `cargaDeHoje()` para projetarem na escala; aqui
     * as duas correções rodam juntas, do estado inicial do JSON (2,0 kg, fora
     * da escala de 4,8) até a semana leve e a volta.
     */
    const opcoes = { pesoBarra: 4.8 };
    const escala = cargasPossiveis("barra_w", opcoes);
    const erros: string[] = [];
    for (const ex of exercicios) {
      if (ex.implemento !== "barra_w") continue;
      const presc = prescricaoPadrao(ex);
      const topo = presc.max ?? presc.min ?? 10;
      const piso = presc.min ?? topo;
      let estado = estadoInicial(ex, presc);
      for (let i = 0; i < 24; i++) {
        const valor = i % 3 === 0 ? Math.max(0, piso - 2) : topo + 1;
        estado = decidir(ex, estado, sessaoDe(presc, valor), {
          prescricao: presc,
          montagem: opcoes,
        }).novoEstado;
        const hoje = cargaDeHoje(ex, estado, presc, opcoes);
        if (hoje.carga_kg !== estado.carga_atual_kg) {
          erros.push(`${ex.id}#${i}: tela ${hoje.carga_kg} × estado ${estado.carga_atual_kg}`);
        }
        if (estado.carga_atual_kg !== null && !escala.includes(estado.carga_atual_kg)) {
          erros.push(`${ex.id}#${i}: ${estado.carga_atual_kg} fora da escala da barra pesada`);
        }
        if (hoje.montagem?.exato !== true) {
          erros.push(`${ex.id}#${i}: montagem inexata (${hoje.montagem?.pedido} → ${hoje.montagem?.total})`);
        }
      }
    }
    expect(erros).toEqual([]);
  });
});
