"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatarData, formatarKg } from "@/lib/formato";
import type { StatusDoPeso } from "@/lib/hoje";

function Caixa({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="border-border bg-card flex flex-col gap-0.5 rounded-lg border px-3 py-2">
      <span className="text-muted-foreground text-[11px] tracking-wide uppercase">
        {rotulo}
      </span>
      <span className="numero text-base">{children}</span>
    </div>
  );
}

/**
 * Faixa de status da tela Hoje (SPEC §3.1): fase, semana da fase, sequência de
 * treinos concluídos e o peso mais recente (com o pedido de pesagem).
 */
export function FaixaStatus({
  fase,
  semana,
  sequencia,
  peso,
}: {
  fase: string;
  semana: number;
  sequencia: number;
  peso: StatusDoPeso;
}) {
  return (
    <section aria-label="Situação" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Caixa rotulo="Fase">
          {fase} · semana {semana}
        </Caixa>
        <Caixa rotulo="Sequência">
          {sequencia} {sequencia === 1 ? "treino" : "treinos"}
        </Caixa>
        <Caixa rotulo="Peso">
          {peso.peso !== null ? formatarKg(peso.peso) : "—"}
        </Caixa>
        <Caixa rotulo="Pesagem">
          {peso.data === null
            ? "nunca"
            : peso.dias === 0
              ? "hoje"
              : `há ${peso.dias} ${peso.dias === 1 ? "dia" : "dias"}`}
        </Caixa>
      </div>

      {peso.pedirPesagem ? (
        <div className="border-border flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2">
          <p className="text-muted-foreground text-xs">
            {peso.data === null
              ? "Ainda não tem peso registrado."
              : `Último peso em ${formatarData(peso.data)}. Pese-se em jejum, 1× por semana.`}
          </p>
          <Button asChild variant="outline" className="alvo h-11 shrink-0 px-3">
            <Link href="/corpo">Pesar</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
