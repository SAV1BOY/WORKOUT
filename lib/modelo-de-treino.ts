import { equipamentoDisponivel, exercicioPorId } from "@/lib/dados";
import { duracaoDeDescansoValida } from "@/lib/descanso-da-sessao";
import { quantidadeDeSeriesValida } from "@/lib/progressao";

export type ModeloDeTreino = {
  id: string;
  user_id: string;
  nome: string;
  exercicios: string[];
  equipamento_disponivel: string[] | null;
  /** Cada campo omitido em uma escrita preserva a escolha do destino. */
  series_por_exercicio?: Record<string, number> | null;
  descansos_por_exercicio?: Record<string, number> | null;
};

export const camposDeAjusteDoModelo = ["series_por_exercicio", "descansos_por_exercicio"] as const;

/** Um GET antigo pode ter guardado só parte dos ajustes no cache compartilhado. */
export function ajustesDoModeloConfirmados(modelo: ModeloDeTreino): boolean {
  return camposDeAjusteDoModelo.every(campo => modelo[campo] !== undefined);
}

export function idDeModeloValido(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
}

function listaDeIdsValida(valor: unknown): valor is string[] {
  return Array.isArray(valor) && new Set(valor).size === valor.length &&
    valor.every(id => typeof id === "string" && id.length > 0 && id === id.trim());
}

function mapaDeAjustesValido(valor: unknown, exercicios: string[], validar: (valor: unknown) => boolean): boolean {
  if (valor === undefined || valor === null) return true;
  if (typeof valor !== "object" || Object.prototype.toString.call(valor) !== "[object Object]") return false;
  return Object.entries(valor).every(([id, ajuste]) => exercicios.includes(id) && validar(ajuste));
}

/** O backup também transporta sequências salvas por um catálogo mais novo. */
export function modeloDeTreinoValido(valor: unknown): valor is ModeloDeTreino {
  if (!valor || typeof valor !== "object") return false;
  const { id, user_id, nome, exercicios, equipamento_disponivel, series_por_exercicio, descansos_por_exercicio } = valor as Partial<ModeloDeTreino>;
  return idDeModeloValido(id) && typeof user_id === "string" && user_id.trim().length > 0 &&
    typeof nome === "string" && nome === nome.trim() && nome.length > 0 && [...nome].length <= 80 &&
    listaDeIdsValida(exercicios) && exercicios.length > 0 &&
    mapaDeAjustesValido(series_por_exercicio, exercicios, quantidadeDeSeriesValida) &&
    mapaDeAjustesValido(descansos_por_exercicio, exercicios, duracaoDeDescansoValida) &&
    (equipamento_disponivel === null || listaDeIdsValida(equipamento_disponivel));
}

const materiais: ReadonlySet<string> = equipamentoDisponivel();

/** Só se monta ou inicia o que esta versão consegue reproduzir por inteiro. */
export function modeloCompativelComCatalogo(modelo: ModeloDeTreino): boolean {
  return modelo.exercicios.every(id => exercicioPorId.has(id)) &&
    (modelo.equipamento_disponivel === null || modelo.equipamento_disponivel.every(tag => materiais.has(tag)));
}
