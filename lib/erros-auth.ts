/** Mensagens do Supabase Auth em pt-BR. */
export function traduzirErroAuth(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme o e-mail antes de entrar.";
  if (
    m.includes("user already registered") ||
    m.includes("already been registered")
  )
    return "Essa conta já existe — é só entrar.";
  if (m.includes("password should be at least"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Espere um minuto.";
  if (m.includes("fetch") || m.includes("network"))
    return "Sem conexão com o servidor. Tente de novo.";
  return "Não deu para entrar agora. Tente de novo.";
}
