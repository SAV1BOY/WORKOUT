/**
 * SPEC §22.16 — Player: Substituir no passo atual, preparação e série; '%'
 * colado nos textos. As regras puras do lote: onde o player fica quando a
 * sequência muda por baixo dele (item 1), os pontos por série (item 5), o
 * aviso dos polegares (item 6) e a grafia do '%' nos textos (item 7).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SECOES } from "@/lib/guia";
import {
  avisoDoPolegar,
  avisoDoVoto,
  estadoDoPasso,
  indiceDaChave,
  indiceDoEstado,
  pontosDoBloco,
  sequenciaDoPlayer,
  type Passo,
  type PassoSerie,
} from "@/lib/player";
import { faixaDaRetomada } from "@/lib/retomada";
import {
  ajustarPrescricaoDaSessao,
  marcarSerie,
  montarSessao,
  substituirExercicio,
  substitutosPara,
  type SessaoLocal,
} from "@/lib/sessao";

function contador(prefixo: string) {
  let n = 0;
  return () => `${prefixo}${++n}`;
}

/** Treino A na segunda que abre o programa: agachamento com 2 aquecimentos. */
function sessaoA(): SessaoLocal {
  return montarSessao({
    id: "sess-l19",
    userId: "u1",
    data: "2026-09-14",
    treinoId: "A1",
    fase: "fase1",
    agora: "2026-09-14T09:00:00.000Z",
    novoId: contador("s"),
  });
}

function trocar(sessao: SessaoLocal, ordem: number): SessaoLocal {
  const bloco = sessao.blocos.find((b) => b.ordem === ordem);
  if (!bloco) throw new Error("bloco ausente");
  const novo = substitutosPara(bloco.exercicioId)[0];
  if (!novo) throw new Error(`sem substituto para ${bloco.exercicioId}`);
  return substituirExercicio(sessao, ordem, novo.id, null, { novoId: contador(`t${ordem}-`) });
}

function marcar(sessao: SessaoLocal, ordem: number, quantas: number): SessaoLocal {
  let s = sessao;
  const bloco = s.blocos.find((b) => b.ordem === ordem);
  if (!bloco) throw new Error("bloco ausente");
  const ordenadas = [
    ...bloco.series.filter((x) => x.tipo === "aquecimento"),
    ...bloco.series.filter((x) => x.tipo !== "aquecimento"),
  ];
  for (const serie of ordenadas.slice(0, quantas)) {
    s = marcarSerie(s, ordem, serie.id, true, "2026-09-14T09:30:00.000Z");
  }
  return s;
}

function series(seq: readonly Passo[], ordem: number): PassoSerie[] {
  return seq.filter((p): p is PassoSerie => p.tipo === "serie" && p.ordem === ordem);
}

const ORDENS = sessaoA().blocos.map((b) => b.ordem);
const PRIMEIRO = ORDENS[0] ?? 1;
const SEGUNDO = ORDENS[1] ?? 2;

describe("§22.16 item 1 — indiceDoEstado: a troca de exercício não perde o passo", () => {
  it("o estado anota o exercício do passo (e o descanso, o do passo antes dele)", () => {
    const seq = sequenciaDoPlayer(sessaoA());
    const serie = series(seq, PRIMEIRO)[0];
    if (!serie) throw new Error("série ausente");
    expect(estadoDoPasso(serie, 0).ordem).toBe(PRIMEIRO);
    const descanso = seq[indiceDaChave(seq, serie.chave) + 1];
    expect(descanso?.tipo).toBe("descanso");
    if (descanso) expect(estadoDoPasso(descanso, 0).ordem).toBe(PRIMEIRO);
    expect(estadoDoPasso({ tipo: "feedback", chave: "feedback" }, 0).ordem).toBeNull();
  });

  it("trocar o exercício do PASSO ATUAL (sem série feita) leva à série 1 do exercício novo", () => {
    const antes = sessaoA();
    const seqAntes = sequenciaDoPlayer(antes);
    const atual = series(seqAntes, PRIMEIRO)[0];
    if (!atual) throw new Error("série ausente");
    const estado = estadoDoPasso(atual, 0);

    const depois = trocar(antes, PRIMEIRO);
    const seqDepois = sequenciaDoPlayer(depois);
    // a chave antiga sumiu — era isto que deixava a tela no esqueleto
    expect(indiceDaChave(seqDepois, estado.chave)).toBe(-1);

    const i = indiceDoEstado(seqDepois, depois, estado);
    const passo = seqDepois[i];
    expect(passo?.tipo).toBe("serie");
    if (passo?.tipo !== "serie") return;
    expect(passo.ordem).toBe(PRIMEIRO);
    expect(passo.exercicioId).toBe(depois.blocos[0]?.exercicioId);
    expect(passo.exercicioId).not.toBe("agachamento-livre");
    expect(passo.numero).toBe(1);
    expect(passo.posicao).toBe(1);
  });

  it("com séries já feitas no exercício trocado, cai na primeira série que falta do novo", () => {
    let antes = marcar(sessaoA(), PRIMEIRO, 3); // 2 aquecimentos + série 1
    const seqAntes = sequenciaDoPlayer(antes);
    const atual = series(seqAntes, PRIMEIRO)[3]; // série 2 de 3
    if (!atual) throw new Error("série ausente");
    const estado = estadoDoPasso(atual, 0);

    antes = trocar(antes, PRIMEIRO);
    const seqDepois = sequenciaDoPlayer(antes);
    const passo = seqDepois[indiceDoEstado(seqDepois, antes, estado)];
    expect(passo).toMatchObject({ tipo: "serie", ordem: PRIMEIRO, numero: 1, aquecimento: false });
  });

  it("parado no descanso entre séries do exercício trocado, também fica nele", () => {
    const antes = sessaoA();
    const seqAntes = sequenciaDoPlayer(antes);
    const atual = series(seqAntes, PRIMEIRO)[0];
    if (!atual) throw new Error("série ausente");
    const descanso = seqAntes[indiceDaChave(seqAntes, atual.chave) + 1];
    if (descanso?.tipo !== "descanso") throw new Error("descanso ausente");
    const estado = estadoDoPasso(descanso, 0);

    const depois = trocar(antes, PRIMEIRO);
    const seqDepois = sequenciaDoPlayer(depois);
    expect(indiceDaChave(seqDepois, estado.chave)).toBe(-1);
    expect(seqDepois[indiceDoEstado(seqDepois, depois, estado)]).toMatchObject({
      tipo: "serie",
      ordem: PRIMEIRO,
      numero: 1,
    });
  });

  it("trocar um exercício POSTERIOR deixa o player exatamente onde estava", () => {
    const antes = marcar(sessaoA(), PRIMEIRO, 1);
    const seqAntes = sequenciaDoPlayer(antes);
    const atual = series(seqAntes, PRIMEIRO)[1];
    if (!atual) throw new Error("série ausente");
    const estado = estadoDoPasso(atual, 0);

    const depois = trocar(antes, SEGUNDO);
    const seqDepois = sequenciaDoPlayer(depois);
    const i = indiceDoEstado(seqDepois, depois, estado);
    expect(seqDepois[i]?.chave).toBe(atual.chave);
    // a série feita do primeiro exercício continua feita
    expect(depois.blocos[0]?.series.filter((s) => s.concluida)).toHaveLength(1);
  });

  it("trocar um exercício ANTERIOR (com séries feitas) deixa o player onde estava", () => {
    let antes = marcar(sessaoA(), PRIMEIRO, 5); // o agachamento inteiro
    antes = marcar(antes, SEGUNDO, 1);
    const seqAntes = sequenciaDoPlayer(antes);
    const atual = series(seqAntes, SEGUNDO)[1];
    if (!atual) throw new Error("série ausente");
    const estado = estadoDoPasso(atual, 0);

    const depois = trocar(antes, PRIMEIRO);
    const seqDepois = sequenciaDoPlayer(depois);
    expect(seqDepois[indiceDoEstado(seqDepois, depois, estado)]?.chave).toBe(atual.chave);
    // a série feita do exercício atual não se perde
    const blocoAtual = depois.blocos.find((b) => b.ordem === SEGUNDO);
    expect(blocoAtual?.series.filter((s) => s.concluida)).toHaveLength(1);
  });

  it("tirar a série do passo pela ficha, com as outras feitas, cai no 'firme?' do exercício", () => {
    let antes = marcar(sessaoA(), PRIMEIRO, 4); // 2 aquecimentos + séries 1 e 2
    const seqAntes = sequenciaDoPlayer(antes);
    const atual = series(seqAntes, PRIMEIRO)[4]; // série 3 de 3
    if (!atual) throw new Error("série ausente");
    const estado = estadoDoPasso(atual, 0);

    antes = ajustarPrescricaoDaSessao(antes, PRIMEIRO, { series: 2 }, { novoId: contador("a") });
    const seqDepois = sequenciaDoPlayer(antes);
    expect(indiceDaChave(seqDepois, estado.chave)).toBe(-1);
    expect(seqDepois[indiceDoEstado(seqDepois, antes, estado)]).toMatchObject({
      tipo: "firme",
      ordem: PRIMEIRO,
    });
  });

  it("estado salvo sem exercício (versão anterior) e chave sumida: vale a retomada, nunca -1", () => {
    const antes = marcar(marcar(sessaoA(), PRIMEIRO, 2), SEGUNDO, 1);
    const seqAntes = sequenciaDoPlayer(antes);
    const atual = series(seqAntes, PRIMEIRO)[2];
    if (!atual) throw new Error("série ausente");
    const depois = trocar(antes, PRIMEIRO);
    const seqDepois = sequenciaDoPlayer(depois);
    const i = indiceDoEstado(seqDepois, depois, { chave: atual.chave });
    expect(i).toBeGreaterThanOrEqual(0);
    // a retomada: a primeira série que falta na sessão (a 1 do exercício novo)
    expect(seqDepois[i]).toMatchObject({ tipo: "serie", ordem: PRIMEIRO, numero: 1 });
    expect(indiceDoEstado([], depois, { chave: atual.chave })).toBe(-1);
  });

  it("exercício sem série de trabalho, com tudo feito e sem 'firme?': fica no primeiro passo dele, não na retomada", () => {
    // o tipo permite um bloco só de aquecimentos (o catálogo não tem): sem
    // série que falta nem "firme?", o player continua no mesmo exercício
    const base = sessaoA();
    const sessao: SessaoLocal = {
      ...base,
      blocos: base.blocos.map((b) =>
        b.ordem !== SEGUNDO
          ? b
          : {
              ...b,
              series: b.series.slice(0, 1).map((x) => ({
                ...x,
                tipo: "aquecimento" as const,
                concluida: true,
              })),
            },
      ),
    };
    const seq = sequenciaDoPlayer(sessao);
    expect(seq.some((p) => p.tipo === "firme" && p.ordem === SEGUNDO)).toBe(false);
    const primeiroDoSegundo = seq.findIndex(
      (p) => p.tipo === "serie" && p.ordem === SEGUNDO,
    );
    expect(primeiroDoSegundo).toBeGreaterThan(0);

    const i = indiceDoEstado(seq, sessao, { chave: "serie:sumiu", ordem: SEGUNDO });
    expect(i).toBe(primeiroDoSegundo);
    expect(seq[i]).toMatchObject({ tipo: "serie", ordem: SEGUNDO, aquecimento: true });
    // a retomada levaria de volta ao 1º exercício, que ainda tem série a fazer
    const retomada = seq[indiceDoEstado(seq, sessao, { chave: "serie:sumiu" })];
    expect(retomada).toMatchObject({ tipo: "serie", ordem: PRIMEIRO });
  });
});

describe("§22.16 item 5 — pontosDoBloco", () => {
  it("2 aquecimentos + 3 séries = 5 pontos, na ordem, com os feitos cheios", () => {
    const sessao = marcar(sessaoA(), PRIMEIRO, 1);
    const seq = sequenciaDoPlayer(sessao);
    const bloco = sessao.blocos[0];
    const passo = series(seq, PRIMEIRO)[1];
    if (!bloco || !passo) throw new Error("bloco ausente");
    const { pontos, rotulo } = pontosDoBloco(bloco, passo);
    expect(pontos).toHaveLength(5);
    expect(pontos.map((p) => p.aquecimento)).toEqual([true, true, false, false, false]);
    expect(pontos.map((p) => p.feita)).toEqual([true, false, false, false, false]);
    expect(pontos.map((p) => p.atual)).toEqual([false, true, false, false, false]);
    expect(rotulo).toBe("Aquecimento 2 de 2 · 1 de 5 séries feitas");
  });

  it("na série de trabalho o nome diz 'Série N de 3'", () => {
    const sessao = marcar(sessaoA(), PRIMEIRO, 3);
    const seq = sequenciaDoPlayer(sessao);
    const bloco = sessao.blocos[0];
    const passo = series(seq, PRIMEIRO)[3];
    if (!bloco || !passo) throw new Error("bloco ausente");
    expect(pontosDoBloco(bloco, passo).rotulo).toBe("Série 2 de 3 · 3 de 5 séries feitas");
  });
});

describe("§22.16 item 6 — avisoDoVoto", () => {
  it("diz o que cada voto faz, sem prometer o que o app não faz", () => {
    expect(avisoDoVoto("Supino", "evitado")).toBe(
      "Supino vai para o fim das listas de substitutos e do Explorar.",
    );
    expect(avisoDoVoto("Supino", "preferido")).toBe("Anotado: você gosta de Supino.");
    expect(avisoDoVoto("Supino", null)).toBe("Voto tirado: Supino sem avaliação.");
    for (const voto of ["evitado", "preferido", null] as const) {
      expect(avisoDoVoto("X", voto)).not.toMatch(/não vamos mais montar/i);
    }
  });

  it("avisoDoPolegar: só confirma o voto gravado; sem gravação, diz que não anotou e não oferece 'Desfazer'", () => {
    for (const voto of ["evitado", "preferido", null] as const) {
      expect(avisoDoPolegar("Supino", voto, true)).toEqual({
        texto: avisoDoVoto("Supino", voto),
        desfazer: true,
      });
      const semGravar = avisoDoPolegar("Supino", voto, false);
      expect(semGravar).toEqual({
        texto: "Voto não anotado: o perfil ainda não carregou.",
        desfazer: false,
      });
      // nada do texto de voto gravado quando não gravou
      expect(semGravar.texto).not.toBe(avisoDoVoto("Supino", voto));
      expect(semGravar.texto).not.toMatch(/Supino|Anotado:|fim das listas/);
    }
  });
});

/* ------------------------------------------ item 7: '%' colado ao número */

/** Todas as strings de um JSON, com o caminho (para a mensagem de erro). */
function textos(valor: unknown, caminho: string, saida: [string, string][]): void {
  if (typeof valor === "string") saida.push([caminho, valor]);
  else if (Array.isArray(valor)) valor.forEach((v, i) => textos(v, `${caminho}[${i}]`, saida));
  else if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) textos(v, `${caminho}.${k}`, saida);
  }
}

describe("§22.16 item 7 — o '%' colado ao número", () => {
  it("nenhum texto de data/*.json separa o número do '%'", () => {
    const pasta = join(process.cwd(), "data");
    const achados: [string, string][] = [];
    for (const arquivo of readdirSync(pasta).filter((f) => f.endsWith(".json"))) {
      textos(JSON.parse(readFileSync(join(pasta, arquivo), "utf8")), arquivo, achados);
    }
    expect(achados.length).toBeGreaterThan(100);
    expect(achados.filter(([, t]) => /\d\s%/.test(t))).toEqual([]);
  });

  it("as descrições da retomada e o Guia também não", () => {
    const retomada = JSON.stringify([10, 20, 40].map((d) => faixaDaRetomada(d)));
    expect(retomada).toContain("60% da carga");
    expect(retomada).not.toMatch(/\d\s%/);
    const guia = JSON.stringify(SECOES);
    expect(guia).toContain("10% da carga");
    expect(guia).not.toMatch(/\d\s%/);
  });

  /*
   * Correção da auditoria 1: o " · semana leve (60%)" da ficha
   * (components/exercicios/historico-exercicio.tsx) não tinha guarda — voltar
   * a "60 %" ali não derrubava nada. Aqui o grep do aceite roda sozinho no
   * código-fonte de lib/, components/ e app/, sem os comentários (que ficam,
   * §22.16 item 7) e sem os testes.
   */
  it("nenhum texto do código (lib, components, app) separa o número do '%'", () => {
    const arquivos: string[] = [];
    const varrer = (pasta: string) => {
      for (const item of readdirSync(pasta, { withFileTypes: true })) {
        const caminho = join(pasta, item.name);
        if (item.isDirectory()) varrer(caminho);
        else if (/\.(ts|tsx)$/.test(item.name) && !/\.test\.tsx?$/.test(item.name)) {
          arquivos.push(caminho);
        }
      }
    };
    for (const pasta of ["lib", "components", "app"]) varrer(join(process.cwd(), pasta));
    expect(arquivos.length).toBeGreaterThan(100);

    const semComentarios = (fonte: string) =>
      fonte
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
    const achados: string[] = [];
    for (const arquivo of arquivos) {
      semComentarios(readFileSync(arquivo, "utf8"))
        .split("\n")
        .forEach((linha) => {
          if (/\d[ \u00a0]%/.test(linha)) achados.push(`${arquivo}: ${linha.trim()}`);
        });
    }
    expect(achados).toEqual([]);

    // o guarda pega o que a auditoria achou sem guarda
    const ficha = readFileSync(
      join(process.cwd(), "components/exercicios/historico-exercicio.tsx"),
      "utf8",
    );
    expect(ficha).toContain("semana leve (60%)");
    expect(/\d[ \u00a0]%/.test(semComentarios(ficha.replace("(60%)", "(60 %)")))).toBe(true);
  });
});
