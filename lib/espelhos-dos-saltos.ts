import { liveQuery } from "dexie";
import { replaceEqualDeep, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { bd, temIndexedDB, type ItemSaida } from "@/lib/db";
import { fracionaria } from "@/lib/campos-de-contagem";
import { alterarConsultasPersistidas } from "@/lib/espelhos-da-contagem";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { CHAVE_CACHE } from "@/lib/persistencia-query";

export const CARDIOS_RECENTES = 120;
type Linha = Record<string, unknown>;
interface Mudanca {
  conta: string; id: string; linha: Linha | null; proposta: boolean; revisao: number;
}
const prefixo = (conta: string) => `cardio-conciliado:${conta}:`;
const chaveDaRevisao = (conta: string) => `revisao-dos-saltos:${conta}`;
const registro = (v: unknown): v is Linha => v !== null && typeof v === "object" && !Array.isArray(v);
export { fracionaria as saltosFracionarios };

export function cardioCorrespondeAoFiltro(linha: unknown, filtro: EscritaTabela["filtro"]): boolean {
  return registro(linha) && Object.entries(filtro ?? {}).every(([campo, valor]) => linha[campo] === valor);
}

/** Uma proposta só corrige a fração do próprio treino; data, notas, duração e tipo continuam sendo os da cópia lida. */
export function aplicarPropostaDosSaltos(anterior: Linha | undefined, proposta: Linha): Linha | undefined {
  if (!anterior) return proposta;
  if (anterior.id !== proposta.id || anterior.user_id !== proposta.user_id || anterior.tipo !== "corda" ||
    proposta.tipo !== "corda" || anterior.data !== proposta.data ||
    (Object.hasOwn(proposta, "concluida") && proposta.concluida !== anterior.concluida) || !fracionaria(anterior.saltos) ||
    (proposta.saltos !== null && !Number.isInteger(proposta.saltos))) return anterior;
  return { ...anterior, saltos: proposta.saltos };
}

function projeta(chave: QueryKey, valor: unknown, m: Mudanca): unknown {
  const [grupo, a, b, c] = chave;
  if (grupo === "cardio-sessao") {
    if (a !== m.id || (b !== undefined && b !== m.conta)) return valor;
    // Uma chave antiga sem conta só identifica seu dono através da própria linha.
    if (b === undefined && !(registro(valor) && valor.user_id === m.conta)) return valor;
    return m.proposta && m.linha ? aplicarPropostaDosSaltos(registro(valor) ? valor : undefined, m.linha) : m.linha;
  }
  if (grupo !== "cardio" && grupo !== "cardio-desde" && grupo !== "cardio-todos") return valor;
  const dono = grupo === "cardio" ? c : grupo === "cardio-desde" ? b : a;
  if (dono !== undefined && dono !== m.conta) return valor;
  if (registro(valor) && Array.isArray(valor.linhas)) {
    const linhas = projeta(chave, valor.linhas, m);
    return linhas === valor.linhas ? valor : { ...valor, linhas };
  }
  if (!Array.isArray(valor)) return valor;
  const antiga = valor.find(l => l?.id === m.id && l.user_id === m.conta);
  if (!antiga && dono !== m.conta) return valor;
  const linha = m.proposta && m.linha ? aplicarPropostaDosSaltos(antiga, m.linha) : m.linha;
  if (m.proposta && (!antiga || antiga === linha)) return valor;
  const pertence = linha && (grupo === "cardio-todos" || (typeof linha.data === "string" && typeof a === "string" &&
    linha.data >= a && (grupo === "cardio-desde" || (typeof b === "string" && linha.data <= b))));
  if (!antiga && !pertence) return valor;
  const novas = valor.filter(l => l?.id !== m.id || l.user_id !== m.conta);
  if (pertence) novas.push(linha);
  novas.sort((x, y) => String(y?.data ?? "").localeCompare(String(x?.data ?? "")));
  return grupo === "cardio-desde" ? novas.slice(0, CARDIOS_RECENTES) : novas;
}

export async function revisaoDoCardio(conta: string): Promise<number> {
  const r = (await bd().cache.get(chaveDaRevisao(conta)))?.valor;
  return typeof r === "number" && Number.isSafeInteger(r) ? r : 0;
}

export async function cardiosConfirmadosAusentes(conta: string, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const copias = await bd().cache.bulkGet(ids.map(id => prefixo(conta) + id));
  return new Set(copias.flatMap(item => {
    const m = item?.valor as Mudanca | undefined;
    return m?.conta === conta && !m.proposta && m.linha === null ? [m.id] : [];
  }));
}

/** Em uma leitura parcial, recupere só os UUIDs confirmados depois da data da cópia. */
export async function aplicarAlteracoesDoCardio<T>(conta: string, linhas: T[], desde: number, chave: QueryKey): Promise<T[]> {
  if (!temIndexedDB()) return linhas;
  let resultado: unknown = linhas;
  for (const item of await bd().cache.where("chave").startsWith(prefixo(conta)).toArray()) {
    const m = item.valor as Mudanca;
    if (m.conta !== conta || item.chave !== prefixo(conta) + m.id) continue;
    // O #53 podia gravar hoje a linha fracionária da fila por cima da corrida de ontem.
    // O Postgres nunca devolveu essa fração em sua coluna integer.
    const fracaoLegada = !m.proposta && Array.isArray(resultado) &&
      resultado.some(l => l?.user_id === conta && l.id === m.id && fracionaria(l.saltos));
    if (item.atualizadoEm >= desde || fracaoLegada) {
      resultado = projeta(chave, resultado, m);
    }
  }
  return resultado as T[];
}

async function guardar(conta: string, id: string, linha: Linha | null, proposta: boolean) {
  const banco = bd();
  const m: Mudanca = { conta, id, linha, proposta, revisao: await revisaoDoCardio(conta) + 1 };
  const historico = `cardio-do-historico:${conta}`;
  for (const item of await banco.cache.bulkGet([historico, CHAVE_CACHE])) {
    if (!item) continue;
    // As datas descrevem a confirmação de toda a consulta, não a edição deste UUID.
    const valor = item.chave === CHAVE_CACHE ? alterarConsultasPersistidas(item.valor, (chave, dados) => projeta(chave, dados, m))
      : projeta(["cardio-todos", conta], item.valor, m);
    if (valor !== item.valor) await banco.cache.put({ ...item, valor });
  }
  const atualizadoEm = Date.now();
  await banco.cache.bulkPut([{ chave: chaveDaRevisao(conta), valor: m.revisao, atualizadoEm },
    { chave: prefixo(conta) + id, valor: m, atualizadoEm }]);
}

export async function guardarPropostaDeSaltos(conta: string, origem: Linha, local: Linha) {
  if (origem.user_id !== conta || local.user_id !== conta || typeof local.id !== "string" || local.id !== origem.id) {
    throw new Error("A proposta de saltos precisa identificar a atividade da conta.");
  }
  const conhecida = (await bd().cache.get(prefixo(conta) + local.id))?.valor as Mudanca | undefined;
  // O treino que já chegou pelo backup continua acessível mesmo sem uma visita prévia ao Histórico.
  if (!conhecida || conhecida.proposta) await guardar(conta, local.id, local, true);
}

/** Uma edição posterior em outro aparelho substitui o comprovante antigo, inclusive na próxima abertura sem rede. */
export async function atualizarCardiosConciliados(conta: string, linhas: readonly unknown[], chave: QueryKey, revisao: number | undefined, sinal?: AbortSignal) {
  if (!revisao || !linhas.every(l => registro(l) && l.user_id === conta && typeof l.id === "string")) return;
  const banco = bd();
  await banco.transaction("rw", banco.cache, async () => {
    if (await revisaoDoCardio(conta) !== revisao) return;
    const porId = new Map(linhas.filter(registro).filter(l => l.user_id === conta).map(l => [l.id, l]));
    for (const item of await banco.cache.where("chave").startsWith(prefixo(conta)).toArray()) {
      const anterior = item.valor as Mudanca;
      const linha = porId.get(anterior.id);
      if (!linha && (anterior.proposta || (chave[0] !== "cardio-todos" && !(chave[0] === "cardio-sessao" && chave[1] === anterior.id)))) continue;
      if (anterior.proposta || replaceEqualDeep(anterior.linha, linha ?? null) !== anterior.linha) {
        sinal?.throwIfAborted();
        await guardar(conta, anterior.id, linha ?? null, false);
      }
    }
  });
}

/** Retém a representação do banco só quando um lote restaura uma atividade envolvida na recuperação de saltos. */
export async function observarCardiosDoBackup(item: ItemSaida, lote: Linha[]) {
  if (item.id === undefined || !temIndexedDB()) return;
  const banco = bd();
  const chave = (l: Linha) => typeof l.user_id === "string" && typeof l.id === "string" ? prefixo(l.user_id) + l.id : "";
  const identificados = new Set(lote.map(chave).filter(Boolean));
  const afetados = new Set((await banco.cache.bulkGet([...identificados])).flatMap(r => r ? [r.chave] : []));
  for (const outro of await banco.outbox.where("tipo").equals("cardio").toArray()) {
    if (outro.id === item.id) continue;
    const p = outro.payload as Partial<EscritaTabela> & { conciliacaoDosSaltos?: unknown };
    if (p?.tabela !== "cardio_sessions") continue;
    for (const l of p.linhas ?? (p.linha ? [p.linha] : [])) {
      if ((fracionaria(l.saltos) || p.conciliacaoDosSaltos) && identificados.has(chave(l))) afetados.add(chave(l));
    }
  }
  if (!afetados.size) return;
  return async (resposta: unknown) => {
    if (!Array.isArray(resposta)) throw new Error("O banco ainda não confirmou os cardios restaurados.");
    const confirmadas = resposta.filter((l): l is Linha => registro(l) && afetados.has(chave(l)));
    if (new Set(confirmadas.map(chave)).size !== afetados.size) throw new Error("A resposta do backup não confirmou as atividades da conta.");
    await banco.transaction("rw", banco.outbox, banco.cache, async () => {
      const atual = await banco.outbox.get(item.id!);
      if (!atual || replaceEqualDeep(atual.payload, item.payload) !== atual.payload) return;
      await banco.outbox.delete(item.id!);
      for (const l of confirmadas) await guardar(l.user_id as string, l.id as string, l, false);
    });
  };
}

/** A fila já retirou os itens capturados nesta transação. As escritas seguintes mantêm a precedência local. */
export async function reconciliarCopiasDoCardio(conta: string, local: Linha, canonica: Linha | null) {
  const id = local.id;
  if (local.user_id !== conta || typeof id !== "string" || (canonica && (canonica.user_id !== conta || canonica.id !== id))) {
    throw new Error("A atividade confirmada precisa identificar o mesmo registro da conta.");
  }
  let linha = canonica;
  for (const { payload } of await bd().outbox.where("tipo").equals("cardio").toArray()) {
    const p = payload as EscritaTabela;
    if (p?.tabela !== "cardio_sessions" || !p.op) continue;
    if ((p.op === "update" || p.op === "delete") && !cardioCorrespondeAoFiltro(linha, p.filtro)) continue;
    if (p.op === "delete" && p.filtro?.user_id === conta && p.filtro.id === id) linha = null;
    for (const atual of p.linhas ?? (p.linha ? [p.linha] : [])) {
      if ((atual.user_id ?? p.filtro?.user_id) !== conta || (atual.id ?? p.filtro?.id) !== id || fracionaria(atual.saltos)) continue;
      if (linha || ((p.op === "upsert" || p.op === "insert") && typeof atual.data === "string" && typeof atual.tipo === "string")) {
        linha = { ...linha, ...atual };
      }
    }
  }
  await guardar(conta, id, linha, false);
}

export function observarConciliacoesDoCardio(cliente: QueryClient) {
  if (!temIndexedDB()) return () => {};
  let revisoes: Map<string, number> | undefined;
  const assinatura = liveQuery(() => bd().cache.where("chave").startsWith("cardio-conciliado:").toArray()).subscribe(itens => {
    const atuais = new Map<string, number>();
    const mudancas = itens.flatMap(item => {
      const m = item.valor as Mudanca;
      atuais.set(item.chave, m.revisao);
      return revisoes && revisoes.get(item.chave) !== m.revisao ? [m] : [];
    });
    revisoes = atuais;
    if (!mudancas.length) return;
    const filtro = { predicate: (q: { queryKey: QueryKey }) => {
      const [g, a, b, c] = q.queryKey;
      return mudancas.some(m => (g === "cardio-todos" && (!a || a === m.conta)) ||
        (g === "cardio-sessao" && a === m.id && (!b || b === m.conta)) ||
        (g === "cardio" && (!c || c === m.conta)) || (g === "cardio-desde" && (!b || b === m.conta)));
    } };
    void cliente.cancelQueries(filtro, { revert: false, silent: true });
    for (const q of cliente.getQueryCache().findAll(filtro)) {
      const dados = mudancas.reduce((v, m) => projeta(q.queryKey, v, m), q.state.data);
      if (dados !== q.state.data) cliente.setQueryData(q.queryKey, dados, { updatedAt: q.state.dataUpdatedAt });
    }
    void cliente.invalidateQueries(filtro);
  });
  return () => assinatura.unsubscribe();
}
