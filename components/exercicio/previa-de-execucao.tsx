"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { PassosDoExercicio } from "@/components/exercicio/passos-do-exercicio";
import type { Exercicio } from "@/lib/schemas";

function execucaoAberta(escopo: Element | null) {
  return escopo?.querySelector<HTMLDetailsElement>("details[data-previa-de-execucao][open]");
}

export function PreviaDeExecucao({ exercicio }: { exercicio: Exercicio }) {
  const [aberta, setAberta] = useState(false);
  const conteudoId = useId();
  return (
    <details data-previa-de-execucao className="group/execucao min-w-0"
      onToggle={evento => setAberta(evento.currentTarget.open)}>
      <summary role="button" aria-label={`Ver execução de ${exercicio.nome}`} aria-controls={conteudoId} aria-expanded={aberta}
        onClick={evento => {
          // O summary abre com toque, Enter e Espaço, inclusive no Safari sem details.name.
          const gatilho = evento.currentTarget;
          const anterior = execucaoAberta(gatilho.closest("ul"));
          if (anterior && anterior !== gatilho.parentElement) anterior.open = false;
        }}
        className="foco alvo text-primary hover:bg-muted flex w-fit max-w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm font-medium">
        Ver execução
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open/execucao:rotate-180" />
      </summary>
      <section id={conteudoId} aria-label={`Execução de ${exercicio.nome}`}
        className="mb-2 flex min-w-0 flex-col gap-3 rounded-lg bg-muted/50 p-3 wrap-anywhere">
        {aberta && (
          <>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Montagem</h3>
              <p className="text-muted-foreground text-sm">{exercicio.montagem}</p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Instruções</h3>
              <PassosDoExercicio passos={exercicio.passos} />
            </div>
          </>
        )}
      </section>
    </details>
  );
}

/** Um primeiro Escape recolhe a execução dentro da folha; o seguinte fecha a folha. */
export function recolherPreviaDeExecucao(evento: KeyboardEvent) {
  if (!(evento.target instanceof Element)) return;
  if (evento.target.matches('input[type="search"]') && (evento.isComposing || evento.keyCode === 229)) {
    evento.preventDefault();
    return;
  }
  const aberta = execucaoAberta(evento.target.closest('[role="dialog"]'));
  if (!aberta) return;
  evento.preventDefault();
  aberta.open = false;
  aberta.querySelector("summary")?.focus();
}
