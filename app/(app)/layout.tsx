import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AquecerMidia } from "@/components/aquecer-midia";
import { ConfigurarSupabase } from "@/components/configurar-supabase";
import { SpriteMuscular } from "@/components/sprite-muscular";
import { TemaDoPerfil } from "@/components/tema-do-perfil";
import { NavInferior } from "@/components/nav-inferior";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  emailPermitido,
  supabaseConfigurado,
} from "@/lib/env";
import { garantirPerfil } from "@/lib/queries/perfil";
import { criarClienteServidor } from "@/lib/supabase/server";

// o shell autenticado lê cookies: nunca é pré-renderizado estático
export const dynamic = "force-dynamic";

export default async function LayoutApp({
  children,
}: {
  children: ReactNode;
}) {
  if (!supabaseConfigurado()) redirect("/login");

  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!emailPermitido(user.email)) redirect("/login?erro=app-pessoal");

  // primeiro acesso: perfil vem de data/perfil.json
  await garantirPerfil(supabase, user.id);

  return (
    <div className="min-h-dvh">
      <ConfigurarSupabase url={SUPABASE_URL} chave={SUPABASE_ANON_KEY} />
      <SpriteMuscular />
      <TemaDoPerfil />
      <AquecerMidia />
      <main className="pt-segura mx-auto w-full max-w-lg px-4 pt-4 pb-24">
        {children}
      </main>
      <NavInferior />
    </div>
  );
}
