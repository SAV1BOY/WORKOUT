import "fake-indexeddb/auto";
import { createClient, type Session } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bd, guardarCache } from "@/lib/db";
import { ajustesDoModeloConfirmados, modeloCompativelComCatalogo, modeloDeTreinoValido } from "@/lib/modelo-de-treino";
import { definirEnviador, guardarNaFila, processar, tentarAgora } from "@/lib/outbox";
import { enviarItem, type EscritaTabela } from "@/lib/outbox-supabase";
import { clienteNavegador } from "@/lib/supabase/client";
import { chaveDosModelos, excluirModeloDeTreino, lerModelosDeTreino, salvarModeloDeTreino, type ModeloDeTreino } from "./modelos-de-treino";

vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));

const banco = bd();
const modelo: ModeloDeTreino = {
  user_id: "ana", id: "00000000-0000-4000-8000-000000000001", nome: "Força no terraço",
  exercicios: ["flexao-de-braco", "escalador"], equipamento_disponivel: null,
};
const vizinho = { ...modelo, id: "00000000-0000-4000-8000-000000000002", nome: "Treino B" };
const novoCliente = () => new QueryClient();
const ler = (conta = "ana") => lerModelosDeTreino(novoCliente(), conta);
const rede = (onLine: boolean) => vi.stubGlobal("navigator", { onLine });

function usarServidor(fetch: typeof globalThis.fetch, login = "ana") {
  const client = createClient("https://supabase.test", "anon", { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch } });
  vi.spyOn(client.auth, "getSession").mockResolvedValue({ data: { session: { user: { id: login } } as Session }, error: null });
  vi.mocked(clienteNavegador).mockReturnValue(client);
}

function pagina(linhas: ModeloDeTreino[], total = linhas.length) {
  return Response.json(linhas, { headers: { "Content-Range": `*/${total}` } });
}

beforeEach(async () => {
  await Promise.all([banco.cache.clear(), banco.outbox.clear()]);
  rede(false);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("cria e edita na ordem escolhida, separa donos e confirma a exclusão enquanto o celular está offline", async () => {
  const cliente = novoCliente();
  expect(await ler()).toEqual([]);
  await Promise.all([
    salvarModeloDeTreino(cliente, { ...modelo, nome: `  ${modelo.nome}  ` }),
    salvarModeloDeTreino(novoCliente(), vizinho),
    salvarModeloDeTreino(novoCliente(), { ...modelo, user_id: "bia" }),
  ]);
  expect(await ler()).toEqual(expect.arrayContaining([modelo, vizinho]));
  const editado = { ...modelo, nome: "Só corpo", exercicios: [...modelo.exercicios].reverse(), equipamento_disponivel: [] };
  await salvarModeloDeTreino(cliente, editado);
  await excluirModeloDeTreino(cliente, "ana", vizinho.id);
  expect(cliente.getQueryData(chaveDosModelos("ana"))).toEqual([editado]);
  const fila = await banco.outbox.toArray();
  expect(fila).toHaveLength(5);
  expect(new Set(fila.map(i => i.alvo))).toEqual(new Set([`modelos_de_treino:ana:${modelo.id}`, `modelos_de_treino:bia:${modelo.id}`, `modelos_de_treino:ana:${vizinho.id}`]));
  expect(fila.at(-2)?.payload).toEqual({ tabela: "modelos_de_treino", op: "upsert", linha: editado, onConflict: "user_id,id" });
  expect(fila.at(-1)?.payload).toEqual({ tabela: "modelos_de_treino", removerModelo: true, filtro: { id: vizinho.id, user_id: "ana" } });
  await banco.outbox.clear();
  expect(await ler()).toEqual([editado]);
  expect(await ler("bia")).toEqual([{ ...modelo, user_id: "bia" }]);
  expect(await banco.sessaoAtiva.count()).toBe(0);
  expect(clienteNavegador).not.toHaveBeenCalled();
});

it("quota esgotada aborta a fila e conserva o modelo existente no disco e na tela", async () => {
  const cliente = novoCliente();
  await salvarModeloDeTreino(cliente, modelo);
  vi.spyOn(banco.cache, "put").mockRejectedValueOnce(new Error("Quota esgotada"));
  await expect(excluirModeloDeTreino(cliente, "ana", modelo.id)).rejects.toThrow("Quota");
  expect(await banco.outbox.count()).toBe(1);
  expect(await ler()).toEqual([modelo]);
  expect(cliente.getQueryData(chaveDosModelos("ana"))).toEqual([modelo]);
});

it("rejeita nomes vazios ou longos, material desconhecido e sequências repetidas, vazias ou fora do catálogo", async () => {
  for (const campos of [{ nome: "  " }, { nome: "é".repeat(81) }, { exercicios: [] }, { exercicios: ["escalador", "escalador"] },
    { exercicios: ["ficha-antiga-inexistente"] }, { equipamento_disponivel: ["inexistente"] }, { equipamento_disponivel: ["banco", "banco"] }]) {
    await expect(salvarModeloDeTreino(novoCliente(), { ...modelo, ...campos } as ModeloDeTreino)).rejects.toThrow();
  }
  expect(await banco.outbox.count()).toBe(0);
  await salvarModeloDeTreino(novoCliente(), { ...modelo, nome: "💪".repeat(80) });
  expect(await banco.outbox.count()).toBe(1);
});

it("preserva um envio anterior ao GET e duas alterações de outra aba mesmo após a fila esvaziar", async () => {
  const editado = { ...modelo, nome: "Versão nova" };
  await salvarModeloDeTreino(novoCliente(), vizinho);
  const entrou = Promise.withResolvers<void>();
  const resposta = Promise.withResolvers<Response>();
  rede(true);
  usarServidor(async () => { entrou.resolve(); return resposta.promise; });
  const leitura = ler();
  await entrou.promise;
  const removido = { ...modelo, id: "00000000-0000-4000-8000-000000000003" };
  const remoto = { ...vizinho, id: "00000000-0000-4000-8000-000000000004" };
  await salvarModeloDeTreino(novoCliente(), editado);
  await excluirModeloDeTreino(novoCliente(), "ana", removido.id);
  await banco.outbox.clear();
  resposta.resolve(pagina([modelo, removido, remoto]));
  expect(await leitura).toEqual(expect.arrayContaining([editado, vizinho, remoto]));
  rede(false);
  const guardados = await ler();
  expect(guardados).toHaveLength(3);
  expect(guardados.map(m => m.id)).not.toContain(removido.id);
});

it("um GET mais antigo não repõe o modelo removido em outro aparelho depois que a segunda aba confirmou a ausência", async () => {
  rede(true);
  const entrou = Promise.withResolvers<void>();
  const resposta = Promise.withResolvers<Response>();
  usarServidor(async () => { entrou.resolve(); return resposta.promise; });
  const antiga = ler();
  await entrou.promise;
  usarServidor(async () => pagina([vizinho]));
  expect(await ler()).toEqual([vizinho]);
  resposta.resolve(pagina([modelo]));
  expect(await antiga).toEqual([vizinho]);
  rede(false);
  expect(await ler()).toEqual([vizinho]);
});

it("falha de transporte usa a cópia, backup exige rede e erros de permissão ou dono não apagam o disco", async () => {
  rede(true);
  usarServidor(async () => pagina([modelo]));
  expect(await ler()).toEqual([modelo]);
  // O cliente PostgREST informa status zero quando o transporte foi interrompido.
  usarServidor(async () => { throw new DOMException("Sem conexão", "AbortError"); });
  expect(await ler()).toEqual([modelo]);
  await expect(lerModelosDeTreino(novoCliente(), "ana", undefined, true)).rejects.toThrow();
  usarServidor(async () => Response.json({ message: "Acesso recusado" }, { status: 403 }));
  await expect(ler()).rejects.toThrow("Acesso recusado");
  usarServidor(async () => pagina([{ ...modelo, user_id: "bia" }]));
  await expect(ler()).rejects.toThrow("conta");
  rede(false);
  expect(await ler()).toEqual([modelo]);
});

it("mostra um modelo de catálogo novo ao lado dos compatíveis e conserva os IDs ao reabrir offline", async () => {
  rede(true);
  const futuro = { ...vizinho, exercicios: ["levantamento-futuro", "escalador"], equipamento_disponivel: ["anel-futuro", "banco"] };
  usarServidor(async () => pagina([modelo, futuro]));
  expect(await ler()).toEqual([modelo, futuro]);
  rede(false);
  const reabertos = await ler();
  expect(reabertos).toEqual([modelo, futuro]);
  expect(reabertos.map(modeloCompativelComCatalogo)).toEqual([true, false]);
  expect(modeloCompativelComCatalogo({ ...futuro, exercicios: modelo.exercicios })).toBe(false);
  expect(modeloCompativelComCatalogo({ ...futuro, equipamento_disponivel: [] })).toBe(false);
  expect(await banco.sessaoAtiva.count()).toBe(0);
});

it("percorre até a última página sem misturar contas quando o servidor limita a resposta", async () => {
  rede(true);
  const linhas = Array.from({ length: 1001 }, (_, n) => ({ ...modelo, id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` }));
  const pedidos: (string | null)[] = [];
  usarServidor(async entrada => {
    const params = new URL(String(entrada)).searchParams;
    expect(params.get("user_id")).toBe("eq.ana");
    expect(params.get("order")).toBe("id.asc");
    pedidos.push(params.get("id"));
    if (pedidos.length === 1) return pagina(linhas.slice(0, 1000), 1001);
    return pagina(pedidos.length === 2 ? linhas.slice(1000) : [], 1001);
  });
  expect(await ler()).toEqual(linhas);
  expect(pedidos).toEqual([null, `gt.${linhas[999]!.id}`, `gt.${linhas[1000]!.id}`]);
});

it("conserva os dois mapas ao renomear e poda as chaves retiradas antes de recolocar um exercício", async () => {
  const cliente = novoCliente();
  const ajustado = { ...modelo, series_por_exercicio: { escalador: 1, "flexao-de-braco": 10 },
    descansos_por_exercicio: { escalador: 5, "flexao-de-braco": 900 } };
  await salvarModeloDeTreino(cliente, ajustado);
  const nomeNovo = { ...modelo, nome: "Terça" };
  expect(await salvarModeloDeTreino(cliente, nomeNovo)).toEqual({ ...ajustado, nome: nomeNovo.nome });
  const [criacao, mudancaDeNome] = await banco.outbox.toArray();
  expect((criacao!.payload as EscritaTabela).linha).toEqual(ajustado);
  expect((mudancaDeNome!.payload as EscritaTabela).linha).toEqual(nomeNovo);
  await banco.outbox.clear();
  expect(await ler()).toEqual([{ ...ajustado, nome: nomeNovo.nome }]);
  await salvarModeloDeTreino(cliente, { ...modelo, exercicios: ["escalador"] });
  const podado = { ...modelo, series_por_exercicio: { escalador: 1 }, descansos_por_exercicio: { escalador: 5 } };
  expect(await salvarModeloDeTreino(cliente, modelo)).toEqual(podado);
  for (const limpa of [{}, null]) {
    await salvarModeloDeTreino(cliente, podado);
    expect(await salvarModeloDeTreino(cliente, { ...modelo, series_por_exercicio: limpa })).toEqual({
      ...podado, series_por_exercicio: limpa,
    });
    await salvarModeloDeTreino(cliente, { ...modelo, descansos_por_exercicio: limpa });
    const escritas = (await banco.outbox.toArray()).slice(-2).map(item => (item.payload as EscritaTabela).linha);
    expect(escritas).toEqual([{ ...modelo, series_por_exercicio: limpa }, { ...modelo, descansos_por_exercicio: limpa }]);
    const reabertos = await ler();
    expect(reabertos).toEqual([{ ...modelo, series_por_exercicio: limpa, descansos_por_exercicio: limpa }]);
    expect(ajustesDoModeloConfirmados(reabertos[0]!)).toBe(true);
  }
});

it("confere a projeção antiga com a rede e reaplica a fila #62 mesmo quando o exercício foi retirado e recolocado", async () => {
  const disco = JSON.stringify(chaveDosModelos("ana"));
  await guardarCache(disco, { modelos: [modelo], revisoes: { [modelo.id]: 3 } });
  for (const exercicios of [["escalador"], modelo.exercicios]) {
    const linha = { ...modelo, exercicios };
    await guardarNaFila("modelo_de_treino", { tabela: "modelos_de_treino", op: "upsert", linha, onConflict: "user_id,id" },
      `modelos_de_treino:ana:${modelo.id}`);
  }
  expect((await ler())[0]).not.toHaveProperty("series_por_exercicio");
  const remota = { ...modelo, series_por_exercicio: { "flexao-de-braco": 9, escalador: 4 },
    descansos_por_exercicio: { "flexao-de-braco": 180, escalador: 45 } };
  rede(true);
  usarServidor(async entrada => {
    expect(new URL(String(entrada)).searchParams.get("select")?.split(",")).toEqual(expect.arrayContaining(["series_por_exercicio", "descansos_por_exercicio"]));
    return pagina([remota]);
  });
  const esperada = { ...modelo, series_por_exercicio: { escalador: 4 }, descansos_por_exercicio: { escalador: 45 } };
  expect(await ler()).toEqual([esperada]);
  await banco.outbox.clear();
  rede(false);
  expect(await ler()).toEqual([esperada]);
  expect(await ler("bia")).toEqual([]);
});

it("recupera offline uma contagem explícita que está na fila quando a cópia foi sobrescrita por #62", async () => {
  const cliente = novoCliente();
  await salvarModeloDeTreino(cliente, { ...modelo, series_por_exercicio: { escalador: 6 } });
  const nomeNovo = { ...modelo, nome: "Nome da aba anterior" };
  await guardarCache(JSON.stringify(chaveDosModelos("ana")), { modelos: [nomeNovo], revisoes: { [modelo.id]: 2 } });
  await guardarNaFila("modelo_de_treino", { tabela: "modelos_de_treino", op: "upsert", linha: nomeNovo, onConflict: "user_id,id" });
  expect(await ler()).toEqual([{ ...nomeNovo, series_por_exercicio: { escalador: 6 } }]);
  await banco.outbox.clear();
  // Sem confirmação de seis colunas nem uma escrita explícita, a cópia #62 continua parcial.
  expect(await ler()).toEqual([nomeNovo]);
  rede(true);
  usarServidor(async () => pagina([{ ...nomeNovo, series_por_exercicio: null }]));
  expect(await ler()).toEqual([{ ...nomeNovo, series_por_exercicio: null }]);
});

it("recupera o descanso da fila pelo dono após uma leitura #63 e confirma uma projeção parcial quando a rede volta", async () => {
  const ana = { ...modelo, series_por_exercicio: { escalador: 6 }, descansos_por_exercicio: { escalador: 90, "flexao-de-braco": 45 } };
  const bia = { ...ana, user_id: "bia", descansos_por_exercicio: { escalador: 55 } };
  await salvarModeloDeTreino(novoCliente(), ana);
  await salvarModeloDeTreino(novoCliente(), bia);
  const legado = { ...modelo, nome: "Salvo com #63", series_por_exercicio: { escalador: 2 } };
  for (const exercicios of [["escalador"], modelo.exercicios]) {
    const linha = { ...legado, exercicios };
    await guardarNaFila("modelo_de_treino", { tabela: "modelos_de_treino", op: "upsert", linha, onConflict: "user_id,id" });
  }
  await guardarCache(JSON.stringify(chaveDosModelos("ana")), { modelos: [legado], revisoes: { [modelo.id]: 3 } });
  expect(await ler()).toEqual([{ ...legado, descansos_por_exercicio: { escalador: 90 } }]);
  expect(await ler("bia")).toEqual([bia]);
  await banco.outbox.clear();
  expect(await ler()).toEqual([legado]);
  expect(ajustesDoModeloConfirmados(legado)).toBe(false);
  expect(ajustesDoModeloConfirmados({ ...modelo, descansos_por_exercicio: {} })).toBe(false);

  rede(true);
  const padrao = { ...legado, descansos_por_exercicio: null };
  const busca = vi.fn(async () => pagina([padrao]));
  usarServidor(busca);
  expect(await ler()).toEqual([padrao]);
  expect(busca).toHaveBeenCalledTimes(1);
  rede(false);
  expect(ajustesDoModeloConfirmados((await ler())[0]!)).toBe(true);
  expect(await ler("bia")).toEqual([bia]);
});

it("uma exclusão anterior à recriação pela versão #63 comprova que o descanso voltou ao padrão mesmo sem rede", async () => {
  const cliente = novoCliente();
  await salvarModeloDeTreino(cliente, { ...modelo, descansos_por_exercicio: { escalador: 75 }, series_por_exercicio: { escalador: 4 } });
  await excluirModeloDeTreino(cliente, "ana", modelo.id);
  const legado = { ...modelo, series_por_exercicio: { escalador: 2 } };
  const esperado = { ...legado, descansos_por_exercicio: null };
  expect(await salvarModeloDeTreino(cliente, legado)).toEqual(esperado);
  expect(((await banco.outbox.toArray()).at(-1)!.payload as EscritaTabela).linha).toEqual(legado);
  await guardarCache(JSON.stringify(chaveDosModelos("ana")), { modelos: [legado], revisoes: { [modelo.id]: 3 } });
  expect(await ler()).toEqual([esperado]);
  expect(ajustesDoModeloConfirmados((await ler())[0]!)).toBe(true);
});

it.each([{ versao: 62, campos: {} }, { versao: 63, campos: { series_por_exercicio: {} } }])(
  "pede nova leitura do backup se a fila #$versao já drenou durante o GET e a cópia é parcial", async ({ campos }) => {
  const renomeado = { ...modelo, ...campos, nome: "Nome da aba anterior" };
  const entrou = Promise.withResolvers<void>();
  const resposta = Promise.withResolvers<Response>();
  rede(true);
  usarServidor(async () => { entrou.resolve(); return resposta.promise; });
  const leitura = lerModelosDeTreino(novoCliente(), "ana", undefined, true);
  await entrou.promise;
  await guardarCache(JSON.stringify(chaveDosModelos("ana")), { modelos: [renomeado], revisoes: { [modelo.id]: 2 } });
  resposta.resolve(pagina([{ ...modelo, series_por_exercicio: { escalador: 5 }, descansos_por_exercicio: { escalador: 80 } }]));
  await expect(leitura).rejects.toThrow("Tente novamente");
  // Entre os dois GETs o app antigo retirou e recolocou o exercício da contagem antiga.
  const podado = { ...renomeado, series_por_exercicio: {}, descansos_por_exercicio: {} };
  usarServidor(async () => pagina([podado]));
  expect(await lerModelosDeTreino(novoCliente(), "ana", undefined, true)).toEqual([podado]);
});

it.each([
  { caso: "um nome", campos: {}, series: { escalador: 7 } },
  { caso: "uma edição de séries", campos: { series_por_exercicio: { escalador: 4 } }, series: { escalador: 4 } },
])("$caso na fila preserva os ajustes que outro aparelho alterou antes da consulta", async ({ campos, series }) => {
  const cliente = novoCliente();
  await salvarModeloDeTreino(cliente, { ...modelo, series_por_exercicio: { escalador: 3 }, descansos_por_exercicio: { escalador: 30 } });
  await banco.outbox.clear();
  const novo = { ...modelo, nome: "Renomeado", ...campos };
  await salvarModeloDeTreino(cliente, novo);
  rede(true);
  usarServidor(async () => pagina([{ ...modelo, series_por_exercicio: { escalador: 7 }, descansos_por_exercicio: { escalador: 70 } }]));
  expect(await ler()).toEqual([{ ...novo, series_por_exercicio: series, descansos_por_exercicio: { escalador: 70 } }]);
  expect(((await banco.outbox.toArray())[0]!.payload as EscritaTabela).linha).toEqual(novo);
});

it("valida o mapa esparso dos movimentos selecionados, inclusive de catálogos futuros", async () => {
  for (const invalida of [[], 2, false, { escalador: 0 }, { escalador: 11 }, { escalador: 1.5 }, { escalador: "3" },
    { escalador: null }, { escalador: Number.NaN }, { prancha: 3 }]) {
    const linha: unknown = { ...modelo, series_por_exercicio: invalida };
    expect(modeloDeTreinoValido(linha)).toBe(false);
    await expect(salvarModeloDeTreino(novoCliente(), linha as ModeloDeTreino)).rejects.toThrow();
  }
  for (const invalida of [[], 30, { escalador: 4 }, { escalador: 901 }, { escalador: 6.5 }, { escalador: "30" }, { prancha: 30 }]) {
    const linha: unknown = { ...modelo, descansos_por_exercicio: invalida };
    expect(modeloDeTreinoValido(linha)).toBe(false);
    await expect(salvarModeloDeTreino(novoCliente(), linha as ModeloDeTreino)).rejects.toThrow();
  }
  expect(await banco.outbox.count()).toBe(0);
  const futura = { ...modelo, exercicios: ["exercicio-futuro"], series_por_exercicio: { "exercicio-futuro": 10 },
    descansos_por_exercicio: { "exercicio-futuro": 900 } };
  expect(modeloDeTreinoValido(futura)).toBe(true);
  expect(modeloCompativelComCatalogo(futura)).toBe(false);
});

it("a aba antiga conserva a remoção, a série seguinte sobe e a aba nova só apaga com a conta autora", async () => {
  await excluirModeloDeTreino(novoCliente(), "ana", modelo.id);
  await guardarNaFila("serie", { tabela: "session_sets", op: "upsert", linha: { id: "serie-da-outra-sessao" } }, "sessions:vizinha");
  const pedidos: [string, string, Record<string, string>][] = [];
  const fetch: typeof globalThis.fetch = async (entrada, init) => {
    const url = new URL(String(entrada));
    pedidos.push([init!.method!, url.pathname, Object.fromEntries(url.searchParams)]);
    return new Response(null, { status: 204 });
  };
  usarServidor(fetch, "bia");
  // O despachante #61 só entende payloads genéricos com op ou seus formatos anteriores de conciliação.
  definirEnviador(item => {
    if (!(item.payload as EscritaTabela)?.op) throw new Error("item da fila sem tabela ou operação");
    return enviarItem(item);
  });
  rede(true);
  expect(await processar()).toBe(1);
  expect(await banco.outbox.count()).toBe(1);
  expect(pedidos).toEqual([["POST", "/rest/v1/session_sets", {}]]);
  definirEnviador(enviarItem);
  expect(await tentarAgora()).toBe(0);
  expect((await banco.outbox.toArray())[0]?.erro).toContain("Aguardando a conta");
  usarServidor(fetch, "ana");
  expect(await tentarAgora()).toBe(1);
  expect(await banco.outbox.count()).toBe(0);
  expect(pedidos.at(-1)).toEqual(["DELETE", "/rest/v1/modelos_de_treino", { user_id: "eq.ana", id: `eq.${modelo.id}` }]);
});
