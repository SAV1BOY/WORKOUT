/**
 * O Sair é local (SPEC §9, §21.4 e §22.11): uma sessão cai, as outras ficam.
 *
 * Este é o teste que faltava na rodada 9 — o código estava certo e sem prova,
 * e um `signOut()` sem argumento (o padrão `global` do GoTrue) voltaria a
 * derrubar o celular do dono quando ele saísse no navegador.
 */
import { describe, expect, it, vi } from "vitest";
import { ESCOPO_DO_SAIR, sairDesteAparelho } from "@/lib/sair";

function clienteFalso() {
  const signOut = vi.fn(async () => ({ error: null }));
  return { signOut, cliente: { auth: { signOut } } };
}

describe("sairDesteAparelho", () => {
  it("chama signOut exatamente com { scope: 'local' }", async () => {
    const { signOut, cliente } = clienteFalso();

    await sairDesteAparelho(cliente);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("não deixa passar nenhum outro escopo — nem o padrão do GoTrue", async () => {
    const { signOut, cliente } = clienteFalso();

    await sairDesteAparelho(cliente);

    const argumentos = signOut.mock.calls[0] as unknown[];
    // um argumento só: `signOut()` pelado significaria o escopo global
    expect(argumentos).toHaveLength(1);
    const opcoes = argumentos[0] as Record<string, unknown>;
    // e uma chave só: nada de `{ scope: 'local', ...outraCoisa }`
    expect(Object.keys(opcoes)).toEqual(["scope"]);
    expect(opcoes.scope).toBe("local");
    expect(opcoes.scope).not.toBe("global");
    expect(opcoes.scope).not.toBe("others");
  });

  it("a constante do escopo é 'local'", () => {
    expect(ESCOPO_DO_SAIR).toBe("local");
  });

  it("devolve o que o cliente devolveu", async () => {
    const resposta = { error: null };
    const cliente = { auth: { signOut: vi.fn(async () => resposta) } };

    await expect(sairDesteAparelho(cliente)).resolves.toBe(resposta);
  });
});
