import { equipamentoDisponivel, exercicioPorId } from "@/lib/dados";

export type ModeloDeTreino = {
  id: string;
  user_id: string;
  nome: string;
  exercicios: string[];
  equipamento_disponivel: string[] | null;
};

export function idDeModeloValido(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
}

function listaDeIdsValida(valor: unknown): valor is string[] {
  return Array.isArray(valor) && new Set(valor).size === valor.length &&
    valor.every(id => typeof id === "string" && id.length > 0 && id === id.trim());
}

/** O backup também transporta sequências salvas por um catálogo mais novo. */
export function modeloDeTreinoValido(valor: unknown): valor is ModeloDeTreino {
  if (!valor || typeof valor !== "object") return false;
  const { id, user_id, nome, exercicios, equipamento_disponivel } = valor as Partial<ModeloDeTreino>;
  return idDeModeloValido(id) && typeof user_id === "string" && user_id.trim().length > 0 &&
    typeof nome === "string" && nome === nome.trim() && nome.length > 0 && [...nome].length <= 80 &&
    listaDeIdsValida(exercicios) && exercicios.length > 0 &&
    (equipamento_disponivel === null || listaDeIdsValida(equipamento_disponivel));
}

const materiais: ReadonlySet<string> = equipamentoDisponivel();

/** Só se monta ou inicia o que esta versão consegue reproduzir por inteiro. */
export function modeloCompativelComCatalogo(modelo: ModeloDeTreino): boolean {
  return modelo.exercicios.every(id => exercicioPorId.has(id)) &&
    (modelo.equipamento_disponivel === null || modelo.equipamento_disponivel.every(tag => materiais.has(tag)));
}
