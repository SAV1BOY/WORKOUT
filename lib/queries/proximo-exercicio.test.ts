import "fake-indexeddb/auto";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bd } from "@/lib/db";
import { itensDeIds } from "@/lib/livre";
import { ordensDeExecucao } from "@/lib/ordem-da-sessao";
import { definirEnviador, processar } from "@/lib/outbox";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { estadoDoPasso, sequenciaDoPlayer } from "@/lib/player";
import { guardarOrdemLocal, ordensLocaisDaConta } from "./ordem-local-da-sessao";
import { vinculoDoLoginAtual } from "@/lib/player-sem-rede";
import { acrescentarExercicioNaSessao, definirNota, marcarSerie, substituirExercicio, type SessaoLocal } from "@/lib/sessao";
import { clienteNavegador } from "@/lib/supabase/client";
import {
  carregarSessaoLocal, comOrdemConfirmada, confirmarToquesPendentes, criarSessaoLivre, desfazerUltimaInclusaoNaSessao,
  enviarPlanoDaSessao, guardarProximoExercicio, salvarSessaoLocal, sessaoLocalMaisRecente, sincronizarNotaGeralDaSessao,
} from "./sessao";

vi.mock("@/lib/player-sem-rede", () => ({ vinculoDoLoginAtual: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));

const ids = ["pullover-com-halter", "agachamento-livre", "flexao-de-braco"];
const esperada = [ids[0], ids[2], ids[1]];
const conta = "ana";
const fila = () => bd().outbox.toArray();

async function abrir(exercicios = ids) {
  const itens = itensDeIds(exercicios);
  const criada = await criarSessaoLivre({
    id: "sessao", userId: conta, data: "2026-11-19", fase: "fase1", cliente: new QueryClient(), itens,
  });
  const passo = sequenciaDoPlayer(criada).find(p => p.tipo === "serie")!;
  const sessao = { ...criada, player: estadoDoPasso(passo, Date.now()) };
  salvarSessaoLocal(sessao, criada);
  await confirmarToquesPendentes(sessao);
  return sessao;
}

beforeEach(async () => {
  await bd().sessaoAtiva.clear();
  await bd().cache.clear();
  await bd().outbox.clear();
  vi.stubGlobal("navigator", { onLine: false });
  vi.mocked(vinculoDoLoginAtual).mockResolvedValue({ conta, url: "", chave: "", impressao: "" });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("guarda offline na transação da sessão e mantém a ordem do envio perante uma edição atrasada", async () => {
  const antes = await abrir();
  const { aplicada, sessao } = await guardarProximoExercicio(antes, 1, 3);
  expect(aplicada).toBe(true);
  expect(sessao?.ordemExecucao).toEqual(esperada);
  expect(sessao?.player).toEqual(antes.player);
  expect(sessao?.blocos).toEqual(antes.blocos);

  // Uma aba com os dados anteriores ainda pode anotar a série e enviar o plano.
  const anotada = definirNota(antes, 1, "Pegada confortável");
  salvarSessaoLocal(anotada, antes);
  await enviarPlanoDaSessao(anotada);
  const reaberta = await carregarSessaoLocal(antes.id);
  expect(reaberta?.ordemExecucao).toEqual(esperada);
  expect(reaberta?.plano?.ordem_execucao).toEqual(esperada);
  expect(reaberta?.blocos[0]?.nota).toBe("Pegada confortável");
  const saidas = await fila();
  expect(saidas.map(p => p.alvo)).toEqual(Array(3).fill("sessions:sessao"));
  expect(saidas[0]?.payload).toMatchObject({ op: "upsert" });
  expect(saidas[1]?.payload).toMatchObject({
    op: "update", filtro: { id: "sessao", user_id: conta, status: "em_andamento" },
    linha: { ordem_execucao: esperada, plano: { ordem_execucao: esperada } },
  });
  expect(saidas[2]?.payload).toMatchObject({ op: "update", linha: { plano: { ordem_execucao: esperada } } });
  expect(saidas[2]?.payload).not.toHaveProperty("linha.ordem_execucao");
  expect((await guardarProximoExercicio(antes, 1, 3)).aplicada).toBe(false);
  expect(await fila()).toHaveLength(3);
});

it.each(["fila", "ordem local"])("quota na %s desfaz a transação e deixa a nova tentativa criar um único PATCH", async local => {
  const antes = await abrir();
  const falha = new DOMException("Sem espaço", "QuotaExceededError");
  if (local === "fila") vi.spyOn(bd().outbox, "add").mockRejectedValueOnce(falha);
  else vi.spyOn(bd().cache, "put").mockRejectedValueOnce(falha);
  await expect(guardarProximoExercicio(antes, 1, 3)).rejects.toThrow("Sem espaço");
  expect(await carregarSessaoLocal(antes.id)).toEqual(antes);
  expect(await fila()).toHaveLength(1);
  expect((await guardarProximoExercicio(antes, 1, 3)).aplicada).toBe(true);
  expect(await fila()).toHaveLength(2);
});

it("se outra aba registra no bloco atravessado, devolve o registro atual e a ordem original", async () => {
  const antes = await abrir();
  const serie = antes.blocos[1]!.series[0]!;
  const feita = marcarSerie(antes, 2, serie.id, true);
  salvarSessaoLocal(feita, antes);
  const resultado = await guardarProximoExercicio(antes, 1, 3);
  expect(resultado.aplicada).toBe(false);
  expect(resultado.sessao?.blocos[1]?.series[0]).toMatchObject({ id: serie.id, concluida: true });
  expect(await carregarSessaoLocal(antes.id)).toEqual(feita);
  expect(await fila()).toHaveLength(1);
});

it("desfazer e reincluir o mesmo movimento invalida o slot escolhido na aba antiga", async () => {
  const antes = await abrir(ids.slice(0, 2));
  const acrescentar = (sessao: SessaoLocal) => acrescentarExercicioNaSessao(sessao, ids[2]!, { novoId: () => crypto.randomUUID() });
  const primeira = acrescentar(antes);
  await bd().sessaoAtiva.put({ id: antes.id, dados: primeira, atualizadoEm: Date.now() });
  const removida = await desfazerUltimaInclusaoNaSessao(primeira, primeira.plano!.ultima_inclusao!.id);
  const segunda = acrescentar(removida);
  await bd().sessaoAtiva.put({ id: antes.id, dados: segunda, atualizadoEm: Date.now() });
  const recusada = await guardarProximoExercicio(primeira, 1, 3);
  expect(recusada.aplicada).toBe(false);
  expect(recusada.sessao?.blocos[2]?.series[0]?.id).toBe(segunda.blocos[2]!.series[0]!.id);
  const aceita = await guardarProximoExercicio(segunda, 1, 3);
  expect(aceita.aplicada).toBe(true);
  expect(aceita.sessao?.ordemExecucao?.[1]).toBe("inclusao:" + segunda.plano!.ultima_inclusao!.id);
});

it("recupera a ordem da conta no GET da nota, sem substituir a escolha ainda na fila", async () => {
  const antes = await abrir();
  await guardarProximoExercicio(antes, 1, 3);
  const campos: string[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async url => {
    const params = new URL(String(url)).searchParams;
    campos.push(params.get("select")!);
    expect(params.get("user_id")).toBe("eq.ana");
    return Response.json([{ nota_geral: "Treino cedo", ordem_execucao: [] }]);
  });
  vi.mocked(clienteNavegador).mockReturnValue(createClient("http://localhost", "mock-anon", { global: { fetch } }));
  vi.stubGlobal("navigator", { onLine: true });
  expect((await sincronizarNotaGeralDaSessao(antes))?.ordemExecucao).toEqual(esperada);
  await bd().outbox.clear();
  expect((await sincronizarNotaGeralDaSessao(antes))?.ordemExecucao).toEqual([]);
  expect(campos).toEqual(["nota_geral", "nota_geral,ordem_execucao"]);
  expect((await carregarSessaoLocal(antes.id))?.notaGeral).toBe("Treino cedo");
  expect(await fila()).toHaveLength(0);
});

it("descarta a escolha se o avanço automático vencer enquanto a fila está sendo gravada", async () => {
  const inicio = Date.now();
  const antes = await abrir();
  const intervalo = sequenciaDoPlayer(antes).find(p => p.tipo === "descanso" && p.entreExercicios)!;
  const player = estadoDoPasso(intervalo, inicio);
  const pausada = { ...antes, player };
  salvarSessaoLocal(pausada, antes);
  await confirmarToquesPendentes(pausada);
  const agora = vi.spyOn(Date, "now").mockReturnValue(inicio);
  const vencer = () => { agora.mockReturnValue(player.fimEm!); };
  bd().outbox.hook("creating", vencer);
  try {
    const resultado = await guardarProximoExercicio(pausada, 1, 3, true);
    expect(resultado).toEqual({ aplicada: false, sessao: pausada });
    expect(await fila()).toHaveLength(1);
  } finally {
    bd().outbox.hook("creating").unsubscribe(vencer);
  }
  // Quem avança manualmente continua no mesmo descanso e pode escolher.
  expect((await guardarProximoExercicio(pausada, 1, 3, false)).aplicada).toBe(true);
});

it("uma resposta remota iniciada antes de duas mudanças locais não volta à escolha vencida", async () => {
  const antes = await abrir();
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    const primeira = await guardarProximoExercicio(antes, 1, 3);
    const segunda = await guardarProximoExercicio(primeira.sessao!, 1, 2);
    expect(segunda.sessao?.ordemExecucao).toEqual(ids);
    // A fila já subiu antes de a resposta da leitura antiga chegar.
    await bd().outbox.clear();
    return Response.json([{ nota_geral: "Anotação remota", ordem_execucao: esperada }]);
  });
  vi.mocked(clienteNavegador).mockReturnValue(createClient("http://localhost", "mock-anon", { global: { fetch } }));
  vi.stubGlobal("navigator", { onLine: true });
  const atual = await sincronizarNotaGeralDaSessao(antes);
  expect(atual?.ordemExecucao).toEqual(ids);
  expect(atual?.notaGeral).toBe("Anotação remota");
  expect((await carregarSessaoLocal(antes.id))?.ordemExecucao).toEqual(ids);
});

it("a resposta anterior à edição do #58 preserva a ordem do espelho e recebe a nota geral do servidor", async () => {
  const antes = await abrir();
  let remota = [...ids];
  definirEnviador(async item => {
    const ordem = (item.payload as EscritaTabela).linha?.ordem_execucao;
    if (Array.isArray(ordem)) remota = [...ordem];
  });
  const fetch = vi.fn<typeof globalThis.fetch>(async () => {
    const lidaAntesDaEscolha = [...remota];
    const escolha = await guardarProximoExercicio(antes, 1, 3);
    await processar();
    await vi.waitFor(async () => expect(await fila()).toHaveLength(0));
    expect(remota).toEqual(esperada);

    // O #58 regrava o retrato da sua aba com os campos que conhecia e o plano lido do disco.
    const legado = { ...definirNota(antes, 1, "Pegada confortável"), plano: escolha.sessao!.plano };
    expect(legado).not.toHaveProperty("revisaoOrdemExecucao");
    expect(legado).not.toHaveProperty("ordemExecucao");
    await bd().sessaoAtiva.put({ id: antes.id, dados: legado, atualizadoEm: Date.now() });
    return Response.json([{ nota_geral: "Da rede", ordem_execucao: lidaAntesDaEscolha }]);
  });
  vi.mocked(clienteNavegador).mockReturnValue(createClient("http://localhost", "mock-anon", { global: { fetch } }));
  vi.stubGlobal("navigator", { onLine: true });
  const confirmada = await sincronizarNotaGeralDaSessao(antes);
  expect(confirmada?.notaGeral).toBe("Da rede");
  expect(confirmada?.blocos[0]?.nota).toBe("Pegada confortável");
  expect(comOrdemConfirmada(antes, confirmada!).ordemExecucao).toEqual(esperada);

  const reaberta = await carregarSessaoLocal(antes.id);
  expect(ordensDeExecucao(reaberta?.plano, reaberta?.ordemExecucao)).toEqual([1, 3, 2]);
  expect(remota).toEqual(esperada);
  expect(await fila()).toHaveLength(0);
});

it.each([false, true])("recupera a próxima inclusão após o #58 substituí-la sem espelho (envio confirmado %s)", async confirmada => {
  const inicial = await abrir(ids.slice(0, 2));
  const antes = acrescentarExercicioNaSessao(inicial, ids[2]!, { novoId: () => crypto.randomUUID() });
  await bd().sessaoAtiva.put({ id: antes.id, dados: antes, atualizadoEm: Date.now() });
  const { sessao: escolha } = await guardarProximoExercicio(antes, 1, 3);
  expect(escolha?.ordemExecucao?.[1]).toBe("inclusao:" + antes.plano!.ultima_inclusao!.id);
  if (confirmada) {
    definirEnviador(async () => {});
    vi.stubGlobal("navigator", { onLine: true });
    await processar();
    await vi.waitFor(async () => expect(await fila()).toHaveLength(0));
    vi.stubGlobal("navigator", { onLine: false });
  }
  // Uma aba do #58 regravava a inclusão como iniciada, omitindo a sequência no plano e no snapshot.
  const substituida = substituirExercicio(antes, 3, "supino-reto-com-barra");
  expect(substituida.plano?.ultima_inclusao?.estado).toBe("iniciada");
  expect(substituida.plano?.ordem_execucao).toBeUndefined();
  await bd().sessaoAtiva.put({ id: antes.id, dados: substituida, atualizadoEm: Date.now() });

  bd().close();
  await bd().open();
  const lida = await carregarSessaoLocal(antes.id);
  expect(lida?.ordemExecucao).toEqual(escolha!.ordemExecucao);
  expect(lida?.plano?.ordem_execucao).toEqual(escolha!.ordemExecucao);
  expect(lida?.blocos[2]).toEqual(substituida.blocos[2]);
  expect(ordensDeExecucao(lida?.plano, lida?.ordemExecucao)).toEqual([1, 3, 2]);
  expect(await sessaoLocalMaisRecente(conta)).toEqual(lida);

  const outra = { ...substituida, userId: "bia" };
  await bd().sessaoAtiva.put({ id: antes.id, dados: outra, atualizadoEm: Date.now() });
  expect(await carregarSessaoLocal(antes.id)).toEqual(outra);
});

it("lê as ordens válidas da conta, inclusive o padrão explícito, sem incluir outra conta de nome parecido", async () => {
  const sessao = await abrir();
  await guardarOrdemLocal({ ...sessao, id: "uma", ordemExecucao: esperada });
  await guardarOrdemLocal({ ...sessao, id: "padrao", ordemExecucao: [] });
  await guardarOrdemLocal({ ...sessao, userId: "ana:teste", id: "outra", ordemExecucao: ids });
  await bd().cache.bulkPut([
    { chave: "ordem-execucao-sessao:ana:invalida", valor: { ordem: ["pullover", 3] }, atualizadoEm: 1 },
    { chave: "ordem-execucao-sessao:ana:", valor: { ordem: ids }, atualizadoEm: 1 },
  ]);
  expect(await ordensLocaisDaConta(conta)).toEqual(new Map([["uma", esperada], ["padrao", []]]));
  expect(await ordensLocaisDaConta("ana:teste")).toEqual(new Map([["outra", ids]]));
});
