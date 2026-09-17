/**
 * A cota de contas do lado do app (SPEC §21.3). O que estes testes seguram é a
 * regra que decide se a tela de login oferece "Criar conta" — e, principalmente,
 * o que ela faz quando o banco não responde: **a porta fica aberta**. Esconder
 * o botão no escuro esconderia o problema e travaria o cadastro sem motivo.
 */
import { describe, expect, it } from "vitest";
import {
  LIMITE_MAXIMO,
  LIMITE_MINIMO,
  contasCadastradas,
  haVaga,
  lerVagas,
  limiteValido,
  salvarLimiteDeContas,
  vagasParaConta,
} from "@/lib/queries/contas";

/** Um cliente Supabase de mentira com só o que estas funções usam. */
function clienteFalso(respostas: {
  rpc?: (nome: string) => { data: unknown; error: { message: string } | null };
  update?: { error: { message: string } | null };
}) {
  const chamadas: { rpc: string[]; update: unknown[]; filtro: unknown[] } = {
    rpc: [],
    update: [],
    filtro: [],
  };
  const cliente = {
    rpc: (nome: string) => {
      chamadas.rpc.push(nome);
      const r = respostas.rpc?.(nome) ?? { data: null, error: null };
      return Promise.resolve(r);
    },
    from: () => ({
      update: (campos: unknown) => {
        chamadas.update.push(campos);
        return {
          eq: (coluna: string, valor: unknown) => {
            chamadas.filtro.push([coluna, valor]);
            return Promise.resolve(respostas.update ?? { error: null });
          },
        };
      },
    }),
  };
  // o tipo real é SupabaseClient; aqui só interessa a superfície usada
  return { cliente: cliente as never, chamadas };
}

describe("lerVagas", () => {
  it("aceita os dois números do jsonb", () => {
    expect(lerVagas({ contas: 3, limite: 5 })).toEqual({ contas: 3, limite: 5 });
    expect(lerVagas({ contas: 0, limite: 1 })).toEqual({ contas: 0, limite: 1 });
  });

  it("recusa o que não são dois números", () => {
    expect(lerVagas(null)).toBeNull();
    expect(lerVagas("5")).toBeNull();
    expect(lerVagas({})).toBeNull();
    expect(lerVagas({ contas: 3 })).toBeNull();
    expect(lerVagas({ contas: "3", limite: 5 })).toBeNull();
    expect(lerVagas({ contas: Number.NaN, limite: 5 })).toBeNull();
  });

  it("não deixa passar nada além dos dois números", () => {
    // se um dia a função do banco devolvesse e-mails, eles não entrariam aqui
    expect(lerVagas({ contas: 1, limite: 5, emails: ["a@b.c"] })).toEqual({
      contas: 1,
      limite: 5,
    });
  });
});

describe("haVaga", () => {
  it("cabe enquanto o número de contas é menor que o limite", () => {
    expect(haVaga({ contas: 1, limite: 5 })).toBe(true);
    expect(haVaga({ contas: 4, limite: 5 })).toBe(true);
    expect(haVaga({ contas: 5, limite: 5 })).toBe(false);
    // limite baixado com contas de sobra: fecha, mas ninguém é expulso
    expect(haVaga({ contas: 6, limite: 5 })).toBe(false);
  });

  it("sem resposta do banco a porta fica aberta (quem barra é o trigger)", () => {
    expect(haVaga(null)).toBe(true);
  });
});

describe("vagasParaConta", () => {
  it("devolve os dois números do RPC", async () => {
    const { cliente, chamadas } = clienteFalso({
      rpc: () => ({ data: { contas: 2, limite: 5 }, error: null }),
    });
    expect(await vagasParaConta(cliente)).toEqual({ contas: 2, limite: 5 });
    expect(chamadas.rpc).toEqual(["vagas_para_conta"]);
  });

  it("o erro do RPC vira null, não exceção", async () => {
    const { cliente } = clienteFalso({
      rpc: () => ({ data: null, error: { message: 'function does not exist' } }),
    });
    expect(await vagasParaConta(cliente)).toBeNull();
  });

  it("a rede caindo no meio também vira null", async () => {
    const cliente = {
      rpc: () => Promise.reject(new Error("fetch failed")),
    } as never;
    expect(await vagasParaConta(cliente)).toBeNull();
  });
});

describe("contasCadastradas", () => {
  it("devolve a lista que o banco mandou", async () => {
    const lista = [
      { email: "a@b.c", criada_em: "2026-09-14T10:00:00Z", ultimo_acesso: null },
    ];
    const { cliente, chamadas } = clienteFalso({
      rpc: () => ({ data: lista, error: null }),
    });
    expect(await contasCadastradas(cliente)).toEqual(lista);
    expect(chamadas.rpc).toEqual(["contas_cadastradas"]);
  });

  it("vazio quem não é o dono (a função do banco devolve zero linhas)", async () => {
    const { cliente } = clienteFalso({ rpc: () => ({ data: [], error: null }) });
    expect(await contasCadastradas(cliente)).toEqual([]);
  });

  it("erro do banco chega a quem chamou (a tela mostra o recado)", async () => {
    const { cliente } = clienteFalso({
      rpc: () => ({ data: null, error: { message: "sem permissão" } }),
    });
    await expect(contasCadastradas(cliente)).rejects.toThrow("sem permissão");
  });
});

describe("limiteValido", () => {
  it("prende na faixa que o banco aceita", () => {
    expect(limiteValido(5)).toBe(5);
    expect(limiteValido(0)).toBe(LIMITE_MINIMO);
    expect(limiteValido(-3)).toBe(LIMITE_MINIMO);
    expect(limiteValido(500)).toBe(LIMITE_MAXIMO);
    expect(limiteValido(6.4)).toBe(6);
  });
});

describe("salvarLimiteDeContas", () => {
  it("escreve max_contas na linha única de app_config", async () => {
    const { cliente, chamadas } = clienteFalso({});
    await salvarLimiteDeContas(cliente, 6);
    expect(chamadas.update).toEqual([{ max_contas: 6 }]);
    expect(chamadas.filtro).toEqual([["id", true]]);
  });

  it("nunca manda um limite fora da faixa (o check do banco recusaria)", async () => {
    const { cliente, chamadas } = clienteFalso({});
    await salvarLimiteDeContas(cliente, 0);
    expect(chamadas.update).toEqual([{ max_contas: LIMITE_MINIMO }]);
  });

  it("a recusa da RLS vira erro para a tela mostrar", async () => {
    const { cliente } = clienteFalso({
      update: { error: { message: "new row violates row-level security policy" } },
    });
    await expect(salvarLimiteDeContas(cliente, 6)).rejects.toThrow(
      /row-level security/,
    );
  });
});

describe("a cota não usa nada de servidor", () => {
  it("o módulo não importa next/headers nem React", async () => {
    // se importasse, a tela Contas (um componente de cliente) não compilaria
    const { readFileSync } = await import("node:fs");
    const fonte = readFileSync(new URL("./contas.ts", import.meta.url), "utf8");
    const importados = [...fonte.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(importados).not.toContain("next/headers");
    expect(importados).not.toContain("react");
    expect(importados).not.toContain("@/lib/supabase/server");
  });
});
