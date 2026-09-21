import { describe, expect, it } from "vitest";
import { aceitarDigitacao } from "@/lib/digitar-numero";

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
