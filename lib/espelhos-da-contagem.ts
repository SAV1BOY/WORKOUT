import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { chaveDoDetalheDaSessao } from "@/lib/chaves-do-historico";
import type { CampoContagem, CorrecaoDeContagem } from "@/lib/contagens-pendentes";
import { bd } from "@/lib/db";
import { CHAVE_CACHE } from "@/lib/persistencia-query";
import type { BlocoLocal, RegistroDoExercicioTrocado, SerieLocal, SessaoLocal } from "@/lib/sessao";

const campoLocal: Record<CampoContagem, keyof SerieLocal> = {
  reps: "reps", reps_lado2: "repsLado2", tempo_s: "tempoS", tempo_s_lado2: "tempoSLado2",
  passos: "passos", reps_alvo_min: "repsAlvoMin", reps_alvo_max: "repsAlvoMax",
};

type Identidade = { conta: string; sessaoId: string; serieId: string };
type Correcoes = readonly CorrecaoDeContagem[];

function registro(valor: unknown): valor is Record<string, unknown> {
  return !!valor && typeof valor === "object" && !Array.isArray(valor);
}

function corrigirCampos<T extends object>(linha: T, correcoes: Correcoes, local = false): T {
  let resultado = linha;
  for (const { campo, fracionarios, inteiro } of correcoes) {
    const chave = local ? campoLocal[campo] : campo;
    const anterior = (linha as Record<string, unknown>)[chave];
    if (typeof anterior !== "number" || Number.isInteger(anterior) || !fracionarios.includes(anterior)) continue;
    resultado = { ...resultado, [chave]: inteiro };
  }
  return resultado;
}

/** Conserva a referência de coleções que não mudaram, inclusive consultas montadas de outras contas. */
function atualizarLista<T>(lista: T[], mudar: (item: T) => T): T[] {
  let alterada = false;
  const resultado = lista.map(item => {
    const novo = mudar(item);
    if (novo !== item) alterada = true;
    return novo;
  });
  return alterada ? resultado : lista;
}

function corrigirBloco<T extends RegistroDoExercicioTrocado>(bloco: T, serieId: string, correcoes: Correcoes): T {
  if (!Array.isArray(bloco?.series)) return bloco;
  const series = atualizarLista(bloco.series, s => {
    if (s?.id !== serieId) return s;
    const corrigida = corrigirCampos(s, correcoes, true);
    // A medição pertence ao valor anterior. Uma correção manual não retoma aquele cronômetro.
    if (s.medicaoCronometro && corrigida.tempoS !== s.tempoS) delete corrigida.medicaoCronometro;
    return corrigida;
  });
  return series === bloco.series ? bloco : { ...bloco, series };
}

function corrigirBlocos(blocos: BlocoLocal[], serieId: string, correcoes: Correcoes) {
  return atualizarLista(blocos, bloco => {
    const ativo = corrigirBloco(bloco, serieId, correcoes);
    const trocados = bloco?.trocados;
    if (!Array.isArray(trocados)) return ativo;
    const anteriores = atualizarLista(trocados, b => corrigirBloco(b, serieId, correcoes));
    return ativo === bloco && anteriores === trocados ? bloco : { ...ativo, trocados: anteriores };
  });
}

function corrigirLinhas(dados: unknown, id: Identidade, correcoes: Correcoes): unknown {
  if (Array.isArray(dados)) return atualizarLista(dados, linha =>
    registro(linha) && linha.id === id.serieId && linha.session_id === id.sessaoId && linha.user_id === id.conta
      ? corrigirCampos(linha, correcoes) : linha);
  if (!registro(dados) || !Array.isArray(dados.linhas)) return dados;
  const linhas = corrigirLinhas(dados.linhas, id, correcoes);
  return linhas === dados.linhas ? dados : { ...dados, linhas };
}

function consultaDeSeries(chave: QueryKey, id: Identidade) {
  const [grupo, fonte, conta, sessao] = chave;
  if (grupo === "series") return fonte === id.sessaoId;
  if (grupo === "series-anteriores") return true;
  if (grupo === "ultimas-series") return fonte === id.conta;
  if (grupo !== "progresso") return false;
  if (fonte === "series-da-sessao") return conta === id.conta && sessao === id.sessaoId;
  if (fonte === "series-todas") return chave.length === 2 || conta === id.conta;
  return fonte === "series-ex" || fonte === "series";
}

function corrigirConsultasPersistidas(valor: unknown, id: Identidade, correcoes: Correcoes) {
  if (!registro(valor) || !registro(valor.estado) || !Array.isArray(valor.estado.queries)) return valor;
  const { estado } = valor;
  const queries = atualizarLista(estado.queries as unknown[], q => {
    if (!registro(q) || !Array.isArray(q.queryKey) || !consultaDeSeries(q.queryKey, id) || !registro(q.state)) return q;
    const data = corrigirLinhas(q.state.data, id, correcoes);
    return data === q.state.data ? q : { ...q, state: { ...q.state, data } };
  });
  return queries === estado.queries ? valor : { ...valor, estado: { ...estado, queries } };
}

/** Dentro da transação da fila. A correção de um campo não é uma sincronização das outras linhas do arquivo. */
export async function corrigirCopiasDaSerie(conta: string, sessaoId: string, serieId: string, correcoes: Correcoes) {
  if (!correcoes.length) return;
  const banco = bd();
  const id = { conta, sessaoId, serieId };
  const salva = await banco.sessaoAtiva.get(sessaoId);
  const sessao = salva?.dados as SessaoLocal | undefined;
  if (salva && sessao?.id === sessaoId && sessao.userId === conta && Array.isArray(sessao.blocos)) {
    const blocos = corrigirBlocos(sessao.blocos, serieId, correcoes);
    if (blocos !== sessao.blocos) await banco.sessaoAtiva.put({ ...salva, dados: { ...sessao, blocos } });
  }

  const chaves = [
    chaveDoDetalheDaSessao(conta, sessaoId), `series-do-historico-v2:${conta}`, `series-do-historico:${conta}`, CHAVE_CACHE,
    ...await banco.cache.where("chave").startsWith(`series-anteriores-do-player:${conta}:`).primaryKeys(),
  ];
  for (const item of await banco.cache.bulkGet(chaves)) {
    if (!item) continue;
    const valor = item.chave === CHAVE_CACHE ? corrigirConsultasPersistidas(item.valor, id, correcoes)
      : corrigirLinhas(item.valor, id, correcoes);
    if (valor !== item.valor) await banco.cache.put({ ...item, valor });
  }
}

/** Depois do commit, acerta também o cache que a aba pode voltar a persistir antes de consultar a rede. */
export function corrigirConsultasDaSerie(cliente: QueryClient, conta: string, sessaoId: string, serieId: string, correcoes: Correcoes) {
  const id = { conta, sessaoId, serieId };
  for (const q of cliente.getQueryCache().findAll({ predicate: q => consultaDeSeries(q.queryKey, id) })) {
    const data = corrigirLinhas(q.state.data, id, correcoes);
    if (data !== q.state.data) cliente.setQueryData(q.queryKey, data, { updatedAt: q.state.dataUpdatedAt });
  }
}
