import { redirect } from "next/navigation";
import { TelaCorpo } from "@/components/corpo/tela-corpo";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Corpo — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Corpo() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");
  return <TelaCorpo userId={userId} />;
}
