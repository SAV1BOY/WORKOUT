import { QueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCache } from "@/lib/db";
import { CHAVE_CACHE, VALIDADE_MS } from "@/lib/persistencia-query";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { lerExcecoesDoHistorico } from "@/lib/queries/excecoes-do-historico";
import { clienteNavegador } from "@/lib/supabase/client";
import type { LinhaExcecaoAgenda } from "@/lib/types";

const disco = new Map<string, ItemCache>();
const put = vi.fn(async (item: ItemCache) => { disco.set(item.chave, item); });
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  lerCache: async (chave: string) => disco.get(chave)?.valor ?? null,
  bd: () => ({
    cache: { get: async (chave: string) => disco.get(chave), put },
    transaction: (_modo: string, _tabela: unknown, executar: () => Promise<unknown>) => executar(),
  }),
}));
vi.mock("@/lib/queries/conta-do-treino", () => ({ confirmarContaDoTreino: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));

const de = "2026-05-18";
const ate = "2026-05-24";
const descanso: LinhaExcecaoAgenda = { id: "dia", data: de, user_id: "ana", tipo: "descanso", workout_id: null, sessao: null, motivo: null };
const sinal = new AbortController().signal;
const ler = (cliente = new QueryClient(), conta = "ana") => lerExcecoesDoHistorico(cliente, conta, de, ate, sinal);
const rede = vi.fn<typeof fetch>();
beforeEach(() => {
  disco.clear();
  vi.stubGlobal("navigator", { onLine: true });
  vi.mocked(clienteNavegador).mockReturnValue(createClient("http://localhost", "simulada", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: rede },
  }));
  rede.mockImplementation(async () => Response.json([descanso]));
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("faixa de calendário das semanas visitadas", () => {
  it("consulta as datas da conta e mantém a exceção ao recarregar offline", async () => {
    const lista = await ler();
    expect(lista).toEqual([descanso]);
    const url = new URL(String(rede.mock.calls[0]![0]));
    expect(url.searchParams.getAll("data")).toEqual([`gte.${de}`, `lte.${ate}`]);
    expect(url.searchParams.get("user_id")).toBe("eq.ana");
    vi.stubGlobal("navigator", { onLine: false });
    expect(await ler()).toEqual(lista);
    expect(confirmarContaDoTreino).toHaveBeenCalledWith("ana", expect.any(String));
    await expect(ler(new QueryClient(), "bia")).rejects.toThrow("ainda não estão guardadas");
    vi.mocked(confirmarContaDoTreino).mockRejectedValueOnce(new Error("outra conta"));
    await expect(ler()).rejects.toThrow("outra conta");
  });

  it("reaproveita a janela legada mais ampla e delimita a semana e o dono", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const cliente = new QueryClient();
    cliente.setQueryData(["overrides", "2026-01-01", "2026-12-31"], [
      descanso, { ...descanso, data: "2026-06-01" }, { ...descanso, user_id: "bia" },
    ]);
    expect(await ler(cliente)).toEqual([descanso]);
    expect(rede).not.toHaveBeenCalled();
  });

  it("reabre a janela da versão antiga antes da hidratação do cache do Relatório", async () => {
    const atualizadoEm = Date.now();
    const query = { queryKey: ["overrides", de, ate], state: { data: [descanso], dataUpdatedAt: atualizadoEm } };
    disco.set(CHAVE_CACHE, { chave: CHAVE_CACHE, atualizadoEm, valor: {
      salvoEm: atualizadoEm, estado: { queries: [query] },
    } });
    vi.stubGlobal("navigator", { onLine: false });
    expect(await ler()).toEqual([descanso]);
    await expect(ler(new QueryClient(), "bia")).rejects.toThrow("ainda não estão guardadas");
  });

  it("um calendário mais recente em memória prevalece sobre a cópia da semana no disco", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    expect(await ler()).toEqual([descanso]);
    vi.setSystemTime(Date.now() + 1000);
    const cliente = new QueryClient();
    const trocado = { ...descanso, tipo: "cardio" };
    cliente.setQueryData(["overrides", de, ate], [trocado]);
    vi.stubGlobal("navigator", { onLine: false });
    expect(await ler(cliente)).toEqual([trocado]);
  });

  it("distingue uma semana vazia de um cache ausente, vencido ou de outra conta", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    rede.mockImplementationOnce(async () => Response.json([]));
    expect(await ler()).toEqual([]);
    vi.stubGlobal("navigator", { onLine: false });
    expect(await ler()).toEqual([]);
    const outra = new QueryClient();
    outra.setQueryData(["overrides", de, ate, "bia"], []);
    await expect(ler(outra, "caio")).rejects.toThrow("ainda não estão guardadas");
    vi.setSystemTime(Date.now() + VALIDADE_MS + 1);
    await expect(ler()).rejects.toThrow("ainda não estão guardadas");
  });

  it("oferece os dados recém-lidos com quota cheia e volta à cópia visitada apenas em falha de rede", async () => {
    expect(await ler()).toEqual([descanso]);
    put.mockRejectedValueOnce(new Error("quota"));
    rede.mockImplementationOnce(async () => Response.json([]));
    expect(await ler()).toEqual([]);
    rede.mockRejectedValueOnce(new TypeError("sem conexão"));
    expect(await ler()).toEqual([descanso]);
    rede.mockImplementationOnce(async () => Response.json({ message: "permissão" }, { status: 403 }));
    await expect(ler()).rejects.toThrow("permissão");
  });
});
