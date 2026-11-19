/** Só arquivos públicos cujo próprio nome identifica seu conteúdo. */
export function estaticoDoBuild(endereco: string, origem: string): boolean {
  const url = new URL(endereco);
  if (url.origin !== origem || [...url.searchParams.keys()].some(chave => chave !== "__WB_REVISION__" && chave !== "dpl")) return false;
  const caminho = url.pathname;
  return /^\/_next\/static\/chunks\/(?:[^/]+\/)*[^/]+[.-][a-f\d]{8,}\.js$/i.test(caminho) ||
    /^\/_next\/static\/css\/[a-f\d]{8,}\.css$/i.test(caminho) ||
    /^\/_next\/static\/media\/[a-f\d]{8,}(?:-[\w.-]+)?\.woff2?$/i.test(caminho);
}

function contemArquivo(endereco: string, resposta?: Response): boolean {
  if (resposta?.status !== 200 || resposta.redirected) return false;
  const tipo = resposta.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
  const caminho = new URL(endereco).pathname;
  if (caminho.endsWith(".js")) return tipo === "application/javascript" || tipo === "text/javascript";
  if (caminho.endsWith(".css")) return tipo === "text/css";
  return tipo === "font/woff" || tipo === "font/woff2";
}

interface Indice {
  build: string;
  atuais: string[];
  anteriores: string[];
}

function ehIndice(valor: unknown): valor is Indice {
  return typeof valor === "object" && valor !== null &&
    "build" in valor && typeof valor.build === "string" &&
    "atuais" in valor && Array.isArray(valor.atuais) &&
    "anteriores" in valor && Array.isArray(valor.anteriores);
}

/**
 * Roda somente na ativação bem-sucedida. O precache do Serwist é o mesmo entre
 * builds. Guardar as chaves aqui dispensa copiar ou baixar o conteúdo novamente.
 */
export async function limparPrecacheDaAtualizacao(
  cache: Cache, manifesto: Iterable<string>, build: string, origem: string,
): Promise<void> {
  const enderecoDoIndice = new URL("/__treino_indice_estaticos__", origem).href;
  const resposta = await cache.match(enderecoDoIndice);
  const indice: unknown = resposta ? await resposta.json().catch(() => null) : null;
  const chaves = new Set(manifesto);
  const pedidos = await cache.keys();
  const publicos = pedidos.map(pedido => pedido.url).filter(url => estaticoDoBuild(url, origem));
  // No primeiro upgrade, o precache antigo ainda não tinha um índice. Nos
  // próximos, arquivos de instalações interrompidas não pertencem ao build ativo.
  const ultimaGeracao = ehIndice(indice)
    ? new Set(indice.build === build ? indice.anteriores : indice.atuais)
    : new Set(publicos);
  const aposentados = publicos.filter(url => !chaves.has(url) && ultimaGeracao.has(url));
  const arquivos = await Promise.all(aposentados.map(async url => contemArquivo(url, await cache.match(url))));
  const anteriores = aposentados.filter((_, i) => arquivos[i]);
  const atuais = [...chaves].filter(url => estaticoDoBuild(url, origem));
  await cache.put(enderecoDoIndice, Response.json({ build, atuais, anteriores } satisfies Indice));
  const conservar = new Set([...chaves, ...anteriores, enderecoDoIndice]);
  await Promise.all(pedidos.filter(pedido => !conservar.has(pedido.url)).map(pedido => cache.delete(pedido)));
}

/** Uma aba ainda aberta pode fazer o primeiro import deste hash após a atualização. */
export async function servirEstaticoDoBuild(
  url: string, origem: string, armazenamento: CacheStorage, precache: string,
): Promise<Response | undefined> {
  if (!estaticoDoBuild(url, origem)) return undefined;
  try {
    const resposta = await armazenamento.match(url, { cacheName: precache, ignoreSearch: true });
    return contemArquivo(url, resposta) ? resposta : undefined;
  } catch {
    return undefined;
  }
}
