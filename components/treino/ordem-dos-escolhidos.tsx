"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { SetasDeOrdem } from "@/components/treino/setas-de-ordem";
import { BotaoLargo } from "@/components/ui/botao-largo";
import { acharExercicio } from "@/lib/dados";

export function OrdemDosEscolhidos({ ids, aoMover, aoFechar }: {
  ids: readonly string[];
  aoMover: (id: string, direcao: -1 | 1) => void;
  aoFechar: () => void;
}) {
  const [movido, setMovido] = useState<string | null>(null);
  const controleMovido = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    const botao = controleMovido.current;
    if (!botao) return;
    controleMovido.current = null;
    // Na primeira/última posição, a direção que trouxe o exercício ficou indisponível.
    const foco = botao.disabled ? botao.parentElement?.querySelector<HTMLButtonElement>("button:enabled") : botao;
    foco?.focus({ preventScroll: true });
    foco?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [ids]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
      <ol aria-label="Ordem dos exercícios escolhidos" className="min-h-0 overflow-y-auto divide-y px-1">
        {ids.map((id, i) => {
          const nome = acharExercicio(id).nome;
          return (
            <li key={id} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
              <span className="min-w-0 flex-[1_1_8rem] text-sm font-medium wrap-anywhere">{i + 1}. {nome}</span>
              <div className="ml-auto flex shrink-0 gap-1">
                <SetasDeOrdem nome={nome} indice={i} total={ids.length} aoMover={(direcao, botao) => {
                  controleMovido.current = botao;
                  setMovido(id);
                  aoMover(id, direcao);
                }} />
              </div>
            </li>
          );
        })}
      </ol>
      <p role="status" className="sr-only">{movido && `${acharExercicio(movido).nome}, posição ${ids.indexOf(movido) + 1} de ${ids.length}.`}</p>
      <BotaoLargo type="button" className="shrink-0" onClick={aoFechar}>Pronto</BotaoLargo>
    </div>
  );
}
