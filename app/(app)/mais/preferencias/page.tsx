import { redirect } from "next/navigation";
import { TelaPreferencias } from "@/components/mais/tela-preferencias";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Preferências — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Preferencias() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");
  return <TelaPreferencias userId={userId} />;
}
