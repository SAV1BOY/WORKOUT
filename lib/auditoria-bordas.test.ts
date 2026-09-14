/**
 * Auditoria adversarial do motor — lente "bordas" (rodada 2).
 *
 * Bordas numéricas e de estoque (igualdade EXATA, nada de toBeCloseTo), séries
 * malformadas, estado parcial vindo do banco e datas na virada do ano.
 * Referências: SPEC.md §5.4, §6.1–§6.5 e docs/casos-de-teste-progressao.md.
 *
 * Os testes marcados "ACHADO" afirmam o que a spec/o doc pedem e falham com o
 * motor de hoje; o valor observado está no comentário de cada um.
 */
import { describe, expect, it } from "vitest";
import { acharExercicio, DIAS, exercicios } from "@/lib/dados";
import {
  alcancavelParaBaixo,
  cargaMaxima,
  cargaMinima,
  cargasPossiveis,
  limiteDoImplemento,
  montagem,
  PESO_BARRA_A_PESAR,
  type ImplementoMontagem,
} from "@/lib/montagem";
import * as C from "@/lib/calendario";
import * as P from "@/lib/progressao";
import type { DiaSemana } from "@/lib/schemas";

const ex = (id: string) => acharExercicio(id);

function estado(id: string, over: Partial<P.EstadoExercicio> = {}): P.EstadoExercicio {
  return { ...P.estadoInicial(ex(id)), ...over };
}

function reps(...valores: (number | null)[]): P.SerieFeita[] {
  return valores.map((r) => ({ concluida: true, reps: r }));
}

/** Centésimos inteiros: compara cargas sem passar por ponto flutuante. */
const c100 = (x: number) => Math.round(x * 100);

const COM_ANILHAS = [
  "barra_macica",
  "halteres",
  "barra_w",
  "barra_reta_oca",
  "polia",
] as const satisfies readonly ImplementoMontagem[];

/* ------------------------------------------------------------------ escala */

describe("escala do implemento: igualdade exata, sem resíduo de ponto flutuante", () => {
  it("barra maciça: 7,5 + 2k, 51 cargas de 7,5 a 107,5 (SPEC §6.4)", () => {
    const escala = cargasPossiveis("barra_macica");
    expect(escala).toHaveLength(51);
    escala.forEach((v, i) => expect(v).toBe(7.5 + 2 * i));
    expect(escala[escala.length - 1]).toBe(107.5);
    expect(cargaMinima("barra_macica")).toBe(7.5);
    expect(cargaMaxima("barra_macica")).toBe(107.5);
  });

  it("halteres: 1,5 + 2k até 39,5 por halter (teto 40, SPEC §6.4)", () => {
    const escala = cargasPossiveis("halteres");
    expect(escala).toHaveLength(20);
    escala.forEach((v, i) => expect(v).toBe(1.5 + 2 * i));
    expect(cargaMaxima("halteres")).toBe(39.5);
  });

  it("barra W: base 2,0 a pesar + 2k até 50 (doc: 52 → 50)", () => {
    expect(PESO_BARRA_A_PESAR).toBe(2);
    const escala = cargasPossiveis("barra_w");
    escala.forEach((v, i) => expect(v).toBe(2 + 2 * i));
    expect(cargaMaxima("barra_w")).toBe(50);
    expect(alcancavelParaBaixo(52, "barra_w")).toBe(50);
  });

  it("polia: todo inteiro de 0 a 100 no pino (SPEC §6.4)", () => {
    const escala = cargasPossiveis("polia");
    expect(escala).toHaveLength(101);
    escala.forEach((v, i) => expect(v).toBe(i));
  });

  it("os inválidos da tabela do doc caem exatamente na vizinha de baixo", () => {
    expect(alcancavelParaBaixo(26.5, "barra_macica")).toBe(25.5);
    expect(alcancavelParaBaixo(8, "barra_macica")).toBe(7.5);
    expect(alcancavelParaBaixo(110, "barra_macica")).toBe(107.5);
    expect(alcancavelParaBaixo(4.5, "halteres")).toBe(3.5);
    expect(alcancavelParaBaixo(6, "halteres")).toBe(5.5);
    expect(alcancavelParaBaixo(41.5, "halteres")).toBe(39.5);
    expect(alcancavelParaBaixo(0.5, "polia")).toBe(0);
    expect(alcancavelParaBaixo(101, "polia")).toBe(100);
  });

  it("alcancavelParaBaixo é idempotente em toda a escala", () => {
    for (const impl of COM_ANILHAS) {
      for (const carga of cargasPossiveis(impl)) {
        expect(alcancavelParaBaixo(carga, impl)).toBe(carga);
      }
    }
  });

  it("50 subidas encadeadas na barra: 7,5 → 107,5 sempre exatamente +2", () => {
    let carga = cargaMinima("barra_macica");
    for (let i = 0; i < 50; i++) {
      const proxima = alcancavelParaBaixo(carga + 2, "barra_macica");
      expect(c100(proxima) - c100(carga)).toBe(200);
      carga = proxima;
    }
    expect(carga).toBe(107.5);
  });
});

/* --------------------------------------------------------------- montagem */

describe("montagem: guloso contra o estoque (4 de cada peso)", () => {
  it("os exemplos literais do doc", () => {
    expect(montagem(25.5, "barra_macica").porLado).toEqual([5, 4]);
    expect(montagem(25.5, "barra_macica").total).toBe(25.5);
    expect(montagem(25.5, "barra_macica").exato).toBe(true);

    const fora = montagem(26.5, "barra_macica");
    expect(fora.porLado).toEqual([5, 4]);
    expect(fora.total).toBe(25.5);
    expect(fora.exato).toBe(false);
    expect(fora.diferenca).toBe(-1);

    expect(montagem(5.5, "halteres").porPonta).toEqual([2]);
    expect(montagem(107.5, "barra_macica").porLado).toEqual([
      10, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1,
    ]);

    const acima = montagem(109.5, "barra_macica");
    expect(acima.total).toBe(107.5);
    expect(acima.aviso).toBe("faltam anilhas de 10 kg");
  });

  it("2 anilhas por lado na barra, 1 por ponta no halter, soma e ordem certas", () => {
    const limite: Record<string, number> = {
      barra_macica: 2,
      barra_w: 2,
      barra_reta_oca: 2,
      halteres: 1,
      polia: 4,
    };
    for (const impl of COM_ANILHAS) {
      for (const carga of cargasPossiveis(impl)) {
        const m = montagem(carga, impl);
        const fator = impl === "polia" ? 1 : 2;
        const soma = m.anilhas.reduce((s, v) => s + v, 0);
        expect(c100(m.pesoBarra + fator * soma)).toBe(c100(carga));
        expect([...m.anilhas].sort((a, b) => b - a)).toEqual(m.anilhas);
        const contagem = new Map<number, number>();
        for (const a of m.anilhas) contagem.set(a, (contagem.get(a) ?? 0) + 1);
        for (const [, n] of contagem) expect(n).toBeLessThanOrEqual(limite[impl]!);
      }
    }
  });

  it("polia: as somas que exigem combinação fecham exatas", () => {
    for (const kg of [7, 9, 11, 13, 17, 19, 23]) {
      const m = montagem(kg, "polia");
      expect(m.exato).toBe(true);
      expect(m.noPino!.reduce((s, v) => s + v, 0)).toBe(kg);
    }
    expect(montagem(100, "polia").noPino!.reduce((s, v) => s + v, 0)).toBe(100);
  });

  it("o teto do halter e da barra W é a capacidade, não o estoque (SPEC §6.4)", () => {
    expect(limiteDoImplemento("barra_macica")).toBe("estoque");
    expect(limiteDoImplemento("halteres")).toBe("capacidade");
    expect(limiteDoImplemento("barra_w")).toBe("capacidade");
    expect(montagem(41.5, "halteres").aviso).toBeUndefined();
    expect(montagem(52, "barra_w").aviso).toBeUndefined();
  });

  it("toda carga_inicial do catálogo está na escala do seu implemento", () => {
    for (const e of exercicios) {
      const kg = e.carga_inicial.kg;
      if (kg === null) continue;
      expect(alcancavelParaBaixo(kg, e.implemento)).toBe(kg);
    }
  });
});

/* ------------------------------------------------------- −10 % e 60 % */

describe("carga × 0,9 e × 0,6 sempre alcançáveis para baixo (SPEC §6.4)", () => {
  it("varredura exata em todos os implementos com anilhas", () => {
    for (const impl of COM_ANILHAS) {
      const escala = cargasPossiveis(impl);
      for (const carga of escala) {
        for (const fator of [0.9, 0.6]) {
          const alvo = Math.round(c100(carga) * fator) / 100;
          let esperado = escala[0]!;
          for (const v of escala) if (c100(v) <= c100(alvo)) esperado = v;
          expect(alcancavelParaBaixo(carga * fator, impl)).toBe(esperado);
        }
      }
    }
  });

  it("os números do doc: 25,5 → 21,5 (caso 5) e 47,5 → 27,5 (caso 8)", () => {
    expect(alcancavelParaBaixo(25.5 * 0.9, "barra_macica")).toBe(21.5);
    expect(alcancavelParaBaixo(39.5 * 0.9, "barra_macica")).toBe(35.5);
    expect(alcancavelParaBaixo(47.5 * 0.6, "barra_macica")).toBe(27.5);
  });

  it("ACHADO: uma falha pode AUMENTAR a carga quando ela está abaixo da escala", () => {
    // SPEC §6.2: 2ª falha = carga × 0,90; §6.4: arredondar é sempre PARA BAIXO.
    // Linha do banco com 5 kg na barra maciça (abaixo da barra vazia):
    const sup = ex("supino-reto-com-barra");
    const d = P.decidir(sup, estado("supino-reto-com-barra", { carga_atual_kg: 5, falhas_seguidas: 1 }), reps(1, 1, 1));
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    // obtido: 7,5 — a "queda de 10 %" subiu a carga de 5 para 7,5
    expect(d.novoEstado.carga_atual_kg!).toBeLessThanOrEqual(5);

    // Caso real: a barra W pesada na balança (equipamentos.json manda pesar).
    const opcoes = { pesoBarra: 4.8 };
    const rosca = ex("rosca-com-barra-w");
    const dois = P.decidir(
      rosca,
      estado("rosca-com-barra-w", { carga_atual_kg: 2, falhas_seguidas: 1 }),
      reps(2, 2, 2),
      { montagem: opcoes },
    );
    // obtido: 4,8 — depois de duas falhas a carga sobe de 2,0 para 4,8 kg
    expect(dois.novoEstado.carga_atual_kg!).toBeLessThanOrEqual(2);

    const tres = P.decidir(
      rosca,
      estado("rosca-com-barra-w", { carga_atual_kg: 2, falhas_seguidas: 2 }),
      reps(2, 2, 2),
      { montagem: opcoes },
    );
    expect(tres.evento?.motivo).toBe("semana_leve_60");
    // obtido: 4,8 — a semana leve a 60 % também sobe a carga
    expect(tres.novoEstado.carga_atual_kg!).toBeLessThanOrEqual(2);
  });

  it("no piso da escala a queda não inventa carga menor que a barra vazia", () => {
    const sup = ex("supino-reto-com-barra");
    const d = P.decidir(sup, estado("supino-reto-com-barra", { carga_atual_kg: 7.5, falhas_seguidas: 1 }), reps(1, 1, 1));
    expect(d.novoEstado.carga_atual_kg).toBe(7.5);
  });
});

/* -------------------------------------------------- incremento reduzido */

describe("incremento reduzido: +4 vira 2 e +2 fica 2 exigindo topo + 1 rep", () => {
  it("caso 6 — agachamento (+4): 39,5 → 35,5 e incremento exatamente 2, sem rep extra", () => {
    const ag = ex("agachamento-livre");
    const d = P.decidir(ag, estado("agachamento-livre", { carga_atual_kg: 39.5, falhas_seguidas: 1 }), reps(5, 4, 3));
    expect(d.evento?.motivo).toBe("falha_2x_voltou_10");
    expect(d.novoEstado.carga_atual_kg).toBe(35.5);
    expect(d.novoEstado.exigir_rep_extra).toBe(false);
    expect(P.incrementoDe(ag, d.novoEstado)).toBe(2);
  });

  it("caso 5 — supino (+2): 25,5 → 21,5, incremento fica 2 e passa a exigir 9 reps", () => {
    const sup = ex("supino-reto-com-barra");
    const d = P.decidir(sup, estado("supino-reto-com-barra", { carga_atual_kg: 25.5, falhas_seguidas: 1 }), reps(7, 5, 3));
    expect(d.novoEstado.carga_atual_kg).toBe(21.5);
    expect(d.novoEstado.exigir_rep_extra).toBe(true);
    expect(P.incrementoDe(sup, d.novoEstado)).toBe(2);
    // topo da faixa (8) não basta; 8+1 sobe e limpa a exigência
    expect(P.decidir(sup, d.novoEstado, reps(8, 8, 8)).evento?.motivo).toBe("repetiu");
    const sobe = P.decidir(sup, d.novoEstado, reps(9, 9, 9));
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.carga_atual_kg).toBe(23.5);
    expect(sobe.novoEstado.exigir_rep_extra).toBe(false);
    expect(sobe.novoEstado.incremento_reduzido).toBe(false);
  });

  it("caso 7 — a subida depois da redução usa 2 kg e devolve o incremento normal", () => {
    const ag = ex("agachamento-livre");
    const d = P.decidir(
      ag,
      estado("agachamento-livre", { carga_atual_kg: 35.5, falhas_seguidas: 2, incremento_reduzido: true }),
      reps(5, 5, 5),
    );
    expect(d.novoEstado.carga_atual_kg).toBe(37.5);
    expect(d.novoEstado.falhas_seguidas).toBe(0);
    expect(P.incrementoDe(ag, d.novoEstado)).toBe(4);
  });

  it("o incremento nunca cai abaixo do passo mínimo de 2 kg", () => {
    for (const e of exercicios) {
      if (e.progressao.tipo !== "carga") continue;
      const base = e.progressao.incremento_kg ?? 0;
      if (base <= 0) continue;
      const reduzido = P.incrementoDe(e, { ...P.estadoInicial(e), incremento_reduzido: true });
      expect(reduzido).toBeGreaterThanOrEqual(P.PASSO_MINIMO_KG);
      expect(reduzido).toBe(Math.max(base / 2, P.PASSO_MINIMO_KG));
    }
  });

  it("semana leve: ida e volta exatas em toda a escala da barra", () => {
    const terra = ex("levantamento-terra");
    for (const carga of cargasPossiveis("barra_macica")) {
      const tres = P.decidir(terra, estado("levantamento-terra", { carga_atual_kg: carga, falhas_seguidas: 2 }), reps(0, 0, 0));
      expect(tres.evento?.motivo).toBe("semana_leve_60");
      expect(tres.novoEstado.carga_antes_leve).toBe(carga);
      expect(tres.novoEstado.carga_atual_kg).toBe(alcancavelParaBaixo(carga * 0.6, "barra_macica"));
      // a tela da semana leve tem que mostrar a mesma carga que o estado guardou
      expect(P.cargaDeHoje(terra, tres.novoEstado).carga_kg).toBe(tres.novoEstado.carga_atual_kg);
      const fim = P.decidir(terra, tres.novoEstado, reps(5, 5, 5));
      expect(fim.evento?.motivo).toBe("fim_semana_leve");
      expect(fim.novoEstado.carga_atual_kg).toBe(carga);
      expect(fim.novoEstado.incremento_reduzido).toBe(false);
    }
  });
});

/* ------------------------------------------------------------- séries */

describe("séries nulas, não concluídas, a mais e a menos que a prescrição", () => {
  const st = () => estado("supino-reto-com-barra", { carga_atual_kg: 9.5 });

  it("reps null e série não concluída contam falha (SPEC §6.2)", () => {
    const sup = ex("supino-reto-com-barra");
    const nula = P.decidir(sup, st(), reps(8, null, 8));
    expect(nula.evento?.motivo).toBe("repetiu");
    expect(nula.evento?.falha).toBe(true);
    expect(nula.novoEstado.falhas_seguidas).toBe(1);

    const aberta = P.decidir(sup, st(), [
      { concluida: true, reps: 8 },
      { concluida: false, reps: 8 },
      { concluida: true, reps: 8 },
    ]);
    expect(aberta.evento?.falha).toBe(true);
  });

  it("menos séries que a prescrição: falha na sessão concluída, nada na abandonada", () => {
    const sup = ex("supino-reto-com-barra");
    expect(P.decidir(sup, st(), reps(8, 8)).evento?.falha).toBe(true);
    const abandonada = P.decidir(sup, st(), reps(8, 8), { sessaoAbandonada: true });
    expect(abandonada.evento).toBeNull();
    expect(abandonada.novoEstado.carga_atual_kg).toBe(9.5);
  });

  it("série de trabalho a mais é avaliada junto (SPEC §6.2)", () => {
    const sup = ex("supino-reto-com-barra");
    expect(P.decidir(sup, st(), reps(8, 8, 8, 4)).evento?.falha).toBe(true);
    expect(P.decidir(sup, st(), reps(8, 8, 8, 8)).novoEstado.carga_atual_kg).toBe(11.5);
  });

  it("aquecimento não entra na conta", () => {
    const sup = ex("supino-reto-com-barra");
    const d = P.decidir(sup, st(), [
      { concluida: true, reps: 2, tipo: "aquecimento" },
      ...reps(8, 8, 8),
    ]);
    expect(d.novoEstado.carga_atual_kg).toBe(11.5);
    expect(P.decidir(sup, st(), [{ concluida: true, reps: 2, tipo: "aquecimento" }]).evento).toBeNull();
  });

  it("unilateral: vale o menor lado; lado 2 ausente não derruba o motor", () => {
    const rosca = ex("rosca-alternada");
    const base = estado("rosca-alternada", { carga_atual_kg: 1.5 });
    // caso 10: 12/12, 12/12, 12/11 → repetiu
    const caso10 = P.decidir(rosca, base, [
      { concluida: true, reps: 12, reps_lado2: 12 },
      { concluida: true, reps: 12, reps_lado2: 12 },
      { concluida: true, reps: 12, reps_lado2: 11 },
    ]);
    expect(caso10.evento?.motivo).toBe("repetiu");
    expect(caso10.evento?.falha).toBeUndefined();
    // caso 11: 12/12 nas três → 3,5 por halter
    const caso11 = P.decidir(rosca, base, [
      { concluida: true, reps: 12, reps_lado2: 12 },
      { concluida: true, reps: 12, reps_lado2: 12 },
      { concluida: true, reps: 12, reps_lado2: 12 },
    ]);
    expect(caso11.novoEstado.carga_atual_kg).toBe(3.5);
    // só um lado registrado: vale o lado registrado, sem NaN nem falha
    expect(P.decidir(rosca, base, reps(12, 12, 12)).novoEstado.carga_atual_kg).toBe(3.5);
    // lado 1 nulo continua sendo falha
    expect(
      P.decidir(rosca, base, [
        { concluida: true, reps: null, reps_lado2: 12 },
        { concluida: true, reps: 12, reps_lado2: 12 },
        { concluida: true, reps: 12, reps_lado2: 12 },
      ]).evento?.falha,
    ).toBe(true);
  });

  it("tempo unilateral (prancha lateral) também vale pelo menor lado", () => {
    const pl = ex("prancha-lateral");
    const base = estado("prancha-lateral");
    expect(base.tempo_alvo_s).toBe(20);
    const cheio = P.decidir(pl, base, [40, 40, 40].map((t) => ({ concluida: true, tempo_s: t, tempo_s_lado2: t })));
    expect(cheio.novoEstado.tempo_alvo_s).toBe(45);
    const torto = P.decidir(pl, base, [40, 40, 40].map((t) => ({ concluida: true, tempo_s: t, tempo_s_lado2: 25 })));
    expect(torto.evento?.motivo).toBe("repetiu");
  });
});

/* -------------------------------------------- estado parcial do banco */

describe("estado com campos null vindos do banco (colunas anuláveis do schema)", () => {
  it("ACHADO: cargaDeHoje ignora o fallback da §6.1 que decidir aplica", () => {
    // exercise_state.carga_atual_kg e .assistencia são NULL-áveis em
    // supabase/schema.sql. decidir() lê null como carga_inicial / pé inteiro;
    // cargaDeHoje() devolve null e montagem null — a tela fica sem carga e sem
    // chips, e no fim da sessão o motor "sobe" para 9,5 kg do nada.
    const sup = ex("supino-reto-com-barra");
    const semCarga = estado("supino-reto-com-barra", { carga_atual_kg: null });
    expect(P.decidir(sup, semCarga, reps(8, 8, 8)).novoEstado.carga_atual_kg).toBe(9.5);

    const hoje = P.cargaDeHoje(sup, semCarga);
    // obtido: carga_kg = null e montagem = null
    expect(hoje.carga_kg).toBe(7.5);
    expect(hoje.montagem?.total).toBe(7.5);

    const assistida = ex("barra-fixa-assistida");
    const semDegrau = estado("barra-fixa-assistida", { assistencia: null });
    expect(P.decidir(assistida, semDegrau, reps(8, 8, 8, 8)).novoEstado.assistencia).toBe("joelho");
    // obtido: null — a tela não mostra em que degrau o elástico está
    expect(P.cargaDeHoje(assistida, semDegrau).assistencia).toBe("pe_inteiro");
  });

  it("reps_alvo e tempo_alvo_s nulos caem na faixa da prescrição (§6.1)", () => {
    const pernas = ex("elevacao-de-pernas-na-barra-fixa");
    expect(P.cargaDeHoje(pernas, estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: null })).alvo_max).toBe(15);
    const prancha = ex("prancha");
    const hoje = P.cargaDeHoje(prancha, estado("prancha", { tempo_alvo_s: null }));
    expect(hoje.tempo_alvo_s).toBe(30);
    expect(hoje.alvo_max).toBe(60);
  });

  it("semana_leve sem carga_antes_leve usa a carga atual e volta para ela", () => {
    const terra = ex("levantamento-terra");
    const st = estado("levantamento-terra", { carga_atual_kg: 27.5, semana_leve: true, carga_antes_leve: null });
    expect(P.cargaDeHoje(terra, st).carga_kg).toBe(27.5);
    const fim = P.decidir(terra, st, reps(5, 5, 5));
    expect(fim.evento?.motivo).toBe("fim_semana_leve");
    expect(fim.novoEstado.carga_atual_kg).toBe(27.5);
    expect(fim.novoEstado.semana_leve).toBe(false);
  });

  it("nenhuma carreira aleatória produz NaN, carga fora da escala ou falhas > 2", () => {
    let semente = 20260914;
    const aleatorio = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (const e of exercicios) {
      if (e.progressao.tipo === "plano_corda") continue;
      const pres = P.prescricaoPadrao(e);
      let st: P.EstadoExercicio | null = null;
      for (let i = 0; i < 120; i++) {
        const series: P.SerieFeita[] = Array.from({ length: pres.series }, () => {
          const v = Math.floor(aleatorio() * ((pres.max ?? 10) + 4));
          return { concluida: aleatorio() > 0.05, reps: v, reps_lado2: v, tempo_s: v, tempo_s_lado2: v, passos: v };
        });
        const anterior = st;
        const d = P.decidir(e, st, series, { ultimaFirme: aleatorio() > 0.3, seriesAnteriores: [3, 3, 3] });
        st = d.novoEstado;
        expect(st.falhas_seguidas).toBeGreaterThanOrEqual(0);
        expect(st.falhas_seguidas).toBeLessThanOrEqual(2);
        expect(st.sessoes_graca).toBeGreaterThanOrEqual(0);
        if (st.carga_atual_kg !== null) {
          expect(Number.isFinite(st.carga_atual_kg)).toBe(true);
          expect(alcancavelParaBaixo(st.carga_atual_kg, e.implemento)).toBe(st.carga_atual_kg);
        }
        if (st.semana_leve) expect(st.carga_antes_leve).not.toBeNull();
        if (d.evento?.motivo === "repetiu" && anterior) {
          expect(st.carga_atual_kg).toBe(anterior.carga_atual_kg);
        }
        const hoje = P.cargaDeHoje(e, st, pres);
        if (hoje.carga_kg !== null && hoje.montagem) {
          expect(hoje.montagem.total).toBe(hoje.carga_kg);
        }
      }
    }
  });
});

/* ------------------------------------------------------- barra a pesar */

describe("barra W e barra reta oca: peso a pesar (equipamentos.json manda pesar)", () => {
  it("sem pesar, valem 2,0 kg e os três exercícios de barra W começam na barra vazia", () => {
    for (const e of exercicios.filter((x) => x.implemento === "barra_w")) {
      expect(e.carga_inicial.kg).toBe(PESO_BARRA_A_PESAR);
    }
    expect(montagem(2, "barra_w").pesoBarra).toBe(2);
    expect(cargaMaxima("barra_reta_oca")).toBe(60);
  });

  it("ACHADO: com a barra pesada, cargaDeHoje mostra uma carga que não se monta", () => {
    // SPEC §6.4: toda carga calculada é arredondada para uma carga possível;
    // §6.5: a montagem é a da carga do dia. Com { pesoBarra } a carga inicial
    // de 2,0 kg do JSON fica abaixo da escala (4,8 + 2k) e não é reprojetada.
    const rosca = ex("rosca-com-barra-w");
    const opcoes = { pesoBarra: 4.8 };
    const hoje = P.cargaDeHoje(rosca, null, P.prescricaoPadrao(rosca), opcoes);
    // obtido: carga_kg = 2, montagem.total = 4,8 e exato = false
    expect(hoje.montagem?.total).toBe(hoje.carga_kg);
    expect(hoje.montagem?.exato).toBe(true);
    expect(alcancavelParaBaixo(hoje.carga_kg!, "barra_w", opcoes)).toBe(hoje.carga_kg);
  });
});

/* --------------------------------------------------------- tipo maximo */

describe("tipo maximo e as sugestões (SPEC §6.3)", () => {
  it("caso 15: 4,4,4 → 5,5,5 sobe; série abaixo da anterior segura a subida", () => {
    const bf = ex("barra-fixa-pronada");
    const st = estado("barra-fixa-pronada", { reps_alvo: 4 });
    expect(P.decidir(bf, st, reps(5, 5, 5), { seriesAnteriores: [4, 4, 4] }).evento?.motivo).toBe("subiu");
    expect(P.decidir(bf, st, reps(3, 5, 7), { seriesAnteriores: [4, 4, 4] }).evento?.motivo).toBe("repetiu");
    expect(P.decidir(bf, st, reps(4, 4, 7), { seriesAnteriores: [4, 4, 4] }).evento?.motivo).toBe("subiu");
  });

  it("+1 rep em todas as séries sobe mesmo quando a média é dízima", () => {
    const bf = ex("barra-fixa-pronada");
    const st = estado("barra-fixa-pronada", { reps_alvo: 3 });
    expect(P.decidir(bf, st, reps(4, 4, 5), { seriesAnteriores: [3, 3, 4] }).evento?.motivo).toBe("subiu");
    expect(P.decidir(bf, st, reps(9, 9, 8), { seriesAnteriores: [8, 8, 7] }).evento?.motivo).toBe("subiu");
  });

  it("ACHADO: 3 séries de 10 na primeira sessão não sugerem o lastro", () => {
    // SPEC §6.3 e caso 15: "quando 3 séries chegam a 10, sugerir Barra fixa com
    // lastro". Sem sessão anterior o motor devolve evento null e engole a
    // sugestão. Obtido: evento = null.
    const bf = ex("barra-fixa-pronada");
    const primeira = P.decidir(bf, null, reps(10, 10, 10));
    expect(primeira.evento).not.toBeNull();
    expect(primeira.evento?.sugestao ?? "(nenhuma)").toMatch(/lastro/i);
  });

  it("com referência anterior a sugestão do lastro sai em qualquer motivo", () => {
    const bf = ex("barra-fixa-pronada");
    const st = estado("barra-fixa-pronada", { reps_alvo: 10 });
    expect(P.decidir(bf, st, reps(10, 10, 10), { seriesAnteriores: [10, 10, 10] }).evento?.sugestao).toMatch(/lastro/i);
    expect(P.decidir(bf, st, reps(10, 10, 10), { seriesAnteriores: [9, 9, 9] }).evento?.sugestao).toMatch(/lastro/i);
  });

  it("caso 17: elevação de pernas 15,15,15 → alvo 16 e sugestão da anilha aos 20", () => {
    const pernas = ex("elevacao-de-pernas-na-barra-fixa");
    const st = estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 10 });
    const sobe = P.decidir(pernas, st, reps(15, 15, 15));
    expect(sobe.evento?.motivo).toBe("subiu");
    expect(sobe.novoEstado.reps_alvo).toBe(16);
    const vinte = P.decidir(pernas, estado("elevacao-de-pernas-na-barra-fixa", { reps_alvo: 20 }), reps(20, 20, 20));
    expect(vinte.evento?.sugestao).toMatch(/anilha/i);
  });

  it("caso 22: no teto da barra a subida vira repetiu com o aviso das anilhas", () => {
    const sup = ex("supino-reto-com-barra");
    const d = P.decidir(sup, estado("supino-reto-com-barra", { carga_atual_kg: 107.5 }), reps(8, 8, 8));
    expect(d.evento?.motivo).toBe("repetiu");
    expect(d.evento?.aviso).toBe("faltam anilhas de 10 kg (marco do guia)");
    expect(d.novoEstado.carga_atual_kg).toBe(107.5);
  });
});

/* -------------------------------------------------------- calendário */

describe("datas na virada do ano, com a semana começando na segunda (SPEC §1, §5)", () => {
  const perfil = { fase_atual: "fase1" as const, ultimo_treino: null, fase_desde: "2026-09-14" };

  it("01/01/2027 é sexta e a semana dele começa em 28/12/2026", () => {
    expect(C.diaDaSemana("2027-01-01")).toBe("sex");
    expect(C.iso(C.inicioDaSemana("2027-01-01"))).toBe("2026-12-28");
    expect(C.diasDaSemana("2027-01-01").map(C.iso)).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31",
      "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
  });

  it("a semana da fase não reinicia no ano novo", () => {
    expect(C.semanaDaFase("2026-09-14", "2026-09-14")).toBe(1);
    expect(C.semanaDaFase("2026-12-31", "2026-09-14")).toBe(16);
    expect(C.semanaDaFase("2027-01-03", "2026-09-14")).toBe(16);
    expect(C.semanaDaFase("2027-01-04", "2026-09-14")).toBe(17);
  });

  it("a semana que cruza o ano mantém os dias do programa e a alternância", () => {
    const semana = C.semanaDoPlano("2026-12-31", perfil);
    expect(semana.map((d) => d.dia)).toEqual([...DIAS]);
    expect(semana.map((d) => d.tipo)).toEqual([
      "forca", "cardio", "forca", "descanso", "forca", "cardio", "descanso",
    ]);
    expect(semana.filter((d) => d.treinoId).map((d) => d.treinoId)).toEqual(["A1", "B1", "A1"]);
    expect(semana[4]!.data).toBe("2027-01-01");
  });

  it("o que falta na semana compara datas de anos diferentes na ordem certa", () => {
    const semana = C.semanaDoPlano("2026-12-31", perfil);
    const r = C.oQueFaltaNaSemana(semana, [{ data: "2026-12-28", tipo: "forca" }], "2027-01-01");
    expect(r.feitos.map((d) => d.data)).toEqual(["2026-12-28"]);
    expect(r.perdidos.map((d) => d.data)).toEqual(["2026-12-29", "2026-12-30"]);
    expect(r.faltando.map((d) => d.data)).toEqual(["2027-01-01", "2027-01-02"]);
    expect(r.total).toBe(5);
  });

  it("a Fase 2 conta 12 semanas civis e 30 sessões, mesmo cruzando o ano", () => {
    expect(C.sugerirFase2(perfil, 30, "2026-11-30").sugerir).toBe(false);
    expect(C.sugerirFase2(perfil, 30, "2026-12-07").sugerir).toBe(true);
    expect(C.sugerirFase2(perfil, 29, "2027-01-04").sugerir).toBe(false);
    expect(C.sugerirFase2(perfil, 30, "2027-01-04").sugerir).toBe(true);
    expect(C.adiarFase2("2026-12-28")).toBe("2027-01-11");
    const adiado = { ...perfil, prefs: { fase2_adiada_ate: "2027-01-11" } };
    expect(C.sugerirFase2(adiado, 30, "2027-01-04").sugerir).toBe(false);
    expect(C.sugerirFase2(adiado, 30, "2027-01-11").sugerir).toBe(true);
  });

  it("as semanas dos planos não passam de 12 e repetem com menos de 2 sessões", () => {
    expect(C.avancarSemanaDeCorrida(11, 1)).toBe(11);
    expect(C.avancarSemanaDeCorrida(11, 2)).toBe(12);
    expect(C.avancarSemanaDeCorrida(12, 2)).toBe(12);
    expect(C.avancarSemanaDeCorda(12, 2)).toBe(12);
    expect(C.avancarSemanaDeBarraFixa(12, 3)).toBe(12);
  });
});

describe("semana curta (SPEC §5.4 e programa.json semana_curta)", () => {
  const semanaDe = (ultimo: "A1" | "B1" | null) =>
    C.semanaDoPlano("2026-09-14", { fase_atual: "fase1", ultimo_treino: ultimo });

  it("corta primeiro a corrida de sábado, depois a outra sessão de cardio", () => {
    const semana = semanaDe(null);
    const tres = C.semanaCurta(["qui", "sab", "dom", "ter"] as DiaSemana[], semana);
    expect(tres.capacidade).toBe(3);
    expect(tres.cortados.map((c) => c.dia)).toEqual(["sab", "ter"]);
    expect(tres.dias.filter((d) => d.tipo !== "descanso").map((d) => d.treinoId)).toEqual(["A1", "B1", "A1"]);
  });

  it("nenhum treino protegido é cortado enquanto sobrar alternativa", () => {
    const protegidos = C.treinosComAgachamentoOuTerra();
    expect(protegidos).toEqual(["A1", "B1", "IA", "IB"]);
    for (const fase of ["fase1", "fase2"] as const) {
      const semana = C.semanaDoPlano("2026-09-14", { fase_atual: fase, ultimo_treino: null });
      for (let mascara = 0; mascara < 128; mascara++) {
        const marcados = DIAS.filter((_, i) => (mascara >> i) & 1);
        const r = C.semanaCurta(marcados as DiaSemana[], semana);
        const restam = r.dias.filter((d) => d.tipo !== "descanso");
        expect(restam.length).toBeLessThanOrEqual(r.capacidade);
        expect(restam.length + r.cortados.length).toBe(semana.filter((d) => d.tipo !== "descanso").length);
        for (const d of restam) expect(marcados).not.toContain(d.dia);
        const cortouProtegido = r.cortados.some((c) => c.treinoId && protegidos.includes(c.treinoId));
        const sobrouAlternativa = restam.some(
          (d) => d.tipo === "cardio" || (d.treinoId !== null && !protegidos.includes(d.treinoId)),
        );
        expect(cortouProtegido && sobrouAlternativa).toBe(false);
      }
    }
  });

  it("ACHADO: sobrando um dia só na Fase 1, o treino que fica não é o Treino A", () => {
    // SPEC §5.4 e data/programa.json semana_curta.regra: "se sobrar um dia, que
    // seja o Treino A completo". O motor só mantém o primeiro dia da semana, e
    // com ultimo_treino = "A1" a alternância põe B1 na segunda — B1 é o treino
    // do levantamento terra. Obtido: "B1".
    const soUmDia = ["ter", "qua", "qui", "sex", "sab", "dom"] as DiaSemana[];
    for (const ultimo of [null, "A1", "B1"] as const) {
      const r = C.semanaCurta(soUmDia, semanaDe(ultimo));
      const restam = r.dias.filter((d) => d.tipo !== "descanso");
      expect(restam).toHaveLength(1);
      expect(restam[0]!.treinoId).toBe("A1");
    }
  });
});
