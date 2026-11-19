import { createClient, type Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCache } from "@/lib/db";
import { CHAVE_CACHE, VALIDADE_MS } from "@/lib/persistencia-query";
import { lerPerfilAtual } from "@/lib/queries/dados";
import { guardarPerfilLido, lerPerfilDoAparelho } from "@/lib/queries/perfil-no-aparelho";
import { clienteNavegador } from "@/lib/supabase/client";
import type { LinhaPerfil } from "@/lib/types";

const disco = new Map<string, ItemCache>();
const put = vi.fn(async (item: ItemCache) => { disco.set(item.chave, item); });
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  lerCache: async (chave: string) => disco.get(chave)?.valor ?? null,
  bd: () => ({
    cache: { get: async (chave: string) => disco.get(chave), put },
    transaction: (_modo: string, _tabela: unknown, fazer: () => Promise<unknown>) => fazer(),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));

const ana: LinhaPerfil = {
  user_id: "ana", nome: "Ana", altura_cm: null, data_inicio: "2026-11-19", fase_atual: "fase1",
  fase_desde: "2026-11-19", objetivo: "", semana_corrida: 1, semana_corda: 1, semana_fixa: 1, ultimo_treino: null, prefs: {},
};
const bia = { ...ana, user_id: "bia", nome: "Bia" };
const sinal = () => new AbortController().signal;
function snapshot(perfil: LinhaPerfil | null, atualizadoEm: number) {
  disco.set(CHAVE_CACHE, { chave: CHAVE_CACHE, atualizadoEm: Date.now(), valor: {
    salvoEm: Date.now(), estado: { queries: [{ queryKey: ["perfil"], state: { data: perfil, dataUpdatedAt: atualizadoEm } }] },
  } });
}
function conectar(conta: string | null, responder = async () => Response.json([ana])) {
  const cliente = createClient("http://localhost", "simulada", { global: { fetch: responder } });
  vi.spyOn(cliente.auth, "getSession").mockResolvedValue(conta
    ? { data: { session: { user: { id: conta } } as Session }, error: null }
    : { data: { session: null }, error: null });
  vi.mocked(clienteNavegador).mockReturnValue(cliente);
}
beforeEach(() => { disco.clear(); });
afterEach(() => { vi.clearAllMocks(); });

describe("cópia do perfil confirmado para a primeira abertura sem rede", () => {
  it("só libera o perfil depois de o aparelho confirmar a cópia, mesmo antes da persistência TanStack", async () => {
    conectar("ana");
    let liberar!: () => void;
    const aguardar = new Promise<void>(resolve => { liberar = resolve; });
    let comecou!: () => void;
    const escrevendo = new Promise<void>(resolve => { comecou = resolve; });
    put.mockImplementationOnce(async item => { comecou(); await aguardar; disco.set(item.chave, item); });
    const exibir = vi.fn();
    const leitura = lerPerfilAtual(sinal()).then(exibir);
    await escrevendo;
    expect(exibir).not.toHaveBeenCalled();
    expect(await lerPerfilDoAparelho("ana")).toBeUndefined();
    liberar();
    await leitura;
    expect(exibir).toHaveBeenCalledWith(ana);
    expect(disco.has(CHAVE_CACHE)).toBe(false);
    expect((await lerPerfilDoAparelho("ana"))?.valor).toEqual(ana);
    expect(await lerPerfilDoAparelho("bia")).toBeUndefined();
  });

  it("uma resposta de uma sessão encerrada ou de outra conta não é persistida nem oferecida à UI", async () => {
    for (const conta of [null, "bia"]) {
      conectar(conta);
      await expect(lerPerfilAtual(sinal())).rejects.toThrow("login mudou");
    }
    expect(put).not.toHaveBeenCalled();
  });

  it("preserva a leitura online quando não há espaço, mas não inventa dados offline", async () => {
    conectar("ana");
    put.mockRejectedValueOnce(new Error("quota"));
    await expect(lerPerfilAtual(sinal())).resolves.toEqual(ana);
    expect(await lerPerfilDoAparelho("ana")).toBeUndefined();
    conectar("ana", async () => Response.json([]));
    await expect(lerPerfilAtual(sinal())).resolves.toBeNull();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("não sobrescreve leitura posterior e preserva as preferências recentes do snapshot da mesma conta", async () => {
    const agora = Date.now();
    await guardarPerfilLido(ana, agora);
    await guardarPerfilLido({ ...ana, nome: "Nome antigo" }, agora - 200);
    expect((await lerPerfilDoAparelho("ana"))?.valor).toEqual(ana);
    const editada = { ...ana, prefs: { manter_tela: false } };
    snapshot(editada, agora + 1);
    expect((await lerPerfilDoAparelho("ana"))?.valor).toEqual(editada);
    snapshot({ ...ana, nome: "Anterior" }, agora - 1);
    expect((await lerPerfilDoAparelho("ana"))?.valor).toEqual(ana);
    snapshot(bia, agora - 100);
    expect(await lerPerfilDoAparelho("ana")).toBeUndefined();
  });

  it("desconsidera cópia expirada, linha de outro dono e tentativa cancelada", async () => {
    await guardarPerfilLido(ana, Date.now() - VALIDADE_MS - 1);
    expect(await lerPerfilDoAparelho("ana")).toBeUndefined();
    const controller = new AbortController();
    controller.abort();
    await guardarPerfilLido(ana, Date.now(), controller.signal);
    expect(await lerPerfilDoAparelho("ana")).toBeUndefined();
    disco.set("perfil-lido:ana", { chave: "perfil-lido:ana", valor: bia, atualizadoEm: Date.now() });
    expect(await lerPerfilDoAparelho("ana")).toBeUndefined();
  });
});
