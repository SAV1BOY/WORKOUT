import { describe, expect, it } from "vitest";
import { perfilInicial } from "@/lib/dados";
import {
  ajustarSemana,
  garantirPerfil,
  montarSeedPerfil,
  precisaSeed,
} from "@/lib/queries/perfil";
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

/* ------------------------------------------------ garantirPerfil (SPEC §21.3) */

/** Um cliente Supabase de mentira só com o que `garantirPerfil` usa. */
function clienteFalso(linha: LinhaPerfil | null) {
  const escritas: unknown[] = [];
  const cliente = {
    from() {
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => ({ data: linha, error: null }) };
            },
          };
        },
        upsert(valores: unknown) {
          escritas.push(valores);
          return {
            select() {
              return {
                maybeSingle: async () => ({
                  data: { ...(linha ?? {}), ...(valores as object) },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  };
  return { cliente, escritas };
}

describe("garantirPerfil: o seed do JSON é só do dono (SPEC §21.3)", () => {
  const recemCriada: LinhaPerfil = {
    ...linhaPadrao,
    nome: "joana.ferreira",
    altura_cm: null,
  };

  it("o dono com o perfil recém-criado recebe o seed de data/perfil.json", async () => {
    const { cliente, escritas } = clienteFalso(recemCriada);
    const perfil = await garantirPerfil(
      cliente as never,
      "u1",
      { dono: true },
    );
    expect(escritas).toHaveLength(1);
    expect(escritas[0]).toMatchObject({
      user_id: "u1",
      altura_cm: perfilInicial.altura_cm,
      data_inicio: perfilInicial.data_inicio,
    });
    expect(perfil?.altura_cm).toBe(perfilInicial.altura_cm);
  });

  it("uma conta nova (não dono) fica como o schema criou: nada é escrito", async () => {
    const { cliente, escritas } = clienteFalso(recemCriada);
    const perfil = await garantirPerfil(
      cliente as never,
      "u2",
      { dono: false },
    );
    expect(escritas).toHaveLength(0);
    expect(perfil).toEqual(recemCriada);
    // a altura do Miguel nunca vai parar no perfil de outra pessoa
    expect(perfil?.altura_cm).toBeNull();
    expect(perfil?.nome).toBe("joana.ferreira");
  });

  it("sem opção explícita continua sendo o seed do dono (compatível com o de antes)", async () => {
    const { cliente, escritas } = clienteFalso(null);
    await garantirPerfil(cliente as never, "u1");
    expect(escritas).toHaveLength(1);
  });
});
