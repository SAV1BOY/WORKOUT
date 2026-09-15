"use client";

import { Settings2 } from "lucide-react";
import { useState } from "react";
import { EsqueletoCard } from "@/components/carregando";
import { AjustesDoTreino } from "@/components/mais/ajustes-do-treino";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { LinhaPerfil } from "@/lib/types";

/**
 * O FAB "Ajustar" da aba Treino (SPEC §14.3): o mesmo bloco de ajustes do
 * player e de Mais → Preferências — são as mesmas chaves em `profiles.prefs`.
 *
 * Fica acima da barra de abas (56 px + respiro) para não cobrir a navegação.
 */
export function FabAjustar({ perfil }: { perfil: LinhaPerfil | null }) {
  const [aberto, setAberto] = useState(false);

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Ajustar"
          className="bg-primary text-primary-foreground alvo fixed right-4 bottom-20 z-40 flex size-14 items-center justify-center rounded-full shadow-lg"
        >
          <Settings2 aria-hidden="true" className="size-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto pb-8">
        <SheetHeader className="pb-0">
          <SheetTitle>Ajustar</SheetTitle>
          <SheetDescription>
            Vale para todos os treinos. Fica em Mais → Preferências.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          {perfil ? (
            <AjustesDoTreino userId={perfil.user_id} perfil={perfil} />
          ) : (
            <EsqueletoCard linhas={3} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
