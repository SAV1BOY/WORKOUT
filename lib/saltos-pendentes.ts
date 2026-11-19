import { bd, temIndexedDB, type ItemSaida } from "@/lib/db";
import { contagemInteiraValida, fracionaria } from "@/lib/campos-de-contagem";
import { comTravaDaFila, guardarNaFila, processar, AVISO_DE_CONFLITO_DE_CONTAGEM, type ResultadoDoEnvio } from "@/lib/outbox";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { guardarPropostaDeSaltos, reconciliarCopiasDoCardio } from "@/lib/espelhos-dos-saltos";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { conferirSaltosRemotos, mesmaIdentidadeDoCardio, podeInserirCardio } from "@/lib/recuperacao-de-saltos-remota";

type Linha = Record<string, unknown>;
type Escolha = "aparelho" | "historico" | "criar" | "manter-ausencia";

export interface SaltosPendentes {
  conta: string;
  cardioId: string;
  revisao: string;
  local: Linha;
  fracionario: number;
  posterior: number | null | undefined;
}
export interface ConciliacaoDeSaltos {
  conta: string;
  cardioId: string;
  revisao: string;
  local: Linha;
  remota: Linha | null;
  estado: "aguardando" | "conflito" | "ausente";
  mesmaIdentidade: boolean;
  origem?: Linha;
  insercao?: Linha;
  permiteCriar: boolean;
  erro?: string;
}
interface Intencao {
  revisao: string;
  origem: Linha;
  insercao?: Linha;
  remota: Linha | null;
  estado: ConciliacaoDeSaltos["estado"];
  escolha?: Escolha;
  vinculoMudou: boolean;
}
interface Marcador {
  tabela: "cardio_sessions";
  linha: Linha;
  conciliacaoDosSaltos: Intencao;
}
type Registro = { item: ItemSaida; linha: Linha; tipo: unknown; data: unknown; concluida: unknown };
type Grupo = { pendencia: SaltosPendentes; capturas: Registro[]; proposta?: Linha; edicaoPosterior?: EscritaTabela; vinculoMudou: boolean };

function marcador(item: ItemSaida): Marcador | undefined {
  const p = item.payload as Partial<Marcador> | null;
  return item.tipo === "cardio" && p?.tabela === "cardio_sessions" && p.linha && p.conciliacaoDosSaltos ? p as Marcador : undefined;
}
const mudou = () => new Error("A sessão de corda mudou. Confira novamente os saltos.");
const confirmarConta = (conta: string) => confirmarContaDoTreino(conta, "A conta mudou. Reabra a sincronização.");
const mesmoVinculo = (a: Registro, b: Registro) => a.tipo === b.tipo && a.data === b.data && a.concluida === b.concluida;
const juntar = (registros: Registro[]): Linha => Object.assign({}, ...registros.map(r => r.linha));

function edicaoPosteriorDaCorda(registros: Registro[], local: Linha): EscritaTabela | undefined {
  const importacoes = registros.filter(r => (r.item.payload as EscritaTabela).op === "upsert");
  if (!importacoes.length || !podeInserirCardio({ ...local, saltos: null })) return;
  const linha = juntar(importacoes);
  // A escolha de saltos continua na conciliação. Só os outros campos explícitos do
  // backup são editados; um arquivo antigo não apaga as colunas que omitiu.
  for (const c of ["id", "user_id", "tipo", "data", "concluida", "saltos"]) delete linha[c];
  if (!Object.keys(linha).length) return;
  // Um upsert parcial criaria uma sessão incompleta se o UUID ainda faltar.
  // Nesse caso, a intenção protegida cria a corda com o registro original completo.
  const filtro = { id: local.id as string, user_id: local.user_id as string, tipo: "corda", data: local.data as string,
    ...(typeof local.concluida === "boolean" && { concluida: local.concluida }) };
  return { tabela: "cardio_sessions", op: "update", filtro, linha };
}

function analisar(conta: string, cardioId: string, registros: Registro[]): Grupo | undefined {
  const recusado = registros.findLastIndex(r => r.tipo === "corda" && fracionaria(r.linha.saltos));
  if (recusado < 0) return;
  const origem = registros[recusado]!;
  // Uma linha parcial só modifica as colunas presentes. Uma troca de dia ou tipo
  // não atribui à nova atividade a duração, nota, blocos ou saltos do registro antigo.
  const mudouNo = (r: Registro, i: number) => i > 0 && !mesmoVinculo(registros[i - 1]!, r);
  const inicio = Math.max(0, registros.slice(0, recusado + 1).findLastIndex(mudouNo));
  const mudanca = registros.findIndex((r, i) => i > recusado && mudouNo(r, i));
  const corda = registros.slice(inicio, mudanca < 0 ? undefined : mudanca);
  const local = juntar(corda);
  const ultimo = corda.findLast(r => Object.hasOwn(r.linha, "saltos"))!.linha.saltos;
  const posterior = ultimo === null || contagemInteiraValida(ultimo) ? ultimo : undefined;
  const fim = mudanca < 0 ? registros.length : registros.findLastIndex(mudouNo);
  const proposta = mudanca < 0 ? undefined : juntar(registros.slice(fim));
  // Uma importação completa de outro cardio continua sua escrita normal. A reconciliação só trata a corda original.
  const preservarImportacao = proposta && ["corrida", "caminhada", "outro"].includes(String(proposta.tipo)) &&
    typeof proposta.data === "string" && proposta.data.length > 0;
  const edicaoPosterior = mudanca < 0 ? edicaoPosteriorDaCorda(registros.slice(recusado + 1), local) : undefined;
  const capturas = preservarImportacao ? registros.slice(0, fim) : registros;
  return {
    pendencia: { conta, cardioId, revisao: JSON.stringify(registros.map(r => [r.item.id, r.linha])),
      fracionario: origem.linha.saltos as number, local, posterior },
    capturas,
    proposta, edicaoPosterior, vinculoMudou: mudanca >= 0,
  };
}

function grupos(conta: string, itens: ItemSaida[]) {
  const porId = new Map<string, Registro[]>();
  const emConciliacao = new Set<string>();
  for (const item of itens) {
    const m = marcador(item);
    if (m?.linha.user_id === conta && typeof m.linha.id === "string") emConciliacao.add(m.linha.id);
    const p = item.payload as Partial<EscritaTabela> | null;
    if (item.id === undefined || item.tipo !== "cardio" || p?.tabela !== "cardio_sessions" ||
      (p.op !== "insert" && p.op !== "upsert")) continue;
    for (const linha of p.linhas ?? (p.linha ? [p.linha] : [])) {
      if (linha?.user_id !== conta || typeof linha.id !== "string" || !linha.id) continue;
      const lista = porId.get(linha.id) ?? [];
      const anterior = lista.at(-1);
      lista.push({ item, linha, tipo: Object.hasOwn(linha, "tipo") ? linha.tipo : anterior?.tipo,
        data: Object.hasOwn(linha, "data") ? linha.data : anterior?.data,
        concluida: Object.hasOwn(linha, "concluida") ? linha.concluida : anterior?.concluida });
      porId.set(linha.id, lista);
    }
  }
  return [...porId].flatMap(([id, regs]) => emConciliacao.has(id) ? [] : analisar(conta, id, regs) ?? []);
}

const itensDeCardio = () => bd().outbox.where("tipo").equals("cardio").toArray();
export async function listarSaltosPendentes(conta: string): Promise<SaltosPendentes[]> {
  if (!conta || !temIndexedDB()) return [];
  await confirmarConta(conta);
  const lista = grupos(conta, await itensDeCardio()).map(g => g.pendencia);
  await confirmarConta(conta);
  return lista;
}

/** Só as linhas representadas pela intenção saem da operação original; o restante do lote pode subir imediatamente. */
async function recolher(capturas: Registro[]) {
  const tabela = bd().outbox;
  const itens = new Map<ItemSaida, Set<Linha>>();
  for (const {item, linha} of capturas) {
    const salvas = itens.get(item) ?? new Set<Linha>();
    salvas.add(linha);
    itens.set(item, salvas);
  }
  for (const [item, salvas] of itens) {
    const p = item.payload as EscritaTabela;
    const linhas = p.linhas?.filter(l => !salvas.has(l));
    if (linhas?.length) {
      await tabela.update(item.id!, { payload: { ...p, linhas }, proximaTentativa: Date.now(), tentativas: 0, erro: undefined });
    } else await tabela.delete(item.id!);
  }
}

export async function confirmarSaltosPendentes(conta: string, vista: SaltosPendentes, valor: number | null) {
  if (!conta || vista.conta !== conta || (valor !== null && !contagemInteiraValida(valor))) throw mudou();
  await comTravaDaFila(async () => {
    await confirmarConta(conta);
    const banco = bd();
    await banco.transaction("rw", banco.outbox, banco.cache, async () => {
      const g = grupos(conta, await itensDeCardio()).find(g => g.pendencia.cardioId === vista.cardioId);
      if (!g || g.pendencia.revisao !== vista.revisao ||
          (g.pendencia.posterior !== undefined && valor !== g.pendencia.posterior)) throw mudou();
      const local = { ...g.pendencia.local, saltos: valor };
      const payload: Marcador = { tabela: "cardio_sessions", linha: local, conciliacaoDosSaltos: {
        revisao: crypto.randomUUID(), estado: "aguardando", origem: g.pendencia.local,
        insercao: g.proposta ?? (podeInserirCardio(local) ? undefined : local), remota: null, vinculoMudou: g.vinculoMudou,
      } };
      await recolher(g.capturas);
      if (g.edicaoPosterior) await guardarNaFila("cardio", g.edicaoPosterior);
      const agora = Date.now();
      // Sem op o #52/#53 preservam esta intenção na fila sem reenviar a linha antiga.
      await banco.outbox.add({ tipo: "cardio", payload, criadoEm: agora, proximaTentativa: agora, tentativas: 0 });
      await guardarPropostaDeSaltos(conta, g.pendencia.local, local);
    });
  });
  void processar();
}

function apresentar(item: ItemSaida, p: Marcador): ConciliacaoDeSaltos {
  const i = p.conciliacaoDosSaltos;
  return { conta: p.linha.user_id as string, cardioId: p.linha.id as string, revisao: i.revisao,
    local: p.linha, origem: i.origem, remota: i.remota, insercao: i.insercao, estado: i.estado,
    mesmaIdentidade: !i.vinculoMudou && i.remota !== null && mesmaIdentidadeDoCardio(p.linha, i.remota),
    permiteCriar: Boolean(i.insercao && podeInserirCardio(i.insercao)),
    ...(item.erro && item.erro !== AVISO_DE_CONFLITO_DE_CONTAGEM ? { erro: item.erro } : {}) };
}
export async function listarConciliacoesDeSaltos(conta: string): Promise<ConciliacaoDeSaltos[]> {
  if (!conta || !temIndexedDB()) return [];
  await confirmarConta(conta);
  const linhas = (await itensDeCardio()).flatMap(item => {
    const p = marcador(item);
    return p && p.linha.user_id === conta ? [apresentar(item, p)] : [];
  });
  await confirmarConta(conta);
  return linhas;
}

export async function resolverConciliacaoDeSaltos(conta: string, vista: ConciliacaoDeSaltos, usar: Escolha) {
  if (!conta || vista.conta !== conta) throw mudou();
  await comTravaDaFila(async () => {
    await confirmarConta(conta);
    const tabela = bd().outbox;
    await bd().transaction("rw", tabela, async () => {
      const item = (await itensDeCardio()).find(item => {
        const m = marcador(item);
        return m?.linha.user_id === conta && m.linha.id === vista.cardioId;
      });
      if (!item?.id) throw mudou();
      const p = marcador(item)!;
      const atual = apresentar(item, p);
      const aceita = atual.estado === "ausente" ? usar === "manter-ausencia" || (usar === "criar" && atual.permiteCriar)
        : atual.estado === "conflito" && (usar === "historico" || (usar === "aparelho" && atual.mesmaIdentidade));
      if (!aceita || atual.revisao !== vista.revisao) throw mudou();
      const i: Intencao = { ...p.conciliacaoDosSaltos, revisao: crypto.randomUUID(), estado: "aguardando", escolha: usar };
      await tabela.update(item.id, { payload: { ...p, conciliacaoDosSaltos: i }, proximaTentativa: Date.now(),
        tentativas: 0, erro: undefined });
    });
  });
  void processar();
}

/** A fila já mantém o Web Lock durante esta operação. Nenhum avanço de semana é calculado no reenvio. */
export async function enviarSaltosEmConciliacao(item: ItemSaida): Promise<ResultadoDoEnvio> {
  const p = marcador(item);
  if (!p || !item.id || typeof p.linha.user_id !== "string" || typeof p.linha.id !== "string") throw mudou();
  const conta = p.linha.user_id;
  const i = p.conciliacaoDosSaltos;
  await confirmarConta(conta);
  if (i.estado !== "aguardando") return "aguarda-conciliacao";
  const decisao = i.remota && (i.escolha === "historico" || i.escolha === "aparelho")
    ? { usar: i.escolha, observada: i.remota } : undefined;
  const insercao = i.insercao ?? (i.remota ? p.linha : undefined);
  const r = await conferirSaltosRemotos(conta, p.linha, decisao, insercao && {
    insercao, confirmada: i.escolha === "criar", manterAusencia: i.escolha === "manter-ausencia",
  });
  await confirmarConta(conta);
  if (r.linha.user_id !== conta || r.linha.id !== p.linha.id) throw mudou();
  const banco = bd();
  await banco.transaction("rw", banco.outbox, banco.cache, async () => {
    const salva = await banco.outbox.get(item.id!);
    if (!salva || marcador(salva)?.conciliacaoDosSaltos.revisao !== i.revisao) throw mudou();
    if (r.estado === "conflito" || r.estado === "confirmar-insercao") {
      const ausente = r.estado === "confirmar-insercao";
      const intencao: Intencao = { ...i, revisao: crypto.randomUUID(), escolha: undefined,
        remota: ausente ? null : r.linha, insercao: ausente ? r.linha : i.insercao, estado: ausente ? "ausente" : "conflito" };
      await banco.outbox.update(item.id!, { payload: { ...p, conciliacaoDosSaltos: intencao } });
    } else {
      await banco.outbox.delete(item.id!);
      await reconciliarCopiasDoCardio(conta, p.linha, r.estado === "ausencia-mantida" ? null : r.linha);
    }
  });
  return r.estado === "conflito" || r.estado === "confirmar-insercao" ? "aguarda-conciliacao" : "fila-reconciliada";
}
