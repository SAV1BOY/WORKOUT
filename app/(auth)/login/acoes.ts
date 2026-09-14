"use server";

import { redirect } from "next/navigation";
import {
  AVISO_CONFIG,
  emailPermitido,
  emailPermitidoConfigurado,
  supabaseConfigurado,
} from "@/lib/env";
import { traduzirErroAuth } from "@/lib/erros-auth";
import { criarClienteServidor } from "@/lib/supabase/server";

export interface EstadoLogin {
  erro?: string;
  aviso?: string;
  ok?: string;
}

const APP_PESSOAL = "Este app é pessoal.";

function ler(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  return { email, senha };
}

function conferirBasico({
  email,
  senha,
}: {
  email: string;
  senha: string;
}): EstadoLogin | null {
  if (!supabaseConfigurado() || !emailPermitidoConfigurado()) {
    return { aviso: AVISO_CONFIG };
  }
  if (email === "" || senha === "") {
    return { erro: "Preencha o e-mail e a senha." };
  }
  // recusado antes de qualquer chamada ao Supabase
  if (!emailPermitido(email)) return { erro: APP_PESSOAL };
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

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: dados.email,
    password: dados.senha,
  });
  if (error) return { erro: traduzirErroAuth(error.message) };

  if (data.session) redirect("/");
  return {
    ok: "Conta criada. Confirme o e-mail e depois entre com a sua senha.",
  };
}

export async function sair() {
  if (!supabaseConfigurado()) redirect("/login");
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
