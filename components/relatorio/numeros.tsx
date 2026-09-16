"use client";

import { ChevronsUp, Dumbbell, Footprints, Timer, Weight } from "lucide-react";
import { useMemo, useState } from "react";
import { Contador } from "@/components/ui/contador";
import { formatarKm, formatarNumero } from "@/lib/formato";
import {
  PERIODOS,
  ROTULO_DO_PERIODO,
  numerosDoPeriodo,
  treinosComSessao,
  type CardioContavel,
  type Numeros,
  type Periodo,
} from "@/lib/numeros";
import type { SerieBruta, SessaoBruta, SoltaBruta } from "@/lib/progresso";
import { cn } from "@/lib/utils";

/**
 * "Números" (SPEC §19.2): o seletor Semana · Mês · Tudo e as contagens por
 * tipo. Tudo o que aparece aqui sai de `lib/numeros.ts` — este componente só
 * desenha.
 */
export function Numeros({
  hoje,
  sessoes,
  series,
  cardios,
  soltas,
}: {
  hoje: string;
  sessoes: readonly SessaoBruta[];
  series: readonly SerieBruta[];
  cardios: readonly CardioContavel[];
  soltas: readonly SoltaBruta[];
}) {
  const [periodo, setPeriodo] = useState<Periodo>("semana");

  const numeros = useMemo(
    () => numerosDoPeriodo({ periodo, hoje, sessoes, series, cardios, soltas }),
    [periodo, hoje, sessoes, series, cardios, soltas],
  );

  return (
    <section aria-label="Números" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Números</h2>
        <p className="text-muted-foreground text-xs">
          quantos de cada coisa no período
        </p>
      </div>

      <div
        role="group"
        aria-label="Período"
        className="border-border bg-card flex gap-1 rounded-xl border p-1"
      >
        {PERIODOS.map((p) => (
          <button
            key={p}
            type="button"
            data-periodo={p}
            aria-pressed={periodo === p}
            onClick={() => setPeriodo(p)}
            className={cn(
              "alvo flex-1 rounded-lg px-2 text-sm font-medium",
              periodo === p
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {ROTULO_DO_PERIODO[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Contador
          rotulo="Força"
          valor={formatarNumero(numeros.forca.sessoes)}
          detalhe={numeros.forca.sessoes === 1 ? "sessão" : "sessões"}
          icone={<Dumbbell aria-hidden="true" className="size-3" />}
        />
        <Contador
          rotulo="Cardio"
          valor={formatarNumero(numeros.cardio.sessoes)}
          detalhe={numeros.cardio.sessoes === 1 ? "sessão" : "sessões"}
          icone={<Footprints aria-hidden="true" className="size-3" />}
        />
        <Contador
          rotulo="Barra fixa"
          valor={formatarNumero(numeros.barraFixa.reps)}
          detalhe={numeros.barraFixa.reps === 1 ? "repetição" : "repetições"}
          icone={<ChevronsUp aria-hidden="true" className="size-3" />}
        />
      </div>

      <dl aria-label="Detalhe dos números" className="flex flex-col gap-1.5">
        <Linha rotulo="Força" partes={detalheDaForca(numeros)} />
        <Linha rotulo="Cardio" partes={detalheDoCardio(numeros)} />
        <Linha rotulo="Barra fixa" partes={detalheDaBarraFixa(numeros)} />
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <Contador
          rotulo="Minutos"
          valor={formatarNumero(numeros.minutos)}
          detalhe="no período"
          icone={<Timer aria-hidden="true" className="size-3" />}
        />
        <Contador
          rotulo="Volume (kg)"
          valor={formatarNumero(numeros.volumeKg)}
          detalhe="no período"
          icone={<Weight aria-hidden="true" className="size-3" />}
        />
      </div>
    </section>
  );
}

function Linha({ rotulo, partes }: { rotulo: string; partes: string[] }) {
  return (
    <div
      data-detalhe={rotulo}
      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
    >
      <dt className="text-muted-foreground shrink-0 text-xs font-medium">
        {rotulo}
      </dt>
      <dd className="numero min-w-0 flex-1 text-xs text-balance">
        {partes.length > 0 ? partes.join(" · ") : "nada ainda"}
      </dd>
    </div>
  );
}

/** "Treino A 8 · Treino B 4 · Livres 1" — nome vindo de programa.json. */
function detalheDaForca(numeros: Numeros): string[] {
  const partes = treinosComSessao(numeros.forca).map(
    (t) => `${t.nome} ${formatarNumero(t.sessoes)}`,
  );
  if (numeros.forca.livres > 0) {
    partes.push(`Livres ${formatarNumero(numeros.forca.livres)}`);
  }
  return partes;
}

function detalheDoCardio({ cardio }: Numeros): string[] {
  const partes: string[] = [];
  if (cardio.corrida > 0) partes.push(`Corrida ${formatarNumero(cardio.corrida)}`);
  if (cardio.corda > 0) partes.push(`Corda ${formatarNumero(cardio.corda)}`);
  if (cardio.outros > 0) partes.push(`Outros ${formatarNumero(cardio.outros)}`);
  if (cardio.minutos > 0) partes.push(`${formatarNumero(cardio.minutos)} min`);
  if (cardio.km > 0) partes.push(formatarKm(cardio.km));
  if (cardio.saltos > 0) partes.push(`${formatarNumero(cardio.saltos)} saltos`);
  return partes;
}

function detalheDaBarraFixa({ barraFixa }: Numeros): string[] {
  const partes: string[] = [];
  if (barraFixa.sessoes > 0) {
    partes.push(
      `${formatarNumero(barraFixa.sessoes)} ${barraFixa.sessoes === 1 ? "sessão" : "sessões"}`,
    );
  }
  if (barraFixa.repsEmSessao > 0) {
    partes.push(`${formatarNumero(barraFixa.repsEmSessao)} em sessão`);
  }
  if (barraFixa.repsSoltas > 0) {
    partes.push(`${formatarNumero(barraFixa.repsSoltas)} soltas`);
  }
  if (barraFixa.melhorSerie > 0) {
    partes.push(`melhor série ${formatarNumero(barraFixa.melhorSerie)}`);
  }
  return partes;
}
