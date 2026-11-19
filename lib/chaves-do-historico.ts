export const chaveDoHistorico = (conta: string) => ["progresso", "sessoes", conta] as const;
export const chaveDoHistoricoNoDisco = (conta: string) => `historico-de-forca:${conta}`;
