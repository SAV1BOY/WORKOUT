import { redirect } from "next/navigation";
import { TelaBarraFixa } from "@/components/barra-fixa/tela-barra-fixa";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Barra fixa — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function BarraFixa() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");
  return <TelaBarraFixa userId={userId} />;
}
