import { dehydrate, QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHAVE_CACHE } from "@/lib/persistencia-query";
import { chaveDoDetalheDaSessao } from "@/lib/chaves-do-historico";
import type { LinhaSerie } from "@/lib/types";
import type { SessaoBruta } from "@/lib/progresso";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { FalhaDeRedeNaTabela, lerTabelaCompleta } from "@/lib/queries/ler";
import { MENSAGEM_NOTA_GERAL_ALTERADA } from "@/lib/sessao";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { guardarNaFila } from "@/lib/outbox";
import { chaveDoHistorico, editarNotaNoHistorico, guardarConclusaoNoHistorico, lerHistoricoDaConta } from "./historico-da-sessao";

const disco = new Map<string, unknown>();
const pendentes: EscritaTabela[] = [];
const guardar = vi.fn(async ({ chave, valor }: { chave: string; valor: unknown }) => { disco.set(chave, structuredClone(valor)); });
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  lerCache: async (chave: string) => structuredClone(disco.get(chave)) ?? null,
  bd: () => ({
    cache: { put: guardar },
    outbox: { where: () => ({ equals: () => ({ toArray: async () => pendentes.map(payload => ({ payload })) }) }) },
    transaction: async (_modo: string, ...args: unknown[]) => {
      const backup = new Map(disco), fila = [...pendentes];
      try { return await (args.at(-1) as () => Promise<unknown>)(); }
      catch (erro) { disco.clear(); for (const [k,v] of backup) disco.set(k,v); pendentes.splice(0, pendentes.length, ...fila); throw erro; }
    },
  }),
}));
vi.mock("@/lib/outbox", () => ({ guardarNaFila: vi.fn(), processar: vi.fn() }));
vi.mock("@/lib/queries/conta-do-treino", () => ({ confirmarContaDoTreino: vi.fn() }));
vi.mock("@/lib/queries/ler", async original => ({
  ...await original<typeof import("@/lib/queries/ler")>(), lerTabelaCompleta: vi.fn(),
}));
const sessao: SessaoBruta = { id: "um", user_id: "ana", workout_id: "A1", status: "concluida", data: "2026-11-19" };
const segunda: SessaoBruta = { ...sessao, id: "dois", workout_id: "B1", nota_geral: "outra sessão" };
const alheia: SessaoBruta = { ...sessao, id: "outro", user_id: "bia", nota_geral: "outra pessoa" };
const rede = (ligada: boolean) => vi.stubGlobal("navigator", { onLine: ligada });
let cliente: QueryClient;
beforeEach(() => {
  cliente = new QueryClient();
  rede(true);
  vi.resetAllMocks(); disco.clear(); pendentes.length = 0;
  guardar.mockImplementation(async ({ chave, valor }) => { disco.set(chave, structuredClone(valor)); });
  vi.mocked(guardarNaFila).mockImplementation(async (_tipo, escrita) => { pendentes.push(escrita as EscritaTabela); });
  vi.mocked(lerTabelaCompleta).mockResolvedValue([sessao, segunda]);
});
afterEach(() => vi.unstubAllGlobals());

describe("nota geral no histórico de força", () => {
  it("reabre o cache v1 da conta sem hidratação do React e conserva o restante ao salvar ou apagar", async () => {
    const antigo = new QueryClient();
    antigo.setQueryData(["progresso", "sessoes"], [sessao, segunda, alheia]);
    disco.set(CHAVE_CACHE, { salvoEm: Date.now(), estado: dehydrate(antigo) });
    rede(false);
    expect(await lerHistoricoDaConta(cliente, "ana")).toEqual([sessao, segunda]);
    await editarNotaNoHistorico(cliente, "ana", sessao, "  dia de chuva  ", null);
    expect(guardarNaFila).toHaveBeenCalledWith("sessao", {
      tabela: "sessions", op: "update", filtro: { id: "um", user_id: "ana", status: "concluida" }, linha: { nota_geral: "dia de chuva" },
    }, "sessions:um");
    expect(await lerHistoricoDaConta(new QueryClient(), "ana")).toEqual([{ ...sessao, nota_geral: "dia de chuva", revisaoDaNotaLocal: 1 }, segunda]);
    expect(await lerHistoricoDaConta(new QueryClient(), "bia")).toEqual([alheia]);
    await editarNotaNoHistorico(cliente, "ana", sessao, " ", "dia de chuva");
    expect(await lerHistoricoDaConta(new QueryClient(), "ana")).toEqual([{ ...sessao, nota_geral: null, revisaoDaNotaLocal: 2 }, segunda]);
    expect(lerTabelaCompleta).not.toHaveBeenCalled();
  });

  it("ignora leituras antigas quando a fila drena antes da resposta, inclusive após apagar em outra aba", async () => {
    await lerHistoricoDaConta(cliente, "ana");
    for (const [base, proxima] of [[null, "novo"], ["novo", null]] as const) {
      let liberar!: (s: SessaoBruta[]) => void;
      const consulta = new Promise<SessaoBruta[]>(r => { liberar = r; });
      let comecou!: () => void;
      const inicio = new Promise<void>(r => { comecou = r; });
      vi.mocked(lerTabelaCompleta).mockImplementationOnce(() => { comecou(); return consulta; });
      const leitura = lerHistoricoDaConta(cliente, "ana");
      await inicio;
      await editarNotaNoHistorico(new QueryClient(), "ana", sessao, proxima ?? "", base);
      pendentes.length = 0;
      liberar([{ ...sessao, nota_geral: base }, segunda]);
      expect((await leitura).find(s => s.id === sessao.id)?.nota_geral).toBe(proxima);
    }
    vi.mocked(lerTabelaCompleta).mockResolvedValue([{ ...sessao, nota_geral: "novo em outro aparelho" }, segunda]);
    expect((await lerHistoricoDaConta(cliente, "ana"))[0]?.nota_geral).toBe("novo em outro aparelho");
  });

  it("protege uma remoção refeita durante o GET mesmo quando o texto e a fila voltam aos valores iniciais", async () => {
    const inicial = { ...sessao, nota_geral: null };
    vi.mocked(lerTabelaCompleta).mockResolvedValueOnce([inicial, segunda]);
    await lerHistoricoDaConta(cliente, "ana");
    let liberar!: (s: SessaoBruta[]) => void;
    let comecou!: () => void;
    const inicio = new Promise<void>(r => { comecou = r; });
    vi.mocked(lerTabelaCompleta).mockImplementationOnce(() => { comecou(); return new Promise(r => { liberar = r; }); });
    const leitura = lerHistoricoDaConta(cliente, "ana");
    await inicio;
    await editarNotaNoHistorico(new QueryClient(), "ana", sessao, "temporária", null);
    await editarNotaNoHistorico(new QueryClient(), "ana", sessao, "", "temporária");
    pendentes.length = 0;
    liberar([{ ...sessao, nota_geral: "antiga do servidor" }, segunda]);
    const resultado = await leitura;
    expect(resultado.find(s => s.id === sessao.id)?.nota_geral).toBeNull();
    expect(resultado.find(s => s.id === segunda.id)).toEqual(segunda);
  });

  it("retém uma edição pendente durante a releitura e usa a cópia da conta se a conexão anunciada cair", async () => {
    await lerHistoricoDaConta(cliente, "ana");
    await editarNotaNoHistorico(cliente, "ana", sessao, "com vento", null);
    expect((await lerHistoricoDaConta(cliente, "ana"))[0]?.nota_geral).toBe("com vento");
    vi.mocked(lerTabelaCompleta).mockRejectedValue(new FalhaDeRedeNaTabela("sem conexão"));
    expect((await lerHistoricoDaConta(new QueryClient(), "ana"))[0]?.nota_geral).toBe("com vento");
    await expect(lerHistoricoDaConta(new QueryClient(), "bia")).rejects.toThrow("sem conexão");
    vi.mocked(lerTabelaCompleta).mockRejectedValue(new Error("acesso negado"));
    await expect(lerHistoricoDaConta(cliente, "ana")).rejects.toThrow("acesso negado");
  });

  it("uma nota enviada pelo player aplica só o texto quando outro aparelho já fechou o treino", async () => {
    vi.mocked(lerTabelaCompleta).mockResolvedValueOnce([{ ...sessao, status: "em_andamento" }]);
    await lerHistoricoDaConta(cliente, "ana");
    pendentes.push({ tabela: "sessions", op: "update", filtro: { id: sessao.id, user_id: "ana" }, linha: { nota_geral: "incluí uma volta" } });
    vi.mocked(lerTabelaCompleta).mockResolvedValueOnce([{ ...sessao, duracao_s: 1800 }]);
    const [salva] = await lerHistoricoDaConta(cliente, "ana");
    expect(salva).toMatchObject({ status: "concluida", duracao_s: 1800, nota_geral: "incluí uma volta" });
  });

  it("um segundo editor recebe o texto confirmado na outra aba e falha de quota preserva a cópia e a fila", async () => {
    await lerHistoricoDaConta(cliente, "ana");
    await editarNotaNoHistorico(cliente, "ana", sessao, "primeiro", null);
    const outro = new QueryClient();
    await expect(editarNotaNoHistorico(outro, "ana", sessao, "atrasado", null)).rejects.toThrow(MENSAGEM_NOTA_GERAL_ALTERADA);
    expect(outro.getQueryData<SessaoBruta[]>(chaveDoHistorico("ana"))?.[0]?.nota_geral).toBe("primeiro");
    guardar.mockRejectedValueOnce(new Error("quota"));
    await expect(editarNotaNoHistorico(cliente, "ana", sessao, "", "primeiro")).rejects.toThrow("quota");
    expect(pendentes).toHaveLength(1);
    await expect(editarNotaNoHistorico(cliente, "ana", alheia, "", null)).rejects.toThrow("outro treino");
    vi.mocked(confirmarContaDoTreino).mockRejectedValue(new Error("sem vínculo"));
    await expect(editarNotaNoHistorico(cliente, "ana", sessao, "", "primeiro")).rejects.toThrow("sem vínculo");
    rede(false);
    expect((await lerHistoricoDaConta(new QueryClient(), "ana"))[0]?.nota_geral).toBe("primeiro");
  });

  it("ao concluir conserva o snapshot, as séries feitas e a nota sem misturar textos legados", async () => {
    await lerHistoricoDaConta(cliente, "ana");
    const inicio = "2026-11-19T11:55:00Z";
    const fim = { resultados: [], escritas: [{ tabela: "sessions", op: "upsert" as const,
      linha: { ...sessao, workout_id: "livre", iniciada_em: inicio, notas: "um · dois", duracao_s: 300 } }] };
    const serie: LinhaSerie = {
      id: "serie", user_id: "ana", session_id: "um", exercise_id: "remada-unilateral", ordem_ex: 2,
      set_index: 1, tipo: "trabalho", concluida: true, reps: 8, reps_lado2: 7, carga_kg: 10,
      reps_alvo_min: 6, reps_alvo_max: 10, tempo_s: null, tempo_s_lado2: null, passos: null,
      assistencia: null, rpe: null, ultima_firme: true, registrada_em: "2026-11-19T12:00:00Z",
    };
    const series = [{ ...serie, id: "aquecimento", tipo: "aquecimento" as const, carga_kg: 5 }, serie];
    const ordem = ["remada-unilateral", "prancha"];
    await guardarConclusaoNoHistorico(cliente, fim, "treino do dia", series, ordem);
    rede(false);
    expect((await lerHistoricoDaConta(new QueryClient(), "ana"))[0]).toMatchObject({
      iniciada_em: inicio, nota_geral: "treino do dia", duracao_s: 300, seriesDeTrabalhoLocais: 1,
      ordem_execucao: ordem,
    });
    expect((await lerHistoricoDaConta(new QueryClient(), "ana"))[0]).not.toHaveProperty("notas");
    expect(disco.get(chaveDoDetalheDaSessao("ana", "um"))).toEqual(series);
    expect(disco.has(chaveDoDetalheDaSessao("bia", "um"))).toBe(false);
    expect(disco.has(chaveDoDetalheDaSessao("ana", "dois"))).toBe(false);
  });
});
