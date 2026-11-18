"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { bd, temIndexedDB } from "@/lib/db";
import { enfileirarEscrita, type EscritaTabela } from "@/lib/outbox-supabase";
import { clienteNavegador } from "@/lib/supabase/client";
import type { LinhaEstadoExercicio } from "@/lib/types";

export const chaveDaNota = (conta: string, exercicioId: string) =>
  ["nota-do-exercicio", conta, exercicioId] as const;

/** `undefined` significa que não há edição pendente; `null` é a remoção da nota. */
async function notaPendente(conta: string, exercicioId: string): Promise<string | null | undefined> {
  if (!temIndexedDB()) return undefined;
  const itens = await bd().outbox.where("tipo").equals("estado_exercicio").reverse().toArray();
  for (const item of itens) {
    const { linha } = item.payload as EscritaTabela;
    if (linha?.user_id === conta && linha.exercise_id === exercicioId &&
        (typeof linha.nota_pessoal === "string" || linha.nota_pessoal === null)) {
      return linha.nota_pessoal;
    }
  }
  return undefined;
}

function notaNosEstados(cliente: QueryClient, conta: string, exercicioId: string) {
  for (const [, linhas] of cliente.getQueriesData<LinhaEstadoExercicio[]>({ queryKey: ["estados"] })) {
    const linha = linhas?.find((e) => e.user_id === conta && e.exercise_id === exercicioId);
    if (linha) return linha.nota_pessoal;
  }
  return undefined;
}

export async function lerNotaDoExercicio(cliente: QueryClient, conta: string, exercicioId: string, signal: AbortSignal) {
  const pendente = await notaPendente(conta, exercicioId);
  if (pendente !== undefined) return pendente;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const salva = cliente.getQueryData<string | null>(chaveDaNota(conta, exercicioId));
    if (salva !== undefined) return salva;
    const nosEstados = notaNosEstados(cliente, conta, exercicioId);
    if (nosEstados !== undefined) return nosEstados;
    throw new Error("A nota deste exercício ainda não está guardada neste aparelho.");
  }
  const { data, error } = await clienteNavegador().from("exercise_state")
    .select("nota_pessoal")
    .eq("user_id", conta)
    .eq("exercise_id", exercicioId)
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.nota_pessoal ?? null) as string | null;
}

export function useNotaDoExercicio(conta: string, exercicioId: string) {
  const cliente = useQueryClient();
  return useQuery<string | null>({
    queryKey: chaveDaNota(conta, exercicioId),
    enabled: Boolean(conta && exercicioId),
    networkMode: "always",
    // O player normalmente já leu os estados do treino, inclusive sem rede.
    placeholderData: () => notaNosEstados(cliente, conta, exercicioId),
    queryFn: ({ signal }) => lerNotaDoExercicio(cliente, conta, exercicioId, signal),
  });
}

export async function gravarNotaDoExercicio(cliente: QueryClient, conta: string, exercicioId: string, texto: string) {
  const nota = texto.trim() || null;
  await enfileirarEscrita("estado_exercicio", {
    tabela: "exercise_state",
    op: "upsert",
    onConflict: "user_id,exercise_id",
    linha: { user_id: conta, exercise_id: exercicioId, nota_pessoal: nota },
  });
  const chave = chaveDaNota(conta, exercicioId);
  await cliente.cancelQueries({ queryKey: chave, exact: true });
  cliente.setQueryData(chave, nota);
  for (const prefixo of ["estados", "estados-todos"]) {
    cliente.setQueriesData<LinhaEstadoExercicio[]>({ queryKey: [prefixo] }, (linhas) =>
      linhas?.map((linha) => linha.user_id === conta && linha.exercise_id === exercicioId
        ? { ...linha, nota_pessoal: nota } : linha),
    );
  }
}
