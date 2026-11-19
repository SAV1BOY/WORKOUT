import { dehydrate, QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { guardarCache, lerCache } from "@/lib/db";
import { guardarConsultasAgora, lerUltimaSincronizacao, persistirQueryClient } from "@/lib/persistencia-query";

vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  guardarCache: vi.fn().mockResolvedValue(undefined),
  lerCache: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("gravar dados locais depois de perder a rede conserva a hora da última leitura", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
  vi.stubGlobal("navigator", { onLine: true });
  const cliente = new QueryClient();
  vi.mocked(lerCache).mockResolvedValue(null);
  const parar = persistirQueryClient(cliente);
  try {
    const lidaEm = Date.now();
    await cliente.fetchQuery({ queryKey: ["exercicio"], queryFn: async () => 4 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(guardarCache).toHaveBeenLastCalledWith("react-query-v1", expect.objectContaining({ sincronizadoEm: lidaEm }));

    vi.stubGlobal("navigator", { onLine: false });
    cliente.setQueryData(["exercicio"], 6);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(guardarCache).toHaveBeenLastCalledWith("react-query-v1", expect.objectContaining({
      sincronizadoEm: lidaEm, salvoEm: Date.now(),
    }));
  } finally {
    parar();
    cliente.clear();
  }
});

it("a cópia legada tem horário e uma cópia nova sem leitura da rede ainda não tem", async () => {
  const salvoEm = Date.now();
  const estado = dehydrate(new QueryClient());
  vi.mocked(lerCache).mockResolvedValue({ salvoEm, estado });
  await expect(lerUltimaSincronizacao()).resolves.toBe(salvoEm);

  vi.mocked(lerCache).mockResolvedValue({ salvoEm, sincronizadoEm: null, estado });
  await expect(lerUltimaSincronizacao()).resolves.toBeNull();
});

it("o detalhe de uma sessão permanece só no seu próprio cache e a ficha antiga continua hidratando", async () => {
  const detalhe = ["progresso", "series-da-sessao", "conta-a", "sessao-a"];
  const ficha = ["progresso", "series-ex", "supino"];
  const anteriores = ["progresso", "series-todas"];
  const agrupadas = new QueryClient();
  agrupadas.setQueryData(detalhe, { completa: true, linhas: [{ reps: 8 }] });
  agrupadas.setQueryData(ficha, [{ session_id: "sessao-a", reps: 6 }]);
  agrupadas.setQueryData(anteriores, []);
  await guardarConsultasAgora(agrupadas);
  expect(guardarCache).toHaveBeenLastCalledWith("react-query-v1", expect.objectContaining({
    estado: expect.objectContaining({ queries: [
      expect.objectContaining({ queryKey: ficha }), expect.objectContaining({ queryKey: anteriores }),
    ] }),
  }));

  vi.mocked(lerCache).mockResolvedValue({ salvoEm: Date.now(), estado: dehydrate(agrupadas) });
  const reaberto = new QueryClient();
  const parar = persistirQueryClient(reaberto);
  try {
    await vi.waitFor(() => expect(reaberto.getQueryData(ficha)).toEqual(agrupadas.getQueryData(ficha)));
    expect(reaberto.getQueryData(anteriores)).toEqual([]);
    expect(reaberto.getQueryData(detalhe)).toBeUndefined();
  } finally {
    parar();
    reaberto.clear();
    agrupadas.clear();
  }
});
