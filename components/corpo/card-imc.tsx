"use client";

import { useState } from "react";
import { StepperNumerico } from "@/components/stepper-numerico";
import { Button } from "@/components/ui/button";
import { formatarNumero } from "@/lib/formato";
import {
  FAIXAS_DE_IMC,
  RESSALVA_DO_IMC,
  faixaDoImc,
  faixasDaBarra,
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
 *
 * SPEC §22.19 item 5: a faixa se lê em TEXTO sob a barra — abaixo ·
 * saudável · sobrepeso · obesidade, a atual em negrito — e o marcador é um
 * traço fino com um triângulo apontando para a barra, não um círculo que a
 * cobre.
 */
export function CardImc({
  pesoKg,
  alturaCm,
  aoMudarAltura,
  className,
  nivel = 3,
}: {
  pesoKg: number | null;
  alturaCm: number | null;
  /** Grava `profiles.altura_cm`; sem isto a altura não é editável. */
  aoMudarAltura?: (cm: number) => void;
  className?: string;
  /**
   * O nível do título: `h3` onde o card mora dentro de uma seção (Relatório,
   * conclusão); `h2` na aba Peso do Corpo, logo abaixo do `h1`.
   */
  nivel?: 2 | 3;
}) {
  const [editando, setEditando] = useState(false);
  const [altura, setAltura] = useState<number | null>(alturaCm);

  const valor = imc(pesoKg, alturaCm);
  const faixa = faixaDoImc(valor);
  const posicao = posicaoNaBarra(valor);
  const trechos = faixasDaBarra(valor);
  const Titulo = nivel === 2 ? "h2" : "h3";

  return (
    <section
      aria-label="IMC"
      className={cn("cartao border-border bg-card flex flex-col gap-2 border p-3", className)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Titulo className="text-sm font-semibold">IMC</Titulo>
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
            decimal
            minimo={100}
            maximo={230}
            sufixo="cm"
            aoMudar={setAltura}
          />
          <Button
            className="alvo shrink-0"
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

          <div className="relative pt-2.5" aria-hidden="true">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full">
              {FAIXAS_DE_IMC.map((f) => (
                <span
                  key={f.chave}
                  className={COR[f.chave] ?? "bg-muted"}
                  style={{ width: `${larguraDaFaixa(f) * 100}%` }}
                />
              ))}
            </div>
            {/*
              O marcador: um triângulo em cima da barra e um traço de 2 px que
              a atravessa, com um contorno da cor do cartão para separar do
              laranja.
            */}
            <span
              data-marcador="imc"
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${(posicao ?? 0) * 100}%` }}
            >
              <span className="border-t-foreground size-0 border-x-[5px] border-t-[6px] border-x-transparent" />
              <span className="bg-foreground h-4 w-0.5 shadow-[0_0_0_1.5px_var(--card)]" />
            </span>
            <div className="mt-1 flex">
              {trechos.map((t) => (
                <span
                  key={t.chave}
                  data-trecho={t.chave}
                  data-atual={t.atual ? "" : undefined}
                  style={{ width: `${t.largura * 100}%` }}
                  className={cn(
                    "text-micro text-center whitespace-nowrap",
                    t.atual ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  {t.rotulo}
                </span>
              ))}
            </div>
          </div>

          <p className="text-muted-foreground text-xs text-balance">{RESSALVA_DO_IMC}</p>
        </>
      )}
    </section>
  );
}
