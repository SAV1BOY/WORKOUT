export const chaveDoHistorico = (conta: string) => ["progresso", "sessoes", conta] as const;
export const chaveDoHistoricoNoDisco = (conta: string) => `historico-de-forca:${conta}`;
export const prefixoDosDetalhesDaConta = (conta: string) => `detalhe-das-series:${encodeURIComponent(conta)}:`;
export const chaveDoDetalheDaSessao = (conta: string, sessaoId: string) => prefixoDosDetalhesDaConta(conta) + sessaoId;
