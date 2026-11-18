"use client";

import Link from "next/link";
import { SemDados } from "@/components/graficos";
import { GraficoDoPeso } from "@/components/corpo/grafico-peso";
import { Button } from "@/components/ui/button";
import { pontosDePeso, textoDaVariacao, ultimoPeso, type PesoBruto } from "@/lib/corpo";
import { formatarData, formatarKg } from "@/lib/formato";

/**
 * O card de Peso do Relatório (SPEC §14.4, como na referência): "Registrar",
 * o peso atual, a variação do período e o gráfico pequeno. Registrar mesmo é
 * em Corpo → Peso, que é onde a balança já mora (§3.8).
 *
 * SPEC §22.19 item 3: o "maior · menor" virou "−1,8 kg desde 12/08" — é
 * isso que se procura aqui —, e o gráfico é o MESMO do Corpo
 * (`GraficoDoPeso`: a mesma régua de 2 em 2 kg e a meta tracejada), só que
 * sem a média de 7 dias.
 */
export function CardPeso({ pesos, meta }: { pesos: PesoBruto[]; meta: number | null }) {
  const ultimo = ultimoPeso(pesos);
  const variacao = textoDaVariacao(pesos);
  const quantas = pontosDePeso(pesos).length;

  return (
    <section
      aria-label="Peso"
      className="cartao border-border bg-card flex flex-col gap-2 border p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Peso</h3>
        <Button asChild variant="ghost" className="alvo text-primary -mr-2 text-xs">
          <Link href="/corpo">Registrar</Link>
        </Button>
      </div>

      {ultimo === null ? (
        <SemDados>A primeira pesagem faz este card aparecer.</SemDados>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="numero-grande text-3xl">{formatarKg(ultimo.peso)}</span>
            <span className="text-muted-foreground text-xs">
              em {formatarData(ultimo.data)}
            </span>
          </div>
          {variacao ? (
            <p className="numero text-muted-foreground text-xs">{variacao}</p>
          ) : null}
          {quantas > 1 ? (
            <GraficoDoPeso pesos={pesos} meta={meta} altura={120} comMedia={false} />
          ) : null}
        </>
      )}
    </section>
  );
}
