import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";
import { FalhaDeRedeNaTabela } from "@/lib/queries/ler";
import { atualizarFonteDoRelatorio, chaveDaLista, lerFonteDoRelatorio } from "./lista-do-relatorio";

const fila = vi.hoisted(() => [] as { tipo: string; payload: unknown }[]);
const lerFila = vi.hoisted(() => vi.fn<(tipo: string) => Promise<typeof fila>>());
const disco = vi.hoisted(() => new Map<string, { chave: string; atualizadoEm: number; valor: unknown }>());
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  lerCache: async (chave: string) => disco.get(chave)?.valor,
  bd: () => ({
    outbox: { where: () => ({ equals: (tipo: string) => ({ toArray: () => lerFila(tipo) }) }) },
    cache: {
      get: async (chave: string) => disco.get(chave),
      put: async (linha: { chave: string; atualizadoEm: number; valor: unknown }) => { disco.set(linha.chave, linha); },
    },
    transaction: async (_modo: string, _cache: unknown, fn: () => unknown) => fn(),
  }),
}));
const antiga = ["progresso", "series-todas"];
const buscar = vi.fn();
let cliente: QueryClient;
beforeEach(() => {
  vi.stubGlobal("navigator", { onLine: false });
  lerFila.mockReset().mockImplementation(async tipo => fila.filter(i => i.tipo === tipo));
  disco.clear(); fila.length = 0; buscar.mockReset(); cliente = new QueryClient();
});
afterEach(() => vi.unstubAllGlobals());

describe("fontes históricas da conta no aparelho", () => {
  it("recupera séries legadas só por sessões com dono e só confirma cobertura da versão paginada", async () => {
    const ana = { id: "s1", user_id: "ana" };
    const bia = { id: "s2", user_id: "bia" };
    disco.set(chaveDoHistoricoNoDisco("ana"), { chave: chaveDoHistoricoNoDisco("ana"), atualizadoEm: Date.now(), valor: [ana] });
    cliente.setQueryData(["progresso", "sessoes"], [bia]);
    const minha = { session_id: "s1", exercise_id: "supino" };
    const alheia = { session_id: "s2", exercise_id: "rosca" };
    cliente.setQueryData(antiga, [minha, alheia]);
    const ler = () => lerFonteDoRelatorio(cliente, "ana", "series", antiga, buscar);
    expect(await ler()).toEqual({ linhas: [minha], completa: false });
    const paginadas = Array.from({ length: 3005 }, (_, i) => ({ ...minha, id: String(i) }));
    cliente.setQueryData(antiga, paginadas);
    expect(await ler()).toEqual({ linhas: paginadas, completa: true });
    cliente.setQueryData(antiga, []);
    expect(await ler()).toEqual({ linhas: [], completa: false });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("mantém o cardio legado confirmado por linha e não atribui repetições sem dono à conta atual", async () => {
    const minha = { id: "corrida", user_id: "ana" };
    cliente.setQueryData(["cardio-todos"], [minha, { id: "caminhada", user_id: "bia" }]);
    expect(await lerFonteDoRelatorio(cliente, "ana", "cardio", ["cardio-todos"], buscar))
      .toEqual({ linhas: [minha], completa: false });
    cliente.setQueryData(["soltas-todas"], [{ id: "dez", reps: 10 }]);
    expect(await lerFonteDoRelatorio(cliente, "ana", "soltas", ["soltas-todas"], buscar))
      .toEqual({ linhas: [], completa: false });
  });

  it("reabre imediatamente em outro cliente, distingue vazio confirmado e não serve cache em erro de permissão", async () => {
    const ler = (conta: string) => lerFonteDoRelatorio(cliente, conta, "cardio", ["cardio-todos"], buscar);
    vi.stubGlobal("navigator", { onLine: true });
    buscar.mockResolvedValueOnce([]); await ler("ana");
    cliente = new QueryClient();
    vi.stubGlobal("navigator", { onLine: false });
    expect(await ler("ana")).toEqual({ linhas: [], completa: true });
    expect(await ler("bia")).toEqual({ linhas: [], completa: false });
    vi.stubGlobal("navigator", { onLine: true });
    buscar.mockRejectedValueOnce(new Error("sem permissão"));
    await expect(ler("ana")).rejects.toThrow("sem permissão");
    buscar.mockRejectedValueOnce(new FalhaDeRedeNaTabela("sem rede"));
    expect(await ler("ana")).toEqual({ linhas: [], completa: true });
  });

  it("a consulta iniciada com ações offline não reverte um cardio nem repõe uma solta apagada quando a fila esvazia", async () => {
    const cardio = { id: "corrida", data: "2026-11-20", user_id: "ana" };
    const antiga = { id: "barra", data: "2026-11-20", user_id: "ana" };
    fila.push(
      { tipo: "cardio", payload: { tabela: "cardio_sessions", op: "upsert", linha: cardio } },
      { tipo: "barra_fixa_solta", payload: { tabela: "pullup_singles", op: "delete", filtro: { id: antiga.id, user_id: "ana" } } },
      { tipo: "cardio", payload: { tabela: "cardio_sessions", op: "upsert", linha: { ...cardio, id: "outro", user_id: "bia" } } },
    );
    vi.stubGlobal("navigator", { onLine: true });
    const pausa = Promise.withResolvers<void>();
    const cardioRemoto = vi.fn(async () => { await pausa.promise; return []; });
    const soltaRemota = vi.fn(async () => { await pausa.promise; return [antiga]; });
    const c = lerFonteDoRelatorio(cliente, "ana", "cardio", ["cardio-todos"], cardioRemoto);
    const s = lerFonteDoRelatorio(cliente, "ana", "soltas", ["soltas-todas"], soltaRemota);
    await vi.waitFor(() => { expect(cardioRemoto).toHaveBeenCalled(); expect(soltaRemota).toHaveBeenCalled(); });
    fila.length = 0; pausa.resolve();
    expect(await c).toEqual({ linhas: [cardio], completa: true });
    expect(await s).toEqual({ linhas: [], completa: true });
    vi.stubGlobal("navigator", { onLine: false });
    expect(await lerFonteDoRelatorio(new QueryClient(), "ana", "cardio", ["cardio-todos"], buscar))
      .toEqual({ linhas: [cardio], completa: true });
  });

  it("a escrita de cardio no aparelho atualiza só a lista confirmada daquela conta", async () => {
    const ler = (conta: string) => lerFonteDoRelatorio(cliente, conta, "cardio", ["cardio-todos"], buscar);
    vi.stubGlobal("navigator", { onLine: true }); buscar.mockResolvedValue([]); await ler("ana"); await ler("bia");
    const linha = { id: "um", user_id: "ana" };
    await atualizarFonteDoRelatorio(cliente, "ana", "cardio", ["cardio-todos","ana"], () => [linha]);
    vi.stubGlobal("navigator", { onLine: false });
    expect(await ler("ana")).toEqual({ linhas: [linha], completa: true });
    expect(await ler("bia")).toEqual({ linhas: [], completa: true });
    disco.set(chaveDaLista("cardio", "bia"), {
      chave: chaveDaLista("cardio","bia"), atualizadoEm: Date.now(), valor: [linha],
    });
    expect(await ler("bia")).toEqual({ linhas: [], completa: false });
  });

  it.each(["durante toda a consulta", "logo após a resposta", "ao apresentar a lista"])(
    "apresenta a resposta online quando falha a leitura da fila %s", async momento => {
      vi.stubGlobal("navigator", { onLine: true });
      const chave = chaveDaLista("cardio", "ana");
      const local = { id: "corrida-offline", user_id: "ana" };
      const remota = { id: "natacao", user_id: "ana" };
      const confirmada = { chave, atualizadoEm: Date.now() - 1000, valor: [local] };
      disco.set(chave, confirmada);
      fila.push({ tipo: "cardio", payload: { tabela: "cardio_sessions", op: "upsert", linha: local } });
      if (momento !== "durante toda a consulta") lerFila.mockResolvedValueOnce([...fila]);
      if (momento === "ao apresentar a lista") lerFila.mockResolvedValueOnce([...fila]);
      lerFila.mockRejectedValue(new Error("Armazenamento indisponível"));
      buscar.mockResolvedValue([remota]);
      const resultado = await lerFonteDoRelatorio(cliente, "ana", "cardio", ["cardio-todos"], buscar);
      expect(resultado).toEqual({ linhas: momento === "durante toda a consulta" ? [remota] : [remota, local], completa: true });
      expect(buscar).toHaveBeenCalledTimes(1);
      expect(fila).toHaveLength(1);
      if (momento !== "ao apresentar a lista") expect(disco.get(chave)).toBe(confirmada);
    },
  );

  it("respeita o cancelamento durante a leitura da fila sem consultar o servidor", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const controle = new AbortController();
    lerFila.mockImplementationOnce(async () => {
      controle.abort();
      throw new Error("Armazenamento indisponível");
    });
    await expect(lerFonteDoRelatorio(cliente, "ana", "cardio", [], buscar, controle.signal))
      .rejects.toBe(controle.signal.reason);
    expect(buscar).not.toHaveBeenCalled();
  });
});
