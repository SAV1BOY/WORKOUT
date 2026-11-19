import { createClient, type Session } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { equipamentoDisponivel } from "@/lib/dados";
import { equipamentoDaSessao, guardarEquipamentoDoDia, lerEquipamentoDoDia } from "@/lib/equipamento-da-sessao";
import { guardarNaFila, processar } from "@/lib/outbox";
import { enviarItem, type EscritaTabela } from "@/lib/outbox-supabase";
import { criarSessaoComEquipamentoDoDia } from "@/lib/queries/comecar";
import { descarregarSessao, guardarMaterialDaSessao, salvarSessaoLocal } from "@/lib/queries/sessao";
import { definirEquipamentoDaSessao, marcarSerie, type SessaoLocal } from "@/lib/sessao";
import { clienteNavegador } from "@/lib/supabase/client";

const locais = new Map<string, SessaoLocal>();
const rascunhos = new Map<string, string>();
vi.mock("@/lib/db", () => ({ temIndexedDB: () => true, bd: () => ({
  outbox: {},
  sessaoAtiva: {
    put: async ({ id, dados }: { id: string; dados: SessaoLocal }) => locais.set(id, dados),
    get: async (id: string) => locais.has(id) ? { dados: locais.get(id) } : undefined,
  },
  transaction: async (_modo: string, _sessoes: unknown, _fila: unknown, fazer: () => Promise<SessaoLocal>) => {
    const antes = new Map(locais);
    try { return await fazer(); } catch (erro) {
      locais.clear();
      for (const [id, sessao] of antes) locais.set(id, sessao);
      throw erro;
    }
  },
}) }));
vi.mock("@/lib/outbox", () => ({ guardarNaFila: vi.fn(), processar: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
const dia = "2026-11-19";
const entrada = () => ({ id: "sessao", userId: "ana", data: dia, treinoId: "A1", fase: "fase1", cliente: new QueryClient() } as const);

beforeEach(() => {
  locais.clear();
  rascunhos.clear();
  vi.stubGlobal("window", { localStorage: {
    getItem: (k: string) => rascunhos.get(k) ?? null,
    setItem: (k: string, v: string) => rascunhos.set(k, v),
    removeItem: (k: string) => rascunhos.delete(k),
  } });
  vi.mocked(guardarNaFila).mockResolvedValue(undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("rascunho por conta, dia e treino", () => {
  it("só consome o rascunho correspondente depois de salvar a sessão e a fila", async () => {
    guardarEquipamentoDoDia("ana", dia, "A1", new Set());
    guardarEquipamentoDoDia("bia", dia, "A1", new Set(["halteres"]));
    guardarEquipamentoDoDia("ana", dia, "B1", new Set(["tatame"]));
    expect(lerEquipamentoDoDia("ana", "2026-11-20", "A1")).toEqual(equipamentoDisponivel());
    vi.mocked(guardarNaFila).mockRejectedValueOnce(new Error("quota"));
    await expect(criarSessaoComEquipamentoDoDia(entrada())).rejects.toThrow("quota");
    expect(locais.size).toBe(0);
    expect(lerEquipamentoDoDia("ana", dia, "A1")).toEqual(new Set());
    const sessao = await criarSessaoComEquipamentoDoDia(entrada());
    expect(equipamentoDaSessao(sessao)).toEqual(new Set());
    expect(equipamentoDaSessao(locais.get(sessao.id)!)).toEqual(new Set());
    expect(guardarNaFila).toHaveBeenLastCalledWith("sessao", expect.objectContaining({
      op: "upsert", linha: expect.objectContaining({ plano: expect.objectContaining({ equipamento_disponivel: [] }) }),
    }), "sessions:sessao");
    expect(lerEquipamentoDoDia("ana", dia, "A1")).toEqual(equipamentoDisponivel());
    expect(lerEquipamentoDoDia("ana", dia, "B1")).toEqual(new Set(["tatame"]));
    expect(lerEquipamentoDoDia("bia", dia, "A1")).toEqual(new Set(["halteres"]));
  });

  it("usa a escolha da tela se o storage estiver bloqueado e não apaga uma edição nova de outra aba", async () => {
    guardarEquipamentoDoDia("ana", dia, "A1", new Set(["tatame"]));
    vi.mocked(guardarNaFila).mockImplementationOnce(async () => {
      guardarEquipamentoDoDia("ana", dia, "A1", new Set(["halteres"]));
    });
    const naPrimeiraAba = await criarSessaoComEquipamentoDoDia(entrada());
    expect(equipamentoDaSessao(naPrimeiraAba)).toEqual(new Set(["tatame"]));
    expect(lerEquipamentoDoDia("ana", dia, "A1")).toEqual(new Set(["halteres"]));
    vi.stubGlobal("window", { get localStorage() { throw new Error("bloqueado"); } });
    const naTela = await criarSessaoComEquipamentoDoDia({ ...entrada(), equipamentosDisponiveis: new Set() });
    expect(equipamentoDaSessao(naTela)).toEqual(new Set());
  });
});

describe("material da sessão aberta e fila de saída", () => {
  it("uma falha no PATCH preserva a seleção anterior e a série que aguardava gravação", async () => {
    const sessao = await criarSessaoComEquipamentoDoDia(entrada());
    const serie = sessao.blocos[0]!.series[0]!;
    const comSerie = marcarSerie(sessao, 1, serie.id, true);
    salvarSessaoLocal(comSerie);
    const semKit = definirEquipamentoDaSessao(sessao, new Set());
    vi.mocked(guardarNaFila).mockRejectedValueOnce(new Error("quota"));
    await expect(guardarMaterialDaSessao(semKit)).rejects.toThrow("quota");
    await descarregarSessao();
    expect(locais.get(sessao.id)).toEqual(comSerie);
    expect(processar).toHaveBeenCalledTimes(1);
    await guardarMaterialDaSessao(definirEquipamentoDaSessao(comSerie, new Set()));
    const salvo = locais.get(sessao.id)!;
    expect(salvo.blocos[0]?.series[0]?.concluida).toBe(true);
    expect(equipamentoDaSessao(salvo)).toEqual(new Set());
    expect(guardarNaFila).toHaveBeenLastCalledWith("sessao", {
      tabela: "sessions", op: "update", linha: { plano: salvo.plano }, filtro: { id: sessao.id, user_id: "ana", status: "em_andamento" },
    }, "sessions:sessao");
  });

  it("retém o PATCH sem sessão ou com outra conta, e aceita zero linhas se o dono já fechou o treino", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 204 }));
    const cliente = createClient("http://localhost", "mock-anon", { global: { fetch } });
    vi.mocked(clienteNavegador).mockReturnValue(cliente);
    const getSession = vi.spyOn(cliente.auth, "getSession");
    const payload: EscritaTabela = { tabela: "sessions", op: "update", linha: { plano: null }, filtro: { id: "sessao", user_id: "ana", status: "em_andamento" } };
    const item = { tipo: "sessao", payload, tentativas: 0, criadoEm: 0, proximaTentativa: 0 } as const;
    for (const conta of [null, "bia", "ana"]) {
      getSession.mockResolvedValue(conta
        ? { data: { session: { user: { id: conta } } as Session }, error: null }
        : { data: { session: null }, error: null });
      if (conta === "ana") await expect(enviarItem(item)).resolves.toBeUndefined();
      else await expect(enviarItem(item)).rejects.toThrow("Aguardando a conta");
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toContain("user_id=eq.ana");
  });

  it("aplica somente o material ao último registro de outra aba e não recria um treino que ela encerrou", async () => {
    const antiga = await criarSessaoComEquipamentoDoDia(entrada());
    const serie = antiga.blocos[0]!.series[0]!;
    locais.set(antiga.id, marcarSerie(antiga, 1, serie.id, true));
    const desejada = definirEquipamentoDaSessao(antiga, new Set(["halteres"]));
    const gravada = await guardarMaterialDaSessao(desejada);
    expect(gravada.blocos[0]?.series[0]?.concluida).toBe(true);
    expect(equipamentoDaSessao(gravada)).toEqual(new Set(["halteres"]));
    await expect(guardarMaterialDaSessao({ ...desejada, userId: "bia" })).rejects.toThrow("não está aberta");
    locais.delete(antiga.id);
    await expect(guardarMaterialDaSessao(desejada)).rejects.toThrow("não está aberta");
    expect(guardarNaFila).toHaveBeenCalledTimes(2);
    expect(locais.size).toBe(0);
  });
});
