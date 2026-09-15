/**
 * Escritas do marco 2: repetição solta de barra fixa, troca de dia no
 * calendário e descarte de um treino aberto.
 *
 * Regra da SPEC §8: nunca perder um registro. Tudo vai para o IndexedDB na
 * hora (fila de saída) e o cache do TanStack Query é atualizado junto, então a
 * tela responde igual com ou sem rede. Os ids são gerados no cliente.
 */
"use client";

import type { QueryClient } from "@tanstack/react-query";
import { bd, temIndexedDB } from "@/lib/db";
import { enfileirarEscrita } from "@/lib/outbox-supabase";
import { chaves, type SessaoResumo, type SoltaResumo } from "@/lib/queries/dados";
import type { NovoOverride } from "@/lib/semana";
import type { LinhaExcecaoAgenda } from "@/lib/types";

/** Id novo, gerado no cliente (SPEC §8: dá para criar offline). */
export function novoId(): string {
  return crypto.randomUUID();
}

/* ------------------------------------------- barra fixa: +1 repetição */

export async function registrarSolta(opcoes: {
  userId: string;
  data: string;
  reps?: number;
  /** O histórico da tela de barra fixa, para ele subir na hora também (§3.4). */
  intervalo?: { de: string; ate: string };
  cliente: QueryClient;
}): Promise<void> {
  const { userId, data, reps = 1, intervalo, cliente } = opcoes;
  const linha = {
    id: novoId(),
    user_id: userId,
    data,
    reps,
  };

  cliente.setQueryData<SoltaResumo[]>(chaves.soltas(data), (atual) => [
    ...(atual ?? []),
    { id: linha.id, data, reps },
  ]);
  if (intervalo) {
    cliente.setQueryData<SoltaResumo[]>(
      chaves.soltasNoPeriodo(intervalo.de, intervalo.ate),
      (atual) => [{ id: linha.id, data, reps }, ...(atual ?? [])],
    );
  }

  /*
   * Upsert pelo id gerado aqui, não insert (SPEC §8). A rede pode cair depois
   * de o servidor gravar e antes de a resposta voltar: o item continua na fila
   * e o reenvio do insert bateria num 409 de chave repetida — um item
   * envenenado para sempre, tentando de 5 em 5 minutos, numa fila que ninguém
   * vê fora da tela de treino. Repetir o upsert é inofensivo.
   */
  await enfileirarEscrita("barra_fixa_solta", {
    tabela: "pullup_singles",
    op: "upsert",
    onConflict: "id",
    linha,
  });
}

/* --------------------------------------------- calendário: overrides */

/**
 * Grava (ou troca) o tipo de um ou mais dias. `schedule_overrides` tem chave
 * única `(user_id, data)`, então é sempre upsert: trocar duas vezes o mesmo dia
 * não cria duas linhas.
 */
export async function gravarOverrides(opcoes: {
  userId: string;
  novos: NovoOverride[];
  intervalo: { de: string; ate: string };
  cliente: QueryClient;
}): Promise<void> {
  const { userId, novos, intervalo, cliente } = opcoes;
  if (novos.length === 0) return;

  const linhas: LinhaExcecaoAgenda[] = novos.map((n) => ({
    id: novoId(),
    user_id: userId,
    data: n.data,
    tipo: n.tipo,
    workout_id: n.workout_id,
    sessao: n.sessao,
    motivo: n.motivo,
  }));

  cliente.setQueryData<LinhaExcecaoAgenda[]>(
    chaves.overrides(intervalo.de, intervalo.ate),
    (atual) => {
      const datas = new Set(linhas.map((l) => l.data));
      return [...(atual ?? []).filter((o) => !datas.has(o.data)), ...linhas];
    },
  );

  for (const linha of linhas) {
    await enfileirarEscrita("agenda", {
      tabela: "schedule_overrides",
      op: "upsert",
      linha: { ...linha },
      onConflict: "user_id,data",
    });
  }
}

/** Desfaz a troca de um dia: o programa volta a mandar nele. */
export async function apagarOverride(opcoes: {
  data: string;
  intervalo: { de: string; ate: string };
  cliente: QueryClient;
}): Promise<void> {
  const { data, intervalo, cliente } = opcoes;

  cliente.setQueryData<LinhaExcecaoAgenda[]>(
    chaves.overrides(intervalo.de, intervalo.ate),
    (atual) => (atual ?? []).filter((o) => o.data !== data),
  );

  await enfileirarEscrita("agenda", {
    tabela: "schedule_overrides",
    op: "delete",
    filtro: { data },
  });
}

/* ------------------------------------------------ treino aberto (§3.1) */

/** "Descartar": a sessão fica registrada como abandonada, sem perder as séries. */
export async function descartarSessao(opcoes: {
  id: string;
  cliente: QueryClient;
}): Promise<void> {
  const { id, cliente } = opcoes;

  cliente.setQueryData<SessaoResumo[]>(chaves.sessoesAbertas(), (atual) =>
    (atual ?? []).filter((s) => s.id !== id),
  );
  cliente.setQueryData<SessaoResumo[]>(chaves.sessoes(), (atual) =>
    (atual ?? []).map((s) => (s.id === id ? { ...s, status: "abandonada" } : s)),
  );

  if (temIndexedDB()) {
    await bd().sessaoAtiva.delete(id).catch(() => {});
  }

  await enfileirarEscrita("sessao", {
    tabela: "sessions",
    op: "update",
    linha: { status: "abandonada" },
    filtro: { id },
  });
}
