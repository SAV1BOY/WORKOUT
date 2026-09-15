/**
 * A sessão de cardio no aparelho (SPEC §3.3 e §8).
 *
 * Mesma regra da sessão de força: o estado do timer vai para o IndexedDB a
 * cada toque (e a cada troca de bloco), então recarregar a página, sair da aba
 * ou ficar sem rede não perde nada. O `cardio_sessions` recebe pela fila de
 * saída, com o id gerado aqui no cliente.
 */
"use client";

import type { QueryClient } from "@tanstack/react-query";
import {
  duracaoEmMinutos,
  feitoDaSessao,
  planejadoDaSessao,
  type EstadoTimer,
  type PlanoCardio,
} from "@/lib/cardio";
import { bd, temIndexedDB } from "@/lib/db";
import { enfileirarEscrita } from "@/lib/outbox-supabase";
import { chaves } from "@/lib/queries/dados";
import type { Esforco, LinhaSessaoCardio, TipoCardio } from "@/lib/types";

/** Id novo, gerado no cliente (SPEC §8). */
export function novoId(): string {
  return crypto.randomUUID();
}

/** A sessão de cardio como ela vive no IndexedDB. */
export interface CardioLocal {
  id: string;
  userId: string;
  data: string;
  tipo: TipoCardio;
  /** Semana do plano congelada quando a sessão começou. */
  semana: number | null;
  iniciadaEm: string;
  timer: EstadoTimer;
  /** Já foi gravada como concluída? (evita gravar duas vezes) */
  encerrada: boolean;
}

/* -------------------------------------------------------- IndexedDB */

const ESPERA_MS = 60;

let pendente: CardioLocal | null = null;
let relogio: ReturnType<typeof setTimeout> | null = null;

async function gravar(sessao: CardioLocal): Promise<void> {
  if (!temIndexedDB()) return;
  await bd().cardioAtivo.put({
    id: sessao.id,
    dados: sessao,
    atualizadoEm: Date.now(),
  });
}

/** Guarda no aparelho. Não lança: o registro não pode sumir por erro. */
export function salvarCardioLocal(sessao: CardioLocal): void {
  pendente = sessao;
  if (relogio) clearTimeout(relogio);
  relogio = setTimeout(() => {
    void descarregarCardio();
  }, ESPERA_MS);
}

/** Grava agora o que estiver pendente (saída da aba, encerrar, recarga). */
export async function descarregarCardio(): Promise<void> {
  if (relogio) {
    clearTimeout(relogio);
    relogio = null;
  }
  const sessao = pendente;
  pendente = null;
  if (!sessao) return;
  await gravar(sessao).catch(() => {});
}

/** A sessão de cardio aberta deste dia e tipo, se houver. */
export async function cardioLocalAberto(
  data: string,
  tipo: TipoCardio,
): Promise<CardioLocal | null> {
  if (!temIndexedDB()) return null;
  const todas = await bd().cardioAtivo.toArray().catch(() => []);
  const achada = todas
    .map((i) => i.dados as CardioLocal)
    .filter((c) => c && c.data === data && c.tipo === tipo && !c.encerrada)
    .sort((a, b) => (a.iniciadaEm < b.iniciadaEm ? 1 : -1))[0];
  return achada ?? null;
}

export async function apagarCardioLocal(id: string): Promise<void> {
  if (!temIndexedDB()) return;
  await bd().cardioAtivo.delete(id).catch(() => {});
}

/* ---------------------------------------------------------- escrita */

export interface FimDoCardio {
  sessao: CardioLocal;
  plano: PlanoCardio;
  agoraMs: number;
  distanciaKm: number | null;
  saltos: number | null;
  esforco: Esforco | null;
  notas: string | null;
  concluida: boolean;
  intervalo: { de: string; ate: string } | null;
  cliente: QueryClient;
}

/**
 * "Encerrar" (SPEC §3.3): uma linha em `cardio_sessions` com o planejado, o
 * feito, a duração e o teste da fala. Upsert por `id` — encerrar duas vezes
 * (a fila reenviando) não duplica a sessão.
 */
export async function encerrarCardio(fim: FimDoCardio): Promise<LinhaSessaoCardio> {
  const { sessao, plano, agoraMs, cliente } = fim;
  const decorridoS = Number(feitoDaSessao(plano, sessao.timer, agoraMs).decorrido_s ?? 0);

  const linha: LinhaSessaoCardio = {
    id: sessao.id,
    user_id: sessao.userId,
    data: sessao.data,
    tipo: sessao.tipo,
    semana_plano: sessao.semana,
    planejado: planejadoDaSessao(plano),
    feito: feitoDaSessao(plano, sessao.timer, agoraMs),
    duracao_min: duracaoEmMinutos(decorridoS),
    distancia_km: fim.distanciaKm,
    saltos: fim.saltos,
    esforco: fim.esforco,
    concluida: fim.concluida,
    notas: fim.notas,
  };

  if (fim.intervalo) {
    cliente.setQueryData<LinhaSessaoCardio[]>(
      chaves.cardio(fim.intervalo.de, fim.intervalo.ate),
      (atual) => [linha, ...(atual ?? []).filter((c) => c.id !== linha.id)],
    );
  }

  await enfileirarEscrita("cardio", {
    tabela: "cardio_sessions",
    op: "upsert",
    onConflict: "id",
    linha: { ...linha },
  });

  await apagarCardioLocal(sessao.id);
  return linha;
}
