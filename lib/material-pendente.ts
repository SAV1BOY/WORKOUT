import { replaceEqualDeep } from "@tanstack/react-query";
import { bd, temIndexedDB, type ItemSaida } from "@/lib/db";
import { comTravaDaFila, processar } from "@/lib/outbox";
import type { EscritaTabela } from "@/lib/outbox-supabase";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { guardarMaterialConfirmadoNoAparelho } from "@/lib/queries/material-confirmado";
import type { SessaoLocal } from "@/lib/sessao";
import { clienteNavegador } from "@/lib/supabase/client";
import type { PlanoDaSessao, StatusSessao } from "@/lib/types";

export type MaterialDaSessao = string[] | null;
interface Destino { id: string; user_id: string }
export interface ComandoDeMaterial {
  tabela: "sessions";
  filtro: Destino;
  equipamentoDaSessao: {
    comando: string; revisaoBase: string | null; de: MaterialDaSessao; para: MaterialDaSessao;
    planoInicial?: PlanoDaSessao | null;
  };
}
export interface SessaoComMaterialConfirmado extends Destino {
  status: StatusSessao;
  plano: PlanoDaSessao | null;
  revisao_equipamento: string | null;
}
type Escolha = "aparelho" | "sincronizado" | "guardar-copia";
type Original = ComandoDeMaterial | EscritaTabela;
interface SerieParaGuardar { id: string; exercicioId: string; indice: number }
interface EscritaDeSerieGuardada extends SerieParaGuardar { filaId: number; payload: EscritaTabela }
export interface CopiaDeMaterial {
  formato: "treino-terraco-edicoes-de-sessao-v1";
  id: string; conta: string; sessaoId: string; titulo: string | null; data?: string; guardadaEm: number;
  original: Original; remota: SessaoComMaterialConfirmado; sessaoLocal?: SessaoLocal; seriesGuardadas: EscritaDeSerieGuardada[];
}
interface Conciliacao {
  tabela: "sessions";
  filtro: Destino;
  conciliacaoDeMaterial: {
    original: Original; remota: SessaoComMaterialConfirmado; revisao: string;
    escolha?: Escolha; comandoEscolhido?: ComandoDeMaterial; seriesAprovadas?: EscritaDeSerieGuardada[];
  };
}
export interface MaterialPendente {
  conta: string; sessaoId: string; revisao: string; local: MaterialDaSessao; sincronizado: MaterialDaSessao;
  outrasEdicoes: boolean; sessaoEncerrada: boolean; titulo: string | null; exerciciosAcrescentados: string[];
  seriesNaFila: SerieParaGuardar[]; seriesParaGuardar: SerieParaGuardar[]; data?: string;
}

const mudou = () => new Error("Esta escolha mudou. Confira o equipamento novamente.");
const outraConta = "Aguardando a conta que alterou o treino.";
const materialValido = (v: unknown): v is MaterialDaSessao => v === null || (Array.isArray(v) && v.every(tag => typeof tag === "string"));
const iguais = (a: unknown, b: unknown): boolean => replaceEqualDeep(a, b) === a;

export function comandoDeMaterialDaSessao(conta: string, id: string, revisaoBase: string | null, de: MaterialDaSessao,
  para: MaterialDaSessao, planoInicial?: PlanoDaSessao | null): ComandoDeMaterial {
  return { tabela: "sessions", filtro: { id, user_id: conta }, equipamentoDaSessao: {
    comando: crypto.randomUUID(), revisaoBase, de, para, ...(planoInicial ? { planoInicial } : {}),
  } };
}

export function ehComandoDeMaterial(payload: unknown): payload is ComandoDeMaterial {
  const p = payload as Partial<ComandoDeMaterial> | null;
  const m = p?.equipamentoDaSessao;
  return p?.tabela === "sessions" && !Object.hasOwn(p, "op") && typeof p.filtro?.id === "string" &&
    typeof p.filtro.user_id === "string" && !!m && typeof m.comando === "string" &&
    (m.revisaoBase === null || typeof m.revisaoBase === "string") && materialValido(m.de) && materialValido(m.para);
}

function conciliacao(item: ItemSaida): Conciliacao | undefined {
  const p = item.payload as Partial<Conciliacao> | null;
  return item.tipo === "sessao" && p?.tabela === "sessions" && p.conciliacaoDeMaterial && !Object.hasOwn(p, "op")
    ? p as Conciliacao : undefined;
}

export function comandoDeMaterialNaFila(item: ItemSaida): ComandoDeMaterial | undefined {
  if (item.tipo !== "sessao") return;
  if (ehComandoDeMaterial(item.payload)) return item.payload;
  const c = conciliacao(item)?.conciliacaoDeMaterial;
  return c?.comandoEscolhido ?? (c && !c.escolha && ehComandoDeMaterial(c.original) ? c.original : undefined);
}

function planoAntigo(original: EscritaTabela): PlanoDaSessao | null {
  return (original.linha?.plano ?? null) as PlanoDaSessao | null;
}

function materialDoPlano(plano: PlanoDaSessao | null): MaterialDaSessao {
  return plano?.equipamento_disponivel ?? null;
}

function compararPlanos(original: Original, remota: SessaoComMaterialConfirmado) {
  const acrescentados: string[] = [];
  if (ehComandoDeMaterial(original)) return { outrasEdicoes: false, acrescentados };
  const local = planoAntigo(original);
  const remoto = remota.plano;
  if (!local || !remoto || !Array.isArray(local.itens) || !Array.isArray(remoto.itens) ||
      Object.keys(original.linha ?? {}).length !== 1) return { outrasEdicoes: true, acrescentados };
  const recebido = { ...remoto };
  const antigo = { ...local };
  const inclusao = recebido.ultima_inclusao;
  const ultimo = recebido.itens.at(-1);
  if (recebido.itens.length === antigo.itens.length + 1 && inclusao && inclusao.sessao_id === remota.id &&
      inclusao.ordem === recebido.itens.length && inclusao.exercicio_id === ultimo?.exercicio_id &&
      (inclusao.estado === "disponivel" || inclusao.estado === "iniciada")) {
    acrescentados.push(inclusao.exercicio_id);
    recebido.itens = recebido.itens.slice(0, -1);
    delete recebido.ultima_inclusao;
  }
  delete recebido.equipamento_disponivel;
  delete antigo.equipamento_disponivel;
  return { outrasEdicoes: !iguais(recebido, antigo), acrescentados };
}

function inclusaoNaPosicao(plano: PlanoDaSessao | null, ordem: number) {
  const ultima = plano?.ultima_inclusao;
  return plano?.itens?.[ordem - 1]?.inclusao_id ??
    (ultima?.ordem === ordem && ultima.estado !== "desfeita" ? ultima.id : undefined);
}

/** Séries posteriores do mesmo treino. Uma edição de composição entre elas terá sua própria confirmação. */
function seriesDaFila(remota: SessaoComMaterialConfirmado, item: ItemSaida, fila: ItemSaida[]) {
  const series = new Map<string, SerieParaGuardar>();
  const incompativeis: EscritaDeSerieGuardada[] = [];
  const original = conciliacao(item)?.conciliacaoDeMaterial.original;
  const antigo = original && !ehComandoDeMaterial(original) ? planoAntigo(original) : null;
  let conferirPosicao = true;
  for (const posterior of fila) {
    if (posterior.id! <= item.id! || posterior.alvo !== item.alvo) continue;
    const p = posterior.payload as Partial<EscritaTabela> | null;
    if (!p || (p.linha?.user_id ?? p.filtro?.user_id) !== remota.user_id) continue;
    const linha = p.linha;
    if (p.tabela === "sessions" && linha && (Object.hasOwn(linha, "plano") || Object.hasOwn(linha, "status"))) conferirPosicao = false;
    if (posterior.tipo !== "serie" || p.tabela !== "session_sets" || !linha) continue;
    const { id, session_id, ordem_ex, exercise_id, set_index } = linha;
    if (session_id !== remota.id || typeof exercise_id !== "string" || typeof id !== "string" || typeof set_index !== "number") continue;
    const serie = { id, exercicioId: exercise_id, indice: set_index };
    series.set(id, serie);
    const plano = remota.plano;
    if (!conferirPosicao) continue;
    const origem = typeof ordem_ex === "number" && inclusaoNaPosicao(antigo, ordem_ex);
    const destino = typeof ordem_ex === "number" && inclusaoNaPosicao(plano, ordem_ex);
    const mesmoMovimento = typeof ordem_ex === "number" && (plano?.itens?.[ordem_ex - 1]?.exercicio_id === exercise_id ||
      plano?.trocas?.[ordem_ex]?.some(b => b.exercicio_id === exercise_id));
    if (!mesmoMovimento || (origem && destino && origem !== destino)) incompativeis.push({ ...serie, filaId: posterior.id!, payload: p as EscritaTabela });
  }
  return { incompativeis, series: [...series.values()] };
}

function descrever(p: Conciliacao, item: ItemSaida, fila: ItemSaida[]): MaterialPendente {
  const { remota, original, revisao } = p.conciliacaoDeMaterial;
  const diferencas = compararPlanos(original, remota);
  const { series, incompativeis } = seriesDaFila(remota, item, fila);
  // A decisão só vale para as linhas e valores que estavam visíveis naquele momento.
  const versaoVista = incompativeis.length ? revisao + JSON.stringify(incompativeis) : revisao;
  const paraGuardar = new Map(incompativeis.map(({ id, exercicioId, indice }) => [id, { id, exercicioId, indice }]));
  return { conta: remota.user_id, sessaoId: remota.id, revisao: versaoVista,
    local: ehComandoDeMaterial(original) ? original.equipamentoDaSessao.para : materialDoPlano(planoAntigo(original)),
    sincronizado: materialDoPlano(remota.plano), titulo: remota.plano?.titulo ?? null,
    exerciciosAcrescentados: diferencas.acrescentados, seriesNaFila: series, sessaoEncerrada: remota.status !== "em_andamento",
    seriesParaGuardar: [...paraGuardar.values()], outrasEdicoes: diferencas.outrasEdicoes || incompativeis.length > 0,
  };
}

export async function listarMateriaisPendentes(conta: string): Promise<MaterialPendente[]> {
  if (!conta || !temIndexedDB()) return [];
  await confirmarContaDoTreino(conta, outraConta);
  const banco = bd();
  const casos = await banco.transaction("r", banco.outbox, banco.sessaoAtiva, async () => {
    const fila = await banco.outbox.toArray();
    const casos: MaterialPendente[] = [];
    for (const item of fila) {
      const p = conciliacao(item);
      if (p?.filtro.user_id !== conta || p.conciliacaoDeMaterial.escolha) continue;
      const vista = descrever(p, item, fila);
      const copia = (await banco.sessaoAtiva.get(vista.sessaoId))?.dados as { id?: string; userId?: string; data?: string } | undefined;
      if (copia?.id === vista.sessaoId && copia.userId === conta && typeof copia.data === "string") vista.data = copia.data;
      casos.push(vista);
    }
    return casos;
  });
  await confirmarContaDoTreino(conta, outraConta);
  return casos;
}

const prefixoDasCopias = (conta: string) => `edicoes-guardadas-do-treino:${encodeURIComponent(conta)}:`;

export async function listarCopiasDeMaterial(conta: string): Promise<CopiaDeMaterial[]> {
  if (!conta || !temIndexedDB()) return [];
  await confirmarContaDoTreino(conta, outraConta);
  const itens = await bd().cache.where("chave").startsWith(prefixoDasCopias(conta)).toArray();
  await confirmarContaDoTreino(conta, outraConta);
  return itens.map(i => i.valor as CopiaDeMaterial).filter(c => c.conta === conta)
    .sort((a, b) => b.guardadaEm - a.guardadaEm);
}

export async function lerCopiaDeMaterial(conta: string, id: string): Promise<CopiaDeMaterial> {
  await confirmarContaDoTreino(conta, outraConta);
  const item = await bd().cache.get(prefixoDasCopias(conta) + id);
  const copia = item?.valor as CopiaDeMaterial | undefined;
  if (copia?.conta !== conta || copia.id !== id) throw new Error("Esta cópia não está disponível nesta conta e aparelho.");
  await confirmarContaDoTreino(conta, outraConta);
  return copia;
}

async function conferirLogin(conta: string) {
  if ((await clienteNavegador().auth.getSession()).data.session?.user.id !== conta) throw new Error(outraConta);
}

function validarRemota(dado: unknown, filtro: Destino): SessaoComMaterialConfirmado {
  const r = dado as Partial<SessaoComMaterialConfirmado> | null;
  if (r?.id !== filtro.id || r.user_id !== filtro.user_id || !["em_andamento", "concluida", "abandonada"].includes(r.status ?? "") ||
      (r.revisao_equipamento !== null && typeof r.revisao_equipamento !== "string") ||
      (r.plano !== null && (!r.plano || !Array.isArray(r.plano.itens))) || !materialValido(materialDoPlano(r.plano ?? null))) {
    throw new Error("Não foi possível confirmar este treino com a conta atual.");
  }
  return r as SessaoComMaterialConfirmado;
}

async function lerRemota(filtro: Destino): Promise<SessaoComMaterialConfirmado> {
  const { data, error } = await clienteNavegador().from("sessions").select("id,user_id,status,plano,revisao_equipamento")
    .eq("id", filtro.id).eq("user_id", filtro.user_id).maybeSingle();
  if (error) throw new Error(error.message);
  await conferirLogin(filtro.user_id);
  return validarRemota(data, filtro);
}

async function guardarConflito(item: ItemSaida, filtro: Destino, original: Original, remota: SessaoComMaterialConfirmado) {
  const banco = bd();
  await banco.transaction("rw", banco.outbox, async () => {
    const atual = await banco.outbox.get(item.id!);
    if (!atual || !iguais(atual.payload, item.payload)) throw mudou();
    const payload: Conciliacao = { tabela: "sessions", filtro, conciliacaoDeMaterial: { original, remota, revisao: crypto.randomUUID() } };
    await banco.outbox.update(item.id!, { payload });
  });
  return "aguarda-material" as const;
}

export async function protegerPlanoLegado(item: ItemSaida, original: EscritaTabela) {
  const id = original.filtro?.id, conta = original.filtro?.user_id;
  if (typeof id !== "string" || typeof conta !== "string") throw new Error(outraConta);
  const filtro = { id, user_id: conta };
  return guardarConflito(item, filtro, original, await lerRemota(filtro));
}

export async function resolverMaterialPendente(conta: string, vista: MaterialPendente, escolha: Escolha): Promise<void> {
  if (vista.conta !== conta) throw new Error(outraConta);
  await comTravaDaFila(async () => {
    await confirmarContaDoTreino(conta, outraConta);
    const banco = bd();
    await banco.transaction("rw", banco.outbox, async () => {
      const fila = await banco.outbox.toArray();
      const item = fila.find(i => {
        const p = conciliacao(i);
        return p?.filtro.id === vista.sessaoId && p.filtro.user_id === conta && descrever(p, i, fila).revisao === vista.revisao;
      });
      if (!item) throw mudou();
      const p = conciliacao(item)!;
      const c = p.conciliacaoDeMaterial;
      const atual = descrever(p, item, fila);
      if (c.escolha || atual.outrasEdicoes !== (escolha === "guardar-copia") ||
          (atual.sessaoEncerrada && escolha === "aparelho")) throw mudou();
      let comandoEscolhido: ComandoDeMaterial | undefined;
      if (escolha === "aparelho") {
        // O 409 confirma que este comando não tem recibo. As próximas escolhas offline já citam seu UUID.
        comandoEscolhido = ehComandoDeMaterial(c.original)
          ? { ...c.original, equipamentoDaSessao: { ...c.original.equipamentoDaSessao,
            de: atual.sincronizado, revisaoBase: c.remota.revisao_equipamento } }
          : comandoDeMaterialDaSessao(conta, vista.sessaoId, c.remota.revisao_equipamento, atual.sincronizado, atual.local);
      }
      const seriesAprovadas = escolha === "guardar-copia" ? seriesDaFila(c.remota, item, fila).incompativeis : undefined;
      const payload: Conciliacao = { ...p, conciliacaoDeMaterial: { ...c, escolha, comandoEscolhido, seriesAprovadas } };
      const agora = Date.now();
      await banco.outbox.update(item.id!, { payload, proximaTentativa: agora, tentativas: 0, erro: undefined });
      for (const posterior of fila) {
        const saida = posterior.payload as Partial<EscritaTabela> | null;
        if (posterior.id! > item.id! && posterior.alvo === item.alvo && posterior.proximaTentativa === item.proximaTentativa &&
            (saida?.linha?.user_id ?? saida?.filtro?.user_id) === conta) {
          await banco.outbox.update(posterior.id!, { proximaTentativa: agora });
        }
      }
    });
  });
  void processar();
}

class SeriesParaGuardarMudaram extends Error {}

async function arquivarEdicaoConfirmada(item: ItemSaida, p: Conciliacao, remota: SessaoComMaterialConfirmado) {
  const c = p.conciliacaoDeMaterial;
  if (!iguais(c.remota, remota)) return guardarConflito(item, p.filtro, c.original, remota);
  let guardada = false;
  try {
    await guardarMaterialConfirmadoNoAparelho(p.filtro.user_id, remota, item, async sessaoLocal => {
      // O arquivo, a adoção do plano e a retirada das escritas fazem parte do mesmo commit do aparelho.
      const banco = bd();
      const fila = await banco.outbox.toArray();
      const atual = fila.find(i => i.id === item.id);
      if (!atual || !iguais(atual.payload, item.payload)) throw mudou();
      const seriesGuardadas = seriesDaFila(remota, item, fila).incompativeis;
      if (!iguais(c.seriesAprovadas, seriesGuardadas)) throw new SeriesParaGuardarMudaram();
      const guardadaEm = Date.now();
      const copia: CopiaDeMaterial = {
        formato: "treino-terraco-edicoes-de-sessao-v1", id: c.revisao, conta: remota.user_id, sessaoId: remota.id,
        titulo: remota.plano?.titulo ?? sessaoLocal?.plano?.titulo ?? null, guardadaEm,
        original: c.original, remota, seriesGuardadas, ...(sessaoLocal ? { sessaoLocal, data: sessaoLocal.data } : {}),
      };
      await banco.cache.add({ chave: prefixoDasCopias(copia.conta) + copia.id, valor: copia, atualizadoEm: guardadaEm });
      await banco.outbox.bulkDelete([item.id!, ...seriesGuardadas.map(s => s.filaId)]);
      guardada = true;
    });
  } catch (erro) {
    if (erro instanceof SeriesParaGuardarMudaram) return guardarConflito(item, p.filtro, c.original, remota);
    throw erro;
  }
  if (!guardada) throw new Error("Não foi possível guardar a cópia das edições neste aparelho.");
  return "fila-reconciliada" as const;
}

export async function enviarMaterialDaSessao(item: ItemSaida) {
  const p = conciliacao(item);
  const c = p?.conciliacaoDeMaterial;
  if (c && !c.escolha) return "aguarda-material" as const;
  const comando = comandoDeMaterialNaFila(item);
  const filtro = p?.filtro ?? comando?.filtro;
  if (!filtro) throw new Error("Pedido de equipamento inválido.");
  await conferirLogin(filtro.user_id);
  let remota: SessaoComMaterialConfirmado;
  if (c) {
    remota = await lerRemota(filtro);
    if (c.escolha === "guardar-copia") return arquivarEdicaoConfirmada(item, p!, remota);
    if (seriesDaFila(remota, item, await bd().outbox.toArray()).incompativeis.length > 0 ||
        (c.escolha === "sincronizado" && (remota.revisao_equipamento !== c.remota.revisao_equipamento ||
          !iguais(materialDoPlano(remota.plano), materialDoPlano(c.remota.plano))))) {
      return guardarConflito(item, filtro, c.original, remota);
    }
    if (c.escolha === "sincronizado") {
      await guardarMaterialConfirmadoNoAparelho(filtro.user_id, remota, item);
      return;
    }
  }
  if (!comando) throw new Error("Falta a escolha de equipamento.");
  const m = comando.equipamentoDaSessao;
  const { data, error } = await clienteNavegador().rpc("alterar_material_da_sessao", {
    p_sessao: filtro.id, p_comando: m.comando, p_revisao_base: m.revisaoBase,
    p_de: m.de, p_para: m.para, p_plano_inicial: m.planoInicial ?? null,
  });
  if (error) {
    if (error.code === "PT409" && error.message === "MATERIAL_DA_SESSAO_ALTERADO") {
      return guardarConflito(item, filtro, c?.original ?? comando, await lerRemota(filtro));
    }
    throw new Error(error.message);
  }
  await conferirLogin(filtro.user_id);
  remota = validarRemota(data, filtro);
  await guardarMaterialConfirmadoNoAparelho(filtro.user_id, remota, item);
}
