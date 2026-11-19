import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { montarSessao, escritasDasSeriesFeitas } from "@/lib/sessao";
import { finalizarSessao } from "@/lib/queries/sessao";
import { bd, type ItemSaida } from "@/lib/db";
import { corrigirCopiasDaSerie, reconciliarCopiasDaSerie, retirarSerieAusenteDasCopias } from "@/lib/espelhos-da-contagem";
import { processar } from "@/lib/outbox";
import { conferirSerieRemota } from "@/lib/recuperacao-de-serie-remota";
import { clienteNavegador } from "@/lib/supabase/client";
import { enviarItem } from "@/lib/outbox-supabase";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import {
  MAX_CONTAGEM, confirmarContagemPendente, listarContagensPendentes, listarConciliacoesDeContagem, resolverConciliacaoDeContagem, type CampoContagem,
} from "@/lib/contagens-pendentes";

vi.mock("@/lib/queries/conta-do-treino", () => ({ confirmarContaDoTreino: vi.fn() }));
vi.mock("@/lib/espelhos-da-contagem", () => ({ corrigirCopiasDaSerie: vi.fn(), reconciliarCopiasDaSerie: vi.fn(), retirarSerieAusenteDasCopias: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
vi.mock("@/lib/recuperacao-de-serie-remota", async original => ({ ...await original<typeof import("@/lib/recuperacao-de-serie-remota")>(), conferirSerieRemota: vi.fn() }));
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
  const id = await bd().outbox.add({ tipo: "serie", criadoEm: 2, proximaTentativa: espera, tentativas: 0,
    alvo: "sessions:treino-a", payload, ...outros });
  return id!;
}
const listar = () => listarContagensPendentes(ana);

beforeEach(async () => {
  await Promise.all([bd().outbox.clear(), bd().cache.clear(), bd().sessaoAtiva.clear()]);
  vi.clearAllMocks();
  vi.mocked(conferirSerieRemota).mockReset();
  vi.mocked(reconciliarCopiasDaSerie).mockReset().mockResolvedValue();
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
    expect(primeiro).toMatchObject({ id: a, alvo: "sessions:treino-a", tentativas: 0, payload: { operacaoGuardada: "upsert", linha: escrita({ reps: 10 }).linha } });
    expect(primeiro!.payload).not.toHaveProperty("op");
    expect(primeiro!.erro).toBeUndefined();
    expect(segundo!.payload).toMatchObject({ operacaoGuardada: "upsert", linha: escrita({ reps: 10 }).linha });
    expect(segundo!.payload).not.toHaveProperty("op");
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
    expect((await bd().outbox.get(id))?.payload).toMatchObject({ operacaoGuardada: "upsert", linhas: [demais, { ...invalida, ...valores }] });
    expect((await bd().outbox.get(id))?.payload).not.toHaveProperty("op");
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
    expect((await bd().outbox.get(id))?.payload).toMatchObject({ tabela: "session_sets", operacaoGuardada: "upsert",
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

describe("conciliação sem sobrescrever uma série mais recente", () => {
  const daFila = async (id: number) => (await bd().outbox.get(id))!;
  const conciliar = () => listarConciliacoesDeContagem(ana);

  it("congela o lote e a escrita válida do UUID, libera apenas suas linhas e preserva a edição posterior ao formulário", async () => {
    const linha = { ...base, reps: 9.5 };
    const outra = { ...base, id: "vizinha", reps: 4, carga_kg: 7.5 };
    const p = { tabela: "session_sets", op: "upsert", onConflict: "id", linhas: [outra, linha] };
    const lote = await enfileirar(p, { alvo: "sessions:lote" });
    const proxima = await enfileirar(escrita({ reps: 10 }));
    const [vista] = await listar();
    await confirmarContagemPendente(ana, vista!, {});
    expect((await daFila(lote)).payload).not.toHaveProperty("op");
    expect((await daFila(proxima)).payload).not.toHaveProperty("op");
    const posterior = await enfileirar(escrita({ reps: 11, carga_kg: 35.5 }));
    const canonica = { ...base, reps: 10, carga_kg: 33.5 };
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "confirmada", linha: canonica });
    expect(await enviarItem(await daFila(lote))).toBe("fila-reconciliada");
    expect(conferirSerieRemota).toHaveBeenCalledWith(ana, { ...base, reps: 10 }, ["reps"], undefined, undefined);
    expect((await daFila(lote)).payload).toEqual({ ...p, linhas: [outra] });
    expect(await daFila(proxima)).toBeUndefined();
    expect((await daFila(posterior)).payload).toEqual(escrita({ reps: 11, carga_kg: 35.5 }));
    expect(reconciliarCopiasDaSerie).toHaveBeenCalledWith(ana, { ...base, reps: 10 }, canonica, undefined);
    expect(await conciliar()).toEqual([]);
  });

  it("apresenta a contagem divergente, verifica a versão em cada escolha e conserva a decisão durante uma falha de rede", async () => {
    const id = await enfileirar(escrita({ reps: 9.5 }));
    const [vista] = await listar();
    await confirmarContagemPendente(ana, vista!, { reps: 10 });
    expect(await conciliar()).toMatchObject([{ estado: "aguardando", local: { reps: 10 }, remota: null }]);
    const remota = { ...base, reps: 15, carga_kg: 35.5 };
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "conflito", linha: remota });
    await expect(enviarItem(await daFila(id))).resolves.toBe("aguarda-conciliacao");
    const [primeira] = await conciliar();
    expect(primeira).toMatchObject({ estado: "conflito", mesmaIdentidade: true, remota, local: { reps: 10 }, campos: ["reps"] });
    await expect(enviarItem(await daFila(id))).resolves.toBe("aguarda-conciliacao");
    expect(conferirSerieRemota).toHaveBeenCalledTimes(1);
    await resolverConciliacaoDeContagem(ana, primeira!, "aparelho");
    await expect(resolverConciliacaoDeContagem(ana, primeira!, "historico")).rejects.toThrow("mudou");
    vi.mocked(conferirSerieRemota).mockRejectedValueOnce(new Error("sem rede"));
    await expect(enviarItem(await daFila(id))).rejects.toThrow("sem rede");
    const nova = { ...remota, reps: 16 };
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "conflito", linha: nova });
    await expect(enviarItem(await daFila(id))).resolves.toBe("aguarda-conciliacao");
    expect(conferirSerieRemota).toHaveBeenLastCalledWith(ana, { ...base, reps: 10 }, ["reps"], { usar: "aparelho", observada: remota },
      { confirmada: false, manterAusencia: false, insercao: { ...base, reps: 10 } });
    const [segunda] = await conciliar();
    expect(segunda!.remota).toEqual(nova);
    await expect(resolverConciliacaoDeContagem(ana, primeira!, "aparelho")).rejects.toThrow("mudou");
    await resolverConciliacaoDeContagem(ana, segunda!, "historico");
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "confirmada", linha: nova });
    vi.mocked(reconciliarCopiasDaSerie).mockRejectedValueOnce(new Error("quota"));
    await expect(enviarItem(await daFila(id))).rejects.toThrow("quota");
    expect((await daFila(id)).payload).not.toHaveProperty("op");
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "confirmada", linha: nova });
    await enviarItem(await daFila(id));
    expect(await daFila(id)).toBeUndefined();
    expect(await conciliar()).toEqual([]);
  });

  it("oferece manter o registro atribuído a outra sessão, recusa outra conta e conserva a medição explícita nula", async () => {
    const id = await enfileirar(escrita({ reps: 9.5, tempo_s: 12.5 }));
    await enfileirar(escrita({ reps: 10, tempo_s: null }));
    await confirmarContagemPendente(ana, (await listar())[0]!, { tempo_s: 12 });
    const remota = { ...base, session_id: "treino-b", exercise_id: "flexao", reps: 18, tempo_s: null };
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "conflito", linha: remota });
    await expect(enviarItem(await daFila(id))).resolves.toBe("aguarda-conciliacao");
    const [c] = await conciliar();
    expect(c).toMatchObject({ mesmaIdentidade: false, local: { tempo_s: null }, remota });
    await expect(resolverConciliacaoDeContagem(ana, c!, "aparelho")).rejects.toThrow("mudou");
    await expect(resolverConciliacaoDeContagem(bia, c!, "historico")).rejects.toThrow("mudou");
    expect(await listarConciliacoesDeContagem(bia)).toEqual([]);
    await resolverConciliacaoDeContagem(ana, c!, "historico");
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "confirmada", linha: { ...remota, user_id: bia } });
    await expect(enviarItem(await daFila(id))).rejects.toThrow("mudou");
    expect(await daFila(id)).toBeDefined();
  });

  it("captura reatribuição e backup parcial pelo mesmo UUID sem aplicar ao novo movimento a resposta da série antiga", async () => {
    const primeira = await enfileirar(escrita({ reps: 9.5 }));
    const mudou = { ...base, session_id: "treino-b", exercise_id: "flexao", reps: 12, carga_kg: 0 };
    const seg = await enfileirar({ tabela: "session_sets", op: "upsert", linhas: [mudou] }, { alvo: "sessions:lote" });
    const parcial = { user_id: ana, id: base.id, session_id: "treino-b", reps: 13 };
    const ter = await enfileirar({ tabela: "session_sets", op: "upsert", linha: parcial }, { alvo: "sessions:treino-b" });
    const [pendente] = await listar();
    expect(pendente).toMatchObject({ sessaoId: base.session_id, exercicioId: base.exercise_id, campos: [{ posterior: null }] });
    await confirmarContagemPendente(ana, pendente!, { reps: 9 });
    const [intencao] = await conciliar();
    expect(intencao!.local).toMatchObject({ ...mudou, reps: 13 });
    const historico = { ...mudou, reps: 15 };
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "conflito", linha: historico });
    await enviarItem(await daFila(primeira));
    const [vista] = await conciliar();
    expect(vista).toMatchObject({ mesmaIdentidade: false, remota: historico });
    await expect(resolverConciliacaoDeContagem(ana, vista!, "aparelho")).rejects.toThrow("mudou");
    await resolverConciliacaoDeContagem(ana, vista!, "historico");
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "confirmada", linha: historico });
    await enviarItem(await daFila(primeira));
    expect(await bd().outbox.bulkGet([primeira, seg, ter])).toEqual([undefined, undefined, undefined]);
  });

  it("encerrar o treino A ainda aberto não reenvia o UUID que o backup já transferiu para B", async () => {
    const espelhos = await vi.importActual<typeof import("@/lib/espelhos-da-contagem")>("@/lib/espelhos-da-contagem");
    vi.mocked(reconciliarCopiasDaSerie).mockImplementationOnce(espelhos.reconciliarCopiasDaSerie);
    const a = montarSessao({ id: base.session_id, userId: ana, data: "2026-11-19", treinoId: "A1", fase: "fase1",
      agora: "2026-11-19T12:30:00Z", novoId: () => crypto.randomUUID() });
    const bloco = a.blocos.find(b => b.series.filter(s => s.tipo === "trabalho").length >= 2)!;
    const [alvo, vizinha] = bloco.series.filter(s => s.tipo === "trabalho");
    Object.assign(alvo!, { concluida: true, reps: 9.5, cargaKg: 20.5, registradaEm: "2026-11-19T12:31:00Z" });
    Object.assign(vizinha!, { concluida: true, reps: 7, cargaKg: 25.5, registradaEm: "2026-11-19T12:32:00Z" });
    await bd().sessaoAtiva.put({ id: a.id, dados: a, atualizadoEm: 1 });
    const antiga = escritasDasSeriesFeitas(a).find(e => e.linha.id === alvo!.id)!;
    const captura = await enfileirar(antiga);
    const b = { ...antiga.linha, session_id: "treino-b", exercise_id: "flexao", reps: 14, carga_kg: 0 };
    await enfileirar({ tabela: "session_sets", op: "upsert", linhas: [b] }, { alvo: "sessions:lote" });
    await confirmarContagemPendente(ana, (await listar())[0]!, { reps: 9 });
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "confirmada", linha: b });
    expect(await enviarItem(await daFila(captura))).toBe("fila-reconciliada");
    expect(reconciliarCopiasDaSerie).toHaveBeenCalledWith(ana, b, b, antiga.linha);
    // O player tinha ambos os registros na memória. A conclusão normal precisa ler o snapshot reconciliado.
    await finalizarSessao({ sessao: a, status: "concluida", cliente: new QueryClient(), agora: "2026-11-19T12:45:00Z" });
    const paraEnviar = await bd().outbox.where("tipo").equals("serie").toArray();
    expect(paraEnviar.map(i => i.payload)).toMatchObject([{ linha: { id: vizinha!.id, session_id: a.id, reps: 7 } }]);
  });

  it.each([true, false])("diante de UUID ausente, requer decidir sobre o novo exercício sem herdar os valores do antigo (posição declarada: %s)", async posicao => {
    const captura = await enfileirar(escrita({ reps: 9.5, carga_kg: 20.5 }));
    const b = { id: base.id, user_id: ana, session_id: "treino-b", exercise_id: "flexao",
      ...(posicao ? { ordem_ex: 2, set_index: 1 } : {}) };
    await enfileirar({ tabela: "session_sets", op: "upsert", linhas: [b] }, { alvo: "sessions:lote" });
    await confirmarContagemPendente(ana, (await listar())[0]!, { reps: 8 });
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "confirmar-insercao", linha: b });
    expect(await enviarItem(await daFila(captura))).toBe("aguarda-conciliacao");
    expect(conferirSerieRemota).toHaveBeenLastCalledWith(ana, expect.objectContaining({ reps: 8 }), ["reps"],
      undefined, { insercao: b, confirmada: false, manterAusencia: false });
    const [vista] = await conciliar();
    expect(vista).toMatchObject({ estado: "ausente", remota: null, permiteCriar: posicao, insercao: b,
      origem: { exercise_id: base.exercise_id, reps: 9.5, carga_kg: 20.5 } });
    expect(vista!.insercao).not.toHaveProperty("reps");
    expect(vista!.insercao).not.toHaveProperty("carga_kg");
    if (!posicao) await expect(resolverConciliacaoDeContagem(ana, vista!, "criar")).rejects.toThrow("mudou");
    await resolverConciliacaoDeContagem(ana, vista!, posicao ? "criar" : "manter-ausencia");
    const canonica = { ...b, reps: null, carga_kg: null, concluida: false };
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce(posicao ? { estado: "confirmada", linha: canonica }
      : { estado: "ausencia-mantida", linha: b });
    expect(await enviarItem(await daFila(captura))).toBe("fila-reconciliada");
    expect(conferirSerieRemota).toHaveBeenLastCalledWith(ana, expect.anything(), ["reps"], undefined,
      { insercao: b, confirmada: posicao, manterAusencia: !posicao });
    if (posicao) expect(reconciliarCopiasDaSerie).toHaveBeenCalledWith(ana, expect.anything(), canonica, vista!.origem);
    else expect(retirarSerieAusenteDasCopias).toHaveBeenCalledWith(ana, expect.anything(), vista!.origem);
    expect(await bd().outbox.count()).toBe(0);
    expect(await conciliar()).toEqual([]);
  });

  it.each(["exercise_id", "ordem_ex", "set_index"])("atribuir %s a uma origem desconhecida exige consentimento e não reaproveita a carga antiga", async coluna => {
    const incompleta: Record<string, unknown> = { ...base, reps: 9.5, carga_kg: 20.5 };
    delete incompleta[coluna];
    const id = await enfileirar({ tabela: "session_sets", op: "upsert", linha: incompleta });
    const proposta = { id: base.id, user_id: ana, session_id: base.session_id, exercise_id: "remada",
      ordem_ex: 4, set_index: 2, tipo: "trabalho", concluida: true };
    await enfileirar({ tabela: "session_sets", op: "upsert", linhas: [proposta] }, { alvo: "sessions:lote" });
    const [vista] = await listar();
    await confirmarContagemPendente(ana, vista!, { reps: 8 });
    vi.mocked(conferirSerieRemota).mockResolvedValueOnce({ estado: "confirmar-insercao", linha: proposta });
    expect(await enviarItem(await daFila(id))).toBe("aguarda-conciliacao");
    expect(conferirSerieRemota).toHaveBeenCalledWith(ana, expect.objectContaining({ reps: 8, carga_kg: 20.5 }),
      ["reps"], undefined, { insercao: proposta, confirmada: false, manterAusencia: false });
    expect((await conciliar())[0]).toMatchObject({ estado: "ausente", permiteCriar: true, origem: incompleta, insercao: proposta });
    expect((await conciliar())[0]!.insercao).toEqual(proposta);
    expect(await bd().outbox.count()).toBe(2);
  });

  it("operação desconhecida ou metadado incompleto não acessam o cliente remoto", async () => {
    for (const p of [
      { tabela: "session_sets", op: "conciliar", filtro: { user_id: ana } },
      { tabela: "session_sets", operacaoGuardada: "upsert" },
      { tabela: "session_sets", operacaoGuardada: "upsert", seriesEmConciliacao: [] },
    ]) {
      const id = await enfileirar(p);
      await expect(enviarItem(await daFila(id))).rejects.toThrow("sem tabela");
    }
    expect(clienteNavegador).not.toHaveBeenCalled();
    expect(conferirSerieRemota).not.toHaveBeenCalled();
  });
});
