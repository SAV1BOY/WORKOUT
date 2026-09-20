import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AquecerMidia } from "@/components/aquecer-midia";
import { ConfigurarSupabase } from "@/components/configurar-supabase";
import { SpriteMuscular } from "@/components/sprite-muscular";
import { TemaDoPerfil } from "@/components/tema-do-perfil";
import { Miolo } from "@/components/miolo";
import { NavInferior } from "@/components/nav-inferior";
import { VideosDoApp } from "@/components/videos-do-app";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  ehDono,
  supabaseConfigurado,
} from "@/lib/env";
import { garantirPerfil } from "@/lib/queries/perfil";
import { criarClienteServidor } from "@/lib/supabase/server";
import { idsComVideo } from "@/lib/videos";

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

  // primeiro acesso do dono: perfil vem de data/perfil.json; as outras contas
  // ficam com o que o schema deu (SPEC §21.3)
  await garantirPerfil(supabase, user.id, { dono: ehDono(user.email) });

  return (
    <div className="min-h-dvh">
      <ConfigurarSupabase url={SUPABASE_URL} chave={SUPABASE_ANON_KEY} />
      <SpriteMuscular />
      <TemaDoPerfil />
      <AquecerMidia />
      {/* a lista de vídeos é lida do disco aqui e desce pronta (§22.2 item 7) */}
      <VideosDoApp ids={idsComVideo()}>
        <Miolo>{children}</Miolo>
      </VideosDoApp>
      <NavInferior />
    </div>
  );
}
