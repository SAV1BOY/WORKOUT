import { createClient, type Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { conferirSerieRemota, type DecisaoSobreSerie } from "@/lib/recuperacao-de-serie-remota";
import { clienteNavegador } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
const http = vi.fn<typeof fetch>();
const conta = "ana";
const local = {
  id: "serie", user_id: conta, session_id: "treino", exercise_id: "supino", tipo: "trabalho", ordem_ex: 1,
  set_index: 2, concluida: true, reps: 8, tempo_s: 21, carga_kg: 20.5, assistencia: null,
};
const remota = { ...local, reps: 10, tempo_s: null, carga_kg: 31.5, assistencia: "elastico" };
const conferir = (decisao?: DecisaoSobreSerie) => conferirSerieRemota(conta, local, ["reps", "tempo_s"], decisao);
const lista = (...linhas: unknown[]) => Response.json(linhas);
function pedido(indice: number) {
  const [url, opcoes] = http.mock.calls[indice]!;
  return { url: new URL(String(url)), metodo: opcoes?.method, headers: new Headers(opcoes?.headers),
    dados: opcoes?.body ? JSON.parse(String(opcoes.body)) : null };
}
function usarConta(id: string | null) {
  const supabase = createClient("https://supabase.test", "anon", {
    global: { fetch: http }, auth: { persistSession: false, autoRefreshToken: false },
  });
  vi.spyOn(supabase.auth, "getSession").mockResolvedValue(id
    ? { data: { session: { user: { id } } as Session }, error: null }
    : { data: { session: null }, error: null });
  vi.mocked(clienteNavegador).mockReturnValue(supabase);
}
beforeEach(() => {
  http.mockReset();
  usarConta(conta);
});

describe("reconciliação da contagem com o registro existente na conta", () => {
  it("a ausência permite inserir uma vez sem sobrescrever e confirmar pela leitura da linha real", async () => {
    const gravada = { ...local, registrada_em: "2026-11-19T13:00:00Z" };
    http.mockResolvedValueOnce(lista()).mockResolvedValueOnce(new Response(null, { status: 201 })).mockResolvedValueOnce(lista(gravada));
    expect(await conferir()).toEqual({ estado: "confirmada", linha: gravada });
    expect([0, 1, 2].map(i => pedido(i).metodo)).toEqual(["GET", "POST", "GET"]);
    const post = pedido(1);
    expect(post.dados).toEqual(local);
    expect(post.headers.get("Prefer")).toContain("resolution=ignore-duplicates");
    expect(post.url.searchParams.get("on_conflict")).toBe("id");
    for (const i of [0, 2]) {
      expect(pedido(i).url.pathname).toBe("/rest/v1/session_sets");
      expect(Object.fromEntries(pedido(i).url.searchParams)).toEqual({ select: "*", id: "eq.serie", user_id: "eq.ana" });
    }
  });

  it("a inserção concorrente de valores diferentes é apresentada à pessoa", async () => {
    http.mockResolvedValueOnce(lista()).mockResolvedValueOnce(new Response(null, { status: 201 })).mockResolvedValueOnce(lista(remota));
    expect(await conferir()).toEqual({ estado: "conflito", linha: remota });
    expect(http).toHaveBeenCalledTimes(3);
  });

  it("conserva o peso e a assistência da versão canônica quando as contagens já coincidem", async () => {
    const gravada = { ...remota, reps: local.reps, tempo_s: local.tempo_s };
    http.mockResolvedValueOnce(lista(gravada));
    expect(await conferir()).toEqual({ estado: "confirmada", linha: gravada });
    expect(http).toHaveBeenCalledOnce();
  });

  it.each([{ session_id: "outro" }, { exercise_id: "remada" }, { ordem_ex: 2 }, { set_index: 3 }, { concluida: false }])(
    "uma série movida ou desmarcada só permite conservar a linha remota (%j)", async alteracao => {
      const movida = { ...remota, ...alteracao };
      http.mockImplementation(async () => lista(movida));
      expect(await conferir()).toEqual({ estado: "conflito", linha: movida });
      expect(await conferir({ usar: "aparelho", observada: movida })).toEqual({ estado: "conflito", linha: movida });
      expect(await conferir({ usar: "historico", observada: movida })).toEqual({ estado: "confirmada", linha: movida });
      expect([0, 1, 2].map(i => pedido(i).metodo)).toEqual(["GET", "GET", "GET"]);
    },
  );

  it("só altera os campos escolhidos e confere inclusive um valor anterior nulo na mesma atualização", async () => {
    const gravada = { ...remota, reps: 8, tempo_s: 21, carga_kg: 34.5 };
    http.mockResolvedValueOnce(lista(remota)).mockResolvedValueOnce(lista(gravada));
    expect(await conferir({ usar: "aparelho", observada: remota })).toEqual({ estado: "confirmada", linha: gravada });
    const patch = pedido(1);
    expect(patch.metodo).toBe("PATCH");
    expect(patch.dados).toEqual({ reps: 8, tempo_s: 21 });
    expect(Object.fromEntries(patch.url.searchParams)).toEqual({
      select: "*", user_id: "eq.ana", id: "eq.serie", session_id: "eq.treino", exercise_id: "eq.supino",
      tipo: "eq.trabalho", ordem_ex: "eq.1", set_index: "eq.2", concluida: "eq.true", reps: "eq.10", tempo_s: "is.null",
    });
  });

  it("um backup parcial sem o exercício conserva somente a linha identificada no histórico", async () => {
    const parcial = { id: local.id, session_id: local.session_id, user_id: conta, reps: 8 };
    const ler = (decisao?: DecisaoSobreSerie) => conferirSerieRemota(conta, parcial, ["reps"], decisao);
    http.mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista(remota)).mockResolvedValueOnce(lista(remota))
      .mockResolvedValueOnce(lista(remota));
    await expect(ler()).rejects.toThrow("Faltam o exercício ou a posição");
    expect((await ler()).estado).toBe("conflito");
    expect((await ler({ usar: "aparelho", observada: remota })).estado).toBe("conflito");
    expect(await ler({ usar: "historico", observada: remota })).toEqual({ estado: "confirmada", linha: remota });
    expect(http.mock.calls.every((_, i) => pedido(i).metodo === "GET")).toBe(true);
  });

  it("pode manter uma limpeza explícita posterior; campo omitido não vira null", async () => {
    const comPassos = { ...remota, passos: 11 }, limpar = { ...local, passos: null };
    http.mockResolvedValueOnce(lista(comPassos)).mockResolvedValueOnce(lista({ ...comPassos, passos: null }));
    expect(await conferirSerieRemota(conta, limpar, ["passos"], { usar: "aparelho", observada: comPassos }))
      .toEqual({ estado: "confirmada", linha: { ...comPassos, passos: null } });
    expect(pedido(1).dados).toEqual({ passos: null });
    expect(pedido(1).url.searchParams.get("passos")).toBe("eq.11");
    await expect(conferirSerieRemota(conta, local, ["passos"])).rejects.toThrow("contagens");
    expect(http).toHaveBeenCalledTimes(2);
  });

  it("se a contagem mudou antes da decisão ou durante o PATCH, volta com a nova linha", async () => {
    const maisNova = { ...remota, reps: 12 };
    http.mockResolvedValueOnce(lista(maisNova)).mockResolvedValueOnce(lista(maisNova))
      .mockResolvedValueOnce(lista(remota)).mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista(maisNova));
    const conflito = { estado: "conflito", linha: maisNova };
    expect(await conferir({ usar: "historico", observada: remota })).toEqual(conflito);
    expect(await conferir({ usar: "aparelho", observada: remota })).toEqual(conflito);
    expect(await conferir({ usar: "aparelho", observada: remota })).toEqual(conflito);
    expect(http.mock.calls.map((_, i) => pedido(i).metodo)).toEqual(["GET", "GET", "GET", "PATCH", "GET"]);
  });

  it("a perda de resposta depois de aplicar a escolha não repete a alteração", async () => {
    const gravada = { ...remota, reps: 8, tempo_s: 21 };
    http.mockResolvedValueOnce(lista(remota)).mockRejectedValueOnce(new TypeError("conexão interrompida")).mockResolvedValueOnce(lista(gravada));
    const escolha = { usar: "aparelho", observada: remota } as const;
    await expect(conferir(escolha)).rejects.toThrow();
    expect(await conferir(escolha)).toEqual({ estado: "confirmada", linha: gravada });
    expect(http.mock.calls.map((_, i) => pedido(i).metodo)).toEqual(["GET", "PATCH", "GET"]);
  });

  it("o desaparecimento de uma linha já observada não recria o registro nem simula sucesso", async () => {
    http.mockResolvedValueOnce(lista());
    await expect(conferir({ usar: "aparelho", observada: remota })).rejects.toThrow("não está disponível");
    expect(http).toHaveBeenCalledOnce();
  });

  it("recusa um dono divergente antes da rede e um retorno inesperado sem tentar escrever", async () => {
    usarConta("bia");
    await expect(conferir()).rejects.toThrow("conta");
    expect(http).not.toHaveBeenCalled();
    usarConta(conta);
    http.mockResolvedValueOnce(lista({ ...local, user_id: "bia" }));
    await expect(conferir()).rejects.toThrow("série desta conta");
    expect(http).toHaveBeenCalledOnce();
  });
});

describe("série ausente cujo vínculo mudou no backup", () => {
  const proposta = { id: local.id, user_id: conta, session_id: "outro-treino", exercise_id: "remada", ordem_ex: 2, set_index: 1 };
  const herdada = { ...local, ...proposta };
  const canonica = { ...proposta, reps: null, tempo_s: null, passos: null, reps_alvo_min: null, reps_alvo_max: null,
    reps_lado2: null, tempo_s_lado2: null, carga_kg: null, assistencia: null, rpe: null, ultima_firme: null,
    tipo: "trabalho", concluida: false, registrada_em: "2026-11-19T14:00:00Z" };
  const enviar = (confirmada: boolean, manterAusencia = false) => conferirSerieRemota(conta, herdada, ["reps"], undefined, {
    insercao: proposta, confirmada, manterAusencia,
  });

  it("mostra a versão do novo movimento e só a cria após o aceite, sem carga ou reps herdadas", async () => {
    http.mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista())
      .mockResolvedValueOnce(new Response(null, { status: 201 })).mockResolvedValueOnce(lista(canonica));
    expect(await enviar(false)).toEqual({ estado: "confirmar-insercao", linha: proposta });
    expect(http).toHaveBeenCalledOnce();
    expect(await enviar(true)).toEqual({ estado: "confirmada", linha: canonica });
    expect(pedido(2).dados).toEqual(proposta);
    expect(pedido(2).headers.get("Prefer")).toContain("resolution=ignore-duplicates");
  });

  it("só mantém a ausência depois de a conferir de novo; se alguém já criou o UUID pede nova escolha", async () => {
    const maisNova = { ...canonica, reps: 14, carga_kg: 28.5 };
    http.mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista(maisNova)).mockResolvedValueOnce(lista(maisNova));
    expect(await enviar(false, true)).toEqual({ estado: "ausencia-mantida", linha: proposta });
    expect(await enviar(false, true)).toEqual({ estado: "conflito", linha: maisNova });
    expect(await enviar(true)).toEqual({ estado: "conflito", linha: maisNova });
    expect(http.mock.calls.every((_, i) => pedido(i).metodo === "GET")).toBe(true);
  });

  it("confere o que realmente foi criado após uma inserção concorrente ou uma resposta perdida", async () => {
    const concorrente = { ...canonica, reps: 17, concluida: true };
    http.mockResolvedValueOnce(lista()).mockResolvedValueOnce(new Response(null, { status: 201 })).mockResolvedValueOnce(lista(concorrente))
      .mockResolvedValueOnce(lista()).mockRejectedValueOnce(new TypeError("conexão interrompida")).mockResolvedValueOnce(lista(canonica));
    expect(await enviar(true)).toEqual({ estado: "conflito", linha: concorrente });
    await expect(enviar(true)).rejects.toThrow();
    expect(await enviar(true)).toEqual({ estado: "confirmada", linha: canonica });
    expect(http.mock.calls.map((_, i) => pedido(i).metodo)).toEqual(["GET", "POST", "GET", "GET", "POST", "GET"]);
  });

  it("uma proposta incompleta permite conservar a ausência e nunca envia atribuição ao movimento anterior", async () => {
    const semMovimento = { id: local.id, user_id: conta, session_id: proposta.session_id };
    http.mockImplementation(async () => lista());
    const pedir = (manterAusencia: boolean) => conferirSerieRemota(conta, herdada, ["reps"], undefined, {
      insercao: semMovimento, confirmada: true, manterAusencia,
    });
    expect(await pedir(false)).toEqual({ estado: "confirmar-insercao", linha: semMovimento });
    expect(await pedir(true)).toEqual({ estado: "ausencia-mantida", linha: semMovimento });
    expect(http.mock.calls.map((_, i) => pedido(i).metodo)).toEqual(["GET", "GET"]);
  });
});
