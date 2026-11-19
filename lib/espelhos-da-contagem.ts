import { liveQuery } from "dexie";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { chaveDoDetalheDaSessao } from "@/lib/chaves-do-historico";
import { chaveIntencao } from "@/lib/campos-de-contagem";
import type { CampoContagem, CorrecaoDeContagem } from "@/lib/contagens-pendentes";
import { bd } from "@/lib/db";
import { atualizarDetalhesExistentes } from "@/lib/queries/cache-do-detalhe";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import type { Linha } from "@/lib/backup";
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

function alterarConsultasPersistidas(valor: unknown, alterar: (chave: QueryKey, dados: unknown) => unknown) {
  if (!registro(valor) || !registro(valor.estado) || !Array.isArray(valor.estado.queries)) return valor;
  const { estado } = valor;
  const queries = atualizarLista(estado.queries as unknown[], q => {
    if (!registro(q) || !Array.isArray(q.queryKey) || !registro(q.state)) return q;
    const data = alterar(q.queryKey, q.state.data);
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
    const valor = item.chave === CHAVE_CACHE ? alterarConsultasPersistidas(item.valor, (chave, dados) =>
      consultaDeSeries(chave, id) ? corrigirLinhas(dados, id, correcoes) : dados)
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

type SerieConfirmada = Linha & { id: string; user_id: string; session_id: string; exercise_id?: string };
type Conciliacao = { origem: string; serie: SerieConfirmada; ausente?: boolean };
const PREFIXO = "ultima-conciliacao-de-serie:";
const PREFIXO_LINHA = "linha-de-serie-conciliada:";

function identificada(linha: Linha): linha is SerieConfirmada {
  return ["id", "user_id", "session_id", "exercise_id"].every(c => typeof linha[c] === "string" && linha[c]);
}

/** Uma única linha confirmada não comprova cobertura nem atualiza a data das demais. */
function conciliarLista(dados: unknown, serie: SerieConfirmada, pertence: boolean, incluir: boolean): unknown {
  if (registro(dados) && Array.isArray(dados.linhas)) {
    const linhas = conciliarLista(dados.linhas, serie, pertence, incluir);
    return linhas === dados.linhas ? dados : { ...dados, linhas };
  }
  if (!Array.isArray(dados)) return dados;
  let encontrou = false;
  const linhas = dados.flatMap(linha => {
    if (!registro(linha) || linha.id !== serie.id || linha.user_id !== serie.user_id) return [linha];
    if (encontrou || !pertence) { encontrou = true; return []; }
    encontrou = true;
    return [{ ...linha, ...serie }];
  });
  if (!encontrou && pertence && incluir) linhas.push(serie);
  return encontrou || (pertence && incluir) ? linhas : dados;
}

function conciliarConsulta(chave: QueryKey, dados: unknown, c: Conciliacao): unknown {
  const [grupo, fonte, dono, sessao] = chave;
  const s = c.serie;
  if (c.ausente) {
    const id = { conta: s.user_id, sessaoId: c.origem, serieId: s.id };
    const afetada = consultaDeSeries(chave, id) || (grupo === "series" || (grupo === "progresso" && fonte === "series-da-sessao" && dono === s.user_id));
    return afetada ? conciliarLista(dados, s, false, false) : dados;
  }
  const trabalho = s.tipo === "trabalho" && s.concluida === true;
  if (grupo === "series") return conciliarLista(dados, s, fonte === s.session_id, false);
  if (grupo === "ultimas-series" && fonte === s.user_id && typeof dono === "string") {
    return conciliarLista(dados, s, trabalho && dono.split(",").includes(s.exercise_id ?? "") && sessao !== s.session_id, true);
  }
  if (grupo === "series-anteriores" && typeof fonte === "string") {
    return conciliarLista(dados, s, trabalho && fonte.split(",").includes(s.exercise_id ?? ""), false);
  }
  if (grupo !== "progresso") return dados;
  if (fonte === "series-ex") return conciliarLista(dados, s, dono === s.exercise_id, false);
  if (fonte === "series" && typeof dono === "string") {
    return conciliarLista(dados, s, typeof s.registrada_em === "string" && s.registrada_em >= dono, false);
  }
  if (fonte === "series-todas" && (dono === s.user_id || chave.length === 2)) {
    return conciliarLista(dados, s, true, dono === s.user_id);
  }
  if (fonte === "series-da-sessao" && dono === s.user_id) {
    return conciliarLista(dados, s, sessao === s.session_id && s.concluida === true, true);
  }
  return dados;
}

/** O marcador só muda quando uma correção é conciliada. Não depende do relógio do telefone. */
export async function revisaoDasSeries(conta: string) {
  const item = await bd().cache.get(PREFIXO + conta);
  return typeof item?.valor === "object" && item.valor && "revisao" in item.valor ? Number(item.valor.revisao) : 0;
}

async function mesclarEscritasPosteriores(serie: SerieConfirmada) {
  let atual = serie;
  // As operações capturadas pela correção já saíram desta transação. Um novo backup ou uma
  // série editada durante a chamada ao servidor ainda precisa prevalecer neste aparelho.
  for (const item of await bd().outbox.where("tipo").equals("serie").toArray()) {
    const p = item.payload as EscritaTabela & { operacaoGuardada?: "upsert" | "insert"; seriesEmConciliacao?: string[] };
    if (p?.tabela !== "session_sets" || !["upsert", "insert", "update"].includes(p.op ?? p.operacaoGuardada) ||
      p.seriesEmConciliacao?.includes(chaveIntencao(serie.user_id, serie.id))) continue;
    for (const linha of p.linhas ?? (p.linha ? [p.linha] : [])) {
      if ((linha.id ?? p.filtro?.id) === serie.id && (linha.user_id ?? p.filtro?.user_id) === serie.user_id) {
        atual = { ...atual, ...linha };
      }
    }
  }
  return atual;
}

const outrosCamposLocais = {
  ...campoLocal, carga_kg: "cargaKg", assistencia: "assistencia", concluida: "concluida", registrada_em: "registradaEm",
} as const;

async function conciliarSessaoAberta(conta: string, origem: string, local: Linha, s: SerieConfirmada, ausente: boolean) {
  for (const sessaoId of new Set([origem, s.session_id, local.session_id as string])) {
    const salva = await bd().sessaoAtiva.get(sessaoId);
    const sessao = salva?.dados as SessaoLocal | undefined;
    if (!salva || sessao?.userId !== conta || sessao.id !== sessaoId || !Array.isArray(sessao.blocos)) continue;
    function trocar<T extends RegistroDoExercicioTrocado>(bloco: T): T {
      if (!Array.isArray(bloco.series) || !bloco.series.some(v => v.id === s.id)) return bloco;
      const mesmoLugar = !ausente && sessaoId === s.session_id && bloco.exercicioId === s.exercise_id && bloco.ordem === s.ordem_ex;
      const series = bloco.series.flatMap(serie => {
        if (serie.id !== s.id) return [serie];
        if (!mesmoLugar) return []; // A posição antiga já não possui este registro.
        const nova = { ...serie, tipo: s.tipo as SerieLocal["tipo"], setIndex: s.set_index as number };
        for (const [remoto, campo] of Object.entries(outrosCamposLocais)) {
          if (!(remoto in s)) continue;
          // Um campo já editado na tela aberta pode ainda não ter sido marcado e enfileirado.
          if (remoto in local && serie[campo] !== local[remoto]) continue;
          Object.assign(nova, { [campo]: s[remoto] });
        }
        if (nova.tempoS !== serie.tempoS) delete nova.medicaoCronometro;
        return [nova];
      });
      return { ...bloco, series };
    }
    const blocos = atualizarLista(sessao.blocos, bloco => {
      const ativo = trocar(bloco);
      if (!bloco.trocados) return ativo;
      const trocados = atualizarLista(bloco.trocados, trocar);
      return trocados === bloco.trocados ? ativo : { ...ativo, trocados };
    });
    if (blocos !== sessao.blocos) await bd().sessaoAtiva.put({ ...salva, dados: { ...sessao, blocos } });
  }
}

/** A retirada da operação da fila e estas cópias pertencem à mesma transação. */
export async function reconciliarCopiasDaSerie(conta: string, local: Linha, canonica: Linha, origem?: Linha) {
  if (!identificada(canonica) || canonica.user_id !== conta || local.user_id !== conta ||
    local.id !== canonica.id || typeof local.session_id !== "string") throw new Error("A série confirmada mudou de conta ou de identificador.");
  const serie = await mesclarEscritasPosteriores(canonica);
  await atualizarCopiasConfirmadas(conta, local, { origem: sessaoDeOrigem(conta, serie.id, local.session_id, origem), serie });
}

/** A leitura por UUID e conta confirmou a ausência. Somente as cópias desse UUID podem sair. */
export async function retirarSerieAusenteDasCopias(conta: string, local: Linha, origem?: Linha) {
  if (local.user_id !== conta || typeof local.id !== "string" || typeof local.session_id !== "string") {
    throw new Error("A série ausente precisa estar identificada nesta conta e neste treino.");
  }
  const referencia = { id: local.id, user_id: conta, session_id: local.session_id };
  const posterior = await mesclarEscritasPosteriores(referencia);
  const sessaoOriginal = sessaoDeOrigem(conta, local.id, local.session_id, origem);
  await atualizarCopiasConfirmadas(conta, local, { origem: sessaoOriginal, serie: posterior, ausente: !identificada(posterior) });
}

function sessaoDeOrigem(conta: string, serie: string, sessao: string, origem?: Linha) {
  return origem?.user_id === conta && origem.id === serie && typeof origem.session_id === "string" ? origem.session_id : sessao;
}

async function atualizarCopiasConfirmadas(conta: string, local: Linha, c: Conciliacao) {
  const { serie, ausente = false } = c;
  await atualizarDetalhesExistentes(conta, [ausente ? { ...serie, concluida: false } : serie]);
  await conciliarSessaoAberta(conta, c.origem, local, serie, ausente);
  const cache = bd().cache;
  const jogador = `series-anteriores-do-player:${conta}:`;
  const globais = [`series-do-historico-v2:${conta}`, `series-do-historico:${conta}`];
  const chaves = [...globais, CHAVE_CACHE, ...await cache.where("chave").startsWith(jogador).primaryKeys()];
  for (const item of await cache.bulkGet(chaves)) {
    if (!item) continue;
    let valor;
    if (item.chave === CHAVE_CACHE) {
      valor = alterarConsultasPersistidas(item.valor, (chave, dados) => conciliarConsulta(chave, dados, c));
    } else if (globais.includes(item.chave)) {
      // Arquivo com dono e UUID em todas as linhas já era completo. Uma projeção legada continua parcial.
      const completa = Array.isArray(item.valor) && item.valor.every(l => l?.user_id === conta && typeof l.id === "string");
      valor = conciliarLista(item.valor, serie, !ausente, !ausente && completa);
    } else {
      const partes = item.chave.slice(jogador.length);
      const exercicio = partes.slice(0, partes.lastIndexOf(":"));
      const pertence = !ausente && serie.exercise_id === exercicio && serie.tipo === "trabalho" && serie.concluida === true &&
        registro(item.valor) && item.valor.ignorada !== serie.session_id;
      valor = conciliarLista(item.valor, serie, pertence, true);
    }
    if (valor !== item.valor) await cache.put({ ...item, valor });
  }
  const revisao = 1 + await revisaoDasSeries(conta);
  const atualizadoEm = Date.now();
  // Uma aba suspensa pode observar várias conciliações de uma vez. Conserve a última
  // linha por UUID, sem acumular o histórico das correções de uma mesma série.
  await cache.bulkPut([
    { chave: PREFIXO + conta, atualizadoEm, valor: { revisao } },
    { chave: PREFIXO_LINHA + conta + ":" + serie.id, atualizadoEm, valor: { ...c, revisao } },
  ]);
}

export function observarConciliacoesDeSeries(cliente: QueryClient) {
  if (typeof indexedDB === "undefined") return () => {};
  let anteriores: Map<string, number> | undefined;
  const assinatura = liveQuery(() => bd().cache.where("chave").startsWith(PREFIXO_LINHA).toArray()).subscribe(itens => {
    const atuais = new Map<string, number>();
    const alteradas: Conciliacao[] = [];
    for (const item of itens) {
      const c = item.valor as Conciliacao & { revisao: number };
      if (!c?.serie || (!c.ausente && !identificada(c.serie)) || item.chave !== PREFIXO_LINHA + c.serie.user_id + ":" + c.serie.id) continue;
      atuais.set(item.chave, c.revisao);
      if (anteriores && anteriores.get(item.chave) !== c.revisao) alteradas.push(c);
    }
    anteriores = atuais;
    if (!alteradas.length) return;
    const filtro = { predicate: (q: { queryKey: QueryKey }) => alteradas.some(c =>
      [c.origem, c.serie.session_id].some(sessaoId => consultaDeSeries(q.queryKey, { conta: c.serie.user_id, sessaoId, serieId: c.serie.id }))) };
    void cliente.cancelQueries(filtro, { revert: false, silent: true });
    for (const q of cliente.getQueryCache().findAll(filtro)) {
      let data = q.state.data;
      for (const c of alteradas) data = conciliarConsulta(q.queryKey, data, c);
      if (data !== q.state.data) cliente.setQueryData(q.queryKey, data, { updatedAt: q.state.dataUpdatedAt });
    }
    void cliente.invalidateQueries(filtro);
  });
  return () => assinatura.unsubscribe();
}
