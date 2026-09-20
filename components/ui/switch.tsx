"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

/**
 * O interruptor do shadcn com a caixa de toque que o celular pede: o pill
 * continua com 32 × 18,4 px, mas o **botão** em volta mede 44 × 44 px
 * (CLAUDE.md, SPEC §13.8.1) — e é o botão que o dedo acerta e que qualquer
 * medição de alvo enxerga. O desenho do pill vive no `<span>` de dentro.
 *
 * O trilho diz o estado nos DOIS temas (SPEC §22.3 item 13). Antes ele era
 * `bg-input … group-data-checked:bg-primary … dark:bg-input/80`: a variante
 * `dark:` pesa (0,2,0) contra os (0,1,0) da variante de estado, então no
 * escuro o trilho ficava cinza-claro ligado OU desligado e só o polegar
 * mudava — preto quando ligado, branco quando desligado, o inverso do tema
 * claro. Agora cada estado tem a sua regra (nenhuma pega os dois) e o polegar
 * é claro sempre, nos dois temas: quem conta o estado é a cor do trilho
 * (cinza `--input` desligado, laranja `--primary` ligado) mais a posição. A
 * borda de 1 px do polegar mantém 3:1 contra o laranja claro do tema escuro.
 */
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch alvo relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-transparent transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span
        data-slot="switch-track"
        className="flex items-center rounded-full border border-transparent transition-colors group-data-[size=default]/switch:h-[18.4px] group-data-[size=default]/switch:w-[32px] group-data-[size=sm]/switch:h-[14px] group-data-[size=sm]/switch:w-[24px] group-data-[state=unchecked]/switch:bg-input dark:group-data-[state=unchecked]/switch:bg-input/80 group-data-[state=checked]/switch:bg-primary group-aria-invalid/switch:border-destructive"
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className="pointer-events-none block rounded-full bg-card shadow-[0_0_0_1px_rgb(10_10_10_/_0.22)] ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:bg-foreground"
        />
      </span>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
