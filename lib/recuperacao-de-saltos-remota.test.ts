import { createClient, type Session } from "@supabase/supabase-js";
import { beforeEach, expect, it, vi } from "vitest";
import { conferirSaltosRemotos, podeInserirCardio } from "@/lib/recuperacao-de-saltos-remota";
import { clienteNavegador } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ clienteNavegador: vi.fn() }));
const http = vi.fn<typeof fetch>();
const conta = "ana";
const corda = { id: "cardio", user_id: conta, tipo: "corda", data: "2026-10-08", semana_plano: 1,
  planejado: { semana: 1, blocos: [{ tipo: "corda", s: 20 }] }, feito: { repeticoes_cumpridas: 2, decorrido_s: 121 },
  duracao_min: 2.1, distancia_km: null, saltos: 42, esforco: "moderado", notas: "Corda de quinta.", concluida: true };
const corrida = { ...corda, tipo: "corrida", data: "2026-10-09", distancia_km: 3.25, saltos: null,
  notas: "Nota da corrida", esforco: "forte", feito: { decorrido_s: 1408 } };
const lista = (...linhas: unknown[]) => Response.json(linhas);
function pedido(indice: number) {
  const [url, opcoes] = http.mock.calls[indice]!;
  return { url: new URL(String(url)), metodo: opcoes?.method, headers: new Headers(opcoes?.headers),
    dados: opcoes?.body ? JSON.parse(String(opcoes.body)) : null };
}
function autenticar(dona: string) {
  const cliente = createClient("https://supabase.test", "anon", { global: { fetch: http }, auth: { persistSession: false, autoRefreshToken: false } });
  vi.spyOn(cliente.auth, "getSession").mockResolvedValue({ data: { session: { user: { id: dona } } as Session }, error: null });
  vi.mocked(clienteNavegador).mockReturnValue(cliente);
}
beforeEach(() => { http.mockReset(); autenticar(conta); });

it("restaura a corda ausente com o mesmo UUID, nota, esforço, carga de trabalho e duração", async () => {
  const gravada = { ...corda, created_at: "2026-11-19T13:00:00Z" };
  http.mockResolvedValueOnce(lista()).mockResolvedValueOnce(new Response(null, { status: 201 })).mockResolvedValueOnce(lista(gravada));
  expect(await conferirSaltosRemotos(conta, corda)).toEqual({ estado: "confirmada", linha: gravada });
  expect(pedido(1).dados).toEqual(corda);
  expect(pedido(1).headers.get("Prefer")).toContain("resolution=ignore-duplicates");
  expect(pedido(1).url.searchParams.get("on_conflict")).toBe("id");
  for (const i of [0, 2]) {
    expect(pedido(i).url.pathname).toBe("/rest/v1/cardio_sessions");
    expect(Object.fromEntries(pedido(i).url.searchParams)).toEqual({ id: "eq.cardio", user_id: "eq.ana", select: "*" });
  }
});

it.each([corrida, { ...corda, data: "2026-10-10" }, { ...corda, concluida: false }])(
  "mantém o cardio que mudou de atividade, data ou conclusão, sem lhe transferir saltos", async alterada => {
    http.mockImplementation(async () => lista(alterada));
    expect(await conferirSaltosRemotos(conta, corda)).toEqual({ estado: "conflito", linha: alterada });
    expect((await conferirSaltosRemotos(conta, corda, { usar: "aparelho", observada: alterada })).estado).toBe("conflito");
    expect(await conferirSaltosRemotos(conta, corda, { usar: "historico", observada: alterada })).toEqual({ estado: "confirmada", linha: alterada });
    expect(http.mock.calls.every((_, i) => pedido(i).metodo === "GET")).toBe(true);
  },
);

it("um backup inserido por outra aba durante a criação conserva até os blocos e a nota da corrida", async () => {
  http.mockResolvedValueOnce(lista()).mockResolvedValueOnce(new Response(null, { status: 201 })).mockResolvedValueOnce(lista(corrida));
  expect(await conferirSaltosRemotos(conta, corda)).toEqual({ estado: "conflito", linha: corrida });
  expect(http).toHaveBeenCalledTimes(3);
});

it.each([[null, 42, "is.null"], [42, null, "eq.42"], [30, 0, "eq.30"]] as const)(
  "atualiza somente saltos de %s para %s na versão escolhida e devolve os demais campos atuais", async (anterior, escolhido, filtro) => {
    const observada = { ...corda, saltos: anterior };
    const maisNova = { ...corda, saltos: escolhido, notas: "Nota editada em outro aparelho.", esforco: "facil", duracao_min: 8.7 };
    http.mockResolvedValueOnce(lista(observada)).mockResolvedValueOnce(lista(maisNova));
    expect(await conferirSaltosRemotos(conta, { ...corda, saltos: escolhido }, { usar: "aparelho", observada }))
      .toEqual({ estado: "confirmada", linha: maisNova });
    expect(pedido(1).metodo).toBe("PATCH");
    expect(pedido(1).dados).toEqual({ saltos: escolhido });
    expect(Object.fromEntries(pedido(1).url.searchParams)).toEqual({
      select: "*", id: "eq.cardio", user_id: "eq.ana", tipo: "eq.corda", data: "eq.2026-10-08", concluida: "eq.true", saltos: filtro,
    });
  },
);

it("uma correção concorrente no histórico exige reler a escolha, inclusive se chegou durante o PATCH", async () => {
  const vista = { ...corda, saltos: 50 }, atual = { ...vista, saltos: 65 };
  http.mockResolvedValueOnce(lista(atual)).mockResolvedValueOnce(lista(vista)).mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista(atual));
  expect((await conferirSaltosRemotos(conta, corda, { usar: "historico", observada: vista })).estado).toBe("conflito");
  expect(await conferirSaltosRemotos(conta, corda, { usar: "aparelho", observada: vista })).toEqual({ estado: "conflito", linha: atual });
});

it("uma resposta perdida depois da gravação é confirmada com um novo GET sem repetir o PATCH", async () => {
  const vista = { ...corda, saltos: 50 }, escolha = { usar: "aparelho", observada: vista } as const;
  http.mockResolvedValueOnce(lista(vista)).mockRejectedValueOnce(new TypeError("conexão interrompida")).mockResolvedValueOnce(lista(corda));
  await expect(conferirSaltosRemotos(conta, corda, escolha)).rejects.toThrow();
  expect((await conferirSaltosRemotos(conta, corda, escolha)).estado).toBe("confirmada");
  expect(http.mock.calls.map((_, i) => pedido(i).metodo)).toEqual(["GET", "PATCH", "GET"]);
});

it("a confirmação perdida ao restaurar a corda não cria outra atividade na tentativa seguinte", async () => {
  const gravada = { ...corda, created_at: "2026-11-19T13:04:01Z" };
  http.mockResolvedValueOnce(lista()).mockRejectedValueOnce(new TypeError("resposta perdida")).mockResolvedValueOnce(lista(gravada));
  await expect(conferirSaltosRemotos(conta, corda)).rejects.toThrow();
  expect(await conferirSaltosRemotos(conta, corda)).toEqual({ estado: "confirmada", linha: gravada });
  expect(http.mock.calls.map((_, i) => pedido(i).metodo)).toEqual(["GET", "POST", "GET"]);
});

it("só insere a nova corda após confirmar a proposta, sem recuperar os saltos ou as notas do vínculo antigo", async () => {
  const proposta = { id: corda.id, user_id: conta, tipo: "corda", data: "2026-11-01", planejado: { semana: 2, blocos: [2, 3] } };
  const gravada = { ...proposta, planejado: { blocos: [2, 3], semana: 2 }, concluida: false,
    semana_plano: null, duracao_min: null, distancia_km: null, feito: null, esforco: null, notas: null, saltos: null };
  const conferir = (confirmada: boolean) => conferirSaltosRemotos(conta, corda, undefined, { insercao: proposta, confirmada });
  http.mockResolvedValueOnce(lista()).mockResolvedValueOnce(lista())
    .mockResolvedValueOnce(new Response(null, { status: 201 })).mockResolvedValueOnce(lista(gravada)).mockResolvedValueOnce(lista(gravada));
  expect(await conferir(false)).toEqual({ estado: "confirmar-insercao", linha: proposta });
  expect(await conferir(true)).toEqual({ estado: "confirmada", linha: gravada });
  expect(pedido(2).dados).toEqual(proposta);
  expect(await conferir(true)).toEqual({ estado: "confirmada", linha: gravada });
  expect(http.mock.calls.map((_, i) => pedido(i).metodo)).toEqual(["GET", "GET", "POST", "GET", "GET"]);
});

it("uma proposta de outro tipo ou sem data nunca é inserida e a ausência precisa ser lida antes de ser mantida", async () => {
  http.mockImplementation(async () => lista());
  const semTipo = { id: corda.id, user_id: conta, saltos: 42 };
  for (const proposta of [corrida, semTipo, { ...corda, data: "2026-02-31" }]) {
    expect(podeInserirCardio(proposta)).toBe(false);
    expect((await conferirSaltosRemotos(conta, corda, undefined, { insercao: proposta, confirmada: true })).estado).toBe("confirmar-insercao");
    expect((await conferirSaltosRemotos(conta, corda, undefined, { insercao: proposta, confirmada: false, manterAusencia: true })).estado).toBe("ausencia-mantida");
  }
  expect(http.mock.calls.every((_, i) => pedido(i).metodo === "GET")).toBe(true);
});

it("volta a apresentar a corrida que apareceu depois de a pessoa escolher manter a ausência", async () => {
  http.mockResolvedValueOnce(lista(corrida));
  const atual = await conferirSaltosRemotos(conta, corda, undefined, { insercao: corda, confirmada: false, manterAusencia: true });
  expect(atual).toEqual({ estado: "conflito", linha: corrida });
  expect(http.mock.calls.map((_, i) => pedido(i).metodo)).toEqual(["GET"]);
});

it("quando um backup mudou o dia, mesmo os saltos coincidentes da data antiga precisam ser conferidos", async () => {
  const outraData = { ...corda, data: "2026-11-01", notas: "Outra sessão de corda" };
  const ausencia = { insercao: outraData, confirmada: false };
  http.mockImplementation(async () => lista(corda));
  expect((await conferirSaltosRemotos(conta, corda, undefined, ausencia)).estado).toBe("conflito");
  expect((await conferirSaltosRemotos(conta, corda, { usar: "aparelho", observada: corda }, ausencia)).estado).toBe("conflito");
  expect(await conferirSaltosRemotos(conta, corda, { usar: "historico", observada: corda }, ausencia))
    .toEqual({ estado: "confirmada", linha: corda });
  expect(http.mock.calls.map((_, i) => pedido(i).metodo)).toEqual(["GET", "GET", "GET"]);
});

it("não efetua mutação quando a conta mudou, nem quando a quantidade está ausente, fracionária ou fora do limite", async () => {
  for (const saltos of [undefined, 42.5, -1, 2_147_483_648]) {
    await expect(conferirSaltosRemotos(conta, { ...corda, saltos })).rejects.toThrow("saltos");
  }
  autenticar("bia");
  await expect(conferirSaltosRemotos(conta, corda)).rejects.toThrow("conta");
  expect(http).not.toHaveBeenCalled();
  autenticar(conta);
  http.mockResolvedValueOnce(lista({ ...corda, user_id: "bia" }));
  await expect(conferirSaltosRemotos(conta, corda)).rejects.toThrow("desta conta");
  expect(http).toHaveBeenCalledOnce();
});
