import { bd, lerCache } from "@/lib/db";
import { aplicarOrdemRemotaDaSessao, type SessaoLocal } from "@/lib/sessao";

/** Uma aba anterior pode substituir o snapshot completo, inclusive o espelho dentro do plano. */
function chaveDaOrdem(conta: string, id: string) {
  return `ordem-execucao-sessao:${encodeURIComponent(conta)}:${id}`;
}

interface OrdemLocal {
  ordem: string[];
  revisao?: string;
}

function ehOrdemLocal(valor: unknown): valor is OrdemLocal {
  if (!valor || typeof valor !== "object" || !("ordem" in valor)) return false;
  return Array.isArray(valor.ordem) && valor.ordem.every(chave => typeof chave === "string" && chave.trim() !== "") &&
    (!("revisao" in valor) || valor.revisao === undefined || typeof valor.revisao === "string");
}

/** Um cliente antigo pode encerrar offline sem copiar a ordem para o resumo do Histórico. */
export async function ordensLocaisDaConta(conta: string): Promise<Map<string, string[]>> {
  const ordens = new Map<string, string[]>();
  if (!conta) return ordens;
  const prefixo = chaveDaOrdem(conta, "");
  const itens = await bd().cache.where("chave").startsWith(prefixo).toArray();
  for (const { chave, valor } of itens) {
    const id = chave.slice(prefixo.length);
    if (id && ehOrdemLocal(valor)) ordens.set(id, valor.ordem);
  }
  return ordens;
}

export async function guardarOrdemLocal(sessao: SessaoLocal): Promise<void> {
  if (sessao.workoutId !== "livre" || !Array.isArray(sessao.ordemExecucao)) return;
  const valor: OrdemLocal = { ordem: sessao.ordemExecucao, revisao: sessao.revisaoOrdemExecucao };
  await bd().cache.put({ chave: chaveDaOrdem(sessao.userId, sessao.id), valor, atualizadoEm: Date.now() });
}

export async function lerComOrdemLocal(sessao: SessaoLocal): Promise<SessaoLocal> {
  if (sessao.workoutId !== "livre") return sessao;
  const valor = await lerCache<unknown>(chaveDaOrdem(sessao.userId, sessao.id));
  if (!ehOrdemLocal(valor)) return sessao;
  const atual = aplicarOrdemRemotaDaSessao(sessao, valor.ordem);
  return atual.revisaoOrdemExecucao === valor.revisao ? atual : { ...atual, revisaoOrdemExecucao: valor.revisao };
}

export async function apagarOrdemLocal(conta: string, id: string): Promise<void> {
  await bd().cache.delete(chaveDaOrdem(conta, id));
}
