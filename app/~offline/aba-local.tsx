"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { ConfigurarSupabase } from "@/components/configurar-supabase";
import { EstadoDaRede } from "@/components/estado-da-rede";
import { Miolo } from "@/components/miolo";
import { NavInferior } from "@/components/nav-inferior";
import { TemaDoPerfil } from "@/components/tema-do-perfil";
import { VideosDoApp } from "@/components/videos-do-app";
import type { TipoCardio } from "@/lib/types";
import type { CaminhoDeAbaLocal, VinculoDoPlayer } from "@/lib/vinculo-do-player";

const Treino = dynamic(() => import("@/components/treino/tela-treino").then(m => m.TelaTreino));
const Relatorio = dynamic(() => import("@/components/relatorio/tela-relatorio").then(m => m.TelaRelatorio));
const Calendario = dynamic(() => import("@/components/calendario/tela-calendario").then(m => m.TelaCalendario));
const Cardio = dynamic(() => import("@/components/cardio/tela-cardio").then(m => m.TelaCardio));

export type DestinoLocal = CaminhoDeAbaLocal | { tipo: TipoCardio; sessaoId: string };
const titulos: Record<CaminhoDeAbaLocal, string> = { "/": "Treino", "/relatorio": "Relatório", "/calendario": "Calendário" };

export default function AbaLocal({ aba, vinculo, videos, children }: {
  aba: DestinoLocal; vinculo: VinculoDoPlayer; videos: string[]; children: ReactNode;
}) {
  const titulo = typeof aba === "string" ? titulos[aba] : "Cardio";
  return (
    <div className="min-h-dvh">
      <title>{titulo} — Treino do Terraço</title>
      <ConfigurarSupabase {...vinculo} />
      {children}
      <TemaDoPerfil />
      <VideosDoApp ids={videos}>
        <EstadoDaRede />
        <Miolo>
          {aba === "/" && <Treino userId={vinculo.conta} />}
          {aba === "/relatorio" && <Relatorio userId={vinculo.conta} />}
          {aba === "/calendario" && <Calendario userId={vinculo.conta} />}
          {typeof aba === "object" && <Cardio userId={vinculo.conta} {...aba} semanaPedida={null} />}
        </Miolo>
      </VideosDoApp>
      <NavInferior />
    </div>
  );
}
