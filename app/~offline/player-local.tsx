"use client";

import type { ReactNode } from "react";
import { ConfigurarSupabase } from "@/components/configurar-supabase";
import { EstadoDaRede } from "@/components/estado-da-rede";
import { TelaPlayer } from "@/components/player/tela-player";
import { TemaDoPerfil } from "@/components/tema-do-perfil";
import { VideosDoApp } from "@/components/videos-do-app";
import type { VinculoDoPlayer } from "@/lib/vinculo-do-player";

export default function PlayerLocal({ sessaoId, vinculo, videos, children }: {
  sessaoId: string; vinculo: VinculoDoPlayer; videos: string[]; children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <title>Sessão — Treino do Terraço</title>
      <ConfigurarSupabase {...vinculo} />
      <TemaDoPerfil />
      {children}
      <VideosDoApp ids={videos}>
        <EstadoDaRede />
        <main className="pt-segura mx-auto w-full max-w-lg px-4 pt-4">
          <TelaPlayer userId={vinculo.conta} sessaoId={sessaoId} videos={videos} />
        </main>
      </VideosDoApp>
    </div>
  );
}
