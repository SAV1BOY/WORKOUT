import { TelaMais } from "@/components/mais/tela-mais";
import { ehDono } from "@/lib/env";
import { identidadeDaRequisicao } from "@/lib/supabase/server";

export const metadata = { title: "Mais — Treino do Terraço" };
export const dynamic = "force-dynamic";

export default async function Mais() {
  const usuario = await identidadeDaRequisicao();
  return <TelaMais userId={usuario?.id ?? null} dono={ehDono(usuario?.email ?? null)} />;
}
