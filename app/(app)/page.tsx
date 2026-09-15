import { redirect } from "next/navigation";
import { TelaHoje } from "@/components/hoje/tela-hoje";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Hoje — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Hoje() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");

  return <TelaHoje userId={userId} />;
}
