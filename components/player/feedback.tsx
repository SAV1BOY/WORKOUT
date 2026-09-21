"use client";

import { Button } from "@/components/ui/button";
import { OPCOES_DE_FEEDBACK } from "@/lib/player";
import { cn } from "@/lib/utils";

/**
 * "O que você achou do treino de hoje?" (SPEC §14.1.4). As cinco opções
 * gravam `sessions.sensacao`: **1 = muito difícil … 5 = muito fácil**
 * (`lib/player.ts` documenta o mapeamento).
 *
 * SPEC §22.5 itens 4 e 5: a pergunta é opcional e diz para que serve; nenhuma
 * opção nasce marcada; e as cinco não são mais pintadas com a cor da página.
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
      <header className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-2xl font-semibold text-balance">
          O que você achou do treino de hoje?
        </h2>
        <p className="text-muted-foreground text-sm text-balance">
          (opcional) Fica no histórico do treino, ao lado do resumo do dia.
        </p>
      </header>

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
              /* SPEC §22.5 item 5: `bg-background` é a cor da PÁGINA — no
                 tema claro as cinco opções desapareciam no fundo. */
              sensacao === opcao.valor
                ? "border-primary bg-primary/10"
                : "border-input bg-card",
            )}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" className="alvo" onClick={aoVoltar}>
          Voltar
        </Button>
        <Button
          size="xl"
          className="alvo flex-1 rounded-2xl font-semibold"
          onClick={aoSeguir}
        >
          {sensacao === null ? "Concluir sem responder" : "Concluir"}
        </Button>
      </div>
    </section>
  );
}
