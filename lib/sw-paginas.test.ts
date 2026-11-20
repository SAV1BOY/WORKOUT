import { afterEach, describe, expect, it, vi } from "vitest";
import { guardarPagina, lerPagina, respostaAteOPrazo } from "@/lib/sw-paginas";

const pedido = (rota: string) => new Request(`https://treino.example/${rota}`);
const dia = 24 * 60 * 60 * 1000;

function cacheDeTeste() {
  const entradas = new Map<string, { chave: Request; resposta: Response }>();
  return {
    keys: async (pedido?: Request) => [...entradas.values()].map(entrada => entrada.chave)
      .filter(chave => !pedido || chave.url === pedido.url),
    match: async (pedido: Request) => entradas.get(pedido.url)?.resposta,
    put: async (chave: Request, resposta: Response) => {
      entradas.delete(chave.url);
      entradas.set(chave.url, { chave, resposta });
    },
    delete: async (chave: Request) => entradas.delete(chave.url),
  } as unknown as Cache;
}

afterEach(() => vi.useRealTimers());

describe("prazo da navegação", () => {
  it("distingue recusa imediata, chegada rápida e pedido ainda sem resposta aos oito segundos", async () => {
    vi.useFakeTimers();
    const resposta = new Response("página");
    await expect(respostaAteOPrazo(Promise.resolve(resposta), 8000)).resolves.toBe(resposta);
    await expect(respostaAteOPrazo(Promise.reject(Error("sem conexão")), 8000)).resolves.toBe("falhou");
    expect(vi.getTimerCount()).toBe(0);

    const rede = Promise.withResolvers<Response>();
    const recebeu = vi.fn();
    const primeiro = respostaAteOPrazo(rede.promise, 8000).then(recebeu);
    await vi.advanceTimersByTimeAsync(7999);
    expect(recebeu).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await primeiro;
    expect(recebeu).toHaveBeenCalledExactlyOnceWith("demorou");
    rede.resolve(resposta);
    await expect(rede.promise).resolves.toBe(resposta);
    expect(recebeu).toHaveBeenCalledTimes(1);
  });
});

describe("cache dos documentos e do RSC", () => {
  it("expira após 24 horas mesmo quando não há Date e respeita a data da origem quando ela é mais antiga", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T00:00:00Z"));
    const cache = cacheDeTeste();
    const legada = vi.fn();
    const html = new Response("roteiro");
    await guardarPagina(cache, pedido("treino"), html, "publicado", legada);
    const velha = new Response("outra", { headers: { Date: "Wed, 18 Nov 2026 00:00:00 GMT" } });
    await guardarPagina(cache, pedido("velha"), velha, "publicado", legada);
    expect(await lerPagina(cache, pedido("velha"), legada)).toBeUndefined();
    await vi.advanceTimersByTimeAsync(dia);
    expect(await lerPagina(cache, pedido("treino"), legada)).toBe(html);
    await vi.advanceTimersByTimeAsync(1);
    expect(await lerPagina(cache, pedido("treino"), legada)).toBeUndefined();
    await guardarPagina(cache, pedido("nova"), new Response(), "publicado", legada);
    expect(await cache.keys()).toHaveLength(1);
    expect(legada).not.toHaveBeenCalled();
  });

  it("preserva cópias válidas do Serwist e as substitui com metadados locais", async () => {
    const cache = cacheDeTeste();
    const html = new Response("anterior");
    const legada = vi.fn(async (url: string) => url.endsWith("antiga"));
    await cache.put(pedido("atual"), html);
    await cache.put(pedido("antiga"), new Response());
    expect(await lerPagina(cache, pedido("atual"), legada)).toBe(html);
    expect(await lerPagina(cache, pedido("antiga"), legada)).toBeUndefined();
    const rsc = new Request(pedido("atual"), { headers: { RSC: "1" } });
    const resposta = new Response("RSC", { headers: { Vary: "RSC" } });
    await guardarPagina(cache, rsc, resposta, "publicado", legada);
    const [chave] = await cache.keys();
    expect(chave?.headers.get("RSC")).toBe("1");
    expect(await cache.match(rsc)).toBe(resposta);
    expect([...rsc.headers]).toEqual([["rsc", "1"]]);
    expect(legada).toHaveBeenCalledWith(pedido("antiga").url);
  });

  it("respostas marcadas com outro build não substituem o documento nem o RSC do worker", async () => {
    const cache = cacheDeTeste();
    const legada = vi.fn();
    for (const rota of ["treino", "treino?_rsc=1"]) {
      const existente = new Response("deste build", { headers: { "X-Treino-Build": "A" } });
      await guardarPagina(cache, pedido(rota), existente, "A", legada);
      const atrasada = new Response("de outro build", { headers: { "X-Treino-Build": "B" } });
      await guardarPagina(cache, pedido(rota), atrasada, "A", legada);
      expect(await lerPagina(cache, pedido(rota), legada)).toBe(existente);
    }
  });

  it("uma limpeza pendente preserva a nova gravação da mesma rota", async () => {
    const cache = cacheDeTeste();
    const legada = vi.fn();
    for (let i = 0; i < 32; i++) await guardarPagina(cache, pedido(String(i)), new Response(), "publicado", legada);
    const listou = Promise.withResolvers<void>();
    const liberar = Promise.withResolvers<void>();
    const listar = cache.keys.bind(cache);
    vi.spyOn(cache, "keys").mockImplementationOnce(async () => {
      const antigas = await listar();
      listou.resolve();
      await liberar.promise;
      return antigas;
    });
    const primeira = guardarPagina(cache, pedido("32"), new Response(), "publicado", legada);
    await listou.promise;
    const nova = new Response("atualizada");
    await guardarPagina(cache, pedido("0"), nova, "publicado", legada);
    liberar.resolve();
    await primeira;
    expect(await lerPagina(cache, pedido("0"), legada)).toBe(nova);
    expect(await cache.keys()).toHaveLength(32);
  });

  it("um corpo retido conserva a cópia anterior e permite guardar outra rota dentro do limite", async () => {
    const cache = cacheDeTeste();
    const legada = vi.fn();
    for (let i = 0; i < 32; i++) await guardarPagina(cache, pedido(String(i)), new Response(), "A", legada);
    const anterior = await cache.match(pedido("0"));
    const liberar = Promise.withResolvers<void>();
    const gravar = cache.put.bind(cache);
    vi.spyOn(cache, "put").mockImplementationOnce(async (chave, resposta) => {
      await liberar.promise;
      await gravar(chave, resposta);
    });
    const atualizada = new Response("recarregada");
    const demorada = guardarPagina(cache, pedido("0"), atualizada, "A", legada);
    const nova = new Response("outra rota");
    try {
      await guardarPagina(cache, pedido("32"), nova, "A", legada);
      expect(await lerPagina(cache, pedido("32"), legada)).toBe(nova);
      expect(await lerPagina(cache, pedido("0"), legada)).toBe(anterior);
      expect(await cache.keys()).toHaveLength(32);
    } finally {
      liberar.resolve();
      await demorada;
    }
    expect(await lerPagina(cache, pedido("0"), legada)).toBe(atualizada);
  });

  it("retém as últimas 32 gravações sem deslocar uma cópia válida por uma resposta de erro", async () => {
    const cache = cacheDeTeste();
    const legada = vi.fn();
    for (let i = 0; i < 32; i++) await guardarPagina(cache, pedido(String(i)), new Response(), "publicado", legada);
    const atualizada = new Response("de novo");
    await guardarPagina(cache, pedido("0"), atualizada, "publicado", legada);
    await guardarPagina(cache, pedido("32"), new Response(), "publicado", legada);
    await guardarPagina(cache, pedido("0"), new Response(null, { status: 503 }), "publicado", legada);
    expect(await cache.keys()).toHaveLength(32);
    expect(await lerPagina(cache, pedido("0"), legada)).toBe(atualizada);
    expect(await lerPagina(cache, pedido("1"), legada)).toBeUndefined();
    expect(legada).not.toHaveBeenCalled();
  });
});
