"use client";

import { Trophy } from "lucide-react";
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
import { formatarDuracao } from "@/lib/formato";
import type { ResultadoExercicio } from "@/lib/sessao";
import { cn } from "@/lib/utils";

const SENSACAO = ["péssimo", "fraco", "ok", "bom", "ótimo"];

/**
 * O fim do treino (SPEC §3.2 e §6.6): ↑ subiu / = repetiu / ↓ voltou por
 * exercício, avisos e sugestões do motor, recordes, sensação 1–5 e o peso do
 * dia. Nada é gravado até o "Salvar".
 */
export function ResumoDoFim({
  aberto,
  fim,
  aoFechar,
  resultados,
  duracaoS,
  seriesTexto,
  salvando,
  aoSalvar,
}: {
  aberto: boolean;
  /** "Concluir" ou "Abandonar": o resumo é o mesmo, o título não. */
  fim: "concluida" | "abandonada";
  aoFechar: () => void;
  resultados: ResultadoExercicio[];
  duracaoS: number;
  seriesTexto: string;
  salvando: boolean;
  aoSalvar: (dados: { sensacao: number | null; peso: number | null }) => void;
}) {
  const [sensacao, setSensacao] = useState<number | null>(null);
  const [peso, setPeso] = useState<number | null>(null);
  const [mostraPeso, setMostraPeso] = useState(false);

  const comEvento = resultados.filter((r) => r.motivo !== null);
  const naoAvaliados = resultados.filter((r) => r.naoAvaliado);
  const recordes = resultados.flatMap((r) =>
    r.recordes.map((rec) => ({ nome: r.nome, texto: rec.texto })),
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? null : aoFechar())}>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {fim === "abandonada" ? "Treino abandonado" : "Treino concluído"}
          </DialogTitle>
          <DialogDescription>
            {formatarDuracao(duracaoS)} · {seriesTexto}
          </DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">O que muda no próximo treino</h3>
          {comEvento.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum exercício com séries suficientes para o motor avaliar.
            </p>
          ) : (
            <ul aria-label="Resumo por exercício" className="flex flex-col divide-y">
              {comEvento.map((r) => (
                <li key={r.exercicioId} className="flex flex-col gap-0.5 py-2 first:pt-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "numero w-4 shrink-0 text-center text-base",
                        r.simbolo === "↑" && "text-primary",
                        r.simbolo === "↓" && "text-destructive",
                      )}
                    >
                      {r.simbolo}
                    </span>
                    <span className="text-sm font-medium text-balance">{r.nome}</span>
                  </div>
                  <p className="numero pl-6 text-sm">
                    {r.texto}
                    {r.falha ? (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · conta como falha
                      </span>
                    ) : null}
                  </p>
                  {r.aviso ? (
                    <p className="text-muted-foreground pl-6 text-xs">{r.aviso}</p>
                  ) : null}
                  {r.sugestao ? (
                    <p className="text-primary pl-6 text-xs">{r.sugestao}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {/* SPEC §6.3: sem a carga atual do exercício não dá para avaliar */}
          {naoAvaliados.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              Sem avaliar, porque não consegui ler a carga atual:{" "}
              {naoAvaliados.map((r) => r.nome).join(" · ")}. As séries foram
              guardadas; a progressão fica como está.
            </p>
          ) : null}
        </section>

        {recordes.length > 0 ? (
          <section className="border-primary/40 bg-primary/5 flex flex-col gap-1 rounded-lg border p-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Trophy className="text-primary size-4" />
              Recordes
            </h3>
            <ul aria-label="Recordes" className="flex flex-col gap-0.5 text-xs">
              {recordes.map((r, i) => (
                <li key={`${r.nome}-${i}`}>
                  <span className="font-medium">{r.nome}:</span>{" "}
                  <span className="numero">{r.texto}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Como foi o treino?</h3>
          <div role="radiogroup" aria-label="Sensação" className="flex gap-1.5">
            {SENSACAO.map((nome, i) => {
              const nota = i + 1;
              return (
                <button
                  key={nome}
                  type="button"
                  role="radio"
                  aria-checked={sensacao === nota}
                  aria-label={`${nota} — ${nome}`}
                  onClick={() => setSensacao(nota)}
                  className={cn(
                    "alvo numero h-12 flex-1 rounded-lg border text-base",
                    sensacao === nota
                      ? "border-primary bg-primary/10"
                      : "border-input bg-background",
                  )}
                >
                  {nota}
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          {mostraPeso ? (
            <>
              <h3 className="text-sm font-semibold">Peso de hoje</h3>
              <StepperNumerico
                rotulo="peso de hoje em kg"
                valor={peso}
                passo={0.1}
                decimal
                sufixo="kg"
                aoMudar={setPeso}
              />
            </>
          ) : (
            <Button
              variant="outline"
              className="alvo h-11"
              onClick={() => setMostraPeso(true)}
            >
              Registrar o peso de hoje
            </Button>
          )}
        </section>

        <div className="flex flex-col gap-2">
          <Button
            className="alvo h-14 w-full text-base font-semibold"
            disabled={salvando}
            onClick={() => aoSalvar({ sensacao, peso })}
          >
            {salvando ? "Salvando…" : "Salvar e voltar"}
          </Button>
          <Button variant="ghost" className="alvo h-11" onClick={aoFechar} disabled={salvando}>
            Voltar ao treino
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
