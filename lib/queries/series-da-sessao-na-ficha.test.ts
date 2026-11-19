import { QueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chaveDoDetalheDaSessao, chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";
import type { ItemCache } from "@/lib/db";
import type { SerieBruta } from "@/lib/progresso";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { chaveDaLista } from "@/lib/queries/lista-do-relatorio";
import { lerSeriesDaSessaoNaFicha } from "@/lib/queries/series-do-detalhe";
import { clienteNavegador } from "@/lib/supabase/client";

const disco = new Map<string, ItemCache>();
const fila: { tipo: string; payload: EscritaTabela }[] = [];
const gravar = vi.fn(async (item: ItemCache) => { disco.set(item.chave, item); });
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true, lerCache: async (chave: string) => disco.get(chave)?.valor,
  bd: () => ({
    cache: { get: async (chave: string) => disco.get(chave), put: gravar,
      where: () => ({ above: (desde: number) => ({
        primaryKeys: async () => [...disco.values()].filter(i => i.atualizadoEm > desde).map(i => i.chave),
      }) }),
    },
    outbox: { where: () => ({ equals: (tipo: string) => ({ toArray: async () => fila.filter(i => i.tipo === tipo) }) }) },
    transaction: (_modo: string, ...args: unknown[]) => (args.at(-1) as () => unknown)(),
  }),
}));
vi.mock("@/lib/queries/conta-do-treino", () => ({ confirmarContaDoTreino: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));

const uid = "conta-a";
const treino = "sessao-a";
const hoje = "2026-11-19T12:00:00Z";
const chave = chaveDoDetalheDaSessao(uid, treino);
const linha = (id: string, alteracoes: Partial<SerieBruta> = {}): SerieBruta => ({
  id, session_id: treino, user_id: uid, ordem_ex: 1, exercise_id: "supino", set_index: 1,
  tipo: "trabalho", concluida: true, registrada_em: hoje, reps: 8, reps_lado2: null, carga_kg: 30,
  passos: null, assistencia: null, tempo_s: null, tempo_s_lado2: null, ...alteracoes,
});
const http = vi.fn<typeof fetch>();
const pedidos: URL[] = [];
let servidor: SerieBruta[];
let cliente: QueryClient;
const ler = (id = treino) => lerSeriesDaSessaoNaFicha(cliente, uid, id, new AbortController().signal);
function salvar(chave: string, valor: unknown, atualizadoEm: number) {
  disco.set(chave, { chave, valor, atualizadoEm });
}

beforeEach(() => {
  disco.clear(); fila.length = 0; pedidos.length = 0; servidor = []; cliente = new QueryClient();
  gravar.mockClear();
  vi.stubGlobal("navigator", { onLine: true });
  vi.mocked(confirmarContaDoTreino).mockReset().mockResolvedValue();
  http.mockReset().mockImplementation(async (url, opcoes) => {
    const u = new URL(String(url)); pedidos.push(u);
    expect(u.pathname).toBe("/rest/v1/session_sets");
    expect(u.searchParams.get("user_id")).toBe("eq." + uid);
    expect(u.searchParams.get("session_id")).toMatch(/^eq\./);
    expect(u.searchParams.get("order")).toBe("id.asc");
    expect(u.searchParams.get("exercise_id")).toBeNull();
    const id = u.searchParams.get("session_id")!.slice(3), cursor = u.searchParams.get("id")?.slice(3);
    const dados = servidor.filter(s => s.user_id === uid && s.session_id === id && (!cursor || s.id! > cursor))
      .sort((a, b) => a.id!.localeCompare(b.id!));
    const headers = new Headers();
    if (new Headers(opcoes?.headers).get("Prefer")?.includes("count=exact")) headers.set("content-range", "*/" + dados.length);
    return Response.json(dados.slice(0, 2), { headers });
  });
  vi.mocked(clienteNavegador).mockReturnValue(createClient("https://supabase.test", "anon", {
    global: { fetch: http }, auth: { persistSession: false, autoRefreshToken: false },
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("detalhe da sessão aberta pela ficha de um exercício", () => {
  it.each(["fechamento", "relatório"])("mostra o %s completo enquanto a resposta da consulta ainda está retida", async origem => {
    const antigas = [linha("a"), linha("b", { exercise_id: "remada" })], presente = Date.now() - 200;
    salvar(origem === "fechamento" ? chave : chaveDaLista("series", uid), antigas, presente);
    const liberar = Promise.withResolvers<void>();
    http.mockImplementationOnce(async () => {
      await liberar.promise;
      return Response.json([linha("nova")], { headers: { "content-range": "*/1" } });
    });
    const leitura = ler();
    try {
      await vi.waitFor(() => expect(http).toHaveBeenCalledOnce());
      expect(cliente.getQueryData(["progresso", "series-da-sessao", uid, treino]))
        .toEqual({ linhas: antigas, completa: true, confirmadasEm: presente });
    } finally { liberar.resolve(); await leitura; }
    expect((await leitura).linhas).toEqual([linha("nova")]);
  });

  it("o GET da ficha iniciado antes da correção não volta a guardar a fração antiga após o envio", async () => {
    const certa = linha("serie", { reps: 8, carga_kg: 21.5 });
    fila.push({ tipo: "serie", payload: { tabela: "session_sets", op: "upsert", linha: { ...certa, reps: 8.5 } } });
    http.mockImplementationOnce(async () => {
      fila.length = 0; servidor = [certa];
      return Response.json([], { headers: { "content-range": "*/0" } });
    });
    expect((await ler()).linhas).toEqual([certa]);
    expect(disco.get(chave)?.valor).toEqual([certa]);
    vi.stubGlobal("navigator", { onLine: false });
    expect((await ler()).linhas).toEqual([certa]);
  });

  it("corrigir outra sessão não repete a consulta da ficha nem altera sua carga fracionária", async () => {
    const desta = linha("serie", { carga_kg: 21.5 });
    fila.push({ tipo: "serie", payload: { tabela: "session_sets", op: "upsert", linha: { ...desta, id: "outra-serie", session_id: "outra", reps: 8.5 } } });
    http.mockImplementationOnce(async () => {
      fila.length = 0;
      return Response.json([desta], { headers: { "content-range": "*/1" } });
    });
    expect((await ler()).linhas).toEqual([desta]);
    expect(http).toHaveBeenCalledOnce();
  });

  it("completa todas as páginas pelo UUID, guarda antes de responder e reabre somente o treino pedido sem rede", async () => {
    servidor = [linha("a"), linha("b", { tipo: "aquecimento" }), linha("e", { exercise_id: "remada" }),
      linha("c", { session_id: "outra" }), linha("d", { user_id: "outra-conta" })];
    const completo = await ler();
    expect(completo.linhas.map(s => s.id)).toEqual(["a", "b", "e"]);
    expect(completo.completa).toBe(true);
    expect(pedidos.map(p => p.searchParams.get("id"))).toContain("gt.b");
    expect(disco.get(chave)?.valor).toEqual(completo.linhas);
    vi.stubGlobal("navigator", { onLine: false });
    cliente = new QueryClient();
    const pedidosAntes = http.mock.calls.length;
    expect(await ler()).toEqual(completo);
    expect(await ler("outra")).toMatchObject({ linhas: [], completa: false });
    expect(http).toHaveBeenCalledTimes(pedidosAntes);
  });

  it("a confirmação posterior do Relatório substitui a cópia expurgada, inclusive por treino vazio", async () => {
    const anterior = linha("a", { carga_kg: 20 }), recente = { ...anterior, carga_kg: 32.5 };
    servidor = [anterior];
    const guardado = await ler();
    cliente.setQueryData(["progresso", "series-da-sessao", uid, treino], guardado);
    disco.delete(chave);
    vi.stubGlobal("navigator", { onLine: false });
    const instante = guardado.confirmadasEm! + 100;
    salvar(chaveDaLista("series", uid), [recente, linha("b", { session_id: "outra" })], instante);
    expect(await ler()).toEqual({ completa: true, linhas: [recente], confirmadasEm: instante });
    salvar(chaveDaLista("series", uid), [], instante + 1);
    expect(await ler()).toEqual({ completa: true, linhas: [], confirmadasEm: instante + 1 });
  });

  it("ao reconectar no mesmo instante do relógio, o GET atualiza a cópia consultada antes da edição remota", async () => {
    const relogio = vi.spyOn(Date, "now").mockReturnValue(Date.now());
    try {
      servidor = [linha("segunda", { reps: 8, carga_kg: 23.5 })];
      await ler();
      vi.stubGlobal("navigator", { onLine: false });
      expect((await ler()).linhas).toEqual(servidor);
      servidor = [{ ...servidor[0]!, reps: 11 }];
      vi.stubGlobal("navigator", { onLine: true });
      expect((await ler()).linhas).toEqual(servidor);
      expect(disco.get(chave)?.valor).toEqual(servidor);
    } finally { relogio.mockRestore(); }
  });

  it("conserva uma edição do fechamento que ocorreu durante o GET no mesmo instante do relógio", async () => {
    const instante = Date.now(), anterior = linha("segunda", { reps: 8 }), editada = { ...anterior, reps: 12 };
    const relogio = vi.spyOn(Date, "now").mockReturnValue(instante);
    try {
      salvar(chave, [anterior], instante);
      http.mockImplementationOnce(async () => {
        salvar(chave, [editada], instante);
        return Response.json([anterior], { headers: { "content-range": "*/1" } });
      });
      expect((await ler()).linhas).toEqual([editada]);
      expect(disco.get(chave)?.valor).toEqual([editada]);
    } finally { relogio.mockRestore(); }
  });

  it("um encerramento na fila vence o GET anterior mesmo quando a fila esvaziou durante a consulta", async () => {
    const fotos = [linha("local", { exercise_id: "remada", reps: 11 })];
    salvar(chave, fotos, 100);
    fila.push({ tipo: "sessao", payload: { tabela: "sessions", op: "upsert",
      linha: { id: treino, user_id: uid, status: "concluida" } } });
    http.mockImplementationOnce(async () => { fila.length = 0; return Response.json([], { headers: { "content-range": "*/0" } }); });
    expect(await ler()).toEqual({ linhas: fotos, completa: true, confirmadasEm: 100 });
    expect(disco.get(chave)?.valor).toEqual(fotos);
    expect((await ler()).linhas).toEqual([]);
    expect(disco.get(chave)?.valor).toEqual([]);
  });

  it("uma leitura global iniciada depois do GET focado vence a resposta antiga que chegou depois", async () => {
    const recente = linha("recente");
    const agora = Date.now() + 1000;
    http.mockImplementationOnce(async () => {
      salvar(chaveDaLista("series", uid), [recente, linha("outra", { session_id: "outra" })], agora);
      return Response.json([linha("antiga")], { headers: { "content-range": "*/1" } });
    });
    expect(await ler()).toEqual({ linhas: [recente], completa: true, confirmadasEm: agora });
    expect(disco.has(chave)).toBe(false);
  });

  it("conserva o legado validado como parcial e ignora o cache de um único movimento", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const antiga = linha("a", { id: undefined, user_id: undefined, ordem_ex: undefined });
    cliente.setQueryData(["progresso", "series-ex", "supino"], [antiga]);
    expect(await ler()).toMatchObject({ linhas: [], completa: false });
    cliente.setQueryData(["progresso", "series-todas"], [antiga, { ...antiga, session_id: "de-outra" }]);
    salvar(chaveDoHistoricoNoDisco(uid), [{ id: treino, user_id: uid }, { id: "de-outra", user_id: "bia" }], Date.now());
    expect(await ler()).toMatchObject({ linhas: [antiga], completa: false });
    expect(await ler("de-outra")).toMatchObject({ linhas: [], completa: false });
    expect(http).not.toHaveBeenCalled();
  });

  it("recusa respostas de outra sessão e da conta anterior; falha de uma página não sobrescreve a cópia", async () => {
    salvar(chave, [linha("salva")], Date.now() - 500);
    http.mockResolvedValueOnce(Response.json([linha("a", { session_id: "outra" })], { headers: { "content-range": "*/1" } }));
    await expect(ler()).rejects.toThrow("selecionados");
    http.mockResolvedValueOnce(Response.json([linha("a")], { headers: { "content-range": "*/2" } }))
      .mockResolvedValueOnce(Response.json({ message: "sem acesso" }, { status: 403 }));
    await expect(ler()).rejects.toThrow("sem acesso");
    vi.mocked(confirmarContaDoTreino).mockRejectedValueOnce(new Error("conta mudou"));
    await expect(ler()).rejects.toThrow("conta mudou");
    expect(disco.get(chave)?.valor).toEqual([linha("salva")]);
  });

  it("a falta de espaço não bloqueia a sessão online e uma edição de backup na fila é respeitada", async () => {
    const a = linha("a"), b = linha("b");
    servidor = [a, b];
    fila.push({ tipo: "serie", payload: { tabela: "session_sets", op: "upsert", linhas: [
      { id: "a", user_id: uid, session_id: treino, carga_kg: 27.5 },
      { id: "b", user_id: uid, session_id: treino, concluida: false },
    ] } });
    gravar.mockRejectedValueOnce(new Error("quota"));
    expect((await ler()).linhas).toEqual([{ ...a, carga_kg: 27.5 }]);
    expect(disco.has(chave)).toBe(false);
  });
});

it("ao receber depois da conciliação um GET de uma série movida para outro treino, a ficha não repõe o UUID no original", async () => {
  const velha = linha("serie");
  http.mockImplementationOnce(async () => {
    salvar("ultima-conciliacao-de-serie:" + uid, { revisao: 1 }, Date.now());
    servidor = [{ ...velha, exercise_id: "flexao", session_id: "outro-treino" }];
    return Response.json([velha], { headers: { "content-range": "*/1" } });
  });
  expect((await ler()).linhas).toEqual([]);
  expect(http).toHaveBeenCalledTimes(2);
  expect(disco.get(chave)?.valor).toEqual([]);
});
