import { createClient, type Session } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { itensDeIds, planoDaSessao } from "@/lib/livre";
import { guardarNaFila, processar } from "@/lib/outbox";
import { vinculoDoLoginAtual } from "@/lib/player-sem-rede";
import type { SessaoBruta } from "@/lib/progresso";
import { chaves } from "@/lib/queries/dados";
import { lerMotorParaRepetir } from "@/lib/queries/motor-repetir-treino";
import { abrirRepeticaoDoTreino } from "@/lib/queries/repetir-treino";
import type { SessaoLocal } from "@/lib/sessao";
import { clienteNavegador } from "@/lib/supabase/client";
import type { LinhaPerfil } from "@/lib/types";

const locais = new Map<string, SessaoLocal>();
let anterior = Promise.resolve();
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  bd: () => ({
    sessaoAtiva: {
      orderBy: () => ({ reverse: () => ({
        filter: (aceita: (item: { dados: SessaoLocal }) => boolean) => ({
          first: async () => [...locais.values()].reverse().map(dados => ({ dados })).find(aceita),
        }),
      }) }),
      put: async ({ id, dados }: { id: string; dados: SessaoLocal }) => locais.set(id, dados),
    },
    outbox: {},
    transaction: (_modo: string, _ativas: unknown, _fila: unknown, operar: () => Promise<SessaoLocal>) => {
      const operacao = anterior.then(async () => {
        const copia = [...locais.entries()];
        try { return await operar(); } catch (erro) {
          locais.clear();
          for (const [id, sessao] of copia) locais.set(id, sessao);
          throw erro;
        }
      });
      anterior = operacao.then(() => {}, () => {});
      return operacao;
    },
  }),
}));
vi.mock("@/lib/outbox", () => ({ guardarNaFila: vi.fn(), processar: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
vi.mock("@/lib/player-sem-rede", () => ({ vinculoDoLoginAtual: vi.fn() }));
vi.mock("@/lib/queries/motor-repetir-treino", () => ({ lerMotorParaRepetir: vi.fn() }));

const perfil: LinhaPerfil = {
  user_id: "ana", nome: "Ana", altura_cm: null, data_inicio: "2026-01-02", fase_atual: "fase1",
  fase_desde: "2026-02-01", objetivo: "", semana_corrida: 1, semana_corda: 1, semana_fixa: 1,
  ultimo_treino: null, prefs: {},
};
const modelo: SessaoBruta = {
  id: "antiga", user_id: perfil.user_id, data: "2026-04-09", workout_id: "livre", status: "concluida",
  plano: planoDaSessao(itensDeIds(["prancha", "agachamento-goblet"]), { titulo: "Meu treino" }),
};
const hoje = "2026-11-19";
const fetch = vi.fn<typeof globalThis.fetch>();
let cache: QueryClient;
let login: string | null;
const abrir = (origem = modelo) => abrirRepeticaoDoTreino(cache, perfil, hoje, origem);

beforeEach(() => {
  cache = new QueryClient();
  locais.clear();
  login = "ana";
  vi.mocked(vinculoDoLoginAtual).mockImplementation(async () => login
    ? { conta: login, url: "http://localhost", chave: "simulada", impressao: "confirmada" } : null);
  vi.stubGlobal("navigator", { onLine: true });
  fetch.mockResolvedValue(new Response("[]", { headers: { "Content-Type": "application/json" } }));
  const supabase = createClient("http://localhost", "simulado", { global: { fetch } });
  vi.spyOn(supabase.auth, "getSession").mockImplementation(async () => login
    ? { data: { session: { user: { id: login } } as Session }, error: null }
    : { data: { session: null }, error: null });
  vi.mocked(clienteNavegador).mockReturnValue(supabase);
  vi.mocked(lerMotorParaRepetir).mockResolvedValue({ conhecidos: new Set() });
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("abertura do treino livre pelo Histórico", () => {
  it("uma falha na fila desfaz o treino local e a nova tentativa guarda exatamente uma criação", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    vi.mocked(guardarNaFila).mockRejectedValueOnce(new Error("quota"));
    await expect(abrir()).rejects.toThrow("quota");
    expect(locais.size).toBe(0);
    const destino = await abrir();
    expect(destino.retomada).toBe(false);
    expect(destino.id).not.toBe(modelo.id);
    expect(locais.get(destino.id)).toMatchObject({ data: hoje, userId: "ana", status: "em_andamento", plano: modelo.plano });
    expect(guardarNaFila).toHaveBeenLastCalledWith("sessao", expect.objectContaining({
      tabela: "sessions", op: "upsert", onConflict: "id", linha: expect.objectContaining({ id: destino.id }),
    }), `sessions:${destino.id}`);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("duas linhas em paralelo e um novo toque posterior abrem o mesmo UUID, com um único upsert", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const resultados = await Promise.all([abrir(), abrir({ ...modelo, id: "outra-origem" })]);
    expect(resultados[0]?.id).toEqual(resultados[1]?.id);
    expect(resultados.filter(r => !r.retomada)).toHaveLength(1);
    expect(await abrir()).toEqual({ id: resultados[0]!.id, retomada: true });
    expect(guardarNaFila).toHaveBeenCalledTimes(1);
    expect(processar).toHaveBeenCalledTimes(1);
    expect(locais.size).toBe(1);
  });

  it("retoma a sessão em andamento retornada pelo servidor sem carregar exercícios", async () => {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify([
      { id: "outra", user_id: "bia" }, { id: "remota", user_id: "ana" },
    ]), { headers: { "Content-Type": "application/json" } }));
    await expect(abrir()).resolves.toEqual({ id: "remota", retomada: true });
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.searchParams.get("user_id")).toBe("eq.ana");
    expect(url.searchParams.get("status")).toBe("eq.em_andamento");
    expect(lerMotorParaRepetir).not.toHaveBeenCalled();
    expect(guardarNaFila).not.toHaveBeenCalled();
  });

  it("não retoma a sessão fechada offline nem uma aberta cujo dono não foi identificado", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    cache.setQueryData(chaves.sessoes(), [{ id: "fechada", user_id: "ana", status: "concluida" }]);
    cache.setQueryData(chaves.sessoesAbertas(), [
      { id: "fechada", user_id: "ana", status: "em_andamento" },
      { id: "da-bia", user_id: "bia", status: "em_andamento" }, { id: "cache-antigo", status: "em_andamento" },
    ]);
    expect((await abrir()).retomada).toBe(false);
    expect(lerMotorParaRepetir).toHaveBeenCalledWith(cache, "ana", ["prancha", "agachamento-goblet"], expect.any(Function));
  });

  it("recusa origem sem dono ou de outra conta e uma troca de login durante a leitura", async () => {
    for (const user_id of [undefined, "bia"]) {
      await expect(abrir({ ...modelo, user_id })).rejects.toThrow("outra conta");
    }
    expect(fetch).not.toHaveBeenCalled();
    vi.mocked(lerMotorParaRepetir).mockImplementation(async () => { login = "bia"; return {}; });
    await expect(abrir()).rejects.toThrow("confirmar sua conta");
    expect(guardarNaFila).not.toHaveBeenCalled();
  });

  it("o login confirmado no aparelho funciona offline mesmo quando o SDK precisaria renovar o token", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const sessao = vi.mocked(clienteNavegador().auth.getSession);
    sessao.mockRejectedValue(new Error("refresh sem rede"));
    await expect(abrir()).resolves.toMatchObject({ retomada: false });
    expect(sessao).not.toHaveBeenCalled();
  });
});
