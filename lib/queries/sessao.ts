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
import { bd, temIndexedDB } from "@/lib/db";
import { acharTreino } from "@/lib/dados";
import {
  WORKOUT_LIVRE,
  itensDeIds,
  itensNaOrdem,
  planoDaSessao,
} from "@/lib/livre";
import { enfileirarEscrita } from "@/lib/outbox-supabase";
import { esperarFila, pendentes } from "@/lib/outbox";
import { chaves, type SessaoResumo } from "@/lib/queries/dados";
import {
  comSubstituicoes,
  concluirSessao,
  escritaDaSerie,
  escritaDeDescarte,
  escritaDaSessao,
  itensDoTreino,
  montarSessao,
  montarSessaoAvulsa,
  notasDaSessao,
  type BlocoLocal,
  type Conclusao,
  type EntradaAvulsa,
  type EntradaMontagem,
  type Escrita,
  type SerieLocal,
  type SessaoLocal,
} from "@/lib/sessao";
import type { TipoSaida } from "@/lib/db";
import type { StatusSessao } from "@/lib/types";

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
let relogio: ReturnType<typeof setTimeout> | null = null;

async function gravar(sessao: SessaoLocal): Promise<void> {
  if (!temIndexedDB()) return;
  await bd().sessaoAtiva.put({
    id: sessao.id,
    dados: sessao,
    atualizadoEm: Date.now(),
  });
}

/** Guarda a sessão no aparelho. Não lança: o registro não pode sumir por erro. */
export function salvarSessaoLocal(sessao: SessaoLocal): void {
  pendente = sessao;
  if (relogio) clearTimeout(relogio);
  relogio = setTimeout(() => {
    void descarregarSessao();
  }, ESPERA_MS);
}

/** Grava agora o que estiver pendente (saída da aba, conclusão, recarga). */
export async function descarregarSessao(): Promise<void> {
  if (relogio) {
    clearTimeout(relogio);
    relogio = null;
  }
  const sessao = pendente;
  pendente = null;
  if (!sessao) return;
  await gravar(sessao).catch(() => {});
}

export async function carregarSessaoLocal(id: string): Promise<SessaoLocal | null> {
  if (!temIndexedDB()) return null;
  const item = await bd().sessaoAtiva.get(id);
  return item ? (item.dados as SessaoLocal) : null;
}

/** A sessão aberta mais recente guardada neste aparelho. */
export async function sessaoLocalMaisRecente(): Promise<SessaoLocal | null> {
  if (!temIndexedDB()) return null;
  const itens = await bd().sessaoAtiva.orderBy("atualizadoEm").reverse().limit(1).toArray();
  const item = itens[0];
  return item ? (item.dados as SessaoLocal) : null;
}

export async function apagarSessaoLocal(id: string): Promise<void> {
  if (!temIndexedDB()) return;
  await bd().sessaoAtiva.delete(id).catch(() => {});
}

/* ------------------------------------------------------ fila de saída */

async function enfileirar(tipo: TipoSaida, escrita: Escrita): Promise<void> {
  await enfileirarEscrita(tipo, {
    tabela: escrita.tabela,
    op: escrita.op,
    linha: escrita.linha,
    onConflict: escrita.onConflict,
    filtro: escrita.filtro,
  });
}

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

export interface EntradaCriacaoLivre
  extends Omit<EntradaAvulsa, "id" | "workoutId" | "itens"> {
  cliente: QueryClient;
  id?: string;
  /** Os exercícios escolhidos, na ordem em que vão ser feitos. */
  exercicios: readonly string[];
  /** O rótulo da coleção que gerou a sessão ("Core no tatame"). */
  titulo?: string | null;
  /** O id da coleção derivada ("grupo:Core"), quando veio de uma. */
  colecao?: string | null;
}

/**
 * "Começar" numa coleção ou no "Personalizar treino" (SPEC §13.4 e §14.3): a
 * sessão nasce com `workout_id = 'livre'` e a lista vai para `sessions.plano`,
 * que é o que a refaz noutro aparelho. Daí para a frente ela é uma sessão de
 * força como qualquer outra — registro por série, motor e fila iguais (§6).
 */
export async function criarSessaoLivre(
  entrada: EntradaCriacaoLivre,
): Promise<SessaoLocal> {
  const { cliente, exercicios, titulo, colecao, ...resto } = entrada;
  const id = entrada.id ?? novoId();
  const itens = itensDeIds(exercicios);
  if (itens.length === 0) throw new Error("sessão livre sem exercício");
  const sessao = montarSessaoAvulsa({
    ...resto,
    id,
    novoId,
    workoutId: WORKOUT_LIVRE,
    itens,
    plano: planoDaSessao(itens, { titulo, colecao }),
  });
  return registrarSessaoNova(sessao, cliente);
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
): Promise<SessaoLocal> {
  await gravar(sessao);
  await enfileirar("sessao", escritaDaSessao(sessao));

  cliente.setQueryData<SessaoResumo[]>(chaves.sessoesAbertas(), (atual) => [
    {
      id: sessao.id,
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

/**
 * Troca de exercício no bloco (SPEC §3.2): as séries que o original já tinha
 * gravado saem de `session_sets` — o registro do dia é do substituto. Sem
 * rede, o delete espera na fila como qualquer outra escrita (§8).
 */
export async function descartarSeriesDoBloco(
  sessao: SessaoLocal,
  bloco: BlocoLocal,
): Promise<void> {
  const escrita = escritaDeDescarte(sessao, bloco);
  if (!escrita) return;
  await enfileirar("serie", escrita);
}

/** Uma série concluída sobe sozinha (upsert por id: remarcar não duplica). */
export async function enviarSerie(
  sessao: SessaoLocal,
  bloco: BlocoLocal,
  serie: SerieLocal,
): Promise<void> {
  await enfileirar("serie", escritaDaSerie(sessao, bloco, serie));
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
  const { cliente, status } = entrada;
  const sessao: SessaoLocal = {
    ...entrada.sessao,
    status,
    notas: notasDaSessao(entrada.sessao),
  };
  const agora = entrada.agora ?? new Date().toISOString();
  const conclusao = concluirSessao({ sessao, agora, novoId });

  // as séries concluídas vão de novo (a rede pode ter faltado no caminho)
  for (const bloco of sessao.blocos) {
    for (const serie of bloco.series) {
      if (serie.concluida) await enviarSerie(sessao, bloco, serie);
    }
  }

  for (const escrita of conclusao.escritas) {
    await enfileirar(TIPO_POR_TABELA[escrita.tabela] ?? "sessao", escrita);
  }

  cliente.setQueryData<SessaoResumo[]>(chaves.sessoesAbertas(), (atual) =>
    (atual ?? []).filter((s) => s.id !== sessao.id),
  );
  cliente.setQueryData<SessaoResumo[]>(chaves.sessoes(), (atual) => {
    const resumo: SessaoResumo = {
      id: sessao.id,
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
  await apagarSessaoLocal(sessao.id);
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
