import { redirect } from "next/navigation";
import { TelaEquipamento } from "@/components/mais/tela-equipamento";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Equipamento — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Equipamento() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");
  return <TelaEquipamento userId={userId} />;
}
