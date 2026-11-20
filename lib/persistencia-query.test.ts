import { dehydrate, QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { guardarCache, lerCache } from "@/lib/db";
import { encerrarConsultasParaSair, guardarConsultasAgora, lerConsultaGuardada, lerUltimaSincronizacao, persistirQueryClient } from "@/lib/persistencia-query";

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
  const modelos = ["modelos-de-treino", "conta-a"];
  const agrupadas = new QueryClient();
  agrupadas.setQueryData(modelos, [{ id: "modelo-antigo" }]);
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
    expect(reaberto.getQueryData(modelos)).toBeUndefined();
  } finally {
    parar();
    reaberto.clear();
    agrupadas.clear();
  }
});


it("encerra timer, hidratação e escritas diretas e espera todos os puts iniciados antes da limpeza do aparelho", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("navigator", { onLine: true });
  const a = new QueryClient();
  const leituraAntiga = Promise.withResolvers<unknown>();
  vi.mocked(lerCache).mockReturnValueOnce(leituraAntiga.promise);
  const parar = persistirQueryClient(a, "ana");
  a.setQueryData(["perfil"], { user_id: "ana" });
  const tentativa1 = Promise.withResolvers<void>(), tentativa2 = Promise.withResolvers<void>();
  vi.mocked(guardarCache).mockReturnValueOnce(tentativa1.promise).mockReturnValueOnce(tentativa2.promise);
  const direta = guardarConsultasAgora(a);
  await vi.advanceTimersByTimeAsync(1_000); // a escrita automática também já começou.
  a.setQueryData(["outra"], "agendada");
  let podeLimpar = false;
  const conclusao = encerrarConsultasParaSair(a).then(() => { podeLimpar = true; });
  const antiga = dehydrate(a);
  leituraAntiga.resolve({ conta: "ana", salvoEm: Date.now(), estado: antiga });
  await vi.advanceTimersByTimeAsync(2_000);
  expect(a.getQueryData(["perfil"])).toBeUndefined();
  await guardarConsultasAgora(a);
  expect(guardarCache).toHaveBeenCalledTimes(2);
  expect(podeLimpar).toBe(false);
  tentativa2.resolve();
  await Promise.resolve();
  expect(podeLimpar).toBe(false);
  tentativa1.resolve();
  await Promise.all([direta, conclusao]);
  expect(podeLimpar).toBe(true);
  parar();

  // O novo login usa outro cliente inclusive ao navegar no mesmo documento.
  const b = new QueryClient();
  vi.mocked(lerCache).mockResolvedValue(null);
  const pararB = persistirQueryClient(b, "bia");
  b.setQueryData(["perfil"], { user_id: "bia" });
  await guardarConsultasAgora(a);
  await guardarConsultasAgora(b);
  expect(guardarCache).toHaveBeenCalledTimes(3);
  expect(guardarCache).toHaveBeenLastCalledWith("react-query-v1", expect.objectContaining({ conta: "bia" }));
  pararB();
});

it.each([
  { caso: "legado do próprio perfil", marca: undefined, perfil: "bia", aceita: true },
  { caso: "legado com perfil de outra conta", marca: undefined, perfil: "ana", aceita: false },
  { caso: "legado sem prova da conta", marca: undefined, perfil: undefined, aceita: false },
  { caso: "marcado pela própria conta antes de ler o perfil", marca: "bia", perfil: undefined, aceita: true },
  { caso: "marcador de outra conta", marca: "ana", perfil: undefined, aceita: false },
  { caso: "perfil diferente do marcador", marca: "bia", perfil: "ana", aceita: false },
])("a hidratação da conta confere o dono do snapshot $caso", async ({ marca, perfil, aceita }) => {
  const origem = new QueryClient(), destino = new QueryClient();
  if (perfil) origem.setQueryData(["perfil"], { user_id: perfil });
  origem.setQueryData(["series"], [{ user_id: "bia", reps: 7 }]);
  vi.mocked(lerCache).mockResolvedValue({ conta: marca, salvoEm: Date.now(), estado: dehydrate(origem) });
  const parar = persistirQueryClient(destino, "bia");
  await Promise.resolve();
  expect(destino.getQueryData(["series"])).toEqual(aceita ? [{ user_id: "bia", reps: 7 }] : undefined);
  // Os leitores legados inspecionam os donos linha a linha quando não havia perfil ou marcador.
  const podeLerLinhas = aceita || (!marca && !perfil);
  expect(await lerConsultaGuardada(["series"], "bia")).toEqual(podeLerLinhas ? [{ user_id: "bia", reps: 7 }] : undefined);
  parar();
  origem.clear();
  destino.clear();
});
