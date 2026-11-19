export const CAMPOS_DE_CONTAGEM = [
  "reps", "reps_lado2", "tempo_s", "tempo_s_lado2", "passos", "reps_alvo_min", "reps_alvo_max",
] as const;

export type CampoContagem = (typeof CAMPOS_DE_CONTAGEM)[number];
