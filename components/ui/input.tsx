import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * O campo do projeto (SPEC §22.3 item 1): 44 px de altura por padrão — o
 * `h-8` do shadcn ficava abaixo do alvo de toque —, com a borda em
 * `--input`, que no escuro subiu para 3,5:1 contra o card (SC 1.4.11).
 *
 * O anel vem no `focus-within` ALÉM do `focus-visible` (SPEC §22.3 item 7).
 * `input[type="date"]` tem shadow DOM do navegador: o Tab anda por dia, mês,
 * ano e termina no ícone do calendário, que é um nó de DENTRO. Nesse último
 * passo o `document.activeElement` ainda é o campo, mas o host deixa de casar
 * `:focus-visible` — e o anel sumia justo ali. `:focus-within` casa com o
 * host enquanto o foco estiver em qualquer descendente, inclusive na sombra;
 * nos campos de texto os dois estados coincidem, então nada mais muda.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-9 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-within:border-ring focus-within:ring-3 focus-within:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-muted/60 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
