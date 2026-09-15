import { redirect } from "next/navigation";
import { TelaTreinar } from "@/components/treinar/tela-treinar";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Treinar — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Treinar() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");

  return <TelaTreinar userId={userId} />;
}
