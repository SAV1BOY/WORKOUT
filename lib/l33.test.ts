/**
 * Ultraloop — Rodada 25, Lote 33 (SPEC §22.17): sobras do L14 e do L32 —
 * ficha, catálogo e camadas modais. As regras puras; o caminho do dedo está
 * em `e2e/ultraloop-l33.spec.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aoAndarNoHistorico,
  CHAVE_DA_ENTRADA,
  desfazAoFechar,
  empilhaEntrada,
  entradaDoEstado,
} from "@/lib/camada-modal";
import {
  chipsDosFiltros,
  filtrarExercicios,
  FILTROS_VAZIOS,
  NOME_EQUIPAMENTO,
  NOME_IMPLEMENTO,
  opcoesDoCatalogo,
  rotuloDoImplemento,
} from "@/lib/catalogo";
import { exercicios } from "@/lib/dados";
import { contidoEmPalavras, historicoCarregando, textoRepetido } from "@/lib/ficha";
import type { EquipamentoTag, Implemento } from "@/lib/schemas";

/* ---------------------------------------- item 1: um rótulo por filtro */

describe("§22.17 item 1 — rótulo igual só com resultado igual", () => {
  const { implementos, equipamentos } = opcoesDoCatalogo();
  const ids = (f: Partial<typeof FILTROS_VAZIOS>) =>
    filtrarExercicios(exercicios, f)
      .map((e) => e.id)
      .sort();

  it("todo par implemento × equipamento dos 81: rótulos iguais dão a mesma lista", () => {
    expect(exercicios).toHaveLength(81);
    const conflitos: string[] = [];
    for (const i of implementos) {
      for (const tag of equipamentos) {
        if (rotuloDoImplemento(i) !== NOME_EQUIPAMENTO[tag]) continue;
        const a = ids({ implemento: i });
        const b = ids({ equipamento: tag });
        if (JSON.stringify(a) !== JSON.stringify(b)) conflitos.push(`${i} × ${tag}`);
      }
    }
    expect(conflitos).toEqual([]);
  });

  it("os três que diferem ganham '(principal)'; os três iguais ficam com o nome", () => {
    const repetidos = implementos.filter((i) =>
      equipamentos.some((t) => NOME_EQUIPAMENTO[t] === NOME_IMPLEMENTO[i]),
    );
    expect(repetidos.sort()).toEqual(
      ["band", "barra_fixa", "barra_macica", "barra_w", "corda", "halteres"].sort(),
    );
    const esperado: Partial<Record<Implemento, string>> = {
      barra_macica: "Barra maciça (principal)",
      halteres: "Halteres (principal)",
      band: "Super Band (principal)",
      barra_fixa: "Barra fixa",
      barra_w: "Barra W",
      corda: "Corda",
    };
    for (const [i, rotulo] of Object.entries(esperado)) {
      expect(rotuloDoImplemento(i as Implemento), i).toBe(rotulo);
    }
    // os que não repetem nome ficam como estão
    for (const i of implementos.filter((x) => !repetidos.includes(x))) {
      expect(rotuloDoImplemento(i)).toBe(NOME_IMPLEMENTO[i]);
    }
    // o nome do objeto continua um só (§22.14 item 9)
    expect(NOME_IMPLEMENTO.band).toBe(NOME_EQUIPAMENTO["super-band"]);
  });

  it("os números medidos: 21 × 23, 23 × 28, 2 × 5 (e 5 × 5, 3 × 3, 2 × 2)", () => {
    const pares: [Implemento, EquipamentoTag, number, number][] = [
      ["barra_macica", "barra-macica", 21, 23],
      ["halteres", "halteres", 23, 28],
      ["band", "super-band", 2, 5],
      ["barra_fixa", "barra-fixa", 5, 5],
      ["barra_w", "barra-w", 3, 3],
      ["corda", "corda", 2, 2],
    ];
    for (const [i, tag, ni, ne] of pares) {
      expect(ids({ implemento: i }), i).toHaveLength(ni);
      expect(ids({ equipamento: tag }), tag).toHaveLength(ne);
    }
  });

  it("com o implemento e o equipamento 'Super Band' ligados, os dois chips dizem coisas diferentes", () => {
    const chips = chipsDosFiltros({
      ...FILTROS_VAZIOS,
      implemento: "band",
      equipamento: "super-band",
    });
    expect(chips.map((c) => c.rotulo)).toEqual(["Super Band (principal)", "Super Band"]);
  });

  it("a regra vem dos dados: numa lista em que as duas listas coincidem, sem sufixo", () => {
    const soComBand = exercicios.filter((e) => e.implemento === "band");
    expect(rotuloDoImplemento("band", soComBand)).toBe("Super Band");
  });
});

/* ------------------------------- item 2: o critério em palavras inteiras */

describe("§22.17 item 2 — 'nada repetido' compara palavras inteiras", () => {
  it("'7,5 kg na barra' não está em '17,5 kg na barra'", () => {
    expect(contidoEmPalavras("7,5 kg na barra", "17,5 kg na barra")).toBe(false);
    expect(textoRepetido(["7,5 kg na barra", "17,5 kg na barra"])).toEqual([]);
    // nem '5 kg na barra' dentro de '7,5 kg na barra', nem com número depois
    expect(contidoEmPalavras("5 kg na barra", "7,5 kg na barra")).toBe(false);
    expect(contidoEmPalavras("séries de 1", "séries de 1,5 min")).toBe(false);
    expect(contidoEmPalavras("peso do corpo", "pesos do corpo")).toBe(false);
  });

  it("os casos reais continuam acusados", () => {
    expect(textoRepetido(["Core · Tatame · peso corporal", "peso corporal"])).toHaveLength(1);
    expect(textoRepetido(["peso do corpo", "peso do corpo"])).toHaveLength(1);
    expect(textoRepetido(["7,5 kg na barra", "carga: 7,5 kg na barra, subindo"])).toHaveLength(1);
    // a ocorrência seguinte vale, se a primeira está colada numa palavra
    expect(contidoEmPalavras("5 kg na barra", "15 kg na barra ou 5 kg na barra")).toBe(true);
  });
});

/* ------------------------------ item 4: o histórico espera o perfil */

describe("§22.17 item 4 — o histórico espera o perfil", () => {
  const nada = {
    perfil: false,
    estados: false,
    series: false,
    recordes: false,
    sessoes: false,
    eventos: false,
  };
  it("com o perfil pendente, carregando; com tudo lido, não", () => {
    expect(historicoCarregando(nada)).toBe(false);
    expect(historicoCarregando({ ...nada, perfil: true })).toBe(true);
    for (const chave of Object.keys(nada) as (keyof typeof nada)[]) {
      expect(historicoCarregando({ ...nada, [chave]: true }), chave).toBe(true);
    }
  });

  it("o componente usa a regra, com o perfil", () => {
    const fonte = readFileSync(
      resolve(__dirname, "../components/exercicios/historico-exercicio.tsx"),
      "utf8",
    );
    expect(fonte).toMatch(/historicoCarregando\(\{\s*perfil: perfilQ\.isPending,/);
  });
});

/* ------------------------------------ item 6: o voltar fecha a camada */

describe("§22.17 item 6 — a entrada da camada no histórico", () => {
  it("lê o número da entrada do estado do histórico", () => {
    expect(entradaDoEstado({ [CHAVE_DA_ENTRADA]: 3, __NA: true })).toBe(3);
    expect(entradaDoEstado({ __NA: true })).toBe(0);
    expect(entradaDoEstado(null)).toBe(0);
    expect(entradaDoEstado({ [CHAVE_DA_ENTRADA]: "3" })).toBe(0);
    expect(entradaDoEstado({ [CHAVE_DA_ENTRADA]: 0 })).toBe(0);
  });

  it("empilha em qualquer página, menos por cima da Visão geral", () => {
    expect(empilhaEntrada(null)).toBe(true);
    expect(empilhaEntrada({ __NA: true })).toBe(true);
    expect(empilhaEntrada({ [CHAVE_DA_ENTRADA]: 2 })).toBe(true);
    expect(empilhaEntrada({ visaoGeralDoTreino: true, __NA: true })).toBe(false);
  });

  it("o voltar fecha as camadas de entrada acima da atual, a de cima primeiro", () => {
    expect(aoAndarNoHistorico([1], 0)).toEqual({ fechar: [1], morta: false });
    expect(aoAndarNoHistorico([1, 2], 1)).toEqual({ fechar: [2], morta: false });
    expect(aoAndarNoHistorico([1, 2], 0)).toEqual({ fechar: [2, 1], morta: false });
    expect(aoAndarNoHistorico([1, 2], 2)).toEqual({ fechar: [], morta: false });
    expect(aoAndarNoHistorico([], 0)).toEqual({ fechar: [], morta: false });
  });

  it("a entrada de uma camada que já fechou é morta: anda mais um passo", () => {
    // um link dentro da camada levou a outra rota; o voltar chega na entrada dela
    expect(aoAndarNoHistorico([], 4)).toEqual({ fechar: [], morta: true });
    // fechou pelo Esc e outra abriu logo por cima (a 2): a 1 ficou embaixo
    expect(aoAndarNoHistorico([2], 1)).toEqual({ fechar: [2], morta: true });
    // a entrada da camada de baixo, ainda aberta, não é morta
    expect(aoAndarNoHistorico([1, 2], 1).morta).toBe(false);
  });

  it("fechada pelo Esc, desfaz a entrada só se ela ainda é a do topo", () => {
    expect(desfazAoFechar({ [CHAVE_DA_ENTRADA]: 2 }, 2)).toBe(true);
    expect(desfazAoFechar({ [CHAVE_DA_ENTRADA]: 1 }, 2)).toBe(false); // o voltar já tirou
    expect(desfazAoFechar({ __NA: true }, 2)).toBe(false); // outra rota por cima
    expect(desfazAoFechar({ [CHAVE_DA_ENTRADA]: 2 }, null)).toBe(false); // não empilhou
  });
});

/* --------------------------- item 8: o e2e do L32 lê os nomes dos dados */

describe("§22.17 item 8 — nenhum nome de exercício escrito à mão no e2e do L32", () => {
  it("nenhum dos 81 nomes aparece escrito no spec (string, regex ou título)", () => {
    const fonte = readFileSync(resolve(__dirname, "../e2e/ultraloop-l32.spec.ts"), "utf8");
    const escritos = exercicios.map((e) => e.nome).filter((nome) => fonte.includes(nome));
    expect(escritos).toEqual([]);
  });
});
