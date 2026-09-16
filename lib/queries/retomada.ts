/**
 * A escrita da retomada (SPEC §18.2): pega as linhas que `lib/retomada.ts`
 * montou e as enfileira pelos caminhos que já existem — upsert em
 * `exercise_state`, insert em `progression_events` e update em `profiles`.
 *
 * Nada aqui decide regra nenhuma: a regra é a função pura. Tudo passa pela
 * fila de saída (§8), então a escolha vale na hora, com ou sem rede.
 */
"use client";

import type { QueryClient } from "@tanstack/react-query";
import { enfileirarEscrita } from "@/lib/outbox-supabase";
import { opcoesDeMontagem } from "@/lib/preferencias";
import { novoId } from "@/lib/queries/acoes";
import { gravarPerfil } from "@/lib/queries/perfil";
import {
  escritasDaRetomada,
  type EscolhaRetomada,
  type EscritaDeEstado,
} from "@/lib/retomada";
import type { LinhaEstadoExercicio, LinhaPerfil } from "@/lib/types";

/**
 * Aplica no cache o que foi escrito em `exercise_state`, para a tela responder
 * sem esperar a rede. Mexe em todas as consultas de estados que estiverem
 * carregadas (as do treino do dia e a lista inteira da retomada).
 */
function atualizarEstadosNoCache(
  cliente: QueryClient,
  escritas: readonly EscritaDeEstado[],
): void {
  if (escritas.length === 0) return;
  const porId = new Map(escritas.map((e) => [e.exercise_id, e]));
  cliente.setQueriesData<LinhaEstadoExercicio[]>(
    {
      predicate: (q) => {
        const chave = q.queryKey[0];
        return chave === "estados" || chave === "estados-todos";
      },
    },
    (atual) =>
      atual?.map((linha) => {
        const mudanca = porId.get(linha.exercise_id);
        return mudanca ? { ...linha, ...mudanca } : linha;
      }),
  );
}

export interface EntradaDaRetomada {
  userId: string;
  perfil: LinhaPerfil;
  /** Todas as linhas de `exercise_state` do usuário. */
  estados: readonly LinhaEstadoExercicio[];
  escolha: EscolhaRetomada;
  dias: number;
  hoje: string;
  cliente: QueryClient;
}

/**
 * Grava a escolha da retomada. A ordem importa: primeiro os exercícios e os
 * eventos, o perfil por último — é o `prefs.retomada` que faz o card sumir, e
 * ele só deve sumir depois de o resto estar na fila.
 */
export async function aplicarRetomada({
  userId,
  perfil,
  estados,
  escolha,
  dias,
  hoje,
  cliente,
}: EntradaDaRetomada): Promise<void> {
  const escritas = escritasDaRetomada({
    escolha,
    dias,
    hoje,
    perfil,
    estados,
    montagem: opcoesDeMontagem(perfil.prefs),
    novoId,
  });

  for (const linha of escritas.estados) {
    await enfileirarEscrita("estado_exercicio", {
      tabela: "exercise_state",
      op: "upsert",
      linha,
      onConflict: "user_id,exercise_id",
    });
  }

  for (const evento of escritas.eventos) {
    // upsert pelo id do cliente: reenviar o item não duplica nem trava a fila
    // num 409 de chave repetida (SPEC §8)
    await enfileirarEscrita("evento_progressao", {
      tabela: "progression_events",
      op: "upsert",
      onConflict: "id",
      linha: { ...evento },
    });
  }

  atualizarEstadosNoCache(cliente, escritas.estados);

  await gravarPerfil({ userId, mudanca: escritas.perfil, cliente });
}
