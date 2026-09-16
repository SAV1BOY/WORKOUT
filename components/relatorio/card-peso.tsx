"use client";

import Link from "next/link";
import { GraficoLinha, SemDados } from "@/components/graficos";
import { Button } from "@/components/ui/button";
import { dominioFolgado, pontosDePeso, ultimoPeso, type PesoBruto } from "@/lib/corpo";
import { formatarData, formatarKg } from "@/lib/formato";

/**
 * O card de Peso do Relatório (SPEC §14.4, como na referência): "Registrar",
 * o peso atual, o maior e o menor, e o gráfico pequeno. Registrar mesmo é em
 * Corpo → Peso, que é onde a balança já mora (§3.8).
 */
export function CardPeso({ pesos }: { pesos: PesoBruto[] }) {
  /*
   * O eixo x mostra a data em dd/MM, como o gráfico do Corpo (§3.8) e o resto
   * do app: sem o rótulo, o Recharts desenhava o ISO cru ("2026-09-07"), que
   * nem é pt-BR nem cabe a 360 px.
   */
  const pontos = pontosDePeso(pesos).map((p) => ({
    ...p,
    rotulo: formatarData(p.data),
  }));
  const ultimo = ultimoPeso(pesos);
  const valores = pontos.map((p) => p.peso);
  const maior = valores.length > 0 ? Math.max(...valores) : null;
  const menor = valores.length > 0 ? Math.min(...valores) : null;
  const dominioY = dominioFolgado(valores, 1);

  return (
    <section
      aria-label="Peso"
      className="cartao border-border bg-card flex flex-col gap-2 border p-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Peso</h3>
        <Button asChild variant="ghost" className="alvo text-primary -mr-2 h-11 text-xs">
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
          <p className="numero text-muted-foreground text-xs">
            maior {maior !== null ? formatarKg(maior) : "—"} · menor{" "}
            {menor !== null ? formatarKg(menor) : "—"}
          </p>
          {pontos.length > 1 ? (
            <GraficoLinha
              titulo="Peso por pesagem"
              dados={pontos}
              x="rotulo"
              sufixo=" kg"
              altura={120}
              dominioY={dominioY}
              series={[{ chave: "peso", nome: "Peso" }]}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
