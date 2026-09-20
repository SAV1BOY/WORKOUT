"use client";

import { Dumbbell } from "lucide-react";
import { useState } from "react";
import { midiaDaMiniatura } from "@/lib/midia";
import { cn } from "@/lib/utils";

/** O lado da derivada quadrada que `npm run assets` gera (SPEC §22.4 item 1). */
const LADO_DA_DERIVADA = 112;

/**
 * Miniatura de um exercício (SPEC §13.3 e marco Mídia): a ilustração com
 * licença livre quando existe, senão a figura animada, senão a foto `-1.jpg`,
 * e o ícone quando nenhuma carrega. A escolha é de `lib/midia.ts`; todas as
 * imagens saem de `assets/` pelo caminho do JSON (§13.1).
 *
 * SPEC §22.4 itens 1 e 4 — o que muda aqui:
 *
 * - a imagem pedida é a derivada de 112 px (2× a caixa de 56), não o JPEG de
 *   850×567 que vinha antes; o original é a reserva do `onError`;
 * - a derivada já nasce quadrada, com a ilustração alta cortada pelo alto, e
 *   por isso foto e ilustração usam **um** enquadramento só;
 * - o texto alternativo é vazio por padrão: em toda lista do app o nome do
 *   exercício está escrito ao lado, e repeti-lo faria o leitor de tela ler
 *   tudo duas vezes. `sozinha` devolve o nome para a imagem.
 */
export function Miniatura({
  exercicioId,
  sozinha = false,
  className,
}: {
  exercicioId: string;
  /** Quando não há nome escrito ao lado — a imagem precisa se nomear. */
  sozinha?: boolean;
  className?: string;
}) {
  const { tipo, url, mini, alt } = midiaDaMiniatura(exercicioId);
  /** 0 = derivada · 1 = arquivo original · 2 = desisti, fica o ícone. */
  const [queda, setQueda] = useState(0);
  const fonte = queda === 0 ? (mini ?? url) : queda === 1 ? url : null;
  const naDerivada = fonte !== null && fonte === mini;

  return (
    <span
      data-midia={fonte ? tipo : "nenhuma"}
      data-derivada={naDerivada ? "sim" : "nao"}
      className={cn(
        "relative block size-14 shrink-0 overflow-hidden rounded-xl",
        // a ilustração é traço preto sobre transparente: precisa de fundo claro
        tipo === "ilustracao" && fonte ? "bg-ilustracao" : "bg-muted/60",
        className,
      )}
    >
      {fonte ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagens locais de /public (SVG animado inclusive: o next/image rasteriza e mata a animação)
        <img
          src={fonte}
          alt={sozinha ? alt : ""}
          width={LADO_DA_DERIVADA}
          height={LADO_DA_DERIVADA}
          loading="lazy"
          decoding="async"
          className={cn(
            "size-full",
            // a derivada é quadrada: um object-fit só para foto e ilustração
            naDerivada || tipo === "foto"
              ? "object-cover"
              : "object-contain p-1",
          )}
          onError={() => setQueda((q) => q + 1)}
        />
      ) : (
        <span className="text-muted-foreground flex size-full items-center justify-center">
          <Dumbbell aria-hidden="true" className="size-5" />
        </span>
      )}
    </span>
  );
}
