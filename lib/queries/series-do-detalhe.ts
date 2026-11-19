"use client";

import { liveQuery } from "dexie";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { chaveDoDetalheDaSessao } from "@/lib/chaves-do-historico";
import { bd, temIndexedDB } from "@/lib/db";
import type { SerieBruta } from "@/lib/progresso";
import { encerramentosPendentes } from "@/lib/queries/cache-do-detalhe";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { FalhaDeRedeNaTabela, lerTabelaCompleta } from "@/lib/queries/ler";
import {
  aplicarPendentes, arquivoDeSeriesPosterior, escritasPendentes, lerFonteDoRelatorio, type ListaDoRelatorio,
} from "@/lib/queries/lista-do-relatorio";

export const COLUNAS_SERIE =
  "exercise_id,session_id,set_index,tipo,reps,reps_lado2,carga_kg,tempo_s,tempo_s_lado2,passos,assistencia,concluida,registrada_em";

type Fechamento = { linhas: SerieBruta[]; atualizadoEm: number };

export async function lerFechamentoDoDetalhe(conta: string, sessaoId: string): Promise<Fechamento | null> {
  const item = await bd().cache.get(chaveDoDetalheDaSessao(conta, sessaoId));
  if (!item || !Number.isFinite(item.atualizadoEm) || !Array.isArray(item.valor)) return null;
  if (!item.valor.every(s => s?.user_id === conta && s.session_id === sessaoId && typeof s.id === "string")) return null;
  return { linhas: item.valor, atualizadoEm: item.atualizadoEm };
}

/** O encerramento é uma lista completa apenas daquele treino. Um GET iniciado antes ainda pode chegar depois. */
export function selecionarSeriesDoDetalhe(
  conta: string, sessaoId: string, seriesDaConta: readonly SerieBruta[],
  fonteCompleta: boolean, confirmadasEm: number | undefined, fechamento: Fechamento | null,
) {
  if (fechamento && (!fonteCompleta || confirmadasEm === undefined || fechamento.atualizadoEm >= confirmadasEm)) {
    return { linhas: fechamento.linhas, completa: true };
  }
  // O cache legado sem user_id passou pela verificação do dono da sessão na leitura do Relatório.
  const linhas = seriesDaConta.filter(s => s.session_id === sessaoId && (s.user_id === undefined || s.user_id === conta));
  return { linhas, completa: fonteCompleta };
}

/** Só a ficha aberta observa esse registro no aparelho. A leitura paginada pertence ao Relatório. */
export function useSeriesDoDetalhe(
  conta: string, sessaoId: string, seriesDaConta: readonly SerieBruta[], fonteCompleta: boolean, confirmadasEm?: number,
) {
  const [lido, setLido] = useState<{ conta: string; sessaoId: string; fechamento: Fechamento | null } | null>(null);
  useEffect(() => {
    if (!temIndexedDB()) return;
    const assinatura = liveQuery(() => lerFechamentoDoDetalhe(conta, sessaoId)).subscribe({
      next: fechamento => setLido({ conta, sessaoId, fechamento }),
      error: () => setLido({ conta, sessaoId, fechamento: null }),
    });
    return () => assinatura.unsubscribe();
  }, [conta, sessaoId]);
  const atual = lido?.conta === conta && lido.sessaoId === sessaoId ? lido : null;
  const resultado = useMemo(() => selecionarSeriesDoDetalhe(
    conta, sessaoId, seriesDaConta, fonteCompleta, confirmadasEm, atual?.fechamento ?? null,
  ), [conta, sessaoId, seriesDaConta, fonteCompleta, confirmadasEm, atual]);
  return { ...resultado, carregando: temIndexedDB() && !atual };
}

const chaveDaFicha = (conta: string, sessaoId: string) => ["progresso", "series-da-sessao", conta, sessaoId] as const;
const conferirConta = (conta: string) => confirmarContaDoTreino(conta, "A conta do treino mudou. Reabra a ficha.");

async function situacaoDoDetalhe(conta: string, sessaoId: string) {
  const [foto, encerramentos, escritas] = await Promise.all([
    lerFechamentoDoDetalhe(conta, sessaoId), encerramentosPendentes(conta), escritasPendentes("series", conta),
  ]);
  return { foto, pendente: encerramentos.has(sessaoId), escritas };
}

function daSessao(conta: string, sessaoId: string, lista: ListaDoRelatorio<SerieBruta>, foto: Fechamento | null) {
  const escolhida = selecionarSeriesDoDetalhe(conta, sessaoId, lista.linhas, lista.completa, lista.confirmadasEm, foto);
  return { ...escolhida, confirmadasEm: foto && escolhida.linhas === foto.linhas ? foto.atualizadoEm : lista.confirmadasEm };
}

async function doAparelho(
  cliente: QueryClient, conta: string, sessaoId: string, sinal: AbortSignal,
  situacao: Awaited<ReturnType<typeof situacaoDoDetalhe>> | undefined,
): Promise<ListaDoRelatorio<SerieBruta>> {
  const foto = situacao?.foto ?? null;
  let base: ListaDoRelatorio<SerieBruta> = { linhas: [], completa: false };
  if (!foto) {
    // A leitura local do Relatório também valida o dono dos registros legados sem user_id.
    base = await lerFonteDoRelatorio<SerieBruta>(cliente, conta, "series", ["progresso", "series-todas"], null, sinal);
  } else if (!situacao?.pendente) {
    base = await arquivoDeSeriesPosterior<SerieBruta>(conta, foto.atualizadoEm) ?? base;
  }
  const chaves = [["progresso", "series-todas", conta], chaveDaFicha(conta, sessaoId)];
  for (const chave of chaves) {
    const memoria = cliente.getQueryData<ListaDoRelatorio<SerieBruta>>(chave);
    if (memoria?.completa && memoria.confirmadasEm !== undefined && memoria.confirmadasEm > (base.confirmadasEm ?? 0) &&
      memoria.linhas.every(s => s.user_id === conta && typeof s.id === "string" &&
        (chave.length === 3 || s.session_id === sessaoId))) base = memoria;
  }
  return daSessao(conta, sessaoId, situacao?.pendente && foto ? { ...base, confirmadasEm: undefined } : base, foto);
}

/** A ficha do movimento não conhece as séries dos outros exercícios. Só a fonte da sessão pode confirmar o total. */
export async function lerSeriesDaSessaoNaFicha(cliente: QueryClient, conta: string, sessaoId: string, sinal: AbortSignal) {
  sinal.throwIfAborted();
  await conferirConta(conta);
  const inicio = Date.now();
  const banco = temIndexedDB() ? bd() : undefined;
  const lerSituacao = () => banco?.transaction("r", banco.cache, banco.outbox, () => situacaoDoDetalhe(conta, sessaoId))
    .catch(() => undefined);
  const antes = await lerSituacao();
  const inicial = await doAparelho(cliente, conta, sessaoId, sinal, antes).catch(() =>
    daSessao(conta, sessaoId, { linhas: [], completa: false }, antes?.foto ?? null));
  await conferirConta(conta);
  sinal.throwIfAborted();
  if (navigator.onLine === false) return inicial;
  if (inicial.completa || inicial.linhas.length) cliente.setQueryData(chaveDaFicha(conta, sessaoId), inicial);
  let remotas: SerieBruta[];
  try {
    remotas = await lerTabelaCompleta<SerieBruta>(
      "session_sets", `id,user_id,ordem_ex,${COLUNAS_SERIE}`, "as séries deste treino", conta, sinal, sessaoId,
    );
    if (!remotas.every(s => s.user_id === conta && s.session_id === sessaoId && typeof s.id === "string")) {
      throw new Error("As séries recebidas não correspondem à conta e ao treino selecionados.");
    }
  } catch (erro) {
    sinal.throwIfAborted();
    if (!(erro instanceof FalhaDeRedeNaTabela)) throw erro;
    const ultima = await doAparelho(cliente, conta, sessaoId, sinal, await lerSituacao()).catch(() => inicial);
    await conferirConta(conta);
    sinal.throwIfAborted();
    return ultima;
  }

  await conferirConta(conta);
  sinal.throwIfAborted();
  let resultado: ListaDoRelatorio<SerieBruta> = { linhas: remotas, completa: true, confirmadasEm: inicio };
  if (!banco || !antes) return resultado;
  try {
    await banco.transaction("rw", banco.cache, banco.outbox, async () => {
      const agora = await situacaoDoDetalhe(conta, sessaoId);
      const arquivo = await arquivoDeSeriesPosterior<SerieBruta>(conta, inicio);
      const pendente = antes.pendente || agora.pendente;
      const foto = agora.foto ?? (antes.pendente && !arquivo ? antes.foto : null);
      const base = arquivo ?? resultado;
      const escolha = daSessao(conta, sessaoId, pendente && foto ? { ...base, confirmadasEm: undefined } : base, foto);
      const escritas = arquivo && escolha.linhas !== foto?.linhas ? agora.escritas : [...antes.escritas, ...agora.escritas];
      const linhas = aplicarPendentes(escolha.linhas, escritas)
        .filter(s => s.user_id === conta && s.session_id === sessaoId && s.concluida);
      resultado = { ...escolha, linhas };
      sinal.throwIfAborted();
      if (!arquivo && escolha.linhas !== foto?.linhas) {
        await banco.cache.put({ chave: chaveDoDetalheDaSessao(conta, sessaoId), valor: linhas, atualizadoEm: inicio });
      }
    });
  } catch {
    // A falta de espaço no aparelho não invalida a resposta recebida.
    sinal.throwIfAborted();
  }
  await conferirConta(conta);
  sinal.throwIfAborted();
  return resultado;
}

export function useSeriesDaSessaoNaFicha(conta: string, sessaoId: string) {
  const consulta = useQuery({
    queryKey: chaveDaFicha(conta, sessaoId),
    enabled: Boolean(conta && sessaoId), networkMode: "always", refetchOnMount: "always", refetchOnReconnect: false,
    queryFn: ({ client, signal }) => lerSeriesDaSessaoNaFicha(client, conta, sessaoId, signal),
  });
  const { refetch } = consulta;
  useEffect(() => {
    if (!conta || !sessaoId) return;
    const aoVoltar = () => { void refetch({ cancelRefetch: false }); };
    window.addEventListener("online", aoVoltar);
    return () => window.removeEventListener("online", aoVoltar);
  }, [conta, sessaoId, refetch]);
  return consulta;
}
