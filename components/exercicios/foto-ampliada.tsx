"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * A foto em tela cheia (SPEC §3.6 e §7).
 *
 * **Sem o `Dialog` do Radix de propósito.** Os componentes do shadcn importam
 * do pacote guarda-chuva `radix-ui`, e usar o diálogo aqui criava um segundo
 * bundle de ~200 kB só desta rota: a ficha do exercício fechava em 353 kB de
 * first load, acima do teto de 350 kB, por causa de um overlay com uma imagem
 * dentro. Uma camada própria faz o mesmo: `role="dialog"`, `aria-modal`, foco
 * no botão de fechar, Esc e toque fora fecham.
 */
export function FotoAmpliada({
  url,
  titulo,
  aoFechar,
}: {
  url: string;
  titulo: string;
  aoFechar: () => void;
}) {
  const fechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fechar.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    // sem isto a ficha rola atrás da foto ampliada
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = antes;
    };
  }, [aoFechar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={aoFechar}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2"
    >
      <button
        ref={fechar}
        type="button"
        onClick={aoFechar}
        aria-label="Fechar a foto"
        className="alvo bg-background/90 text-foreground absolute top-3 right-3 flex size-11 items-center justify-center rounded-full"
      >
        <X className="size-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto local em /public */}
      <img
        src={url}
        alt={titulo}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80dvh] w-full max-w-lg rounded-lg object-contain"
      />
    </div>
  );
}
