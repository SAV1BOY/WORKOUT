"use client";

import { WifiOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * A página que o service worker serve quando a navegação não tem de onde vir
 * (SPEC §8 e §22.1). Ela é o fim da linha de qualquer rota sem rede, então tem
 * de dizer o que aconteceu **e** dar saída: tentar de novo ou voltar ao treino,
 * que funciona offline com o que está no aparelho.
 *
 * É um componente de cliente por causa do `location.reload()`; o título da aba
 * vai no próprio JSX (o React 19 o leva para o `<head>`).
 */
export default function Offline() {
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
