import { CABECALHO_DO_BUILD } from "@/lib/sw-navegacao";

/** A geração que recebeu a navegação também recebe a gravação e a limpeza. */
export const VALIDADE_DA_PAGINA_S = 24 * 60 * 60;
const LIMITE_DE_PAGINAS = 32;
const GRAVADA_EM = "X-Treino-Cache-Gravado-Em";

type ExpirouNoCacheAntigo = (url: string) => Promise<boolean>;

function foraDaValidade(tempo: number): boolean {
  return tempo < Date.now() - VALIDADE_DA_PAGINA_S * 1000;
}

function chaveVencida(chave: Request, expirouNoCacheAntigo: ExpirouNoCacheAntigo) {
  const gravada = chave.headers.get(GRAVADA_EM);
  return gravada ? foraDaValidade(Number(gravada)) : expirouNoCacheAntigo(chave.url);
}

// Uma varredura pode receber as chaves logo antes de outra navegação substituir uma delas.
const gravacoes = new Set<Request>();
const limpezas = new Set<Set<string>>();

export async function guardarPagina(cache: Cache, pedido: Request, resposta: Response,
  build: string, expirouNoCacheAntigo: ExpirouNoCacheAntigo): Promise<void> {
  const buildDaResposta = resposta.headers.get(CABECALHO_DO_BUILD);
  if (buildDaResposta && buildDaResposta !== build) return;
  if (resposta.status !== 200 && resposta.type !== "opaqueredirect") return;
  // A data fica só na chave local. O Response original mantém URL, redirecionamento e Vary.
  const headers = new Headers(pedido.headers);
  headers.set(GRAVADA_EM, String(Date.now()));
  const chave = new Request(pedido, { headers });
  gravacoes.add(chave);
  for (const preservadas of limpezas) preservadas.add(chave.url);
  try {
    await cache.put(chave, resposta);
  } finally {
    gravacoes.delete(chave);
  }

  // Proteja o que já estava sendo escrito e as gravações que começarem durante a leitura.
  const preservadas = new Set(Array.from(gravacoes, chave => chave.url));
  limpezas.add(preservadas);
  try {
    // Cache.keys() devolve as entradas na ordem de gravação (inclusive após substituir uma).
    const chaves = await cache.keys();
    const entradas = await Promise.all(chaves.map(async chave => ({
      chave, vencida: await chaveVencida(chave, expirouNoCacheAntigo),
    })));
    const livres = entradas.filter(({ chave }) => !preservadas.has(chave.url));
    const vencidas = livres.filter(entrada => entrada.vencida);
    const excedentes = Math.max(0, chaves.length - vencidas.length - LIMITE_DE_PAGINAS);
    const antigas = livres.filter(entrada => !entrada.vencida).slice(0, excedentes);
    await Promise.all([...vencidas, ...antigas].map(({ chave }) => cache.delete(chave)));
  } finally {
    limpezas.delete(preservadas);
  }
}

export async function lerPagina(cache: Cache, pedido: Request, expirouNoCacheAntigo: ExpirouNoCacheAntigo) {
  const [chave] = await cache.keys(pedido);
  if (!chave || await chaveVencida(chave, expirouNoCacheAntigo)) return undefined;
  const resposta = await cache.match(chave);
  if (!resposta || foraDaValidade(Date.parse(resposta.headers.get("Date") ?? ""))) return undefined;
  return resposta;
}

/** O prazo vale também quando a consulta ao cache não encontra a rota. */
export async function respostaAteOPrazo(rede: Promise<Response>, prazoMs: number): Promise<Response | "falhou" | "demorou"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<"demorou">(resolve => { timer = setTimeout(() => resolve("demorou"), prazoMs); });
  try {
    return await Promise.race([rede.catch(() => "falhou" as const), prazo]);
  } finally {
    clearTimeout(timer);
  }
}
