import { chaveDoDetalheDaSessao, prefixoDosDetalhesDaConta } from "@/lib/chaves-do-historico";
import { bd, temIndexedDB, type ItemCache } from "@/lib/db";
import { encerramentosPendentes } from "@/lib/queries/cache-do-detalhe";
import { VALIDADE_MS } from "@/lib/persistencia-query";
import { chaveDaLista } from "@/lib/queries/lista-do-relatorio";
import type { UltimaSerie } from "@/lib/queries/series-do-treino-passado";

export interface FonteDeSeries { atualizadoEm: number; linhas: UltimaSerie[] }
interface Fechamento extends FonteDeSeries { sessao: string; pendente: boolean }
export interface FontesDoAparelho { arquivo?: FonteDeSeries; fechamentos: Fechamento[] }

function lerFoto(item: ItemCache | undefined, conta: string, pedidos: Set<string>, pendentes: Set<string>): Fechamento | undefined {
  if (!item || !Array.isArray(item.valor)) return undefined;
  const sessao = item.chave.slice(prefixoDosDetalhesDaConta(conta).length);
  if (!item.valor.every(l => l?.user_id === conta && l.session_id === sessao && typeof l.id === "string")) return undefined;
  return { sessao, pendente: pendentes.has(sessao), atualizadoEm: item.atualizadoEm,
    linhas: item.valor.filter(l => pedidos.has(l.exercise_id)) };
}

/** Se o envio drenar durante o GET e outra aba já expurgar o detalhe, a leitura ainda conhece o fechamento. */
export async function fotosPendentes(conta: string, pedidos: Set<string>): Promise<Fechamento[]> {
  if (!temIndexedDB()) return [];
  const banco = bd();
  return banco.transaction("r", banco.cache, banco.outbox, async () => {
    const pendentes = await encerramentosPendentes(conta);
    const itens = await banco.cache.bulkGet([...pendentes].map(id => chaveDoDetalheDaSessao(conta, id)));
    return itens.flatMap(item => lerFoto(item, conta, pedidos, pendentes) ?? []);
  });
}

/** O expurgo e a gravação do relatório acontecem juntos. Leia a mesma versão das duas fontes. */
export async function fontesDoAparelho(
  conta: string, pedidos: Set<string>, desde: number, antes: Fechamento[] = [],
): Promise<FontesDoAparelho> {
  if (!temIndexedDB()) return { fechamentos: [] };
  const banco = bd();
  const prefixo = prefixoDosDetalhesDaConta(conta);
  const chaveGlobal = chaveDaLista("series", conta);
  return banco.transaction("r", banco.cache, banco.outbox, async () => {
    const pendentes = await encerramentosPendentes(conta);
    for (const foto of antes) pendentes.add(foto.sessao);
    const chaves = new Map<string, number>();
    let lerArquivo = false;
    // O índice devolve só datas e chaves. Evita deserializar um histórico inteiro já coberto pela leitura do player.
    await banco.cache.where("atualizadoEm").aboveOrEqual(desde).eachPrimaryKey((chave, cursor) => {
      const data = Number(cursor.key);
      if (chave === chaveGlobal && data > desde && Date.now() - data <= VALIDADE_MS) lerArquivo = true;
      if (chave.startsWith(prefixo)) chaves.set(chave, data);
    });
    const item = lerArquivo ? await banco.cache.get(chaveGlobal) : undefined;
    const arquivo = item && Array.isArray(item.valor) && item.valor.every(l => l?.user_id === conta && typeof l.id === "string")
      ? { atualizadoEm: item.atualizadoEm, linhas: item.valor.filter(l => pedidos.has(l.exercise_id)) as UltimaSerie[] } : undefined;
    const limite = Math.max(desde, arquivo?.atualizadoEm ?? 0);
    const paraLer = new Set([...chaves].filter(([, data]) => data >= limite).map(([chave]) => chave));
    for (const id of pendentes) paraLer.add(chaveDoDetalheDaSessao(conta, id));
    const fotos = await banco.cache.bulkGet([...paraLer]);
    const fechamentos = fotos.flatMap(item => lerFoto(item, conta, pedidos, pendentes) ?? []);
    if (!arquivo) {
      const presentes = new Set(fechamentos.map(f => f.sessao));
      fechamentos.push(...antes.filter(f => !presentes.has(f.sessao)));
    }
    return { arquivo, fechamentos };
  });
}

export function combinarFechamentos(
  id: string, base: FonteDeSeries, locais: FontesDoAparelho,
): UltimaSerie[] {
  const fonte = locais.arquivo && locais.arquivo.atualizadoEm > base.atualizadoEm ? locais.arquivo : base;
  const substituir = locais.fechamentos.filter(f => f.pendente || f.atualizadoEm >= fonte.atualizadoEm);
  const porSessao = new Set(substituir.map(f => f.sessao));
  // Até um fechamento vazio é a resposta completa daquela sessão. Não duplique séries nem ressuscite desmarcações.
  return [...fonte.linhas.filter(s => s.exercise_id === id && !porSessao.has(s.session_id)),
    ...substituir.flatMap(f => f.linhas.filter(s => s.exercise_id === id))];
}
