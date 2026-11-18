import { describe, expect, it } from "vitest";
import { acharExercicio } from "@/lib/dados";
import { nomeDoPasso } from "@/lib/digitar-numero";
import { prefsDoVoto } from "@/lib/player";
import {
  RECORDES_EM_DESTAQUE,
  marcarSerie, montarSessao, recordesDoBloco, recordesEmDestaque, rotulosDaSerie,
  type BlocoLocal, type SessaoLocal,
} from "@/lib/sessao";

const AGACHAMENTO = "agachamento-livre";

function contador(prefixo: string) {
  let n = 0;
  return () => `${prefixo}${++n}`;
}

/** Treino A na segunda que abre o programa: agachamento com 2 aquecimentos. */
function sessaoA(): SessaoLocal {
  return montarSessao({
    id: "sess-l21",
    userId: "u1",
    data: "2026-09-14",
    treinoId: "A1",
    fase: "fase1",
    agora: "2026-09-14T09:00:00.000Z",
    novoId: contador("s"),
  });
}

function bloco(sessao: SessaoLocal, ordem: number): BlocoLocal {
  const b = sessao.blocos.find((x) => x.ordem === ordem);
  if (!b) throw new Error(`bloco ${ordem} ausente`);
  return b;
}

/** Marca as `quantas` primeiras séries do bloco na ordem do player. */
function marcar(sessao: SessaoLocal, ordem: number, quantas: number): SessaoLocal {
  let s = sessao;
  const b = bloco(s, ordem);
  const ordenadas = [
    ...b.series.filter((x) => x.tipo === "aquecimento"),
    ...b.series.filter((x) => x.tipo !== "aquecimento"),
  ];
  for (const serie of ordenadas.slice(0, quantas)) {
    s = marcarSerie(s, ordem, serie.id, true, "2026-09-14T09:30:00.000Z");
  }
  return s;
}

describe("§22.18 item 3 — recordesEmDestaque: os 5 de maior salto, o resto atrás de 'Ver todos'", () => {
  function rec(
    tipo: "carga" | "reps" | "e1rm",
    valor: number,
    anterior: number | null,
  ) {
    return { tipo, rotulo: tipo, valor, texto: `${tipo} ${valor}`, anterior };
  }

  it("primeira sessão (18 estreias): 5 visíveis na ordem do treino, carga → reps → estimada", () => {
    const resultados = [1, 2, 3, 4, 5, 6].map((ordem) => ({
      nome: `Ex ${ordem}`,
      ordem,
      recordes: [rec("carga", 10, null), rec("reps", 8, null), rec("e1rm", 12, null)],
    }));
    const { visiveis, todos } = recordesEmDestaque(resultados);
    expect(todos).toHaveLength(18);
    expect(visiveis).toHaveLength(RECORDES_EM_DESTAQUE);
    expect(visiveis.map((r) => `${r.nome}|${r.texto}`)).toEqual([
      "Ex 1|carga 10",
      "Ex 1|reps 8",
      "Ex 1|e1rm 12",
      "Ex 2|carga 10",
      "Ex 2|reps 8",
    ]);
  });

  it("quem bate marca anterior vem antes, pelo maior salto relativo", () => {
    const resultados = [
      { nome: "A", ordem: 1, recordes: [rec("carga", 11, 10), rec("reps", 9, null)] },
      { nome: "B", ordem: 2, recordes: [rec("carga", 30, 20)] },
      { nome: "C", ordem: 3, recordes: [rec("reps", 12, 10)] },
    ];
    const { visiveis } = recordesEmDestaque(resultados, 3);
    expect(visiveis.map((r) => r.nome)).toEqual(["B", "C", "A"]);
    expect(recordesEmDestaque(resultados).todos.map((r) => r.texto)).toEqual([
      "carga 30",
      "reps 12",
      "carga 11",
      "reps 9",
    ]);
  });

  it("com 5 ou menos, todos visíveis (sem 'Ver todos')", () => {
    const resultados = [{ nome: "A", ordem: 1, recordes: [rec("carga", 11, 10)] }];
    const { visiveis, todos } = recordesEmDestaque(resultados);
    expect(visiveis).toEqual(todos);
  });

  it("recordesDoBloco anota a marca batida (null na estreia)", () => {
    let s = sessaoA();
    s = marcar(s, 1, 5);
    const b = bloco(s, 1);
    expect(recordesDoBloco(b).map((r) => r.anterior)).toEqual([null, null, null]);
    expect(
      recordesDoBloco({ ...b, recordeCarga: 5, recordeReps: 4, recordeE1rm: 6 }).map(
        (r) => r.anterior,
      ),
    ).toEqual([5, 4, 6]);
  });
});

describe("§22.18 item 5 — rotulosDaSerie e nomeDoPasso: nomes com série e exercício", () => {
  it("aquecimento é masculino; série, feminina; o exercício entra com 'de'", () => {
    expect(rotulosDaSerie("aquecimento", 1, "Agachamento livre")).toEqual({
      nome: "Aquecimento 1",
      grupo: "Aquecimento 1 — Agachamento livre",
      concluida: "Aquecimento 1 concluído — Agachamento livre",
      contexto: "do Aquecimento 1 de Agachamento livre",
    });
    expect(rotulosDaSerie("trabalho", 2, "Levantamento terra")).toEqual({
      nome: "Série 2",
      grupo: "Série 2 — Levantamento terra",
      concluida: "Série 2 concluída — Levantamento terra",
      contexto: "da Série 2 de Levantamento terra",
    });
  });

  it("os botões − e + levam o contexto; sem ele, o nome curto de antes", () => {
    const { contexto } = rotulosDaSerie("trabalho", 1, "Levantamento terra");
    expect(nomeDoPasso("Aumentar", "repetições", contexto)).toBe(
      "Aumentar repetições da Série 1 de Levantamento terra",
    );
    expect(nomeDoPasso("Diminuir", "carga na barra")).toBe("Diminuir carga na barra");
  });

  it("no Treino A inteiro nenhum nome de − / + / visto se repete", () => {
    const s = sessaoA();
    const nomes: string[] = [];
    for (const b of s.blocos) {
      let a = 0;
      let t = 0;
      const nomeEx = acharExercicio(b.exercicioId).nome;
      for (const serie of b.series) {
        const i = serie.tipo === "aquecimento" ? ++a : ++t;
        const r = rotulosDaSerie(serie.tipo, i, nomeEx);
        nomes.push(r.concluida);
        for (const rotulo of ["repetições", "carga na barra"]) {
          nomes.push(nomeDoPasso("Aumentar", rotulo, r.contexto));
          nomes.push(nomeDoPasso("Diminuir", rotulo, r.contexto));
        }
      }
    }
    const repetidos = nomes.filter((n, i) => nomes.indexOf(n) !== i);
    expect(repetidos).toEqual([]);
  });
});

describe("§22.18 itens 8 e 9 — prefsDoVoto: as preferências de agora e o voto de antes do toque", () => {
  const RENDER = { user_id: "u1", prefs: { evitar_exercicios: [] as string[] } };

  it("parte do cache de agora: outra mudança feita depois do render fica", () => {
    // depois do render, um voto noutro exercício e um ajuste chegaram ao cache
    const cache = {
      user_id: "u1",
      prefs: { evitar_exercicios: ["remada-curvada-pronada"], manter_tela: false },
    };
    const g = prefsDoVoto(cache, RENDER, AGACHAMENTO, "evitado");
    expect(g?.prefs.evitar_exercicios).toEqual(["remada-curvada-pronada", AGACHAMENTO]);
    expect(g?.prefs.manter_tela).toBe(false);
    expect(g?.userId).toBe("u1");
  });

  it("o voto de antes é o do cache na hora do toque, não o do render", () => {
    // o render ainda não viu o "Não gosto"; o cache já tem
    const cache = { user_id: "u1", prefs: { evitar_exercicios: [AGACHAMENTO] } };
    expect(prefsDoVoto(cache, RENDER, AGACHAMENTO, "preferido")?.antes).toBe("evitado");
    expect(prefsDoVoto(null, RENDER, AGACHAMENTO, "preferido")?.antes).toBeNull();
  });

  it("sem cache, usa o perfil do render; sem perfil nenhum, não grava", () => {
    expect(prefsDoVoto(undefined, RENDER, AGACHAMENTO, "evitado")?.prefs.evitar_exercicios).toEqual([
      AGACHAMENTO,
    ]);
    expect(prefsDoVoto(null, null, AGACHAMENTO, "evitado")).toBeNull();
  });
});
