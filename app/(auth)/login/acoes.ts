"use server";

import { redirect } from "next/navigation";
import { avisoDeConfiguracao, supabaseConfigurado } from "@/lib/env";
import { CADASTRO_FECHADO, traduzirErroAuth } from "@/lib/erros-auth";
import { haVaga, vagasParaConta } from "@/lib/queries/contas";
import { MINIMO_DA_SENHA } from "@/lib/senha";
import { criarClienteServidor } from "@/lib/supabase/server";

export interface EstadoLogin {
  erro?: string;
  aviso?: string;
  ok?: string;
}

/*
 * Num arquivo "use server" só saem funções assíncronas: o piso da senha mora
 * em `lib/senha.ts` (o mesmo da troca de senha, SPEC §9) e a frase fica aqui.
 */
const SENHA_CURTA = `A senha precisa ter pelo menos ${MINIMO_DA_SENHA} caracteres.`;

function ler(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  return { email, senha };
}

/**
 * O que vale para "Entrar" e para "Criar conta": as chaves no lugar e os dois
 * campos preenchidos. Nenhuma checagem de e-mail — desde o marco Contas
 * (SPEC §21) qualquer conta que existe entra, e quem decide se uma conta pode
 * nascer é a cota, no banco.
 */
function conferirBasico({
  email,
  senha,
}: {
  email: string;
  senha: string;
}): EstadoLogin | null {
  const aviso = avisoDeConfiguracao();
  if (aviso) return { aviso };
  if (email === "" || senha === "") {
    return { erro: "Preencha o e-mail e a senha." };
  }
  return null;
}

export async function entrar(
  _anterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const dados = ler(formData);
  const problema = conferirBasico(dados);
  if (problema) return problema;

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: dados.email,
    password: dados.senha,
  });
  if (error) return { erro: traduzirErroAuth(error.message) };

  redirect("/");
}

export async function criarConta(
  _anterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const dados = ler(formData);
  const problema = conferirBasico(dados);
  if (problema) return problema;
  if (dados.senha.length < MINIMO_DA_SENHA) return { erro: SENHA_CURTA };

  const supabase = await criarClienteServidor();

  /*
   * A cota é perguntada de novo aqui: entre desenhar a tela e tocar no botão
   * alguém pode ter ocupado a última vaga. Se a pergunta não puder ser feita,
   * o `signUp` acontece assim mesmo — quem barra de verdade é o trigger
   * `on_auth_user_vaga`, e a mensagem dele chega traduzida do mesmo jeito.
   */
  const vagas = await vagasParaConta(supabase);
  if (!haVaga(vagas)) return { erro: CADASTRO_FECHADO };

  const { data, error } = await supabase.auth.signUp({
    email: dados.email,
    password: dados.senha,
  });
  if (error) return { erro: traduzirErroAuth(error.message) };

  if (data.session) redirect("/");
  // fallback: só acontece com a confirmação de e-mail ligada no projeto
  return {
    ok: "Conta criada. Confirme o e-mail e depois entre com a sua senha.",
  };
}

export async function sair() {
  if (!supabaseConfigurado()) redirect("/login");
  const supabase = await criarClienteServidor();
  /*
   * `scope: "local"` (SPEC §9, §21.4 e §22.11): sair é **deste** aparelho. O
   * escopo padrão do GoTrue é `global` e revoga todas as sessões da conta — o
   * dono, com o celular e o navegador abertos, apertava "Sair" num e o outro
   * caía em 403 na primeira leitura. Quem quiser derrubar todo mundo troca a
   * senha. Os dados locais deste aparelho continuam sendo apagados (§8).
   */
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
