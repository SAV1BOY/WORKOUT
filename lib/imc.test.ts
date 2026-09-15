/** IMC (SPEC §13.5 e §14.1.5): a conta, as faixas e a barra de 15 a 40. */
import { describe, expect, it } from "vitest";
import {
  FAIXAS_DE_IMC,
  IMC_MAX,
  IMC_MIN,
  faixaDoImc,
  imc,
  larguraDaFaixa,
  posicaoNaBarra,
} from "@/lib/imc";

describe("imc", () => {
  it("peso ÷ altura², com uma casa", () => {
    expect(imc(80, 190)).toBe(22.2);
    expect(imc(70, 175)).toBe(22.9);
    expect(imc(100, 180)).toBe(30.9);
  });

  it("sem peso ou sem altura não há IMC", () => {
    expect(imc(null, 190)).toBeNull();
    expect(imc(80, null)).toBeNull();
    expect(imc(80, undefined)).toBeNull();
    expect(imc(0, 190)).toBeNull();
    expect(imc(80, 0)).toBeNull();
    expect(imc(Number.NaN, 190)).toBeNull();
  });
});

describe("faixas", () => {
  it("as cinco faixas da SPEC, com o rótulo em pt-BR", () => {
    expect(faixaDoImc(17)?.rotulo).toBe("Abaixo do peso");
    expect(faixaDoImc(22.2)?.rotulo).toBe("Saudável");
    expect(faixaDoImc(27)?.rotulo).toBe("Sobrepeso");
    expect(faixaDoImc(32)?.rotulo).toBe("Obesidade grau 1");
    expect(faixaDoImc(41)?.rotulo).toBe("Obesidade grau 2 ou 3");
    expect(faixaDoImc(null)).toBeNull();
  });

  it("as bordas pertencem à faixa de cima", () => {
    expect(faixaDoImc(18.5)?.chave).toBe("saudavel");
    expect(faixaDoImc(25)?.chave).toBe("sobrepeso");
    expect(faixaDoImc(30)?.chave).toBe("obesidade1");
    expect(faixaDoImc(35)?.chave).toBe("obesidade2");
  });

  it("as larguras da barra somam 1", () => {
    const soma = FAIXAS_DE_IMC.reduce((t, f) => t + larguraDaFaixa(f), 0);
    expect(soma).toBeCloseTo(1, 10);
  });
});

describe("posição na barra", () => {
  it("vai de 0 a 1 entre 15 e 40 e nunca vaza", () => {
    expect(posicaoNaBarra(IMC_MIN)).toBe(0);
    expect(posicaoNaBarra(IMC_MAX)).toBe(1);
    expect(posicaoNaBarra(27.5)).toBeCloseTo(0.5, 10);
    expect(posicaoNaBarra(10)).toBe(0);
    expect(posicaoNaBarra(60)).toBe(1);
    expect(posicaoNaBarra(null)).toBeNull();
  });
});
