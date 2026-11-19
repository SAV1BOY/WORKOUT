"use client";

import { WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { resumoDeCardioNaUrl } from "@/lib/rota-de-cardio";
import type { DestinoLocal } from "./aba-local";
import type { LinhaPerfil } from "@/lib/types";
import { ehAbaLocal, EVENTO_DE_LOGIN_CONFIRMADO, idDoPlayerNoCaminho, type VinculoDoPlayer } from "@/lib/vinculo-do-player";

interface PlayerDoAparelho {
  sessaoId: string;
  vinculo: VinculoDoPlayer;
  Componente: typeof import("./player-local").default;
}

interface AbaDoAparelho {
  aba: DestinoLocal;
  vinculo: VinculoDoPlayer;
  Componente: typeof import("./aba-local").default;
}

/**
 * A página que o service worker serve quando a navegação não tem de onde vir
 * (SPEC §8 e §22.1). Ela é o fim da linha de qualquer rota sem rede, então tem
 * de dizer o que aconteceu **e** dar saída: tentar de novo ou voltar ao treino,
 * que funciona offline com o que está no aparelho.
 *
 * É um componente de cliente por causa do `location.reload()`; o título da aba
 * vai no próprio JSX (o React 19 o leva para o `<head>`).
 */
export function Socorro({ videos, children }: { videos: string[]; children: ReactNode }) {
  const cliente = useQueryClient();
  const [tela, setTela] = useState<PlayerDoAparelho | AbaDoAparelho | null>(null);
  useEffect(() => {
    const caminho = window.location.pathname;
    const aba = ehAbaLocal(caminho) ? caminho : null;
    const sessaoId = idDoPlayerNoCaminho(caminho);
    const cardio = resumoDeCardioNaUrl(new URL(window.location.href));
    if (!aba && !cardio && !sessaoId) return;
    let versao = 0;
    const verificar = async () => {
      const vez = ++versao;
      try {
        const { vinculoDoLoginAtual, vinculoParaAbaLocal, vinculoParaPlayerLocal } = await import("@/lib/player-sem-rede");
        let proxima: PlayerDoAparelho | AbaDoAparelho | null = null;
        if (aba) {
          const local = await vinculoParaAbaLocal(aba);
          if (local) {
            const Componente = (await import("./aba-local")).default;
            if (versao !== vez) return;
            const emMemoria = cliente.getQueryState<LinhaPerfil>(["perfil"]);
            if (!emMemoria?.data || emMemoria.data.user_id === local.vinculo.conta) {
              // Uma navegação rápida pode preceder a gravação do cache geral das consultas.
              if (!emMemoria?.data || local.perfil.atualizadoEm > emMemoria.dataUpdatedAt) {
                cliente.setQueryData(["perfil"], local.perfil.valor, { updatedAt: local.perfil.atualizadoEm });
              }
              proxima = { aba, vinculo: local.vinculo, Componente };
            }
          }
        } else if (cardio) {
          const vinculo = await vinculoDoLoginAtual();
          if (vinculo) proxima = { aba: cardio, vinculo, Componente: (await import("./aba-local")).default };
        } else if (sessaoId) {
          const vinculo = await vinculoParaPlayerLocal(sessaoId);
          if (vinculo) proxima = { sessaoId, vinculo, Componente: (await import("./player-local")).default };
        }
        if (versao === vez) setTela(proxima);
      } catch {
        if (versao === vez) setTela(null);
      }
    };
    void verificar();
    const cookies = window.cookieStore;
    cookies?.addEventListener("change", verificar);
    window.addEventListener("pageshow", verificar);
    window.addEventListener("focus", verificar);
    window.addEventListener(EVENTO_DE_LOGIN_CONFIRMADO, verificar);
    return () => {
      versao++;
      cookies?.removeEventListener("change", verificar);
      window.removeEventListener("pageshow", verificar);
      window.removeEventListener("focus", verificar);
      window.removeEventListener(EVENTO_DE_LOGIN_CONFIRMADO, verificar);
    };
  }, [cliente]);
  if (tela && "aba" in tela) {
    const { Componente, aba, vinculo } = tela;
    return <Componente key={`${vinculo.conta}:${typeof aba === "string" ? aba : aba.sessaoId}`} aba={aba} vinculo={vinculo} videos={videos}>{children}</Componente>;
  }
  if (tela) {
    const { Componente, sessaoId, vinculo } = tela;
    return <Componente key={`${vinculo.conta}:${sessaoId}`} sessaoId={sessaoId} vinculo={vinculo} videos={videos}>{children}</Componente>;
  }
  return (
    <main className="pb-segura mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 pt-10 text-center">
      <title>Sem conexão — Treino do Terraço</title>
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full"
      >
        <WifiOff className="size-8" />
      </span>
      <h1 className="text-2xl font-semibold">Sem conexão</h1>
      <p className="text-muted-foreground text-balance">
        O treino continua: o que você registrar fica salvo no celular e sobe
        sozinho quando a rede voltar.
      </p>
      <div className="flex w-full flex-col gap-2 pt-2">
        <Button
          className="alvo h-12 rounded-2xl text-base font-semibold"
          onClick={() => window.location.reload()}
        >
          Tentar de novo
        </Button>
        <Button
          asChild
          variant="outline"
          className="alvo h-12 rounded-2xl text-base"
        >
          <Link href="/">Ir para o Treino</Link>
        </Button>
      </div>
    </main>
  );
}
