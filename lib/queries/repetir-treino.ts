"use client";

import type { QueryClient } from "@tanstack/react-query";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { opcoesDeMontagem } from "@/lib/preferencias";
import type { SessaoBruta } from "@/lib/progresso";
import { chaves, type SessaoResumo } from "@/lib/queries/dados";
import { lerMotorParaRepetir } from "@/lib/queries/motor-repetir-treino";
import { chavesProgresso } from "@/lib/queries/progresso";
import { criarSessaoLivre, novoId, sessaoLocalMaisRecente } from "@/lib/queries/sessao";
import { montarRepeticaoDoTreinoLivre } from "@/lib/repetir-treino-livre";
import { clienteNavegador } from "@/lib/supabase/client";
import type { LinhaPerfil } from "@/lib/types";

async function sessaoAbertaParaRepeticao(cliente: QueryClient, conta: string) {
  const historico = [
    ...(cliente.getQueryData<SessaoResumo[]>(chaves.sessoes()) ?? []),
    ...(cliente.getQueryData<SessaoBruta[]>(chavesProgresso.sessoesTodas()) ?? []),
  ].filter(s => s.user_id === conta);
  // A conclusão offline já altera o resumo antes de o servidor receber a fila.
  const encerradas = new Set(historico.filter(s => s.status !== "em_andamento").map(s => s.id));
  const local = await sessaoLocalMaisRecente(conta, encerradas);
  if (local) return { id: local.id, encerradas };

  const noCache = () => [
    ...(cliente.getQueryData<SessaoResumo[]>(chaves.sessoesAbertas()) ?? []),
    ...historico,
  ].find(s => s.user_id === conta && s.status === "em_andamento" && !encerradas.has(s.id))?.id;
  if (navigator.onLine === false) return { id: noCache(), encerradas };

  const controlador = new AbortController();
  const prazo = setTimeout(() => controlador.abort(), 1500);
  try {
    const { data, error, status } = await clienteNavegador().from("sessions")
      .select("id,user_id").eq("user_id", conta).eq("status", "em_andamento")
      .order("data", { ascending: false }).limit(5).retry(false).abortSignal(controlador.signal);
    if (controlador.signal.aborted || (error && status === 0)) return { id: noCache(), encerradas };
    if (error) throw new Error("Não foi possível verificar seu treino em andamento. Tente novamente.");
    const abertas: Pick<SessaoResumo, "id" | "user_id">[] = data ?? [];
    return { id: abertas.find(s => s.user_id === conta && !encerradas.has(s.id))?.id, encerradas };
  } finally {
    clearTimeout(prazo);
  }
}

/** Um clique no histórico retoma o treino aberto ou cria uma sessão pelo mesmo caminho das coleções. */
export async function abrirRepeticaoDoTreino(
  cliente: QueryClient, perfil: LinhaPerfil, hoje: string, origem: SessaoBruta,
): Promise<{ id: string; retomada: boolean }> {
  if (origem.user_id !== perfil.user_id) throw new Error("Este treino pertence a outra conta.");
  const modelo = montarRepeticaoDoTreinoLivre(origem);
  if (!modelo) throw new Error("Este treino não tem um plano que possa ser repetido.");

  const conta = perfil.user_id;
  const confirmar = () => confirmarContaDoTreino(conta, "Não foi possível confirmar sua conta. Abra o relatório com conexão.");
  await confirmar();
  const aberta = await sessaoAbertaParaRepeticao(cliente, conta);
  const motor = aberta.id ? null : await lerMotorParaRepetir(
    cliente, conta, modelo.itens.map(i => i.exercicioId), confirmar,
  );
  // Uma troca de login em outra aba pode ocorrer enquanto as leituras estão em curso.
  await confirmar();
  if (aberta.id) return { id: aberta.id, retomada: true };

  const id = novoId();
  const sessao = await criarSessaoLivre({
    ...modelo, ...motor, cliente, id, userId: conta, data: hoje, fase: perfil.fase_atual,
    opcoesMontagem: opcoesDeMontagem(perfil.prefs),
    retomarSeAberta: { encerradas: aberta.encerradas },
  });
  return { id: sessao.id, retomada: sessao.id !== id };
}
