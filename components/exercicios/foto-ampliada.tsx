"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fonteComReserva, reservaDaImagem } from "@/components/ui/imagem";
import { medidaDaFoto, urlWebp } from "@/lib/midia";

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
  /*
   * A foto de execução do kit tem derivada WebP (SPEC §22.4 item 1): 44 kB no
   * lugar de 70, e esta é a tela mais pesada de imagem do app. A foto de
   * progresso do Corpo vem do storage do Supabase, não de `public/` — ali
   * `urlWebp` devolve `null` e a URL assinada segue inteira.
   */
  const fonte = fonteComReserva(url, urlWebp(url));
  /*
   * A medida é a do arquivo que esta `<img>` pede, tirada de
   * `data/medidas-de-foto.json` (SPEC §22.4 item 3). Aqui ela decide a caixa:
   * com `object-contain` e o `height:auto` do preflight, quem manda antes de a
   * foto chegar é a proporção dos atributos — seis fotos do kit são 800×1200
   * na derivada, e declarar 850×567 nelas reservava 344×229 para uma imagem
   * que entrava com 344×516 (auditoria do lote 4). A foto do Corpo vem do
   * storage e ninguém sabe quanto ela mede: sem `width`/`height`, a caixa
   * continua sendo a do CSS.
   */
  const medida = medidaDaFoto(fonte.src);
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
        src={fonte.src}
        data-reserva={fonte.reserva}
        onError={reservaDaImagem}
        alt={titulo}
        width={medida?.largura}
        height={medida?.altura}
        loading="eager"
        fetchPriority="high"
        decoding="async"
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
              data-confirmacao="cancelar"
              onClick={() => setConfirmando(false)}
              className="alvo border-input h-12 flex-1 rounded-md border text-sm font-medium"
            >
              Cancelar
            </button>
            {/*
              `text-background`, e não `text-white`: no tema escuro o
              `--destructive` é claro (#f87171) e o branco em cima dele dava
              2,77:1 — reprovado no AA, e logo no botão que apaga uma foto de
              progresso para sempre. Com a cor do fundo do tema o rótulo fecha
              6,5:1 no claro e 7,2:1 no escuro (auditoria do lote 2).
            */}
            <button
              ref={confirmar}
              type="button"
              data-confirmacao="apagar"
              disabled={apagando}
              onClick={() => {
                setConfirmando(false);
                aoApagar();
              }}
              className="alvo bg-destructive text-background h-12 flex-1 rounded-md text-sm font-medium disabled:opacity-60"
            >
              {apagando ? "Apagando…" : "Apagar"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
