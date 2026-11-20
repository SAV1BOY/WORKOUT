import type { PlanoDaSessao } from "@/lib/types";

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

/** Clientes anteriores ao carimbo identificavam somente a última inclusão no plano. */
function tokenDaUltimaInclusao(plano: { itens?: unknown; ultima_inclusao?: unknown }, item: unknown, ordem: number): string | null {
  const inclusao = plano.ultima_inclusao;
  if (!Array.isArray(plano.itens) || ordem !== plano.itens.length || !objeto(item) || !objeto(inclusao) ||
      inclusao.ordem !== ordem || inclusao.exercicio_id !== item.exercicio_id ||
      (inclusao.estado !== "disponivel" && inclusao.estado !== "iniciada")) return null;
  return typeof inclusao.id === "string" && inclusao.id ? inclusao.id : null;
}

/** Índice 0 = posição física 1. A chave de uma inclusão acompanha o item mesmo após a próxima inclusão. */
export function chavesDosItensDoPlano(plano: unknown): (string | null)[] {
  if (!objeto(plano) || !Array.isArray(plano.itens)) return [];
  return Array.from(plano.itens, (item: unknown, i) => {
    if (!objeto(item) || typeof item.exercicio_id !== "string" || !item.exercicio_id) return null;
    const inclusao = tokenDaUltimaInclusao(plano, item, i + 1) ?? item.inclusao_id;
    return typeof inclusao === "string" && inclusao ? `inclusao:${inclusao}` : item.exercicio_id;
  });
}

/** Conserva a identidade do último item legado quando outro exercício passar a ser o último. */
export function carimbarUltimaInclusao(plano: PlanoDaSessao): PlanoDaSessao {
  const ultimo = Array.isArray(plano.itens) ? plano.itens.at(-1) : undefined;
  if (!ultimo) return plano;
  const token = tokenDaUltimaInclusao(plano, ultimo, plano.itens.length);
  if (!token || ultimo.inclusao_id === token) return plano;
  return { ...plano, itens: [...plano.itens.slice(0, -1), { ...ultimo, inclusao_id: token }] };
}

/** Posições físicas (1..n) na sequência de apresentação. Aceita também um plano de backup sem validação prévia. */
export function ordensDeExecucao(plano: unknown, ordemExecucao?: unknown): number[] {
  const chaves = chavesDosItensDoPlano(plano);
  const espelho = objeto(plano) ? plano.ordem_execucao : undefined;
  const sequencia = Array.isArray(ordemExecucao) ? ordemExecucao : espelho;
  const fisicas = chaves.map((_, i) => i + 1);
  if (!Array.isArray(sequencia) || !sequencia.length) return fisicas;

  const porChave = new Map<string, number>();
  chaves.forEach((chave, i) => {
    if (chave) porChave.set(chave, porChave.has(chave) ? 0 : i + 1);
  });
  const resultado = new Set<number>();
  for (const chave of sequencia) {
    const posicao = porChave.get(chave);
    if (posicao) resultado.add(posicao);
  }
  for (const posicao of fisicas) resultado.add(posicao);
  return [...resultado];
}
