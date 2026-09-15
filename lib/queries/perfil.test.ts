import { describe, expect, it } from "vitest";
import { perfilInicial } from "@/lib/dados";
import { ajustarSemana, montarSeedPerfil, precisaSeed } from "@/lib/queries/perfil";
import type { LinhaPerfil } from "@/lib/types";

const linhaPadrao: LinhaPerfil = {
  user_id: "u1",
  nome: "Miguel",
  altura_cm: null,
  data_inicio: "2026-01-01",
  fase_atual: "fase1",
  fase_desde: "2026-01-01",
  objetivo: "forca_musculo",
  semana_corrida: 1,
  semana_corda: 1,
  semana_fixa: 1,
  ultimo_treino: null,
  prefs: {},
};

describe("seed do perfil", () => {
  it("vem inteiro de data/perfil.json", () => {
    const seed = montarSeedPerfil();
    expect(seed.nome).toBe(perfilInicial.nome);
    expect(seed.altura_cm).toBe(perfilInicial.altura_cm);
    expect(seed.data_inicio).toBe(perfilInicial.data_inicio);
    expect(seed.fase_atual).toBe(perfilInicial.fase_inicial);
    expect(seed.fase_desde).toBe(perfilInicial.data_inicio);
  });

  it("não inventa conteúdo: usa o perfil recebido", () => {
    const seed = montarSeedPerfil({
      ...perfilInicial,
      nome: "Outro",
      altura_cm: 175,
      data_inicio: "2027-03-01",
      fase_inicial: "fase2",
    });
    expect(seed).toEqual({
      nome: "Outro",
      altura_cm: 175,
      data_inicio: "2027-03-01",
      fase_atual: "fase2",
      fase_desde: "2027-03-01",
    });
  });
});

describe("quando fazer o seed", () => {
  it("sem linha no banco", () => {
    expect(precisaSeed(null)).toBe(true);
  });
  it("linha recém-criada pelo trigger (sem altura)", () => {
    expect(precisaSeed(linhaPadrao)).toBe(true);
  });
  it("nome vazio", () => {
    expect(precisaSeed({ ...linhaPadrao, nome: "  ", altura_cm: 190 })).toBe(
      true,
    );
  });
  it("perfil já preenchido não é sobrescrito", () => {
    expect(
      precisaSeed({
        ...linhaPadrao,
        altura_cm: 190,
        data_inicio: "2026-09-14",
      }),
    ).toBe(false);
  });
});

describe("ajustarSemana (SPEC §5.5: ajuste manual no perfil)", () => {
  it("avança e repete um degrau", () => {
    expect(ajustarSemana(3, 1)).toBe(4);
    expect(ajustarSemana(3, -1)).toBe(2);
  });

  it("não sai do plano", () => {
    expect(ajustarSemana(1, -1)).toBe(1);
    expect(ajustarSemana(12, 1, 12)).toBe(12);
    expect(ajustarSemana(20, 1, 12)).toBe(12);
  });
});
