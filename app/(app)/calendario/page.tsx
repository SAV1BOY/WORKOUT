import { redirect } from "next/navigation";
import { TelaCalendario } from "@/components/calendario/tela-calendario";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Calendário — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Calendario() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");

  return <TelaCalendario userId={userId} />;
}
