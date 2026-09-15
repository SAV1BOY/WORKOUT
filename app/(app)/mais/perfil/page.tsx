import { redirect } from "next/navigation";
import { TelaPerfil } from "@/components/mais/tela-perfil";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Perfil — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Perfil() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");
  return <TelaPerfil userId={userId} />;
}
