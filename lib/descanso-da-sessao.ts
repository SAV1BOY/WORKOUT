import type { SessaoLocal } from "@/lib/sessao";

/** Limites do editor de descanso, em segundos. */
export const DESCANSO_MIN_S = 5;
export const DESCANSO_MAX_S = 900;

export function duracaoDeDescansoValida(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= DESCANSO_MIN_S && valor <= DESCANSO_MAX_S;
}

export function limitarTempoDeDescanso(segundos: number): number {
  return Math.min(DESCANSO_MAX_S, Math.max(DESCANSO_MIN_S, Math.round(segundos)));
}

export function descansoPersonalizadoDaSessao(
  sessao: Pick<SessaoLocal, "plano">,
  exercicioId: string,
): number | null {
  const mapa = sessao.plano?.descansos_por_exercicio;
  if (!mapa || typeof mapa !== "object" || Array.isArray(mapa)) return null;
  const segundos = mapa[exercicioId];
  return duracaoDeDescansoValida(segundos) ? segundos : null;
}
