import { equipamentoDisponivel } from "@/lib/dados";
import type { EquipamentoTag, TreinoId } from "@/lib/schemas";
import type { PlanoDaSessao } from "@/lib/types";
import type { SessaoLocal } from "@/lib/sessao";

/** A ordem e os itens válidos vêm do inventário, inclusive ao ler um backup. */
export function lerSelecaoDeEquipamento(valor: unknown): ReadonlySet<EquipamentoTag> {
  const inventario = equipamentoDisponivel();
  if (!Array.isArray(valor)) return inventario;
  return new Set([...inventario].filter((tag) => valor.includes(tag)));
}

export function equipamentoDaSessao(sessao: Pick<SessaoLocal, "plano">): ReadonlySet<EquipamentoTag> {
  return lerSelecaoDeEquipamento(sessao.plano?.equipamento_disponivel);
}

export function tagsDoEquipamento(disponiveis: ReadonlySet<EquipamentoTag>): EquipamentoTag[] {
  return [...equipamentoDisponivel()].filter((tag) => disponiveis.has(tag));
}

/** A seleção completa usa o padrão da sessão. Uma lista vazia significa só o corpo. */
export function materialEscolhido(disponiveis: ReadonlySet<EquipamentoTag>): EquipamentoTag[] | null {
  const tags = tagsDoEquipamento(disponiveis);
  return tags.length === equipamentoDisponivel().size ? null : tags;
}

export function planoComMaterial(plano: PlanoDaSessao, material: EquipamentoTag[] | null): PlanoDaSessao {
  const atualizado = { ...plano };
  if (material === null) delete atualizado.equipamento_disponivel;
  else atualizado.equipamento_disponivel = material;
  return atualizado;
}

export function chaveDoEquipamentoDoDia(conta: string, data: string, treinoId: TreinoId): string {
  return `treino-equipamento:${encodeURIComponent(conta)}:${data}:${treinoId}`;
}

export function lerEquipamentoDoDia(conta: string, data: string, treinoId: TreinoId): ReadonlySet<EquipamentoTag> {
  try {
    const bruto = window.localStorage.getItem(chaveDoEquipamentoDoDia(conta, data, treinoId));
    return lerSelecaoDeEquipamento(bruto === null ? null : JSON.parse(bruto));
  } catch {
    return equipamentoDisponivel();
  }
}

export function guardarEquipamentoDoDia(
  conta: string, data: string, treinoId: TreinoId, disponiveis: ReadonlySet<EquipamentoTag>,
): void {
  const tags = tagsDoEquipamento(disponiveis);
  const id = chaveDoEquipamentoDoDia(conta, data, treinoId);
  if (tags.length === equipamentoDisponivel().size) window.localStorage.removeItem(id);
  else window.localStorage.setItem(id, JSON.stringify(tags));
}

/** Só consome a seleção usada no início, preservando uma edição posterior de outra aba. */
export function consumirEquipamentoDoDia(
  conta: string, data: string, treinoId: TreinoId, usado: ReadonlySet<EquipamentoTag>,
): void {
  const id = chaveDoEquipamentoDoDia(conta, data, treinoId);
  try {
    const salvo = window.localStorage.getItem(id);
    if (salvo !== null && salvo !== JSON.stringify(tagsDoEquipamento(usado))) return;
    if (salvo !== null) window.localStorage.removeItem(id);
  } catch {
    // A criação já foi confirmada; até um rascunho que só existia em memória deve ser consumido.
  }
  // O navegador só notifica as outras abas. A rota de origem também pode continuar montada.
  if (typeof window !== "undefined" && typeof StorageEvent !== "undefined") {
    window.dispatchEvent?.(new StorageEvent("storage", { key: id }));
  }
}
