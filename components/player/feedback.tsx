"use client";

import { Button } from "@/components/ui/button";
import { OPCOES_DE_FEEDBACK } from "@/lib/player";
import { cn } from "@/lib/utils";

/**
 * "O que você achou do treino de hoje?" (SPEC §14.1.4). As cinco opções
 * gravam `sessions.sensacao`: **1 = muito difícil … 5 = muito fácil**
 * (`lib/player.ts` documenta o mapeamento).
 */
export function TelaFeedback({
  sensacao,
  aoEscolher,
  aoSeguir,
  aoVoltar,
}: {
  sensacao: number | null;
  aoEscolher: (valor: number) => void;
  aoSeguir: () => void;
  aoVoltar: () => void;
}) {
  return (
    <section
      aria-label="Feedback do treino"
      className="flex flex-1 flex-col justify-center gap-5 px-4 py-8"
    >
      <h2 className="text-center text-2xl font-semibold text-balance">
        O que você achou do treino de hoje?
      </h2>

      <div role="radiogroup" aria-label="Sensação" className="flex flex-col gap-2">
        {OPCOES_DE_FEEDBACK.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={sensacao === opcao.valor}
            onClick={() => aoEscolher(opcao.valor)}
            className={cn(
              "alvo flex h-14 items-center justify-center rounded-2xl border text-base font-medium",
              sensacao === opcao.valor
                ? "border-primary bg-primary/10"
                : "border-input bg-background",
            )}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" className="alvo h-14 rounded-2xl px-4" onClick={aoVoltar}>
          Voltar
        </Button>
        <Button
          className="alvo h-14 flex-1 rounded-2xl text-base font-semibold"
          onClick={aoSeguir}
        >
          Concluído
        </Button>
      </div>
    </section>
  );
}
