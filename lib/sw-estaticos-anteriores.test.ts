import { describe, expect, it, vi } from "vitest";
import { estaticoDoBuild, limparPrecacheDaAtualizacao, servirEstaticoDoBuild } from "@/lib/sw-estaticos-anteriores";

const origem = "https://treino.example";
const js = (hash: string) => origem + "/_next/static/chunks/app/(app)/relatorio/page-" + hash + ".js";
const antigo = js("00000047"), atual = js("00000048"), seguinte = js("00000049");
const comum = origem + "/_next/static/chunks/2162.c87c2632f5773dcc.js";
const css = origem + "/_next/static/css/d0c75736374f010d.css";
const fonte = origem + "/_next/static/media/6c1234567890abcd-s.p.woff2";
const interrupcao = js("eeeeeeee");
const html = origem + "/~offline?__WB_REVISION__=agora";

function resposta(tipo: string, status = 200) {
  return new Response("arquivo", { status, headers: { "Content-Type": tipo } });
}

function precacheDeTeste() {
  const entradas = new Map<string, Response>();
  const cache = {
    keys: async () => [...entradas.keys()].map(url => new Request(url)),
    match: async (url: string) => entradas.get(url)?.clone(),
    put: async (url: string, valor: Response) => { entradas.set(url, valor); },
    delete: async (pedido: Request) => entradas.delete(pedido.url),
  };
  return { entradas, cache: cache as unknown as Cache };
}

describe("estáticos que as abas abertas ainda podem pedir ao atualizar", () => {
  it("retém uma geração e o manifesto atual, inclusive ao reativar a mesma versão", async () => {
    const { entradas, cache } = precacheDeTeste();
    const privados = [origem + "/relatorio", origem + "/relatorio?_rsc=1", origem + "/api/conta", "https://fora.example/_next/static/chunks/app-aaaaaaaa.js"];
    for (const url of [antigo, atual, comum, ...privados]) entradas.set(url, resposta("text/javascript"));
    entradas.set(css, resposta("text/css; charset=utf-8"));
    entradas.set(fonte, resposta("font/woff2"));
    entradas.set(html, resposta("text/html"));
    const erro = js("aaaaaaaa"), parcial = js("bbbbbbbb");
    entradas.set(erro, resposta("text/html")); // um erro da origem salvo debaixo de um hash
    entradas.set(parcial, resposta("application/javascript", 206));
    await limparPrecacheDaAtualizacao(cache, [atual, comum, html], "48", origem);
    for (const url of [antigo, atual, comum, css, fonte, html]) expect(entradas.has(url)).toBe(true);
    for (const url of [erro, parcial, ...privados]) expect(entradas.has(url)).toBe(false);

    // Uma tentativa de instalar outra versão lançou arquivos no precache compartilhado.
    entradas.set(interrupcao, resposta("application/javascript"));
    await limparPrecacheDaAtualizacao(cache, [atual, comum, html], "48", origem);
    expect(entradas.has(interrupcao)).toBe(false);
    expect(entradas.has(antigo)).toBe(true);

    entradas.set(seguinte, resposta("application/javascript"));
    entradas.set(interrupcao, resposta("application/javascript"));
    await limparPrecacheDaAtualizacao(cache, [seguinte, comum, html], "49", origem);
    for (const url of [atual, seguinte, comum, html]) expect(entradas.has(url)).toBe(true);
    for (const url of [antigo, css, fonte, interrupcao]) expect(entradas.has(url)).toBe(false);
  });

  it("mantém a versão anterior se o aparelho não puder confirmar o índice da nova", async () => {
    const { entradas, cache } = precacheDeTeste();
    entradas.set(antigo, resposta("text/javascript"));
    entradas.set(atual, resposta("text/javascript"));
    await limparPrecacheDaAtualizacao(cache, [atual], "48", origem);
    entradas.set(seguinte, resposta("text/javascript"));
    vi.spyOn(cache, "put").mockRejectedValue(new Error("sem espaço"));
    await expect(limparPrecacheDaAtualizacao(cache, [seguinte], "49", origem)).rejects.toThrow("sem espaço");
    for (const url of [antigo, atual, seguinte]) expect(entradas.has(url)).toBe(true);
  });

  it("serve o import tardio do precache pelo hash, inclusive com o dpl do Next", async () => {
    const match = vi.fn(async () => resposta("application/javascript; charset=utf-8"));
    const armazenamento = { match } as unknown as CacheStorage;
    const url = comum + "?dpl=anterior";
    expect(await (await servirEstaticoDoBuild(url, origem, armazenamento, "precache"))?.text()).toBe("arquivo");
    expect(match).toHaveBeenCalledWith(url, { cacheName: "precache", ignoreSearch: true });
    match.mockResolvedValueOnce(resposta("text/html")).mockRejectedValueOnce(new Error("aparelho sem cache"));
    await expect(servirEstaticoDoBuild(url, origem, armazenamento, "precache")).resolves.toBeUndefined();
    await expect(servirEstaticoDoBuild(url, origem, armazenamento, "precache")).resolves.toBeUndefined();
    for (const proibido of [origem + "/relatorio", origem + "/_next/static/chunks/qualquer.js", comum + "?conta=123"]) {
      expect(estaticoDoBuild(proibido, origem)).toBe(false);
      await expect(servirEstaticoDoBuild(proibido, origem, armazenamento, "precache")).resolves.toBeUndefined();
    }
    expect(match).toHaveBeenCalledTimes(3);
  });
});
