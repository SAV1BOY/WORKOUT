import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bd, type ItemSaida } from "@/lib/db";
import { corrigirCopiasDaSerie } from "@/lib/espelhos-da-contagem";
import { processar } from "@/lib/outbox";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import {
  MAX_CONTAGEM, confirmarContagemPendente, listarContagensPendentes, type CampoContagem,
} from "@/lib/contagens-pendentes";

vi.mock("@/lib/queries/conta-do-treino", () => ({ confirmarContaDoTreino: vi.fn() }));
vi.mock("@/lib/espelhos-da-contagem", () => ({ corrigirCopiasDaSerie: vi.fn() }));
vi.mock("@/lib/outbox", async original => ({
  ...await original<typeof import("@/lib/outbox")>(), processar: vi.fn(async () => 0),
}));

const ana = "conta-a", bia = "conta-b";
const base = { id: "serie-a", user_id: ana, session_id: "treino-a", exercise_id: "remada", tipo: "trabalho", ordem_ex: 4,
  set_index: 2, carga_kg: 17.5, concluida: true, registrada_em: "2026-11-19T13:00:00Z" };
const escrita = (campos: Record<string, unknown> = {}) => ({
  tabela: "session_sets", op: "upsert", onConflict: "id", linha: { ...base, ...campos },
});
const espera = Date.now() + 300_000;
async function enfileirar(payload: unknown, outros: Partial<ItemSaida> = {}) {
  return bd().outbox.add({ tipo: "serie", criadoEm: 2, proximaTentativa: espera, tentativas: 0,
    alvo: "sessions:treino-a", payload, ...outros });
}
const listar = () => listarContagensPendentes(ana);

beforeEach(async () => {
  await Promise.all([bd().outbox.clear(), bd().cache.clear(), bd().sessaoAtiva.clear()]);
  vi.clearAllMocks();
  vi.mocked(confirmarContaDoTreino).mockReset().mockResolvedValue();
  vi.mocked(corrigirCopiasDaSerie).mockReset().mockResolvedValue();
  vi.stubGlobal("navigator", { onLine: false });
});
afterEach(() => vi.unstubAllGlobals());

describe("correção das contagens fracionárias da fila antiga", () => {
  it("reaproveita a edição inteira posterior pelo id autoincremental e libera a conclusão adiada do mesmo treino", async () => {
    const a = await enfileirar(escrita({ reps: 9.5 }), { tentativas: 12, erro: "recusado", criadoEm: 900 });
    const b = await enfileirar(escrita({ reps: 10 }), { criadoEm: 100 });
    const c = await enfileirar({ tabela: "sessions", op: "upsert", linha: { user_id: ana, id: base.session_id, status: "concluida" } },
      { tipo: "sessao" });
    const d = await enfileirar(escrita({ user_id: bia, id: "outra", reps: 7.5 }));
    const [pendente] = await listar();
    expect(pendente).toMatchObject({ conta: ana, sessaoId: base.session_id, serieId: base.id, indice: 2, ordemEx: 4,
      exercicioId: base.exercise_id, tipo: "trabalho", registradaEm: base.registrada_em,
      campos: [{ campo: "reps", fracionario: 9.5, posterior: 10 }] });
    expect(await confirmarContagemPendente(ana, pendente!, {})).toEqual([{ campo: "reps", fracionarios: [9.5], inteiro: 10 }]);
    const [primeiro, segundo, fechamento, estrangeiro] = await bd().outbox.bulkGet([a, b, c, d]);
    expect(primeiro).toMatchObject({ id: a, alvo: "sessions:treino-a", tentativas: 0, payload: escrita({ reps: 10 }) });
    expect(primeiro!.erro).toBeUndefined();
    expect(segundo!.payload).toEqual(escrita({ reps: 10 }));
    expect(fechamento!.payload).toMatchObject({ linha: { status: "concluida" } });
    for (const item of [primeiro, segundo, fechamento]) expect(item!.proximaTentativa).toBeLessThan(espera);
    expect(estrangeiro).toMatchObject({ proximaTentativa: espera, payload: escrita({ user_id: bia, id: "outra", reps: 7.5 }) });
    expect(await listar()).toEqual([]);
    expect(await bd().outbox.count()).toBe(4);
    expect(processar).toHaveBeenCalledOnce();
  });

  it("preserva lotes, outras linhas e campos de carga e exige uma resposta para cada contagem sem correção", async () => {
    const demais = { ...base, id: "vizinha", reps: 4, carga_kg: 23.5 };
    const invalida = { ...base, reps: 1.5, reps_lado2: 12.2, tempo_s: 40.4, tempo_s_lado2: 30.3,
      passos: 22.2, reps_alvo_min: 3.4, reps_alvo_max: 5.5 };
    const payload = { tabela: "session_sets", op: "upsert", onConflict: "id", linhas: [demais, invalida] };
    const id = await enfileirar(payload, { alvo: "sessions:lote" });
    const [pendente] = await listar();
    expect(pendente!.unilateral).toBe(true);
    expect(pendente!.campos).toHaveLength(7);
    expect(pendente!.campos.every(c => c.posterior === null)).toBe(true);
    const valores: Record<CampoContagem, number> = { reps: 0, reps_lado2: 12, tempo_s: 41, tempo_s_lado2: 32, passos: 22,
      reps_alvo_min: 3, reps_alvo_max: 5 };
    for (const erro of [{}, { ...valores, reps: 4.5 }, { ...valores, reps: -1 }, { ...valores, passos: MAX_CONTAGEM + 1 }]) {
      await expect(confirmarContagemPendente(ana, pendente!, erro)).rejects.toThrow("inteira");
      expect((await bd().outbox.get(id))?.payload).toEqual(payload);
    }
    await confirmarContagemPendente(ana, pendente!, valores);
    expect((await bd().outbox.get(id))?.payload).toEqual({ ...payload, linhas: [demais, { ...invalida, ...valores }] });
    expect(corrigirCopiasDaSerie).toHaveBeenCalledOnce();
  });

  it("omitir um campo conserva o inteiro posterior, mas apagar, trocar o movimento ou usar outra identidade não fornece uma correção", async () => {
    await enfileirar(escrita({ reps: 8.5, passos: 11.5, tempo_s: 13.5, reps_lado2: 3.5 }));
    await enfileirar(escrita({ reps: 9, passos: 12, tempo_s: 15 }));
    await enfileirar(escrita({ passos: null, exercise_id: "outro", tempo_s: 17 }));
    await enfileirar(escrita({ user_id: bia, reps_lado2: 4 }));
    await enfileirar(escrita({ session_id: "outro-treino", reps_lado2: 6 }));
    expect((await listar())[0]!.campos).toEqual([
      { campo: "reps", fracionario: 8.5, posterior: 9 }, { campo: "reps_lado2", fracionario: 3.5, posterior: null },
      { campo: "tempo_s", fracionario: 13.5, posterior: null }, { campo: "passos", fracionario: 11.5, posterior: null },
    ]);
  });

  it("rejeita edição atrasada, troca de conta e confirmação concorrente em duas abas", async () => {
    await enfileirar(escrita({ reps: 9.5 }));
    const [aberta] = await listar();
    await enfileirar(escrita({ reps: 12 }));
    await expect(confirmarContagemPendente(ana, aberta!, { reps: 10 })).rejects.toThrow("mudou");
    const [recente] = await listar();
    await expect(confirmarContagemPendente(bia, recente!, {})).rejects.toThrow("outra conta");
    vi.mocked(confirmarContaDoTreino).mockRejectedValueOnce(new Error("conta mudou"));
    await expect(confirmarContagemPendente(ana, recente!, {})).rejects.toThrow("conta mudou");
    const resultados = await Promise.allSettled([confirmarContagemPendente(ana, recente!, {}), confirmarContagemPendente(ana, recente!, {})]);
    expect(resultados.map(r => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(corrigirCopiasDaSerie).toHaveBeenCalledOnce();
    expect(await listar()).toEqual([]);
  });

  it("um backup parcial conserva a mudança de exercício anterior e não sugere para a remada o inteiro da flexão", async () => {
    await enfileirar(escrita({ reps: 9.5 }));
    await enfileirar(escrita({ exercise_id: "flexao", reps: 7 }));
    await enfileirar({ tabela: "session_sets", op: "upsert",
      linha: { id: base.id, user_id: ana, session_id: base.session_id, reps: 8 } });
    expect((await listar())[0]).toMatchObject({ exercicioId: "remada",
      campos: [{ campo: "reps", fracionario: 9.5, posterior: null }] });
  });

  it("duas correções de séries diferentes do mesmo lote preservam a edição do outro formulário", async () => {
    const outra = { ...base, id: "serie-b", reps: 5.5, carga_kg: 22.5 };
    const id = await enfileirar({ tabela: "session_sets", op: "upsert", linhas: [{ ...base, reps: 9.5 }, outra] });
    const [a, b] = await listar();
    await Promise.all([confirmarContagemPendente(ana, a!, { reps: 10 }), confirmarContagemPendente(ana, b!, { reps: 6 })]);
    expect((await bd().outbox.get(id))?.payload).toEqual({ tabela: "session_sets", op: "upsert",
      linhas: [{ ...base, reps: 10 }, { ...outra, reps: 6 }] });
  });

  it("revalida só depois de obter o mesmo lock usado pelo envio das séries", async () => {
    await enfileirar(escrita({ reps: 3.5 }));
    const [anterior] = await listar();
    const liberar = Promise.withResolvers<void>();
    const pedir = vi.fn(async (_nome: string, tarefa: () => Promise<void>) => { await liberar.promise; return tarefa(); });
    vi.stubGlobal("navigator", { onLine: false, locks: { request: pedir } });
    const confirmacao = confirmarContagemPendente(ana, anterior!, { reps: 4 });
    expect(pedir).toHaveBeenCalledWith("treino-terraco:outbox", expect.any(Function));
    await enfileirar(escrita({ reps: 5 }));
    liberar.resolve();
    await expect(confirmacao).rejects.toThrow("mudou");
    expect(corrigirCopiasDaSerie).not.toHaveBeenCalled();
  });

  it("uma falha ao gravar o último espelho reverte a fila e as duas cópias do aparelho", async () => {
    const chave = await enfileirar(escrita({ reps: 9.5 }), { erro: "anterior", tentativas: 11 });
    await bd().sessaoAtiva.put({ id: base.session_id, dados: { reps: 9.5 }, atualizadoEm: 1 });
    await bd().cache.put({ chave: "historico", valor: [9.5], atualizadoEm: 1 });
    vi.mocked(corrigirCopiasDaSerie).mockImplementationOnce(async () => {
      await bd().sessaoAtiva.update(base.session_id, { dados: { reps: 10 } });
      await bd().cache.update("historico", { valor: [10] });
      throw new Error("quota");
    });
    const [pendente] = await listar();
    await expect(confirmarContagemPendente(ana, pendente!, { reps: 10 })).rejects.toThrow("quota");
    expect((await bd().outbox.get(chave))).toMatchObject({ erro: "anterior", tentativas: 11, payload: escrita({ reps: 9.5 }) });
    expect((await bd().sessaoAtiva.get(base.session_id))?.dados).toEqual({ reps: 9.5 });
    expect((await bd().cache.get("historico"))?.valor).toEqual([9.5]);
    expect(processar).not.toHaveBeenCalled();
  });
});
