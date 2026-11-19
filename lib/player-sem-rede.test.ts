import { stringToBase64URL } from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { correspondeAoCookie, guardarVinculoDoPlayer, vinculoDoLoginAtual, vinculoParaPlayerLocal } from "@/lib/player-sem-rede";
import { idDoPlayerNoCaminho, impressaoDoLogin, type VinculoDoPlayer } from "@/lib/vinculo-do-player";

const id = "b2194b1c-6fe1-4d09-b036-3d1d453d40d7";
const projeto = "https://projeto.supabase.co";
const chave = "anon-publica-de-teste";
const nome = "sb-projeto-auth-token";
const disco = new Map<string, unknown>();
const sessaoAtiva = { get: vi.fn() };
vi.mock("@/lib/db", () => ({
  bd: () => ({ sessaoAtiva }),
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
  sessaoAtiva.get.mockReset();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", { cookie: "" });
});
afterEach(() => vi.unstubAllGlobals());

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
