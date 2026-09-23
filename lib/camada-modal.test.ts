import { describe, expect, it } from "vitest";
import {
  candidatosAoAbrir,
  desmarcar,
  ficaInerte,
  focoAoFechar,
  marcar,
  proximoDoTab,
} from "./camada-modal";

/** SPEC §22.14 item 6 (a11y-05, rodada 17): a regra da folha, sem DOM. */
describe("ficaInerte", () => {
  const irmao = { tag: "MAIN", avisos: false, veu: false };

  it("main, header, nav e o portal de outra camada ficam inertes", () => {
    for (const tag of ["MAIN", "HEADER", "NAV", "DIV", "SECTION", "BUTTON"]) {
      expect(ficaInerte({ ...irmao, tag }), tag).toBe(true);
    }
  });

  it("nós sem conteúdo, os avisos, o anunciador de rota e o véu ficam de fora", () => {
    for (const tag of ["SCRIPT", "STYLE", "LINK", "TEMPLATE", "META", "NOSCRIPT"]) {
      expect(ficaInerte({ ...irmao, tag }), tag).toBe(false);
    }
    expect(ficaInerte({ ...irmao, tag: "NEXT-ROUTE-ANNOUNCER" })).toBe(false);
    expect(ficaInerte({ ...irmao, tag: "SECTION", avisos: true })).toBe(false);
    expect(ficaInerte({ ...irmao, tag: "DIV", veu: true })).toBe(false);
  });
});

describe("marcar e desmarcar — camadas empilhadas", () => {
  it("fechar a de cima não libera o que a de baixo marcou", () => {
    const contagem = new Map<string, number>();
    // a folha marca main e nav; o alerta por cima marca main, nav e o portal da folha
    expect(marcar(contagem, ["main", "nav"])).toEqual(["main", "nav"]);
    expect(marcar(contagem, ["main", "nav", "folha"])).toEqual(["folha"]);
    // o alerta fecha: só o portal da folha volta
    expect(desmarcar(contagem, ["main", "nav", "folha"])).toEqual(["folha"]);
    expect(contagem.get("main")).toBe(1);
    // a folha fecha: main e nav voltam
    expect(desmarcar(contagem, ["main", "nav"])).toEqual(["main", "nav"]);
    expect(contagem.size).toBe(0);
  });

  it("em qualquer ordem: a de baixo fechando antes não libera o fundo da de cima", () => {
    // o alerta "Descartar este treino?" some (animação) com o resumo do fim já aberto
    const contagem = new Map<string, number>();
    marcar(contagem, ["main"]); // alerta
    marcar(contagem, ["main", "alerta"]); // resumo por cima
    expect(desmarcar(contagem, ["main"])).toEqual([]); // o alerta fecha primeiro
    expect(contagem.get("main")).toBe(1); // main continua inerte sob o resumo
    expect(desmarcar(contagem, ["main", "alerta"])).toEqual(["main", "alerta"]);
  });

  it("desmarcar o que não foi marcado não faz nada", () => {
    const contagem = new Map<string, number>();
    expect(desmarcar(contagem, ["main"])).toEqual([]);
    expect(contagem.size).toBe(0);
  });
});

describe("candidatosAoAbrir e focoAoFechar — o foco volta a quem abriu", () => {
  it("sem foco (o <body>), nada a guardar", () => {
    expect(candidatosAoAbrir(null, [])).toEqual([]);
  });

  it("foco fora de camada: guarda só ele", () => {
    const camadas = [{ contem: (no: string) => no === "cancelar", candidatos: ["descartar"] }];
    expect(candidatosAoAbrir("concluir", camadas)).toEqual(["concluir"]);
  });

  it("foco dentro de outra camada: guarda ele e os candidatos dela", () => {
    // o resumo aberto pelo botão do alerta, que foi aberto pelo "Descartar" do rodapé
    const camadas = [
      { contem: (no: string) => no === "item", candidatos: ["x"] },
      { contem: (no: string) => no === "acao-do-alerta", candidatos: ["descartar"] },
    ];
    expect(candidatosAoAbrir("acao-do-alerta", camadas)).toEqual([
      "acao-do-alerta",
      "descartar",
    ]);
  });

  it("ao fechar, o primeiro candidato que ainda recebe foco", () => {
    const vivos = new Set(["descartar"]);
    expect(focoAoFechar(["acao-do-alerta", "descartar"], (no) => vivos.has(no))).toBe(
      "descartar",
    );
    expect(focoAoFechar(["concluir"], () => true)).toBe("concluir");
    expect(focoAoFechar(["sumiu"], () => false)).toBeNull();
    expect(focoAoFechar([], () => true)).toBeNull();
  });
});

describe("proximoDoTab — Tab preso na camada", () => {
  it("no último, o Tab volta ao primeiro; no primeiro, o Shift+Tab vai ao último", () => {
    expect(proximoDoTab(3, 2, false)).toBe(0);
    expect(proximoDoTab(3, 0, true)).toBe(2);
  });

  it("no meio, o navegador segue sozinho", () => {
    expect(proximoDoTab(3, 1, false)).toBeNull();
    expect(proximoDoTab(3, 1, true)).toBeNull();
    expect(proximoDoTab(3, 0, false)).toBeNull();
    expect(proximoDoTab(3, 2, true)).toBeNull();
  });

  it("foco fora da camada volta para dentro", () => {
    expect(proximoDoTab(3, -1, false)).toBe(0);
    expect(proximoDoTab(3, -1, true)).toBe(2);
  });

  it("com um focável só, o foco não sai dele; sem focável, nada a fazer", () => {
    expect(proximoDoTab(1, 0, false)).toBe(0);
    expect(proximoDoTab(1, 0, true)).toBe(0);
    expect(proximoDoTab(0, -1, false)).toBeNull();
  });
});
