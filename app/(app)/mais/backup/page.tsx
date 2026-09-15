import { redirect } from "next/navigation";
import { TelaBackup } from "@/components/mais/tela-backup";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Backup — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Backup() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");
  return <TelaBackup userId={userId} />;
}
