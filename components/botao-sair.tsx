"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { sair } from "@/app/(auth)/login/acoes";
import { Button } from "@/components/ui/button";

export function BotaoSair() {
  const [saindo, comecar] = useTransition();
  return (
    <Button
      variant="outline"
      className="alvo h-12 w-full justify-start gap-2 text-base"
      disabled={saindo}
      onClick={() => {
        comecar(async () => {
          await sair();
        });
      }}
    >
      <LogOut className="size-5" />
      {saindo ? "Saindo…" : "Sair"}
    </Button>
  );
}
