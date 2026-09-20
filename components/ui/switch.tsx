"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

/**
 * O interruptor do shadcn com a caixa de toque que o celular pede: o pill
 * continua com 32 × 18,4 px, mas o **botão** em volta mede 44 × 44 px
 * (CLAUDE.md, SPEC §13.8.1) — e é o botão que o dedo acerta e que qualquer
 * medição de alvo enxerga. O desenho do pill vive no `<span>` de dentro.
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
        className="flex items-center rounded-full border border-transparent bg-input transition-colors group-data-[size=default]/switch:h-[18.4px] group-data-[size=default]/switch:w-[32px] group-data-[size=sm]/switch:h-[14px] group-data-[size=sm]/switch:w-[24px] group-data-checked/switch:bg-primary group-aria-invalid/switch:border-destructive dark:bg-input/80"
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground"
        />
      </span>
    </SwitchPrimitive.Root>
  )
}

export { Switch }
