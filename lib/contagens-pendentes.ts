import { bd, temIndexedDB, type ItemSaida } from "@/lib/db";
import { CAMPOS_DE_CONTAGEM, chaveIntencao, contagemInteiraValida, fracionaria, prefixoDasIntencoes, type CampoContagem } from "@/lib/campos-de-contagem";
import { corrigirCopiasDaSerie, reconciliarCopiasDaSerie, retirarSerieAusenteDasCopias } from "@/lib/espelhos-da-contagem";
import { AVISO_DE_CONFLITO_DE_CONTAGEM, comTravaDaFila, processar } from "@/lib/outbox";
import { conferirSerieRemota, mesmaIdentidadeDaSerie, podeInserirSerie } from "@/lib/recuperacao-de-serie-remota";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";

export type { CampoContagem } from "@/lib/campos-de-contagem";
export { contagemInteiraValida, MAX_CONTAGEM } from "@/lib/campos-de-contagem";

export interface CorrecaoDeContagem {
  campo: CampoContagem;
  fracionarios: readonly number[];
  inteiro: number;
}
export interface ContagemPendente {
  conta: string;
  sessaoId: string;
  serieId: string;
  exercicioId: string | null;
  indice: number | null;
  ordemEx: number | null;
  unilateral: boolean;
  registradaEm: string | null;
  tipo: "trabalho" | "aquecimento" | null;
  campos: { campo: CampoContagem; fracionario: number; posterior: number | null }[];
  revisao: string;
}

type Linha = Record<string, unknown>;
type Escolha = "historico" | "aparelho" | "criar" | "manter-ausencia";
type PayloadDeSerie = Partial<EscritaTabela> & {
  operacaoGuardada?: "upsert" | "insert";
  seriesEmConciliacao?: string[];
};

export interface ConciliacaoDeContagem {
  conta: string;
  serieId: string;
  sessaoId: string;
  revisao: string;
  local: Linha;
  remota: Linha | null;
  campos: CampoContagem[];
  origem?: Linha;
  insercao?: Linha;
  permiteCriar?: boolean;
  estado: "aguardando" | "conflito" | "ausente";
  mesmaIdentidade: boolean;
  erro?: string;
}

interface IntencaoDeContagem extends Omit<ConciliacaoDeContagem, "mesmaIdentidade" | "estado" | "erro"> {
  itens: number[];
  mesmoVinculoLocal: boolean;
  ausente?: boolean;
  usar: Escolha | null;
}
const mudou = () => new Error("Esta série mudou. Reabra a correção para conferir os valores atuais.");

async function guardarIntencao(i: IntencaoDeContagem) {
  await bd().cache.put({ chave: chaveIntencao(i.conta, i.serieId), valor: i, atualizadoEm: Date.now() });
}

const IDENTIDADE = ["session_id", "exercise_id", "ordem_ex", "set_index", "tipo"] as const;
function mesmoVinculo(a: Linha, b: Linha) {
  return IDENTIDADE.every(k => (a[k] ?? null) === (b[k] ?? null));
}
interface Registro { item: ItemSaida; linha: Linha; identificacao: Linha }
interface Grupo { pendencia: ContagemPendente; registros: Registro[] }

const conferirConta = (conta: string) => confirmarContaDoTreino(conta, "A conta mudou. Reabra a sincronização.");

function analisar(conta: string, registros: Registro[]): Grupo | undefined {
  const campos: ContagemPendente["campos"] = [];
  for (const campo of CAMPOS_DE_CONTAGEM) {
    const invalidas = registros.filter(r => fracionaria(r.linha[campo]));
    const ultimaFracao = invalidas.at(-1)?.linha[campo];
    if (!fracionaria(ultimaFracao)) continue;
    // Uma omissão em um upsert parcial não modifica o valor anterior. Um null explícito o limpa.
    const posterior = registros.findLast(r => Object.hasOwn(r.linha, campo))!;
    const mesmoMovimento = invalidas.every(r => mesmoVinculo(r.identificacao, posterior.identificacao));
    const valor = posterior.linha[campo];
    campos.push({ campo, fracionario: ultimaFracao, posterior: mesmoMovimento && contagemInteiraValida(valor) ? valor : null });
  }
  if (!campos.length) return;
  const afetada = registros.findLast(r => CAMPOS_DE_CONTAGEM.some(c => fracionaria(r.linha[c])))!.identificacao;
  const { exercise_id: ex, set_index: indice, ordem_ex: ordem, tipo, registrada_em: data } = afetada;
  const revisao = JSON.stringify([conta, registros.map(({ item, linha }) => [item.id, linha])]);
  return { registros, pendencia: {
    conta, sessaoId: afetada.session_id as string, serieId: registros[0]!.linha.id as string, revisao, campos,
    exercicioId: typeof ex === "string" ? ex : null, indice: typeof indice === "number" ? indice : null,
    ordemEx: typeof ordem === "number" ? ordem : null, tipo: tipo === "trabalho" || tipo === "aquecimento" ? tipo : null,
    registradaEm: typeof data === "string" ? data : null,
    unilateral: registros.some(r => r.linha.reps_lado2 != null || r.linha.tempo_s_lado2 != null),
  } };
}

function gruposDaConta(conta: string, itens: ItemSaida[]): Grupo[] {
  const grupos = new Map<string, Registro[]>();
  const guardadas = new Set<string>();
  // outbox.toArray() usa a chave autoincremental. O relógio do telefone pode voltar entre duas edições.
  for (const item of itens) {
    const p = item.payload as PayloadDeSerie | null;
    if (item.tipo !== "serie" || item.id === undefined || p?.tabela !== "session_sets" ||
      !(p.op === "upsert" || p.op === "insert" || p.operacaoGuardada)) continue;
    for (const chave of p.seriesEmConciliacao ?? []) guardadas.add(chave);
    const linhas = p.linhas ?? (p.linha ? [p.linha] : []);
    if (!Array.isArray(linhas)) continue;
    linhas.forEach(linha => {
      if (!linha || linha.user_id !== conta || typeof linha.session_id !== "string" || !linha.session_id ||
        typeof linha.id !== "string" || !linha.id) return;
      const chave = linha.id;
      if (p.seriesEmConciliacao?.includes(chaveIntencao(conta, chave))) return;
      const grupo = grupos.get(chave) ?? [];
      // Um upsert de backup pode informar só id, sessão e reps. A identidade continua
      // sendo a da última linha daquele UUID, inclusive se o arquivo trocou o exercício.
      const identificacao = { ...grupo.at(-1)?.identificacao };
      for (const campo of [...IDENTIDADE, "registrada_em"]) {
        if (Object.hasOwn(linha, campo)) identificacao[campo] = linha[campo];
      }
      grupo.push({ item, linha, identificacao });
      grupos.set(chave, grupo);
    });
  }
  return [...grupos].flatMap(([id, registros]) =>
    guardadas.has(chaveIntencao(conta, id)) ? [] : analisar(conta, registros) ?? []);
}

export async function listarContagensPendentes(conta: string): Promise<ContagemPendente[]> {
  if (!conta || !temIndexedDB()) return [];
  await conferirConta(conta);
  const itens = await bd().outbox.where("tipo").equals("serie").toArray();
  const pendencias = gruposDaConta(conta, itens).map(g => g.pendencia);
  await conferirConta(conta);
  return pendencias;
}

/** Os itens seguintes foram adiados junto com o primeiro erro. Acorda apenas os que ficaram esperando aquele envio. */
function itemDaConta(item: ItemSaida, conta: string): boolean {
  const p = item.payload as Partial<EscritaTabela> | null;
  if (Array.isArray(p?.linhas)) return p.linhas.length > 0 && p.linhas.every(l => l?.user_id === conta);
  return (p?.linha?.user_id ?? p?.filtro?.user_id) === conta;
}

export async function confirmarContagemPendente(
  conta: string, vista: ContagemPendente, valores: Partial<Record<CampoContagem, number>>,
): Promise<CorrecaoDeContagem[]> {
  if (!conta || vista.conta !== conta) throw new Error("Esta série pertence a outra conta.");
  const correcoes = await comTravaDaFila(async () => {
    // O login pode ter mudado enquanto outra aba estava enviando o treino.
    await conferirConta(conta);
    const banco = bd();
    return banco.transaction("rw", banco.outbox, banco.sessaoAtiva, banco.cache, async () => {
      const itens = await banco.outbox.toArray();
      const grupo = gruposDaConta(conta, itens).find(g =>
        g.pendencia.sessaoId === vista.sessaoId && g.pendencia.serieId === vista.serieId);
      if (!grupo || grupo.pendencia.revisao !== vista.revisao) {
        throw new Error("Esta série mudou. Reabra a correção para conferir os valores atuais.");
      }
      const campos = grupo.pendencia.campos;
      if (Object.keys(valores).some(k => !campos.some(c => c.campo === k))) {
        throw new Error("Confira apenas as contagens pendentes desta série.");
      }
      const chave = chaveIntencao(conta, vista.serieId);
      if (await banco.cache.get(chave)) throw new Error("Esta série mudou. Reabra a correção.");
      const itensCapturados = [...new Set(grupo.registros.map(r => r.item))];
      const local: Linha = {};
      // Um backup pode reutilizar o UUID e informar apenas alguns campos do novo vínculo.
      // Nestes casos os valores de carga e contagem do movimento antigo não são a proposta de criação.
      // Uma posição ou um exercício até então desconhecido também não atribui
      // retroativamente ao destino os valores registrados sem aquela informação.
      const corte = grupo.registros.findLastIndex((r, idx, todos) =>
        idx > 0 && !mesmoVinculo(todos[idx - 1]!.identificacao, r.identificacao));
      const origem: Linha | undefined = corte > 0
        ? Object.assign({}, ...grupo.registros.slice(0, corte).map(r => r.linha)) : undefined;
      const correcoes = campos.map(({ campo, posterior }): CorrecaoDeContagem => {
        const inteiro = posterior ?? valores[campo];
        if (!contagemInteiraValida(inteiro) || (valores[campo] !== undefined && valores[campo] !== inteiro)) {
          throw new Error("Informe uma quantidade inteira válida em cada campo pendente.");
        }
        const fracionarios = new Set<number>();
        for (const { linha } of grupo.registros) {
          const anterior = linha[campo];
          if (!fracionaria(anterior)) continue;
          fracionarios.add(anterior);
          linha[campo] = inteiro;
        }
        return { campo, inteiro, fracionarios: [...fracionarios] };
      });
      // As escritas parciais de um backup conservam as colunas omitidas.
      for (const { linha } of grupo.registros) Object.assign(local, linha);
      const insercao = corte > 0 ? Object.assign({}, ...grupo.registros.slice(corte).map(r => r.linha))
        : !podeInserirSerie(local) ? local : undefined;
      const intencao: IntencaoDeContagem = {
        conta, serieId: vista.serieId, sessaoId: vista.sessaoId, local,
        campos: campos.map(c => c.campo), remota: null, usar: null, mesmoVinculoLocal: corte < 0, origem, insercao,
        itens: itensCapturados.map(i => i.id!), revisao: crypto.randomUUID(),
      };
      await guardarIntencao(intencao);
      const agora = Date.now();
      for (const item of itensCapturados) {
        const p = item.payload as PayloadDeSerie;
        // Sem op, inclusive um cliente antigo que reabra o IndexedDB recusa a escrita.
        const { op, ...resto } = p;
        const payload = { ...resto, operacaoGuardada: p.operacaoGuardada ?? op,
          seriesEmConciliacao: [...(p.seriesEmConciliacao ?? []), chave] };
        await banco.outbox.update(item.id!, { payload, proximaTentativa: agora, tentativas: 0, erro: undefined });
      }
      for (const item of itens) {
        if (item.id === undefined || !item.alvo || itensCapturados.includes(item) || item.tentativas || item.erro ||
          item.proximaTentativa <= agora || !itemDaConta(item, conta)) continue;
        const esperava = itensCapturados.some(a => a.alvo === item.alvo && a.id! < item.id! &&
          a.proximaTentativa === item.proximaTentativa);
        if (esperava) await banco.outbox.update(item.id, { proximaTentativa: agora });
      }
      await corrigirCopiasDaSerie(conta, vista.sessaoId, vista.serieId, correcoes);
      return correcoes;
    });
  });
  void processar();
  return correcoes;
}

/** O cache pertence só a esta conta. Não expira enquanto houver uma correção a entregar. */
export async function listarConciliacoesDeContagem(conta: string): Promise<ConciliacaoDeContagem[]> {
  if (!conta || !temIndexedDB()) return [];
  await conferirConta(conta);
  const banco = bd();
  const resultado = await banco.transaction("r", banco.cache, banco.outbox, async () => {
    const salvas = await banco.cache.where("chave").startsWith(prefixoDasIntencoes(conta)).toArray();
    const lista: ConciliacaoDeContagem[] = [];
    for (const { valor } of salvas) {
      const i = valor as IntencaoDeContagem;
      if (i.conta !== conta) continue;
      const item = await banco.outbox.get(i.itens[0]);
      const { sessaoId, serieId, campos, local, remota, revisao, usar, origem, insercao } = i;
      const estado = usar ? "aguardando" : i.ausente ? "ausente" : remota ? "conflito" : "aguardando";
      lista.push({ conta, sessaoId, serieId, campos, local, remota, revisao, estado, origem, insercao,
        permiteCriar: Boolean(insercao && podeInserirSerie(insercao)),
        mesmaIdentidade: i.mesmoVinculoLocal && i.remota !== null && mesmaIdentidadeDaSerie(i.local, i.remota),
        ...(item?.erro && itemDaConta(item, conta) && item.erro !== AVISO_DE_CONFLITO_DE_CONTAGEM ? { erro: item.erro } : {}) });
    }
    return lista;
  });
  await conferirConta(conta);
  return resultado;
}

export async function resolverConciliacaoDeContagem(conta: string, vista: ConciliacaoDeContagem, usar: Escolha) {
  if (!conta || vista.conta !== conta) throw mudou();
  await comTravaDaFila(async () => {
    await conferirConta(conta);
    const banco = bd();
    await banco.transaction("rw", banco.cache, banco.outbox, async () => {
      const i = (await banco.cache.get(chaveIntencao(conta, vista.serieId)))?.valor as IntencaoDeContagem | undefined;
      if (!i || i.conta !== conta || i.revisao !== vista.revisao || i.usar) throw mudou();
      const permitido = i.ausente
        ? usar === "manter-ausencia" || (usar === "criar" && i.insercao && podeInserirSerie(i.insercao))
        : i.remota && (usar === "historico" ||
          (usar === "aparelho" && i.mesmoVinculoLocal && mesmaIdentidadeDaSerie(i.local, i.remota)));
      if (!permitido) throw mudou();
      await guardarIntencao({ ...i, usar, revisao: crypto.randomUUID() });
      await banco.outbox.update(i.itens[0], { proximaTentativa: Date.now(), tentativas: 0, erro: undefined });
    });
  });
  void processar();
}

/** Remove somente as ocorrências do UUID já capturadas. Outros movimentos do lote recuperam a operação original. */
async function retirarCapturas(i: IntencaoDeContagem, chave: string) {
  const tabela = bd().outbox;
  const agora = Date.now();
  const itens = await tabela.bulkGet(i.itens);
  const alvos = new Set<string>();
  for (const item of itens) {
    const p = item?.payload as PayloadDeSerie | undefined;
    if (!item?.id || !p?.operacaoGuardada || !p.seriesEmConciliacao?.includes(chave)) throw mudou();
    if (item.alvo) alvos.add(item.alvo);
    const linhas = (p.linhas ?? (p.linha ? [p.linha] : []))
      .filter(l => l.user_id !== i.conta || l.id !== i.serieId);
    if (!linhas.length) {
      await tabela.delete(item.id);
      continue;
    }
    const { seriesEmConciliacao, operacaoGuardada, ...escrita } = p;
    const outras = seriesEmConciliacao.filter(c => c !== chave);
    const payload = { ...escrita, linhas, ...(outras.length
      ? { operacaoGuardada, seriesEmConciliacao: outras } : { op: operacaoGuardada }) };
    await tabela.update(item.id, { payload, proximaTentativa: agora, tentativas: 0, erro: undefined });
  }
  // Uma conclusão/edição no mesmo alvo pode estar adiada pelo backoff deste conflito.
  for (const item of await tabela.toArray()) {
    if (item.id !== undefined && item.alvo && alvos.has(item.alvo) && !item.erro && !item.tentativas &&
      item.proximaTentativa > agora && itemDaConta(item, i.conta)) {
      await tabela.update(item.id, { proximaTentativa: agora });
    }
  }
}

/** Chamado sob o lock do processador. Um resultado remoto só substitui a versão exata consultada. */
export async function enviarContagemEmConciliacao(item: ItemSaida): Promise<"fila-reconciliada" | "aguarda-conciliacao"> {
  const banco = bd();
  const p = item.payload as PayloadDeSerie;
  const chave = p.seriesEmConciliacao?.[0];
  if (!chave || item.id === undefined) throw mudou();
  const i = (await banco.cache.get(chave))?.valor as IntencaoDeContagem | undefined;
  if (!i || !i.itens.includes(item.id) || i.local.user_id !== i.conta ||
      i.local.id !== i.serieId || chave !== chaveIntencao(i.conta, i.serieId)) throw mudou();
  await conferirConta(i.conta);
  if ((i.remota || i.ausente) && !i.usar) return "aguarda-conciliacao";
  const decisao = i.remota && (i.usar === "historico" || i.usar === "aparelho")
    ? { usar: i.usar, observada: i.remota } : undefined;
  const insercao = i.insercao ?? (i.remota ? i.local : undefined);
  const r = await conferirSerieRemota(i.conta, i.local, i.campos, decisao, insercao && {
    insercao, confirmada: i.usar === "criar", manterAusencia: i.usar === "manter-ausencia",
  });
  await conferirConta(i.conta);
  if (r.linha.user_id !== i.conta || r.linha.id !== i.serieId) throw mudou();
  await banco.transaction("rw", banco.cache, banco.outbox, banco.sessaoAtiva, async () => {
    const atual = (await banco.cache.get(chave))?.valor as IntencaoDeContagem | undefined;
    if (atual?.revisao !== i.revisao) throw mudou();
    if (r.estado === "confirmar-insercao") {
      await guardarIntencao({ ...i, ausente: true, insercao: r.linha, remota: null, usar: null, revisao: crypto.randomUUID() });
    } else if (r.estado === "conflito") {
      await guardarIntencao({ ...i, ausente: false, remota: r.linha, usar: null, revisao: crypto.randomUUID() });
    } else {
      await retirarCapturas(i, chave);
      if (r.estado === "ausencia-mantida") await retirarSerieAusenteDasCopias(i.conta, i.local, i.origem);
      else await reconciliarCopiasDaSerie(i.conta, i.local, r.linha, i.origem);
      await banco.cache.delete(chave);
    }
  });
  return r.estado === "conflito" || r.estado === "confirmar-insercao" ? "aguarda-conciliacao" : "fila-reconciliada";
}
