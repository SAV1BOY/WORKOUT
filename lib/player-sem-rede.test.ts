import { stringToBase64URL } from "@supabase/ssr";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { correspondeAoCookie, guardarVinculoDoPlayer, recuperarPerfilNoTreino, vinculoDoLoginAtual, vinculoParaAbaLocal, vinculoParaPlayerLocal } from "@/lib/player-sem-rede";
import { chaveDoHistoricoNoDisco } from "@/lib/chaves-do-historico";
import { CHAVE_CACHE, VALIDADE_MS } from "@/lib/persistencia-query";
import type { LinhaPerfil } from "@/lib/types";
import { idDoPlayerNoCaminho, impressaoDoLogin, type VinculoDoPlayer } from "@/lib/vinculo-do-player";

const id = "b2194b1c-6fe1-4d09-b036-3d1d453d40d7";
const projeto = "https://projeto.supabase.co";
const chave = "anon-publica-de-teste";
const nome = "sb-projeto-auth-token";
const disco = new Map<string, unknown>();
const cache = { get: vi.fn() };
const sessaoAtiva = { get: vi.fn() };
vi.mock("@/lib/db", () => ({
  bd: () => ({ sessaoAtiva, cache }),
  temIndexedDB: () => true,
  lerCache: async (k: string) => disco.get(k) ?? null,
  guardarCache: async (k: string, v: unknown) => { disco.set(k, v); },
}));

function cookie(token: string, fracionado = false): string {
  const bruto = "base64-" + stringToBase64URL(JSON.stringify({
    access_token: token, expires_at: 1, refresh_token: "exemplo-local", user: { id: "id-declarado-sem-confianca" },
  }));
  return fracionado ? `${nome}.1=${bruto.slice(45)}; outro=x; ${nome}.0=${bruto.slice(0, 45)}` : `${nome}=${bruto}`;
}

async function confirmado(conta: string, token: string): Promise<VinculoDoPlayer> {
  return { conta, url: projeto, chave, impressao: await impressaoDoLogin(conta, projeto, chave, token) };
}

beforeEach(() => {
  disco.clear();
  cache.get.mockReset();
  sessaoAtiva.get.mockReset();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", { cookie: "" });
});
afterEach(() => vi.unstubAllGlobals());

describe("abas do aparelho quando falta o documento", () => {
  function perfilDe(user_id: string): LinhaPerfil {
    return {
      user_id, nome: user_id, altura_cm: null, data_inicio: "2026-09-14", fase_atual: "fase1",
      fase_desde: "2026-09-14", objetivo: "Meu treino", semana_corrida: 1, semana_corda: 1,
      semana_fixa: 1, ultimo_treino: null, prefs: { guia_visto: true },
    };
  }
  function guardarPerfil(conta: string, salvoEm = Date.now()) {
    disco.set(CHAVE_CACHE, { salvoEm, estado: { queries: [{
      queryKey: ["perfil"], state: { data: perfilDe(conta), dataUpdatedAt: salvoEm },
    }] } });
  }

  it("o calendário requer um perfil recente da própria conta, inclusive para quem ainda não tem histórico", async () => {
    document.cookie = cookie("login-a");
    const vinculo = await confirmado("ana", "login-a");
    await guardarVinculoDoPlayer(vinculo);
    expect(await vinculoParaAbaLocal("/calendario")).toBeNull();
    guardarPerfil("bia");
    expect(await vinculoParaAbaLocal("/calendario")).toBeNull();
    guardarPerfil("ana", Date.now() - VALIDADE_MS - 1);
    expect(await vinculoParaAbaLocal("/calendario")).toBeNull();
    guardarPerfil("ana");
    expect((await vinculoParaAbaLocal("/calendario"))?.vinculo).toEqual(vinculo);
    document.cookie = cookie("login-b");
    expect(await vinculoParaAbaLocal("/calendario")).toBeNull();
  });

  it("Treino exige perfil recente do mesmo login e Relatório exige também o histórico dessa conta", async () => {
    document.cookie = cookie("login-a");
    const vinculo = await confirmado("ana", "login-a");
    await guardarVinculoDoPlayer(vinculo);
    expect(await vinculoParaAbaLocal("/")).toBeNull();
    guardarPerfil("bia");
    expect(await vinculoParaAbaLocal("/")).toBeNull();
    guardarPerfil("ana", Date.now() - VALIDADE_MS - 1);
    expect(await vinculoParaAbaLocal("/")).toBeNull();
    const agora = Date.now();
    guardarPerfil("ana", agora);
    const local = { vinculo, perfil: { valor: perfilDe("ana"), atualizadoEm: agora } };
    expect(await vinculoParaAbaLocal("/")).toEqual(local);
    disco.set(chaveDoHistoricoNoDisco("bia"), [{ user_id: "bia" }]);
    expect(await vinculoParaAbaLocal("/relatorio")).toBeNull();
    disco.set(chaveDoHistoricoNoDisco("ana"), [{ user_id: "bia" }]);
    expect(await vinculoParaAbaLocal("/relatorio")).toBeNull();
    disco.set(chaveDoHistoricoNoDisco("ana"), []);
    expect(await vinculoParaAbaLocal("/relatorio")).toEqual(local);
    disco.set(chaveDoHistoricoNoDisco("ana"), [{ user_id: "ana" }]);
    expect(await vinculoParaAbaLocal("/relatorio")).toEqual(local);
    document.cookie = cookie("login-b");
    expect(await vinculoParaAbaLocal("/relatorio")).toBeNull();
    document.cookie = "";
    expect(await vinculoParaAbaLocal("/")).toBeNull();
  });

  it("antes da gravação do cache geral entrega para a tela exatamente o perfil confirmado da conta", async () => {
    document.cookie = cookie("login-a");
    const vinculo = await confirmado("ana", "login-a");
    await guardarVinculoDoPlayer(vinculo);
    const perfil = perfilDe("ana");
    const item = { chave: "perfil-lido:ana", valor: perfil, atualizadoEm: Date.now() };
    cache.get.mockImplementation(async (chave: string) => chave === item.chave ? item : undefined);
    expect(await vinculoParaAbaLocal("/")).toEqual({ vinculo, perfil: { valor: perfil, atualizadoEm: item.atualizadoEm } });
    guardarPerfil("bia");
    expect(await vinculoParaAbaLocal("/")).toBeNull();
  });

  it("usa a cópia avulsa com a data original enquanto a rede consulta o perfil e aceita a resposta posterior", async () => {
    document.cookie = cookie("login-a");
    await guardarVinculoDoPlayer(await confirmado("ana", "login-a"));
    const perfil = perfilDe("ana");
    const atualizadoEm = Date.now() - 2_000;
    cache.get.mockResolvedValue({ valor: perfil, atualizadoEm });
    const cliente = new QueryClient();
    const rede = Promise.withResolvers<LinhaPerfil>();
    const consulta = cliente.fetchQuery({ queryKey: ["perfil"], queryFn: () => rede.promise });
    await recuperarPerfilNoTreino(cliente, "ana", new AbortController().signal);
    expect(cliente.getQueryState(["perfil"])).toMatchObject({ data: perfil, dataUpdatedAt: atualizadoEm, fetchStatus: "fetching" });
    const recente = { ...perfil, nome: "Perfil atualizado" };
    rede.resolve(recente);
    await consulta;
    expect(cliente.getQueryData(["perfil"])).toEqual(recente);
  });

  it.each(["edição", "logout", "troca de login", "tela fechada"])(
    "descarta a cópia antiga se durante a leitura houve %s", async situacao => {
      document.cookie = cookie("login-a");
      await guardarVinculoDoPlayer(await confirmado("ana", "login-a"));
      const perfil = perfilDe("ana");
      const leitura = Promise.withResolvers<{ valor: LinhaPerfil; atualizadoEm: number }>();
      const noDisco = Promise.withResolvers<void>();
      cache.get.mockImplementationOnce(() => { noDisco.resolve(); return leitura.promise; });
      const cliente = new QueryClient();
      const controle = new AbortController();
      const recuperando = recuperarPerfilNoTreino(cliente, "ana", controle.signal);
      await noDisco.promise;
      const agora = Date.now();
      const editado = { ...perfil, nome: "Nome editado" };
      if (situacao === "edição") cliente.setQueryData(["perfil"], editado, { updatedAt: agora });
      if (situacao === "logout") disco.clear();
      if (situacao === "troca de login") document.cookie = cookie("login-b");
      if (situacao === "tela fechada") controle.abort();
      leitura.resolve({ valor: perfil, atualizadoEm: agora - 2_000 });
      await recuperando;
      expect(cliente.getQueryData(["perfil"])).toEqual(situacao === "edição" ? editado : undefined);
    },
  );

  it("não preenche o cliente de um documento que pertence a outra conta", async () => {
    document.cookie = cookie("login-b");
    await guardarVinculoDoPlayer(await confirmado("bia", "login-b"));
    cache.get.mockResolvedValue({ valor: perfilDe("bia"), atualizadoEm: Date.now() });
    const cliente = new QueryClient();
    await recuperarPerfilNoTreino(cliente, "ana", new AbortController().signal);
    expect(cliente.getQueryData(["perfil"])).toBeUndefined();
  });

  it("usa a cópia mais recente se o snapshot chegou primeiro e mantém a edição quando as datas coincidem", async () => {
    document.cookie = cookie("login-a");
    await guardarVinculoDoPlayer(await confirmado("ana", "login-a"));
    const perfil = perfilDe("ana");
    const recente = { ...perfil, nome: "Leitura mais recente" };
    const agora = Date.now();
    const cliente = new QueryClient();
    cache.get.mockResolvedValue({ valor: recente, atualizadoEm: agora });
    cliente.setQueryData(["perfil"], perfil, { updatedAt: agora - 2_000 });
    const sinal = new AbortController().signal;
    await recuperarPerfilNoTreino(cliente, "ana", sinal);
    expect(cliente.getQueryData(["perfil"])).toEqual(recente);
    const editado = { ...perfil, nome: "Edição local" };
    cliente.setQueryData(["perfil"], editado, { updatedAt: agora });
    await recuperarPerfilNoTreino(cliente, "ana", sinal);
    expect(cliente.getQueryData(["perfil"])).toEqual(editado);
  });

  it("a versão anterior pode abrir o histórico salvo da própria conta na primeira recarga sem rede", async () => {
    document.cookie = cookie("login-a");
    const vinculo = await confirmado("ana", "login-a");
    await guardarVinculoDoPlayer(vinculo);
    for (const [linhas, esperado] of [
      [[], vinculo],
      [[{ user_id: "ana" }], vinculo],
      [[{ user_id: "bia" }], null],
      [[{ id: "sem-dono" }], null],
    ] as const) {
      disco.set(CHAVE_CACHE, { salvoEm: Date.now(), estado: { queries: [
        { queryKey: ["perfil"], state: { data: perfilDe("ana"), dataUpdatedAt: Date.now() } },
        { queryKey: ["progresso", "sessoes"], state: { data: linhas } },
      ] } });
      expect((await vinculoParaAbaLocal("/relatorio"))?.vinculo ?? null).toEqual(esperado);
    }
  });
});

describe("identidade na retomada do player sem rede", () => {
  it("considera só a rota inteira de uma sessão UUID", () => {
    expect(idDoPlayerNoCaminho(`/treinar/${id}`)).toBe(id);
    expect(idDoPlayerNoCaminho(`/treinar/${id}/`)).toBe(id);
    for (const rota of ["/~offline", "/", "/treinar", "/treinar/novo", `/treinar/${id}/extra`, `/mais/${id}`]) {
      expect(idDoPlayerNoCaminho(rota)).toBeNull();
    }
  });

  it("um token expirado ainda abre a cópia do dono quando é exatamente o confirmado antes, mesmo com cookies fragmentados", async () => {
    const token = "token-de-exemplo-confirmado-pelo-servidor";
    document.cookie = cookie(token, true);
    const vinculo = await confirmado("ana", token);
    await guardarVinculoDoPlayer(vinculo);
    sessaoAtiva.get.mockResolvedValue({ dados: { id, userId: "ana", status: "em_andamento" } });
    const rede = vi.fn();
    vi.stubGlobal("fetch", rede);
    expect(await vinculoParaPlayerLocal(id)).toEqual(vinculo);
    expect(rede).not.toHaveBeenCalled();
    expect(JSON.stringify([...disco.values()])).not.toContain(token);
    expect(JSON.stringify([...disco.values()])).not.toContain("exemplo-local");
  });

  it("uma linha do Dexie ou o user do cookie não autentica quem abre o endereço", async () => {
    document.cookie = cookie("token-ana");
    sessaoAtiva.get.mockResolvedValue({ dados: { id, userId: "ana", status: "em_andamento" } });
    expect(await vinculoParaPlayerLocal(id)).toBeNull();
    expect(sessaoAtiva.get).not.toHaveBeenCalled();
    const vinculo = await confirmado("ana", "token-ana");
    await guardarVinculoDoPlayer(vinculo);
    for (const invalido of ["", cookie("token-bia"), `${nome}.1=so-final`, `${nome}=quebrado`]) {
      document.cookie = invalido;
      expect(await vinculoParaPlayerLocal(id)).toBeNull();
    }
    document.cookie = cookie("token-ana");
    expect(await correspondeAoCookie({ ...vinculo, conta: "bia" }, document.cookie)).toBe(false);
    expect(await correspondeAoCookie({ ...vinculo, chave: "outra" }, document.cookie)).toBe(false);
    for (const dados of [{ id, userId: "bia", status: "em_andamento" }, { id, userId: "ana", status: "concluida" },
      { id: "outro", userId: "ana", status: "em_andamento" }, undefined]) {
      sessaoAtiva.get.mockResolvedValue({ dados });
      expect(await vinculoParaPlayerLocal(id)).toBeNull();
    }
  });

  it("substitui a impressão após renovação confirmada e ignora uma confirmação atrasada da conta anterior", async () => {
    const antes = await confirmado("ana", "antigo");
    document.cookie = cookie("antigo");
    await guardarVinculoDoPlayer(antes);
    const renovada = await confirmado("ana", "renovado");
    document.cookie = cookie("renovado");
    expect(await vinculoDoLoginAtual()).toBeNull();
    await guardarVinculoDoPlayer(renovada);
    await guardarVinculoDoPlayer(antes);
    expect(await vinculoDoLoginAtual()).toEqual(renovada);
    // O logout remove o registro com o resto do Dexie. Nem o token anterior sozinho é suficiente.
    disco.clear();
    expect(await vinculoDoLoginAtual()).toBeNull();
  });
});
