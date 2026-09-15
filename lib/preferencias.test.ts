import { describe, expect, it } from "vitest";
import { cargasPossiveis, montagem } from "@/lib/montagem";
import {
  PESO_BARRA_MAX,
  PESO_BARRA_MIN,
  comLigado,
  comPesoDaBarra,
  comTema,
  ligado,
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
