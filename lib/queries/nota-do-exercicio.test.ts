import { createClient } from "@supabase/supabase-js";
import { hydrate, type DehydratedState, QueryClient } from "@tanstack/react-query";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { guardarCache, type ItemSaida } from "@/lib/db";
import { enfileirar } from "@/lib/outbox";
import { alvoDaEscrita, type EscritaTabela } from "@/lib/outbox-supabase";
import { chaveDaNota, gravarNotaDoExercicio, lerNotaDoExercicio } from "@/lib/queries/nota-do-exercicio";
import { clienteNavegador } from "@/lib/supabase/client";

const pendentes: ItemSaida[] = [];
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
vi.mock("@/lib/outbox", () => ({ enfileirar: vi.fn() }));
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  guardarCache: vi.fn(async () => {}),
  bd: () => ({ outbox: { where: (indice: string) => ({ equals: (tipo: string) => ({ reverse: () => ({
    toArray: () => Promise.resolve(pendentes.filter((i) => i[indice as keyof ItemSaida] === tipo).reverse()),
  }) }) }) } }),
}));
const sinal = () => new AbortController().signal;
const item = (payload: EscritaTabela): ItemSaida => ({ tipo: "estado_exercicio", payload, tentativas: 0, proximaTentativa: 0, criadoEm: 0 });

beforeEach(() => {
  pendentes.length = 0;
  vi.mocked(enfileirar).mockImplementation(async (_tipo, payload) => { pendentes.push(item(payload as EscritaTabela)); });
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("notas pessoais por conta e exercício", () => {
  it("escreve apenas a coluna de nota, preserva ajustes já carregados e isola contas", async () => {
    const cliente = new QueryClient();
    const a = { user_id: "ana", exercise_id: "supino", nota_pessoal: null, carga_atual_kg: 8 };
    const b = { ...a, user_id: "bia", nota_pessoal: "outra pessoa" };
    cliente.setQueryData(["estados", "agachamento,supino"], [a, b]);
    await gravarNotaDoExercicio(cliente, "ana", "supino", "  banco 3  ");
    expect(enfileirar).toHaveBeenCalledWith("estado_exercicio", {
      tabela: "exercise_state", op: "upsert", onConflict: "user_id,exercise_id",
      linha: { user_id: "ana", exercise_id: "supino", nota_pessoal: "banco 3" },
    }, "exercise_state:ana:supino");
    expect(cliente.getQueryData(["estados", "agachamento,supino"])).toEqual([{ ...a, nota_pessoal: "banco 3" }, b]);
    expect(cliente.getQueryData(chaveDaNota("bia", "supino"))).toBeUndefined();
  });
  it("ao reabrir sem rede, recupera a última edição e a remoção da fila durável", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const primeiro = new QueryClient();
    await gravarNotaDoExercicio(primeiro, "ana", "supino", "banco 3");
    await gravarNotaDoExercicio(primeiro, "bia", "supino", "banco 1");
    await gravarNotaDoExercicio(primeiro, "ana", "remada", "banco 5");
    const reaberto = new QueryClient();
    expect(await lerNotaDoExercicio(reaberto, "ana", "supino", sinal())).toBe("banco 3");
    await gravarNotaDoExercicio(primeiro, "ana", "supino", "");
    expect(await lerNotaDoExercicio(reaberto, "ana", "supino", sinal())).toBeNull();
    expect(await lerNotaDoExercicio(reaberto, "bia", "supino", sinal())).toBe("banco 1");
    expect(clienteNavegador).not.toHaveBeenCalled();
  });
  it("um reload imediato sem rede lê a última edição já entregue ao servidor, inclusive a remoção", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const anterior = new QueryClient();
    for (const texto of ["nova regulagem", ""]) {
      await gravarNotaDoExercicio(anterior, "ana", "supino", texto);
      // A entrega já drenou a fila e a página fechou sem esperar o debounce.
      pendentes.length = 0;
      const disco = vi.mocked(guardarCache).mock.calls.at(-1)?.[1] as { estado: DehydratedState };
      const reaberto = new QueryClient();
      hydrate(reaberto, disco.estado);
      expect(await lerNotaDoExercicio(reaberto, "ana", "supino", sinal())).toBe(texto || null);
    }
    expect(clienteNavegador).not.toHaveBeenCalled();
  });
  it("lê do servidor somente a coluna da nota e restringe a consulta à conta e ao exercício", async () => {
    const fetch = vi.fn(async (entrada: RequestInfo | URL) => {
      const url = new URL(String(entrada));
      expect(url.pathname).toBe("/rest/v1/exercise_state");
      expect(Object.fromEntries(url.searchParams)).toEqual({ select: "nota_pessoal", user_id: "eq.ana", exercise_id: "eq.supino" });
      return Response.json([{ nota_pessoal: "banco 3" }]);
    });
    vi.mocked(clienteNavegador).mockReturnValue(createClient("http://localhost", "mock-anon", { global: { fetch } }));
    expect(await lerNotaDoExercicio(new QueryClient(), "ana", "supino", sinal())).toBe("banco 3");
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("uma recusa do aparelho conserva a nota confirmada", async () => {
    const cliente = new QueryClient();
    cliente.setQueryData(chaveDaNota("ana", "supino"), "banco 3");
    vi.mocked(enfileirar).mockRejectedValueOnce(new Error("IndexedDB"));
    await expect(gravarNotaDoExercicio(cliente, "ana", "supino", "outro")).rejects.toThrow();
    expect(cliente.getQueryData(chaveDaNota("ana", "supino"))).toBe("banco 3");
  });
  it("usa o mesmo alvo ordenado para salvar e remover, mesmo depois de um erro temporário", () => {
    const base: EscritaTabela = { tabela: "exercise_state", op: "upsert", onConflict: "user_id,exercise_id" };
    const alvo = (usuario: string, nota: string | null) => alvoDaEscrita({ ...base,
      linha: { user_id: usuario, exercise_id: "supino", nota_pessoal: nota } });
    expect(alvo("ana", "banco 3")).toBe(alvo("ana", null));
    expect(alvo("bia", null)).not.toBe(alvo("ana", null));
  });
});
