import { createClient, type Session } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { itensDeIds, planoDaSessao } from "@/lib/livre";
import { guardarNaFila, processar } from "@/lib/outbox";
import { vinculoDoLoginAtual } from "@/lib/player-sem-rede";
import type { SessaoBruta } from "@/lib/progresso";
import { chaveDoHistorico } from "@/lib/chaves-do-historico";
import { chaves } from "@/lib/queries/dados";
import { lerMotorParaRepetir } from "@/lib/queries/motor-repetir-treino";
import { abrirRepeticaoDoTreino } from "@/lib/queries/repetir-treino";
import {
  acrescentarExercicioNaSessao, confirmarMarcacaoDaSerie, criarSessaoLivre, descarregarSessao, enviarPlanoDaTroca, finalizarSessao,
  desfazerUltimaInclusaoNaSessao, enviarSerie, guardarDescansoDaSessao, guardarMaterialDaSessao,
  MENSAGEM_INCLUSAO_ALTERADA, salvarSessaoLocal,
} from "@/lib/queries/sessao";
import {
  atualizarSerie, definirEquipamentoDaSessao, definirFirme, definirNota, marcarSerie, substituirExercicio, type SessaoLocal,
} from "@/lib/sessao";
import { clienteNavegador } from "@/lib/supabase/client";
import type { LinhaPerfil } from "@/lib/types";

const locais = new Map<string, SessaoLocal>();
const consultasNoDisco = new Map<string, unknown>();
let anterior = Promise.resolve();
const put = vi.fn(async ({ id, dados }: { id: string; dados: SessaoLocal }) => locais.set(id, dados));
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true,
  lerCache: async (chave: string) => consultasNoDisco.get(chave) ?? null,
  bd: () => ({
    cache: { put: async ({ chave, valor }: { chave: string; valor: unknown }) => consultasNoDisco.set(chave, valor) },
    sessaoAtiva: {
      orderBy: () => ({ reverse: () => ({
        filter: (aceita: (item: { dados: SessaoLocal }) => boolean) => ({
          first: async () => [...locais.values()].reverse().map(dados => ({ dados })).find(aceita),
        }),
      }) }),
      put,
      get: async (id: string) => locais.has(id) ? { dados: locais.get(id) } : undefined,
      delete: async (id: string) => locais.delete(id),
    },
    outbox: {},
    transaction: (_modo: string, ...args: unknown[]) => {
      const operar = args.at(-1) as () => Promise<unknown>;
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
vi.mock("@/lib/outbox", () => ({ guardarNaFila: vi.fn(), processar: vi.fn(), esperarFila: async () => {} }));
vi.mock("@/lib/persistencia-query", () => ({ lerConsultaGuardada: async () => undefined, guardarConsultasAgora: async () => {} }));
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
  consultasNoDisco.clear();
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

  it("retoma offline um treino que só aparece no histórico da conta", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    cache.setQueryData(chaveDoHistorico("ana"), [{ ...modelo, id: "em-aberto", status: "em_andamento" }]);
    await expect(abrir()).resolves.toEqual({ id: "em-aberto", retomada: true });
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

describe("acrescentar ao treino livre que está no aparelho", () => {
  const rosca = "rosca-com-elastico";
  const remada = "remada-com-elastico";
  const iniciar = () => criarSessaoLivre({
    cliente: cache, userId: "ana", id: "aberta", data: hoje, fase: "fase1", exercicios: [rosca],
  });
  const incluir = (s: SessaoLocal, id: string) => acrescentarExercicioNaSessao(cache, s, id);
  const fechar = (s: SessaoLocal) => finalizarSessao({ sessao: s, status: "concluida", cliente: cache });

  it("serializa duas abas do mesmo aparelho, mantém os IDs e só enfileira os acréscimos distintos", async () => {
    const s = await iniciar();
    vi.stubGlobal("navigator", { onLine: false });
    const [primeira, segunda] = await Promise.all([incluir(s, remada), incluir(s, remada)]);
    expect(primeira.blocos[1]).toEqual(segunda.blocos[1]);
    await incluir(s, "prancha");
    expect(locais.get(s.id)!.blocos.map(b => b.exercicioId)).toEqual([rosca, remada, "prancha"]);
    expect(guardarNaFila).toHaveBeenCalledTimes(3);
    expect(guardarNaFila).toHaveBeenLastCalledWith("sessao", expect.objectContaining({
      op: "update", filtro: { id: s.id, user_id: "ana", status: "em_andamento" },
    }), "sessions:aberta");
    expect(lerMotorParaRepetir).toHaveBeenCalledWith(cache, "ana", [remada], expect.any(Function));
    expect(clienteNavegador().auth.getSession).not.toHaveBeenCalled();
  });

  it("desfaz uma única vez, com o plano e a fila no mesmo commit local, e recusa outro login", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const s = await iniciar();
    const comBloco = await incluir(s, remada);
    const token = comBloco.plano!.ultima_inclusao!.id;
    login = "bia";
    await expect(desfazerUltimaInclusaoNaSessao(comBloco, token)).rejects.toThrow("confirmar a conta");
    login = "ana";
    vi.mocked(guardarNaFila).mockRejectedValueOnce(new Error("quota"));
    await expect(desfazerUltimaInclusaoNaSessao(comBloco, token)).rejects.toThrow("quota");
    expect(locais.get(s.id)).toEqual(comBloco);
    vi.mocked(guardarNaFila).mockClear();
    const [primeira, repetida] = await Promise.all([desfazerUltimaInclusaoNaSessao(comBloco, token), desfazerUltimaInclusaoNaSessao(comBloco, token)]);
    expect(primeira).toEqual(repetida);
    expect(primeira.blocos).toEqual(s.blocos);
    expect(primeira.plano).toMatchObject({ itens: s.plano!.itens, ultima_inclusao: { id: token, estado: "desfeita" } });
    expect(guardarNaFila).toHaveBeenCalledTimes(1);
    expect(guardarNaFila).toHaveBeenCalledWith("sessao", expect.objectContaining({
      op: "update", filtro: { id: s.id, user_id: "ana", status: "em_andamento" }, linha: { plano: primeira.plano },
    }), "sessions:aberta");
  });

  it("não ressuscita o bloco desfeito em uma edição de outra série, troca, reconstrução ou conclusão antiga", async () => {
    const s = await iniciar();
    const comBloco = await incluir(s, remada);
    await desfazerUltimaInclusaoNaSessao(comBloco, comBloco.plano!.ultima_inclusao!.id);
    const antiga = definirNota(marcarSerie(comBloco, 1, comBloco.blocos[0]!.series[0]!.id, true), 1, "Fiz a série");
    salvarSessaoLocal(antiga, comBloco);
    await descarregarSessao();
    salvarSessaoLocal(comBloco); // reconstrução da rede que começou antes de desfazer
    await descarregarSessao();
    expect(locais.get(s.id)!.blocos).toEqual([antiga.blocos[0]]);
    await enviarPlanoDaTroca(comBloco);
    expect(guardarNaFila).toHaveBeenLastCalledWith("sessao", expect.objectContaining({
      linha: { plano: expect.objectContaining({ itens: s.plano!.itens, ultima_inclusao: expect.objectContaining({ estado: "desfeita" }) }) },
    }), "sessions:aberta");
    const fim = await fechar(antiga);
    expect(fim.resultados.some(r => r.exercicioId === remada)).toBe(false);
    expect(guardarNaFila).toHaveBeenCalledWith("serie", expect.objectContaining({ linha: expect.objectContaining({
      id: s.blocos[0]!.series[0]!.id, concluida: true,
    }) }), "sessions:aberta");
    expect(locais.get(s.id)).toBeUndefined();
    await expect(desfazerUltimaInclusaoNaSessao(comBloco, comBloco.plano!.ultima_inclusao!.id)).rejects.toThrow("não está aberta");
  });

  it("uma falha ao enfileirar a série mantém o visto e o desfazer no estado anterior", async () => {
    const aberta = await incluir(await iniciar(), remada);
    const bloco = aberta.blocos[1]!;
    const id = bloco.series[0]!.id;
    const fila = vi.mocked(guardarNaFila);
    fila.mockImplementation(async tipo => {
      if (tipo === "serie") throw new Error("quota");
    });
    await expect(confirmarMarcacaoDaSerie(aberta, bloco.ordem, id, true)).rejects.toThrow("quota");
    expect(locais.get(aberta.id)).toEqual(aberta);

    fila.mockReset();
    const salva = await confirmarMarcacaoDaSerie(aberta, bloco.ordem, id, true);
    expect(salva?.blocos[1]?.series[0]).toMatchObject({ id, concluida: true });
    expect(salva?.plano?.ultima_inclusao?.estado).toBe("iniciada");
    expect(locais.get(aberta.id)).toEqual(salva);
    expect(fila.mock.calls.filter(([tipo]) => tipo === "serie")).toHaveLength(1);
    expect(fila).toHaveBeenCalledWith("serie", expect.objectContaining({
      linha: expect.objectContaining({ id, session_id: aberta.id, exercise_id: remada, concluida: true }),
    }), "sessions:aberta");
  });

  it("duas abas marcam séries distintas do mesmo bloco a partir da mesma cópia", async () => {
    const aberta = await incluir(await iniciar(), remada);
    const bloco = aberta.blocos[1]!;
    const ids = bloco.series.slice(0, 2).map(s => s.id);
    expect(ids).toHaveLength(2);
    vi.mocked(guardarNaFila).mockClear();
    const resultados = await Promise.all(ids.map(id => confirmarMarcacaoDaSerie(aberta, bloco.ordem, id, true)));
    expect(resultados.every(Boolean)).toBe(true);
    expect(locais.get(aberta.id)?.blocos[1]?.series.filter(s => s.concluida).map(s => s.id)).toEqual(ids);
    const series = vi.mocked(guardarNaFila).mock.calls.filter(([tipo]) => tipo === "serie");
    expect(series).toHaveLength(2);
    for (const id of ids) {
      expect(series).toContainEqual(["serie", expect.objectContaining({
        linha: expect.objectContaining({ id, user_id: "ana", concluida: true }),
      }), "sessions:aberta"]);
    }
  });

  it("uma aba com o bloco antigo não envia sua série depois de desfazer e reincluir o mesmo exercício", async () => {
    const s = await iniciar();
    const adicionada = await incluir(s, remada);
    const token = adicionada.plano!.ultima_inclusao!.id;
    const desfeita = await desfazerUltimaInclusaoNaSessao(adicionada, token);
    const antiga = marcarSerie(adicionada, 2, adicionada.blocos[1]!.series[0]!.id, true);
    const bloco = antiga.blocos[1]!;
    salvarSessaoLocal(antiga, adicionada);
    expect(await enviarSerie(antiga, bloco, bloco.series[0]!)).toBe(false);
    const reincluida = await incluir(desfeita, remada);
    expect(reincluida.plano!.ultima_inclusao!.id).not.toBe(token);
    expect(reincluida.blocos[1]!.series[0]!.id).not.toBe(bloco.series[0]!.id);
    salvarSessaoLocal(antiga, adicionada);
    expect(await enviarSerie(antiga, bloco, bloco.series[0]!)).toBe(false);
    await expect(desfazerUltimaInclusaoNaSessao(adicionada, token)).rejects.toThrow(MENSAGEM_INCLUSAO_ALTERADA);
    expect(locais.get(s.id)).toEqual(reincluida);
    expect(guardarNaFila).not.toHaveBeenCalledWith("serie", expect.anything(), expect.anything());
  });

  it("conserva uma edição no bloco e uma marcação posteriormente desmarcada antes do desfazer de outra aba", async () => {
    const s = await iniciar();
    const adicionada = await incluir(s, remada);
    const token = adicionada.plano!.ultima_inclusao!.id;
    const editada = definirNota(adicionada, 2, "Ombros relaxados");
    salvarSessaoLocal(editada, adicionada);
    await expect(desfazerUltimaInclusaoNaSessao(adicionada, token)).rejects.toThrow(MENSAGEM_INCLUSAO_ALTERADA);
    expect(locais.get(s.id)!.blocos[1]!.nota).toBe("Ombros relaxados");
    const marcada = marcarSerie(editada, 2, editada.blocos[1]!.series[0]!.id, true);
    salvarSessaoLocal(marcada, editada);
    expect(await enviarSerie(marcada, marcada.blocos[1]!, marcada.blocos[1]!.series[0]!)).toBe(true);
    const desmarcada = marcarSerie(marcada, 2, marcada.blocos[1]!.series[0]!.id, false);
    salvarSessaoLocal(desmarcada, marcada);
    expect(await enviarSerie(desmarcada, desmarcada.blocos[1]!, desmarcada.blocos[1]!.series[0]!)).toBe(true);
    await expect(desfazerUltimaInclusaoNaSessao(adicionada, token)).rejects.toThrow(MENSAGEM_INCLUSAO_ALTERADA);
    expect(guardarNaFila).toHaveBeenCalledWith("sessao", expect.objectContaining({ linha: { plano: expect.objectContaining({
      ultima_inclusao: expect.objectContaining({ id: token, estado: "iniciada" }),
    }) } }), "sessions:aberta");
    expect(guardarNaFila).toHaveBeenLastCalledWith("serie", expect.objectContaining({ linha: expect.objectContaining({
      id: marcada.blocos[1]!.series[0]!.id, concluida: false,
    }) }), "sessions:aberta");
  });

  it("duas abas marcam séries diferentes do mesmo exercício e preservam nota, firme e carga ao reabrir", async () => {
    const s = await iniciar();
    const inicial = await incluir(s, remada);
    const [primeira, segunda] = inicial.blocos[1]!.series;
    const comCarga = atualizarSerie(inicial, 2, primeira!.id, { cargaKg: 19 });
    const primeiraFeita = definirNota(definirFirme(marcarSerie(comCarga, 2, primeira!.id, true), 2, true), 2, "Costas firmes");
    salvarSessaoLocal(primeiraFeita, inicial);
    await descarregarSessao();
    // Esta aba ainda mostra a primeira série pendente e sem nota.
    const segundaFeita = marcarSerie(inicial, 2, segunda!.id, true);
    salvarSessaoLocal(segundaFeita, inicial);
    expect(await enviarSerie(segundaFeita, segundaFeita.blocos[1]!, segundaFeita.blocos[1]!.series[1]!)).toBe(true);
    const reaberta = locais.get(s.id)!;
    expect(reaberta.blocos[1]).toMatchObject({ nota: "Costas firmes", ultimaFirme: true });
    expect(reaberta.blocos[1]!.series[0]).toMatchObject({ id: primeira!.id, cargaKg: 19, concluida: true });
    expect(reaberta.blocos[1]!.series[1]).toMatchObject({ id: segunda!.id, concluida: true });
    const corrigida = atualizarSerie(inicial, 2, primeira!.id, { reps: 14 });
    salvarSessaoLocal(corrigida, inicial);
    await descarregarSessao();
    expect(locais.get(s.id)!.blocos[1]!.series[0]).toMatchObject({ id: primeira!.id, cargaKg: 19, reps: 14, concluida: true });
    await expect(desfazerUltimaInclusaoNaSessao(inicial, inicial.plano!.ultima_inclusao!.id)).rejects.toThrow(MENSAGEM_INCLUSAO_ALTERADA);
  });

  it("recusa a troca que arquivaria um bloco anterior aos registros de outra aba e devolve o movimento real", async () => {
    const inicial = await incluir(await iniciar(), remada);
    const bloco = inicial.blocos[1]!;
    const marcada = marcarSerie(inicial, 2, bloco.series[0]!.id, true);
    const editada = definirNota(definirFirme(marcada, 2, false), 2, "Manter a faixa esticada");
    salvarSessaoLocal(editada, inicial);
    await descarregarSessao();
    const trocaAntiga = substituirExercicio(inicial, 2, "prancha");
    salvarSessaoLocal(trocaAntiga, inicial);
    const confirmada = await enviarPlanoDaTroca(trocaAntiga);
    expect(confirmada!.blocos[1]).toEqual(editada.blocos[1]);
    expect(locais.get(inicial.id)!.blocos[1]).toEqual(editada.blocos[1]);
    expect(guardarNaFila).toHaveBeenLastCalledWith("sessao", expect.objectContaining({
      linha: { plano: expect.not.objectContaining({ trocas: expect.anything() }) },
    }), "sessions:aberta");
    const novaTentativa = substituirExercicio(confirmada!, 2, "prancha");
    salvarSessaoLocal(novaTentativa, confirmada!);
    const salva = await enviarPlanoDaTroca(novaTentativa);
    expect(salva!.blocos[1]!.trocados![0]!).toMatchObject({
      exercicioId: remada, nota: "Manter a faixa esticada", ultimaFirme: false,
    });
    expect(salva!.blocos[1]!.trocados![0]!.series[0]).toMatchObject({ id: bloco.series[0]!.id, concluida: true });
  });

  it("preserva a troca e a restauração do movimento no bloco incluído com séries pendentes novas", async () => {
    const inicial = await incluir(await iniciar(), remada);
    const trocada = substituirExercicio(inicial, 2, "prancha");
    salvarSessaoLocal(trocada, inicial);
    await descarregarSessao();
    expect(locais.get(inicial.id)!.blocos[1]!.exercicioId).toBe("prancha");
    const restaurada = substituirExercicio(trocada, 2, remada);
    salvarSessaoLocal(restaurada, trocada);
    await enviarPlanoDaTroca(restaurada);
    expect(locais.get(inicial.id)!.blocos[1]).toEqual(restaurada.blocos[1]);
    expect(locais.get(inicial.id)!.plano!.ultima_inclusao!.estado).toBe("iniciada");
  });

  it("uma aba antiga marca, troca e encerra sem perder a progressão, as séries ou as notas do bloco acrescentado", async () => {
    const s = await iniciar();
    const nova = await incluir(s, remada);
    const bloco = nova.blocos[1]!;
    const serie = bloco.series[0]!;
    const comNota = definirNota(marcarSerie(nova, bloco.ordem, serie.id, true), bloco.ordem, "cotovelo junto");
    salvarSessaoLocal(comNota, nova);
    await guardarMaterialDaSessao(definirEquipamentoDaSessao(comNota, new Set(["tatame"])));
    await guardarDescansoDaSessao(comNota, remada, 95);

    const feita = marcarSerie(s, 1, s.blocos[0]!.series[0]!.id, true);
    const substituida = substituirExercicio(feita, 1, "flexao-de-braco");
    salvarSessaoLocal(substituida, s);
    await descarregarSessao();
    await enviarPlanoDaTroca(substituida);
    const salva = locais.get(s.id)!;
    expect(salva.blocos[1]).toEqual(comNota.blocos[1]);
    expect(salva.plano).toMatchObject({
      itens: [{ exercicio_id: rosca }, { exercicio_id: remada }],
      equipamento_disponivel: ["tatame"], descansos_por_exercicio: { [remada]: 95 },
    });
    const planoEnviado = expect.objectContaining({
      ...salva.plano, trocas: expect.objectContaining({ 1: expect.any(Array) }),
    });
    expect(guardarNaFila).toHaveBeenLastCalledWith("sessao", expect.objectContaining({ linha: { plano: planoEnviado } }), "sessions:aberta");

    const conclusao = await fechar(substituida);
    expect(conclusao.resultados.map(r => r.exercicioId)).toContain(remada);
    expect(guardarNaFila).toHaveBeenCalledWith("serie", expect.objectContaining({
      linha: expect.objectContaining({ id: serie.id, exercise_id: remada, concluida: true }),
    }), "sessions:aberta");
    expect(guardarNaFila).toHaveBeenCalledWith("sessao", expect.objectContaining({
      linha: expect.objectContaining({ status: "concluida", notas: expect.stringContaining("cotovelo junto"), plano: planoEnviado }),
    }), "sessions:aberta");
    expect(locais.size).toBe(0);
    await expect(incluir(s, "prancha")).rejects.toThrow("não está aberta");
  });

  it("o debounce de uma tela que acabou de adotar o novo bloco conserva a primeira edição nele", async () => {
    const s = await iniciar();
    const nova = await incluir(s, remada);
    // Uma escrita da tela antiga aguardava o debounce quando a lista cresceu.
    salvarSessaoLocal(definirNota(s, 1, "primeira"), s);
    const marcada = marcarSerie(nova, 2, nova.blocos[1]!.series[0]!.id, true);
    salvarSessaoLocal(definirNota(marcada, 1, "primeira"), nova);
    await descarregarSessao();
    expect(locais.get(s.id)!.blocos[0]!.nota).toBe("primeira");
    expect(locais.get(s.id)!.blocos[1]!.series[0]).toMatchObject({ id: nova.blocos[1]!.series[0]!.id, concluida: true });
  });

  it("reverte o acréscimo se a fila não couber, permitindo tentar com os registros anteriores preservados", async () => {
    const s = await iniciar();
    const serie = s.blocos[0]!.series[0]!;
    const feita = marcarSerie(s, 1, serie.id, true);
    salvarSessaoLocal(feita, s);
    vi.mocked(guardarNaFila).mockRejectedValueOnce(new Error("quota"));
    await expect(incluir(s, remada)).rejects.toThrow("quota");
    expect(locais.get(s.id)).toEqual(feita);
    const nova = await incluir(s, remada);
    expect(nova.blocos.map(b => b.exercicioId)).toEqual([rosca, remada]);
    expect(nova.blocos[0]).toEqual(feita.blocos[0]);
  });

  it("uma falha no debounce conserva a nota e a série até a confirmação do fechamento conseguir gravá-las", async () => {
    const s = await iniciar();
    const feita = marcarSerie(s, 1, s.blocos[0]!.series[0]!.id, true);
    const comNota = definirNota(feita, 1, "mesma carga");
    salvarSessaoLocal(comNota, s);
    put.mockRejectedValueOnce(new Error("quota"));
    await descarregarSessao();
    put.mockRejectedValueOnce(new Error("quota"));
    await expect(fechar(s)).rejects.toThrow("quota");
    expect(locais.get(s.id)).toEqual(s);
    expect(guardarNaFila).toHaveBeenCalledTimes(1);
    await fechar(s);
    expect(guardarNaFila).toHaveBeenCalledWith("sessao", expect.objectContaining({
      linha: expect.objectContaining({ status: "concluida", notas: expect.stringContaining("mesma carga") }),
    }), "sessions:aberta");
    expect(guardarNaFila).toHaveBeenCalledWith("serie", expect.objectContaining({
      linha: expect.objectContaining({ id: feita.blocos[0]!.series[0]!.id, concluida: true }),
    }), "sessions:aberta");
  });

  it("confere o material mais recente e permite repetir o toque em um exercício já incluído", async () => {
    const s = await iniciar();
    await incluir(s, remada);
    await guardarMaterialDaSessao(definirEquipamentoDaSessao(s, new Set(["tatame"])));
    const nAntes = vi.mocked(guardarNaFila).mock.calls.length;
    expect((await incluir(s, remada)).blocos).toHaveLength(2);
    await expect(incluir(s, "supino-reto-com-barra")).rejects.toThrow("equipamento");
    expect(guardarNaFila).toHaveBeenCalledTimes(nAntes);
  });

  it("se outra aba encerra durante a leitura da carga, ou o login muda, não recria a sessão", async () => {
    const s = await iniciar();
    vi.mocked(lerMotorParaRepetir).mockImplementationOnce(async () => { login = "bia"; return {}; });
    await expect(incluir(s, remada)).rejects.toThrow("confirmar a conta");
    expect(locais.get(s.id)).toEqual(s);
    login = "ana";
    vi.mocked(lerMotorParaRepetir).mockImplementationOnce(async () => { await fechar(s); return {}; });
    await expect(incluir(s, remada)).rejects.toThrow("não está aberta");
    expect(locais.size).toBe(0);
    expect(guardarNaFila).not.toHaveBeenCalledWith("sessao", expect.objectContaining({ op: "update" }), "sessions:aberta");
  });
});
