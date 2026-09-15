"use client";

import { useState } from "react";
import { StepperNumerico } from "@/components/stepper-numerico";
import { Button } from "@/components/ui/button";
import { formatarNumero } from "@/lib/formato";
import {
  FAIXAS_DE_IMC,
  IMC_MAX,
  IMC_MIN,
  RESSALVA_DO_IMC,
  faixaDoImc,
  imc,
  larguraDaFaixa,
  posicaoNaBarra,
} from "@/lib/imc";
import { cn } from "@/lib/utils";

/** A cor de cada faixa da barra, do mesmo laranja do app (SPEC §13.5). */
const COR: Record<string, string> = {
  abaixo: "bg-primary/25",
  saudavel: "bg-primary",
  sobrepeso: "bg-primary/60",
  obesidade1: "bg-primary/40",
  obesidade2: "bg-primary/25",
};

/**
 * O card de IMC (SPEC §13.5 e §14.1.5): o número, a faixa em pt-BR, a barra de
 * 15 a 40 com o marcador e a altura editável.
 */
export function CardImc({
  pesoKg,
  alturaCm,
  aoMudarAltura,
  className,
}: {
  pesoKg: number | null;
  alturaCm: number | null;
  /** Grava `profiles.altura_cm`; sem isto a altura não é editável. */
  aoMudarAltura?: (cm: number) => void;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [altura, setAltura] = useState<number | null>(alturaCm);

  const valor = imc(pesoKg, alturaCm);
  const faixa = faixaDoImc(valor);
  const posicao = posicaoNaBarra(valor);

  return (
    <section
      aria-label="IMC"
      className={cn("cartao border-border bg-card flex flex-col gap-2 border p-3", className)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">IMC</h3>
        {aoMudarAltura ? (
          <button
            type="button"
            className="alvo text-primary text-xs underline underline-offset-4"
            onClick={() => {
              setAltura(alturaCm);
              setEditando((v) => !v);
            }}
          >
            {editando ? "Cancelar" : "Editar altura"}
          </button>
        ) : null}
      </div>

      {editando && aoMudarAltura ? (
        <div className="flex items-center gap-2">
          <StepperNumerico
            rotulo="altura em cm"
            valor={altura}
            passo={1}
            minimo={100}
            maximo={230}
            sufixo="cm"
            aoMudar={setAltura}
          />
          <Button
            className="alvo h-11 shrink-0"
            onClick={() => {
              if (altura) aoMudarAltura(altura);
              setEditando(false);
            }}
          >
            Salvar
          </Button>
        </div>
      ) : null}

      {valor === null ? (
        <p className="text-muted-foreground text-sm">
          {alturaCm === null
            ? "Informe a altura para ver o IMC."
            : "Registre o peso para ver o IMC."}
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="numero-grande text-3xl">{formatarNumero(valor)}</span>
            <span className="text-muted-foreground text-sm">{faixa?.rotulo}</span>
          </div>

          <div className="relative pt-1 pb-4">
            <div
              className="flex h-2.5 w-full overflow-hidden rounded-full"
              aria-hidden="true"
            >
              {FAIXAS_DE_IMC.map((f) => (
                <span
                  key={f.chave}
                  className={COR[f.chave] ?? "bg-muted"}
                  style={{ width: `${larguraDaFaixa(f) * 100}%` }}
                />
              ))}
            </div>
            <span
              aria-hidden="true"
              data-marcador="imc"
              className="border-background bg-foreground absolute top-0 size-4 -translate-x-1/2 rounded-full border-2"
              style={{ left: `${(posicao ?? 0) * 100}%` }}
            />
            <span className="text-muted-foreground numero absolute bottom-0 left-0 text-[10px]">
              {IMC_MIN}
            </span>
            <span className="text-muted-foreground numero absolute right-0 bottom-0 text-[10px]">
              {IMC_MAX}
            </span>
          </div>

          <p className="text-muted-foreground text-xs text-balance">{RESSALVA_DO_IMC}</p>
        </>
      )}
    </section>
  );
}
