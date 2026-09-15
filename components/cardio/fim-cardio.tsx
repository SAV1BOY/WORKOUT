"use client";

import { useState } from "react";
import { StepperNumerico } from "@/components/stepper-numerico";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { niveisDeEsforco, type PlanoCardio } from "@/lib/cardio";
import { formatarDuracao } from "@/lib/formato";
import type { Esforco } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface DadosDoFim {
  distanciaKm: number | null;
  saltos: number | null;
  esforco: Esforco | null;
  notas: string | null;
}

/**
 * O fim da sessão de cardio (SPEC §3.3): na corrida, distância (opcional) e o
 * teste da fala com os textos de `data/cardio.json`; na corda, os saltos e o
 * teste da fala; na **caminhada leve e no "outro", só duração e nota**, como
 * manda a §3.3. Nada é gravado antes do "Salvar".
 */
export function FimDoCardio({
  aberto,
  plano,
  decorridoS,
  repeticoesCumpridas,
  saltosSugeridos,
  salvando,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  plano: PlanoCardio;
  decorridoS: number;
  repeticoesCumpridas: number;
  saltosSugeridos: number | null;
  salvando: boolean;
  aoFechar: () => void;
  aoSalvar: (dados: DadosDoFim) => void;
}) {
  const [distancia, setDistancia] = useState<number | null>(null);
  const [saltos, setSaltos] = useState<number | null>(saltosSugeridos);
  const [esforco, setEsforco] = useState<Esforco | null>(null);
  const [notas, setNotas] = useState("");
  const niveis = niveisDeEsforco();
  /*
   * SPEC §3.3: "Caminhada leve / outro: só duração e nota". A distância é da
   * corrida e o teste da fala é de quem teve esforço planejado (corrida e
   * corda); na caminhada e no "outro" fica só a nota.
   */
  const comEsforco = plano.tipo === "corrida" || plano.tipo === "corda";

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? null : aoFechar())}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plano.titulo}</DialogTitle>
          <DialogDescription>
            {formatarDuracao(decorridoS)}
            {plano.repeticoes > 0
              ? ` · ${repeticoesCumpridas} de ${plano.repeticoes} blocos`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {plano.tipo === "corda" ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Saltos (aproximado)</h3>
            <StepperNumerico
              rotulo="saltos"
              valor={saltos}
              passo={10}
              aoMudar={setSaltos}
            />
          </section>
        ) : null}

        {plano.tipo === "corrida" ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Distância (opcional)</h3>
            <StepperNumerico
              rotulo="distância em km"
              valor={distancia}
              passo={0.1}
              decimal
              sufixo="km"
              aoMudar={setDistancia}
            />
          </section>
        ) : null}

        {comEsforco ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Teste da fala</h3>
            <div
              role="radiogroup"
              aria-label="Esforço"
              className="flex flex-col gap-1.5"
            >
              {niveis.map((n) => (
                <button
                  key={n.valor}
                  type="button"
                  role="radio"
                  aria-checked={esforco === n.valor}
                  onClick={() => setEsforco(n.valor)}
                  className={cn(
                    "alvo flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left",
                    esforco === n.valor
                      ? "border-primary bg-primary/10"
                      : "border-input bg-background",
                  )}
                >
                  <span className="text-sm font-medium capitalize">
                    {n.nivel}
                  </span>
                  <span className="text-muted-foreground text-xs text-balance">
                    {n.consegue}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <Label htmlFor="nota-cardio" className="text-sm font-semibold">
            Nota (opcional)
          </Label>
          <Input
            id="nota-cardio"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Como foi?"
            className="h-11"
            enterKeyHint="done"
          />
        </section>

        <div className="flex flex-col gap-2">
          <Button
            className="alvo h-14 w-full text-base font-semibold"
            disabled={salvando}
            onClick={() =>
              aoSalvar({
                distanciaKm: plano.tipo === "corrida" ? distancia : null,
                saltos: plano.tipo === "corda" ? saltos : null,
                esforco: comEsforco ? esforco : null,
                notas: notas.trim() === "" ? null : notas.trim(),
              })
            }
          >
            {salvando ? "Salvando…" : "Salvar e voltar"}
          </Button>
          <Button
            variant="ghost"
            className="alvo h-11"
            onClick={aoFechar}
            disabled={salvando}
          >
            Voltar para o timer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
