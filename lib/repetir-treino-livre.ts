import { exercicioPorId } from "@/lib/dados";
import { ehSessaoLivre, itemDoExercicio } from "@/lib/livre";
import { ordensDeExecucao } from "@/lib/ordem-da-sessao";
import { MAX_SERIES_DA_SESSAO, type ItemDaSessao } from "@/lib/sessao";

export interface RepeticaoDoTreinoLivre {
  itens: ItemDaSessao[];
  titulo: string | null;
  colecao: string | null;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/** Reps, passos e segundos do app são armazenados como inteiros do Postgres. */
function inteiro(valor: unknown, minimo: number): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= minimo && valor <= 2_147_483_647;
}

function comPrescricaoDoPlano(padrao: ItemDaSessao, linha: Record<string, unknown>): ItemDaSessao {
  const p = padrao.prescricao;
  const { min, max } = linha;
  // Min e max só têm sentido se ainda medem a mesma coisa (reps, tempo ou passos).
  const mesmaMedida = linha.tipo === undefined || linha.tipo === p.tipo;
  const faixa = mesmaMedida && p.min !== null && p.max !== null &&
    inteiro(min, 1) && inteiro(max, min) ? { min, max } : { min: p.min, max: p.max };
  const descanso = inteiro(linha.descanso_s, 0) ? linha.descanso_s : null;
  return {
    exercicioId: padrao.exercicioId,
    prescricao: {
      ...p,
      series: inteiro(linha.series, 1) && linha.series <= MAX_SERIES_DA_SESSAO ? linha.series : p.series,
      ...faixa,
    },
    descansoS: descanso ?? padrao.descansoS,
    descansoTexto: descanso === null ? padrao.descansoTexto : (texto(linha.descanso_texto) ?? `${descanso} s`),
  };
}

function exercicioAtivo(linha: Record<string, unknown> | null, grupo: unknown): unknown {
  if (grupo === undefined) return linha?.exercicio_id;
  // O primeiro é o ativo. Os posteriores guardam o que foi feito antes da troca.
  return Array.isArray(grupo) && ehObjeto(grupo[0]) ? grupo[0].exercicio_id : null;
}

/** Extrai somente a composição que pode começar de novo, sem os registros da sessão de origem. */
export function montarRepeticaoDoTreinoLivre(origem: {
  workout_id: string; status: string; plano?: unknown; ordem_execucao?: unknown;
}): RepeticaoDoTreinoLivre | null {
  const { plano } = origem;
  if (!ehSessaoLivre(origem.workout_id) || origem.status !== "concluida" || !ehObjeto(plano)) return null;
  const linhas = plano.itens;
  // Cada posição precisa identificar um movimento final distinto do catálogo.
  if (!Array.isArray(linhas) || !linhas.length || linhas.length > exercicioPorId.size) return null;
  const trocas = plano.trocas ?? {};
  if (!ehObjeto(trocas) || Object.keys(trocas).some((chave) => {
    const ordem = Number(chave);
    return !Number.isInteger(ordem) || ordem < 1 || ordem > linhas.length || String(ordem) !== chave;
  })) return null;

  const itens: ItemDaSessao[] = [];
  const usados = new Set<string>();
  for (const ordem of ordensDeExecucao(plano, origem.ordem_execucao)) {
    const valor = linhas[ordem - 1];
    const linha = ehObjeto(valor) ? valor : null;
    const ativo = exercicioAtivo(linha, trocas[ordem]);
    if (typeof ativo !== "string" || usados.has(ativo)) return null;
    const exercicio = exercicioPorId.get(ativo);
    if (!exercicio) return null;
    usados.add(ativo);
    const padrao = itemDoExercicio(exercicio);
    itens.push(linha && ativo === linha.exercicio_id ? comPrescricaoDoPlano(padrao, linha) : padrao);
  }
  return { itens, titulo: texto(plano.titulo), colecao: texto(plano.colecao) };
}
