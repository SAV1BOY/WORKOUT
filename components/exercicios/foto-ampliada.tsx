"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * A foto em tela cheia (SPEC §3.6 e §7).
 *
 * **Sem o `Dialog` do Radix de propósito.** Os componentes do shadcn importam
 * do pacote guarda-chuva `radix-ui`, e usar o diálogo aqui criava um segundo
 * bundle de ~200 kB só desta rota: a ficha do exercício fechava em 353 kB de
 * first load, acima do teto de 350 kB, por causa de um overlay com uma imagem
 * dentro. Uma camada própria faz o mesmo: `role="dialog"`, `aria-modal`, foco
 * no botão de fechar, Esc e toque fora fecham.
 *
 * Com `aoApagar` (Corpo → Fotos, SPEC §22.2 item 3) a camada ganha o botão
 * **Apagar** e a confirmação — um segundo diálogo, `role="alertdialog"`, que
 * pega o foco, fecha no Esc e não deixa apagar por toque acidental.
 */
export function FotoAmpliada({
  url,
  titulo,
  aoFechar,
  aoApagar,
  apagando = false,
}: {
  url: string;
  titulo: string;
  aoFechar: () => void;
  /** Só quem pode apagar passa isto (a galeria do Corpo). */
  aoApagar?: () => void;
  apagando?: boolean;
}) {
  const fechar = useRef<HTMLButtonElement>(null);
  const confirmar = useRef<HTMLButtonElement>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    fechar.current?.focus();
    // sem isto a tela rola atrás da foto ampliada
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, []);

  // o Esc fecha a confirmação primeiro, e só depois a foto
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmando) setConfirmando(false);
      else aoFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar, confirmando]);

  useEffect(() => {
    if (confirmando) confirmar.current?.focus();
  }, [confirmando]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={() => (confirmando ? setConfirmando(false) : aoFechar())}
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

      {aoApagar ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmando(true);
          }}
          className="alvo bg-background/90 text-foreground absolute bottom-4 left-1/2 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full px-4 text-sm font-medium"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Apagar
        </button>
      ) : null}

      {confirmando && aoApagar ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="Apagar esta foto?"
          onClick={(e) => e.stopPropagation()}
          className="bg-background absolute inset-x-3 bottom-3 flex flex-col gap-3 rounded-xl p-4 shadow-lg"
        >
          <p className="text-sm">Apagar esta foto? Não dá para desfazer.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="alvo border-input h-12 flex-1 rounded-md border text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              ref={confirmar}
              type="button"
              disabled={apagando}
              onClick={() => {
                setConfirmando(false);
                aoApagar();
              }}
              className="alvo bg-destructive h-12 flex-1 rounded-md text-sm font-medium text-white disabled:opacity-60"
            >
              {apagando ? "Apagando…" : "Apagar"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
