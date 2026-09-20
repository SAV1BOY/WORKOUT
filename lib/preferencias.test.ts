import { describe, expect, it } from "vitest";
import { cargasPossiveis, montagem } from "@/lib/montagem";
import {
  PESO_BARRA_MAX,
  PESO_BARRA_MIN,
  comDescansoPadraoS,
  comEvitado,
  comLigado,
  comPesoDaBarra,
  comGuiaVisto,
  comPreparacaoS,
  comTema,
  descansoPadraoS,
  guiaVisto,
  evitadosPorUltimo,
  evitado,
  evitarExercicios,
  ilustracaoAlternando,
  ligado,
  comPreferido,
  comVoto,
  opcoesDoPlayer,
  preferido,
  preferidos,
  preparacaoS,
  votoDoExercicio,
  semEvitados,
  opcoesDeMontagem,
  pesoDeBarraValido,
  pesosDasBarras,
  temaDasPrefs,
  temaDoNextThemes,
  temaDoTema,
} from "@/lib/preferencias";
import type { Prefs } from "@/lib/types";

describe("tema (SPEC §3.9)", () => {
  it("sem preferência é automático", () => {
    expect(temaDasPrefs(null)).toBe("auto");
    expect(temaDasPrefs({})).toBe("auto");
    expect(temaDasPrefs({ tema: "gato" } as unknown as Prefs)).toBe("auto");
  });

  it("vai e volta do nome que o next-themes usa", () => {
    expect(temaDoNextThemes("claro")).toBe("light");
    expect(temaDoNextThemes("escuro")).toBe("dark");
    expect(temaDoNextThemes("auto")).toBe("system");
    expect(temaDoTema("dark")).toBe("escuro");
    expect(temaDoTema("light")).toBe("claro");
    expect(temaDoTema(undefined)).toBe("auto");
  });

  it("guardar o tema não apaga o resto das prefs", () => {
    const antes: Prefs = { meta_peso: 90, fase2_adiada_ate: "2026-10-01" };
    const depois = comTema(antes, "escuro");
    expect(depois.tema).toBe("escuro");
    expect(depois.meta_peso).toBe(90);
    expect(depois.fase2_adiada_ate).toBe("2026-10-01");
  });
});

describe("liga/desliga do timer", () => {
  it("ausente é ligado (é o default do schema)", () => {
    expect(ligado({}, "descanso_som")).toBe(true);
    expect(ligado(null, "manter_tela")).toBe(true);
  });

  it("só `false` desliga", () => {
    expect(ligado({ descanso_vibra: false }, "descanso_vibra")).toBe(false);
    expect(ligado({ descanso_vibra: true }, "descanso_vibra")).toBe(true);
  });

  it("desligar um não mexe nos outros", () => {
    const depois = comLigado({ descanso_som: false }, "manter_tela", false);
    expect(depois.descanso_som).toBe(false);
    expect(depois.manter_tela).toBe(false);
  });
});

describe("pesos das barras (SPEC §3.9 com §6.4)", () => {
  it("jsonb vazio, torto ou com peso impossível não vira override", () => {
    expect(pesosDasBarras(null)).toEqual({});
    expect(pesosDasBarras({ pesos_barras: "quatro quilos" })).toEqual({});
    expect(pesosDasBarras({ pesos_barras: { "barra-w": "4,8" } })).toEqual({});
    expect(pesosDasBarras({ pesos_barras: { "barra-w": 0 } })).toEqual({});
    expect(pesosDasBarras({ pesos_barras: { "barra-w": 900 } })).toEqual({});
    expect(pesosDasBarras({ pesos_barras: { halterOco: 3 } })).toEqual({});
  });

  it("guarda e apaga o peso medido", () => {
    const comW = comPesoDaBarra({}, "barra-w", 4.8);
    expect(pesosDasBarras(comW)).toEqual({ "barra-w": 4.8 });

    const comDuas = comPesoDaBarra(comW, "barra-reta-oca", 5.2);
    expect(pesosDasBarras(comDuas)).toEqual({
      "barra-w": 4.8,
      "barra-reta-oca": 5.2,
    });

    const semW = comPesoDaBarra(comDuas, "barra-w", null);
    expect(pesosDasBarras(semW)).toEqual({ "barra-reta-oca": 5.2 });
  });

  it("os limites do que é um peso de barra", () => {
    expect(pesoDeBarraValido(PESO_BARRA_MIN)).toBe(true);
    expect(pesoDeBarraValido(PESO_BARRA_MAX)).toBe(true);
    expect(pesoDeBarraValido(PESO_BARRA_MIN - 0.1)).toBe(false);
    expect(pesoDeBarraValido(PESO_BARRA_MAX + 0.1)).toBe(false);
    expect(pesoDeBarraValido(Number.NaN)).toBe(false);
  });

  it("sem nenhum peso medido, a montagem não recebe opção nenhuma", () => {
    expect(opcoesDeMontagem({})).toEqual({});
    expect(opcoesDeMontagem({ meta_peso: 90 })).toEqual({});
  });

  /**
   * O ponto do marco: pesar a barra W muda a escala DELA e só dela — a barra
   * maciça continua 7,5 + 2k (SPEC §6.4). Era o que o `pesoBarra` sozinho não
   * dava conta, porque a sessão tem exercícios de barras diferentes.
   */
  it("o peso medido muda só a escala daquela barra", () => {
    const opcoes = opcoesDeMontagem(
      comPesoDaBarra({}, "barra-w", 4.8),
    );

    const w = cargasPossiveis("barra_w", opcoes);
    expect(w[0]).toBe(4.8);
    expect(w[1]).toBe(6.8);

    const macica = cargasPossiveis("barra_macica", opcoes);
    expect(macica[0]).toBe(7.5);
    expect(macica[1]).toBe(9.5);

    const halter = cargasPossiveis("halteres", opcoes);
    expect(halter[0]).toBe(1.5);
  });

  it("a montagem da barra W pesada fecha com a barra certa", () => {
    const opcoes = opcoesDeMontagem(comPesoDaBarra({}, "barra-w", 4.8));
    const m = montagem(14.8, "barra_w", opcoes);
    expect(m.pesoBarra).toBe(4.8);
    expect(m.total).toBe(14.8);
    expect(m.exato).toBe(true);
    expect(m.porLado).toEqual([5]);
  });

  it("`pesoBarra` (override direto) ainda vence o do perfil", () => {
    const opcoes = {
      ...opcoesDeMontagem(comPesoDaBarra({}, "barra-w", 4.8)),
      pesoBarra: 6,
    };
    expect(cargasPossiveis("barra_w", opcoes)[0]).toBe(6);
  });
});

describe("preferências do player (SPEC §14.1 e §14.4)", () => {
  it("preparação: 10 s por padrão, presa entre 0 e 60", () => {
    expect(preparacaoS(null)).toBe(10);
    expect(preparacaoS({ preparacao_s: 15 })).toBe(15);
    expect(preparacaoS({ preparacao_s: 0 })).toBe(0);
    expect(preparacaoS({ preparacao_s: 999 })).toBe(60);
    expect(preparacaoS({ preparacao_s: -5 })).toBe(0);
    expect(preparacaoS({ preparacao_s: "dez" })).toBe(10);
  });

  it("gravar a preparação mantém o resto das prefs; null volta ao padrão", () => {
    const prefs = comPreparacaoS({ tema: "escuro" }, 20);
    expect(prefs).toMatchObject({ tema: "escuro", preparacao_s: 20 });
    expect(comPreparacaoS(prefs, null).preparacao_s).toBeUndefined();
  });

  it("descanso padrão vazio = o do exercício", () => {
    expect(descansoPadraoS(null)).toBeNull();
    expect(descansoPadraoS({ descanso_padrao_s: 0 })).toBeNull();
    expect(descansoPadraoS({ descanso_padrao_s: 90 })).toBe(90);
    expect(descansoPadraoS({ descanso_padrao_s: 1 })).toBe(5);
    expect(descansoPadraoS({ descanso_padrao_s: 99_999 })).toBe(900);
    expect(comDescansoPadraoS({}, 75).descanso_padrao_s).toBe(75);
    expect(comDescansoPadraoS({ descanso_padrao_s: 75 }, null).descanso_padrao_s)
      .toBeUndefined();
  });

  it("avançar sozinho vem ligado, como as outras chaves de sim/não", () => {
    expect(ligado(null, "avancar_sozinho")).toBe(true);
    expect(ligado({ avancar_sozinho: false }, "avancar_sozinho")).toBe(false);
  });

  it("opcoesDoPlayer junta as duas", () => {
    expect(opcoesDoPlayer({ preparacao_s: 5, descanso_padrao_s: 60 })).toEqual({
      preparacaoS: 5,
      descansoPadraoS: 60,
    });
  });
});

describe('"não gosto" (SPEC §14.1.2)', () => {
  it("lê a lista sem confiar no jsonb", () => {
    expect(evitarExercicios(null)).toEqual([]);
    expect(evitarExercicios({ evitar_exercicios: "prancha" })).toEqual([]);
    expect(
      evitarExercicios({ evitar_exercicios: ["prancha", "prancha", 7, "", "burpee"] }),
    ).toEqual(["prancha", "burpee"]);
  });

  it("marca e desmarca sem perder as outras chaves", () => {
    const um = comEvitado({ tema: "claro" }, "prancha", true);
    expect(um).toMatchObject({ tema: "claro", evitar_exercicios: ["prancha"] });
    expect(evitado(um, "prancha")).toBe(true);
    const dois = comEvitado(um, "prancha", true);
    expect(dois.evitar_exercicios).toEqual(["prancha"]);
    const zero = comEvitado(dois, "prancha", false);
    expect(zero.evitar_exercicios).toEqual([]);
    expect(semEvitados(um).evitar_exercicios).toEqual([]);
  });

  it("os evitados vão para o fim da lista, sem sumir nem embaralhar", () => {
    const itens = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const prefs = { evitar_exercicios: ["b", "d"] };
    expect(evitadosPorUltimo(itens, (i) => i.id, prefs).map((i) => i.id)).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
    expect(evitadosPorUltimo(itens, (i) => i.id, null).map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});

describe("guia de uso (SPEC §20.2)", () => {
  it("conta nova: sem a chave, o guia ainda não foi visto", () => {
    expect(guiaVisto(undefined)).toBe(false);
    expect(guiaVisto(null)).toBe(false);
    expect(guiaVisto({})).toBe(false);
  });

  it("só `true` conta (o jsonb pode vir de um backup)", () => {
    expect(guiaVisto({ guia_visto: true })).toBe(true);
    expect(guiaVisto({ guia_visto: false })).toBe(false);
    expect(guiaVisto({ guia_visto: "sim" })).toBe(false);
    expect(guiaVisto({ guia_visto: 1 })).toBe(false);
  });

  it("marcar não perde as outras chaves", () => {
    const antes: Prefs = { tema: "escuro", conquistas_vistas: ["forca-1"] };
    const depois = comGuiaVisto(antes);
    expect(depois.guia_visto).toBe(true);
    expect(depois.tema).toBe("escuro");
    expect(depois.conquistas_vistas).toEqual(["forca-1"]);
    // sem mutar o original
    expect(antes.guia_visto).toBeUndefined();
  });
});

describe('"gostei" e o polegar de três estados (SPEC §22.1)', () => {
  it("sem nenhum voto, o exercício não é preferido nem evitado", () => {
    expect(preferidos({})).toEqual([]);
    expect(preferido({}, "supino-reto")).toBe(false);
    expect(votoDoExercicio({}, "supino-reto")).toBeNull();
    expect(votoDoExercicio(null, "supino-reto")).toBeNull();
  });

  it("o jsonb vem do banco: só sobram strings, sem repetição", () => {
    expect(preferidos({ preferidos: ["a", "a", "", 7, null, "b"] })).toEqual([
      "a",
      "b",
    ]);
    expect(preferidos({ preferidos: "a" })).toEqual([]);
    expect(preferidos({ preferidos: null })).toEqual([]);
  });

  it("marcar e desmarcar não perde as outras chaves", () => {
    const antes: Prefs = { tema: "escuro", evitar_exercicios: ["remada"] };
    const gostou = comPreferido(antes, "supino-reto", true);
    expect(gostou.preferidos).toEqual(["supino-reto"]);
    expect(gostou.tema).toBe("escuro");
    expect(gostou.evitar_exercicios).toEqual(["remada"]);
    expect(preferidos(comPreferido(gostou, "supino-reto", false))).toEqual([]);
    // sem mutar o original
    expect(antes.preferidos).toBeUndefined();
  });

  it("o voto é um só: gostar deixa de evitar, e evitar deixa de preferir", () => {
    const evitando = comVoto({}, "supino-reto", "evitado");
    expect(votoDoExercicio(evitando, "supino-reto")).toBe("evitado");
    expect(evitarExercicios(evitando)).toEqual(["supino-reto"]);
    expect(preferidos(evitando)).toEqual([]);

    const gostando = comVoto(evitando, "supino-reto", "preferido");
    expect(votoDoExercicio(gostando, "supino-reto")).toBe("preferido");
    expect(evitarExercicios(gostando)).toEqual([]);
    expect(preferidos(gostando)).toEqual(["supino-reto"]);

    const nenhum = comVoto(gostando, "supino-reto", null);
    expect(votoDoExercicio(nenhum, "supino-reto")).toBeNull();
    expect(evitarExercicios(nenhum)).toEqual([]);
    expect(preferidos(nenhum)).toEqual([]);
  });

  it("o voto de um exercício não mexe no voto dos outros", () => {
    const antes = comVoto(comVoto({}, "remada", "evitado"), "agacho", "preferido");
    const depois = comVoto(antes, "supino-reto", "evitado");
    expect(evitarExercicios(depois).sort()).toEqual(["remada", "supino-reto"]);
    expect(preferidos(depois)).toEqual(["agacho"]);
  });
});

describe("ilustração alternada e o menos movimento (SPEC §22.1)", () => {
  const base = {
    duasPosicoes: true,
    escolha: null as boolean | null,
    menosMovimento: false,
    escondido: false,
  };

  it("com uma posição só não há o que alternar", () => {
    expect(ilustracaoAlternando({ ...base, duasPosicoes: false })).toBe(false);
  });

  it("sem toque nenhum, alterna — a não ser sob reduced-motion", () => {
    expect(ilustracaoAlternando(base)).toBe(true);
    expect(ilustracaoAlternando({ ...base, menosMovimento: true })).toBe(false);
  });

  it("depois do toque manda o toque, mesmo sob reduced-motion", () => {
    expect(
      ilustracaoAlternando({ ...base, menosMovimento: true, escolha: false }),
    ).toBe(true);
    expect(ilustracaoAlternando({ ...base, escolha: true })).toBe(false);
  });

  it("a aba escondida nunca anima, tenha havido toque ou não", () => {
    expect(ilustracaoAlternando({ ...base, escondido: true })).toBe(false);
    expect(
      ilustracaoAlternando({ ...base, escondido: true, escolha: false }),
    ).toBe(false);
  });
});
