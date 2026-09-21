import { beforeEach, describe, expect, it } from "vitest";
import { CACHE_DE_SOCORRO } from "@/lib/caches-do-worker";
import { criarServirDoSocorro } from "@/lib/sw-servir-socorro";

/** Um Cache Storage de mentira, com o pouco que o degrau usa. */
class CacheFalso {
  itens = new Map<string, Response>();
  async match(
    chave: RequestInfo | URL,
    opcoes?: CacheQueryOptions,
  ): Promise<Response | undefined> {
    const pedida = String(chave);
    const direto = this.itens.get(pedida);
    if (direto) return direto;
    if (!opcoes?.ignoreSearch) return undefined;
    const semBusca = pedida.split("?")[0];
    for (const [chaveGuardada, resposta] of this.itens) {
      if (chaveGuardada.split("?")[0] === semBusca) return resposta;
    }
    return undefined;
  }
}

class ArmazenamentoFalso {
  abertos = new Map<string, CacheFalso>();
  async keys(): Promise<string[]> {
    return [...this.abertos.keys()];
  }
  async open(nome: string): Promise<CacheFalso> {
    const existente = this.abertos.get(nome);
    if (existente) return existente;
    const novo = new CacheFalso();
    this.abertos.set(nome, novo);
    return novo;
  }
}

let armazenamento: ArmazenamentoFalso;

function montar() {
  return criarServirDoSocorro(armazenamento as unknown as CacheStorage);
}

beforeEach(() => {
  armazenamento = new ArmazenamentoFalso();
});

const CHUNK = "https://treino-terraco.vercel.app/_next/static/chunks/p1.js";

describe("o último degrau de um asset (SPEC §22.11)", () => {
  it("serve o pedaço que a autocura guardou", async () => {
    const cache = await armazenamento.open(CACHE_DE_SOCORRO);
    cache.itens.set(CHUNK, new Response("o pedaço"));

    const resposta = await montar()(CHUNK);

    expect(await resposta?.text()).toBe("o pedaço");
  });

  it("ignora o `?dpl=` que o Next pendura no endereço", async () => {
    const cache = await armazenamento.open(CACHE_DE_SOCORRO);
    cache.itens.set(CHUNK, new Response("o pedaço"));

    expect(await montar()(`${CHUNK}?dpl=abc123`)).toBeTruthy();
  });

  /*
   * O cache `socorro` só tem a `/~offline` e os pedaços dela: qualquer outro
   * pedido tem de sair daqui sem resposta, para o erro seguir o seu caminho.
   */
  it("não responde pelo que não é dele", async () => {
    const cache = await armazenamento.open(CACHE_DE_SOCORRO);
    cache.itens.set(CHUNK, new Response("o pedaço"));

    expect(
      await montar()("https://treino-terraco.vercel.app/_next/static/chunks/outro.js"),
    ).toBeUndefined();
  });

  /*
   * No aparelho recém-despejado o cache nem existe, e
   * `caches.match(url, { cacheName })` rejeita nesse caso. Um degrau que lança
   * derrubaria a resposta inteira.
   */
  it("aparelho sem o cache `socorro`: devolve nada, sem lançar", async () => {
    await expect(montar()(CHUNK)).resolves.toBeUndefined();
  });

  it("armazenamento quebrado: devolve nada, sem lançar", async () => {
    const quebrado = {
      keys: async () => {
        throw new DOMException("sem Cache Storage");
      },
    } as unknown as CacheStorage;

    await expect(criarServirDoSocorro(quebrado)(CHUNK)).resolves.toBeUndefined();
  });
});
