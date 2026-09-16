/**
 * A tela Mais (SPEC §3.9 e §9): perfil, preferências, pesos das barras,
 * incremento por exercício, backup e importação.
 *
 * Só orquestração: as contas e as regras estão em `lib/backup.ts`,
 * `lib/preferencias.ts`, `lib/equipamento.ts` e `lib/calendario.ts`. Toda
 * escrita passa pela fila de saída (§8) e o cache do TanStack Query é
 * atualizado junto, então a tela responde com ou sem rede.
 */
"use client";

import { useQuery, type QueryClient, type UseQueryResult } from "@tanstack/react-query";
import {
  CHAVE_DA_TABELA,
  TABELAS_BACKUP,
  emLotes,
  linhasParaImportar,
  montarBackup,
  type Backup,
  type Linha,
  type TabelaBackup,
} from "@/lib/backup";
import { adiarFase2 } from "@/lib/calendario";
import { esperarFila } from "@/lib/outbox";
import { enfileirarEscrita } from "@/lib/outbox-supabase";
import { novoId } from "@/lib/queries/acoes";
import { chaves } from "@/lib/queries/dados";
import { gravarPerfil, type MudancaDePerfil } from "@/lib/queries/perfil";
import { clienteNavegador } from "@/lib/supabase/client";
import type { LinhaEstadoExercicio, LinhaPerfil, Prefs } from "@/lib/types";

/* ------------------------------------------------------------- perfil */

export async function salvarPerfil(opcoes: {
  userId: string;
  mudanca: MudancaDePerfil;
  cliente: QueryClient;
}): Promise<void> {
  await gravarPerfil(opcoes);
}

export async function salvarPrefs(opcoes: {
  userId: string;
  prefs: Prefs;
  cliente: QueryClient;
}): Promise<void> {
  await gravarPerfil({
    userId: opcoes.userId,
    mudanca: { prefs: opcoes.prefs },
    cliente: opcoes.cliente,
  });
}

/**
 * Aceitar a Fase 2 (SPEC §5.1): muda a fase, marca desde quando e registra o
 * evento `trocou_fase`. As cargas por exercício continuam as mesmas.
 */
export async function aceitarFase2(opcoes: {
  userId: string;
  perfil: LinhaPerfil;
  hoje: string;
  cliente: QueryClient;
}): Promise<void> {
  const { userId, perfil, hoje, cliente } = opcoes;
  if (perfil.fase_atual === "fase2") return;

  await gravarPerfil({
    userId,
    mudanca: { fase_atual: "fase2", fase_desde: hoje },
    cliente,
  });

  await enfileirarEscrita("evento_progressao", {
    // upsert pelo id do cliente: reenviar o item não duplica nem trava a fila
    // num 409 de chave repetida (SPEC §8)
    tabela: "progression_events",
    op: "upsert",
    onConflict: "id",
    linha: {
      id: novoId(),
      user_id: userId,
      // o evento é do programa inteiro, não de um exercício (§5.1)
      exercise_id: null,
      data: hoje,
      de: { fase: perfil.fase_atual },
      para: { fase: "fase2" },
      motivo: "trocou_fase",
    },
  });
}

/** Adiar a sugestão da Fase 2 por 2 semanas (SPEC §5.1). */
export async function adiarSugestaoDaFase2(opcoes: {
  userId: string;
  perfil: LinhaPerfil;
  hoje: string;
  cliente: QueryClient;
}): Promise<void> {
  const { userId, perfil, hoje, cliente } = opcoes;
  await gravarPerfil({
    userId,
    mudanca: {
      prefs: { ...perfil.prefs, fase2_adiada_ate: adiarFase2(hoje) },
    },
    cliente,
  });
}

/* ------------------------------------- incremento por exercício (§3.9) */

/**
 * Override do incremento em `exercise_state.incremento_kg`. `null` volta ao
 * incremento do JSON. O upsert cria a linha se o exercício ainda não tem uma.
 */
export async function salvarIncremento(opcoes: {
  userId: string;
  exercicioId: string;
  incrementoKg: number | null;
  cliente: QueryClient;
  /** Os ids que a tela está lendo, para o cache responder na hora. */
  idsEmTela: readonly string[];
}): Promise<void> {
  const { userId, exercicioId, incrementoKg, cliente, idsEmTela } = opcoes;

  cliente.setQueryData<LinhaEstadoExercicio[]>(
    chaves.estados(idsEmTela),
    (atual) => {
      const linhas = atual ?? [];
      const achou = linhas.some((l) => l.exercise_id === exercicioId);
      if (achou) {
        return linhas.map((l) =>
          l.exercise_id === exercicioId
            ? { ...l, incremento_kg: incrementoKg }
            : l,
        );
      }
      // Exercício ainda sem linha em `exercise_state`: o upsert abaixo vai
      // criá-la com os defaults do schema. Sem acrescentá-la aqui, o cache
      // (que é persistido no Dexie, SPEC §8) guardava o estado de antes e a
      // tela voltava dizendo "usando 4 kg" depois de recarregar, até o
      // `staleTime` de 30 s vencer. A linha sintética é exatamente a que o
      // banco cria.
      return [
        ...linhas,
        {
          user_id: userId,
          exercise_id: exercicioId,
          carga_atual_kg: null,
          reps_alvo: null,
          tempo_alvo_s: null,
          assistencia: null,
          incremento_kg: incrementoKg,
          falhas_seguidas: 0,
          incremento_reduzido: false,
          exigir_rep_extra: false,
          semana_leve: false,
          carga_antes_leve: null,
          sessoes_graca: 0,
          desativado: false,
          notas: null,
        },
      ];
    },
  );

  await enfileirarEscrita("estado_exercicio", {
    tabela: "exercise_state",
    op: "upsert",
    linha: {
      user_id: userId,
      exercise_id: exercicioId,
      incremento_kg: incrementoKg,
    },
    onConflict: "user_id,exercise_id",
  });
}

/* ------------------------------------------------------------ backup */

/** Quantas linhas por tabela o backup lê de uma vez. */
export const LIMITE_EXPORTACAO = 5000;

/**
 * Lê as 11 tabelas do usuário. A RLS já filtra por dono (§9), então não há
 * `user_id` no filtro: o que voltar é do usuário logado.
 */
export async function lerTudo(): Promise<Partial<Record<TabelaBackup, Linha[]>>> {
  const supabase = clienteNavegador();
  const tabelas: Partial<Record<TabelaBackup, Linha[]>> = {};

  for (const tabela of TABELAS_BACKUP) {
    const { data, error } = await supabase
      .from(tabela)
      .select("*")
      .limit(LIMITE_EXPORTACAO);
    if (error) {
      throw new Error(`Não consegui ler ${tabela}. ${error.message}`);
    }
    tabelas[tabela] = (data ?? []) as Linha[];
  }

  return tabelas;
}

export async function exportarBackup(opcoes: {
  userId: string;
  agora: string;
}): Promise<Backup> {
  const tabelas = await lerTudo();
  return montarBackup({
    userId: opcoes.userId,
    exportadoEm: opcoes.agora,
    tabelas,
  });
}

/** Só as chaves do que já existe, para a prévia da importação (§3.9). */
export async function lerChavesExistentes(): Promise<
  Partial<Record<TabelaBackup, Linha[]>>
> {
  const supabase = clienteNavegador();
  const existentes: Partial<Record<TabelaBackup, Linha[]>> = {};

  for (const tabela of TABELAS_BACKUP) {
    const colunas = CHAVE_DA_TABELA[tabela].join(",");
    const { data, error } = await supabase
      .from(tabela)
      .select(colunas)
      .limit(LIMITE_EXPORTACAO);
    if (error) {
      throw new Error(`Não consegui ler ${tabela}. ${error.message}`);
    }
    existentes[tabela] = (data ?? []) as unknown as Linha[];
  }

  return existentes;
}

/** O tipo da fila que cada tabela usa (só para o item ficar legível). */
const TIPO_DA_TABELA: Record<TabelaBackup, Parameters<typeof enfileirarEscrita>[0]> = {
  profiles: "perfil",
  exercise_state: "estado_exercicio",
  sessions: "sessao",
  session_sets: "serie",
  progression_events: "evento_progressao",
  cardio_sessions: "cardio",
  pullup_singles: "barra_fixa_solta",
  body_weights: "peso",
  body_measurements: "medidas",
  progress_photos: "foto",
  schedule_overrides: "agenda",
};

/**
 * Importa o backup (SPEC §9). Cada tabela vira um upsert em lote pela chave
 * primária — importar o mesmo arquivo duas vezes deixa o banco igual. Vai tudo
 * pela fila de saída: sem rede, a importação espera e sobe depois.
 */
export async function importarBackup(opcoes: {
  backup: Backup;
  userId: string;
  cliente: QueryClient;
}): Promise<number> {
  const { backup, userId, cliente } = opcoes;
  let linhas = 0;

  for (const escrita of linhasParaImportar(backup, userId)) {
    for (const lote of emLotes(escrita.linhas)) {
      await enfileirarEscrita(TIPO_DA_TABELA[escrita.tabela], {
        tabela: escrita.tabela,
        op: "upsert",
        linhas: lote,
        onConflict: escrita.onConflict,
      });
      linhas += lote.length;
    }
  }

  /*
   * O que estava em tela veio do banco de ANTES da importação: relê tudo — mas
   * só depois de a fila de saída subir os lotes, senão o refetch volta com os
   * dados velhos e a tela só se corrige na próxima leitura. Sem rede,
   * `esperarFila` desiste na hora e a fila termina o serviço quando a rede
   * voltar (SPEC §8).
   */
  await esperarFila();
  await cliente.invalidateQueries();
  return linhas;
}

/* ------------------------------------------------------------ leituras */

/** Quantas sessões de força já foram concluídas (regra da Fase 2, §5.1). */
export function useTotalDeSessoesConcluidas(): UseQueryResult<number> {
  return useQuery({
    queryKey: ["sessoes-concluidas-total"],
    queryFn: async () => {
      const { count, error } = await clienteNavegador()
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "concluida");
      if (error) {
        throw new Error(`Não consegui contar os seus treinos. ${error.message}`);
      }
      return count ?? 0;
    },
  });
}
