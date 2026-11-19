import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCache } from "@/lib/db";
import { lerEventosDoHistorico, type EventoDoHistorico } from "@/lib/queries/progresso";
import { clienteNavegador } from "@/lib/supabase/client";

const disco = new Map<string, ItemCache>();
const put = vi.fn(async (item: ItemCache) => { disco.set(item.chave, item); });
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  bd: () => ({
    cache: { get: async (chave: string) => disco.get(chave), put },
    transaction: (_modo: string, _tabela: unknown, fazer: () => Promise<unknown>) => fazer(),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));

// Todos na mesma data e sessão. Cada ID é uma decisão de um exercício.
const ana: EventoDoHistorico[] = Array.from({ length: 1230 }, (_, i) => ({
  id: String(i + 1).padStart(5, "0"), user_id: "ana", session_id: "treino-antigo", motivo: "repetiu",
}));
const bia: EventoDoHistorico = { ...ana[0]!, id: "99999", user_id: "bia" };
const pagina = 120;
let linhas = [...ana, bia];
let falharNaSegunda = false;
const servidor = vi.fn<typeof fetch>(async url => {
  const { pathname, searchParams: parametros } = new URL(String(url));
  expect(pathname).toBe("/rest/v1/progression_events");
  expect(parametros.get("select")).toBe("id,user_id,session_id,motivo");
  expect(parametros.get("order")).toBe("id.asc");
  expect(parametros.has("data")).toBe(false);
  expect(parametros.has("offset")).toBe(false);
  const depois = parametros.get("id")?.slice(3);
  if (falharNaSegunda && depois) return Response.json({ message: "página indisponível" }, { status: 400 });
  const daConta = linhas.filter(e => `eq.${e.user_id}` === parametros.get("user_id"));
  const corpo = daConta.filter(e => !depois || e.id > depois).slice(0, pagina);
  return Response.json(corpo, { headers: depois ? {} : { "content-range": `*/${daConta.length}` } });
});

beforeEach(() => {
  disco.clear();
  linhas = [...ana, bia];
  falharNaSegunda = false;
  vi.stubGlobal("navigator", { onLine: true });
  vi.mocked(clienteNavegador).mockReturnValue(createClient("http://localhost", "simulada", {
    global: { fetch: servidor }, auth: { persistSession: false, autoRefreshToken: false },
  }));
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("progressão em todo o histórico da conta", () => {
  it("lê além de mil decisões iguais no mesmo treino, com cursor na última linha de cada página", async () => {
    const eventos = await lerEventosDoHistorico("ana");
    expect(eventos).toEqual(ana);
    const cursores = servidor.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("id"));
    const finsDePagina = ana.filter((_, i) => (i + 1) % pagina === 0 || i === ana.length - 1);
    expect(cursores).toEqual([null, ...finsDePagina.map(e => `gt.${e.id}`)]);
    expect(put).toHaveBeenCalledTimes(1);
    vi.stubGlobal("navigator", { onLine: false });
    expect(await lerEventosDoHistorico("ana")).toEqual(ana);
    await expect(lerEventosDoHistorico("bia")).rejects.toThrow();
  });

  it("conserva a última lista completa quando a leitura seguinte para na segunda página", async () => {
    linhas = [ana[0]!];
    expect(await lerEventosDoHistorico("ana")).toEqual(linhas);
    linhas = [...ana];
    falharNaSegunda = true;
    await expect(lerEventosDoHistorico("ana")).rejects.toThrow("página indisponível");
    expect(put).toHaveBeenCalledTimes(1);
    vi.stubGlobal("navigator", { onLine: false });
    expect(await lerEventosDoHistorico("ana")).toEqual([ana[0]]);
  });

  it("fecha a consulta cancelada entre páginas sem trocar o instantâneo da conta", async () => {
    linhas = [ana[0]!];
    await lerEventosDoHistorico("ana");
    const controller = new AbortController();
    servidor.mockImplementationOnce(async () => Response.json(ana.slice(0, pagina), {
      headers: { "content-range": `*/${ana.length}` },
    })).mockImplementationOnce(async () => {
      controller.abort();
      return Response.json(ana.slice(pagina, 2 * pagina));
    });
    await expect(lerEventosDoHistorico("ana", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(put).toHaveBeenCalledTimes(1);
    vi.stubGlobal("navigator", { onLine: false });
    expect(await lerEventosDoHistorico("ana")).toEqual(linhas);
  });

  it("grava uma lista vazia confirmada e mantém as contas separadas quando o aparelho recusa nova escrita", async () => {
    expect(await lerEventosDoHistorico("bia")).toEqual([bia]);
    linhas = [];
    expect(await lerEventosDoHistorico("ana")).toEqual([]);
    linhas = [...ana];
    put.mockRejectedValueOnce(new Error("quota"));
    expect(await lerEventosDoHistorico("ana")).toEqual(ana);
    vi.stubGlobal("navigator", { onLine: false });
    expect(await lerEventosDoHistorico("ana")).toEqual([]);
    expect(await lerEventosDoHistorico("bia")).toEqual([bia]);
  });
});
