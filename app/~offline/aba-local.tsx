"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { ConfigurarSupabase } from "@/components/configurar-supabase";
import { EstadoDaRede } from "@/components/estado-da-rede";
import { Miolo } from "@/components/miolo";
import { NavInferior } from "@/components/nav-inferior";
import { TemaDoPerfil } from "@/components/tema-do-perfil";
import { VideosDoApp } from "@/components/videos-do-app";
import type { VinculoDoPlayer } from "@/lib/vinculo-do-player";

const Treino = dynamic(() => import("@/components/treino/tela-treino").then(m => m.TelaTreino));
const Relatorio = dynamic(() => import("@/components/relatorio/tela-relatorio").then(m => m.TelaRelatorio));

export default function AbaLocal({ aba, vinculo, videos, children }: {
  aba: "/" | "/relatorio"; vinculo: VinculoDoPlayer; videos: string[]; children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <title>{aba === "/" ? "Treino" : "Relatório"} — Treino do Terraço</title>
      <ConfigurarSupabase {...vinculo} />
      {children}
      <TemaDoPerfil />
      <VideosDoApp ids={videos}>
        <EstadoDaRede />
        <Miolo>{aba === "/" ? <Treino userId={vinculo.conta} /> : <Relatorio userId={vinculo.conta} />}</Miolo>
      </VideosDoApp>
      <NavInferior />
    </div>
  );
}
