"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Dialog as SheetPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * SPEC §22.14 item 6 (a11y-05): enquanto a folha está aberta, tudo o que não
 * é ela fica `inert` — fora do Tab e da árvore do leitor de tela. O Radix já
 * põe `aria-hidden` nos irmãos, mas o `<main>`, o `<header>` e o `<nav>` só
 * ficavam escondidos pelo ancestral e continuavam alcançáveis. Sobe da folha
 * até o `<body>` marcando os irmãos de cada nível; regiões `aria-live` (os
 * avisos) e o véu da folha (o toque fora fecha) ficam de fora. Ao fechar, só desmarca o que ela marcou — uma folha
 * aberta por cima de outra devolve a de baixo como estava.
 */
export function inertizarForaDe(elemento: HTMLElement): () => void {
  const marcados: Element[] = []
  let atual: HTMLElement | null = elemento
  while (atual && atual !== document.body && atual.parentElement) {
    for (const irmao of Array.from(atual.parentElement.children)) {
      if (irmao === atual || irmao.hasAttribute("inert")) continue
      if (/^(SCRIPT|STYLE|LINK|TEMPLATE|META|NOSCRIPT)$/.test(irmao.tagName)) continue
      // os avisos (sonner, anunciador de rota) e o véu da própria folha ficam
      if (irmao.hasAttribute("aria-live") || irmao.tagName === "NEXT-ROUTE-ANNOUNCER") continue
      if (irmao.getAttribute("data-slot") === "sheet-overlay") continue
      irmao.setAttribute("inert", "")
      marcados.push(irmao)
    }
    atual = atual.parentElement
  }
  return () => {
    for (const m of marcados) m.removeAttribute("inert")
  }
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  /*
   * Ref com limpeza (React 19): marca ao montar o conteúdo e desmarca ao
   * desmontar — depois da animação de saída, antes de o Radix devolver o foco
   * ao gatilho (ele faz isso num setTimeout), então o gatilho já não é inerte.
   */
  const marcarFora = React.useCallback((no: HTMLDivElement | null) => {
    if (!no) return
    return inertizarForaDe(no)
  }, [])
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={marcarFora}
        data-slot="sheet-content"
        data-side={side}
        aria-modal="true"
        /*
         * SPEC §22.14 item 6: o primeiro foco é o título da folha, para o
         * leitor anunciar o que abriu antes da lista (o Radix focava o
         * primeiro item). Quem passa o próprio `onOpenAutoFocus` e chama
         * `preventDefault()` (o Ajustar, §22.7 item 3) continua mandando.
         */
        onOpenAutoFocus={(evento) => {
          onOpenAutoFocus?.(evento)
          if (evento.defaultPrevented) return
          const titulo = (evento.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(
            '[data-slot="sheet-title"]'
          )
          if (!titulo) return
          evento.preventDefault()
          titulo.focus()
        }}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            {/* o X da folha é alvo de dedo no terraço: 44 px, como no dialog */}
            <Button
              variant="ghost"
              className="alvo absolute top-3 right-3"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Fechar</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      // recebe o primeiro foco da folha (§22.14 item 6), fora da ordem do Tab
      tabIndex={-1}
      className={cn(
        "font-heading text-base font-medium text-foreground outline-none",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
