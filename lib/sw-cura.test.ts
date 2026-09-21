import { beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE_DE_SOCORRO, OFFLINE } from "@/lib/caches-do-worker";
import { ESPERA_ENTRE_IDAS, criarCura } from "@/lib/sw-cura";

/** Um Cache Storage de mentira, com o pouco que a cura usa. */
class CacheFalso {
  itens = new Map<string, Response>();
  async match(chave: RequestInfo | URL): Promise<Response | undefined> {
    return this.itens.get(String(chave));
  }
  async put(chave: RequestInfo | URL, resposta: Response): Promise<void> {
    this.itens.set(String(chave), resposta);
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

function pagina(texto: string, extras: { redirected?: boolean; status?: number } = {}) {
  const resposta = new Response(texto, { status: extras.status ?? 200 });
  if (extras.redirected) {
    Object.defineProperty(resposta, "redirected", { value: true });
  }
  return resposta;
}

let armazenamento: ArmazenamentoFalso;
let relogio: number;

function montar(opcoes: {
  precache?: Response | undefined;
  rede?: () => Promise<Response>;
}) {
  const doPrecache = vi.fn(async () => opcoes.precache);
  const buscar = vi.fn(
    opcoes.rede ??
      (async () => {
        throw new TypeError("Failed to fetch");
      }),
  );
  const garantir = criarCura({
    doPrecache,
    armazenamento: armazenamento as unknown as CacheStorage,
    buscar: buscar as unknown as (url: string, init: RequestInit) => Promise<Response>,
    agora: () => relogio,
  });
  return { garantir, doPrecache, buscar };
}

async function oQueEstaGuardado(): Promise<string | null> {
  const cache = armazenamento.abertos.get(CACHE_DE_SOCORRO);
  const guardado = await cache?.match(OFFLINE);
  return guardado ? await guardado.text() : null;
}

beforeEach(() => {
  armazenamento = new ArmazenamentoFalso();
  relogio = 1_000_000;
});

describe("a autocura do socorro (SPEC §22.10)", () => {
  /*
   * O achado da auditoria de 21/09: a primeira versão só rodava no `activate`,
   * onde o precache SEMPRE está inteiro, e saía por "já tem" sem guardar nada.
   * O cache "socorro" nunca nascia. Aqui o caminho normal é justamente o que
   * guarda a cópia.
   */
  it("na ativação tira a cópia do precache, sem tocar na rede", async () => {
    const { garantir, buscar } = montar({ precache: pagina("a /~offline") });

    expect(await garantir({ renovar: true })).toBe("copiou-do-precache");

    expect(await oQueEstaGuardado()).toBe("a /~offline");
    expect(buscar).not.toHaveBeenCalled();
  });

  it("depois de guardada, não refaz o trabalho a cada navegação", async () => {
    const { garantir, doPrecache, buscar } = montar({ precache: pagina("a /~offline") });
    await garantir({ renovar: true });

    expect(await garantir()).toBe("ja-tinha");
    expect(doPrecache).toHaveBeenCalledTimes(1);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("renovar troca a cópia velha pela do build novo", async () => {
    const primeira = montar({ precache: pagina("build antigo") });
    await primeira.garantir({ renovar: true });

    const segunda = montar({ precache: pagina("build novo") });
    expect(await segunda.garantir({ renovar: true })).toBe("copiou-do-precache");
    expect(await oQueEstaGuardado()).toBe("build novo");
  });

  it("renovar com o precache vazio mantém a cópia que já existe", async () => {
    const primeira = montar({ precache: pagina("a /~offline") });
    await primeira.garantir({ renovar: true });

    const segunda = montar({ precache: undefined });
    expect(await segunda.garantir({ renovar: true })).toBe("ja-tinha");
    expect(await oQueEstaGuardado()).toBe("a /~offline");
    expect(segunda.buscar).not.toHaveBeenCalled();
  });

  /*
   * O caso que faz a autocura valer a pena: o navegador despejou o precache
   * muito depois do último `activate`. A navegação seguinte que chega ao
   * servidor repõe a cópia.
   */
  it("sem precache, busca a página na rede e guarda", async () => {
    const { garantir, buscar } = montar({
      precache: undefined,
      rede: async () => pagina("a /~offline da rede"),
    });

    expect(await garantir()).toBe("baixou");
    expect(await oQueEstaGuardado()).toBe("a /~offline da rede");
    expect(buscar).toHaveBeenCalledWith(OFFLINE, expect.objectContaining({ cache: "no-store" }));
  });

  it("sem precache e sem rede, não guarda nada", async () => {
    const { garantir } = montar({ precache: undefined });

    expect(await garantir()).toBe("sem-fonte");
    expect(await oQueEstaGuardado()).toBeNull();
  });

  it("não guarda o que veio de desvio nem o que não é 200", async () => {
    const desviada = montar({
      precache: undefined,
      rede: async () => pagina("tela do portal do WiFi", { redirected: true }),
    });
    expect(await desviada.garantir()).toBe("sem-fonte");
    expect(await oQueEstaGuardado()).toBeNull();

    const errada = montar({
      precache: undefined,
      rede: async () => pagina("não encontrada", { status: 404 }),
    });
    expect(await errada.garantir()).toBe("sem-fonte");
    expect(await oQueEstaGuardado()).toBeNull();
  });

  it("não insiste na rede a cada navegação, mas volta a tentar depois", async () => {
    let entrega = false;
    const { garantir, buscar } = montar({
      precache: undefined,
      rede: async () => {
        if (!entrega) throw new TypeError("Failed to fetch");
        return pagina("a /~offline");
      },
    });

    expect(await garantir()).toBe("sem-fonte");
    expect(await garantir()).toBe("esperando");
    expect(buscar).toHaveBeenCalledTimes(1);

    relogio += ESPERA_ENTRE_IDAS + 1;
    entrega = true;
    expect(await garantir()).toBe("baixou");
    expect(buscar).toHaveBeenCalledTimes(2);
  });

  it("duas navegações ao mesmo tempo baixam a página uma vez só", async () => {
    let soltar: (() => void) | undefined;
    const espera = new Promise<void>((resolve) => {
      soltar = resolve;
    });
    const { garantir, buscar } = montar({
      precache: undefined,
      rede: async () => {
        await espera;
        return pagina("a /~offline");
      },
    });

    const duas = Promise.all([garantir(), garantir()]);
    soltar?.();
    expect(await duas).toEqual(["baixou", "baixou"]);
    expect(buscar).toHaveBeenCalledTimes(1);
  });
});
