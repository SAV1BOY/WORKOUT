import { bd, temIndexedDB, type ItemSaida } from "@/lib/db";
import { CAMPOS_DE_CONTAGEM, type CampoContagem } from "@/lib/campos-de-contagem";
import { corrigirCopiasDaSerie } from "@/lib/espelhos-da-contagem";
import { comTravaDaFila, processar } from "@/lib/outbox";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";

export type { CampoContagem } from "@/lib/campos-de-contagem";
export const MAX_CONTAGEM = 2_147_483_647; // session_sets usa integer no Postgres.
export function contagemInteiraValida(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= MAX_CONTAGEM;
}
function fracionaria(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && !Number.isInteger(valor);
}

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
const IDENTIDADE = ["exercise_id", "ordem_ex", "set_index", "tipo"] as const;
interface Registro { item: ItemSaida; linha: Linha; identificacao: Linha; posicaoNoLote: number }
interface Grupo { pendencia: ContagemPendente; registros: Registro[] }

const conferirConta = (conta: string) => confirmarContaDoTreino(conta, "A conta mudou. Reabra a sincronização.");

function analisar(conta: string, registros: Registro[]): Grupo | undefined {
  const ultimo = registros.at(-1)!.linha;
  const campos: ContagemPendente["campos"] = [];
  for (const campo of CAMPOS_DE_CONTAGEM) {
    const invalidas = registros.filter(r => fracionaria(r.linha[campo]));
    const ultimaFracao = invalidas.at(-1)?.linha[campo];
    if (!fracionaria(ultimaFracao)) continue;
    // Uma omissão em um upsert parcial não modifica o valor anterior. Um null explícito o limpa.
    const posterior = registros.findLast(r => Object.hasOwn(r.linha, campo))!;
    const mesmoMovimento = invalidas.every(({ identificacao }) => IDENTIDADE.every(k =>
      identificacao[k] == null || posterior.identificacao[k] == null || identificacao[k] === posterior.identificacao[k]));
    const valor = posterior.linha[campo];
    campos.push({ campo, fracionario: ultimaFracao, posterior: mesmoMovimento && contagemInteiraValida(valor) ? valor : null });
  }
  if (!campos.length) return;
  const afetada = registros.findLast(r => CAMPOS_DE_CONTAGEM.some(c => fracionaria(r.linha[c])))!.identificacao;
  const { exercise_id: ex, set_index: indice, ordem_ex: ordem, tipo, registrada_em: data } = afetada;
  const revisao = JSON.stringify([conta, registros.map(({ item, linha, posicaoNoLote }) =>
    [item.id, posicaoNoLote, linha])]);
  return { registros, pendencia: {
    conta, sessaoId: ultimo.session_id as string, serieId: ultimo.id as string, revisao, campos,
    exercicioId: typeof ex === "string" ? ex : null, indice: typeof indice === "number" ? indice : null,
    ordemEx: typeof ordem === "number" ? ordem : null, tipo: tipo === "trabalho" || tipo === "aquecimento" ? tipo : null,
    registradaEm: typeof data === "string" ? data : null,
    unilateral: registros.some(r => r.linha.reps_lado2 != null || r.linha.tempo_s_lado2 != null),
  } };
}

function gruposDaConta(conta: string, itens: ItemSaida[]): Grupo[] {
  const grupos = new Map<string, Registro[]>();
  // outbox.toArray() usa a chave autoincremental. O relógio do telefone pode voltar entre duas edições.
  for (const item of itens) {
    const p = item.payload as Partial<EscritaTabela> | null;
    if (item.tipo !== "serie" || item.id === undefined || p?.tabela !== "session_sets" ||
      (p.op !== "upsert" && p.op !== "insert")) continue;
    const linhas = p.linhas ?? (p.linha ? [p.linha] : []);
    if (!Array.isArray(linhas)) continue;
    linhas.forEach((linha, posicaoNoLote) => {
      if (!linha || linha.user_id !== conta || typeof linha.session_id !== "string" || !linha.session_id ||
        typeof linha.id !== "string" || !linha.id) return;
      const chave = JSON.stringify([linha.session_id, linha.id]);
      const grupo = grupos.get(chave) ?? [];
      // Um upsert de backup pode informar só id, sessão e reps. A identidade continua
      // sendo a da última linha daquele UUID, inclusive se o arquivo trocou o exercício.
      const identificacao = { ...grupo.at(-1)?.identificacao };
      for (const campo of [...IDENTIDADE, "registrada_em"]) {
        if (Object.hasOwn(linha, campo)) identificacao[campo] = linha[campo];
      }
      grupo.push({ item, linha, identificacao, posicaoNoLote });
      grupos.set(chave, grupo);
    });
  }
  return [...grupos.values()].flatMap(registros => analisar(conta, registros) ?? []);
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
      const alterados = new Set<ItemSaida>();
      const correcoes = campos.map(({ campo, posterior }): CorrecaoDeContagem => {
        const inteiro = posterior ?? valores[campo];
        if (!contagemInteiraValida(inteiro) || (valores[campo] !== undefined && valores[campo] !== inteiro)) {
          throw new Error("Informe uma quantidade inteira válida em cada campo pendente.");
        }
        const fracionarios = new Set<number>();
        for (const { item, linha } of grupo.registros) {
          const anterior = linha[campo];
          if (!fracionaria(anterior)) continue;
          fracionarios.add(anterior);
          linha[campo] = inteiro;
          alterados.add(item);
        }
        return { campo, inteiro, fracionarios: [...fracionarios] };
      });
      const agora = Date.now();
      for (const item of alterados) {
        await banco.outbox.update(item.id!, { payload: item.payload, proximaTentativa: agora, tentativas: 0, erro: undefined });
      }
      for (const item of itens) {
        if (item.id === undefined || !item.alvo || alterados.has(item) || item.tentativas || item.erro ||
          item.proximaTentativa <= agora || !itemDaConta(item, conta)) continue;
        const esperava = [...alterados].some(a => a.alvo === item.alvo && a.id! < item.id! &&
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
