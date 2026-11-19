import "fake-indexeddb/auto";
import { createClient, type Session } from "@supabase/supabase-js";
import { enviarItem } from "@/lib/outbox-supabase";
import { clienteNavegador } from "@/lib/supabase/client";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { bd } from "@/lib/db";
import { chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";
import { guardarConsultasAgora } from "@/lib/persistencia-query";
import type { SessaoBruta } from "@/lib/progresso";
import { guardarDescarteNoHistorico, lerHistoricoDaConta } from "./historico-da-sessao";
import { lerSessoesLocaisDoCalendario, reunirSessoesDoCalendario } from "./sessoes-do-calendario";

vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));

const banco = bd(), conta = "ana", data = "2026-06-02";
const antiga: SessaoBruta = { id: "uma", user_id: conta, data, status: "concluida", workout_id: "A1",
  iniciada_em: data + "T13:30:00Z", duracao_s: 1200 };
const aberta: SessaoBruta = { ...antiga, id: "livre", workout_id: "livre", status: "em_andamento", duracao_s: undefined };
const foto = (s: SessaoBruta) => ({ id: s.id, atualizadoEm: Date.now(), dados: { id: s.id, userId: s.user_id, data: s.data,
  workoutId: s.workout_id, status: "em_andamento", iniciadaEm: s.iniciada_em, plano: s.plano } });
beforeEach(async () => {
  vi.stubGlobal("navigator", { onLine: false });
  await Promise.all([banco.cache.clear(), banco.sessaoAtiva.clear(), banco.outbox.clear()]);
});
afterEach(() => vi.unstubAllGlobals());

it("conserva o horário e a duração das duas forças anteriores às sessenta mais recentes e separa contas", async () => {
  const outra = { ...antiga, id: "tarde", iniciada_em: data + "T17:00:00Z", duracao_s: 540 };
  const recentes = Array.from({ length: 60 }, (_, i) => ({ ...antiga, id: "nova-" + i, data: "2026-07-01" }));
  const lista = [...recentes, antiga, outra];
  await banco.cache.put({ chave: chaveDoHistoricoNoDisco(conta), valor: lista, atualizadoEm: Date.now() });
  // Um rascunho obsoleto não reabre a sessão encerrada; outra conta não participa.
  await banco.sessaoAtiva.bulkPut([foto(antiga), foto(aberta), foto({ ...aberta, id: "outro", user_id: "bia" })]);
  const locais = await lerSessoesLocaisDoCalendario(conta);
  const resultado = reunirSessoesDoCalendario(conta, recentes, locais);
  expect(resultado.filter(s => s.data === data)).toEqual([antiga, outra, expect.objectContaining({ id: "livre", status: "em_andamento" })]);
  expect(reunirSessoesDoCalendario("bia", lista, locais)).toEqual([]);
  expect(await lerSessoesLocaisDoCalendario("bia")).toMatchObject({ abertas: [{id: "outro"}], historico: null });
});

it("reabre o cache do calendário anterior sem Relatório e preserva o descarte na fila e logo após a confirmação", async () => {
  const cliente = new QueryClient();
  cliente.setQueryData(["sessoes"], [aberta, antiga, { ...antiga, id: "alheia", user_id: "bia" }]);
  await guardarConsultasAgora(cliente);
  const novaAba = new QueryClient();
  expect(await lerHistoricoDaConta(novaAba, conta)).toEqual([aberta, antiga]);
  await banco.sessaoAtiva.put(foto(aberta));
  await expect(guardarDescarteNoHistorico(novaAba, "bia", aberta.id)).rejects.toThrow("outra conta");
  await guardarDescarteNoHistorico(novaAba, conta, aberta.id);
  expect((await banco.outbox.toArray()).map(i => i.payload)).toEqual([{ tabela: "sessions", op: "update",
    linha: { status: "abandonada" }, filtro: { user_id: conta, id: aberta.id, status: "em_andamento" } }]);
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json([{ ...aberta, status: "abandonada" }]));
  const supabase = createClient("https://supabase.test", "anon-simulada", { global: { fetch } });
  vi.mocked(clienteNavegador).mockReturnValue(supabase);
  const [item] = await banco.outbox.toArray();
  const getSession = vi.spyOn(supabase.auth, "getSession");
  for (const dono of ["bia", conta]) {
    getSession.mockResolvedValue({ data: { session: { user: { id: dono } } as Session }, error: null });
    if (dono === conta) await enviarItem(item!);
    else await expect(enviarItem(item!)).rejects.toThrow("Aguardando a conta");
  }
  expect(fetch).toHaveBeenCalledTimes(1);
  await banco.outbox.clear();
  const doCalendario = reunirSessoesDoCalendario(conta, [aberta], await lerSessoesLocaisDoCalendario(conta));
  expect(doCalendario).toEqual([{ ...aberta, status: "abandonada" }, antiga]);
  expect(await banco.sessaoAtiva.get(aberta.id)).toBeUndefined();
});

it("recupera o descarte da versão anterior quando o Histórico ainda mostra o UUID aberto e a fila só conhece o ID", async () => {
  const outra = { ...aberta, id: "outro", user_id: "bia" };
  await banco.cache.bulkPut([aberta, outra].map(s => ({ chave: chaveDoHistoricoNoDisco(s.user_id!), valor: [s], atualizadoEm: Date.now() })));
  await banco.outbox.add({ tipo: "sessao", payload: { tabela: "sessions", op: "update",
    filtro: { id: aberta.id }, linha: { status: "abandonada" } }, tentativas: 0, proximaTentativa: 0, criadoEm: 0 });
  expect(await lerHistoricoDaConta(new QueryClient(), "bia")).toEqual([outra]);
  expect(await lerHistoricoDaConta(new QueryClient(), conta)).toEqual([{ ...aberta, status: "abandonada" }]);
  await banco.outbox.clear();
  expect(await lerSessoesLocaisDoCalendario(conta)).toMatchObject({ abertas: [], historico: [{ id: aberta.id, status: "abandonada" }] });
});

it.each([true, false])("reconcilia o descarte com a conclusão de outro aparelho e não consome a fila da outra conta (legado %s)", async legado => {
  const finalizada = { ...aberta, status: "concluida" as const, duracao_s: 1800, nota_geral: "Ombro melhorou" };
  await banco.cache.put({ chave: chaveDoHistoricoNoDisco(conta), valor: [{ ...aberta, status: "abandonada" }], atualizadoEm: Date.now() });
  const id = await banco.outbox.add({ tipo: "sessao", payload: { tabela: "sessions", op: "update", linha: { status: "abandonada" },
    filtro: legado ? { id: aberta.id } : { id: aberta.id, user_id: conta, status: "em_andamento" } },
    tentativas: 0, proximaTentativa: 0, criadoEm: 0 });
  const item = (await banco.outbox.get(id))!;
  let login = "bia", patches = 0;
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, opcoes) => {
    const url = new URL(String(input));
    if (opcoes?.method === "PATCH") {
      patches++;
      expect(url.searchParams.get("user_id")).toBe("eq.ana");
      expect(url.searchParams.get("status")).toBe("eq.em_andamento");
      expect(url.searchParams.get("id")).toBe("eq." + aberta.id);
      return Response.json([]); // a sessão já foi concluída
    }
    expect(url.searchParams.get("user_id")).toBe("eq." + login);
    return Response.json(login === conta ? [finalizada] : [], { headers: { "content-range": login === conta ? "0-0/1" : "*/0" } });
  });
  const supabase = createClient("https://supabase.test", "anon-simulada", { global: { fetch } });
  vi.mocked(clienteNavegador).mockReturnValue(supabase);
  vi.spyOn(supabase.auth, "getSession").mockImplementation(async () => ({
    data: { session: { user: { id: login } } as Session }, error: null,
  }));
  await expect(enviarItem(item)).rejects.toThrow("Aguardando a conta");
  expect(await banco.outbox.get(id)).toEqual(item);
  expect(patches).toBe(0);
  login = conta;
  vi.stubGlobal("navigator", { onLine: true });
  expect(await lerHistoricoDaConta(new QueryClient(), conta)).toEqual([finalizada]);
  expect(await enviarItem(item)).toBe("fila-reconciliada");
  expect(patches).toBe(legado ? 0 : 1);
  expect(await banco.outbox.count()).toBe(0);
  vi.stubGlobal("navigator", { onLine: false });
  expect(await lerHistoricoDaConta(new QueryClient(), conta)).toEqual([finalizada]);
});

it("recupera as 60 sessões do calendário #54 junto da conclusão local; a próxima lista integral pode retirar um UUID", async () => {
  const recentes = Array.from({ length: 60 }, (_, i) => ({ ...antiga, id: "salva" + i }));
  const local = { ...antiga, id: "mais-nova", seriesDeTrabalhoLocais: 3 };
  const cacheAntigo = new QueryClient();
  cacheAntigo.setQueryData(["sessoes"], [...recentes, { ...antiga, id: "outra", user_id: "bia" }]);
  await guardarConsultasAgora(cacheAntigo);
  await banco.cache.put({ chave: chaveDoHistoricoNoDisco(conta), valor: [local], atualizadoEm: Date.now() });
  expect((await lerSessoesLocaisDoCalendario(conta)).historico?.map(s => s.id)).toEqual([...recentes, local].map(s => s.id));
  const confirmados = [...recentes.slice(1), { ...antiga, id: local.id }];
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(confirmados, { headers: { "content-range": "0-59/60" } }));
  vi.mocked(clienteNavegador).mockReturnValue(createClient("https://supabase.test", "anon-simulada", { global: { fetch } }));
  vi.stubGlobal("navigator", { onLine: true });
  await lerHistoricoDaConta(new QueryClient(), conta);
  vi.stubGlobal("navigator", { onLine: false });
  expect((await lerSessoesLocaisDoCalendario(conta)).historico).toEqual(confirmados);
  expect((await lerSessoesLocaisDoCalendario("bia")).historico?.map(s => s.id)).toEqual(["outra"]);
});

it.each([true, false])("recupera no próprio envio os dados da conclusão concorrente antes de abrir o Histórico (legado %s)", async legado => {
  const concluida = { ...aberta, status: "concluida", duracao_s: 1800, nota_geral: "Dia de chuva" };
  const chave = chaveDoHistoricoNoDisco(conta);
  await banco.cache.put({ chave, valor: [{ ...aberta, status: "abandonada", duracao_s: null, nota_geral: null }], atualizadoEm: Date.now() });
  const id = await banco.outbox.add({ tipo: "sessao", payload: { tabela: "sessions", op: "update", linha: { status: "abandonada" },
    filtro: legado ? { id: aberta.id } : { id: aberta.id, user_id: conta, status: "em_andamento" } },
    tentativas: 0, proximaTentativa: 0, criadoEm: 0 });
  const chamadas: string[] = [];
  const fetch: typeof globalThis.fetch = async (url, opcoes) => {
    const parametros = new URL(String(url)).searchParams;
    expect(parametros.get("id")).toBe("eq." + aberta.id);
    expect(parametros.get("user_id")).toBe("eq." + conta);
    if (opcoes?.method === "PATCH") {
      expect(parametros.get("status")).toBe("eq.em_andamento");
      chamadas.push("PATCH");
      return Response.json([]); // outro aparelho concluiu imediatamente antes do PATCH
    }
    chamadas.push("GET");
    return Response.json([legado && chamadas.length === 1 ? aberta : concluida]);
  };
  const supabase = createClient("https://supabase.test", "anon-simulada", { global: { fetch } });
  vi.mocked(clienteNavegador).mockReturnValue(supabase);
  vi.spyOn(supabase.auth, "getSession").mockResolvedValue({ data: { session: { user: { id: conta } } as Session }, error: null });
  await enviarItem((await banco.outbox.get(id))!);
  expect(chamadas).toEqual(legado ? ["GET", "PATCH", "GET"] : ["PATCH", "GET"]);
  expect(await banco.outbox.count()).toBe(0);
  expect((await banco.cache.get(chave))?.valor).toEqual([concluida]);
  expect(await lerHistoricoDaConta(new QueryClient(), conta)).toEqual([concluida]);
});
