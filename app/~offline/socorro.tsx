"use client";

import { WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EVENTO_DE_LOGIN_CONFIRMADO, idDoPlayerNoCaminho, type VinculoDoPlayer } from "@/lib/vinculo-do-player";

interface PlayerDoAparelho {
  sessaoId: string;
  vinculo: VinculoDoPlayer;
  Componente: typeof import("./player-local").default;
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
  const [player, setPlayer] = useState<PlayerDoAparelho | null>(null);
  useEffect(() => {
    const sessaoId = idDoPlayerNoCaminho(window.location.pathname);
    if (!sessaoId) return;
    let versao = 0;
    const verificar = async () => {
      const vez = ++versao;
      try {
        const { vinculoParaPlayerLocal } = await import("@/lib/player-sem-rede");
        const vinculo = await vinculoParaPlayerLocal(sessaoId);
        const proximo = vinculo ? { sessaoId, vinculo, Componente: (await import("./player-local")).default } : null;
        if (versao === vez) setPlayer(proximo);
      } catch {
        if (versao === vez) setPlayer(null);
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
  }, []);
  if (player) {
    const { Componente, sessaoId, vinculo } = player;
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
