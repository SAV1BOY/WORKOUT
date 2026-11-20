import { equipamentoDisponivel } from "@/lib/dados";
import { descansoPersonalizadoDaSessao } from "@/lib/descanso-da-sessao";
import { lerSelecaoDeEquipamento } from "@/lib/equipamento-da-sessao";
import type { ModeloDeTreino } from "@/lib/modelo-de-treino";
import { quantidadeDeSeriesValida } from "@/lib/progressao";
import { montarRepeticaoDoTreinoLivre } from "@/lib/repetir-treino-livre";
import type { PlanoDaSessao } from "@/lib/types";

export type ComposicaoDoModelo = Required<Pick<ModeloDeTreino,
  "exercicios" | "equipamento_disponivel" | "series_por_exercicio" | "descansos_por_exercicio"
>>;

/** A troca guarda todos os índices do ativo, mesmo quando só parte das séries foi realizada. */
function quantidadeNaTroca(indices: unknown): number | undefined {
  if (!Array.isArray(indices) || !quantidadeDeSeriesValida(indices.length)) return undefined;
  return indices.every(i => Number.isSafeInteger(i) && i > 0) && new Set(indices).size === indices.length
    ? indices.length : undefined;
}

export function composicaoDoModeloDaSessao(sessao: Parameters<typeof montarRepeticaoDoTreinoLivre>[0]): ComposicaoDoModelo | null {
  const repeticao = montarRepeticaoDoTreinoLivre(sessao);
  if (!repeticao) return null;
  // A repetição já validou cada posição e identificou todos os movimentos finais do catálogo.
  const plano = sessao.plano as PlanoDaSessao;
  const material = plano.equipamento_disponivel;
  const inventario = equipamentoDisponivel();
  if (material != null && (!Array.isArray(material) || !material.every(tag => inventario.has(tag)))) return null;
  const escolhido = lerSelecaoDeEquipamento(material);
  const series: Record<string, number> = {};
  const descansos: Record<string, number> = {};
  for (const [i, item] of plano.itens.entries()) {
    const ativo = plano.trocas?.[i + 1]?.[0];
    const id = ativo?.exercicio_id ?? item.exercicio_id;
    const doItem = item?.exercicio_id === id ? item.series : undefined;
    const daSessao = ativo ? quantidadeNaTroca(ativo.trabalho) : plano.series_de_trabalho_ao_concluir?.[id];
    const quantidade = quantidadeDeSeriesValida(daSessao) ? daSessao : doItem;
    if (quantidadeDeSeriesValida(quantidade)) series[id] = quantidade;
    const pausa = descansoPersonalizadoDaSessao({ plano }, id);
    if (pausa !== null) descansos[id] = pausa;
  }
  return {
    exercicios: repeticao.itens.map(item => item.exercicioId),
    equipamento_disponivel: escolhido.size === inventario.size ? null : [...escolhido],
    series_por_exercicio: Object.keys(series).length ? series : null,
    descansos_por_exercicio: Object.keys(descansos).length ? descansos : null,
  };
}
