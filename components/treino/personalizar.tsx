"use client";

import { Check, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSessaoLivre } from "@/components/colecoes/usar-sessao-livre";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { Input } from "@/components/ui/input";
import { Miniatura } from "@/components/ui/miniatura";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { filtrarExercicios } from "@/lib/catalogo";
import { acharExercicio, exercicios } from "@/lib/dados";
import { evitadosPorUltimo } from "@/lib/preferencias";
import type { Prefs } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * "Personalizar treino" (SPEC §14.3): escolher exercícios do catálogo dos 81,
 * com busca sem acento, e começar uma sessão livre com eles, na ordem em que
 * foram escolhidos. Nada de conteúdo novo — a lista é o próprio catálogo.
 */
export function Personalizar({ prefs }: { prefs?: Prefs }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [escolhidos, setEscolhidos] = useState<string[]>([]);

  const achados = useMemo(
    () =>
      evitadosPorUltimo(
        filtrarExercicios(exercicios, { busca }),
        (e) => e.id,
        prefs,
      ),
    [busca, prefs],
  );

  const { comecar, ocupado, pronto } = useSessaoLivre(escolhidos);

  const alternar = (id: string) =>
    setEscolhidos((atuais) =>
      atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id],
    );

  return (
    <Sheet
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) setBusca("");
      }}
    >
      <SheetTrigger asChild>
        <button
          type="button"
          className="cartao border-border bg-card hover:bg-muted/40 alvo flex w-full items-center gap-3 border border-dashed px-4 py-4 text-left"
        >
          <span className="bg-primary/15 text-primary flex size-11 shrink-0 items-center justify-center rounded-full">
            <Plus aria-hidden="true" className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">Personalizar treino</span>
            <span className="text-muted-foreground text-xs">
              Crie o seu próprio, com os exercícios que quiser.
            </span>
          </span>
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="flex max-h-[90dvh] flex-col pb-8">
        <SheetHeader className="pb-0">
          <SheetTitle>Crie o seu próprio</SheetTitle>
          <SheetDescription>
            Escolha os exercícios na ordem em que vai fazer. A prescrição é a do
            catálogo e a progressão de cada um continua valendo.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              type="search"
              inputMode="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar exercício"
              aria-label="Buscar exercício pelo nome"
              className="alvo h-12 pl-9 text-base"
            />
          </div>

          {escolhidos.length > 0 ? (
            <ul aria-label="Escolhidos" className="flex flex-wrap gap-2">
              {escolhidos.map((id, i) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => alternar(id)}
                    aria-label={`Tirar ${acharExercicio(id).nome}`}
                    className="border-primary bg-primary/10 alvo flex h-11 items-center gap-1 rounded-full border px-3 text-xs"
                  >
                    <span className="numero">{i + 1}.</span>
                    {acharExercicio(id).nome}
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <ul
            aria-label="Catálogo"
            className="min-h-0 flex-1 divide-y overflow-y-auto"
          >
            {achados.map((e) => {
              const marcado = escolhidos.includes(e.id);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    aria-pressed={marcado}
                    onClick={() => alternar(e.id)}
                    className="hover:bg-muted/40 alvo flex w-full items-center gap-3 py-2 text-left"
                  >
                    <Miniatura exercicioId={e.id} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-medium text-balance">{e.nome}</span>
                      <span className="numero text-muted-foreground text-xs">
                        {e.prescricao_padrao.texto} · {e.equipamento_texto}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border",
                        marcado
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {marcado ? (
                        <Check aria-hidden="true" className="size-4" strokeWidth={3} />
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
            {achados.length === 0 ? (
              <li className="text-muted-foreground py-6 text-center text-sm">
                Nenhum exercício com esse nome.
              </li>
            ) : null}
          </ul>

          <BotaoLargo
            disabled={!pronto || ocupado || escolhidos.length === 0}
            onClick={() =>
              void comecar(escolhidos, { titulo: "Treino personalizado" })
            }
          >
            {ocupado
              ? "Começando…"
              : escolhidos.length === 0
                ? "Escolha os exercícios"
                : `Começar (${escolhidos.length})`}
          </BotaoLargo>
        </div>
      </SheetContent>
    </Sheet>
  );
}
