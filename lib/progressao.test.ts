import { describe, expect, it } from "vitest";
import { acharExercicio } from "@/lib/dados";
import {
  cargaDeHoje,
  decidir,
  estadoInicial,
  incrementoDe,
  prescricaoPadrao,
  type EstadoExercicio,
  type SerieFeita,
} from "@/lib/progressao";
import type { Exercicio } from "@/lib/schemas";

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
const bulgaro = acharExercicio("agachamento-bulgaro");
const farmer = acharExercicio("farmer-s-walk");
const inclinado = acharExercicio("supino-inclinado-com-halteres");

function estadoDe(
  ex: Exercicio,
  patch: Partial<EstadoExercicio> = {},
): EstadoExercicio {
  return { ...estadoInicial(ex), ...patch };
}

/** Séries concluídas com reps. */
function reps(...valores: number[]): SerieFeita[] {
  return valores.map((r) => ({ concluida: true, reps: r }));
}

/** Séries unilaterais: [lado direito, lado esquerdo]. */
function porLado(...pares: [number, number][]): SerieFeita[] {
  return pares.map(([d, e]) => ({ concluida: true, reps: d, reps_lado2: e }));
}

function tempos(...valores: number[]): SerieFeita[] {
  return valores.map((t) => ({ concluida: true, tempo_s: t }));
}

function passos(...valores: number[]): SerieFeita[] {
  return valores.map((p) => ({ concluida: true, passos: p }));
}

/* ------------------------------------------- §6.1 — a carga de hoje */

describe("cargaDeHoje (SPEC §6.1)", () => {
  it("primeira vez: carga inicial do JSON e alvo no piso da faixa", () => {
    const hoje = cargaDeHoje(supino, null);
    expect(hoje.primeira_vez).toBe(true);
    expect(hoje.carga_kg).toBe(7.5);
    expect(hoje.reps_alvo_min).toBe(5);
    expect(hoje.reps_alvo_max).toBe(8);
    expect(hoje.montagem?.anilhas).toEqual([]);
  });

  it("primeira vez no halter é 1,5 kg e no pino da polia, 4 kg", () => {
    expect(cargaDeHoje(rosca, null).carga_kg).toBe(1.5);
    expect(cargaDeHoje(puxada, null).carga_kg).toBe(4);
  });

  it("depois: o estado manda, com a montagem pronta para a tela", () => {
    const hoje = cargaDeHoje(supino, estadoDe(supino, { carga_atual_kg: 25.5 }));
    expect(hoje.primeira_vez).toBe(false);
    expect(hoje.carga_kg).toBe(25.5);
    expect(hoje.montagem?.porLado).toEqual([5, 4]);
  });

  it("semana leve: 60 % da carga de antes, alcançável", () => {
    const hoje = cargaDeHoje(
      terra,
      estadoDe(terra, {
        carga_atual_kg: 27.5,
        semana_leve: true,
        carga_antes_leve: 47.5,
      }),
    );
    expect(hoje.semana_leve).toBe(true);
    expect(hoje.carga_kg).toBe(27.5);
  });

  it("tempo e assistência também saem do estado", () => {
    const hoje = cargaDeHoje(prancha, null);
    expect(hoje.alvo_min).toBe(30); // piso da faixa
    // SPEC §6.1: "reps/tempo alvo = mínimo da faixa" na primeira vez. O campo
    // tempo_alvo_s é o mesmo da coluna exercise_state.tempo_alvo_s; o topo que
    // a tela pré-preenche está em alvo_max.
    expect(hoje.tempo_alvo_s).toBe(30);
    expect(hoje.alvo_max).toBe(60);
    expect(estadoInicial(prancha).tempo_alvo_s).toBe(30);
    expect(cargaDeHoje(assistida, null).assistencia).toBe("pe_inteiro");
  });
});

/* --------------------- §6.2–6.4 — os 22 casos do documento do guia */

describe("decidir — os 22 casos de docs/casos-de-teste-progressao.md", () => {
  it("caso 1: supino reto 3 × 5–8, 1ª sessão, 8/8/8 firme → sobe para 9,5", () => {
    const { novoEstado, evento } = decidir(supino, null, reps(8, 8, 8));
    expect(evento?.motivo).toBe("subiu");
    expect(evento?.de).toMatchObject({ carga_kg: 7.5 });
    expect(evento?.para).toMatchObject({ carga_kg: 9.5 });
    expect(novoEstado.carga_atual_kg).toBe(9.5);
    expect(novoEstado.falhas_seguidas).toBe(0);
  });

  it("caso 2: 8/8/7 firme → repetiu (não chegou ao topo em todas)", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 9.5 });
    const { novoEstado, evento } = decidir(supino, estado, reps(8, 8, 7));
    expect(evento?.motivo).toBe("repetiu");
    expect(evento?.falha).toBeFalsy();
    expect(novoEstado.carga_atual_kg).toBe(9.5);
    expect(novoEstado.falhas_seguidas).toBe(0);
  });

  it("caso 3: 8/8/8 mas a última não saiu firme → repetiu", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 9.5 });
    const { novoEstado, evento } = decidir(supino, estado, reps(8, 8, 8), {
      ultimaFirme: false,
    });
    expect(evento?.motivo).toBe("repetiu");
    expect(novoEstado.carga_atual_kg).toBe(9.5);
  });

  it("caso 4: 8/6/4 com piso 5 → 1ª falha, repete 25,5 e falhas = 1", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const { novoEstado, evento } = decidir(supino, estado, reps(8, 6, 4));
    expect(evento?.motivo).toBe("repetiu");
    expect(evento?.falha).toBe(true);
    expect(novoEstado.carga_atual_kg).toBe(25.5);
    expect(novoEstado.falhas_seguidas).toBe(1);
  });

  it("caso 5: 2ª falha seguida → 21,5 kg, incremento segue 2 e exige topo + 1", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5, falhas_seguidas: 1 });
    const { novoEstado, evento } = decidir(supino, estado, reps(7, 5, 3));
    expect(evento?.motivo).toBe("falha_2x_voltou_10");
    expect(novoEstado.carga_atual_kg).toBe(21.5); // 25,5 × 0,9 = 22,95
    expect(novoEstado.falhas_seguidas).toBe(2);
    expect(novoEstado.incremento_reduzido).toBe(true);
    expect(novoEstado.exigir_rep_extra).toBe(true);
    expect(incrementoDe(supino, novoEstado)).toBe(2); // 2 ÷ 2 = 1 < passo mínimo
  });

  it("caso 5b: com exigir_rep_extra, 8/8/8 repete e 9/9/9 sobe", () => {
    const estado = estadoDe(supino, {
      carga_atual_kg: 21.5,
      falhas_seguidas: 2,
      incremento_reduzido: true,
      exigir_rep_extra: true,
    });
    expect(decidir(supino, estado, reps(8, 8, 8)).evento?.motivo).toBe("repetiu");
    const subida = decidir(supino, estado, reps(9, 9, 9));
    expect(subida.evento?.motivo).toBe("subiu");
    expect(subida.novoEstado.carga_atual_kg).toBe(23.5);
    expect(subida.novoEstado.exigir_rep_extra).toBe(false);
    expect(incrementoDe(supino, subida.novoEstado)).toBe(2);
  });

  it("caso 6: agachamento 3 × 5, 2ª falha → 35,5 kg e incremento 4 → 2", () => {
    const estado = estadoDe(agachamento, {
      carga_atual_kg: 39.5,
      falhas_seguidas: 1,
    });
    const { novoEstado, evento } = decidir(agachamento, estado, reps(5, 4, 3));
    expect(evento?.motivo).toBe("falha_2x_voltou_10");
    expect(novoEstado.carga_atual_kg).toBe(35.5); // 39,5 × 0,9 = 35,55
    expect(novoEstado.falhas_seguidas).toBe(2);
    expect(novoEstado.exigir_rep_extra).toBe(false);
    expect(incrementoDe(agachamento, novoEstado)).toBe(2);
  });

  it("caso 7: agachamento com incremento reduzido, 5/5/5 firme → 37,5 e incremento volta a 4", () => {
    const estado = estadoDe(agachamento, {
      carga_atual_kg: 35.5,
      falhas_seguidas: 2,
      incremento_reduzido: true,
    });
    const { novoEstado, evento } = decidir(agachamento, estado, reps(5, 5, 5));
    expect(evento?.motivo).toBe("subiu");
    expect(novoEstado.carga_atual_kg).toBe(37.5);
    expect(novoEstado.falhas_seguidas).toBe(0);
    expect(novoEstado.incremento_reduzido).toBe(false);
    expect(incrementoDe(agachamento, novoEstado)).toBe(4);
  });

  it("caso 8: terra com 2 falhas, 3ª falha → semana leve a 27,5 kg", () => {
    const estado = estadoDe(terra, { carga_atual_kg: 47.5, falhas_seguidas: 2 });
    const { novoEstado, evento } = decidir(terra, estado, reps(4, 3, 3));
    expect(evento?.motivo).toBe("semana_leve_60");
    expect(novoEstado.semana_leve).toBe(true);
    expect(novoEstado.carga_atual_kg).toBe(27.5); // 47,5 × 0,6 = 28,5
    expect(novoEstado.carga_antes_leve).toBe(47.5);
    expect(novoEstado.falhas_seguidas).toBe(0);
  });

  it("caso 9: sessão da semana leve → volta a 47,5 com o incremento normal", () => {
    const estado = estadoDe(terra, {
      carga_atual_kg: 27.5,
      semana_leve: true,
      carga_antes_leve: 47.5,
      incremento_reduzido: true,
    });
    const { novoEstado, evento } = decidir(terra, estado, reps(5, 5, 5));
    expect(evento?.motivo).toBe("fim_semana_leve");
    expect(evento?.de).toMatchObject({ carga_kg: 27.5 });
    expect(evento?.para).toMatchObject({ carga_kg: 47.5 });
    expect(novoEstado.carga_atual_kg).toBe(47.5);
    expect(novoEstado.semana_leve).toBe(false);
    expect(novoEstado.carga_antes_leve).toBe(null);
    expect(incrementoDe(terra, novoEstado)).toBe(4);
  });

  it("caso 10: rosca alternada 12/12 · 12/12 · 12/11 → vale o menor lado, repetiu", () => {
    const estado = estadoDe(rosca, { carga_atual_kg: 1.5 });
    const { novoEstado, evento } = decidir(
      rosca,
      estado,
      porLado([12, 12], [12, 12], [12, 11]),
    );
    expect(evento?.motivo).toBe("repetiu");
    expect(novoEstado.carga_atual_kg).toBe(1.5);
  });

  it("caso 11: rosca alternada 12/12 nas três, firme → 3,5 kg por halter", () => {
    const estado = estadoDe(rosca, { carga_atual_kg: 1.5 });
    const { novoEstado, evento } = decidir(
      rosca,
      estado,
      porLado([12, 12], [12, 12], [12, 12]),
    );
    expect(evento?.motivo).toBe("subiu");
    expect(novoEstado.carga_atual_kg).toBe(3.5);
  });

  it("caso 12: puxada alta na polia, 1ª sessão 12/12/12 firme → 6 kg no pino", () => {
    const { novoEstado, evento } = decidir(puxada, null, reps(12, 12, 12));
    expect(evento?.motivo).toBe("subiu");
    expect(evento?.de).toMatchObject({ carga_kg: 4 });
    expect(novoEstado.carga_atual_kg).toBe(6);
  });

  it("caso 13: barra fixa assistida no pé inteiro, 8×4 firme → joelho, com 2 sessões de graça", () => {
    const { novoEstado, evento } = decidir(assistida, null, reps(8, 8, 8, 8));
    expect(evento?.motivo).toBe("subiu");
    expect(evento?.para).toMatchObject({ assistencia: "joelho" });
    expect(novoEstado.assistencia).toBe("joelho");
    expect(novoEstado.carga_atual_kg).toBe(0);
    expect(novoEstado.sessoes_graca).toBe(2);
  });

  it("caso 14: 1ª sessão depois de mudar o degrau, 5/5/4/4 → repetiu sem contar falha", () => {
    const estado = estadoDe(assistida, {
      assistencia: "joelho",
      sessoes_graca: 2,
    });
    const { novoEstado, evento } = decidir(assistida, estado, reps(5, 5, 4, 4));
    expect(evento?.motivo).toBe("repetiu");
    expect(evento?.falha).toBeFalsy();
    expect(novoEstado.falhas_seguidas).toBe(0);
    expect(novoEstado.assistencia).toBe("joelho");
    expect(novoEstado.sessoes_graca).toBe(1);
  });

  it("caso 15: barra fixa pronada 3 × máximo, média 4 → 5/5/5 sobe", () => {
    const { novoEstado, evento } = decidir(pronada, null, reps(5, 5, 5), {
      seriesAnteriores: [4, 4, 4],
    });
    expect(evento?.motivo).toBe("subiu");
    expect(novoEstado.reps_alvo).toBe(5);
  });

  it("caso 15b: três séries de 10 sugerem a barra fixa com lastro", () => {
    const { evento } = decidir(pronada, null, reps(10, 10, 10), {
      seriesAnteriores: [9, 9, 9],
    });
    expect(evento?.motivo).toBe("subiu");
    expect(evento?.sugestao).toContain("lastro");
  });

  it("caso 16: prancha 3 × 30–60 s, 60 s nas três firme → alvo 65 s", () => {
    const estado = estadoDe(prancha, { tempo_alvo_s: 30 });
    const { novoEstado, evento } = decidir(prancha, estado, tempos(60, 60, 60));
    expect(evento?.motivo).toBe("subiu");
    expect(novoEstado.tempo_alvo_s).toBe(65);
    expect(evento?.sugestao).toBeTruthy(); // acima da faixa: sugerir variação
  });

  it("caso 17: elevação de pernas 3 × 10–15, 15/15/15 firme → alvo 16 reps", () => {
    const estado = estadoDe(elevacaoPernas, { reps_alvo: 10 });
    const { novoEstado, evento } = decidir(
      elevacaoPernas,
      estado,
      reps(15, 15, 15),
    );
    expect(evento?.motivo).toBe("subiu");
    expect(novoEstado.reps_alvo).toBe(16);
  });

  it("caso 17b: passando de 20 reps em todas, sugere anilha e voltar ao piso", () => {
    const estado = estadoDe(elevacaoPernas, { reps_alvo: 20 });
    const { evento } = decidir(elevacaoPernas, estado, reps(21, 21, 21));
    expect(evento?.motivo).toBe("subiu");
    expect(evento?.sugestao).toContain("2 kg");
  });

  it("caso 18: búlgaro 10/10 · 10/10 · 10/9 → repetiu (menor lado)", () => {
    const estado = estadoDe(bulgaro, { carga_atual_kg: 5.5 });
    const { novoEstado, evento } = decidir(
      bulgaro,
      estado,
      porLado([10, 10], [10, 10], [10, 9]),
    );
    expect(evento?.motivo).toBe("repetiu");
    expect(novoEstado.carga_atual_kg).toBe(5.5);
  });

  it("caso 19: farmer's walk 3 × 30–40 passos, 40 nas três firme → 13,5 por halter", () => {
    const estado = estadoDe(farmer, { carga_atual_kg: 11.5 });
    const { novoEstado, evento } = decidir(farmer, estado, passos(40, 40, 40));
    expect(evento?.motivo).toBe("subiu");
    expect(novoEstado.carga_atual_kg).toBe(13.5);
  });

  it("caso 20: sessão abandonada com 1 de 3 séries → nada muda, sem evento", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const { novoEstado, evento } = decidir(supino, estado, reps(8), {
      sessaoAbandonada: true,
    });
    expect(evento).toBe(null);
    expect(novoEstado).toEqual(estado);
  });

  it("caso 21: substituição — o substituto sobe e o original não é avaliado", () => {
    const estadoSupino = estadoDe(supino, { carga_atual_kg: 25.5 });
    const estadoInclinado = estadoDe(inclinado, { carga_atual_kg: 5.5 });
    const copiaSupino = { ...estadoSupino };
    const r = decidir(inclinado, estadoInclinado, reps(12, 12, 12));
    expect(r.evento?.motivo).toBe("subiu");
    expect(r.novoEstado.carga_atual_kg).toBe(7.5);
    // o estado do exercício original não é tocado
    expect(estadoSupino).toEqual(copiaSupino);
  });

  it("caso 22: supino no teto de 107,5 kg → repetiu com o aviso das anilhas de 10 kg", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 107.5 });
    const { novoEstado, evento } = decidir(supino, estado, reps(8, 8, 8));
    expect(evento?.motivo).toBe("repetiu");
    expect(evento?.aviso).toContain("faltam anilhas de 10 kg");
    expect(novoEstado.carga_atual_kg).toBe(107.5);
    expect(novoEstado.falhas_seguidas).toBe(0);
  });
});

/* -------------------------------------------- casos extras pedidos */

describe("decidir — tipos especiais", () => {
  it("tempo: abaixo do topo da faixa repete o alvo", () => {
    const estado = estadoDe(prancha, { tempo_alvo_s: 30 });
    const { novoEstado, evento } = decidir(prancha, estado, tempos(60, 55, 60));
    expect(evento?.motivo).toBe("repetiu");
    expect(novoEstado.tempo_alvo_s).toBe(30);
  });

  it("tempo abaixo do piso da faixa conta falha", () => {
    const estado = estadoDe(prancha, { tempo_alvo_s: 30 });
    const { novoEstado, evento } = decidir(prancha, estado, tempos(60, 60, 20));
    expect(evento?.falha).toBe(true);
    expect(novoEstado.falhas_seguidas).toBe(1);
  });

  it("unilateral em tempo (prancha lateral): vale o lado mais fraco", () => {
    const estado = estadoDe(pranchaLateral, { tempo_alvo_s: 20 });
    const fracos: SerieFeita[] = [
      { concluida: true, tempo_s: 40, tempo_s_lado2: 35 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
    ];
    expect(decidir(pranchaLateral, estado, fracos).evento?.motivo).toBe("repetiu");

    const cheios: SerieFeita[] = [
      { concluida: true, tempo_s: 40, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 45, tempo_s_lado2: 40 },
      { concluida: true, tempo_s: 40, tempo_s_lado2: 41 },
    ];
    const r = decidir(pranchaLateral, estado, cheios);
    expect(r.evento?.motivo).toBe("subiu");
    expect(r.novoEstado.tempo_alvo_s).toBe(45);
  });

  it("passos abaixo do piso contam falha", () => {
    const estado = estadoDe(farmer, { carga_atual_kg: 11.5 });
    const { novoEstado } = decidir(farmer, estado, passos(40, 40, 25));
    expect(novoEstado.falhas_seguidas).toBe(1);
    expect(novoEstado.carga_atual_kg).toBe(11.5);
  });

  it("máximo: queda em uma série segura a subida mesmo com a média maior", () => {
    const { novoEstado, evento } = decidir(pronada, null, reps(6, 6, 4), {
      seriesAnteriores: [5, 5, 5],
    });
    expect(evento?.motivo).toBe("repetiu");
    expect(evento?.falha).toBeFalsy();
    expect(novoEstado.falhas_seguidas).toBe(0);
  });

  it("máximo: média abaixo da anterior conta falha", () => {
    const { novoEstado, evento } = decidir(pronada, null, reps(4, 3, 3), {
      seriesAnteriores: [5, 5, 5],
    });
    expect(evento?.falha).toBe(true);
    expect(novoEstado.falhas_seguidas).toBe(1);
  });

  it("máximo: primeira sessão só registra a média, sem evento", () => {
    const { novoEstado, evento } = decidir(pronada, null, reps(3, 3, 2));
    expect(evento).toBe(null);
    expect(novoEstado.reps_alvo).toBe(3);
  });

  it("assistência: joelho dobrado → sem elástico, e depois sugere o lastro", () => {
    const meio = estadoDe(assistida, {
      assistencia: "joelho_dobrado",
      sessoes_graca: 0,
    });
    const r = decidir(assistida, meio, reps(8, 8, 8, 8));
    expect(r.novoEstado.assistencia).toBe("sem");
    expect(r.novoEstado.sessoes_graca).toBe(2);

    const semElastico = estadoDe(assistida, {
      assistencia: "sem",
      sessoes_graca: 0,
    });
    const fim = decidir(assistida, semElastico, reps(8, 8, 8, 8));
    expect(fim.evento?.motivo).toBe("repetiu");
    expect(fim.evento?.sugestao).toBeTruthy();
    expect(fim.novoEstado.assistencia).toBe("sem");
  });

  it("série não concluída ou sem repetições conta falha", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const series: SerieFeita[] = [
      { concluida: true, reps: 8 },
      { concluida: true, reps: 8 },
      { concluida: false, reps: null },
    ];
    const { novoEstado, evento } = decidir(supino, estado, series);
    expect(evento?.falha).toBe(true);
    expect(novoEstado.falhas_seguidas).toBe(1);
  });

  it("série faltando numa sessão concluída também conta falha", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const { novoEstado } = decidir(supino, estado, reps(8, 8));
    expect(novoEstado.falhas_seguidas).toBe(1);
  });

  it("aquecimento nunca entra na conta", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 9.5 });
    const series: SerieFeita[] = [
      { concluida: true, reps: 5, tipo: "aquecimento" },
      ...reps(8, 8, 8),
    ];
    const { novoEstado, evento } = decidir(supino, estado, series);
    expect(evento?.motivo).toBe("subiu");
    expect(novoEstado.carga_atual_kg).toBe(11.5);
  });

  it("exercício desativado ou sessão sem séries: nada acontece", () => {
    const desativado = estadoDe(supino, { desativado: true });
    expect(decidir(supino, desativado, reps(8, 8, 8)).evento).toBe(null);
    expect(decidir(supino, null, []).evento).toBe(null);
  });

  it("semana leve seguida de subida: 47,5 → 27,5 → 47,5 → 51,5", () => {
    let estado = estadoDe(terra, { carga_atual_kg: 47.5, falhas_seguidas: 2 });
    estado = decidir(terra, estado, reps(4, 3, 3)).novoEstado;
    expect(estado.carga_atual_kg).toBe(27.5);
    estado = decidir(terra, estado, reps(5, 5, 5)).novoEstado;
    expect(estado.carga_atual_kg).toBe(47.5);
    const subida = decidir(terra, estado, reps(5, 5, 5));
    expect(subida.evento?.motivo).toBe("subiu");
    expect(subida.novoEstado.carga_atual_kg).toBe(51.5);
  });

  it("decidir nunca altera o estado recebido", () => {
    const estado = estadoDe(supino, { carga_atual_kg: 25.5 });
    const copia = { ...estado };
    decidir(supino, estado, reps(8, 8, 8));
    expect(estado).toEqual(copia);
  });

  it("tipo `maximo` sem 'última firme' repete e não grava a média (SPEC §6.2/§3.2)", () => {
    // §6.2: "Sucesso = … e `ultima_firme = true`"; a §6.3 só troca o critério
    // de sucesso (melhorar a média), não dispensa o toggle.
    const antes = estadoDe(pronada, { reps_alvo: 4 });
    const series = reps(8, 8, 8);
    const contexto = { seriesAnteriores: [4, 4, 4] };
    const firme = decidir(pronada, antes, series, { ...contexto, ultimaFirme: true });
    expect(firme.evento?.motivo).toBe("subiu");
    expect(firme.novoEstado.reps_alvo).toBe(8);

    const mole = decidir(pronada, antes, series, { ...contexto, ultimaFirme: false });
    expect(mole.evento?.motivo).toBe("repetiu");
    expect(mole.novoEstado.reps_alvo).toBe(4);
  });

  it("decide sobre a carga que a tela pediu, não sobre o valor cru do banco (SPEC §6.4/§10.5)", () => {
    // Barra W pesada depois (§3.9): a escala vira 5,2 · 7,2 · … e os 4 kg
    // guardados ficam abaixo dela — a tela pede a barra vazia e o motor sobe
    // a partir dela.
    const roscaW = acharExercicio("rosca-com-barra-w");
    const opcoes = { pesoBarra: 5.2 };
    const st = estadoDe(roscaW, { carga_atual_kg: 4 });
    expect(cargaDeHoje(roscaW, st, prescricaoPadrao(roscaW), opcoes).carga_kg).toBe(5.2);
    const sobe = decidir(roscaW, st, reps(12, 12, 12), { montagem: opcoes });
    expect(sobe.novoEstado.carga_atual_kg).toBe(7.2);
    expect((sobe.evento?.de as { carga_kg: number }).carga_kg).toBe(5.2);

    // e o mesmo na falha: o que fica gravado existe na escala
    const falhou = decidir(
      roscaW,
      estadoDe(roscaW, { carga_atual_kg: 4, falhas_seguidas: 1 }),
      reps(4, 4, 4),
      { montagem: opcoes },
    );
    expect(falhou.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(falhou.novoEstado.carga_atual_kg).toBe(5.2);

    // linha acima do teto da barra maciça: a decisão sai de 107,5
    const acima = decidir(supino, estadoDe(supino, { carga_atual_kg: 120 }), reps(8, 8, 8));
    expect(acima.novoEstado.carga_atual_kg).toBe(107.5);
    expect((acima.evento?.para as { carga_kg: number }).carga_kg).toBe(107.5);
  });

  it("a prescrição do treino vence a prescrição padrão do catálogo", () => {
    // no Treino A o supino é 3 × 5 (e não 3 × 5–8 do catálogo)
    const estado = estadoDe(supino, { carga_atual_kg: 9.5 });
    const { evento } = decidir(supino, estado, reps(5, 5, 5), {
      prescricao: { ...prescricaoPadrao(supino), min: 5, max: 5 },
    });
    expect(evento?.motivo).toBe("subiu");
  });
});
