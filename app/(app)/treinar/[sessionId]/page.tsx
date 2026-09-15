import { redirect } from "next/navigation";
import { TelaSessao } from "@/components/treinar/tela-sessao";
import { idDoUsuario } from "@/lib/supabase/server";
import { idsComVideo } from "@/lib/videos";

export const metadata = { title: "Sessão — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Sessao({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const userId = await idDoUsuario();
  if (!userId) redirect("/login");

  const { sessionId } = await params;
  // SPEC §13.1: o vídeo é opcional e mora em public/videos (nenhum vem no kit)
  return <TelaSessao sessaoId={sessionId} videos={idsComVideo()} />;
}
