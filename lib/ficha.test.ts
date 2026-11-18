import { describe, expect, it } from "vitest";
import { treinosDoExercicio } from "@/lib/catalogo";
import { acharColecao, colecoesPorAparelho, hrefDaColecao } from "@/lib/colecoes";
import { exercicios, tutorialPorExercicio } from "@/lib/dados";
import {
  ROTULO_DA_ABA,
  SEM_HISTORICO,
  abasDaFicha,
  historicoVazio,
  hrefDoEquipamento,
  linksDosTreinos,
  linhaDaCargaInicial,
  nivelDosTitulos,
  notaDaCargaInicial,
  ondeVoceEsta,
  podeVoltarNoApp,
  tagsDoEquipamento,
  textoRepetido,
} from "@/lib/ficha";
import { textosDaPagina } from "@/lib/ficha-espelho";
import { textoDaCarga } from "@/lib/hoje";
import { comPesoDaBarra, opcoesDeMontagem } from "@/lib/preferencias";
import { cargaDeHoje, prescricaoPadrao } from "@/lib/progressao";
import type { Exercicio } from "@/lib/schemas";
import type { BarraId } from "@/lib/montagem";

describe("as abas da ficha (SPEC §22.14 item 4)", () => {
  it("sem tutorial no JSON, só Vídeo e Músculos", () => {
    expect(abasDaFicha(false)).toEqual(["video", "musculos"]);
    expect(abasDaFicha(true)).toEqual(["video", "musculos", "tutorial"]);
  });

  it("os 81 exercícios têm tutorial hoje: todos oferecem a aba", () => {
    expect(exercicios).toHaveLength(81);
    for (const e of exercicios) {
      expect(abasDaFicha(tutorialPorExercicio(e.id) !== null), e.id).toContain("tutorial");
    }
  });

  it("o rótulo diz que o tutorial é no YouTube", () => {
    expect(ROTULO_DA_ABA.tutorial).toBe("Tutorial no YouTube");
  });
});

describe("nível dos títulos por contexto (SPEC §22.14 item 3e)", () => {
  it("página: H1 é o nome, seções H2; folha: título H2, seções H3", () => {
    expect(nivelDosTitulos(true)).toBe(2);
    expect(nivelDosTitulos(false)).toBe(3);
  });
});

describe("tags de equipamento levam à coleção do aparelho (SPEC §22.14 item 3c)", () => {
  const comColecao = new Set(colecoesPorAparelho().map((c) => c.id.replace("aparelho:", "")));

  it("em todos os 81 exercícios, tag com coleção vira link; sem coleção, texto", () => {
    let links = 0;
    let texto = 0;
    for (const e of exercicios) {
      for (const t of tagsDoEquipamento(e.equipamento)) {
        if (comColecao.has(t.tag)) {
          links += 1;
          expect(t.href, `${e.id} ${t.tag}`).toBe(`/explorar/aparelho/${t.tag}`);
          // a rota existe: a coleção é achada pelo id e contém o exercício
          const colecao = acharColecao(`aparelho:${t.tag}`);
          expect(colecao?.exercicios, `${e.id} ${t.tag}`).toContain(e.id);
        } else {
          texto += 1;
          expect(t.href, `${e.id} ${t.tag}`).toBeNull();
        }
        expect(t.rotulo.length).toBeGreaterThan(0);
      }
    }
    expect(links).toBeGreaterThan(0);
    expect(texto).toBeGreaterThan(0);
  });

  it("anilhas, halteres e barra W não têm coleção de aparelho", () => {
    expect(hrefDoEquipamento("anilhas")).toBeNull();
    expect(hrefDoEquipamento("halteres")).toBeNull();
    expect(hrefDoEquipamento("barra-w")).toBeNull();
    expect(hrefDoEquipamento("cross-over")).toBe("/explorar/aparelho/cross-over");
  });
});

describe("'Aparece em:' leva à coleção do treino (SPEC §22.14 item 3d)", () => {
  it("todo treino de todo exercício vira /explorar/treino/<id>", () => {
    let total = 0;
    for (const e of exercicios) {
      for (const t of linksDosTreinos(treinosDoExercicio(e.id))) {
        total += 1;
        expect(t.href).toBe(hrefDaColecao({ id: `treino:${t.id}` }));
        expect(t.href.startsWith("/explorar/treino/")).toBe(true);
        expect(acharColecao(`treino:${t.id}`)?.exercicios).toContain(e.id);
        expect(t.nome.length).toBeGreaterThan(0);
      }
    }
    expect(total).toBeGreaterThan(0);
  });
});

describe("histórico vazio vira um cartão (SPEC §22.14 item 2)", () => {
  const vazio = { temRecorde: false, pontos: 0, sessoes: 0, eventos: 0 };

  it("só com os quatro vazios", () => {
    expect(historicoVazio(vazio)).toBe(true);
    expect(historicoVazio({ ...vazio, temRecorde: true })).toBe(false);
    expect(historicoVazio({ ...vazio, pontos: 1 })).toBe(false);
    expect(historicoVazio({ ...vazio, sessoes: 1 })).toBe(false);
    expect(historicoVazio({ ...vazio, eventos: 1 })).toBe(false);
  });

  it("o texto diz quando o histórico começa", () => {
    expect(`${SEM_HISTORICO.titulo} — ${SEM_HISTORICO.frase}`).toBe(
      "Ainda sem histórico deste exercício — Ele começa na primeira série registrada.",
    );
  });
});

describe("'Voltar' só volta dentro do app (SPEC §22.14 item 1)", () => {
  it("com a Navigation API, vale o canGoBack (a origem só)", () => {
    // aba nova aberta direto na ficha: o about:blank conta no history.length
    expect(podeVoltarNoApp({ canGoBack: false }, 2)).toBe(false);
    expect(podeVoltarNoApp({ canGoBack: true }, 2)).toBe(true);
  });

  it("sem ela, o tamanho do histórico", () => {
    expect(podeVoltarNoApp(undefined, 1)).toBe(false);
    expect(podeVoltarNoApp(undefined, 3)).toBe(true);
    expect(podeVoltarNoApp({}, 1)).toBe(false);
  });
});

describe("'Onde você está' só diz o que a página não diz (SPEC §22.14 item 2)", () => {
  const base = {
    comoPagina: true,
    primeiraVez: true,
    assistencia: false,
    semanaLeve: false,
    cargaDoMotor: 20,
    cargaInicial: 20,
  };

  it("na página, sem avaliação do motor e com a carga do JSON, sai", () => {
    expect(ondeVoceEsta(base)).toEqual({
      mostrar: false,
      carga: false,
      proxima: false,
      nota: false,
      ajustePelasBarras: false,
    });
    // 0 e null são o mesmo "peso do corpo"
    expect(ondeVoceEsta({ ...base, cargaDoMotor: null, cargaInicial: 0 }).mostrar).toBe(false);
  });

  it("na folha e depois da primeira avaliação, é o cartão de sempre", () => {
    expect(ondeVoceEsta({ ...base, comoPagina: false })).toEqual({
      mostrar: true,
      carga: true,
      proxima: true,
      nota: true,
      ajustePelasBarras: false,
    });
    expect(ondeVoceEsta({ ...base, primeiraVez: false })).toEqual({
      mostrar: true,
      carga: true,
      proxima: true,
      nota: false,
      ajustePelasBarras: false,
    });
  });

  it("elástico e semana leve ficam na linha 'Próxima sessão', sem repetir a carga", () => {
    expect(ondeVoceEsta({ ...base, assistencia: true })).toEqual({
      mostrar: true,
      carga: false,
      proxima: true,
      nota: false,
      ajustePelasBarras: false,
    });
    expect(ondeVoceEsta({ ...base, semanaLeve: true }).mostrar).toBe(true);
    expect(ondeVoceEsta({ ...base, semanaLeve: true, cargaDoMotor: 12 }).ajustePelasBarras).toBe(
      false,
    );
  });

  it("com a carga do motor diferente da do JSON, mostra a carga real e o porquê", () => {
    // sem elástico nem semana leve, a "Próxima sessão" seria a prescrição padrão
    expect(ondeVoceEsta({ ...base, cargaDoMotor: 8, cargaInicial: 7.5 })).toEqual({
      mostrar: true,
      carga: true,
      proxima: false,
      nota: false,
      ajustePelasBarras: true,
    });
    // diferença abaixo do que a vírgula mostra não conta
    expect(ondeVoceEsta({ ...base, cargaDoMotor: 7.5000001, cargaInicial: 7.5 }).mostrar).toBe(
      false,
    );
  });

  /*
   * O caso da auditoria (SPEC §3.9): com as barras pesadas em Mais →
   * Equipamento, o motor sobe ou desce a carga inicial ao que dá para
   * montar. A página não pode esconder essa carga atrás do número cru do
   * JSON. Mesmo caminho do componente: cargaDeHoje + opcoesDeMontagem(prefs).
   */
  const cenarios: [string, BarraId, number][] = [
    ["barra W de 5 kg", "barra-w", 5],
    ["barra maciça de 8 kg", "barra-macica", 8],
    ["halteres de 2 kg", "halteres", 2],
  ];
  for (const [nome, barra, kg] of cenarios) {
    it(`com ${nome}: toda ficha em que o motor muda a carga mostra a carga do motor`, () => {
      const opcoes = opcoesDeMontagem(comPesoDaBarra(null, barra, kg));
      let mudadas = 0;
      for (const e of exercicios) {
        const alvo = cargaDeHoje(e, null, prescricaoPadrao(e), opcoes);
        const onde = ondeVoceEsta({
          comoPagina: true,
          primeiraVez: alvo.primeira_vez === true,
          assistencia: Boolean(alvo.assistencia),
          semanaLeve: Boolean(alvo.semana_leve),
          cargaDoMotor: alvo.carga_kg,
          cargaInicial: e.carga_inicial.kg,
        });
        const naPagina = onde.carga
          ? textoDaCarga(e.implemento, alvo.carga_kg)
          : linhaDaCargaInicial(e);
        expect(naPagina, e.id).toBe(textoDaCarga(e.implemento, alvo.carga_kg));
        if (onde.carga) mudadas += 1;
      }
      expect(mudadas).toBeGreaterThan(0);
    });
  }

  it("rosca-com-barra-w com a barra W de 5 kg: a página mostra '5 kg na barra'", () => {
    const e = exercicios.find((x) => x.id === "rosca-com-barra-w")!;
    const opcoes = opcoesDeMontagem(comPesoDaBarra(null, "barra-w", 5));
    const alvo = cargaDeHoje(e, null, prescricaoPadrao(e), opcoes);
    expect(linhaDaCargaInicial(e)).toBe("2 kg na barra");
    expect(textoDaCarga(e.implemento, alvo.carga_kg)).toBe("5 kg na barra");
    expect(
      ondeVoceEsta({
        comoPagina: true,
        primeiraVez: true,
        assistencia: false,
        semanaLeve: false,
        cargaDoMotor: alvo.carga_kg,
        cargaInicial: e.carga_inicial.kg,
      }).carga,
    ).toBe(true);
  });
});

describe("a nota da carga inicial não repete 'peso do corpo' (SPEC §22.14 item 3)", () => {
  it("carga 0 com a nota 'peso corporal': sem nota", () => {
    expect(notaDaCargaInicial({ kg: 0, nota: "peso corporal" })).toBeNull();
  });

  it("carga 0 com complemento: só o complemento, com maiúscula", () => {
    expect(
      notaDaCargaInicial({ kg: 0, nota: "peso corporal; anilha só quando passar de 15 limpas" }),
    ).toBe("Anilha só quando passar de 15 limpas");
  });

  it("com carga, a nota do JSON inteira", () => {
    expect(notaDaCargaInicial({ kg: 20, nota: "barra + 2 × 5 kg" })).toBe("barra + 2 × 5 kg");
  });

  it("nenhuma das fichas de carga 0 repete 'peso corporal' na seção", () => {
    const zero = exercicios.filter((e) => e.carga_inicial.kg === 0);
    expect(zero.length).toBeGreaterThan(0);
    for (const e of zero) {
      expect(linhaDaCargaInicial(e)).toBe("peso do corpo");
      expect(notaDaCargaInicial(e.carga_inicial) ?? "", e.id).not.toMatch(/peso corporal/i);
    }
  });
});

/*
 * SPEC §22.14 item 3 (correção da auditoria): o critério do e2e — nenhum
 * parágrafo ou item visível da página (12 caracteres ou mais) se repete nem
 * cabe inteiro dentro de outro — aplicado aos textos que a página mostra nos
 * 81 exercícios, com o histórico vazio (o estado do e2e), sem e com as barras
 * pesadas. Os textos vêm dos mesmos dados e das mesmas regras do componente.
 */
/** O critério mora em `lib/ficha.ts` (SPEC §22.17 item 2); o e2e usa o mesmo. */
const repetidos = textoRepetido;

describe("nada repetido na ficha em página, nos 81 (SPEC §22.14 item 3)", () => {
  const perfis: [string, ReturnType<typeof opcoesDeMontagem>][] = [
    ["sem barras pesadas", opcoesDeMontagem(null)],
    ["barra W de 5 kg", opcoesDeMontagem(comPesoDaBarra(null, "barra-w", 5))],
    ["barra maciça de 8 kg", opcoesDeMontagem(comPesoDaBarra(null, "barra-macica", 8))],
    ["halteres de 2 kg", opcoesDeMontagem(comPesoDaBarra(null, "halteres", 2))],
  ];
  for (const [nome, opcoes] of perfis) {
    it(`${nome}: nenhum parágrafo ou item se repete`, () => {
      expect(exercicios).toHaveLength(81);
      const falhas = exercicios
        .map((e) => [e.id, repetidos(textosDaPagina(e, opcoes))] as const)
        .filter(([, r]) => r.length > 0);
      expect(falhas).toEqual([]);
    });
  }

  it("o critério pega a repetição que a auditoria achou (a regra antiga falharia)", () => {
    // 'peso corporal' no subtítulo e na nota crua: o que a página mostrava
    expect(repetidos(["Core · Tatame · peso corporal", "peso corporal"])).toHaveLength(1);
    expect(repetidos(["peso do corpo", "peso do corpo"])).toHaveLength(1);
  });
});

describe("o texto da ficha fala com a pessoa (SPEC §22.14, correção da auditoria 2)", () => {
  /** Todo texto do JSON que a ficha mostra na tela. */
  const textosVisiveis = (e: Exercicio): string[] => [
    ...e.passos,
    e.erro_comum,
    e.montagem,
    e.equipamento_texto,
    e.carga_inicial.nota,
    e.progressao.regra,
  ];

  it("nenhum dos 81 cita nome de arquivo (.json) na tela", () => {
    const comArquivo = exercicios.filter((e) => textosVisiveis(e).some((t) => /\.json\b/.test(t)));
    expect(comArquivo.map((e) => e.id)).toEqual([]);
  });

  it("o peso da barra se corrige em Mais → Equipamento, não 'no perfil'", () => {
    const noPerfil = exercicios.filter((e) =>
      textosVisiveis(e).some((t) => /corrija no perfil/i.test(t)),
    );
    expect(noPerfil.map((e) => e.id)).toEqual([]);
    const barraW = exercicios.filter((e) => /pese na balança/.test(e.carga_inicial.nota));
    expect(barraW.length).toBeGreaterThan(0);
    for (const e of barraW) expect(e.carga_inicial.nota).toContain("Mais → Equipamento");
  });
});
