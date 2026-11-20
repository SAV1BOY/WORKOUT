import "fake-indexeddb/auto";
import { createClient, type Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bd } from "@/lib/db";
import { itensDeIds, planoDaSessao } from "@/lib/livre";
import { comandoDeMaterialDaSessao, comandoDeMaterialNaFila, lerCopiaDeMaterial, listarCopiasDeMaterial, listarMateriaisPendentes, resolverMaterialPendente } from "@/lib/material-pendente";
import { definirEnviador, guardarNaFila, processar } from "@/lib/outbox";
import { enviarItem } from "@/lib/outbox-supabase";
import { vinculoDoLoginAtual } from "@/lib/player-sem-rede";
import { guardarMaterialConfirmadoNoAparelho } from "@/lib/queries/material-confirmado";
import { montarSessaoAvulsa, type SessaoLocal } from "@/lib/sessao";
import { clienteNavegador } from "@/lib/supabase/client";
import type { PlanoDaSessao } from "@/lib/types";

vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
vi.mock("@/lib/player-sem-rede", () => ({ vinculoDoLoginAtual: vi.fn() }));
vi.mock("@/lib/queries/material-confirmado", () => ({ guardarMaterialConfirmadoNoAparelho: vi.fn() }));

const conta = "ana", id = "treino", alvo = "sessions:treino";
const plano = planoDaSessao(itensDeIds(["flexao-de-braco", "agachamento-com-peso-corporal"]), { titulo: "Treino livre" });
const ponte = "ponte-de-gluteos-no-tatame";
const comInclusao: PlanoDaSessao = {
  ...plano, itens: [...plano.itens, ...planoDaSessao(itensDeIds([ponte])).itens], equipamento_disponivel: ["tatame", "super-band"],
  ultima_inclusao: { id: "inclusao", estado: "iniciada", ordem: 3, sessao_id: id, exercicio_id: ponte, series_iniciais: "series" },
};
const legado = { tabela: "sessions", op: "update", filtro: { id, user_id: conta, status: "em_andamento" },
  linha: { plano: { ...plano, equipamento_disponivel: ["tatame"] } satisfies PlanoDaSessao } };
const serie = { tabela: "session_sets", op: "upsert", onConflict: "id",
  linha: { id: "serie", session_id: id, user_id: conta, ordem_ex: 1, exercise_id: "flexao-de-braco", set_index: 1, reps: 10 } };
const confirmada = { id, user_id: conta, status: "em_andamento", revisao_equipamento: "r1", plano: comInclusao };
const resposta = (dado: unknown, status = 200) => new Response(JSON.stringify(dado), { status, headers: { "Content-Type": "application/json" } });
const conflito = (message: string) => resposta({ code: "PT409", message }, 409);
const fetch = vi.fn<typeof globalThis.fetch>();
const registro = async () => (await bd().outbox.toArray())[0]!;
let login = conta;

beforeEach(async () => {
  vi.resetAllMocks();
  await Promise.all([bd().outbox.clear(), bd().sessaoAtiva.clear(), bd().cache.clear()]);
  login = conta;
  vi.mocked(vinculoDoLoginAtual).mockImplementation(async () => ({ conta: login, chave: "", url: "", impressao: "" }));
  vi.stubGlobal("navigator", { onLine: false });
  const cliente = createClient("http://localhost", "teste", { global: { fetch } });
  vi.spyOn(cliente.auth, "getSession").mockImplementation(async () => ({ data: { session: { user: { id: login } } as Session }, error: null }));
  vi.mocked(clienteNavegador).mockReturnValue(cliente);
  vi.mocked(guardarMaterialConfirmadoNoAparelho).mockImplementation(async (conta, remota, _item, aoConfirmar) => {
    if (aoConfirmar) await bd().transaction("rw", bd().cache, bd().sessaoAtiva, bd().outbox, async () => {
      const local = (await bd().sessaoAtiva.get(remota.id))?.dados as SessaoLocal | undefined;
      await aoConfirmar(local?.userId === conta ? local : undefined);
    });
  });
  definirEnviador(enviarItem);
});
afterEach(async () => { await bd().outbox.clear(); vi.stubGlobal("navigator", { onLine: true }); await processar(); vi.unstubAllGlobals(); });

it("reenvia o mesmo UUID e a mesma revisão após perder a resposta e reconhece o estado devolvido", async () => {
  const escrita = comandoDeMaterialDaSessao(conta, id, "r0", null, [], plano);
  await guardarNaFila("sessao", escrita, alvo);
  const item = await registro();
  fetch.mockRejectedValueOnce(new TypeError("rede caiu")).mockResolvedValueOnce(resposta(confirmada));
  await expect(enviarItem(item)).rejects.toThrow();
  expect(guardarMaterialConfirmadoNoAparelho).not.toHaveBeenCalled();
  await enviarItem(item);
  for (const [url, init] of fetch.mock.calls) {
    expect(String(url)).toContain("/rpc/alterar_material_da_sessao");
    expect(JSON.parse(String(init?.body))).toEqual({ p_sessao: id, p_comando: escrita.equipamentoDaSessao.comando,
      p_revisao_base: "r0", p_de: null, p_para: [], p_plano_inicial: plano });
  }
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(guardarMaterialConfirmadoNoAparelho).toHaveBeenCalledWith(conta, confirmada, item);
});

it("não envia o comando de outra conta nem confirma uma sessão ausente", async () => {
  await guardarNaFila("sessao", comandoDeMaterialDaSessao(conta, id, null, [], null), alvo);
  const item = await registro();
  login = "bia";
  await expect(enviarItem(item)).rejects.toThrow("Aguardando a conta");
  expect(fetch).not.toHaveBeenCalled();
  login = conta;
  fetch.mockResolvedValueOnce(resposta(null)).mockResolvedValueOnce(resposta({ ...confirmada, user_id: "bia" }));
  await expect(enviarItem(item)).rejects.toThrow("confirmar este treino");
  await expect(enviarItem(item)).rejects.toThrow("confirmar este treino");
  expect(guardarMaterialConfirmadoNoAparelho).not.toHaveBeenCalled();
});

it.each(["aparelho", "sincronizado"] as const)("a decisão %s preserva a ponte e libera uma única gravação da série posterior", async escolha => {
  await guardarNaFila("sessao", legado, alvo);
  await guardarNaFila("serie", serie, alvo);
  await bd().sessaoAtiva.put({ id, atualizadoEm: 1, dados: { id, userId: conta, data: "2026-11-20" } });
  const [inicial, posterior] = await bd().outbox.toArray();
  const rpc: unknown[] = [], series: unknown[] = [];
  fetch.mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (init?.method === "PATCH") return conflito("PLANO_DA_SESSAO_DIVERGIU");
    if (init?.method === "GET") return resposta([confirmada]);
    if (path.endsWith("/rpc/alterar_material_da_sessao")) {
      const m = JSON.parse(String(init?.body)); rpc.push(m);
      return resposta({ ...confirmada, revisao_equipamento: m.p_comando, plano: { ...comInclusao, equipamento_disponivel: m.p_para } });
    }
    if (path.endsWith("/session_sets")) { series.push(JSON.parse(String(init?.body))); return new Response(null, { status: 201 }); }
    throw new Error(path);
  });
  vi.stubGlobal("navigator", { onLine: true });
  expect(await processar()).toBe(0);
  expect(series).toEqual([]);
  expect((await bd().outbox.get(posterior!.id!))!.tentativas).toBe(0);
  vi.stubGlobal("navigator", { onLine: false });
  const [vista] = await listarMateriaisPendentes(conta);
  expect(vista).toMatchObject({ conta, sessaoId: id, titulo: "Treino livre", data: "2026-11-20",
    local: ["tatame"], sincronizado: ["tatame", "super-band"], exerciciosAcrescentados: [ponte],
    seriesNaFila: [{ exercicioId: "flexao-de-braco", indice: 1 }], outrasEdicoes: false });
  login = "bia";
  expect(await listarMateriaisPendentes(login)).toEqual([]);
  await expect(resolverMaterialPendente(login, vista!, escolha)).rejects.toThrow("conta");
  login = conta;
  await resolverMaterialPendente(conta, vista!, escolha);
  expect(await bancoDePayload()).toMatchObject({ conciliacaoDeMaterial: { original: legado, escolha } });
  expect((await registro()).id).toBe(inicial!.id);
  await expect(resolverMaterialPendente(conta, vista!, escolha)).rejects.toThrow("escolha mudou");
  vi.stubGlobal("navigator", { onLine: true });
  expect(await processar()).toBe(2);
  expect(series).toEqual([serie.linha]);
  expect(rpc).toHaveLength(escolha === "aparelho" ? 1 : 0);
  expect(guardarMaterialConfirmadoNoAparelho).toHaveBeenCalledWith(conta, expect.objectContaining({
    plano: expect.objectContaining({ itens: comInclusao.itens, ultima_inclusao: comInclusao.ultima_inclusao }),
  }), expect.objectContaining({ id: inicial!.id }));
  expect(await bd().outbox.count()).toBe(0);
});

async function bancoDePayload() { return (await registro()).payload; }

it.each(["descanso", "série fora da posição"] as const)("preserva a edição de %s quando só foi conferido o equipamento", async caso => {
  const antigo = structuredClone(legado), posterior = structuredClone(serie);
  if (caso === "descanso") antigo.linha.plano.descansos_por_exercicio = { "flexao-de-braco": 115 };
  else posterior.linha.exercise_id = ponte;
  await guardarNaFila("sessao", antigo, alvo);
  await guardarNaFila("serie", posterior, alvo);
  fetch.mockResolvedValueOnce(conflito("PLANO_DA_SESSAO_DIVERGIU")).mockResolvedValueOnce(resposta([confirmada]));
  expect(await enviarItem(await registro())).toBe("aguarda-material");
  const [vista] = await listarMateriaisPendentes(conta);
  expect(vista?.outrasEdicoes).toBe(true);
  await expect(resolverMaterialPendente(conta, vista!, "aparelho")).rejects.toThrow("escolha mudou");
  await expect(resolverMaterialPendente(conta, vista!, "sincronizado")).rejects.toThrow("escolha mudou");
  expect(await bancoDePayload()).toMatchObject({ conciliacaoDeMaterial: { original: antigo } });
  expect(await bd().outbox.count()).toBe(2);
});

it("outra escolha do mesmo material após a comparação exige confirmar a revisão nova", async () => {
  const original = comandoDeMaterialDaSessao(conta, id, "r0", null, []);
  await guardarNaFila("sessao", original, alvo);
  fetch.mockResolvedValueOnce(conflito("MATERIAL_DA_SESSAO_ALTERADO")).mockResolvedValueOnce(resposta([confirmada]));
  expect(await enviarItem(await registro())).toBe("aguarda-material");
  const [vista] = await listarMateriaisPendentes(conta);
  await resolverMaterialPendente(conta, vista!, "sincronizado");
  fetch.mockResolvedValueOnce(resposta([{ ...confirmada, revisao_equipamento: "r2" }]));
  expect(await enviarItem(await registro())).toBe("aguarda-material");
  expect((await listarMateriaisPendentes(conta))[0]?.revisao).not.toBe(vista?.revisao);
  expect(guardarMaterialConfirmadoNoAparelho).not.toHaveBeenCalled();
});

it("um outro erro HTTP 409 mantém a escrita original para tentar novamente", async () => {
  await guardarNaFila("sessao", legado, alvo);
  fetch.mockResolvedValueOnce(resposta({ code: "23505", message: "outra restrição" }, 409));
  await expect(enviarItem(await registro())).rejects.toThrow("outra restrição");
  expect(await bancoDePayload()).toEqual(legado);
  expect(await listarMateriaisPendentes(conta)).toEqual([]);
});

it("depois de confirmar a primeira escolha divergente, a segunda escolha offline mantém uma base válida", async () => {
  const primeira = comandoDeMaterialDaSessao(conta, id, "r0", null, []);
  const idPrimeira = primeira.equipamentoDaSessao.comando;
  const segunda = comandoDeMaterialDaSessao(conta, id, idPrimeira, [], ["tatame"]);
  for (const comando of [primeira, segunda]) await guardarNaFila("sessao", comando, alvo);
  fetch.mockResolvedValueOnce(conflito("MATERIAL_DA_SESSAO_ALTERADO")).mockResolvedValueOnce(resposta([confirmada]));
  expect(await enviarItem(await registro())).toBe("aguarda-material");
  const [vista] = await listarMateriaisPendentes(conta);
  expect(comandoDeMaterialNaFila(await registro())).toEqual(primeira);
  await resolverMaterialPendente(conta, vista!, "aparelho");

  let revisao = confirmada.revisao_equipamento;
  let material: string[] | null = confirmada.plano.equipamento_disponivel!;
  fetch.mockImplementation(async (_input, init) => {
    if (init?.method === "GET") return resposta([confirmada]);
    const corpo = JSON.parse(String(init?.body));
    expect(corpo.p_revisao_base).toBe(revisao);
    expect(corpo.p_de).toEqual(material);
    revisao = corpo.p_comando;
    material = corpo.p_para;
    return resposta({ ...confirmada, revisao_equipamento: revisao, plano: { ...comInclusao, equipamento_disponivel: material } });
  });
  vi.stubGlobal("navigator", { onLine: true });
  expect(await processar()).toBe(2);
  expect(revisao).toBe(segunda.equipamentoDaSessao.comando);
  expect(material).toEqual(["tatame"]);
  expect(await bd().outbox.count()).toBe(0);
});

async function conflitoComDuasSeries() {
  const antiga = structuredClone(legado);
  antiga.linha.plano.descansos_por_exercicio = { "flexao-de-braco": 115 };
  const incompatível = { ...serie, linha: { ...serie.linha, id: "serie-incompativel", exercise_id: "prancha", carga_kg: 12.5 } };
  const local = montarSessaoAvulsa({ id, userId: conta, data: "2026-11-20", fase: "fase1", workoutId: "livre",
    itens: itensDeIds(["flexao-de-braco", "agachamento-com-peso-corporal"]), plano: antiga.linha.plano });
  await bd().sessaoAtiva.put({ id, dados: local, atualizadoEm: 1 });
  await guardarNaFila("sessao", antiga, alvo);
  await guardarNaFila("serie", incompatível, alvo);
  await guardarNaFila("serie", serie, alvo);
  fetch.mockResolvedValueOnce(conflito("PLANO_DA_SESSAO_DIVERGIU")).mockResolvedValueOnce(resposta([confirmada]));
  expect(await enviarItem(await registro())).toBe("aguarda-material");
  const [vista] = await listarMateriaisPendentes(conta);
  expect(vista?.seriesParaGuardar).toEqual([{ id: "serie-incompativel", exercicioId: "prancha", indice: 1 }]);
  return { vista: vista!, antiga, incompatível, local };
}

it("guarda as edições da conta, o snapshot e só a série incompatível antes de liberar a compatível", async () => {
  const { vista, antiga, incompatível, local } = await conflitoComDuasSeries();
  await resolverMaterialPendente(conta, vista, "guardar-copia");
  expect(await listarCopiasDeMaterial(conta)).toEqual([]);
  const filaAntes = await bd().outbox.toArray();
  fetch.mockImplementation(async (_url, init) => init?.method === "GET" ? resposta([confirmada]) : new Response(null, { status: 201 }));
  vi.spyOn(bd().cache, "add").mockRejectedValueOnce(new Error("quota"));
  await expect(enviarItem(await registro())).rejects.toThrow("quota");
  expect(await bd().outbox.toArray()).toEqual(filaAntes);
  expect(await listarCopiasDeMaterial(conta)).toEqual([]);
  vi.spyOn(bd().outbox, "bulkDelete").mockRejectedValueOnce(new Error("interrompida depois de guardar a cópia"));
  await expect(enviarItem(await registro())).rejects.toThrow("interrompida");
  expect(await listarCopiasDeMaterial(conta)).toEqual([]);
  expect(await bd().outbox.toArray()).toEqual(filaAntes);

  vi.stubGlobal("navigator", { onLine: true });
  expect(await processar()).toBe(2);
  expect(await bd().outbox.count()).toBe(0);
  const envios = fetch.mock.calls.filter(([, init]) => init?.method === "POST");
  expect(envios.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([serie.linha]);
  bd().close(); await bd().open();
  const [copia] = await listarCopiasDeMaterial(conta);
  expect(copia).toMatchObject({ formato: "treino-terraco-edicoes-de-sessao-v1", conta, sessaoId: id, data: local.data,
    original: antiga, remota: confirmada, sessaoLocal: local, seriesGuardadas: [{ id: incompatível.linha.id, payload: incompatível }] });
  expect(JSON.parse(JSON.stringify(await lerCopiaDeMaterial(conta, copia!.id)))).toMatchObject({
    original: antiga, seriesGuardadas: [{ payload: { linha: { id: "serie-incompativel", carga_kg: 12.5 } } }],
  });
  login = "bia";
  expect(await listarCopiasDeMaterial(login)).toEqual([]);
  await expect(lerCopiaDeMaterial(login, copia!.id)).rejects.toThrow("não está disponível");
  await expect(lerCopiaDeMaterial(conta, copia!.id)).rejects.toThrow("Aguardando a conta");
});

it.each(["plano", "série"] as const)("uma mudança de %s depois da escolha offline exige nova comparação antes do arquivo", async alteracao => {
  const { vista, incompatível } = await conflitoComDuasSeries();
  await resolverMaterialPendente(conta, vista, "guardar-copia");
  if (alteracao === "série") {
    const fila = await bd().outbox.toArray();
    await bd().outbox.update(fila[1]!.id!, { payload: { ...incompatível, linha: { ...incompatível.linha, reps: 9 } } });
  }
  const remote = alteracao === "plano" ? { ...confirmada, plano: { ...comInclusao, titulo: "Título mudado no outro aparelho" } } : confirmada;
  fetch.mockResolvedValueOnce(resposta([remote]));
  expect(await enviarItem(await registro())).toBe("aguarda-material");
  expect(await bd().outbox.count()).toBe(3);
  expect(await listarCopiasDeMaterial(conta)).toEqual([]);
  const [atual] = await listarMateriaisPendentes(conta);
  expect(atual?.revisao).not.toBe(vista.revisao);
});
