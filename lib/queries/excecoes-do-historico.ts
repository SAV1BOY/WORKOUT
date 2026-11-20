import type { QueryClient } from "@tanstack/react-query";
import { bd, temIndexedDB } from "@/lib/db";
import { lerConsultaGuardadaComData, VALIDADE_MS } from "@/lib/persistencia-query";
import { confirmarContaDoTreino } from "@/lib/queries/conta-do-treino";
import { FalhaDeRedeNaTabela } from "@/lib/queries/ler";
import { clienteNavegador } from "@/lib/supabase/client";
import type { LinhaExcecaoAgenda } from "@/lib/types";

interface Faixa {
  de: string;
  ate: string;
  linhas: LinhaExcecaoAgenda[];
  atualizadoEm: number;
}

/** Uma cópia por conta. Ao gravar uma semana nova, remove intervalos já vencidos. */
function faixasValidas(valor: unknown, conta: string): Faixa[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((faixa: Faixa) => faixa && Date.now() - faixa.atualizadoEm <= VALIDADE_MS &&
    Array.isArray(faixa.linhas) && faixa.linhas.every(linha => linha?.user_id === conta));
}

async function faixaNoAparelho(cliente: QueryClient, conta: string, de: string, ate: string, chave: string) {
  const faixas: Faixa[] = [];
  if (temIndexedDB()) {
    const guardada = await bd().cache.get(chave).catch(() => undefined);
    faixas.push(...faixasValidas(guardada?.valor, conta));
    // A primeira abertura após atualizar o app pode vir antes da hidratação da janela antiga.
    const antiga = await lerConsultaGuardadaComData<LinhaExcecaoAgenda[]>(["overrides", de, ate], conta).catch(() => undefined);
    if (antiga?.valor.some(l => l.user_id === conta)) {
      faixas.push({ de, ate, linhas: antiga.valor.filter(l => l.user_id === conta), atualizadoEm: antiga.atualizadoEm });
    }
  }
  for (const q of cliente.getQueryCache().findAll({ queryKey: ["overrides"] })) {
    const [, primeira, ultima, dona] = q.queryKey;
    const linhas = q.state.data as LinhaExcecaoAgenda[] | undefined;
    if (typeof primeira !== "string" || typeof ultima !== "string" || !Array.isArray(linhas)) continue;
    if (dona === conta || (dona === undefined && linhas.some(l => l.user_id === conta))) {
      faixas.push({ de: primeira, ate: ultima, linhas: linhas.filter(l => l.user_id === conta), atualizadoEm: q.state.dataUpdatedAt });
    }
  }
  const ultima = faixas.filter(f => f.de <= de && f.ate >= ate && Date.now() - f.atualizadoEm <= VALIDADE_MS)
    .sort((a, b) => b.atualizadoEm - a.atualizadoEm)[0];
  return ultima?.linhas.filter(l => l.data >= de && l.data <= ate);
}

export async function lerExcecoesDoHistorico(cliente: QueryClient, conta: string, de: string, ate: string, sinal: AbortSignal) {
  const chave = `agenda-do-historico:${conta}`;
  const atualizadoEm = Date.now();
  let erroDeRede = "As trocas do calendário desta semana ainda não estão guardadas neste aparelho.";
  if (navigator.onLine !== false) {
    const { data, error, status } = await clienteNavegador().from("schedule_overrides").select("*")
      .eq("user_id", conta).gte("data", de).lte("data", ate).abortSignal(sinal);
    sinal.throwIfAborted();
    if (!error) {
      const linhas = ((data ?? []) as LinhaExcecaoAgenda[]).filter(l => l.user_id === conta && l.data >= de && l.data <= ate);
      if (!temIndexedDB()) return linhas;
      const banco = bd();
      try {
        return await banco.transaction("rw", banco.cache, async () => {
          const item = await banco.cache.get(chave);
          sinal.throwIfAborted();
          const faixas = faixasValidas(item?.valor, conta);
          const posterior = faixas.find(f => f.de === de && f.ate === ate && f.atualizadoEm > atualizadoEm);
          if (posterior) return posterior.linhas;
          const outras = faixas.filter(f => f.de !== de || f.ate !== ate);
          await banco.cache.put({ chave, atualizadoEm, valor: [...outras, { de, ate, linhas, atualizadoEm }] });
          return linhas;
        });
      } catch {
        sinal.throwIfAborted();
        return linhas;
      }
    }
    erroDeRede = `Não consegui carregar as trocas do calendário. ${error.message}`;
    if (status !== 0) throw new Error(erroDeRede);
  }
  const linhas = await faixaNoAparelho(cliente, conta, de, ate, chave);
  sinal.throwIfAborted();
  if (!linhas) throw new FalhaDeRedeNaTabela(erroDeRede);
  await confirmarContaDoTreino(conta, "A conta do calendário mudou. Reabra o Relatório.");
  sinal.throwIfAborted();
  return linhas;
}
