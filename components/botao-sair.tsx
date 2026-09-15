"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useState, useTransition } from "react";
import { sair } from "@/app/(auth)/login/acoes";
import { Button } from "@/components/ui/button";
import { limparDadosLocais } from "@/lib/db";
import { pendentes } from "@/lib/outbox";

/**
 * "Sair" (SPEC §2) — e junto com a sessão vai o que ficou no aparelho.
 *
 * O `signOut` do servidor revoga a sessão, mas o modo offline (§8) guardou
 * aqui o cache de leitura do TanStack, a sessão e o cardio em andamento, os
 * blobs das fotos e as cópias das páginas autenticadas no service worker. Num
 * aparelho emprestado dava para ver tudo isso depois do logout. Se a fila
 * ainda tiver item, o primeiro toque avisa — apagar levaria junto o que não
 * subiu.
 */
export function BotaoSair() {
  const [saindo, comecar] = useTransition();
  const [naFila, setNaFila] = useState(0);
  const cliente = useQueryClient();

  const clicar = () => {
    comecar(async () => {
      if (naFila === 0) {
        const quantos = await pendentes().catch(() => 0);
        if (quantos > 0) {
          setNaFila(quantos);
          return;
        }
      }
      await limparDadosLocais();
      cliente.clear();
      await sair();
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={naFila > 0 ? "destructive" : "outline"}
        className="alvo h-12 w-full justify-start gap-2 text-base"
        disabled={saindo}
        onClick={clicar}
      >
        <LogOut className="size-5" />
        {saindo ? "Saindo…" : naFila > 0 ? "Sair mesmo assim" : "Sair"}
      </Button>
      {naFila > 0 ? (
        <p className="text-muted-foreground text-xs text-balance">
          {naFila === 1
            ? "1 registro ainda não subiu"
            : `${naFila} registros ainda não subiram`}{" "}
          e sair apaga o que está guardado neste aparelho. Toque de novo para
          sair assim mesmo.
        </p>
      ) : null}
    </div>
  );
}
