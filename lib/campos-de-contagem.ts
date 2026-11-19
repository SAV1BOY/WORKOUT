export const CAMPOS_DE_CONTAGEM = [
  "reps", "reps_lado2", "tempo_s", "tempo_s_lado2", "passos", "reps_alvo_min", "reps_alvo_max",
] as const;

export type CampoContagem = (typeof CAMPOS_DE_CONTAGEM)[number];

export const prefixoDasIntencoes = (conta: string) => `contagens-a-conciliar:${conta}:`;
export const chaveIntencao = (conta: string, id: string) => prefixoDasIntencoes(conta) + id;
