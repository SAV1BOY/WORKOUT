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
 * O "Ajustar" da aba Treino (SPEC §14.3): o mesmo bloco de ajustes do player e
 * de Mais → Preferências — são as mesmas chaves em `profiles.prefs`.
 *
 * SPEC §22.7 item 1: era um botão flutuante fixo no canto inferior direito.
 * Com 2.555 px de rolagem ele acabava por cima da lista — `elementFromPoint`
 * sobre o "Substituir" do 3º exercício devolvia o svg do FAB —, e ele abria
 * exatamente a mesma folha da engrenagem do player. Agora mora no cabeçalho da
 * aba, ao lado da data, onde sobrava espaço e nada mais disputa o toque.
 */
export function BotaoAjustar({ perfil }: { perfil: LinhaPerfil | null }) {
  const [aberto, setAberto] = useState(false);

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Ajustar"
          className="border-border bg-card hover:bg-muted alvo text-foreground flex size-11 shrink-0 items-center justify-center rounded-full border"
        >
          <Settings2 aria-hidden="true" className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] overflow-y-auto pb-8"
        /*
         * SPEC §22.7 item 3: sem isto o foco caía no primeiro campo (a
         * "Preparação") e o teclado numérico subia junto com a folha, tapando
         * metade dos ajustes. O foco começa no título, que é o que a folha diz.
         */
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          const folha = evento.currentTarget as HTMLElement;
          folha.querySelector<HTMLElement>("[data-titulo-da-folha]")?.focus();
        }}
      >
        <SheetHeader className="pb-0">
          <SheetTitle data-titulo-da-folha tabIndex={-1} className="outline-none">
            Ajustar
          </SheetTitle>
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
