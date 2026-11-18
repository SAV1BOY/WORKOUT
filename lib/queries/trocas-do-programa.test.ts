import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarBackup } from "@/lib/backup";
import { guardarNaFila, processar } from "@/lib/outbox";
import { alvoDaEscrita, enviarItem, type EscritaTabela } from "@/lib/outbox-supabase";
import { chaveDasTrocas, lerTrocasDoPrograma, salvarTrocaDoPrograma } from "@/lib/queries/trocas-do-programa";
import { importarBackup } from "@/lib/queries/mais";
import { clienteNavegador } from "@/lib/supabase/client";

const disco = new Map<string, unknown>();
const fila: { payload: EscritaTabela }[] = [];
const guardarCopia = vi.fn(async ({ chave, valor }: { chave: string; valor: unknown }) => disco.set(chave, valor));
const agachamento = "agachamento-livre";
const frontal = "agachamento-frontal";
const supino = "supino-reto-com-barra";
const flexao = "flexao-de-braco";
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
vi.mock("@/lib/outbox", () => ({ guardarNaFila: vi.fn(), processar: vi.fn(), esperarFila: vi.fn(async () => 0) }));
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  lerCache: async (chave: string) => disco.get(chave) ?? null,
  bd: () => ({
    transaction: async (_modo: string, ...args: unknown[]) => {
      const itensAntes = fila.length;
      try {
        return await (args.at(-1) as () => Promise<unknown>)();
      } catch (erro) {
        fila.length = itensAntes;
        throw erro;
      }
    },
    cache: { put: guardarCopia },
    outbox: { where: () => ({ equals: () => ({ toArray: async () => [...fila] }) }) },
  }),
}));

function usarServidor(fetch: typeof globalThis.fetch) {
  vi.mocked(clienteNavegador).mockReturnValue(createClient("http://localhost", "mock-anon", { global: { fetch } }));
}
beforeEach(() => {
  disco.clear();
  fila.length = 0;
  vi.mocked(guardarNaFila).mockImplementation(async (_tipo, payload) => { fila.push({ payload: payload as EscritaTabela }); });
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("alternativas lembradas por conta, treino e exercício original", () => {
  it("abre offline no primeiro uso e conserva cada posição depois de recarregar e esvaziar a fila", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const cliente = new QueryClient();
    expect(await lerTrocasDoPrograma(cliente, "ana", "A1")).toEqual({});
    await salvarTrocaDoPrograma(cliente, "ana", "A1", agachamento, frontal);
    await salvarTrocaDoPrograma(cliente, "ana", "A1", supino, flexao);
    fila.length = 0;
    expect(await lerTrocasDoPrograma(new QueryClient(), "ana", "A1")).toEqual({ [agachamento]: frontal, [supino]: flexao });
    expect(await lerTrocasDoPrograma(new QueryClient(), "bia", "A1")).toEqual({});
    expect(await lerTrocasDoPrograma(new QueryClient(), "ana", "B1")).toEqual({});
    expect(clienteNavegador).not.toHaveBeenCalled();
  });

  it("restaura só um exercício e usa a mesma chave de envio quando o salvar precisa de nova tentativa", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const cliente = new QueryClient();
    await salvarTrocaDoPrograma(cliente, "ana", "A1", supino, flexao);
    await salvarTrocaDoPrograma(cliente, "bia", "A1", supino, flexao);
    await salvarTrocaDoPrograma(cliente, "ana", "A1", agachamento, frontal);
    await salvarTrocaDoPrograma(cliente, "ana", "A1", supino, null);
    await salvarTrocaDoPrograma(cliente, "ana", "A1", supino, null);
    // Simula o app fechado depois de enfileirar e antes de atualizar as cópias de consulta.
    disco.clear();
    expect(await lerTrocasDoPrograma(new QueryClient(), "ana", "A1")).toEqual({ [agachamento]: frontal });
    expect(await lerTrocasDoPrograma(new QueryClient(), "bia", "A1")).toEqual({ [supino]: flexao });
    const alvos = fila.map(({ payload }) => alvoDaEscrita(payload));
    expect(alvos[0]).toBe("trocas_do_programa:ana:A1:" + supino);
    expect(alvos.slice(3)).toEqual([alvos[0], alvos[0]]);
    expect(new Set(alvos.slice(0, 3)).size).toBe(3);
    expect(fila[3]?.payload).toEqual({ tabela: "trocas_do_programa", op: "delete",
      filtro: { user_id: "ana", workout_id: "A1", exercicio_original_id: supino } });
  });

  it("consulta só a conta e o treino pedidos e sobrepõe os slots à espera da rede", async () => {
    const cliente = new QueryClient();
    await salvarTrocaDoPrograma(cliente, "ana", "A1", agachamento, frontal);
    await salvarTrocaDoPrograma(cliente, "ana", "A1", supino, null);
    usarServidor(async (entrada) => {
      const url = new URL(String(entrada));
      expect(url.pathname).toBe("/rest/v1/trocas_do_programa");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        select: "exercicio_original_id,substituto_id", user_id: "eq.ana", workout_id: "eq.A1",
      });
      return Response.json([{ exercicio_original_id: supino, substituto_id: flexao }]);
    });
    expect(await lerTrocasDoPrograma(cliente, "ana", "A1")).toEqual({ [agachamento]: frontal });
    expect(fila[0]?.payload).toEqual({ tabela: "trocas_do_programa", op: "upsert",
      onConflict: "user_id,workout_id,exercicio_original_id", linha: {
        user_id: "ana", workout_id: "A1", exercicio_original_id: agachamento, substituto_id: frontal,
      } });
  });

  it("uma perda de rede durante a leitura aproveita o mapa confirmado mesmo após um reload", async () => {
    usarServidor(async () => Response.json([{ exercicio_original_id: supino, substituto_id: flexao }]));
    await lerTrocasDoPrograma(new QueryClient(), "ana", "A1");
    usarServidor(async () => { throw new TypeError("Failed to fetch"); });
    expect(await lerTrocasDoPrograma(new QueryClient(), "ana", "A1")).toEqual({ [supino]: flexao });
    usarServidor(async () => Response.json({ message: "acesso recusado", code: "42501" }, { status: 403 }));
    await expect(lerTrocasDoPrograma(new QueryClient(), "ana", "A1")).rejects.toThrow("acesso recusado");
  });

  it("uma resposta antiga não apaga a alteração de outra aba confirmada durante o GET", async () => {
    let responder!: (resposta: Response) => void;
    const iniciou = new Promise<void>((resolve) => {
      usarServidor(async () => new Promise<Response>((retorno) => { responder = retorno; resolve(); }));
    });
    const leitura = lerTrocasDoPrograma(new QueryClient(), "ana", "A1");
    await iniciou;
    await salvarTrocaDoPrograma(new QueryClient(), "ana", "A1", supino, flexao);
    fila.length = 0;
    responder(Response.json([{ exercicio_original_id: agachamento, substituto_id: frontal }]));
    expect(await leitura).toEqual({ [supino]: flexao, [agachamento]: frontal });
  });

  it("uma recusa do aparelho ou uma alternativa inválida não ganha confirmação local", async () => {
    const cliente = new QueryClient();
    await salvarTrocaDoPrograma(cliente, "ana", "A1", supino, flexao);
    vi.mocked(guardarNaFila).mockRejectedValueOnce(new Error("IndexedDB indisponível"));
    await expect(salvarTrocaDoPrograma(cliente, "ana", "A1", supino, null)).rejects.toThrow("IndexedDB");
    await expect(salvarTrocaDoPrograma(cliente, "ana", "A1", supino, "inexistente")).rejects.toThrow();
    expect(cliente.getQueryData(chaveDasTrocas("ana", "A1"))).toEqual({ [supino]: flexao });
    expect(fila).toHaveLength(1);
  });

  it("uma falha no cache aborta a gravação da fila antes de tentar a rede", async () => {
    const cliente = new QueryClient();
    guardarCopia.mockRejectedValueOnce(new Error("Disco cheio"));
    await expect(salvarTrocaDoPrograma(cliente, "ana", "A1", supino, flexao)).rejects.toThrow("Disco cheio");
    expect(fila).toHaveLength(0);
    expect(cliente.getQueryData(chaveDasTrocas("ana", "A1"))).toBeUndefined();
    expect(processar).not.toHaveBeenCalled();
  });

  it("importa o mesmo backup offline na conta de destino e preserva a ordem com uma restauração no app", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const cliente = new QueryClient();
    const backup = montarBackup({ userId: "ana", exportadoEm: "2026-11-18", tabelas: { trocas_do_programa: [
      { user_id: "ana", workout_id: "A1", exercicio_original_id: supino, substituto_id: flexao },
    ] } });
    for (let vezes = 0; vezes < 2; vezes++) {
      expect(await importarBackup({ backup, userId: "bia", cliente })).toBe(1);
      expect(await lerTrocasDoPrograma(new QueryClient(), "bia", "A1")).toEqual({ [supino]: flexao });
    }
    await salvarTrocaDoPrograma(cliente, "bia", "A1", supino, null);
    expect(await lerTrocasDoPrograma(new QueryClient(), "bia", "A1")).toEqual({});
    expect(await lerTrocasDoPrograma(new QueryClient(), "ana", "A1")).toEqual({});
    expect(new Set(fila.map(({ payload }) => alvoDaEscrita(payload)))).toEqual(new Set(["trocas_do_programa:bia:A1:" + supino]));
  });

  it("conserva a remoção pendente enquanto o navegador está autenticado em outra conta", async () => {
    const cliente = new QueryClient();
    const fetch = vi.fn();
    usarServidor(fetch);
    const supabase = clienteNavegador();
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: { user: { id: "bia" } } as NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]> },
      error: null,
    });
    await salvarTrocaDoPrograma(cliente, "ana", "A1", supino, null);
    await expect(enviarItem({ tipo: "troca_do_programa", payload: fila[0]?.payload, tentativas: 0,
      proximaTentativa: 0, criadoEm: 0 })).rejects.toThrow("Aguardando a conta");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("tempo da consulta opcional ao abrir um treino", () => {
  function redeSemSaida() {
    vi.stubGlobal("navigator", { onLine: true });
    let iniciou!: () => void;
    const pedido = new Promise<void>((resolve) => { iniciou = resolve; });
    usarServidor((_entrada, init) => new Promise<Response>((_resolve, reject) => {
      const sinal = init!.signal!;
      sinal.addEventListener("abort", () => reject(sinal.reason), { once: true });
      iniciou();
    }));
    return pedido;
  }

  it("solta o GET pendurado em 1,5 s e usa a cópia e a fila mesmo com o navegador online", async () => {
    vi.useFakeTimers();
    try {
      disco.set(JSON.stringify(chaveDasTrocas("ana", "A1")), { [agachamento]: frontal });
      fila.push({ payload: { tabela: "trocas_do_programa", op: "upsert", linha: {
        user_id: "ana", workout_id: "A1", exercicio_original_id: supino, substituto_id: flexao,
      } } });
      const iniciou = redeSemSaida();
      const leitura = lerTrocasDoPrograma(new QueryClient(), "ana", "A1");
      await iniciou;
      await vi.advanceTimersByTimeAsync(1500);
      await expect(leitura).resolves.toEqual({ [agachamento]: frontal, [supino]: flexao });
    } finally { vi.useRealTimers(); }
  });

  it("propaga o cancelamento do TanStack sem converter a leitura em uma resposta local", async () => {
    const iniciou = redeSemSaida();
    const controle = new AbortController();
    const leitura = lerTrocasDoPrograma(new QueryClient(), "ana", "A1", controle.signal);
    await iniciou;
    controle.abort(new Error("consulta cancelada"));
    await expect(leitura).rejects.toThrow("consulta cancelada");
  });
});
