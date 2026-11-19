/**
 * A sessão de força no aparelho (SPEC §3.2 e §8).
 *
 * Regra que manda aqui: **nunca perder um registro**. Todo toque vai para o
 * IndexedDB na hora (debounce curtíssimo, com descarga ao sair da aba) e o
 * Supabase recebe pela fila de saída, com retry. Os ids são gerados no cliente,
 * então dá para começar, registrar e concluir um treino inteiro sem sinal.
 */
"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { equipamentosDaAlternativa } from "@/lib/alternativas";
import { bd, temIndexedDB } from "@/lib/db";
import { acharTreino, exercicioPorId } from "@/lib/dados";
import { equipamentoDaSessao } from "@/lib/equipamento-da-sessao";
import {
  WORKOUT_LIVRE,
  itensDeIds,
  itensNaOrdem,
  planoDaSessao,
} from "@/lib/livre";
import { alvoDaEscrita, type EscritaTabela } from "@/lib/outbox-supabase";
import type { EstadoPlayer } from "@/lib/player";
import { guardarConsultasAgora } from "@/lib/persistencia-query";
import { esperarFila, guardarNaFila, pendentes, processar } from "@/lib/outbox";
import { chaveDoHistorico, guardarConclusaoNoHistorico } from "@/lib/queries/historico-da-sessao";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { lerMotorParaRepetir } from "@/lib/queries/motor-repetir-treino";
import { chaves, type SessaoResumo } from "@/lib/queries/dados";
import {
  acrescentarExercicioNaSessao as acrescentarBloco,
  bloquearDesfazerSeIniciado,
  comSubstituicoes,
  concluirSessao,
  definirDescansoDoExercicioNaSessao,
  definirEquipamentoDaSessao,
  desfazerUltimaInclusao,
  escritaDaSerie,
  escritasDasSeriesFeitas,
  escritaDaSessao,
  itensDoTreino,
  montarSessao,
  montarSessaoAvulsa,
  MENSAGEM_NOTA_GERAL_ALTERADA,
  notasDaSessao,
  planoParaGravar,
  type BlocoLocal,
  type Conclusao,
  type EntradaAvulsa,
  type EntradaMontagem,
  type ItemDaSessao,
  type SerieLocal,
  type SessaoLocal,
} from "@/lib/sessao";
import type { TipoSaida } from "@/lib/db";
import type { PlanoDaSessao, StatusSessao } from "@/lib/types";
import { clienteNavegador } from "@/lib/supabase/client";

/** Id novo, gerado no cliente (SPEC §8). */
export function novoId(): string {
  return crypto.randomUUID();
}

/* --------------------------------------------------- IndexedDB (a sessão) */

/**
 * Espera entre o toque e a gravação. Curtíssimo de propósito: agrupa a rajada
 * de um stepper segurado sem deixar nada para trás — e `descarregarSessao()`
 * grava na hora quando a aba some.
 */
const ESPERA_MS = 60;

let pendente: SessaoLocal | null = null;
let basePendente: SessaoLocal | undefined;
let gravandoToque: Promise<void> | null = null;
let relogio: ReturnType<typeof setTimeout> | null = null;

/** A aba pode ainda ter o plano anterior ao último exercício, material ou intervalo guardado. */
function preservarPlanoSalvo(
  plano: PlanoDaSessao | null, salva: SessaoLocal | null, manterMaterial: boolean,
): PlanoDaSessao | null {
  if (!salva) return plano;
  const base = plano ?? salva.plano;
  if (!base) return null;
  const atualizado = { ...base };
  const persistido = salva.plano;
  if (persistido?.descansos_por_exercicio) atualizado.descansos_por_exercicio = persistido.descansos_por_exercicio;
  else delete atualizado.descansos_por_exercicio;
  if (manterMaterial) {
    if (persistido?.equipamento_disponivel) atualizado.equipamento_disponivel = persistido.equipamento_disponivel;
    else delete atualizado.equipamento_disponivel;
  }
  const inclusao = persistido?.ultima_inclusao;
  if (salva.workoutId === WORKOUT_LIVRE && inclusao) {
    // Só os comandos atômicos de adicionar e desfazer podem mudar a lista ou o token da inclusão.
    atualizado.itens = persistido.itens;
    if (persistido.trocas) atualizado.trocas = persistido.trocas;
    else delete atualizado.trocas;
    const iniciou = base.ultima_inclusao?.id === inclusao.id && base.ultima_inclusao.estado === "iniciada";
    atualizado.ultima_inclusao = iniciou && inclusao.estado === "disponivel"
      ? { ...inclusao, estado: "iniciada" } : inclusao;
    return atualizado;
  }
  delete atualizado.ultima_inclusao;
  if (salva.workoutId === WORKOUT_LIVRE && Array.isArray(persistido?.itens) &&
      Array.isArray(base.itens) && persistido.itens.length > base.itens.length) {
    atualizado.itens = persistido.itens;
    // Os blocos que a aba ainda não viu também podem ter sido substituídos.
    const trocas = planoParaGravar(salva)?.trocas;
    for (const [ordem, historico] of Object.entries(trocas ?? {})) {
      if (Number(ordem) > base.itens.length) {
        atualizado.trocas = { ...atualizado.trocas, [ordem]: historico };
      }
    }
  }
  return atualizado;
}

/** A troca pode criar novas séries pendentes, mas arquiva os registros do movimento anterior. */
function blocosCompartilhamSeries(a: BlocoLocal | undefined, b: BlocoLocal | undefined): boolean {
  if (!a || !b || a.originalId !== b.originalId) return false;
  if (a === b) return true;
  const ids = new Set([a, ...(a.trocados ?? [])].flatMap(bloco => bloco.series.map(serie => serie.id)));
  return [b, ...(b.trocados ?? [])].some(bloco => bloco.series.some(serie => ids.has(serie.id)));
}

function comCamposEditados<T extends object>(gravado: T, base: T, editado: T): T {
  const resultado = { ...gravado };
  for (const campo of Object.keys(editado) as (keyof T)[]) {
    if (editado[campo] !== base[campo]) resultado[campo] = editado[campo];
  }
  return resultado;
}

/** Um toque em reps, firme ou nota não sobrescreve as edições de outra aba no mesmo exercício. */
function conciliarEdicaoDoBloco(gravado: BlocoLocal, base: BlocoLocal, editado: BlocoLocal): BlocoLocal {
  if (gravado.exercicioId !== base.exercicioId || base === editado) return gravado;
  if (editado.exercicioId !== base.exercicioId) {
    // A troca arquiva um retrato inteiro do movimento. Só esse comando precisa comparar todo o bloco.
    return JSON.stringify(gravado) === JSON.stringify(base) ? editado : gravado;
  }
  const bloco = comCamposEditados(gravado, base, editado);
  if (base.series === editado.series) return bloco;
  const antes = new Map(base.series.map(s => [s.id, s]));
  const tocadas = new Map(editado.series.map(s => [s.id, s]));
  bloco.series = gravado.series.flatMap(salva => {
    const anterior = antes.get(salva.id);
    if (!anterior) return [salva]; // Criada na outra aba.
    const tocada = tocadas.get(salva.id);
    if (tocada) return [comCamposEditados(salva, anterior, tocada)];
    // O corte da prescrição só pode retirar uma série que continua intocada.
    const mudou = (Object.keys(anterior) as (keyof SerieLocal)[]).some(k => anterior[k] !== salva[k]);
    return salva.concluida || mudou ? [salva] : [];
  });
  for (const nova of editado.series) {
    if (!antes.has(nova.id) && !bloco.series.some(s => s.tipo === nova.tipo && s.setIndex === nova.setIndex)) {
      bloco.series.push(nova);
    }
  }
  if (bloco.series.length !== gravado.series.length || bloco.series.length !== editado.series.length) {
    bloco.prescricao = { ...bloco.prescricao, series: bloco.series.filter(s => s.tipo === "trabalho").length };
  }
  return bloco;
}

/** A lista confirmada no disco pode ter crescido, encolhido ou recebido o mesmo exercício com novos UUIDs. */
export function conciliarBlocosAcrescentados(atual: SessaoLocal, salva: SessaoLocal): SessaoLocal {
  if (atual.id !== salva.id || atual.userId !== salva.userId || atual.workoutId !== WORKOUT_LIVRE) return atual;
  if (!salva.plano?.ultima_inclusao && atual.blocos.length >= salva.blocos.length) return atual;
  const inclusaoAtual = atual.plano?.ultima_inclusao;
  const inclusaoSalva = salva.plano?.ultima_inclusao;
  const mesmaLista = inclusaoAtual && inclusaoAtual.id === inclusaoSalva?.id &&
    (inclusaoAtual.estado === "desfeita") === (inclusaoSalva.estado === "desfeita");
  const blocos = salva.blocos.map((gravado, i) => {
    const bloco = atual.blocos[i];
    return bloco && (mesmaLista || blocosCompartilhamSeries(bloco, gravado)) ? bloco : gravado;
  });
  const ordem = atual.player?.ordem;
  const passoRemovido = ordem != null && (!blocos[ordem - 1] ||
    (!mesmaLista && !blocosCompartilhamSeries(atual.blocos[ordem - 1], blocos[ordem - 1])));
  return {
    ...atual, blocos, plano: preservarPlanoSalvo(atual.plano, salva, true),
    ...(passoRemovido ? { player: salva.player } : {}),
  };
}

export function mesmoRelogio(a: SessaoLocal["player"], b: SessaoLocal["player"]): boolean {
  return a?.chave === b?.chave && a?.fimEm === b?.fimEm && a?.totalS === b?.totalS;
}

async function gravar(sessao: SessaoLocal, antes?: SessaoLocal): Promise<void> {
  if (!temIndexedDB()) return;
  const banco = bd();
  const mudouPlano = await banco.transaction("rw", banco.sessaoAtiva, banco.outbox, async () => {
    const salva = await carregarSessaoLocal(sessao.id);
    if (antes && (!salva || salva.status !== "em_andamento")) throw new Error("Esta sessão não está aberta neste aparelho.");
    if (salva && salva.userId !== sessao.userId) throw new Error("A sessão pertence a outra conta.");
    // Uma reconstrução pela rede pode terminar depois que a cópia local já avançou.
    if (!antes && salva?.plano?.ultima_inclusao) return false;
    const plano = antes && salva && sessao.plano === antes.plano ? salva.plano : preservarPlanoSalvo(sessao.plano, salva, true);
    const nova = { ...(salva ? conciliarBlocosAcrescentados(sessao, salva) : sessao), plano };
    // Só o editor altera esta nota. Um toque em uma série pode partir de uma aba com a versão anterior.
    if (salva?.notaGeral !== undefined) {
      nova.notaGeral = salva.notaGeral;
      nova.revisaoNotaGeral = salva.revisaoNotaGeral;
    }
    if (salva && antes) {
      if (sessao.descansoPadraoConhecidoS === antes.descansoPadraoConhecidoS) {
        nova.descansoPadraoConhecidoS = salva.descansoPadraoConhecidoS;
      }
      // Um toque pendente não volta a um passo ou exercício já trocado em outra aba.
      if (sessao.player === antes.player || !mesmoRelogio(antes.player, salva.player)) nova.player = salva.player;
      nova.blocos = nova.blocos.map(bloco => {
        const base = antes.blocos.find(b => b.ordem === bloco.ordem);
        const maisNovo = salva.blocos.find(b => b.ordem === bloco.ordem);
        if (!maisNovo) return bloco;
        if (base && salva.plano?.ultima_inclusao) {
          // Se a lista mudou, a conciliação já devolveu o bloco da geração atual.
          if (bloco === maisNovo) return maisNovo;
          return conciliarEdicaoDoBloco(maisNovo, base, bloco);
        }
        if (base === bloco || maisNovo.exercicioId !== (base ?? bloco).exercicioId) return maisNovo;
        return bloco;
      });
    }
    const completa = bloquearDesfazerSeIniciado(nova);
    await banco.sessaoAtiva.put({ id: sessao.id, dados: completa, atualizadoEm: Date.now() });
    if (salva?.plano?.ultima_inclusao?.estado !== "disponivel" || completa.plano?.ultima_inclusao?.estado !== "iniciada") return false;
    const escrita = escritaDoPlano(completa.id, completa.userId, planoParaGravar(completa));
    await guardarNaFila("sessao", escrita, alvoDaEscrita(escrita));
    return true;
  });
  if (mudouPlano) void processar();
}

/** Guarda a sessão no aparelho. Não lança: o registro não pode sumir por erro. */
export function salvarSessaoLocal(sessao: SessaoLocal, antes?: SessaoLocal): void {
  if (!pendente || pendente.id !== sessao.id || pendente.userId !== sessao.userId) basePendente = antes;
  pendente = sessao;
  if (relogio) clearTimeout(relogio);
  relogio = setTimeout(() => {
    void descarregarSessao();
  }, ESPERA_MS);
}

/** Grava agora o que estiver pendente (saída da aba, conclusão, recarga). */
export async function descarregarSessao(): Promise<void> {
  await confirmarToquesPendentes().catch(() => {});
}

export async function carregarSessaoLocal(id: string): Promise<SessaoLocal | null> {
  if (!temIndexedDB()) return null;
  const item = await bd().sessaoAtiva.get(id);
  return item ? (item.dados as SessaoLocal) : null;
}

/** A sessão aberta mais recente guardada neste aparelho. */
export async function sessaoLocalMaisRecente(conta?: string, encerradas?: ReadonlySet<string>): Promise<SessaoLocal | null> {
  if (!temIndexedDB()) return null;
  const recentes = bd().sessaoAtiva.orderBy("atualizadoEm").reverse();
  const item = await (conta === undefined ? recentes : recentes.filter(({ dados }) => {
    const sessao = dados as SessaoLocal;
    return sessao.userId === conta && sessao.status === "em_andamento" && !encerradas?.has(sessao.id);
  })).first();
  return item ? (item.dados as SessaoLocal) : null;
}

export async function apagarSessaoLocal(id: string): Promise<void> {
  if (!temIndexedDB()) return;
  await bd().sessaoAtiva.delete(id).catch(() => {});
}

/* ------------------------------------------------------ fila de saída */

const TIPO_POR_TABELA: Record<string, TipoSaida> = {
  sessions: "sessao",
  session_sets: "serie",
  exercise_state: "estado_exercicio",
  progression_events: "evento_progressao",
  profiles: "perfil",
  body_weights: "peso",
};

/* ------------------------------------------------------------- começar */

export interface EntradaCriacao extends Omit<EntradaMontagem, "id"> {
  cliente: QueryClient;
  id?: string;
  /**
   * Substituições escolhidas na lista da aba Treino (SPEC §13.3): exercício do
   * programa → substituto. Aplicadas à sessão recém-montada, como se a troca
   * tivesse sido feita no bloco (§3.2).
   */
  substituicoes?: Record<string, string>;
  /**
   * A ordem escolhida em "Editar" (SPEC §14.3), por id do exercício do
   * programa. Quando há ordem, ela vai junto para `sessions.plano`: é o que
   * refaz a sessão na mesma ordem noutro aparelho.
   */
  ordem?: readonly string[];
}

/**
 * "Começar treino" (SPEC §3.2): a sessão nasce no aparelho com um uuid do
 * cliente e entra na fila de saída. A navegação não espera a rede.
 */
export async function criarSessao(entrada: EntradaCriacao): Promise<SessaoLocal> {
  const { cliente, substituicoes, ordem, ...resto } = entrada;
  const id = entrada.id ?? novoId();
  const base = itensDoTreino(resto.treinoId);
  const reordenado = ordem && ordem.length > 0 ? itensNaOrdem(base, ordem) : null;
  const montada = reordenado
    ? montarSessaoAvulsa({
        ...resto,
        id,
        novoId,
        workoutId: resto.treinoId,
        itens: reordenado,
        plano: planoDaSessao(reordenado, {
          titulo: acharTreino(resto.treinoId).nome,
          colecao: `treino:${resto.treinoId}`,
        }),
      })
    : montarSessao({ ...resto, id, novoId });
  const sessao =
    substituicoes && Object.keys(substituicoes).length > 0
      ? comSubstituicoes(montada, substituicoes, {
          estados: resto.estados,
          anteriores: resto.anteriores,
          recordes: resto.recordes,
          estadoConhecido: resto.estadoConhecido,
          conhecidos: resto.conhecidos,
          novoId,
        })
      : montada;
  return registrarSessaoNova(sessao, cliente);
}

export interface EntradaCriacaoAvulsa extends Omit<EntradaAvulsa, "id"> {
  cliente: QueryClient;
  id?: string;
}

export type EntradaCriacaoLivre = Omit<EntradaAvulsa, "id" | "workoutId" | "itens"> & {
  cliente: QueryClient;
  id?: string;
  /** O rótulo da coleção que gerou a sessão ("Core no tatame"). */
  titulo?: string | null;
  /** O id da coleção derivada ("grupo:Core"), quando veio de uma. */
  colecao?: string | null;
  /** Na repetição, retoma uma sessão que outra aba possa ter criado durante a leitura. */
  retomarSeAberta?: { encerradas: ReadonlySet<string> };
} & (
  | { exercicios: readonly string[]; itens?: never }
  | { itens: readonly ItemDaSessao[]; exercicios?: never }
);

/**
 * "Começar" numa coleção ou no "Personalizar treino" (SPEC §13.4 e §14.3): a
 * sessão nasce com `workout_id = 'livre'` e a lista vai para `sessions.plano`,
 * que é o que a refaz noutro aparelho. Daí para a frente ela é uma sessão de
 * força como qualquer outra — registro por série, motor e fila iguais (§6).
 */
export async function criarSessaoLivre(
  entrada: EntradaCriacaoLivre,
): Promise<SessaoLocal> {
  const { cliente, exercicios, itens: prescritos, titulo, colecao, retomarSeAberta, ...resto } = entrada;
  const id = entrada.id ?? novoId();
  const itens = prescritos ? [...prescritos] : itensDeIds(exercicios);
  if (itens.length === 0) throw new Error("sessão livre sem exercício");
  const sessao = montarSessaoAvulsa({
    ...resto,
    id,
    novoId,
    workoutId: WORKOUT_LIVRE,
    itens,
    plano: planoDaSessao(itens, { titulo, colecao }),
  });
  return registrarSessaoNova(sessao, cliente, retomarSeAberta);
}

/**
 * "Fazer sessão de barra fixa" (SPEC §3.4): a mesma sessão de força, com os
 * exercícios vindo do plano da semana em vez do `programa.json`.
 */
export async function criarSessaoAvulsa(
  entrada: EntradaCriacaoAvulsa,
): Promise<SessaoLocal> {
  const { cliente, ...resto } = entrada;
  const id = entrada.id ?? novoId();
  return registrarSessaoNova(montarSessaoAvulsa({ ...resto, id, novoId }), cliente);
}

async function registrarSessaoNova(
  sessao: SessaoLocal,
  cliente: QueryClient,
  retomarSeAberta?: { encerradas: ReadonlySet<string> },
): Promise<SessaoLocal> {
  const salva = await gravarSessaoComSaida(sessao, { retomarSeAberta });
  if (salva !== sessao) return salva;

  cliente.setQueryData<SessaoResumo[]>(chaves.sessoesAbertas(), (atual) => [
    {
      id: sessao.id,
      user_id: sessao.userId,
      data: sessao.data,
      status: "em_andamento",
      workout_id: sessao.workoutId,
      fase: sessao.fase,
      concluida_em: null,
    },
    ...(atual ?? []),
  ]);

  return sessao;
}

type AlterarSessao = (atual: SessaoLocal) => SessaoLocal;

async function gravarSessaoComSaida(
  sessao: SessaoLocal,
  { alterar, escritaDaAlteracao, retomarSeAberta }: {
    alterar?: AlterarSessao;
    escritaDaAlteracao?: (atual: SessaoLocal) => EscritaTabela;
    retomarSeAberta?: { encerradas: ReadonlySet<string> };
  },
): Promise<SessaoLocal> {
  const banco = bd();
  const gravada = await banco.transaction("rw", banco.sessaoAtiva, banco.outbox, async () => {
    let atual = sessao;
    let escrita: EscritaTabela;
    if (retomarSeAberta) {
      const existente = await sessaoLocalMaisRecente(sessao.userId, retomarSeAberta.encerradas);
      if (existente) return existente;
    }
    if (alterar) {
      // Outra aba pode ter registrado uma série ou encerrado o treino desde a renderização.
      const salva = await carregarSessaoLocal(sessao.id);
      if (!salva || salva.userId !== sessao.userId || salva.status !== "em_andamento") {
        throw new Error("Esta sessão não está aberta nesta conta e aparelho.");
      }
      atual = alterar(salva);
      if (atual === salva) return salva;
      escrita = escritaDaAlteracao ? escritaDaAlteracao(atual) : escritaDoPlano(atual.id, atual.userId, planoParaGravar(atual));
    } else {
      escrita = escritaDaSessao(atual);
    }
    await banco.sessaoAtiva.put({ id: atual.id, dados: atual, atualizadoEm: Date.now() });
    await guardarNaFila("sessao", escrita, alvoDaEscrita(escrita));
    return atual;
  });
  if (alterar || gravada === sessao) void processar();
  return gravada;
}

function escritaDoPlano(id: string, userId: string, plano: PlanoDaSessao | null): EscritaTabela {
  return {
    tabela: "sessions", op: "update", linha: { plano },
    filtro: { id, user_id: userId, status: "em_andamento" },
  };
}

/** Releitura e enfileiramento na mesma transação mantêm a ordem em relação ao editor de descanso. */
async function enfileirarComPlanoAtual(id: string, conta: string, escrita: EscritaTabela, manterMaterial: boolean): Promise<SessaoLocal | null> {
  const banco = bd();
  const confirmada = await banco.transaction("rw", banco.sessaoAtiva, banco.outbox, async () => {
    const salva = await carregarSessaoLocal(id);
    if (salva && salva.userId !== conta) throw new Error("A sessão pertence a outra conta.");
    // As trocas e a lista da sessão livre já foram conciliadas ao descarregar a edição de tela.
    const recebido = escrita.linha?.plano as PlanoDaSessao | null;
    let plano = preservarPlanoSalvo(recebido, salva, manterMaterial);
    if (salva?.plano?.ultima_inclusao) {
      plano = planoParaGravar(salva);
      if (!manterMaterial && plano) plano = { ...plano, equipamento_disponivel: recebido?.equipamento_disponivel };
    }
    const completa = { ...escrita, linha: { ...escrita.linha, plano } };
    await guardarNaFila("sessao", completa, alvoDaEscrita(completa));
    return salva;
  });
  void processar();
  return confirmada;
}

/** A fila ordena as edições do plano pelo mesmo ID da sessão. */
export async function gravarPlanoDaSessao(id: string, userId: string, plano: PlanoDaSessao | null): Promise<void> {
  await enfileirarComPlanoAtual(id, userId, escritaDoPlano(id, userId, plano), false);
}

export async function enviarPlanoDaSessao(sessao: SessaoLocal): Promise<SessaoLocal | null> {
  await confirmarToquesPendentes(sessao);
  return enfileirarComPlanoAtual(sessao.id, sessao.userId, escritaDoPlano(sessao.id, sessao.userId, planoParaGravar(sessao)), true);
}

export { enviarPlanoDaSessao as enviarPlanoDaTroca };

async function confirmarToquesPendentes(sessao?: SessaoLocal): Promise<void> {
  while (gravandoToque) await gravandoToque;
  const atual = pendente;
  if (!atual || (sessao && (atual.id !== sessao.id || atual.userId !== sessao.userId))) return;
  const antes = basePendente;
  pendente = null;
  basePendente = undefined;
  if (relogio) clearTimeout(relogio);
  relogio = null;
  const gravacao = gravar(atual, antes);
  gravandoToque = gravacao;
  try {
    await gravacao;
  } catch (erro) {
    // O debounce pode ter falhado por quota antes de a pessoa tocar em Concluir.
    // Mantém o toque (ou sua edição mais nova) para a próxima tentativa explícita.
    if (!pendente) pendente = atual;
    if (pendente.id === atual.id && pendente.userId === atual.userId) basePendente = antes;
    throw erro;
  } finally {
    gravandoToque = null;
  }
}

/** Confirma a escolha depois de a cópia local e o PATCH entrarem no mesmo commit. */
async function guardarAjusteDoPlano(
  sessao: SessaoLocal, alterar: AlterarSessao, conferir?: (atual: SessaoLocal) => void,
  atualizarPendente: (atual: SessaoLocal, salva: SessaoLocal) => SessaoLocal = alterar,
): Promise<SessaoLocal> {
  await confirmarToquesPendentes(sessao);
  const salva = await gravarSessaoComSaida(sessao, { alterar: atual => {
    conferir?.(atual);
    return alterar(atual);
  } });
  if (pendente?.id === sessao.id && pendente.userId === sessao.userId) pendente = atualizarPendente(pendente, salva);
  return salva;
}

export function guardarMaterialDaSessao(sessao: SessaoLocal): Promise<SessaoLocal> {
  const equipamento = equipamentoDaSessao(sessao);
  return guardarAjusteDoPlano(sessao, atual => definirEquipamentoDaSessao(atual, equipamento));
}

export { MENSAGEM_NOTA_GERAL_ALTERADA } from "@/lib/sessao";

/** Confirma o texto exibido no editor e o seu envio na mesma transação do aparelho. */
export async function guardarNotaGeralDaSessao(sessao: SessaoLocal, texto: string): Promise<SessaoLocal> {
  const nota = texto.trim() || null;
  await confirmarToquesPendentes(sessao);
  await confirmarContaDoTreino(sessao.userId, "Não foi possível confirmar a conta deste treino.");
  return gravarSessaoComSaida(sessao, {
    alterar: salva => {
      if ((salva.notaGeral ?? null) === nota) return salva;
      if ((salva.notaGeral ?? null) !== (sessao.notaGeral ?? null)) throw new Error(MENSAGEM_NOTA_GERAL_ALTERADA);
      return { ...salva, notaGeral: nota, revisaoNotaGeral: novoId() };
    },
    // Uma edição offline também pertence à sessão se outro aparelho a concluir antes da sincronização.
    escritaDaAlteracao: atual => ({
      tabela: "sessions", op: "update", linha: { nota_geral: nota }, filtro: { id: atual.id, user_id: atual.userId },
    }),
  });
}

/** Ao reabrir, incorpora uma edição de outro aparelho se a cópia local continua sem edição pendente. */
export async function sincronizarNotaGeralDaSessao(sessao: SessaoLocal, sinal?: AbortSignal): Promise<SessaoLocal | null> {
  if (navigator.onLine === false || !temIndexedDB()) return null;
  const banco = bd();
  const lerSemEdicaoPendente = async () => {
    const salva = await carregarSessaoLocal(sessao.id);
    if (salva?.userId !== sessao.userId || salva.status !== "em_andamento") return null;
    const pendente = await banco.outbox.where("tipo").equals("sessao").filter(item => {
      const p = item.payload as EscritaTabela;
      return p.tabela === "sessions" && p.filtro?.id === sessao.id && p.filtro.user_id === sessao.userId &&
        Object.hasOwn(p.linha ?? {}, "nota_geral");
    }).first();
    return pendente ? null : salva;
  };
  const base = await banco.transaction("r", banco.sessaoAtiva, banco.outbox, lerSemEdicaoPendente);
  if (!base || sinal?.aborted) return null;
  let consulta = clienteNavegador().from("sessions").select("nota_geral")
    .eq("id", sessao.id).eq("user_id", sessao.userId).eq("status", "em_andamento");
  if (sinal) consulta = consulta.abortSignal(sinal);
  const { data, error } = await consulta.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || (data.nota_geral !== null && typeof data.nota_geral !== "string")) return null;
  const nota: string | null = data.nota_geral;
  return banco.transaction("rw", banco.sessaoAtiva, banco.outbox, async () => {
    const atual = await lerSemEdicaoPendente();
    if (!atual || sinal?.aborted || base.notaGeral !== atual.notaGeral || base.revisaoNotaGeral !== atual.revisaoNotaGeral) return null;
    if (nota === (atual.notaGeral ?? null)) return atual;
    const reconciliada = { ...atual, notaGeral: nota, revisaoNotaGeral: novoId() };
    await banco.sessaoAtiva.put({ id: atual.id, dados: reconciliada, atualizadoEm: Date.now() });
    return reconciliada;
  });
}

export const MENSAGEM_CRONOMETRO_ALTERADO = "O descanso mudou. Reabra o treino para ver o tempo atual.";

/** A confirmação de um ajuste avulso depende só do relógio no aparelho. */
export async function guardarCronometroDaSessao(
  sessao: SessaoLocal, novo: EstadoPlayer,
): Promise<SessaoLocal> {
  const antes = sessao.player;
  if (sessao.status !== "em_andamento" || !antes?.chave.startsWith("descanso:") ||
      antes.fimEm === null || antes.totalS === null || novo.chave !== antes.chave ||
      novo.ordem !== antes.ordem || novo.fimEm === null || !Number.isFinite(novo.fimEm) ||
      novo.totalS === null || !Number.isFinite(novo.totalS) || novo.totalS < 0) {
    throw new Error(MENSAGEM_CRONOMETRO_ALTERADO);
  }
  await confirmarContaDoTreino(sessao.userId, "Não foi possível confirmar a conta deste treino.");
  await confirmarToquesPendentes(sessao);
  const banco = bd();
  return banco.transaction("rw", banco.sessaoAtiva, async () => {
    const salva = await carregarSessaoLocal(sessao.id);
    if (!salva || salva.userId !== sessao.userId || salva.status !== "em_andamento") {
      throw new Error("Esta sessão não está aberta nesta conta e aparelho.");
    }
    const ordem = antes.ordem;
    const movimentoMudou = ordem != null && sessao.blocos.find(b => b.ordem === ordem)?.exercicioId !==
      salva.blocos.find(b => b.ordem === ordem)?.exercicioId;
    if (!salva.player || (salva.player.ordem ?? null) !== (ordem ?? null) ||
        !mesmoRelogio(antes, salva.player) || movimentoMudou) {
      throw new Error(MENSAGEM_CRONOMETRO_ALTERADO);
    }
    const player = { ...salva.player, fimEm: novo.fimEm, totalS: novo.totalS };
    const atual = { ...salva, player };
    await banco.sessaoAtiva.put({ id: salva.id, dados: atual, atualizadoEm: Date.now() });
    return atual;
  });
}

export function guardarDescansoDaSessao(
  sessao: SessaoLocal, exercicioId: string, segundos: number | null, relogioAjustado?: EstadoPlayer,
): Promise<SessaoLocal> {
  const novoPlayer = segundos === null ? undefined : relogioAjustado;
  const bloco = sessao.blocos.find(b => b.exercicioId === exercicioId);
  return guardarAjusteDoPlano(sessao, atual => {
    const nova = definirDescansoDoExercicioNaSessao(atual, exercicioId, segundos);
    return novoPlayer && mesmoRelogio(atual.player, sessao.player) ? { ...nova, player: novoPlayer } : nova;
  }, atual => {
    const mesmoExercicio = bloco && atual.blocos.some(b => b.ordem === bloco.ordem && b.exercicioId === exercicioId);
    if (!mesmoExercicio || (novoPlayer && (novoPlayer.chave !== sessao.player?.chave || !mesmoRelogio(atual.player, sessao.player)))) {
      throw new Error("O treino mudou. Abra o descanso de novo.");
    }
  });
}

export const MENSAGEM_EQUIPAMENTO_ALTERADO = "O equipamento deste treino mudou. Reabra o treino para ver os exercícios disponíveis.";

/** Acrescenta ao treino aberto, usando a carga confirmada do movimento para esta conta. */
export async function acrescentarExercicioNaSessao(
  cliente: QueryClient, sessao: SessaoLocal, exercicioId: string,
): Promise<SessaoLocal> {
  const exercicio = exercicioPorId.get(exercicioId);
  if (sessao.workoutId !== WORKOUT_LIVRE || sessao.status !== "em_andamento" || !exercicio) {
    throw new Error("Escolha um exercício do catálogo para o treino livre em andamento.");
  }
  const confirmar = () => confirmarContaDoTreino(sessao.userId, "Não foi possível confirmar a conta deste treino.");
  await confirmar();
  const motor = await lerMotorParaRepetir(cliente, sessao.userId, [exercicioId], confirmar);
  await confirmar();
  return guardarAjusteDoPlano(sessao, atual => {
    if (atual.workoutId !== WORKOUT_LIVRE) throw new Error("Este treino não é livre.");
    // Um segundo toque (ou aba) deve observar os mesmos IDs mesmo se o material já mudou.
    if (atual.blocos.some(b => b.originalId === exercicioId && b.exercicioId === exercicioId)) return atual;
    if (!equipamentosDaAlternativa(exercicio, equipamentoDaSessao(atual)).length) {
      throw new Error(MENSAGEM_EQUIPAMENTO_ALTERADO);
    }
    const nova = acrescentarBloco(atual, exercicioId, { ...motor, novoId });
    if (nova === atual) {
      throw new Error("O treino mudou. Escolha um exercício disponível na lista.");
    }
    return nova;
  }, undefined, conciliarBlocosAcrescentados);
}

export const MENSAGEM_INCLUSAO_ALTERADA = "O treino mudou. Confira a lista antes de desfazer a inclusão.";

export async function desfazerUltimaInclusaoNaSessao(sessao: SessaoLocal, identificador: string): Promise<SessaoLocal> {
  await confirmarContaDoTreino(sessao.userId, "Não foi possível confirmar a conta deste treino.");
  return guardarAjusteDoPlano(sessao, atual => {
    const inclusao = atual.plano?.ultima_inclusao;
    if (!inclusao || inclusao.sessao_id !== atual.id || inclusao.id !== identificador || atual.workoutId !== WORKOUT_LIVRE) throw new Error(MENSAGEM_INCLUSAO_ALTERADA);
    if (inclusao.estado === "desfeita") return atual;
    const desfeita = desfazerUltimaInclusao(atual, identificador);
    if (desfeita === atual) throw new Error(MENSAGEM_INCLUSAO_ALTERADA);
    return desfeita;
  }, undefined, conciliarBlocosAcrescentados);
}

/** A série deve existir no mesmo bloco quando entra na fila, inclusive se outra aba desfez e reincluiu o exercício. */
export async function enviarSerie(sessao: SessaoLocal, bloco: BlocoLocal, serie: SerieLocal): Promise<boolean> {
  await confirmarToquesPendentes(sessao);
  const banco = bd();
  const enfileirada = await banco.transaction("rw", banco.sessaoAtiva, banco.outbox, async () => {
    const salva = await carregarSessaoLocal(sessao.id);
    if (!salva || salva.status !== "em_andamento" || salva.userId !== sessao.userId) return false;
    const posicao = salva.blocos.find(b => b.ordem === bloco.ordem);
    if (!posicao) return false;
    const movimento = [posicao, ...(posicao.trocados ?? [])].find(b => b.exercicioId === bloco.exercicioId);
    const registrada = movimento?.series.find(s => s.id === serie.id);
    if (!movimento || !registrada) return false;
    // Mesmo uma desmarcação deixa uma linha no servidor. A exclusão não pode passar depois dela.
    const inclusao = salva.plano?.ultima_inclusao;
    if (salva.plano && inclusao?.estado === "disponivel" && inclusao.ordem === bloco.ordem) {
      const atual: SessaoLocal = { ...salva, plano: { ...salva.plano, ultima_inclusao: { ...inclusao, estado: "iniciada" } } };
      await banco.sessaoAtiva.put({ id: atual.id, dados: atual, atualizadoEm: Date.now() });
      const plano = escritaDoPlano(atual.id, atual.userId, planoParaGravar(atual));
      await guardarNaFila("sessao", plano, alvoDaEscrita(plano));
    }
    const escrita = escritaDaSerie(salva, movimento, registrada);
    await guardarNaFila("serie", escrita, alvoDaEscrita(escrita));
    return true;
  });
  if (enfileirada) void processar();
  return enfileirada;
}

/* -------------------------------------------------------------- fim */

export interface EntradaFim {
  sessao: SessaoLocal;
  status: Extract<StatusSessao, "concluida" | "abandonada">;
  cliente: QueryClient;
  agora?: string;
}

/**
 * "Concluir treino" / "Abandonar" (SPEC §3.2, §6.2 e §8): roda o motor, manda
 * tudo para a fila na ordem e tira a sessão do aparelho.
 */
export async function finalizarSessao(entrada: EntradaFim): Promise<Conclusao> {
  const { cliente, status, sessao } = entrada;
  const agora = entrada.agora ?? new Date().toISOString();
  await confirmarToquesPendentes(sessao);
  // Um acréscimo simultâneo ou fica no treino que avaliamos, ou encontra o treino já encerrado.
  const banco = bd();
  const { conclusao, historico } = await banco.transaction("rw", banco.sessaoAtiva, banco.outbox, banco.cache, async () => {
    const salva = await carregarSessaoLocal(sessao.id);
    if (!salva || salva.userId !== sessao.userId || salva.status !== "em_andamento") {
      throw new Error("Esta sessão não está aberta nesta conta e aparelho.");
    }
    const encerrada = {
      ...salva, status, sensacao: sessao.sensacao, pesoCorporal: sessao.pesoCorporal, notas: notasDaSessao(salva),
    };
    const resultado = concluirSessao({ sessao: encerrada, agora, novoId });
    const series = escritasDasSeriesFeitas(encerrada);
    for (const escrita of [...series, ...resultado.escritas]) {
      await guardarNaFila(TIPO_POR_TABELA[escrita.tabela] ?? "sessao", escrita, alvoDaEscrita(escrita));
    }
    await banco.sessaoAtiva.delete(sessao.id);
    const deTrabalho = series.filter(s => s.linha?.tipo === "trabalho").length;
    return { conclusao: resultado, historico: await guardarConclusaoNoHistorico(cliente, resultado, encerrada.notaGeral, deTrabalho) };
  });
  await cliente.cancelQueries({ queryKey: chaveDoHistorico(sessao.userId), exact: true });
  cliente.setQueryData(chaveDoHistorico(sessao.userId), historico);
  void processar();

  await cliente.cancelQueries({ queryKey: chaves.sessoesAbertas(), exact: true });
  cliente.setQueryData<SessaoResumo[]>(chaves.sessoesAbertas(), (atual) =>
    (atual ?? []).filter((s) => s.id !== sessao.id),
  );
  cliente.setQueryData<SessaoResumo[]>(chaves.sessoes(), (atual) => {
    const resumo: SessaoResumo = {
      id: sessao.id,
      user_id: sessao.userId,
      data: sessao.data,
      status,
      workout_id: sessao.workoutId,
      fase: sessao.fase,
      concluida_em: status === "concluida" ? agora : null,
    };
    const resto = (atual ?? []).filter((s) => s.id !== sessao.id);
    return [resumo, ...resto];
  });
  /*
   * A carga de hoje, o histórico e o `ultimo_treino` mudaram — mas quem sabe
   * disso é o Supabase, e a escrita ainda está na fila. Reler antes de a fila
   * esvaziar traria o estado velho, então a releitura espera a fila (sem
   * segurar a navegação; sem rede ela desiste e o cache local segue valendo).
   */
  // Uma recarga imediata precisa encontrar o fechamento no cache do aparelho.
  await guardarConsultasAgora(cliente).catch(() => {});
  void esperarFila().then(() => {
    void cliente.invalidateQueries({ queryKey: ["estados"] });
    void cliente.invalidateQueries({ queryKey: ["eventos"] });
    void cliente.invalidateQueries({ queryKey: chaves.perfil() });
    /*
     * SPEC §19: os Números e as conquistas leem as listas completas
     * (`["progresso", …]`), que o Relatório e a Conclusão compartilham. Sem
     * isto, a sessão que acabou de subir só apareceria no próximo carregamento.
     */
    void cliente.invalidateQueries({ queryKey: ["progresso"] });
  });

  return conclusao;
}

/* ------------------------------------------------- indicador da fila */

/** Quantos itens ainda esperam a rede (indicador discreto da §8). */
export function usePendentes(intervaloMs = 3_000): number {
  const [quantos, setQuantos] = useState(0);

  useEffect(() => {
    let vivo = true;
    const olhar = async () => {
      const n = await pendentes().catch(() => 0);
      if (vivo) setQuantos(n);
    };
    void olhar();
    const relogio = setInterval(() => void olhar(), intervaloMs);
    const aoVoltar = () => void olhar();
    window.addEventListener("online", aoVoltar);
    return () => {
      vivo = false;
      clearInterval(relogio);
      window.removeEventListener("online", aoVoltar);
    };
  }, [intervaloMs]);

  return quantos;
}
