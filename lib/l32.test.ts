/**
 * Ultraloop — Rodada 21, Lote 32 (SPEC §22.15): sobras das auditorias da
 * ficha e das coleções do Explorar. As regras puras; o caminho do dedo está
 * em `e2e/ultraloop-l32.spec.ts`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buscarColecoes,
  capasDaVitrine,
  capasNaBusca,
  detalheDaCapa,
  metaDoPlano,
  planos,
  secoesDaVitrine,
  semCapasRepetidas,
  todasAsColecoes,
  type Colecao,
} from "@/lib/colecoes";
import { exercicios } from "@/lib/dados";
import { altDaExecucao, midiaGrande, opcoesDeMidia } from "@/lib/midia";

/* ------------------------------------------------ item 3: o alt sem artigo */

describe("§22.15 item 3 — \"Execução: <nome>\", sem artigo", () => {
  it("os 81 exercícios: toda opção de mídia leva \"Execução: <nome>\"", () => {
    expect(exercicios).toHaveLength(81);
    let medidas = 0;
    for (const e of exercicios) {
      // o vídeo local conta como opção (o texto é o mesmo para todas)
      for (const tipo of opcoesDeMidia(e.id, { temVideo: true })) {
        const m = midiaGrande(e.id, { temVideo: true, tipo });
        expect(m, `${e.id}/${tipo}`).not.toBeNull();
        if (tipo === "foto") {
          // a foto diz qual é ("<nome> — início"), sem "Execução"
          expect(m!.alt).toBe(`${e.nome} — início`);
          continue;
        }
        expect(m!.alt, `${e.id}/${tipo}`).toBe(`Execução: ${e.nome}`);
        expect(m!.alt).not.toMatch(/^Execução d[oa] /);
        medidas += 1;
      }
      expect(altDaExecucao(e.nome)).toBe(`Execução: ${e.nome}`);
    }
    // 81 vídeos + 81 ilustrações ou figuras, pelo menos
    expect(medidas).toBeGreaterThan(81 * 2);
  });

  it("os nomes femininos que davam \"Execução do\" agora não levam artigo", () => {
    const femininos = exercicios.filter((e) => /^(Prancha|Remada|Rosca|Elevação)/.test(e.nome));
    expect(femininos.length).toBeGreaterThan(5);
    for (const e of femininos) {
      expect(midiaGrande(e.id)!.alt).toBe(`Execução: ${e.nome}`);
    }
  });

  it("nenhum arquivo de lib/ e components/ monta \"Execução do/da <nome>\"", () => {
    const raiz = resolve(__dirname, "..");
    const achados: string[] = [];
    const andar = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) {
          andar(caminho);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(nome) || /\.test\.ts$/.test(nome)) continue;
        const texto = readFileSync(caminho, "utf8");
        // um texto de código (template ou string), não um comentário
        if (/[`"']Execução d[oa] /.test(texto)) achados.push(caminho.slice(raiz.length + 1));
      }
    };
    andar(join(raiz, "lib"));
    andar(join(raiz, "components"));
    expect(achados).toEqual([]);
  });
});

/* ------------------------------------ item 6: a capa da busca e a da vitrine */

/** Os termos de 4 letras ou mais dos títulos das coleções e dos exercícios. */
function termos(): string[] {
  const t = new Set<string>();
  const palavras = (s: string) => s.toLowerCase().split(/[^a-zà-ú]+/).filter((w) => w.length >= 4);
  for (const c of todasAsColecoes(null)) for (const w of palavras(c.titulo)) t.add(w);
  for (const e of exercicios) for (const w of palavras(e.nome)) t.add(w);
  return [...t];
}

describe("§22.15 item 6 — na busca, a coleção parte da capa da vitrine", () => {
  const vitrine = capasDaVitrine(secoesDaVitrine(null));

  it("as seções da vitrine são as cinco da tela, cada uma sem capa repetida", () => {
    const secoes = secoesDaVitrine(null);
    expect(secoes.map((s) => s.titulo)).toEqual([
      "Treinos do programa",
      "Parte do corpo",
      "Circuitos",
      "Por aparelho",
      "Planos",
    ]);
    for (const s of secoes) {
      const fotos = s.itens.map((c) => c.capa).filter(Boolean);
      expect(new Set(fotos).size, s.titulo).toBe(fotos.length);
    }
    // toda coleção da vitrine tem uma entrada no mapa
    expect(vitrine.size).toBe(todasAsColecoes(null).length);
  });

  it("\"Corda: 5 estágios\" tem na busca \"corda\" a capa da seção Planos", () => {
    const planosDaVitrine = secoesDaVitrine(null).find((s) => s.titulo === "Planos")!;
    const naVitrine = planosDaVitrine.itens.find((c) => c.id === "plano:corda")!;
    expect(naVitrine.capa).not.toBeNull();
    const achadas = capasNaBusca(buscarColecoes("corda", todasAsColecoes(null)), vitrine);
    const naBusca = achadas.find((c) => c.id === "plano:corda")!;
    expect(naBusca.capa).toBe(naVitrine.capa);
    // a regra de antes (a lista inteira por semCapasRepetidas) dava o ícone
    const antes = semCapasRepetidas(buscarColecoes("corda", todasAsColecoes(null)));
    expect(antes.find((c) => c.id === "plano:corda")!.capa).toBeNull();
  });

  it("em todos os termos: nenhuma foto repetida, e quem tem a capa da vitrine livre fica com ela", () => {
    const lista = termos();
    expect(lista.length).toBeGreaterThan(100);
    let linhas = 0;
    let diferentes = 0;
    let diferentesAntes = 0;
    const planosDiferentes: string[] = [];
    for (const t of lista) {
      const achadas = buscarColecoes(t, todasAsColecoes(null));
      const depois = capasNaBusca(achadas, vitrine);
      const antes = semCapasRepetidas(achadas);
      expect(depois.map((c) => c.id)).toEqual(achadas.map((c) => c.id));
      const fotos = depois.map((c) => c.capa).filter((f): f is string => f !== null);
      expect(new Set(fotos).size, `busca "${t}": foto repetida`).toBe(fotos.length);
      const acima = new Set<string>();
      depois.forEach((c: Colecao, i) => {
        linhas += 1;
        const daVitrine = vitrine.get(c.id) ?? null;
        if (antes[i]!.capa !== daVitrine) diferentesAntes += 1;
        if (daVitrine === null) {
          expect(c.capa, `${t}: ${c.id} tem o ícone na vitrine`).toBeNull();
        } else if (!acima.has(daVitrine)) {
          expect(c.capa, `${t}: ${c.id} fica com a capa da vitrine`).toBe(daVitrine);
        }
        if (c.capa !== daVitrine) {
          diferentes += 1;
          if (c.id.startsWith("plano:")) planosDiferentes.push(`${t}:${c.id}`);
        }
        // só perde a capa da vitrine quem tem, numa linha de cima, a mesma capa de vitrine
        if (daVitrine) acima.add(daVitrine);
      });
    }
    // os números da SPEC §22.15 item 6
    expect(lista).toHaveLength(122);
    expect(linhas).toBe(484);
    expect(diferentesAntes).toBe(144);
    expect(diferentes).toBe(66);
    expect(planosDiferentes.sort()).toEqual([
      "assistida:plano:barra_fixa",
      "elástico:plano:barra_fixa",
    ]);
  });
});

/* ------------------------------- item 7: a posição do plano aparece uma vez */

describe("§22.15 item 7 — a capa da tela do plano não repete a posição", () => {
  it("para os três planos e toda semana, a capa diz a meta sem perfil", () => {
    for (const p of planos()) {
      const semPerfil = metaDoPlano(p, null);
      for (let semana = 1; semana <= 14; semana += 1) {
        const comPerfil = metaDoPlano(p, { semanaFixa: semana, semanaCorrida: semana });
        const capa = detalheDaCapa({ detalhe: comPerfil }, p);
        expect(capa, `${p.id} semana ${semana}`).toBe(semPerfil);
        expect(capa ?? "").not.toMatch(/semana \d+ de/i);
      }
    }
  });

  it("coleção que não é plano fica com o próprio detalhe", () => {
    expect(detalheDaCapa({ detalhe: "6 exercícios · ~30 min" }, null)).toBe("6 exercícios · ~30 min");
    expect(detalheDaCapa({ detalhe: null }, null)).toBeNull();
  });
});

/* ------------------------- item 9: o inventário da ficha em folha (§22.14) */

describe("§22.15 item 9 — a linha da ficha-folha cita os quatro jeitos de abrir", () => {
  it("todo arquivo de app/ e components/ que desenha <FichaEmFolha está na linha da tabela", () => {
    const raiz = resolve(__dirname, "..");
    const quem: string[] = [];
    const andar = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) {
          andar(caminho);
          continue;
        }
        if (!/\.tsx$/.test(nome)) continue;
        if (readFileSync(caminho, "utf8").includes("<FichaEmFolha")) {
          quem.push(caminho.slice(raiz.length + 1));
        }
      }
    };
    andar(join(raiz, "app"));
    andar(join(raiz, "components"));
    expect(quem.sort()).toEqual([
      "components/colecoes/lista-da-colecao.tsx",
      "components/player/tela-player.tsx",
      "components/treinar/bloco.tsx",
      "components/treino/lista.tsx",
    ]);
    const spec = readFileSync(join(raiz, "SPEC.md"), "utf8");
    const linha = spec
      .split("\n")
      .find((l) => l.includes("| `components/exercicio/ficha-folha.tsx` | Ficha do exercício (folha) |"));
    expect(linha).toBeTruthy();
    for (const arquivo of quem) {
      const base = arquivo.split("/").slice(-2).join("/");
      const curto = arquivo.split("/").pop()!;
      expect(linha!.includes(base) || linha!.includes(curto), arquivo).toBe(true);
    }
  });
});
