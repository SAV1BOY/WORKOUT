/**
 * AUDITORIA ADVERSARIAL — lente "spec" (rodada 1).
 *
 * Testes escritos contra SPEC.md §5–§6 e docs/casos-de-teste-progressao.md,
 * além dos 22 casos já cobertos por lib/progressao.test.ts. Nada aqui é
 * "código de produção": é só a prova de conformidade do motor.
 */
import { describe, expect, it } from "vitest";
import { acharExercicio, acharTreino, exercicios } from "@/lib/dados";
import {
  alcancavelParaBaixo,
  cargaMaxima,
  montagem,
} from "@/lib/montagem";
import {
  cargaDeHoje,
  decidir,
  estadoInicial,
  incrementoDe,
  prescricaoDoTreino,
  prescricaoPadrao,
  type EstadoExercicio,
  type SerieFeita,
} from "@/lib/progressao";
import {
  adiarFase2,
  avancarSemanaCardio,
  avancarSemanaDeBarraFixa,
  avancarSemanaDeCorda,
  avancarSemanaDeCorrida,
  proximoTreinoAlternado,
  semanaCurta,
  semanaDoPlano,
  sessaoCardioDeHoje,
  sugerirFase2,
  tipoDoDia,
  treinoDeHoje,
  type ExcecaoAgenda,
  type PerfilCalendario,
} from "@/lib/calendario";
import type { Exercicio } from "@/lib/schemas";

/* ------------------------------------------------------------- atalhos */

const supino = acharExercicio("supino-reto-com-barra");
const agachamento = acharExercicio("agachamento-livre");
const terra = acharExercicio("levantamento-terra");
const rosca = acharExercicio("rosca-alternada");
const puxada = acharExercicio("puxada-alta-na-polia");
const roscaW = acharExercicio("rosca-com-barra-w");
const assistida = acharExercicio("barra-fixa-assistida");
const pronada = acharExercicio("barra-fixa-pronada");
const prancha = acharExercicio("prancha");
const pranchaLateral = acharExercicio("prancha-lateral");
const elevacaoPernas = acharExercicio("elevacao-de-pernas-na-barra-fixa");
const farmer = acharExercicio("farmer-s-walk");
const inclinadoHalteres = acharExercicio("supino-inclinado-com-halteres");

function estadoDe(ex: Exercicio, patch: Partial<EstadoExercicio> = {}): EstadoExercicio {
  return { ...estadoInicial(ex), ...patch };
}

function reps(...valores: number[]): SerieFeita[] {
  return valores.map((r) => ({ concluida: true, reps: r }));
}

function porLado(...pares: [number, number][]): SerieFeita[] {
  return pares.map(([d, e]) => ({ concluida: true, reps: d, reps_lado2: e }));
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

/* =================================================== SPEC §6.1 — hoje */

describe("§6.1 — a carga de hoje na primeira vez", () => {
  it("as quatro convenções de carga inicial saem do JSON (§6.1, §10.2)", () => {
    expect(cargaDeHoje(supino, null).carga_kg).toBe(7.5);
    expect(cargaDeHoje(terra, null).carga_kg).toBe(7.5);
    expect(cargaDeHoje(rosca, null).carga_kg).toBe(1.5);
    expect(cargaDeHoje(inclinadoHalteres, null).carga_kg).toBe(1.5);
    expect(cargaDeHoje(puxada, null).carga_kg).toBe(4);
    expect(cargaDeHoje(prancha, null).carga_kg).toBe(0);
    expect(cargaDeHoje(elevacaoPernas, null).carga_kg).toBe(0);
    // a barra W ainda não foi pesada: vale 2,0 kg (PESO_BARRA_A_PESAR)
    expect(cargaDeHoje(roscaW, null).carga_kg).toBe(2);
    expect(cargaDeHoje(roscaW, null).montagem?.pesoBarra).toBe(2);
    expect(cargaDeHoje(roscaW, null).montagem?.exato).toBe(true);
  });

  it("o estado da primeira vez guarda o PISO da faixa (§6.1)", () => {
    expect(estadoInicial(supino).reps_alvo).toBe(null); // progressão por carga
    expect(estadoInicial(elevacaoPernas).reps_alvo).toBe(10);
    expect(estadoInicial(prancha).tempo_alvo_s).toBe(30);
    expect(estadoInicial(assistida).assistencia).toBe("pe_inteiro");
    expect(cargaDeHoje(elevacaoPernas, null).alvo_min).toBe(10);
    expect(cargaDeHoje(prancha, null).alvo_min).toBe(30);
    expect(cargaDeHoje(supino, null).primeira_vez).toBe(true);
    expect(cargaDeHoje(supino, estadoDe(supino)).primeira_vez).toBe(false);
  });

  it("toda carga inicial do catálogo é alcançável no implemento (§6.4)", () => {
    const fora = exercicios.filter(
      (e) => alcancavelParaBaixo(e.carga_inicial.kg, e.implemento) !== e.carga_inicial.kg,
    );
    expect(fora.map((e) => `${e.id}=${e.carga_inicial.kg}`)).toEqual([]);
  });

  it("a prescrição do treino vence a do catálogo (A1: supino 3 × 5)", () => {
    const item = acharTreino("A1").exercicios.find(
      (e) => e.exercicio_id === "supino-reto-com-barra",
    );
    expect(item).toBeTruthy();
    const alvo = prescricaoDoTreino(item!, supino);
    expect([alvo.series, alvo.min, alvo.max]).toEqual([3, 5, 5]);
    const hoje = cargaDeHoje(supino, null, alvo);
    expect(hoje.alvo_max).toBe(5);
    const { evento } = decidir(supino, null, reps(5, 5, 5), { prescricao: alvo });
    expect(evento?.motivo).toBe("subiu");
    // no catálogo (3 × 5–8) as mesmas 5 repetições não subiriam
    expect(decidir(supino, null, reps(5, 5, 5)).evento?.motivo).toBe("repetiu");
  });
});

/* ================================================== SPEC §6.2 — decisão */

describe("§6.2 — classificação e contadores", () => {
  it("'manteve' não mexe em falhas_seguidas e o sucesso zera", () => {
    const comFalha = estadoDe(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 });
    expect(decidir(supino, comFalha, reps(8, 8, 7)).novoEstado.falhas_seguidas).toBe(1);
    expect(
      decidir(supino, comFalha, reps(8, 8, 8), { ultimaFirme: false }).novoEstado
        .falhas_seguidas,
    ).toBe(1);
    expect(decidir(supino, comFalha, reps(8, 8, 8)).novoEstado.falhas_seguidas).toBe(0);
  });

  it("incremento pela metade dura ATÉ A PRÓXIMA SUBIDA (§6.2)", () => {
    // agachamento 4 kg: 2ª falha reduz para 2 kg
    const depoisDaFalha = decidir(
      agachamento,
      estadoDe(agachamento, { carga_atual_kg: 39.5, falhas_seguidas: 1 }),
      reps(5, 4, 3),
    ).novoEstado;
    expect(incrementoDe(agachamento, depoisDaFalha)).toBe(2);
    // uma sessão "repetiu" no meio não devolve os 4 kg
    const noMeio = decidir(agachamento, depoisDaFalha, reps(5, 5, 5), {
      ultimaFirme: false,
    }).novoEstado;
    expect(noMeio.incremento_reduzido).toBe(true);
    expect(incrementoDe(agachamento, noMeio)).toBe(2);
    // a subida devolve
    const subiu = decidir(agachamento, noMeio, reps(5, 5, 5)).novoEstado;
    expect(subiu.carga_atual_kg).toBe(37.5);
    expect(subiu.incremento_reduzido).toBe(false);
    expect(incrementoDe(agachamento, subiu)).toBe(4);
  });

  it("exigir_rep_extra: topo + 1 em todas e depois desliga (caso 5)", () => {
    const falhou = decidir(
      supino,
      estadoDe(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 }),
      reps(7, 5, 3),
    ).novoEstado;
    expect(falhou.carga_atual_kg).toBe(21.5);
    expect(falhou.exigir_rep_extra).toBe(true);
    expect(cargaDeHoje(supino, falhou).exigir_rep_extra).toBe(true);
    // topo da faixa (8) não basta
    expect(decidir(supino, falhou, reps(8, 8, 8)).evento?.motivo).toBe("repetiu");
    // topo + 1 em todas sobe e desliga a exigência
    const subiu = decidir(supino, falhou, reps(9, 9, 9));
    expect(subiu.evento?.motivo).toBe("subiu");
    expect(subiu.novoEstado.carga_atual_kg).toBe(23.5);
    expect(subiu.novoEstado.exigir_rep_extra).toBe(false);
    expect(subiu.novoEstado.incremento_reduzido).toBe(false);
  });

  it("série de trabalho a mais abaixo do piso conta falha (§6.2)", () => {
    // 4 séries de trabalho registradas, a última com 3 reps (piso 5): é
    // "alguma série de trabalho com reps < alvo_min" → falha, não subida.
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const { novoEstado, evento } = decidir(supino, estado, reps(8, 8, 8, 3));
    expect(evento?.motivo).toBe("repetiu");
    expect(evento?.falha).toBe(true);
    expect(novoEstado.carga_atual_kg).toBe(25.5);
    expect(novoEstado.falhas_seguidas).toBe(1);
  });

  it("série de trabalho a mais NÃO concluída conta falha (§6.2)", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const { evento } = decidir(supino, estado, [
      ...reps(8, 8, 8),
      { concluida: false, reps: null },
    ]);
    expect(evento?.motivo).toBe("repetiu");
    expect(evento?.falha).toBe(true);
  });

  it("sessão abandonada: avalia quem tem todas as séries, ignora o resto (§6.3)", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const parcial = decidir(supino, estado, reps(8), { sessaoAbandonada: true });
    expect(parcial.evento).toBe(null);
    expect(parcial.novoEstado).toEqual(estado);
    const inteiro = decidir(supino, estado, reps(8, 8, 8), { sessaoAbandonada: true });
    expect(inteiro.evento?.motivo).toBe("subiu");
    expect(inteiro.novoEstado.carga_atual_kg).toBe(27.5);
  });

  it("semana leve: 3ª falha → 60 % → volta → subida com o incremento cheio", () => {
    const duasFalhas = estadoDe(terra, { carga_atual_kg: 47.5, falhas_seguidas: 2 });
    const leve = decidir(terra, duasFalhas, reps(4, 3, 3));
    expect(leve.evento?.motivo).toBe("semana_leve_60");
    expect(leve.novoEstado.semana_leve).toBe(true);
    expect(leve.novoEstado.carga_atual_kg).toBe(27.5);
    expect(leve.novoEstado.carga_antes_leve).toBe(47.5);
    expect(leve.novoEstado.falhas_seguidas).toBe(0);
    expect(cargaDeHoje(terra, leve.novoEstado).carga_kg).toBe(27.5);

    const volta = decidir(terra, leve.novoEstado, reps(5, 5, 5));
    expect(volta.evento?.motivo).toBe("fim_semana_leve");
    expect(volta.novoEstado.carga_atual_kg).toBe(47.5);
    expect(volta.novoEstado.semana_leve).toBe(false);
    expect(incrementoDe(terra, volta.novoEstado)).toBe(4);

    const subiu = decidir(terra, volta.novoEstado, reps(5, 5, 5));
    expect(subiu.evento?.motivo).toBe("subiu");
    expect(subiu.novoEstado.carga_atual_kg).toBe(51.5);
  });
});

/* =============================================== SPEC §6.3 — especiais */

describe("§6.3 — casos especiais", () => {
  it("máximo: 3 séries chegando a 10 sugerem o lastro mesmo sem subir (§6.3)", () => {
    // SPEC §6.3 / data/progressao.json: "sem carga até 3 × 10 limpas; depois
    // anilha de 2 kg na mochila". A sugestão depende de chegar a 3 × 10, não
    // de a média ter subido.
    const estado = estadoDe(pronada, { reps_alvo: 10 });
    const igual = decidir(pronada, estado, reps(10, 10, 10), {
      seriesAnteriores: [10, 10, 10],
    });
    expect(igual.evento?.motivo).toBe("repetiu");
    expect(igual.evento?.sugestao ?? "").toMatch(/lastro/i);
  });

  it("máximo: a subida com 3 × 10 traz a sugestão do lastro (caso 15)", () => {
    const estado = estadoDe(pronada, { reps_alvo: 9 });
    const { evento } = decidir(pronada, estado, reps(10, 10, 10), {
      seriesAnteriores: [9, 9, 9],
    });
    expect(evento?.motivo).toBe("subiu");
    expect(evento?.sugestao ?? "").toMatch(/lastro/i);
  });

  it("máximo: média +1 mas uma série abaixo da anterior → repetiu sem falha", () => {
    const estado = estadoDe(pronada, { reps_alvo: 4 });
    const { evento, novoEstado } = decidir(pronada, estado, reps(8, 3, 5), {
      seriesAnteriores: [4, 4, 4],
    });
    expect(evento?.motivo).toBe("repetiu");
    expect(evento?.falha).toBeFalsy();
    expect(novoEstado.falhas_seguidas).toBe(0);
  });

  it("assistência: pe_inteiro → joelho → joelho_dobrado → sem, 2 sessões de graça", () => {
    let estado = estadoDe(assistida);
    const degraus: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const r = decidir(assistida, estado, reps(8, 8, 8, 8));
      expect(r.evento?.motivo).toBe("subiu");
      expect(r.novoEstado.sessoes_graca).toBe(2);
      expect(r.novoEstado.carga_atual_kg).toBe(0);
      estado = r.novoEstado;
      degraus.push(estado.assistencia);
    }
    expect(degraus).toEqual(["joelho", "joelho_dobrado", "sem"]);
    // sem elástico não há degrau seguinte: repete e sugere o lastro
    const fim = decidir(assistida, estado, reps(8, 8, 8, 8));
    expect(fim.evento?.motivo).toBe("repetiu");
    expect(fim.novoEstado.assistencia).toBe("sem");
    expect(fim.evento?.sugestao ?? "").toMatch(/lastro/i);
  });

  it("graça: a queda depois de mudar o degrau não conta falha por 2 sessões", () => {
    const estado = estadoDe(assistida, { assistencia: "joelho", sessoes_graca: 2 });
    const primeira = decidir(assistida, estado, reps(5, 5, 4, 4));
    expect(primeira.evento?.motivo).toBe("repetiu");
    expect(primeira.novoEstado.falhas_seguidas).toBe(0);
    expect(primeira.novoEstado.sessoes_graca).toBe(1);
    const segunda = decidir(assistida, primeira.novoEstado, reps(5, 5, 4, 4));
    expect(segunda.novoEstado.falhas_seguidas).toBe(0);
    expect(segunda.novoEstado.sessoes_graca).toBe(0);
    // acabou a graça: agora conta falha
    const terceira = decidir(assistida, segunda.novoEstado, reps(5, 5, 4, 4));
    expect(terceira.novoEstado.falhas_seguidas).toBe(1);
  });

  it("unilateral: o lado mais fraco decide, em reps e em tempo (§6.3)", () => {
    // rosca alternada 3 × 10–12: 12/9 na última fica abaixo do piso → falha
    const r = decidir(rosca, estadoDe(rosca, { carga_atual_kg: 3.5 }), porLado(
      [12, 12],
      [12, 12],
      [12, 9],
    ));
    expect(r.evento?.falha).toBe(true);
    // prancha lateral 3 × 20–40 s unilateral: 40/25 não sobe
    const t = decidir(
      pranchaLateral,
      estadoDe(pranchaLateral),
      [
        { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
        { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
        { concluida: true, tempo_s: 40, tempo_s_lado2: 25 },
      ],
    );
    expect(t.evento?.motivo).toBe("repetiu");
    expect(t.novoEstado.tempo_alvo_s).toBe(20);
  });

  it("peso corporal com faixa: acima de 20 reps sugere a anilha e o piso", () => {
    const estado = estadoDe(elevacaoPernas, { reps_alvo: 20 });
    const { evento } = decidir(elevacaoPernas, estado, reps(21, 21, 21));
    expect(evento?.motivo).toBe("subiu");
    expect(evento?.sugestao ?? "").toMatch(/anilha/i);
    expect(evento?.sugestao ?? "").toMatch(/piso|10/i);
  });

  it("substituição: o substituto usa o próprio estado e o original não muda", () => {
    const estadoOriginal = estadoDe(supino, { carga_atual_kg: 25.5 });
    const estadoSubstituto = estadoDe(inclinadoHalteres, { carga_atual_kg: 5.5 });
    const sub = decidir(inclinadoHalteres, estadoSubstituto, reps(12, 12, 12));
    expect(sub.evento?.motivo).toBe("subiu");
    expect(sub.novoEstado.carga_atual_kg).toBe(7.5);
    // o original não é avaliado: sem séries, nada acontece
    const orig = decidir(supino, estadoOriginal, []);
    expect(orig.evento).toBe(null);
    expect(orig.novoEstado).toEqual(estadoOriginal);
    expect(estadoOriginal.carga_atual_kg).toBe(25.5);
  });
});

/* ============================================ SPEC §6.4 — limites do kit */

describe("§6.4 — arredondamento, teto e aviso", () => {
  it("teto da barra maciça: 107,5 repete com o aviso das anilhas de 10 kg", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 107.5 });
    const { evento, novoEstado } = decidir(supino, estado, reps(8, 8, 8));
    expect(evento?.motivo).toBe("repetiu");
    expect(evento?.aviso).toMatch(/anilhas de 10 kg/);
    expect(novoEstado.carga_atual_kg).toBe(107.5);
  });

  it("montagem: teto de capacidade da barra não é falta de anilhas de 10 kg (§6.4)", () => {
    // Halteres: 41,5 kg por halter precisaria de S = 20 por ponta
    // (10 + 5 + 4 + 1 = 4 anilhas de 10 kg no par, o estoque inteiro, que
    // existe). Quem barra é a capacidade da barra de halter (40 kg), não a
    // falta de anilhas de 10 kg. O doc só prevê o aviso em
    // montagem(109.5, "barra_macica").
    expect(cargaMaxima("halteres")).toBe(39.5);
    expect(montagem(41.5, "halteres").total).toBe(39.5);
    expect(montagem(41.5, "halteres").aviso).toBeUndefined();
    // barra W: o doc manda 52 → 50 (capacidade), sem aviso
    expect(montagem(52, "barra_w").total).toBe(50);
    expect(montagem(52, "barra_w").aviso).toBeUndefined();
    // na barra maciça o aviso é o certo: 109,5 exige anilhas de 10 kg a mais
    expect(montagem(109.5, "barra_macica").aviso).toMatch(/anilhas de 10 kg/);
  });

  it("decidir no teto do halter: repete sem culpar as anilhas de 10 kg (§6.4)", () => {
    const noTeto = decidir(farmer, estadoDe(farmer, { carga_atual_kg: 39.5 }), [
      { concluida: true, passos: 40 },
      { concluida: true, passos: 40 },
      { concluida: true, passos: 40 },
    ]);
    expect(noTeto.evento?.motivo).toBe("repetiu");
    expect(noTeto.novoEstado.carga_atual_kg).toBe(39.5);
    expect(noTeto.evento?.aviso ?? "").not.toMatch(/anilhas de 10 kg/);
  });

  it("incremento override do exercise_state manda na subida (§6.2)", () => {
    const comOverride = estadoDe(supino, { carga_atual_kg: 9.5, incremento_kg: 4 });
    expect(incrementoDe(supino, comOverride)).toBe(4);
    expect(decidir(supino, comOverride, reps(8, 8, 8)).novoEstado.carga_atual_kg).toBe(
      13.5,
    );
    // override fora da escala cai para a carga alcançável para baixo
    const impar = estadoDe(supino, { carga_atual_kg: 9.5, incremento_kg: 3 });
    expect(decidir(supino, impar, reps(8, 8, 8)).novoEstado.carga_atual_kg).toBe(11.5);
    // e o override também é o que a metade das 2 falhas reduz
    const reduzido = { ...comOverride, incremento_reduzido: true };
    expect(incrementoDe(supino, reduzido)).toBe(2);
  });
});

/* ================================================= SPEC §5 — calendário */

describe("§5.2 — o que é hoje", () => {
  it("Fase 1 alterna A-B-A e B-A-B; o override entra na corrente", () => {
    expect(proximoTreinoAlternado(null)).toBe("A1");
    expect(proximoTreinoAlternado("A1")).toBe("B1");
    const semana = semanaDoPlano(INICIO, perfil());
    expect(semana.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "A1",
      "B1",
      "A1",
    ]);
    const overrides: ExcecaoAgenda[] = [
      { data: INICIO, tipo: "forca", workout_id: "B1", sessao: null },
    ];
    const comOverride = semanaDoPlano(INICIO, perfil(), overrides);
    expect(
      comOverride.filter((d) => d.tipo === "forca").map((d) => d.treinoId),
    ).toEqual(["B1", "A1", "B1"]);
  });

  it("Fase 2 tem dia fixo: SA seg · IA ter · SB qui · IB sex, cardio qua e sab", () => {
    const p = perfil({ fase_atual: "fase2", ultimo_treino: "SA" });
    const semana = semanaDoPlano(INICIO, p);
    expect(semana.map((d) => d.treinoId)).toEqual([
      "SA",
      "IA",
      null,
      "SB",
      "IB",
      null,
      null,
    ]);
    expect(semana.map((d) => d.tipo)).toEqual([
      "forca",
      "forca",
      "cardio",
      "forca",
      "forca",
      "cardio",
      "descanso",
    ]);
  });

  it("descanso mostra o lembrete do dia (§5.2 item 5)", () => {
    const qui = treinoDeHoje("2026-09-17", perfil());
    expect(qui.tipo).toBe("descanso");
    expect(qui.treinoId).toBe(null);
    expect(qui.nota ?? "").toMatch(/barra fixa/i);
    const dom = treinoDeHoje("2026-09-20", perfil());
    expect(dom.tipo).toBe("descanso");
    expect(dom.nota ?? "").toMatch(/caminhada/i);
  });

  it("cardio: 'corrida ou corda' guarda as duas semanas de plano (§5.2)", () => {
    const p = perfil({ semana_corrida: 5, semana_corda: 3 });
    const sabado = sessaoCardioDeHoje("2026-09-19", p);
    expect(sabado?.tipo).toBe("corrida");
    expect(sabado?.permiteCorda).toBe(true);
    expect(sabado?.semana).toBe(5);
    expect(sabado?.corrida?.semana).toBe(5);
    expect(sabado?.corda?.semanas).toBe("3–4");
    // terça é só corrida
    const terca = sessaoCardioDeHoje("2026-09-15", p);
    expect(terca?.permiteCorda).toBe(false);
    expect(terca?.corrida?.descricao).toMatch(/min/);
    // override pode trocar o dia por corda
    const overrides: ExcecaoAgenda[] = [
      { data: INICIO, tipo: "cardio", workout_id: null, sessao: "corda" },
    ];
    const segunda = sessaoCardioDeHoje(INICIO, p, overrides);
    expect(segunda?.tipo).toBe("corda");
    expect(segunda?.semana).toBe(3);
    expect(tipoDoDia(INICIO, "fase1", overrides).origem).toBe("override");
    expect(treinoDeHoje(INICIO, p, overrides).treinoId).toBe(null);
  });
});

describe("§5.5 — semanas dos planos de cardio e barra fixa", () => {
  it("avança com 2 sessões na semana civil, repete com 0 e com 1", () => {
    expect(avancarSemanaDeCorrida(3, 2)).toBe(4);
    expect(avancarSemanaDeCorrida(3, 1)).toBe(3);
    expect(avancarSemanaDeCorrida(3, 0)).toBe(3);
    expect(avancarSemanaDeCorda(3, 2)).toBe(4);
    expect(avancarSemanaDeCorda(3, 1)).toBe(3);
    expect(avancarSemanaDeBarraFixa(3, 2)).toBe(4);
    expect(avancarSemanaDeBarraFixa(3, 1)).toBe(3);
  });

  it("nenhum plano passa da semana 12", () => {
    expect(avancarSemanaDeCorrida(12, 2)).toBe(12);
    expect(avancarSemanaDeCorda(12, 2)).toBe(12);
    expect(avancarSemanaDeBarraFixa(12, 2)).toBe(12);
    expect(avancarSemanaCardio(12, 2, { maximo: 12 })).toBe(12);
  });
});

describe("§5.1 — sugestão da Fase 2", () => {
  it("12 semanas civis completas E 30 sessões", () => {
    const p = perfil();
    expect(sugerirFase2(p, 30, "2026-12-07").sugerir).toBe(true);
    expect(sugerirFase2(p, 29, "2026-12-07").sugerir).toBe(false);
    expect(sugerirFase2(p, 30, "2026-11-30").sugerir).toBe(false);
    expect(sugerirFase2(p, 40, "2027-01-04").sugerir).toBe(true);
    expect(sugerirFase2(perfil({ fase_atual: "fase2" }), 40, "2027-01-04").sugerir).toBe(
      false,
    );
  });

  it("adiar silencia por 2 semanas e a sugestão volta no dia", () => {
    const ate = adiarFase2("2026-12-07");
    expect(ate).toBe("2026-12-21");
    const adiado = perfil({ prefs: { fase2_adiada_ate: ate } });
    expect(sugerirFase2(adiado, 30, "2026-12-14").sugerir).toBe(false);
    expect(sugerirFase2(adiado, 30, "2026-12-21").sugerir).toBe(true);
    expect(sugerirFase2(adiado, 30, "2026-12-21").adiadaAte).toBe(ate);
  });
});

describe("§5.4 — semana curta", () => {
  it("três dias na Fase 1: cortam-se os dois cardios, sobram A-B-A", () => {
    const semana = semanaDoPlano(INICIO, perfil());
    const r = semanaCurta(["ter", "qui", "sab", "dom"], semana);
    expect(r.cortados.map((c) => c.dia)).toEqual(["sab", "ter"]);
    expect(r.cortados.every((c) => c.tipo === "cardio")).toBe(true);
    expect(r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId)).toEqual([
      "A1",
      "B1",
      "A1",
    ]);
  });

  it("sobrando um dia só, fica o Treino A — mesmo que o dia livre seja sexta", () => {
    const semana = semanaDoPlano(INICIO, perfil());
    const r = semanaCurta(["seg", "ter", "qua", "qui", "sab", "dom"], semana);
    const sobrou = r.dias.filter((d) => d.tipo !== "descanso");
    expect(sobrou).toHaveLength(1);
    expect(sobrou[0]?.dia).toBe("sex");
    expect(sobrou[0]?.treinoId).toBe("A1");
  });

  it("Fase 2: corta cardio e depois o superior, nunca IA/IB (agachamento e terra)", () => {
    const p = perfil({ fase_atual: "fase2" });
    const semana = semanaDoPlano(INICIO, p);
    const r = semanaCurta(["qua", "sex", "sab", "dom"], semana);
    const restam = r.dias.filter((d) => d.tipo === "forca").map((d) => d.treinoId);
    expect(restam).toContain("IA");
    expect(restam).toContain("IB");
    expect(restam).not.toContain("SB");
    expect(r.dias.some((d) => d.tipo === "cardio")).toBe(false);
  });
});

/* ============================================ varredura dos 81 exercícios */

describe("varredura do catálogo (§6.1–§6.4)", () => {
  it("primeira sessão de qualquer exercício: decisão coerente e carga alcançável", () => {
    const problemas: string[] = [];
    for (const ex of exercicios) {
      const alvo = prescricaoPadrao(ex);
      const series: SerieFeita[] = Array.from({ length: alvo.series }, () => ({
        concluida: true,
        reps: alvo.max ?? 12,
        reps_lado2: alvo.max ?? 12,
        tempo_s: alvo.max ?? 60,
        tempo_s_lado2: alvo.max ?? 60,
        passos: alvo.max ?? 40,
      }));
      const hoje = cargaDeHoje(ex, null);
      if (hoje.carga_kg !== ex.carga_inicial.kg) {
        problemas.push(`${ex.id}: carga de hoje ${hoje.carga_kg}`);
      }
      const { novoEstado } = decidir(ex, null, series);
      const carga = novoEstado.carga_atual_kg;
      if (carga !== null && alcancavelParaBaixo(carga, ex.implemento) !== carga) {
        problemas.push(`${ex.id}: carga ${carga} fora da escala de ${ex.implemento}`);
      }
      if (novoEstado.falhas_seguidas !== 0) {
        problemas.push(`${ex.id}: falhas ${novoEstado.falhas_seguidas} numa sessão cheia`);
      }
    }
    expect(problemas).toEqual([]);
  });
});
