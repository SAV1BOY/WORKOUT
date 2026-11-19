import { QueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chaveDoDetalheDaSessao } from "@/lib/chaves-do-historico";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import type { ItemCache } from "@/lib/db";
import { CHAVE_CACHE, VALIDADE_MS } from "@/lib/persistencia-query";
import { anterioresPorExercicio, serieAnteriorDe } from "@/lib/player";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { lerSeriesDoTreinoPassado, type UltimaSerie } from "@/lib/queries/series-do-treino-passado";
import { clienteNavegador } from "@/lib/supabase/client";

const disco = new Map<string, ItemCache>();
const fila: EscritaTabela[] = [];
const get = vi.fn(async (k: string) => disco.get(k));
const bulkPut = vi.fn(async (itens: ItemCache[]) => { for (const i of itens) disco.set(i.chave, i); });
vi.mock("@/lib/db", () => ({
  temIndexedDB: () => true, lerCache: async (chave: string) => disco.get(chave)?.valor ?? null,
  bd: () => ({
    cache: {
      get, bulkGet: async (ks: string[]) => ks.map(k => disco.get(k)), bulkPut,
      where: () => ({ aboveOrEqual: (data: number) => ({ eachPrimaryKey: async (visitar: (chave: string, cursor: { key: number }) => void) => {
        for (const item of disco.values()) if (item.atualizadoEm >= data) visitar(item.chave, { key: item.atualizadoEm });
      } }) }),
    },
    outbox: { where: () => ({ equals: () => ({ toArray: async () => fila.map(payload => ({ payload })) }) }) },
    transaction: (_modo: string, ...args: unknown[]) => (args.at(-1) as () => Promise<unknown>)(),
  }),
}));
vi.mock("@/lib/queries/conta-do-treino", () => ({ confirmarContaDoTreino: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));

let banco: UltimaSerie[] = [];
let limite = 1000;
const urls: URL[] = [];
const rede = vi.fn<typeof fetch>();
const cliente = new QueryClient();
function linha(session_id: string, exercise_id: string, set_index: number, instante: number, ordem_ex = 1): UltimaSerie {
  return { user_id: "ana", id: [session_id, exercise_id, ordem_ex, set_index].join("-"), session_id, exercise_id,
    ordem_ex, set_index, registrada_em: new Date(instante * 60000).toISOString(), tipo: "trabalho", concluida: true,
    reps: set_index + 3, reps_lado2: 6, carga_kg: 9.5, tempo_s: null, tempo_s_lado2: null, passos: null, assistencia: null };
}
const ler = (ids: string[], atual?: string, conta = "ana", q = cliente, sinal = new AbortController().signal) =>
  lerSeriesDoTreinoPassado(q, conta, ids, atual, sinal);
const desligar = () => vi.stubGlobal("navigator", { onLine: false });
function semDono(s: UltimaSerie) {
  const { user_id, id, ordem_ex, reps_lado2, tempo_s_lado2, passos, assistencia, ...antiga } = s;
  void [user_id, id, ordem_ex, reps_lado2, tempo_s_lado2, passos, assistencia];
  return antiga;
}

beforeEach(() => {
  banco = []; fila.length = 0; disco.clear(); cliente.clear(); urls.length = 0; limite = 1000;
  vi.stubGlobal("navigator", { onLine: true });
  vi.mocked(clienteNavegador).mockReturnValue(createClient("http://localhost", "simulada", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: rede },
  }));
  rede.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    urls.push(url);
    const params = url.searchParams;
    const linhas = banco.filter(l => {
      for (const [coluna, f] of params) {
        const v = String(l[coluna as keyof UltimaSerie]);
        if (f.startsWith("eq.") && v !== f.slice(3)) return false;
        if (f.startsWith("neq.") && v === f.slice(4)) return false;
        if (f.startsWith("gt.") && v <= f.slice(3)) return false;
        if (f.startsWith("in.(") && !f.slice(4, -1).split(",").includes(v)) return false;
      }
      return true;
    }).sort((a, b) => {
      for (const [campo, ordem] of params.get("order")!.split(",").map(o => o.split("."))) {
        const x = String(a[campo as keyof UltimaSerie]);
        const y = String(b[campo as keyof UltimaSerie]);
        if (x !== y) return (x > y ? 1 : -1) * (ordem === "desc" ? -1 : 1);
      }
      return 0;
    });
    const h = new Headers();
    if (new Headers(init?.headers).get("prefer")?.includes("count=exact")) h.set("content-range", `*/${linhas.length}`);
    return Response.json(linhas.slice(0, Math.min(limite, Number(params.get("limit")))), { headers: h });
  });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("consulta da referência de cada série", () => {
  it("usa um GET por treino curto com a conta, a sessão excluída e as medidas realmente registradas", async () => {
    const outra = linha("anterior", "prancha", 2, 5);
    banco = [outra, { ...outra, user_id: "bia" }, { ...outra, concluida: false }, { ...outra, tipo: "aquecimento" }, linha("atual", "prancha", 1, 10)];
    expect(await ler(["prancha"], "atual")).toEqual([outra]);
    expect(urls).toHaveLength(1);
    expect(urls[0]!.searchParams.get("session_id")).toBe("neq.atual");
    expect(urls[0]!.searchParams.get("select")!.split(",")).toEqual(expect.arrayContaining([
      "id", "ordem_ex", "reps_lado2", "tempo_s_lado2", "passos", "assistencia",
    ]));
    desligar();
    expect(await ler(["prancha"], "atual", "ana", new QueryClient())).toEqual([outra]);
    expect(await ler(["prancha"], "atual", "bia")).toEqual([]);
  });

  it("completa as sessões intercaladas e encontra movimento raro que ficou fora da primeira página", async () => {
    limite = 3;
    banco = [
      linha("s", "supino", 1, 100), linha("r", "remada", 1, 99), linha("s", "supino", 3, 90),
      linha("r", "remada", 2, 40), linha("s", "supino", 2, 35), linha("p", "pullover", 2, 10),
      linha("atual", "supino", 1, 110), linha("outra", "supino", 2, 50),
    ];
    const linhas = await ler(["supino", "remada", "pullover"], "atual");
    const porExercicio = anterioresPorExercicio(linhas);
    for (const [ex, sessao] of [["supino", "s"], ["remada", "r"], ["pullover", "p"]]) {
      expect(serieAnteriorDe(porExercicio[ex!], 2)).toMatchObject({ session_id: sessao, set_index: 2 });
    }
    expect(urls.some(u => u.searchParams.get("id")?.startsWith("gt."))).toBe(true);
    desligar();
    expect(await ler(["remada"], "atual")).toEqual(linhas.filter(s => s.exercise_id === "remada"));
  });

  it("a preparação sozinha basta para retomar pela primeira vez, mesmo se o próprio treino aberto preencheu a página", async () => {
    limite = 2;
    banco = [linha("hoje", "supino", 1, 20), linha("hoje", "supino", 2, 30),
      linha("hoje", "supino", 3, 40), linha("antes", "supino", 1, 5), linha("antes", "supino", 2, 6)];
    await ler(["supino", "remada"]);
    desligar();
    const salvas = await ler(["supino"], "hoje", "ana", new QueryClient());
    expect(salvas.map(s => s.session_id)).toEqual(["antes", "antes"]);
  });

  it("reconhece antes da hidratação somente as séries legadas com sessão comprovada", async () => {
    desligar();
    const a = semDono(linha("s-a", "supino", 2, 50));
    const b = semDono(linha("s-b", "supino", 2, 51));
    const semConta = semDono(linha("perdida", "supino", 2, 60));
    const data = Date.now();
    const queries = [
      { queryKey: ["ultimas-series", "supino"], state: { data: [a, b, semConta], dataUpdatedAt: data } },
      { queryKey: ["sessoes"], state: { data: [{ id: "s-a", user_id: "ana" }, { id: "s-b", user_id: "bia" }], dataUpdatedAt: data } },
    ];
    disco.set(CHAVE_CACHE, { chave: CHAVE_CACHE, atualizadoEm: data, valor: { salvoEm: data, estado: { queries } } });
    expect((await ler(["supino"], "hoje")).map(s => s.session_id)).toEqual(["s-a"]);
    expect((await ler(["supino"], "hoje", "bia")).map(s => s.session_id)).toEqual(["s-b"]);
    expect(await ler(["supino"], "hoje", "caio")).toEqual([]);
    disco.delete(CHAVE_CACHE);
    expect((await ler(["supino"], "hoje", "ana", new QueryClient())).map(s => s.session_id)).toEqual(["s-a"]);
  });

  it("mantém blocos e medidas da conta no arquivo do #48, e aceita correções na fonte curta mais nova", async () => {
    desligar();
    const a = linha("s-a", "remada", 1, 5, 1);
    const b = linha("s-a", "remada", 1, 6, 3);
    const data = Date.now();
    disco.set("series-do-historico-v2:ana", { chave: "series-do-historico-v2:ana", valor: [a, b], atualizadoEm: data });
    cliente.setQueryData(["ultimas-series", "remada"], [semDono(a), semDono(b)], { updatedAt: data - 1000 });
    expect(await ler(["remada"], "atual")).toEqual([a, b]);
    disco.delete("series-anteriores-do-player:ana:remada:sessao");
    cliente.setQueryData(["ultimas-series", "remada"], [semDono(a), { ...semDono(b), reps: 15 }], { updatedAt: data + 1000 });
    expect(await ler(["remada"], "atual")).toMatchObject([{ ordem_ex: 1, reps_lado2: 6 }, { reps: 15 }]);
  });

  it("na borda de 120 da versão antiga não atribui uma série sem prova", async () => {
    desligar();
    const s = linha("s", "prancha", 2, 20);
    cliente.setQueryData(["ultimas-series", "prancha"], Array.from({ length: 120 }, () => semDono(s)));
    cliente.setQueryData(["sessoes"], [{ id: "s", user_id: "ana" }]);
    expect(await ler(["prancha"], "atual")).toEqual([]);
  });

  it("usa o treino encerrado na fila e depois de drená-la, com posição, lados e dono", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    banco = [linha("antiga", "supino", 1, 5)];
    await ler(["supino"]);
    desligar();
    const nova = { ...linha("origem", "supino", 1, 20, 3), carga_kg: 31.5, reps: 9, reps_lado2: 8 };
    const chave = chaveDoDetalheDaSessao("ana", "origem");
    disco.set(chave, { chave, valor: [nova], atualizadoEm: Date.now() });
    const invalida = chaveDoDetalheDaSessao("ana", "estranha");
    disco.set(invalida, { chave: invalida, valor: [{ ...nova, user_id: "bia", session_id: "estranha" }], atualizadoEm: Date.now() });
    fila.push({ tabela: "sessions", op: "upsert", linha: { id: "origem", user_id: "ana", status: "concluida" } });
    const anterior = async () => serieAnteriorDe(anterioresPorExercicio(await ler(["supino"], "nova", "ana", new QueryClient())).supino, 1);
    expect(await anterior()).toEqual(nova);
    fila.length = 0;
    expect(await anterior()).toEqual(nova);
    expect(await ler(["supino"], "origem")).toEqual(banco);
    expect(await ler(["supino"], "nova", "bia")).toEqual([]);
  });

  it("após o expurgo, uma confirmação completa mais nova corrige ou exclui a referência em cache", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const inicial = linha("origem", "remada", 2, 5);
    banco = [inicial];
    await ler(["remada"], "nova");
    desligar();
    const chave = "series-do-historico-v2:ana";
    disco.set(chave, { chave, valor: [], atualizadoEm: Date.now() - 1 });
    get.mockClear();
    expect(await ler(["remada"], "nova")).toEqual([inicial]);
    expect(get).not.toHaveBeenCalledWith(chave); // lê só a data da fonte mais antiga
    vi.setSystemTime(Date.now() + 1000);
    const corrigida = { ...inicial, reps: 10, carga_kg: 27.5 };
    disco.set(chave, { chave, valor: [corrigida], atualizadoEm: Date.now() });
    expect(await ler(["remada"], "nova")).toEqual([corrigida]);
    disco.set(chave, { chave, valor: [], atualizadoEm: Date.now() + 1 });
    expect(await ler(["remada"], "nova")).toEqual([]);
  });

  it("se o envio e o expurgo terminam durante um GET antigo, preserva o fechamento até a leitura posterior", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const nova = linha("origem", "supino", 1, 20);
    const chave = chaveDoDetalheDaSessao("ana", nova.session_id);
    disco.set(chave, { chave, valor: [nova], atualizadoEm: Date.now() - 1000 });
    fila.push({ tabela: "sessions", op: "upsert", linha: { id: "origem", user_id: "ana", status: "concluida" } });
    rede.mockImplementationOnce(async () => {
      fila.length = 0;
      disco.delete(chave);
      const arquivo = "series-do-historico-v2:ana";
      disco.set(arquivo, { chave: arquivo, valor: [nova], atualizadoEm: Date.now() - 500 });
      return Response.json([]);
    });
    expect(await ler(["supino"], "repetida")).toEqual([nova]);
    desligar();
    expect(await ler(["supino"], "repetida")).toEqual([nova]);
    vi.stubGlobal("navigator", { onLine: true });
    vi.setSystemTime(Date.now() + 1000);
    banco = [{ ...nova, reps: 14 }];
    expect(await ler(["supino"], "repetida")).toEqual(banco);
  });

  it("a ordem é a da série registrada, mesmo quando outro treino é encerrado no aparelho mais tarde", async () => {
    const recente = linha("mais-recente", "remada", 2, 40);
    banco = [recente];
    await ler(["remada"]);
    desligar();
    const antiga = linha("treino-antigo", "remada", 2, 10);
    const chave = chaveDoDetalheDaSessao("ana", "treino-antigo");
    disco.set(chave, { chave, valor: [antiga], atualizadoEm: Date.now() + 1000 });
    const referencias = anterioresPorExercicio(await ler(["remada"], "repetida"));
    expect(serieAnteriorDe(referencias.remada, 2)).toEqual(recente);
  });

  it("um fechamento vazio também substitui os valores antigos; outro movimento segue com a própria sessão", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const remada = linha("remada-antiga", "remada", 2, 15);
    banco = [linha("corrigida", "rosca", 1, 9), remada];
    await ler(["rosca", "remada"]);
    const chave = chaveDoDetalheDaSessao("ana", "corrigida");
    disco.set(chave, { chave, valor: [], atualizadoEm: Date.now() + 1 });
    desligar();
    expect(await ler(["rosca", "remada"], "nova")).toEqual([remada]);
  });

  it("não troca a cópia confirmada quando a sessão da conta muda ou a leitura é cancelada", async () => {
    banco = [linha("s", "supino", 1, 40)];
    const confirmada = await ler(["supino"], "agora");
    banco = [];
    vi.mocked(confirmarContaDoTreino).mockRejectedValueOnce(new Error("outra pessoa entrou"));
    await expect(ler(["supino"], "agora")).rejects.toThrow("outra pessoa");
    const controle = new AbortController();
    rede.mockImplementationOnce(async () => {
      controle.abort();
      return Response.json([]);
    });
    await expect(ler(["supino"], "agora", "ana", cliente, controle.signal)).rejects.toThrow();
    desligar();
    expect(await ler(["supino"], "agora")).toEqual(confirmada);
  });

  it("conserva a resposta online sem quota, rejeita autorização vencida e não lê cópia fora de validade", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    banco = [linha("anterior", "supino", 1, 40)];
    await ler(["supino"], "agora");
    bulkPut.mockRejectedValueOnce(new Error("quota"));
    expect(await ler(["supino"], "agora")).toEqual(banco);
    rede.mockImplementationOnce(async () => Response.json({ message: "proibido" }, { status: 403 }));
    await expect(ler(["supino"], "agora")).rejects.toThrow("proibido");
    rede.mockRejectedValueOnce(new TypeError("queda de rede"));
    expect(await ler(["supino"], "agora")).toEqual(banco);
    desligar();
    vi.mocked(confirmarContaDoTreino).mockRejectedValueOnce(new Error("outra conta"));
    await expect(ler(["supino"], "agora")).rejects.toThrow("outra conta");
    vi.setSystemTime(Date.now() + VALIDADE_MS + 1);
    expect(await ler(["supino"], "agora")).toEqual([]);
  });
});

it("a confirmação de outra aba durante o GET do player não devolve nem guarda a carga anterior", async () => {
  const velha = linha("treino", "agachamento", 1, 5);
  const nova = { ...velha, reps: 15, carga_kg: 35.5 };
  rede.mockImplementationOnce(async () => {
    const chave = "ultima-conciliacao-de-serie:ana";
    disco.set(chave, { chave, atualizadoEm: Date.now(), valor: { revisao: 1 } });
    banco = [nova];
    return Response.json([velha], { headers: { "content-range": "*/1" } });
  });
  expect(await ler(["agachamento"], "atual")).toEqual([nova]);
  expect(rede).toHaveBeenCalledTimes(2);
  desligar();
  expect(await ler(["agachamento"], "atual", "ana", new QueryClient())).toEqual([nova]);
});
