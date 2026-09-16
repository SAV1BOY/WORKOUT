import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * O botão de ação principal de um card (SPEC §13.3): largura toda, 56 px de
 * altura — bem acima dos 44 px de alvo, para bater com o polegar.
 */
export function BotaoLargo({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      className={cn("alvo h-14 w-full rounded-xl text-base font-semibold", className)}
    />
  );
}
