import { redirect } from "next/navigation";
import { TelaRelatorio } from "@/components/relatorio/tela-relatorio";
import { idDoUsuario } from "@/lib/supabase/server";

export const metadata = { title: "Relatório — Treino do Terraço" };
export const dynamic = "force-dynamic";

/**
 * `/relatorio` (SPEC §13.5 e §14.4) substitui `/progresso`, que redireciona
 * para cá: contadores, histórico, sequências, Peso e IMC, e abaixo os gráficos
 * e recordes da §3.7.
 */
export default async function Relatorio() {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");
  return <TelaRelatorio userId={userId} />;
}
