import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";
import { selecionarSeriesDoDetalhe } from "@/lib/queries/series-do-detalhe";
import type { SerieBruta } from "@/lib/progresso";
import { retirarDetalhesCobertos } from "@/lib/queries/cache-do-detalhe";
import { FalhaDeRedeNaTabela } from "@/lib/queries/ler";
import { atualizarFonteDoRelatorio, chaveDaLista, lerFonteDoRelatorio } from "./lista-do-relatorio";

const fila = vi.hoisted(() => [] as { tipo: string; payload: unknown }[]);
const lerFila = vi.hoisted(() => vi.fn<(tipo: string) => Promise<typeof fila>>());
const transacao = vi.hoisted(() => vi.fn(async (_modo: string, _tabelas: unknown, operar: () => unknown) => operar()));
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
    transaction: transacao,
  }),
}));
vi.mock("@/lib/queries/cache-do-detalhe", () => ({ retirarDetalhesCobertos: vi.fn(async () => 0) }));
const antiga = ["progresso", "series-todas"];
const buscar = vi.fn();
let cliente: QueryClient;
beforeEach(() => {
  vi.mocked(retirarDetalhesCobertos).mockClear();
  transacao.mockClear();
  vi.stubGlobal("navigator", { onLine: false });
  lerFila.mockReset().mockImplementation(async tipo => fila.filter(i => i.tipo === tipo));
  disco.clear(); fila.length = 0; buscar.mockReset(); cliente = new QueryClient();
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

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

  it("usa o arquivo do cliente anterior até baixar a ordem e o mantém separado de outra aba ainda nessa versão", async () => {
    const chaveAntiga = "series-do-historico:ana";
    const antigaSemOrdem = { id: "uma", user_id: "ana", session_id: "s1", carga_kg: 17 };
    disco.set(chaveAntiga, { chave: chaveAntiga, atualizadoEm: Date.now(), valor: [antigaSemOrdem] });
    const ler = () => lerFonteDoRelatorio(new QueryClient(), "ana", "series", antiga, buscar);
    expect(await ler()).toEqual({ linhas: [antigaSemOrdem], completa: true });
    vi.stubGlobal("navigator", { onLine: true });
    const colunaNova = { ...antigaSemOrdem, ordem_ex: 3, carga_kg: 19 };
    buscar.mockResolvedValue([colunaNova]);
    const nova = await ler();
    expect(nova.linhas).toEqual([colunaNova]);
    expect(nova.confirmadasEm).toEqual(expect.any(Number));
    disco.set(chaveAntiga, { chave: chaveAntiga, atualizadoEm: Date.now() + 500, valor: [antigaSemOrdem] });
    vi.stubGlobal("navigator", { onLine: false });
    expect(await ler()).toEqual(nova);
    expect(buscar).toHaveBeenCalledOnce();
  });

  it("guarda a hora do início do GET e os valores corretos do lote de backup que sincronizou enquanto a resposta ainda vinha", async () => {
    const dela = { id: "uma", user_id: "ana", session_id: "s1", ordem_ex: 4, reps: 10, concluida: true };
    const corrigida = { ...dela, reps: 7, concluida: false };
    const outra = { ...dela, id: "outra", user_id: "bia" };
    fila.push({ tipo: "serie", payload: { tabela: "session_sets", op: "upsert", linhas: [corrigida, outra] } });
    const liberar = Promise.withResolvers<void>();
    const servidor = vi.fn(async () => { await liberar.promise; return [dela]; });
    const ler = () => lerFonteDoRelatorio(new QueryClient(), "ana", "series", antiga, servidor);
    vi.stubGlobal("navigator", { onLine: true });
    const leitura = ler();
    await vi.waitFor(() => expect(servidor).toHaveBeenCalledOnce());
    const enquantoLia = Date.now();
    fila.length = 0;
    liberar.resolve();
    const confirmada = await leitura;
    expect(confirmada.linhas).toEqual([corrigida]);
    expect(confirmada.confirmadasEm).toBeLessThanOrEqual(enquantoLia);
    expect(retirarDetalhesCobertos).toHaveBeenCalledWith("ana", confirmada.confirmadasEm);
    vi.stubGlobal("navigator", { onLine: false });
    expect(await ler()).toEqual(confirmada);
    expect(servidor).toHaveBeenCalledOnce();
    expect(retirarDetalhesCobertos).toHaveBeenCalledTimes(1);
  });

  it("o fechamento que ocorre durante a primeira consulta da fila prevalece até uma leitura integral posterior", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.useFakeTimers({ toFake: ["Date"] });
    const inicio = Date.now();
    const entrou = Promise.withResolvers<void>();
    const liberar = Promise.withResolvers<void>();
    lerFila.mockImplementationOnce(async () => { entrou.resolve(); await liberar.promise; return []; });
    const ler = () => lerFonteDoRelatorio<SerieBruta>(cliente, "ana", "series", antiga, buscar);
    buscar.mockResolvedValue([]);
    const anterior = ler();
    await entrou.promise;
    vi.setSystemTime(inicio + 50);
    const feita = { id: "s1", user_id: "ana", session_id: "treino", concluida: true, carga_kg: 20 } as SerieBruta;
    const fechamento = { linhas: [feita], atualizadoEm: Date.now() };
    vi.setSystemTime(inicio + 80);
    liberar.resolve();
    const lista = await anterior;
    expect(lista.confirmadasEm).toBe(inicio);
    expect(retirarDetalhesCobertos).toHaveBeenCalledWith("ana", inicio);
    expect(transacao).toHaveBeenCalledWith("rw", [
      expect.objectContaining({ put: expect.any(Function) }), expect.objectContaining({ where: expect.any(Function) }),
    ], expect.any(Function));
    expect(selecionarSeriesDoDetalhe("ana", "treino", lista.linhas, lista.completa, lista.confirmadasEm, fechamento).linhas).toEqual([feita]);
    const posterior = await ler();
    expect(posterior.confirmadasEm).toBe(inicio + 80);
    expect(selecionarSeriesDoDetalhe("ana", "treino", posterior.linhas, posterior.completa, posterior.confirmadasEm, fechamento).linhas).toEqual([]);
  });

  it("uma transação sem espaço mostra a rede sem certificar precedência sobre o fechamento local", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    transacao.mockRejectedValueOnce(new Error("quota"));
    const remota = { id: "s1", user_id: "ana", session_id: "treino", carga_kg: 10 } as SerieBruta;
    buscar.mockResolvedValue([remota]);
    const lista = await lerFonteDoRelatorio<SerieBruta>(cliente, "ana", "series", antiga, buscar);
    expect(lista).toEqual({ linhas: [remota], completa: true });
    const local = { linhas: [{ ...remota, carga_kg: 20 }], atualizadoEm: Date.now() - 100 };
    expect(selecionarSeriesDoDetalhe("ana", "treino", lista.linhas, lista.completa, lista.confirmadasEm, local).linhas).toEqual(local.linhas);
    expect(retirarDetalhesCobertos).not.toHaveBeenCalled();
  });

  it("uma falha na fila não dá à projeção do servidor prioridade sobre as séries confirmadas na conclusão", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    lerFila.mockRejectedValue(new Error("disco indisponível"));
    buscar.mockResolvedValue([]);
    const lista = await lerFonteDoRelatorio(cliente, "ana", "series", antiga, buscar);
    expect(lista).toEqual({ linhas: [], completa: true });
    expect(retirarDetalhesCobertos).not.toHaveBeenCalled();
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
