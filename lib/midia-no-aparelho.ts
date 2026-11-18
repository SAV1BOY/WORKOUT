import { CACHE_DO_CATALOGO, CACHE_DE_MIDIA } from "@/lib/caches-do-worker";

export const LIMITE_CATALOGO = 12 * 1024 * 1024;

/** O Cache Storage devolve as chaves na ordem em que entraram. */
export function quantasRemover(tamanhos: number[], limite: number): number {
  let total = tamanhos.reduce((n, bytes) => n + bytes, 0);
  let retirar = 0;
  while (total > limite && retirar < tamanhos.length) {
    total -= tamanhos[retirar] ?? 0;
    retirar++;
  }
  return retirar;
}

async function bytes(cache: Cache, chave: Request): Promise<number> {
  const resposta = await cache.match(chave);
  if (!resposta) return 0;
  const tamanho = resposta.headers.get("content-length");
  return tamanho && Number.isFinite(Number(tamanho)) ? Number(tamanho) : (await resposta.blob()).size;
}

async function inventario(cache: Cache) {
  const chaves = await cache.keys();
  const tamanhos = await Promise.all(chaves.map(chave => bytes(cache, chave)));
  return { chaves, tamanhos };
}

export async function tamanhoDaMidia(nome: typeof CACHE_DO_CATALOGO | typeof CACHE_DE_MIDIA) {
  if (!await caches.has(nome)) return 0;
  const { tamanhos } = await inventario(await caches.open(nome));
  return tamanhos.reduce((total, tamanho) => total + tamanho, 0);
}

let limitando: Promise<void> | null = null;
let alterado = false;
export function limitarCatalogo(): Promise<void> {
  alterado = true;
  if (!limitando) {
    limitando = (async () => {
      const cache = await caches.open(CACHE_DO_CATALOGO);
      while (alterado) {
        alterado = false;
        const { chaves, tamanhos } = await inventario(cache);
        const cortar = quantasRemover(tamanhos, LIMITE_CATALOGO);
        await Promise.all(chaves.slice(0, cortar).map(chave => cache.delete(chave)));
      }
    })().finally(() => { limitando = null; });
  }
  return limitando;
}

/** Instalações antigas guardavam fotos e figuras no mesmo cache público. */
export async function separarCacheAntigo() {
  if (!await caches.has(CACHE_DE_MIDIA)) return;
  const antigo = await caches.open(CACHE_DE_MIDIA);
  const fotos = (await antigo.keys()).filter(chave => /^\/(fotos|itens|mapa-muscular)\//.test(new URL(chave.url).pathname));
  if (!fotos.length) return;
  const catalogo = await caches.open(CACHE_DO_CATALOGO);
  for (const chave of fotos) {
    if (!await catalogo.match(chave)) {
      const resposta = await antigo.match(chave);
      if (!resposta) continue;
      try {
        await catalogo.put(chave, resposta);
      } catch {
        // Sem espaço para uma segunda cópia: preserve a imagem original.
        continue;
      }
    }
    await antigo.delete(chave);
  }
  await limitarCatalogo();
}
