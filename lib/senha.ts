/**
 * A senha nova da tela `/mais/senha` (SPEC §9).
 *
 * A conta é criada direto no banco com uma senha temporária — o painel do
 * Supabase não está ao alcance de quem usa o app —, então a troca acontece
 * aqui dentro, no primeiro acesso. O GoTrue se contenta com 6 caracteres; o
 * app pede 8, porque uma senha que veio por fora merece um piso mais alto.
 *
 * Função pura, sem React nem Supabase: devolve o recado em pt-BR que a tela
 * mostra, ou `null` quando as duas senhas servem.
 */

/** Tamanho mínimo da senha nova. */
export const MINIMO_DA_SENHA = 8;

export function conferirSenhaNova(
  nova: string,
  repetida: string,
): string | null {
  if (nova.length < MINIMO_DA_SENHA) {
    return `A senha precisa de pelo menos ${MINIMO_DA_SENHA} caracteres.`;
  }
  if (nova !== repetida) return "As duas senhas precisam ser iguais.";
  return null;
}
