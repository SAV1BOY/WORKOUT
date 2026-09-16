import { redirect } from "next/navigation";
import { TelaSenha } from "@/components/mais/tela-senha";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Trocar senha — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Senha() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");
  return <TelaSenha />;
}
