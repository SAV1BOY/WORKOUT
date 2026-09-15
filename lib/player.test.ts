/**
 * A máquina de estados do player (SPEC §14.1). Aqui se testa a sequência de
 * passos, a navegação, o relógio do descanso e o mapeamento do feedback —
 * nada de React nem de banco.
 */
import { describe, expect, it } from "vitest";
import { acharExercicio } from "@/lib/dados";
import {
  DESCANSO_MAX_S,
  DESCANSO_MIN_S,
  EXTRA_DESCANSO_S,
  OPCOES_DE_FEEDBACK,
  PREPARACAO_PADRAO_S,
  anterior,
  anterioresPorExercicio,
  apos,
  definirDuracao,
  descansoDoBloco,
  entradaDoPasso,
  estadoDoPasso,
  fracaoRestante,
  indiceDaChave,
  indiceDeRetomada,
  posicaoNaSequencia,
  restanteS,
  rotuloDaSensacao,
  rotuloDoPasso,
  seguinte,
  sequenciaDoPlayer,
  serieAnteriorDe,
  serieDoPasso,
  somarSegundos,
  totalDeSeries,
  zerou,
  type Passo,
  type PassoSerie,
} from "@/lib/player";
import { prescricaoPadrao } from "@/lib/progressao";
import {
  marcarSerie,
  montarSessao,
  montarSessaoAvulsa,
  type ItemDaSessao,
  type SessaoLocal,
} from "@/lib/sessao";

function contador(prefixo = "s") {
  let n = 0;
  return () => `${prefixo}${++n}`;
}

function sessaoA(): SessaoLocal {
  return montarSessao({
    id: "sess-1",
    userId: "u1",
    data: "2026-09-14",
    treinoId: "A1",
    fase: "fase1",
    agora: "2026-09-14T09:00:00.000Z",
    novoId: contador(),
  });
}

function item(id: string, descansoS = 60): ItemDaSessao {
  return {
    exercicioId: id,
    prescricao: prescricaoPadrao(acharExercicio(id)),
    descansoS,
    descansoTexto: `${descansoS} s`,
  };
}

function sessaoCom(ids: string[], descansoS = 60): SessaoLocal {
  return montarSessaoAvulsa({
    id: "sess-livre",
    userId: "u1",
    data: "2026-09-14",
    workoutId: "livre",
    fase: "fase1",
    agora: "2026-09-14T09:00:00.000Z",
    novoId: contador("l"),
    itens: ids.map((id) => item(id, descansoS)),
  });
}

/** Marca todas as séries de um bloco (é o que o ✓ do player faz). */
function fazerBloco(sessao: SessaoLocal, ordem: number): SessaoLocal {
  let s = sessao;
  const bloco = s.blocos.find((b) => b.ordem === ordem);
  if (!bloco) throw new Error("bloco ausente");
  for (const serie of bloco.series) {
    s = marcarSerie(s, ordem, serie.id, true, "2026-09-14T09:30:00.000Z");
  }
  return s;
}

describe("sequenciaDoPlayer — Treino A (SPEC §14.1)", () => {
  const sessao = sessaoA();
  const seq = sequenciaDoPlayer(sessao);

  it("abre na preparação com o primeiro exercício e fecha na conclusão", () => {
    expect(seq[0]).toMatchObject({
      tipo: "preparacao",
      segundos: PREPARACAO_PADRAO_S,
      exercicioId: "agachamento-livre",
    });
    expect(seq[seq.length - 2]?.tipo).toBe("feedback");
    expect(seq[seq.length - 1]?.tipo).toBe("conclusao");
  });

  it("põe os dois aquecimentos do agachamento antes das três séries de trabalho", () => {
    const doAgachamento = seq.filter(
      (p): p is PassoSerie => p.tipo === "serie" && p.exercicioId === "agachamento-livre",
    );
    expect(doAgachamento.map((p) => rotuloDoPasso(p))).toEqual([
      "Aquecimento 1 de 2",
      "Aquecimento 2 de 2",
      "Série 1 de 3",
      "Série 2 de 3",
      "Série 3 de 3",
    ]);
    // o aquecimento é um só no treino inteiro (SPEC §3.2)
    const aquecimentos = seq.filter((p) => p.tipo === "serie" && p.aquecimento);
    expect(aquecimentos).toHaveLength(2);
  });

  it("tem 18 passos de série (16 de trabalho + 2 de aquecimento) e 6 'firme?'", () => {
    expect(totalDeSeries(seq)).toBe(18);
    const firmes = seq.filter((p) => p.tipo === "firme");
    expect(firmes).toHaveLength(6);
    expect(firmes[0]).toMatchObject({ ordem: 1, exercicioId: "agachamento-livre" });
  });

  it("descansa entre as séries e entre os exercícios, com o tempo do JSON", () => {
    const i = seq.findIndex((p) => p.tipo === "serie" && p.chave.startsWith("serie:"));
    expect(seq[i + 1]).toMatchObject({ tipo: "descanso", segundos: 150 });

    const entre = seq.filter((p) => p.tipo === "descanso" && p.entreExercicios);
    // cinco emendas entre os seis exercícios
    expect(entre).toHaveLength(5);
    // o descanso entre exercícios vem DEPOIS da pergunta "firme?"
    const iFirme = seq.findIndex((p) => p.tipo === "firme");
    expect(seq[iFirme + 1]).toMatchObject({ tipo: "descanso", entreExercicios: true });
    // a remada curvada descansa 90 s (data/programa.json)
    const remada = seq.findIndex(
      (p) => p.tipo === "serie" && p.exercicioId === "remada-curvada-pronada",
    );
    expect(seq[remada + 1]).toMatchObject({ tipo: "descanso", segundos: 90 });
  });

  it("não põe descanso depois da última série do último exercício", () => {
    const iFeedback = indiceDaChave(seq, "feedback");
    expect(seq[iFeedback - 1]?.tipo).toBe("firme");
  });

  it("a posição do exercício acompanha o passo (PRÓXIMO n/N)", () => {
    const primeira = seq.find((p): p is PassoSerie => p.tipo === "serie");
    expect(primeira).toMatchObject({ posicao: 1, totalExercicios: 6 });
    const ultima = [...seq]
      .reverse()
      .find((p): p is PassoSerie => p.tipo === "serie");
    expect(ultima).toMatchObject({ posicao: 6, totalExercicios: 6 });
  });
});

describe("sequenciaDoPlayer — preferências", () => {
  it("preparação 0 tira a tela de preparação", () => {
    const seq = sequenciaDoPlayer(sessaoA(), { preparacaoS: 0 });
    expect(seq[0]?.tipo).toBe("serie");
  });

  it("o descanso padrão das prefs vence o do exercício", () => {
    const seq = sequenciaDoPlayer(sessaoA(), { descansoPadraoS: 45 });
    const descansos = seq.filter((p) => p.tipo === "descanso");
    expect(descansos.every((d) => d.segundos === 45)).toBe(true);
  });

  it("descanso do exercício em 0 não cria passo de descanso", () => {
    const sessao = sessaoCom(["prancha"], 0);
    const seq = sequenciaDoPlayer(sessao);
    expect(seq.some((p) => p.tipo === "descanso")).toBe(false);
    expect(descansoDoBloco(sessao.blocos[0]!, {})).toBe(0);
  });
});

describe("entradaDoPasso — o bloco central por tipo (SPEC §14.1.2)", () => {
  function entrada(id: string, indice = 0) {
    const sessao = sessaoCom([id]);
    const bloco = sessao.blocos[0]!;
    const serie = bloco.series.filter((s) => s.tipo === "trabalho")[indice]!;
    return entradaDoPasso(bloco, serie);
  }

  it("barra com carga", () => {
    expect(entrada("agachamento-livre")).toMatchObject({
      tipo: "carga",
      comCarga: true,
      unilateral: false,
    });
  });

  it("peso corporal por reps", () => {
    expect(entrada("abdominal-cruzado")).toMatchObject({
      tipo: "reps",
      comCarga: false,
      unilateral: true,
    });
  });

  it("tempo", () => {
    expect(entrada("prancha")).toMatchObject({ tipo: "tempo", comCarga: false });
  });

  it("tempo unilateral (prancha lateral: D e E)", () => {
    expect(entrada("prancha-lateral")).toMatchObject({
      tipo: "tempo",
      unilateral: true,
    });
  });

  it("máximo", () => {
    expect(entrada("flexao-de-braco")).toMatchObject({ tipo: "maximo" });
  });

  it("assistida (degrau do elástico)", () => {
    expect(entrada("barra-fixa-assistida")).toMatchObject({ tipo: "assistida" });
  });

  it("passos (farmer's walk)", () => {
    expect(entrada("farmer-s-walk")).toMatchObject({
      tipo: "passos",
      comCarga: true,
    });
  });

  it("o aquecimento é sempre reps com carga", () => {
    const sessao = sessaoA();
    const bloco = sessao.blocos[0]!;
    const aquecimento = bloco.series.find((s) => s.tipo === "aquecimento")!;
    expect(entradaDoPasso(bloco, aquecimento)).toMatchObject({
      tipo: "carga",
      comCarga: true,
      unilateral: false,
    });
  });
});

describe("retomar (SPEC §14.1 e §8)", () => {
  it("sem nada marcado, retoma na preparação", () => {
    const sessao = sessaoA();
    const seq = sequenciaDoPlayer(sessao);
    expect(indiceDeRetomada(seq, sessao)).toBe(0);
  });

  it("com o primeiro exercício feito, retoma na primeira série que falta", () => {
    const sessao = fazerBloco(sessaoA(), 1);
    const seq = sequenciaDoPlayer(sessao);
    const i = indiceDeRetomada(seq, sessao);
    const passo = seq[i] as PassoSerie;
    expect(passo.tipo).toBe("serie");
    expect(passo.exercicioId).toBe("supino-reto-com-barra");
    expect(serieDoPasso(sessao, passo)?.concluida).toBe(false);
  });

  it("com tudo feito, retoma no feedback", () => {
    let sessao = sessaoA();
    for (const bloco of sessao.blocos) sessao = fazerBloco(sessao, bloco.ordem);
    const seq = sequenciaDoPlayer(sessao);
    expect(seq[indiceDeRetomada(seq, sessao)]?.tipo).toBe("feedback");
  });

  it("a chave do passo salvo acha o mesmo passo na sequência refeita", () => {
    const sessao = sessaoA();
    const seq = sequenciaDoPlayer(sessao);
    const chave = seq[5]?.chave ?? "";
    expect(indiceDaChave(sequenciaDoPlayer(sessao), chave)).toBe(5);
    expect(indiceDaChave(seq, "não existe")).toBe(-1);
  });
});

describe("navegação", () => {
  const sessao = sessaoA();
  const seq = sequenciaDoPlayer(sessao);

  it("o ✓ leva ao passo seguinte (o descanso)", () => {
    const i = seq.findIndex((p) => p.tipo === "serie");
    expect(seq[apos(seq, i)]?.tipo).toBe("descanso");
  });

  it("'pular' no descanso vai para o passo que ele anuncia", () => {
    const i = seq.findIndex((p) => p.tipo === "descanso");
    const descanso = seq[i];
    if (descanso?.tipo !== "descanso") throw new Error("descanso ausente");
    expect(descanso.indiceProximo).toBe(i + 1);
    expect(seq[descanso.indiceProximo]?.tipo).toBe("serie");
  });

  it("as setas anterior/próximo pulam os descansos", () => {
    const i = seq.findIndex((p) => p.tipo === "serie");
    const proximo = seguinte(seq, i);
    expect(seq[proximo]?.tipo).toBe("serie");
    expect(anterior(seq, proximo)).toBe(i);
  });

  it("anterior no primeiro passo fica no primeiro; próximo no fim fica no fim", () => {
    expect(anterior(seq, 0)).toBe(0);
    expect(seguinte(seq, seq.length - 1)).toBe(seq.length - 1);
    expect(apos(seq, seq.length - 1)).toBe(seq.length - 1);
  });

  it("a posição na barra de progresso conta só as séries", () => {
    expect(posicaoNaSequencia(seq, 0)).toBe(0);
    const i = seq.findIndex((p) => p.tipo === "serie");
    expect(posicaoNaSequencia(seq, i)).toBe(1);
    expect(posicaoNaSequencia(seq, seq.length - 1)).toBe(18);
  });
});

describe("relógio do descanso (ancorado em Date.now)", () => {
  const agora = 1_700_000_000_000;
  const passo: Passo = {
    tipo: "descanso",
    chave: "descanso:serie:1",
    segundos: 150,
    entreExercicios: false,
    indiceProximo: 3,
  };

  it("começa com a duração inteira e anda com o relógio", () => {
    const estado = estadoDoPasso(passo, agora);
    expect(estado.totalS).toBe(150);
    expect(restanteS(estado, agora)).toBe(150);
    expect(restanteS(estado, agora + 30_000)).toBe(120);
    expect(fracaoRestante(estado, agora + 75_000)).toBeCloseTo(0.5, 5);
    expect(zerou(estado, agora + 149_000)).toBe(false);
    expect(zerou(estado, agora + 150_000)).toBe(true);
    // nunca negativo: a tela mostra 0, não -12
    expect(restanteS(estado, agora + 500_000)).toBe(0);
  });

  it("+20 s empurra o que falta, não recomeça", () => {
    const estado = estadoDoPasso(passo, agora);
    const depois = somarSegundos(estado, EXTRA_DESCANSO_S, agora + 140_000);
    expect(restanteS(depois, agora + 140_000)).toBe(30);
    expect(depois.totalS).toBe(170);
  });

  it("+20 s depois de zerar conta a partir de agora", () => {
    const estado = estadoDoPasso(passo, agora);
    const depois = somarSegundos(estado, EXTRA_DESCANSO_S, agora + 300_000);
    expect(restanteS(depois, agora + 300_000)).toBe(20);
  });

  it("editar o tempo recomeça a contagem e respeita os limites", () => {
    const estado = estadoDoPasso(passo, agora);
    const curto = definirDuracao(estado, 45, agora + 10_000);
    expect(restanteS(curto, agora + 10_000)).toBe(45);
    expect(definirDuracao(estado, 1, agora).totalS).toBe(DESCANSO_MIN_S);
    expect(definirDuracao(estado, 99_999, agora).totalS).toBe(DESCANSO_MAX_S);
  });

  it("passo sem relógio não conta tempo", () => {
    const estado = estadoDoPasso({ tipo: "feedback", chave: "feedback" }, agora);
    expect(estado.fimEm).toBeNull();
    expect(restanteS(estado, agora + 10_000)).toBe(0);
    expect(somarSegundos(estado, 20, agora)).toEqual(estado);
  });
});

describe("feedback → sessions.sensacao (SPEC §14.1.4)", () => {
  it("1 = muito difícil … 5 = muito fácil, na ordem da referência", () => {
    expect(OPCOES_DE_FEEDBACK.map((o) => o.valor)).toEqual([5, 4, 3, 2, 1]);
    expect(OPCOES_DE_FEEDBACK.map((o) => o.rotulo)).toEqual([
      "Muito fácil",
      "Um pouco fácil",
      "Na medida certa",
      "Um pouco difícil",
      "Muito difícil",
    ]);
  });

  it("o rótulo volta do número gravado", () => {
    expect(rotuloDaSensacao(1)).toBe("Muito difícil");
    expect(rotuloDaSensacao(3)).toBe("Na medida certa");
    expect(rotuloDaSensacao(5)).toBe("Muito fácil");
    expect(rotuloDaSensacao(null)).toBeNull();
    expect(rotuloDaSensacao(9)).toBeNull();
  });
});

describe("anterior: 9,5 kg × 5 (SPEC §14.1.2)", () => {
  const linhas = [
    {
      exercise_id: "agachamento-livre",
      session_id: "antiga",
      set_index: 1,
      tipo: "trabalho",
      concluida: true,
      registrada_em: "2026-09-07T10:00:00.000Z",
      reps: 5,
      carga_kg: 9.5,
      tempo_s: null,
    },
    {
      exercise_id: "agachamento-livre",
      session_id: "antiga",
      set_index: 2,
      tipo: "trabalho",
      concluida: true,
      registrada_em: "2026-09-07T10:05:00.000Z",
      reps: 4,
      carga_kg: 9.5,
      tempo_s: null,
    },
    {
      exercise_id: "agachamento-livre",
      session_id: "de-hoje",
      set_index: 1,
      tipo: "trabalho",
      concluida: true,
      registrada_em: "2026-09-14T10:00:00.000Z",
      reps: 5,
      carga_kg: 11.5,
      tempo_s: null,
    },
    {
      exercise_id: "agachamento-livre",
      session_id: "antiga",
      set_index: 3,
      tipo: "aquecimento",
      concluida: true,
      registrada_em: "2026-09-07T09:55:00.000Z",
      reps: 5,
      carga_kg: 7.5,
      tempo_s: null,
    },
  ];

  it("pega a última sessão do exercício, ignorando a de hoje e o aquecimento", () => {
    const mapa = anterioresPorExercicio(linhas, "de-hoje");
    const series = mapa["agachamento-livre"];
    expect(series?.map((s) => s.set_index)).toEqual([1, 2]);
    expect(serieAnteriorDe(series, 1)).toMatchObject({ reps: 5, carga_kg: 9.5 });
    expect(serieAnteriorDe(series, 2)).toMatchObject({ reps: 4 });
    // série sem correspondente: vale a última que existe
    expect(serieAnteriorDe(series, 3)).toMatchObject({ set_index: 2 });
    expect(serieAnteriorDe(undefined, 1)).toBeNull();
  });

  it("sem a sessão de hoje excluída, a mais recente é a de hoje", () => {
    const mapa = anterioresPorExercicio(linhas);
    expect(mapa["agachamento-livre"]?.[0]?.session_id).toBe("de-hoje");
  });
});
