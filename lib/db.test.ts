import { afterEach, describe, expect, it } from "vitest";
import {
  CACHE_DE_MIDIA,
  CACHE_DE_SOCORRO,
  PREFIXO_DO_PRECACHE,
  ehCachePublico,
} from "@/lib/caches-do-worker";
import { limparDadosLocais } from "@/lib/db";

/** O nome que o Serwist dá ao precache em produção. */
const PRECACHE = `${PREFIXO_DO_PRECACHE}-v2-https://treino-terraco.vercel.app/`;

type CachesFalso = { apagados: string[] } & Partial<CacheStorage>;

function comCaches(nomes: string[]): CachesFalso {
  const restantes = [...nomes];
  const falso: CachesFalso = {
    apagados: [],
    keys: async () => [...restantes],
    delete: async (nome: string) => {
      falso.apagados.push(nome);
      const onde = restantes.indexOf(nome);
      if (onde >= 0) restantes.splice(onde, 1);
      return onde >= 0;
    },
  };
  (globalThis as { caches?: unknown }).caches = falso;
  return falso;
}

afterEach(() => {
  delete (globalThis as { caches?: unknown }).caches;
});

describe("o que o 'Sair' apaga deste aparelho (SPEC §8 com §22.10)", () => {
  /*
   * O defeito de 21/09 medido pela auditoria: o logout levava o precache
   * junto — 154 entradas viravam cache inexistente — e o aparelho ficava sem
   * PWA nenhum até o deploy seguinte, porque o Serwist só repõe o precache
   * numa instalação nova e o `sw.js` não mudou de bytes. Offline, depois de
   * sair, o app não abria de jeito nenhum.
   */
  it("poupa o precache do Serwist: é o app assado no build, não é do usuário", async () => {
    const caches = comCaches([PRECACHE, "paginas"]);

    await limparDadosLocais();

    expect(caches.apagados).not.toContain(PRECACHE);
    expect(await caches.keys?.()).toContain(PRECACHE);
  });

  it("poupa a mídia e a cópia de socorro, que são conteúdo público", async () => {
    const caches = comCaches([CACHE_DE_MIDIA, CACHE_DE_SOCORRO]);

    await limparDadosLocais();

    expect(caches.apagados).toEqual([]);
  });

  /*
   * O outro lado da moeda, que é o ponto da §8: o que o usuário viu continua
   * indo embora. "paginas" guarda telas autenticadas — num celular emprestado
   * dava para lê-las offline depois do logout.
   */
  it("apaga as páginas autenticadas e qualquer outro cache", async () => {
    const caches = comCaches([PRECACHE, "paginas", "next-data", "outro-qualquer"]);

    await limparDadosLocais();

    expect(caches.apagados.sort()).toEqual(["next-data", "outro-qualquer", "paginas"]);
  });

  it("não lança quando o aparelho não tem Cache Storage", async () => {
    delete (globalThis as { caches?: unknown }).caches;
    await expect(limparDadosLocais()).resolves.toBeUndefined();
  });
});

describe("ehCachePublico", () => {
  it("diz sim só para o que é do app", () => {
    expect(ehCachePublico(CACHE_DE_MIDIA)).toBe(true);
    expect(ehCachePublico(CACHE_DE_SOCORRO)).toBe(true);
    expect(ehCachePublico(PRECACHE)).toBe(true);
    expect(ehCachePublico(`${PREFIXO_DO_PRECACHE}-v2-http://127.0.0.1:3100/`)).toBe(true);

    expect(ehCachePublico("paginas")).toBe(false);
    expect(ehCachePublico("fotos-do-usuario")).toBe(false);
    expect(ehCachePublico("serwist-runtime")).toBe(false);
  });
});
