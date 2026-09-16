const PADRAO_AO_ENTRAR = "Não deu para entrar agora. Tente de novo.";

/**
 * Mensagens do Supabase Auth em pt-BR.
 *
 * `padrao` é o que sobra quando a mensagem é desconhecida: na tela de login é
 * "não deu para entrar", mas quem chama de `/mais/senha` (SPEC §9) passa o
 * recado daquela tela — "entrar" ali não quer dizer nada.
 */
export function traduzirErroAuth(
  mensagem: string,
  padrao: string = PADRAO_AO_ENTRAR,
): string {
  const m = mensagem.toLowerCase();
  // O trigger `on_auth_user_email_permitido` de supabase/schema.sql barra
  // qualquer e-mail fora do ALLOWED_EMAIL. O GoTrue devolve a mensagem crua do
  // Postgres ou a embrulha em "Database error saving new user" — e como este é
  // o único trigger de `auth.users` que levanta exceção, os dois casos são o
  // mesmo recado (o harness de ponta a ponta responde a primeira forma).
  if (m.includes("app é pessoal") || m.includes("database error saving new user"))
    return "Este app é pessoal.";
  if (m.includes("invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed"))
    return "Confirme o e-mail antes de entrar.";
  if (
    m.includes("user already registered") ||
    m.includes("already been registered")
  )
    return "Essa conta já existe — é só entrar.";
  // o GoTrue conta os caracteres que ELE exige (6); o app pede 8 antes de
  // chamar, então este recado só aparece se o mínimo do servidor for maior
  if (m.includes("password should be at least"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("new password should be different"))
    return "A senha nova precisa ser diferente da atual.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Espere um minuto.";
  if (m.includes("fetch") || m.includes("network"))
    return "Sem conexão com o servidor. Tente de novo.";
  return padrao;
}
