import { describe, expect, it } from "vitest";
import { aceitarDigitacao, erroDaContagem } from "@/lib/digitar-numero";

describe("aceitarDigitacao", () => {
  it("deixa digitar um decimal inteiro, tecla a tecla", () => {
    let texto = "";
    for (const tecla of ["1", "2", ",", "5"]) {
      texto = aceitarDigitacao(texto, texto + tecla);
    }
    expect(texto).toBe("12,5");
  });

  it("recusa a segunda vírgula: é o '11,5,5' do campo de carga", () => {
    expect(aceitarDigitacao("11,5", "11,5,")).toBe("11,5");
    expect(aceitarDigitacao("11,5", "11,5,5")).toBe("11,5");
  });

  it("ponto vira vírgula na tela", () => {
    expect(aceitarDigitacao("12", "12.")).toBe("12,");
    expect(aceitarDigitacao("12.", "12.5")).toBe("12,5");
  });

  it("ponto depois de vírgula é um segundo separador, e não entra", () => {
    expect(aceitarDigitacao("12,5", "12,5.")).toBe("12,5");
  });

  it("vazio é permitido: é como se apaga o campo", () => {
    expect(aceitarDigitacao("12,5", "")).toBe("");
  });

  it("aceita começar pela vírgula", () => {
    expect(aceitarDigitacao("", ",")).toBe(",");
    expect(aceitarDigitacao(",", ",5")).toBe(",5");
  });

  it("o sinal de menos só entra onde o campo aceita negativo", () => {
    expect(aceitarDigitacao("", "-", { negativo: true })).toBe("-");
    expect(aceitarDigitacao("-", "-2", { negativo: true })).toBe("-2");
    expect(aceitarDigitacao("", "-")).toBe("");
    expect(aceitarDigitacao("2", "-2")).toBe("2");
  });

  it("o menos só vale na frente", () => {
    expect(aceitarDigitacao("2", "2-", { negativo: true })).toBe("2");
  });

  it("letra, espaço e sinal solto não entram", () => {
    expect(aceitarDigitacao("12", "12a")).toBe("12");
    expect(aceitarDigitacao("12", "12 ")).toBe("12");
    expect(aceitarDigitacao("12", "12+")).toBe("12");
    expect(aceitarDigitacao("12", "1e3")).toBe("12");
  });

  it("apagar do meio continua valendo", () => {
    expect(aceitarDigitacao("12,5", "1,5")).toBe("1,5");
  });
});

describe("contagens", () => {
  it("preserva o separador enquanto se digita, sem juntar 9 e 5", () => {
    let texto = "9";
    for (const tecla of [",", "5"]) {
      texto = aceitarDigitacao(texto, texto + tecla);
      expect(erroDaContagem(texto)).toBe("Use um número inteiro.");
    }
    expect(texto).toBe("9,5");
    expect(erroDaContagem(aceitarDigitacao("12", "9.5"))).toBe("Use um número inteiro.");
  });

  it.each(["", "0", "13", "1050", "-5", "-2147483648", "2147483647"])("permite a contagem %j", (texto) => {
    expect(erroDaContagem(texto)).toBeNull();
  });

  it("identifica estouro sem transformar a entrada no limite", () => {
    expect(erroDaContagem("2147483648")).toBe("O maior valor permitido é 2.147.483.647.");
    expect(erroDaContagem("2147483648", 99)).toBe("O maior valor permitido é 99.");
    expect(erroDaContagem("-2147483649")).toBe("O menor valor permitido é −2.147.483.648.");
    expect(erroDaContagem("9".repeat(400))).toBe("O maior valor permitido é 2.147.483.647.");
  });
});
