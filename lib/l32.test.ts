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
  colecaoDoPlano,
  detalheDaCapa,
  planos,
  secoesDaVitrine,
  semCapasRepetidas,
  todasAsColecoes,
  type Colecao,
} from "@/lib/colecoes";
import { cardio, exercicios } from "@/lib/dados";
import {
  altDaExecucao,
  midiaGrande,
  nomeAcessivel,
  opcoesDeMidia,
  ROTULOS_DO_EXERCICIO,
} from "@/lib/midia";

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

  it("os 81 nomes × todo rótulo: \"<rótulo>: <nome>\", sem artigo antes do nome", () => {
    expect(exercicios).toHaveLength(81);
    const femininos = exercicios.filter((e) =>
      /^(Remada|Rosca|Prancha|Elevação|Flexão|Barra fixa|Puxada)/.test(e.nome),
    );
    expect(femininos.length).toBeGreaterThanOrEqual(12);
    for (const e of exercicios) {
      for (const rotulo of ROTULOS_DO_EXERCICIO) {
        const texto = nomeAcessivel(rotulo, e.nome);
        expect(texto, `${rotulo}/${e.id}`).toBe(`${rotulo}: ${e.nome}`);
        // o que vem antes do nome não termina em artigo nem em contração
        const antes = texto.slice(0, texto.length - e.nome.length);
        expect(antes, `${rotulo}/${e.id}`).not.toMatch(/\b(d|n)?[oa]s?\s*$/i);
      }
    }
    expect(altDaExecucao("Remada curvada pronada")).toBe("Execução: Remada curvada pronada");
  });

  it("nenhum arquivo de lib/, components/ e app/ põe artigo antes do nome do exercício", () => {
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
        for (const achado of artigoAntesDoNome(readFileSync(caminho, "utf8"))) {
          achados.push(`${caminho.slice(raiz.length + 1)}: ${achado}`);
        }
      }
    };
    andar(join(raiz, "lib"));
    andar(join(raiz, "components"));
    andar(join(raiz, "app"));
    expect(achados).toEqual([]);
  });

  /*
   * SPEC §22.17 item 7 (C-l32-guarda-artigo-estreita): a guarda lia linha a
   * linha e só pegava expressão terminada em `nome`. As três mutações do
   * ledger — e as duas exceções, que continuam de fora.
   */
  it("a guarda pega as mutações que escapavam e deixa o treino e a fase", () => {
    const mutacoes = [
      "const a = `Nota do ${nomeDoExercicio}`;",
      "const b = `Última repetição firme no\n    ${exercicio.nome}`;",
      "const c = `Troque a ${ex.nome} por outra`;",
      "const d = `Execução da ${\n  item.nome.trim()}`;",
      "<p>Carga do {exercicio?.nome}</p>",
      "<p>os {ex.nome}</p>",
      'const e = "Execução do " + nome;',
      // uma chamada antes do `.nome` (auditoria 1 do L33)
      "const f = `Troque o ${acharExercicio(id).nome}`;",
      "<p>Série da {acharExercicio(item.id)?.nome}</p>",
    ];
    for (const m of mutacoes) expect(artigoAntesDoNome(m).length, m).toBeGreaterThanOrEqual(1);
    const permitidos = [
      "`Começar o ${resumo.nome}`",
      "`Fazer o treino da ${nomeCurtoDaFase(fase.nome).toLowerCase()}`",
      "`Ir para ${nome}`",
      "` · elástico ${nomeDaAssistencia(alvo.assistencia)}`",
      "`${exercicio.nome}: voltou a ${formatarKg(padrao)}.`",
      "// Nota do ${exercicio.nome} — num comentário",
      "/* a ${ex.nome} */",
      "`então ${quantos} séries`",
    ];
    for (const p of permitidos) expect(artigoAntesDoNome(p), p).toEqual([]);
  });
});

/**
 * Artigo (o/a/os/as) ou contração (do/da/no/na/dos/das/nos/nas) logo antes de
 * uma expressão — template `${…}` ou JSX `{…}`, na mesma linha ou na seguinte
 * — cujo identificador contém "nome", mesmo depois de uma chamada
 * (`acharExercicio(id).nome`). Comentários não contam. Exceções: o
 * nome do treino ("Começar o ${resumo.nome}") e o da fase ("da
 * ${nomeCurtoDaFase(fase.nome)…}"), que não são nomes de exercício.
 */
function artigoAntesDoNome(fonte: string): string[] {
  const semComentarios = fonte
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const artigo =
    /(?<![\p{L}\p{N}_])(?:do|da|no|na|dos|das|nos|nas|o|a|os|as)\s+\$?\{\s*[\w?.!]*(?:\([^()]*\)[\w?.!]*)*nome\w*[^}]*\}/gu;
  const excecoes = [/^o\s+\$\{\s*resumo\.nome\s*\}$/u, /^da\s+\$\{\s*nomeCurtoDaFase\(fase\.nome\)/u];
  return [...semComentarios.matchAll(artigo), ...semComentarios.matchAll(/[`"']Execução d[oa] /g)]
    .map((m) => m[0])
    .filter((trecho) => !excecoes.some((e) => e.test(trecho)))
    .map((trecho) => trecho.replace(/\s+/g, " "));
}

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

  it("busca \"corda\": a ordem, a capa reservada por linha e quem fica com o ícone", () => {
    const achadas = buscarColecoes("corda", todasAsColecoes(null));
    expect(achadas.slice(0, 3).map((c) => c.id)).toEqual([
      "circuito:corda",
      "aparelho:corda",
      "plano:corda",
    ]);
    const depois = capasNaBusca(achadas, vitrine);
    const capa = (id: string) => depois.find((c) => c.id === id)!.capa;
    // 1ª passada: cada linha reserva a capa da vitrine, se ninguém acima a reservou
    expect(vitrine.get("circuito:corda")).toBe("/fotos/salto-basico-1.jpg");
    expect(vitrine.get("aparelho:corda")).toBe("/fotos/salto-basico-1.jpg");
    expect(vitrine.get("plano:corda")).toBe("/fotos/corrida-no-lugar-com-a-corda-1.jpg");
    expect(capa("circuito:corda")).toBe("/fotos/salto-basico-1.jpg");
    expect(capa("plano:corda")).toBe("/fotos/corrida-no-lugar-com-a-corda-1.jpg");
    // 2ª passada: o aparelho perdeu a da vitrine para o circuito (acima) e a
    // outra foto dele é a capa que o plano (abaixo) reservou → ícone
    expect(achadas.find((c) => c.id === "aparelho:corda")!.exercicios).toEqual([
      "salto-basico",
      "corrida-no-lugar-com-a-corda",
    ]);
    expect(capa("aparelho:corda")).toBeNull();
    // antes, o aparelho ficava com a foto que agora é do plano
    const antes = semCapasRepetidas(achadas);
    expect(antes.find((c) => c.id === "aparelho:corda")!.capa).toBe(
      "/fotos/corrida-no-lugar-com-a-corda-1.jpg",
    );
  });

  it("em todos os termos: nenhuma foto repetida, e quem tem a capa da vitrine livre fica com ela", () => {
    const lista = termos();
    expect(lista.length).toBeGreaterThan(100);
    let linhas = 0;
    let diferentes = 0;
    let diferentesAntes = 0;
    let planosAntes = 0;
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
        if (antes[i]!.capa !== daVitrine) {
          diferentesAntes += 1;
          if (c.id.startsWith("plano:")) planosAntes += 1;
        }
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
    expect(planosAntes).toBe(4);
    expect(diferentes).toBe(66);
    expect(planosDiferentes.sort()).toEqual([
      "assistida:plano:barra_fixa",
      "elástico:plano:barra_fixa",
    ]);
  });
});

/* ------------------------------- item 7: a posição do plano aparece uma vez */

describe("§22.15 item 7 — a capa da tela do plano não repete a posição", () => {
  /*
   * SPEC §22.17 item 10: o esperado sai de `data/cardio.json`, não de
   * `metaDoPlano()` — a última semana do JSON dá o total T; se o texto do
   * plano no JSON (o objetivo, ou as funções da corda) já diz "T semanas", a
   * capa não tem detalhe; senão, é "T semanas". A capa é calculada da coleção
   * **com perfil**, a que a tela recebe (o detalhe dela diz "semana N de T").
   */
  it("para os três planos e toda semana, a capa é a de cardio.json, sem a posição", () => {
    const ultimaSemana = (semanas: readonly { semana?: number; semanas?: string }[]): number => {
      const ultima = semanas[semanas.length - 1]!;
      if (typeof ultima.semana === "number") return ultima.semana;
      const numeros = (ultima.semanas ?? "").match(/\d+/g) ?? [];
      return Number(numeros[numeros.length - 1]);
    };
    const doJson = {
      corrida: { total: ultimaSemana(cardio.corrida.semanas), texto: cardio.corrida.objetivo },
      barra_fixa: {
        total: ultimaSemana(cardio.barra_fixa.semanas),
        texto: cardio.barra_fixa.objetivo,
      },
      corda: { total: ultimaSemana(cardio.corda.semanas), texto: cardio.corda.funcoes.join(" · ") },
    } as const;
    const esperadas: Record<string, string | null> = {};
    for (const [id, { total, texto }] of Object.entries(doJson)) {
      expect(total, id).toBeGreaterThan(1);
      esperadas[id] = new RegExp(`\\b${total} semanas\\b`).test(texto) ? null : `${total} semanas`;
    }
    // o que os dados dizem hoje: corrida e barra fixa dizem o prazo no objetivo
    expect(esperadas).toEqual({ corrida: null, barra_fixa: null, corda: "12 semanas" });
    expect(planos().map((p) => p.id).sort()).toEqual(Object.keys(doJson).sort());
    for (const p of planos()) {
      const total = doJson[p.id as keyof typeof doJson].total;
      for (let semana = 1; semana <= total + 2; semana += 1) {
        const comPerfil = colecaoDoPlano(p, { semanaFixa: semana, semanaCorrida: semana });
        const capa = detalheDaCapa(comPerfil, p);
        expect(capa, `${p.id} semana ${semana}`).toBe(esperadas[p.id]);
        expect(capa ?? "", `${p.id} semana ${semana}`).not.toMatch(/semana \d+ de \d+/i);
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
