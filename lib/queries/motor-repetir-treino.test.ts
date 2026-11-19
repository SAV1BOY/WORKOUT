import { createClient } from "@supabase/supabase-js";
import { QueryClient, hydrate, type DehydratedState } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemCache } from "@/lib/db";
import { VALIDADE_MS } from "@/lib/persistencia-query";
import { guardarCargasLidas, lerCargasNoAparelho } from "@/lib/queries/cargas-no-aparelho";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { lerMotorParaRepetir } from "@/lib/queries/motor-repetir-treino";
import { clienteNavegador } from "@/lib/supabase/client";

let disco: { estado: DehydratedState } | null = null;
const fila: EscritaTabela[] = [];
const cargas = new Map<string, ItemCache>();
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  bd: () => ({
    outbox: { where: () => ({ equals: () => ({ toArray: async () => fila.map((payload, id) => ({ id, payload })) }) }) },
    cache: {
      bulkGet: async (chaves: string[]) => chaves.map(k => cargas.get(k)),
      bulkPut: async (linhas: ItemCache[]) => linhas.forEach(r => cargas.set(r.chave, r)),
    },
    transaction: (_modo: string, _cache: unknown, operar: () => Promise<void>) => operar(),
  }),
  guardarCache: async (_chave: string, valor: { estado: DehydratedState }) => { disco = valor; },
}));

const supino = "supino-reto-com-barra";
const flexao = "flexao-de-braco";
const agachamento = "agachamento-livre";
const estado = (user_id: string, exercise_id: string, carga_atual_kg: number) => ({
  user_id, exercise_id, carga_atual_kg, reps_alvo: 6, tempo_alvo_s: null, assistencia: null,
  incremento_kg: 2, falhas_seguidas: 0, incremento_reduzido: false, exigir_rep_extra: false,
  semana_leve: false, carga_antes_leve: null, sessoes_graca: 0, desativado: false, notas: null,
});
const serie = (user_id: string, session_id: string, reps: number, set_index = 1) => ({
  user_id, session_id, reps, set_index, exercise_id: flexao, ordem_ex: 1, concluida: true,
  tipo: "trabalho", registrada_em: "2026-11-15T12:00:00Z",
});
function servidor(fetch: typeof globalThis.fetch) {
  vi.mocked(clienteNavegador).mockReturnValue(createClient("http://localhost", "mock-anon", { global: { fetch } }));
}
beforeEach(() => { disco = null; fila.length = 0; cargas.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers(); });

describe("motor atual da conta para repetir um treino", () => {
  it("revalida mesmo com cache fresco, restringe os quatro GETs e persiste a leitura para repetir offline", async () => {
    const cliente = new QueryClient();
    cliente.setQueryData(["estados", supino], [estado("ana", supino, 20)]);
    const urls: URL[] = [];
    servidor(async (entrada) => {
      const url = new URL(String(entrada));
      urls.push(url);
      const tabela = url.pathname.split("/").pop();
      if (tabela === "exercise_state") return Response.json([estado("bia", supino, 90), estado("ana", supino, 32)]);
      if (tabela === "v_records") return Response.json([{ user_id: "ana", exercise_id: supino, carga_max_kg: 36 }]);
      if (tabela === "session_sets") return Response.json([
        serie("ana", "anterior", 7, 2), serie("ana", "anterior", 9), serie("bia", "outra", 99), serie("ana", "trocada", 22),
      ]);
      return Response.json([{ user_id: "ana", id: "anterior", status: "concluida", plano: null },
        { user_id: "ana", id: "trocada", status: "concluida", plano: { trocas: { 1: [{ exercicio_id: supino }] } } }]);
    });
    const a = await lerMotorParaRepetir(cliente, "ana", [supino, flexao, supino]);
    expect(a.estados?.[supino]?.carga_atual_kg).toBe(32);
    expect(a.conhecidos).toEqual(new Set([supino, flexao]));
    expect(a.anteriores).toEqual({ [flexao]: [9, 7] });
    expect(a.recordes?.[supino]?.carga_max_kg).toBe(36);
    expect(urls.map((u) => u.pathname.split("/").pop()).sort()).toEqual(["exercise_state", "session_sets", "sessions", "v_records"]);
    for (const url of urls) {
      expect(url.searchParams.get("user_id")).toBe("eq.ana");
      if (url.pathname.endsWith("/sessions")) expect(url.searchParams.get("id")).toBe("in.(anterior,trocada)");
      else expect(url.searchParams.get("exercise_id")).toBe(url.pathname.endsWith("/session_sets")
        ? "in.(" + flexao + ")" : "in.(" + supino + "," + flexao + ")");
    }
    expect(disco).not.toBeNull();
    const recarregado = new QueryClient();
    hydrate(recarregado, disco!.estado);
    vi.stubGlobal("navigator", { onLine: false });
    expect(await lerMotorParaRepetir(recarregado, "ana", [flexao, supino])).toEqual(a);
    expect(await lerMotorParaRepetir(recarregado, "bia", [flexao, supino])).toEqual({
      conhecidos: new Set(), anteriores: {}, estados: {}, recordes: {},
    });
    expect(urls).toHaveLength(4);
  });

  it("offline só aceita linhas legadas com dono e não deduz carga dos pesos históricos", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const cliente = new QueryClient();
    cliente.setQueryData(["estados-todos"], [estado("ana", supino, 24), estado("bia", flexao, 88)]);
    cliente.setQueryData(["estados", agachamento], []);
    cliente.setQueryData(["progresso", "recordes"], [
      { user_id: "ana", exercise_id: supino, carga_max_kg: 20 },
      { user_id: "bia", exercise_id: flexao, carga_max_kg: 90 },
    ]);
    cliente.setQueryData(["series-anteriores", flexao], [serie("bia", "sem-dono", 70)]);
    const a = await lerMotorParaRepetir(cliente, "ana", [supino, flexao, agachamento]);
    expect(a.conhecidos).toEqual(new Set([supino]));
    expect(Object.keys(a.estados!)).toEqual([supino]);
    expect(Object.keys(a.recordes!)).toEqual([supino]);
    expect(a.anteriores).toEqual({});
    expect(clienteNavegador).not.toHaveBeenCalled();
  });

  it("após fechar a ficha imediatamente, o treino sem rede recupera a carga por dono e movimento", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const agora = Date.now();
    await guardarCargasLidas([estado("ana", agachamento, 31.5), estado("bia", agachamento, 48)], agora);
    expect(disco).toBeNull(); // a persistência periódica não rodou
    const leitura = await lerMotorParaRepetir(new QueryClient(), "ana", [agachamento, supino]);
    expect(leitura.estados?.[agachamento]?.carga_atual_kg).toBe(31.5);
    expect(leitura.conhecidos).toEqual(new Set([agachamento]));
    expect((await lerMotorParaRepetir(new QueryClient(), "bia", [agachamento])).estados?.[agachamento]?.carga_atual_kg).toBe(48);
    expect((await lerMotorParaRepetir(new QueryClient(), "outra", [agachamento])).conhecidos).toEqual(new Set());
  });

  it("uma resposta tardia, uma lista vazia sem dono e uma carga vencida não apagam nem inventam progresso", async () => {
    const agora = Date.now();
    await guardarCargasLidas([estado("ana", agachamento, 31.5)], agora);
    await guardarCargasLidas([estado("ana", agachamento, 10)], agora - 2000);
    await guardarCargasLidas([], agora);
    await guardarCargasLidas([estado("ana", supino, 12)], agora - VALIDADE_MS - 1000);
    expect((await lerCargasNoAparelho("ana", [agachamento, supino])).get(agachamento)?.linha?.carga_atual_kg).toBe(31.5);
    expect((await lerCargasNoAparelho("ana", [supino])).size).toBe(0);
    servidor(async () => Response.json([]));
    await lerMotorParaRepetir(new QueryClient(), "ana", [agachamento], async () => {});
    const confirmada = await lerCargasNoAparelho("ana", [agachamento]);
    expect(confirmada.get(agachamento)?.linha).toBeNull(); // consulta remota com identidade confirmada
    vi.stubGlobal("navigator", { onLine: false });
    const motor = await lerMotorParaRepetir(new QueryClient(), "ana", [agachamento]);
    expect(motor.estados).toEqual({});
    expect(motor.conhecidos).toEqual(new Set([agachamento]));
  });

  it("mantém uma carga do cache geral mais recente e protege os dados em troca de conta durante a leitura", async () => {
    const agora = Date.now();
    await guardarCargasLidas([estado("ana", supino, 20)], agora - 3000);
    const cliente = new QueryClient();
    cliente.setQueryData(["estados", supino], [estado("ana", supino, 30)], { updatedAt: agora });
    vi.stubGlobal("navigator", { onLine: false });
    expect((await lerMotorParaRepetir(cliente, "ana", [supino])).estados?.[supino]?.carga_atual_kg).toBe(30);
    vi.stubGlobal("navigator", { onLine: true });
    servidor(async () => Response.json([]));
    await expect(lerMotorParaRepetir(cliente, "ana", [supino], async () => { throw new Error("Mudou."); })).rejects.toThrow("Mudou.");
    expect((await lerCargasNoAparelho("ana", [supino])).get(supino)?.linha?.carga_atual_kg).toBe(20);
  });

  it("reconhece as séries de máximo do histórico pela sessão da conta, exceto quando falta a posição de uma troca", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const cliente = new QueryClient();
    cliente.setQueryData(["progresso", "sessoes"], [
      { id: "anterior", user_id: "ana", status: "concluida", plano: null },
      { id: "outra", user_id: "bia", status: "concluida", plano: null },
      { id: "trocada", user_id: "ana", status: "concluida", plano: { trocas: { 1: [{ exercicio_id: supino }] } } },
      { id: "legada", status: "concluida", plano: null },
    ]);
    cliente.setQueryData(["progresso", "series-todas"], ["anterior", "outra", "trocada", "legada"].map((id, i) => ({
      ...serie("ana", id, 6 + i), user_id: undefined, ordem_ex: undefined, registrada_em: "2026-11-1" + (1 + i),
    })));
    expect((await lerMotorParaRepetir(cliente, "ana", [flexao])).anteriores).toEqual({ [flexao]: [6] });
    expect((await lerMotorParaRepetir(cliente, "bia", [flexao])).anteriores).toEqual({ [flexao]: [7] });
  });

  it("ignora nota isolada, reaplica fila recente inclusive lote e alteração parcial só da conta e dos IDs pedidos", async () => {
    const cliente = new QueryClient();
    servidor(async (entrada) => Response.json(String(entrada).includes("/exercise_state?")
      ? [estado("ana", supino, 16)] : []));
    fila.push({ tabela: "exercise_state", op: "upsert", linhas: [estado("ana", supino, 30), estado("bia", supino, 80)] },
      { tabela: "exercise_state", op: "update", filtro: { user_id: "ana", exercise_id: supino }, linha: { incremento_kg: 4 } },
      { tabela: "exercise_state", op: "upsert", linha: estado("ana", agachamento, 100) },
      { tabela: "exercise_state", op: "upsert", linha: { user_id: "ana", exercise_id: flexao, nota_pessoal: "cotovelos" } });
    const a = await lerMotorParaRepetir(cliente, "ana", [supino]);
    expect(a.estados?.[supino]).toMatchObject({ carga_atual_kg: 30, incremento_kg: 4 });
    vi.stubGlobal("navigator", { onLine: false });
    const b = await lerMotorParaRepetir(new QueryClient(), "ana", [supino, flexao]);
    expect(b.conhecidos).toEqual(new Set([supino]));
    expect(b.estados?.[supino]?.carga_atual_kg).toBe(30);
    expect(fila).toHaveLength(4);
  });

  it("uma troca de conta enquanto o GET responde vazio conserva todas as cópias anteriores", async () => {
    const cliente = new QueryClient();
    const carga = estado("ana", supino, 33);
    cliente.setQueryData(["motor-repetir", "ana", "estados", supino], carga);
    cliente.setQueryData(["motor-repetir", "ana", "anteriores", flexao], [7, 6]);
    cliente.setQueryData(["motor-repetir", "ana", "recordes", supino], { user_id: "ana", exercise_id: supino, carga_max_kg: 40 });
    servidor(async () => Response.json([]));
    const contaMudou = vi.fn(async () => { throw new Error("A conta mudou."); });
    await expect(lerMotorParaRepetir(cliente, "ana", [supino, flexao], contaMudou)).rejects.toThrow("A conta mudou.");
    expect(contaMudou).toHaveBeenCalledOnce();
    expect(disco).toBeNull();
    vi.stubGlobal("navigator", { onLine: false });
    const leitura = await lerMotorParaRepetir(cliente, "ana", [supino, flexao]);
    expect(leitura.estados?.[supino]?.carga_atual_kg).toBe(33);
    expect(leitura.anteriores).toEqual({ [flexao]: [7, 6] });
    expect(leitura.recordes?.[supino]?.carga_max_kg).toBe(40);
    expect(leitura.conhecidos).toEqual(new Set([supino]));
  });

  it("usa o cache no prazo do clique em Wi-Fi sem saída e conserva a fonte que já respondeu", async () => {
    const cliente = new QueryClient();
    cliente.setQueryData(["estados", supino], [estado("ana", supino, 24)]);
    vi.stubGlobal("navigator", { onLine: true });
    vi.useFakeTimers();
    let sinal: AbortSignal | null | undefined;
    servidor(async (url, init) => {
      if (String(url).includes("/v_records?")) return Response.json([{ user_id: "ana", exercise_id: supino, carga_max_kg: 36 }]);
      sinal = init?.signal;
      return new Promise<Response>(() => {});
    });
    const leitura = lerMotorParaRepetir(cliente, "ana", [supino]);
    await vi.advanceTimersByTimeAsync(1600);
    expect(sinal?.aborted).toBe(true);
    expect((await leitura).estados?.[supino]?.carga_atual_kg).toBe(24);
    expect((await leitura).recordes?.[supino]?.carga_max_kg).toBe(36);
  });
});
