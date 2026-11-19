export const CAMPOS_DE_CONTAGEM = [
  "reps", "reps_lado2", "tempo_s", "tempo_s_lado2", "passos", "reps_alvo_min", "reps_alvo_max",
] as const;

export type CampoContagem = (typeof CAMPOS_DE_CONTAGEM)[number];

export const prefixoDasIntencoes = (conta: string) => `contagens-a-conciliar:${conta}:`;
export const chaveIntencao = (conta: string, id: string) => prefixoDasIntencoes(conta) + id;

export const MAX_CONTAGEM = 2_147_483_647; // Limite das colunas integer no Postgres.
export function contagemInteiraValida(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= MAX_CONTAGEM;
}
export function fracionaria(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && !Number.isInteger(valor);
}
