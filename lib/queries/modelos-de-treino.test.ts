import "fake-indexeddb/auto";
import { createClient, type Session } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bd } from "@/lib/db";
import { modeloCompativelComCatalogo } from "@/lib/modelo-de-treino";
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
