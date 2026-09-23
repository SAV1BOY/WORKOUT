"use client";

import { useState } from "react";
import { FotoAmpliada } from "@/components/exercicios/foto-ampliada";
import { fonteComReserva, reservaDaImagem } from "@/components/ui/imagem";
import { urlFotos } from "@/lib/dados";
import { medidaDaFoto, proporcaoDaFoto, urlWebp } from "@/lib/midia";
import type { Exercicio } from "@/lib/schemas";

const LEGENDA = ["início do movimento", "fim do movimento"];
/** A legenda visível sob cada foto (SPEC §22.13 item 2). */
const LEGENDA_CURTA = ["Início", "Fim"];

/**
 * As duas fotos do exercício (SPEC §3.6 e §7): toque abre em tela cheia. A
 * caixa tem a proporção do arquivo — 3:2 em quase todas, 2:3 (retrato) no
 * agachamento búlgaro e nas duas barras fixas — e a foto é `object-contain`:
 * nenhuma é cortada, nem se a medida faltar. O quadrado cortava a barra. A
 * legenda "Início" / "Fim" fica visível (SPEC §22.13 item 2).
 */
export function FotosAmpliaveis({ exercicio }: { exercicio: Exercicio }) {
  const fotos = urlFotos(exercicio);
  const [aberta, setAberta] = useState<number | null>(null);
  if (fotos.length === 0) return null;

  const foto = aberta === null ? null : fotos[aberta];

  return (
    <>
      <ul className="grid grid-cols-2 items-start gap-2">
        {fotos.map((url, i) => {
          // a derivada WebP (SPEC §22.4 item 1): 44 kB no lugar de 70
          const fonte = fonteComReserva(url, urlWebp(url));
          // a medida do arquivo pedido, de `data/medidas-de-foto.json`
          // (SPEC §22.4 item 3) — as fotos do kit não são uniformes
          const medida = medidaDaFoto(fonte.src);
          return (
            <li key={url} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setAberta(i)}
                className="alvo block w-full"
                aria-label={`Ampliar a foto do ${LEGENDA[i] ?? "movimento"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- foto local em /public */}
                <img
                  src={fonte.src}
                  data-reserva={fonte.reserva}
                  onError={reservaDaImagem}
                  alt={`${exercicio.nome} — ${LEGENDA[i] ?? "movimento"}`}
                  width={medida?.largura}
                  height={medida?.altura}
                  loading="lazy"
                  decoding="async"
                  data-foto-execucao
                  style={{ aspectRatio: proporcaoDaFoto(fonte.src) }}
                  className="bg-muted/40 h-auto w-full rounded-lg object-contain"
                />
              </button>
              <span className="text-muted-foreground text-xs" data-legenda-foto>
                {LEGENDA_CURTA[i] ?? ""}
              </span>
            </li>
          );
        })}
      </ul>

      {foto ? (
        <FotoAmpliada
          url={foto}
          titulo={`${exercicio.nome} — ${LEGENDA[aberta ?? 0] ?? "movimento"}`}
          aoFechar={() => setAberta(null)}
        />
      ) : null}
    </>
  );
}
