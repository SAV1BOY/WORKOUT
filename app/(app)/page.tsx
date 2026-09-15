import { redirect } from "next/navigation";
import { TelaTreino } from "@/components/treino/tela-treino";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Treino — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Treino() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");

  return <TelaTreino userId={userId} />;
}
